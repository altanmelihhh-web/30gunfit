/**
 * 30gunfit - Haftalık Sağlık Raporu e-postası.
 *
 * GitHub Actions cron ile her Pazar 12:00 (Europe/Istanbul) çalışır. Firebase Blaze
 * planı GEREKTİRMEZ - Firestore'u admin SDK ile okur, Resend ile e-posta yollar.
 *
 * Gerekli ortam değişkenleri (GitHub Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  - Firebase servis hesabı JSON'unun tamamı (tek satır string)
 *   RESEND_API_KEY            - Resend API anahtarı
 *   REPORT_FROM (ops.)        - gönderen adresi (varsayılan: onboarding@resend.dev)
 *
 * Her kullanıcı KENDİ verisinden KENDİ e-postasına rapor alır.
 */

import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { getPhaseLabel, getPredictions, shiftKey as shiftKeyLocal, summarizeWeekEntries } from './cycle.mjs';

const ALL_USERS = ['altanmelihhh@gmail.com', 'emineay12@gmail.com'];
// Elle tetiklenen test gönderiminde tek adrese sınırlamak için (workflow_dispatch input).
const ONLY_EMAIL = (process.env.REPORT_ONLY_EMAIL || '').trim().toLowerCase();
const USERS = ONLY_EMAIL ? ALL_USERS.filter((email) => email.toLowerCase() === ONLY_EMAIL) : ALL_USERS;
// Elle tetiklemede haftalık gönderim kilidini yok say.
const FORCE_SEND = String(process.env.FORCE_SEND || '').toLowerCase() === 'true';
// Mail atmadan sadece bu haftayı "gönderildi" işaretle (yedek cron tekrar atmasın).
const MARK_SENT_ONLY = String(process.env.MARK_SENT_ONLY || '').toLowerCase() === 'true';
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const REPORT_FROM = `30 Gün Fit <${GMAIL_USER}>`;

// `node index.mjs --preview` örnek veriyle preview.html üretir; Firebase/SMTP gerektirmez.
const PREVIEW = process.argv.includes('--preview');

let transporter = null;
let db = null;
let auth = null;

if (!PREVIEW) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT eksik'); process.exit(1);
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('GMAIL_USER / GMAIL_APP_PASSWORD eksik'); process.exit(1);
  }

  // Gmail SMTP - domain gerektirmez, her alıcıya gönderir (uygulama şifresi ile)
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
  db = admin.firestore();
  auth = admin.auth();
}

// ---- yardımcılar ----
// Rapor haftasının anahtari: Europe/Istanbul saatine göre en son Pazar (YYYY-MM-DD).
// Yedek cron geciktiginde bile ayni haftaya ayni anahtar duser.
const reportWeekKey = () => {
  const istanbulToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const d = new Date(`${istanbulToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

const sentLogRef = (weekKey, email) => db.collection('weeklyReportLog').doc(`${weekKey}__${email}`);

const lastNDates = (n) => {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
};
const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0);
const num = (v) => parseFloat(v) || 0;
const validRange = (v, min, max) => v >= min && v <= max;
const computeBMR = (profile) => {
  if (!profile) return null;
  const weight = num(profile.weight);
  const height = num(profile.height);
  const age = num(profile.age);
  if (!validRange(weight, 30, 300) || !validRange(height, 100, 250) || !validRange(age, 13, 100)) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(profile.gender === 'female' ? base - 161 : base + 5);
};

const profileWithLatestWeight = (profile, entries = []) => {
  if (!profile || !Array.isArray(entries) || entries.length === 0) return profile;
  const latest = [...entries]
    .filter((entry) => validRange(num(entry.weight), 30, 300))
    .sort((a, b) => new Date(b.date || b.timestamp || 0) - new Date(a.date || a.timestamp || 0))[0];
  return latest ? { ...profile, weight: num(latest.weight) } : profile;
};

const REGION_KEYWORDS = [
  ['Göğüs', ['göğüs', 'gogus', 'chest', 'bench', 'fly', 'şınav', 'dips', 'pec']],
  ['Sırt', ['sırt', 'sirt', 'row', 'lat', 'pulldown', 'pull up', 'barfiks', 'deadlift', 'back']],
  ['Bacak', ['bacak', 'leg', 'squat', 'lunge', 'hamstring', 'calf', 'baldır', 'hip', 'kalça', 'glute', 'abduction', 'adduction']],
  ['Omuz', ['omuz', 'shoulder', 'deltoid', 'lateral', 'ohp', 'arnold']],
  ['Kol', ['kol', 'biceps', 'triceps', 'curl', 'pushdown', 'hammer', 'arm']],
  ['Karın', ['karın', 'karin', 'abs', 'plank', 'crunch', 'mekik', 'core']],
  ['Kardiyo', ['kardiyo', 'cardio', 'koşu', 'kosu', 'run', 'treadmill', 'koşu bandı', 'yürü', 'yuru', 'walk', 'bisiklet', 'bike']]
];
const classify = (name) => {
  const n = (name || '').toLocaleLowerCase('tr');
  for (const [label, kws] of REGION_KEYWORDS) if (kws.some((k) => n.includes(k))) return label;
  return 'Diğer';
};

const getDoc = async (path) => {
  const snap = await db.doc(path).get();
  return snap.exists ? snap.data() : null;
};

// src/utils/micronutrients.js'in rapor tarafındaki karşılığı. Doğrudan import edilemiyor:
// kök package.json "type: module" değil, bu paket module - Node onu CommonJS sanıp patlıyor.
// Mailde sadece Lif ve Sodyum gösteriliyor; diğerleri karar değiştirmeyen gürültü.
const MICRO_KEYS = ['fiber', 'sugars', 'sodium', 'saturatedFat'];

const dayMicros = (meals = []) => {
  const totals = { fiber: 0, sugars: 0, sodium: 0, saturatedFat: 0, sourceMealCount: 0 };
  meals.forEach((meal) => {
    const micro = meal?.micronutrients;
    if (!micro || !MICRO_KEYS.some((key) => num(micro[key]) > 0)) return;
    totals.sourceMealCount += 1;
    MICRO_KEYS.forEach((key) => { totals[key] += num(micro[key]); });
  });
  return totals;
};

const averageMicros = (dayTotals = []) => {
  const withData = dayTotals.filter((day) => day.sourceMealCount > 0);
  if (!withData.length) return { loggedDays: 0 };
  const out = { loggedDays: withData.length };
  MICRO_KEYS.forEach((key) => {
    out[key] = withData.reduce((sum, day) => sum + day[key], 0) / withData.length;
  });
  return out;
};

// Takviye adı karşılaştırması: "D2 + K3" ile "D2+K3" aynı sayılsın.
const normalizeSupplementName = (name) => (name || '').toLocaleLowerCase('tr').replace(/[\s.]/g, '');

const supplementSummary = (logDocs) => {
  const counts = new Map();
  let days = 0;
  logDocs.forEach((log) => {
    const items = log?.supplements || [];
    if (!items.length) return;
    days += 1;
    const seenToday = new Set();
    items.forEach((item) => {
      const key = normalizeSupplementName(item?.name);
      if (!key || seenToday.has(key)) return;
      seenToday.add(key);
      const current = counts.get(key);
      counts.set(key, { name: item.name, count: (current?.count || 0) + 1 });
    });
  });
  return {
    days,
    top: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4)
  };
};

const noteList = (dates, logDocs) => dates
  .map((date, index) => ({ date, text: (logDocs[index]?.notes || '').trim() }))
  .filter((item) => item.text)
  .slice(-3);

const mergeEntriesByDate = (...entryLists) => {
  const byDate = new Map();
  entryLists.flat().filter(Boolean).forEach((entry) => {
    if (!entry?.date) return;
    const previous = byDate.get(entry.date);
    if (!previous || new Date(entry.timestamp || 0) >= new Date(previous.timestamp || 0)) {
      byDate.set(entry.date, entry);
    }
  });
  return Array.from(byDate.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const getWeightDoc = async (uid, email) => {
  const emailKey = (email || '').trim().toLowerCase();
  const [uidDoc, emailDoc] = await Promise.all([
    getDoc(`weightTracking/${uid}`),
    emailKey ? getDoc(`weightTrackingByEmail/${emailKey}`) : null
  ]);
  if (!uidDoc && !emailDoc) return null;
  return {
    ...(uidDoc || {}),
    ...(emailDoc || {}),
    entries: mergeEntriesByDate(uidDoc?.entries || [], emailDoc?.entries || []),
    targetWeight: emailDoc?.targetWeight || uidDoc?.targetWeight || null
  };
};

const weekStartKeyFor = (dateStr) => {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
};

const checklistSummary = (planDoc, checklistDoc, dates) => {
  const items = planDoc?.items || [];
  const checks = checklistDoc?.checks || {};
  const weekKeys = new Set(dates.map(weekStartKeyFor));
  const planned = items.length * weekKeys.size;
  const completed = items.reduce((count, item) => (
    count + [...weekKeys].filter((weekKey) => checks[`${weekKey}:${item.id}`]).length
  ), 0);
  return {
    planned,
    completed,
    items: items.map((item) => ({
      ...item,
      completed: [...weekKeys].some((weekKey) => checks[`${weekKey}:${item.id}`])
    }))
  };
};

const previousWeekDates = (dates) => {
  const first = new Date(dates[0]);
  return Array.from({ length: dates.length }, (_, index) => {
    const d = new Date(first);
    d.setDate(d.getDate() - dates.length + index);
    return d.toISOString().split('T')[0];
  });
};

// Delta kuralları: eşiğin altındaki fark gösterilmez (gürültü).
// `better` metriğin hangi yöne gitmesinin iyi olduğunu söyler; 'none' ise renk nötr kalır.
const DELTA_RULES = {
  deficit: { label: 'Kalori açığı', threshold: 100, unit: ' kcal', better: 'up' },
  calories: { label: 'Ortalama alınan kalori', threshold: 100, unit: ' kcal', better: 'none' },
  protein: { label: 'Protein', threshold: 5, unit: 'g', better: 'up' },
  sleep: { label: 'Uyku', threshold: 0.3, unit: ' saat', better: 'up', digits: 1 },
  steps: { label: 'Adım', threshold: 500, unit: '', better: 'up' },
  workoutDays: { label: 'Antrenman günü', threshold: 0.5, unit: ' gün', better: 'up' },
  weight: { label: 'Kilo', threshold: 0.3, unit: ' kg', better: 'down', digits: 1 }
};

// İki haftada da en az bu kadar gün veri yoksa kıyas yapılmaz.
const MIN_DELTA_COVERAGE = 4;

const computeDelta = (key, current, currentDays, previous, previousDays) => {
  const rule = DELTA_RULES[key];
  if (!rule || current == null || previous == null) return null;
  if (key !== 'weight' && (currentDays < MIN_DELTA_COVERAGE || previousDays < MIN_DELTA_COVERAGE)) return null;
  const diff = current - previous;
  if (Math.abs(diff) < rule.threshold) return null;
  const good = rule.better === 'none' ? null : rule.better === 'up' ? diff > 0 : diff < 0;
  return { key, label: rule.label, diff, current, previous, good, rule, score: Math.abs(diff) / rule.threshold };
};

// Delta için önceki haftanın özeti. waterDoc/bmr gibi tekil veriler bu haftadan
// devralınır; sadece 14 ek doküman (7 kalori + 7 log) okunur.
const buildPrevSummary = async (uid, dates, { waterDoc, bmr }) => {
  const [calDocs, logDocs] = await Promise.all([
    Promise.all(dates.map((d) => getDoc(`calorieTracking/${uid}_${d}`))),
    Promise.all(dates.map((d) => getDoc(`dailyLogs/${uid}_${d}`)))
  ]);

  const cals = [], prot = [], sleepVals = [], stepVals = [], deficits = [];
  let workoutDays = 0;
  calDocs.forEach((c, i) => {
    const meals = c?.meals || [];
    if (!meals.length) return;
    const consumed = meals.reduce((sum, m) => sum + num(m.calories), 0);
    cals.push(consumed);
    prot.push(meals.reduce((sum, m) => sum + num(m.protein), 0));
    if (bmr != null) {
      const workoutCalories = (logDocs[i]?.workouts || []).reduce((sum, w) => sum + num(w.calories), 0);
      const active = num(logDocs[i]?.vitals?.active_calories) || workoutCalories;
      deficits.push((bmr + active) - consumed);
    }
  });
  logDocs.forEach((log) => {
    if (log?.sleep?.duration_hours) sleepVals.push(num(log.sleep.duration_hours));
    if (log?.vitals?.steps) stepVals.push(num(log.vitals.steps));
    const ws = (log?.workouts || []).filter((w) => (w.exercises && w.exercises.length) || w.title || w.duration_min);
    if (ws.length) workoutDays += 1;
  });

  const waterByDate = {};
  (waterDoc?.entries || []).forEach((e) => {
    if (dates.includes(e.date)) waterByDate[e.date] = (waterByDate[e.date] || 0) + num(e.amount);
  });

  return {
    calories: { value: avg(cals), days: cals.length },
    protein: { value: avg(prot), days: prot.length },
    deficit: { value: deficits.length ? Math.round(deficits.reduce((s, x) => s + x, 0) / deficits.length) : null, days: deficits.length },
    sleep: { value: sleepVals.length ? sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length : null, days: sleepVals.length },
    steps: { value: avg(stepVals), days: stepVals.length },
    workoutDays: { value: workoutDays, days: 7 },
    water: { value: avg(Object.values(waterByDate)), days: Object.keys(waterByDate).length }
  };
};

// Regl bölümü profildeki cinsiyet "female" ise üretilir. Cinsiyet seçilmemiş ama
// kayıt varsa (eski kullanıcı) bölüm yine gösterilir - uygulamadaki kuralla aynı.
const buildCycleSummary = (periodDoc, dates, profileDoc) => {
  const entries = periodDoc?.entries || [];
  const eligible = (profileDoc?.gender || '').toLowerCase() === 'female' || entries.length > 0;
  if (!eligible || !entries.length) return null;

  const today = dates[dates.length - 1];
  const predictions = getPredictions(entries, periodDoc.settings || {}, today);
  if (!predictions) return null;

  const week = summarizeWeekEntries(entries, dates);
  const tolerance = predictions.confidenceDays || 3;
  const overdueDays = -predictions.daysUntilNext;

  return {
    cycleDay: predictions.cycleDay,
    phase: getPhaseLabel(predictions.cycleDay, predictions.cycleLength, predictions.periodLength),
    cycleLength: predictions.cycleLength,
    source: predictions.source,
    sampleCount: predictions.sampleCount,
    nextStart: predictions.nextStart,
    nextStartEarly: predictions.nextStartEarly,
    nextStartLate: predictions.nextStartLate,
    confidenceDays: predictions.confidenceDays,
    daysUntilNext: predictions.daysUntilNext,
    overdue: overdueDays > tolerance ? overdueDays : null,
    week
  };
};

const buildReport = async (uid, email, dates = lastNDates(7)) => {

  const [calDocs, logDocs, waterDoc, weightDoc, goalsDoc, profileDoc, planDoc, checklistDoc, periodDoc] = await Promise.all([
    Promise.all(dates.map((d) => getDoc(`calorieTracking/${uid}_${d}`))),
    Promise.all(dates.map((d) => getDoc(`dailyLogs/${uid}_${d}`))),
    getDoc(`waterTracking/${uid}`),
    getWeightDoc(uid, email),
    getDoc(`nutritionGoals/${uid}`),
    getDoc(`userProfiles/${uid}`),
    getDoc(`weeklyWorkoutPlans/${uid}`),
    getDoc(`weeklyWorkoutChecklists/${uid}`),
    getDoc(`periodTrackers/${uid}`)
  ]);

  // Beslenme
  const cals = [], prot = [], carb = [], fat = [];
  calDocs.forEach((c) => {
    const meals = c?.meals || [];
    if (!meals.length) return;
    cals.push(meals.reduce((s, m) => s + num(m.calories), 0));
    prot.push(meals.reduce((s, m) => s + num(m.protein), 0));
    carb.push(meals.reduce((s, m) => s + num(m.carbs), 0));
    fat.push(meals.reduce((s, m) => s + num(m.fats), 0));
  });

  // Su / uyku / adım / antrenman
  const waterByDate = {};
  if (waterDoc) (waterDoc.entries || []).forEach((e) => {
    if (dates.includes(e.date)) waterByDate[e.date] = (waterByDate[e.date] || 0) + e.amount;
  });
  const sleepVals = [], sleepScores = [], stepVals = [], activeVals = [], exerciseVals = [], distanceVals = [], workouts = [];
  let workoutDays = 0, totalDuration = 0;
  logDocs.forEach((log) => {
    if (log?.sleep?.duration_hours) sleepVals.push(log.sleep.duration_hours);
    if (log?.sleep?.score) sleepScores.push(log.sleep.score);
    if (log?.vitals?.steps) stepVals.push(log.vitals.steps);
    if (log?.vitals?.active_calories) activeVals.push(num(log.vitals.active_calories));
    if (log?.vitals?.exercise_minutes) exerciseVals.push(num(log.vitals.exercise_minutes));
    if (log?.vitals?.distance_km) distanceVals.push(num(log.vitals.distance_km));
    const ws = (log?.workouts || []).filter((w) => (w.exercises && w.exercises.length) || w.title || w.duration_min);
    if (ws.length) workoutDays += 1;
    ws.forEach((w) => { workouts.push(w); totalDuration += num(w.duration_min); });
  });

  let totalSets = 0, totalVolume = 0;
  const regionSets = {};
  workouts.forEach((w) => (w.exercises || []).forEach((ex) => {
    const region = classify(ex.name);
    (ex.sets || []).forEach((s) => {
      totalSets += 1;
      if (s.weight_kg && s.reps) totalVolume += s.weight_kg * s.reps;
      regionSets[region] = (regionSets[region] || 0) + 1;
    });
  }));
  const regionRows = Object.entries(regionSets).sort((a, b) => b[1] - a[1]);

  // Kilo - hafta içinde kayıt yoksa en son kaydı "kaç gün önce" notuyla göster
  let weightEnd = null, weightChange = null, weightStaleDays = null;
  const targetWeight = num(weightDoc?.targetWeight) || null;
  if (weightDoc) {
    const all = (weightDoc.entries || []).filter((e) => e?.date && num(e.weight) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const inWeek = all.filter((e) => dates.includes(e.date));
    if (inWeek.length) {
      weightEnd = inWeek[inWeek.length - 1].weight;
      weightChange = Math.round((weightEnd - inWeek[0].weight) * 10) / 10;
    } else if (all.length) {
      const latest = all[all.length - 1];
      weightEnd = latest.weight;
      weightStaleDays = Math.round((new Date(dates[dates.length - 1]) - new Date(latest.date)) / 86400000);
    }
  }
  const toTarget = weightEnd != null && targetWeight
    ? Math.round((weightEnd - targetWeight) * 10) / 10
    : null;

  const g = goalsDoc || {};
  const waterVals = Object.values(waterByDate);

  // Bilimsel kalori açığı: toplam harcama (BMR + aktif kalori) - alınan kalori.
  const bmr = computeBMR(profileWithLatestWeight(profileDoc, weightDoc?.entries || []));
  let totalDeficit = null, avgDeficit = null;
  const calorieDays = dates.map((d, i) => {
    const meals = calDocs[i]?.meals || [];
    const consumed = meals.reduce((s, m) => s + num(m.calories), 0);
    const workoutCalories = (logDocs[i]?.workouts || []).reduce((s, w) => s + num(w.calories), 0);
    return { consumed, activeCalories: num(logDocs[i]?.vitals?.active_calories) || workoutCalories };
  }).filter((d) => d.consumed > 0);
  if (bmr != null && calorieDays.length) {
    const defs = calorieDays.map((d) => (bmr + d.activeCalories) - d.consumed);
    totalDeficit = Math.round(defs.reduce((s, x) => s + x, 0));
    avgDeficit = Math.round(totalDeficit / calorieDays.length);
  }
  const avgActive = avg(activeVals);
  const avgBurned = bmr != null ? Math.round(bmr + avgActive) : null;
  const daily = dates.map((date, i) => {
    const meals = calDocs[i]?.meals || [];
    const consumed = meals.reduce((s, m) => s + num(m.calories), 0);
    const active = num(logDocs[i]?.vitals?.active_calories);
    const deficit = bmr != null && consumed > 0 ? Math.round(bmr + active - consumed) : null;
    return {
      date,
      consumed,
      active,
      deficit,
      water: waterByDate[date] || 0,
      sleep: logDocs[i]?.sleep?.duration_hours || null,
      steps: logDocs[i]?.vitals?.steps || null,
      exercise: logDocs[i]?.vitals?.exercise_minutes || null
    };
  });

  // Geçen haftayla kıyas (+14 doküman okuması)
  const prevDates = previousWeekDates(dates);
  const prev = await buildPrevSummary(uid, prevDates, { waterDoc, bmr });
  const prevWeightEntry = weightDoc
    ? (weightDoc.entries || []).filter((e) => prevDates.includes(e.date)).sort((a, b) => new Date(a.date) - new Date(b.date)).pop()
    : null;

  const avgSleepValue = sleepVals.length ? sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length : null;
  const deltas = [
    computeDelta('deficit', avgDeficit, calorieDays.length, prev.deficit.value, prev.deficit.days),
    computeDelta('calories', cals.length ? avg(cals) : null, cals.length, prev.calories.value || null, prev.calories.days),
    computeDelta('protein', prot.length ? avg(prot) : null, prot.length, prev.protein.value || null, prev.protein.days),
    computeDelta('sleep', avgSleepValue, sleepVals.length, prev.sleep.value, prev.sleep.days),
    computeDelta('steps', stepVals.length ? avg(stepVals) : null, stepVals.length, prev.steps.value || null, prev.steps.days),
    computeDelta('workoutDays', workoutDays, 7, prev.workoutDays.value, 7),
    computeDelta('weight', weightStaleDays ? null : weightEnd, 7, prevWeightEntry ? num(prevWeightEntry.weight) : null, 7)
  ].filter(Boolean);
  const deltaByKey = Object.fromEntries(deltas.map((d) => [d.key, d]));

  const microDays = calDocs.map((c) => dayMicros(c?.meals || []));
  const supplements = supplementSummary(logDocs);
  const notes = noteList(dates, logDocs);
  const coverage = {
    meals: cals.length,
    sleep: sleepVals.length,
    steps: stepVals.length,
    water: Object.keys(waterByDate).length,
    workout: workoutDays,
    supplements: supplements.days,
    total: dates.length
  };

  return {
    period: `${dates[0]} – ${dates[dates.length - 1]}`,
    deltas,
    deltaByKey,
    nutrition: { cals: avg(cals), prot: avg(prot), carb: avg(carb), fat: avg(fat), days: cals.length, totalDeficit, avgDeficit },
    micros: averageMicros(microDays),
    supplements,
    notes,
    coverage,
    goals: g,
    water: avg(waterVals),
    waterDays: waterVals.length,
    sleep: sleepVals.length ? (sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length).toFixed(1) : null,
    sleepScore: avg(sleepScores),
    steps: avg(stepVals),
    stepDays: stepVals.length,
    activity: { active: avgActive, burned: avgBurned, bmr, exercise: avg(exerciseVals), distance: Math.round(avg(distanceVals) * 10) / 10 },
    workout: {
      days: workoutDays,
      sets: totalSets,
      volume: Math.round(totalVolume),
      duration: Math.round(totalDuration),
      regions: regionRows,
      checklist: checklistSummary(planDoc, checklistDoc, dates)
    },
    weight: { end: weightEnd, change: weightChange, target: targetWeight, toTarget, staleDays: weightStaleDays },
    cycle: buildCycleSummary(periodDoc, dates, profileDoc),
    daily
  };
};

// ---- e-posta şablonu (Outlook/Gmail uyumlu, tablo tabanlı ve inline CSS) ----
const NF = (n) => Number(n || 0).toLocaleString('tr-TR');
const DASH = '&ndash;';
const fmt = (n, unit = '') => (n != null && n !== 0 ? `${NF(n)}${unit}` : DASH);
const pct = (value, target) => (target ? Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(target)) * 100))) : 0);
const shortDate = (date) => new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

// Verisi olmayan bölüm hiç basılmaz: "–" dolu kutular maili bozuk gösteriyordu.
const sectionIf = (hasData, title, subtitle, inner) => (hasData ? section(title, subtitle, inner) : '');

const section = (title, subtitle, inner) => `
  <tr><td style="padding:0 22px 16px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#ffffff;border:1px solid #dfe5ef;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px 6px 20px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#111827;">${title}</div>
          ${subtitle ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;margin-top:2px;">${subtitle}</div>` : ''}
        </td>
      </tr>
      <tr><td style="padding:8px 20px 18px 20px;">${inner}</td></tr>
    </table>
  </td></tr>`;

const kpi = (label, value, detail, color = '#111827', badge = '') => `
  <td width="50%" valign="top" style="padding:6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="border-collapse:separate;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:14px 14px 12px 14px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:.4px;text-transform:uppercase;color:#6b7280;font-weight:700;">${label}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;color:${color};font-weight:800;margin-top:4px;">${value}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#6b7280;margin-top:2px;">${detail || '&nbsp;'}</div>
        ${badge || ''}
      </td></tr>
    </table>
  </td>`;

const kvRow = (label, value, note = '', last = false) => `
  <tr>
    <td width="42%" valign="top" style="padding:11px 0;${last ? '' : 'border-bottom:1px solid #e5e7eb;'}font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#4b5563;">${label}</td>
    <td width="58%" align="right" valign="top" style="padding:11px 0;${last ? '' : 'border-bottom:1px solid #e5e7eb;'}font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#111827;font-weight:700;">${value}${note ? `<div style="font-size:11px;line-height:16px;color:#6b7280;font-weight:400;margin-top:2px;">${note}</div>` : ''}</td>
  </tr>`;

const progressRow = (label, value, target, unit, color = '#2563eb') => {
  const width = pct(value, target);
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4b5563;">${label}</td>
          <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;font-weight:700;">${fmt(value, unit)}${target ? ` <span style="color:#9ca3af;font-weight:400;">/ ${NF(target)}${unit}</span>` : ''}</td>
        </tr>
        <tr><td colspan="2" style="padding-top:7px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="${width}%" bgcolor="${color}" style="height:8px;background:${color};font-size:0;line-height:0;">&nbsp;</td>
            <td width="${100 - width}%" bgcolor="#edf2f7" style="height:8px;background:#edf2f7;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr>`;
};

const barRow = (label, sets, max) => {
  const width = Math.max(6, Math.round((sets / (max || 1)) * 100));
  return `<tr>
    <td width="92" style="padding:8px 10px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#374151;">${label}</td>
    <td style="padding:8px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="${width}%" bgcolor="#0f766e" style="height:9px;background:#0f766e;font-size:0;line-height:0;">&nbsp;</td>
        <td width="${100 - width}%" bgcolor="#e5e7eb" style="height:9px;background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td>
      </tr></table>
    </td>
    <td width="42" align="right" style="padding:8px 0 8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;font-weight:700;">${sets}</td>
  </tr>`;
};

const checklistRows = (checklist) => {
  const items = checklist?.items || [];
  if (!items.length) {
    return `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Checklist planı yok.</td></tr>`;
  }
  return items.map((item) => `<tr>
    <td width="28" style="padding:8px 8px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${item.completed ? '#047857' : '#9ca3af'};font-weight:800;">${item.completed ? '✓' : '□'}</td>
    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#374151;">${item.title}${item.optional ? ' <span style="color:#6b7280;">· opsiyonel</span>' : ''}</td>
  </tr>`).join('');
};

const dailyTable = (r) => {
  const rows = r.daily.map((d) => {
    const defColor = d.deficit == null ? '#6b7280' : d.deficit >= 0 ? '#047857' : '#b91c1c';
    const defText = d.deficit == null ? DASH : `${NF(Math.abs(d.deficit))} ${d.deficit >= 0 ? 'açık' : 'fazla'}`;
    return `<tr>
      <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#374151;white-space:nowrap;">${shortDate(d.date)}</td>
      <td align="right" style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;font-weight:700;">${d.consumed ? NF(Math.round(d.consumed)) : DASH}</td>
      <td align="right" style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${defColor};font-weight:700;">${defText}</td>
      <td align="right" style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;">${d.active ? NF(Math.round(d.active)) : DASH}</td>
      <td align="right" style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;">${d.water ? NF(d.water) : DASH}</td>
      <td align="right" style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;">${d.sleep || DASH}</td>
      <td align="right" style="padding:9px 0 9px 8px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;">${d.steps ? NF(d.steps) : DASH}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      ${['Gün', 'Alınan', 'Açık', 'Aktif', 'Su', 'Uyku', 'Adım'].map((h, i) => `<td align="${i === 0 ? 'left' : 'right'}" style="padding:0 ${i === 6 ? '0' : '8px'} 8px ${i === 0 ? '0' : '8px'};border-bottom:2px solid #cbd5e1;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#6b7280;font-weight:700;text-transform:uppercase;">${h}</td>`).join('')}
    </tr>
    ${rows}
  </table>`;
};

const escapeHtml = (text = '') => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mailde sadece Lif ve Sodyum: şeker ve doymuş yağ karar değiştirmiyor, satır şişiriyor.
const microRows = (micros) => {
  if (!micros?.loggedDays) return '';
  return kvRow(
    'Lif / Sodyum',
    `${micros.fiber.toFixed(1)}g &middot; ${micros.sodium.toFixed(2)}g`,
    `${micros.loggedDays} gün mikro besin verisi (barkodlu ürünlerden)`
  );
};

const coverageInner = (r) => {
  const c = r.coverage;
  const rows = [
    ['Öğün', c.meals], ['Uyku', c.sleep], ['Su', c.water],
    ['Adım', c.steps], ['Antrenman', c.workout], ['Takviye', c.supplements]
  ];
  const missing = rows.filter(([, value]) => value === 0).map(([label]) => label.toLocaleLowerCase('tr'));
  const cells = rows.map(([label, value]) => `
    <td width="33%" align="center" style="padding:8px 4px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:18px;line-height:22px;font-weight:800;color:${value === 0 ? '#9ca3af' : '#111827'};">${value}/${c.total}</div>
      <div style="font-size:11px;line-height:16px;color:#6b7280;">${label}</div>
    </td>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>${cells.slice(0, 3).join('')}</tr>
      <tr>${cells.slice(3).join('')}</tr>
    </table>
    ${missing.length ? `<div style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">Bu hafta hiç girilmeyen: ${missing.join(', ')}.</div>` : ''}`;
};

const fmtDeltaValue = (delta) => {
  const digits = delta.rule.digits || 0;
  const abs = Math.abs(delta.diff);
  const text = digits ? abs.toFixed(digits) : NF(Math.round(abs));
  return `${delta.diff > 0 ? '+' : '-'}${text}${delta.rule.unit}`;
};

const deltaColor = (delta) => (delta.good === null ? '#6b7280' : delta.good ? '#047857' : '#b91c1c');

// KPI kutusunun altındaki küçük kıyas satırı.
const deltaBadge = (delta) => {
  if (!delta) return '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:${deltaColor(delta)};font-weight:700;margin-top:4px;">${delta.diff > 0 ? '&#9650;' : '&#9660;'} ${fmtDeltaValue(delta)} geçen haftaya göre</div>`;
};

const headlineBlock = (r) => {
  const n = r.nutrition;
  const delta = r.deltaByKey.deficit;
  let title;
  let sub;
  if (n.avgDeficit != null) {
    title = `Günde ortalama ${NF(Math.abs(n.avgDeficit))} kcal ${n.avgDeficit >= 0 ? 'açık' : 'fazla'}`;
    sub = delta
      ? `Geçen haftaya göre ${fmtDeltaValue(delta)} · ${n.days} gün öğün kaydı`
      : `${n.days} gün öğün kaydı · geçen haftayla kıyas için yeterli veri yok`;
  } else if (n.days) {
    title = `Günde ortalama ${NF(n.cals)} kcal alındı`;
    sub = 'Kalori açığı için profil bilgisi (kilo, boy, yaş) gerekiyor';
  } else {
    title = 'Bu hafta öğün kaydı yok';
    sub = 'Tek bir gün bile girsen haftaya kıyas yapabiliriz';
  }
  return `<tr><td style="padding:20px 22px 4px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-collapse:separate;background:#ffffff;border:1px solid #dfe5ef;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:.4px;text-transform:uppercase;color:#6b7280;font-weight:700;">Haftanın manşeti</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827;font-weight:800;margin-top:6px;">${title}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#6b7280;margin-top:6px;">${sub}</div>
      </td></tr>
    </table>
  </td></tr>`;
};

// Sabit eşikli genel yorum yerine, o hafta EN ÇOK sapan metrikten tek cümle.
const insightSentence = (r) => {
  const best = [...r.deltas].sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  const digits = best.rule.digits || 0;
  const fmtValue = (value) => (digits ? Number(value).toFixed(digits) : NF(Math.round(value)));
  const change = `${fmtValue(best.previous)}${best.rule.unit} &rarr; ${fmtValue(best.current)}${best.rule.unit}`;
  const map = {
    deficit: () => `Kalori açığın ${best.diff > 0 ? 'büyüdü' : 'daraldı'}: ${change}.`,
    calories: () => `Ortalama alımın ${best.diff > 0 ? 'arttı' : 'azaldı'}: ${change}.`,
    protein: () => `Protein ortalaman ${best.diff > 0 ? 'yükseldi' : 'düştü'}: ${change}.`,
    sleep: () => `Uyku ortalaman ${Math.round(Math.abs(best.diff) * 60)} dakika ${best.diff > 0 ? 'arttı' : 'azaldı'}: ${change}.`,
    steps: () => `Adım ortalaman ${best.diff > 0 ? 'arttı' : 'düştü'}: ${change}.`,
    workoutDays: () => `Antrenman günü sayın ${best.diff > 0 ? 'arttı' : 'azaldı'}: ${change}.`,
    weight: () => `Kilon ${Math.abs(best.diff).toFixed(1)} kg ${best.diff < 0 ? 'düştü' : 'çıktı'}: ${change}.`
  };
  const sentence = map[best.key] ? map[best.key]() : `${best.label}: ${change}.`;
  return { sentence, good: best.good };
};

const insightBlock = (r) => {
  const insight = insightSentence(r);
  if (!insight) return '';
  const accent = insight.good === null ? '#2563eb' : insight.good ? '#047857' : '#b45309';
  return `<tr><td style="padding:10px 22px 6px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-collapse:separate;background:#ffffff;border:1px solid #dfe5ef;border-left:4px solid ${accent};border-radius:10px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:.4px;text-transform:uppercase;color:#6b7280;font-weight:700;">Bu haftanın tek cümlesi</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#111827;font-weight:700;margin-top:5px;">${insight.sentence}</div>
      </td></tr>
    </table>
  </td></tr>`;
};

// Dil kuralı: teşhis/tavsiye yok, "normal/anormal" yargısı yok - sadece kayda dayalı gözlem.
const cycleSection = (r) => {
  const c = r.cycle;
  if (!c) return '';

  const painText = c.week.maxPain
    ? `ortalama ${c.week.avgPain}/10, en yüksek ${c.week.maxPain}/10`
    : null;
  const symptomText = c.week.topSymptoms.length
    ? c.week.topSymptoms.map((item) => `${item.name}${item.count > 1 ? ` (${item.count} gün)` : ''}`).join(', ')
    : null;

  const predictionValue = c.confidenceDays
    ? `${shortDate(c.nextStart)} civarı`
    : shortDate(c.nextStart);
  const predictionNote = c.confidenceDays
    ? `${shortDate(c.nextStartEarly)} - ${shortDate(c.nextStartLate)} aralığı${c.source === 'learned' ? ` · son ${c.sampleCount} döngüden öğrenildi` : ' · ayardaki döngü uzunluğu kullanıldı'}`
    : (c.source === 'learned' ? `son ${c.sampleCount} döngüden öğrenildi` : 'ayardaki döngü uzunluğu kullanıldı');

  const overdueNote = c.overdue
    ? `<div style="margin-top:10px;padding:10px 12px;background:#fef3c7;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#92400e;">Tahmini tarihten ${c.overdue} gün geçti. Kayıt güncel değilse takvimi güncellemek işe yarar.</div>`
    : '';

  return section('Döngü Takibi', 'Uygulamaya işaretlediğin kayıtlardan',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${kvRow('Döngü günü', `${c.cycleDay}. gün`, c.phase ? `Tahmini faz: ${c.phase}` : '')}
      ${kvRow('Sonraki regl tahmini', predictionValue, predictionNote)}
      ${kvRow('Bu hafta kanama', c.week.bleedingDays ? `${c.week.bleedingDays} gün işaretlendi${c.week.heavyDays ? ` · ${c.week.heavyDays} gün yoğun` : ''}` : 'İşaretlenmedi')}
      ${painText ? kvRow('Bu haftaki ağrı', painText) : ''}
      ${symptomText ? kvRow('Öne çıkan semptomlar', symptomText, '', true) : ''}
    </table>
    ${overdueNote}
    <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#9ca3af;">Bu bölüm yalnızca kendi kayıtlarının özetidir, tıbbi değerlendirme değildir.</div>`);
};

const summarizeWeek = (r) => {
  const g = r.goals || {};
  const n = r.nutrition || {};
  const daysWithMeals = r.daily.filter((d) => d.consumed > 0);
  const lowWaterDays = g.water ? r.daily.filter((d) => d.water > 0 && d.water < g.water).length : null;
  const lowSleepDays = r.daily.filter((d) => d.sleep && d.sleep < 7).length;
  const aboveTargetCalories = g.calories ? daysWithMeals.filter((d) => d.consumed > g.calories).length : null;
  return {
    lowWaterDays,
    lowSleepDays,
    aboveTargetCalories,
    energyStatus: n.avgDeficit == null ? 'Veri bekleniyor' : n.avgDeficit >= 0 ? 'Açıkta' : 'Fazlada'
  };
};

const actionList = (r, summary) => {
  const g = r.goals || {};
  const n = r.nutrition || {};
  const d = r.deltaByKey;
  const actions = [];

  // Önce bu hafta gerçekten sapan metrikler - her hafta aynı listeyi yazmamak için.
  if (d.sleep && d.sleep.good === false) {
    actions.push(`Uyku ortalaman ${Math.round(Math.abs(d.sleep.diff) * 60)} dakika düştü. Ağır antrenman günlerinden önceki geceyi koru.`);
  }
  if (d.workoutDays && d.workoutDays.good === false) {
    actions.push(`Antrenman günü ${Math.abs(d.workoutDays.diff)} azaldı. Haftaya sabit iki gün belirleyip takvime yaz.`);
  }
  if (d.protein && d.protein.good === false) {
    actions.push(`Protein ortalaman ${Math.round(Math.abs(d.protein.diff))}g düştü. Her güne net bir protein ana öğünü ekle.`);
  }
  if (d.deficit && d.deficit.good === false && n.avgDeficit != null && n.avgDeficit < 0) {
    actions.push('Enerji dengesi fazlaya döndü. En yüksek kalorili günü inceleyip atıştırma kaynaklarını daralt.');
  }
  if (d.steps && d.steps.good === false) {
    actions.push(`Adım ortalaman ${NF(Math.round(Math.abs(d.steps.diff)))} düştü. Günlük düşük yoğunluklu yürüyüşü geri getir.`);
  }

  // Delta yoksa/yetmiyorsa mutlak durum kuralları
  if (actions.length < 3) {
    if (n.avgDeficit != null && n.avgDeficit > 900) {
      actions.push('Ortalama açık 900 kcal üstünde. Toparlanma düşüyorsa alımı kontrollü artırmayı değerlendir.');
    }
    if (g.protein && n.days && n.prot < g.protein) {
      actions.push(`Protein ortalaması hedefin altında (${NF(n.prot)}g / ${NF(g.protein)}g).`);
    }
    if (summary.lowWaterDays > 0) actions.push(`${summary.lowWaterDays} gün su hedefinin altında kalmış. Öğünlerle sabit su zamanları ekle.`);
    if (summary.lowSleepDays > 0) actions.push(`${summary.lowSleepDays} gün 7 saatin altında uyku var.`);
    if (r.workout.days > 0 && r.workout.sets === 0) actions.push('Antrenmanlara set/ağırlık girersen hacim ve kas bölgesi dağılımı da raporlanır.');
    if (r.coverage.meals < 4) actions.push(`Bu hafta ${r.coverage.meals}/7 gün öğün kaydı var. Kıyas yapabilmek için en az 4 gün gerekiyor.`);
  }

  if (!actions.length) actions.push('Ana metrikler geçen haftayla aynı seviyede. Kayıt disiplinini koru.');
  return actions.slice(0, 3);
};

// Konu satırı: en dikkat çeken 3 sayı. Sabit başlık açılma oranını düşürüyordu.
const buildSubject = (r) => {
  const parts = [];
  const w = r.deltaByKey.weight;
  if (w) parts.push(`${w.diff < 0 ? '-' : '+'}${Math.abs(w.diff).toFixed(1)} kg`);
  if (r.nutrition.avgDeficit != null) parts.push(`${NF(Math.abs(r.nutrition.avgDeficit))} kcal ${r.nutrition.avgDeficit >= 0 ? 'açık' : 'fazla'}`);
  if (r.workout.days) parts.push(`${r.workout.days} antrenman`);
  if (r.sleep) parts.push(`${r.sleep} sa uyku`);
  const head = parts.slice(0, 3).join(' · ');
  return head ? `💪 Bu hafta: ${head}` : `💪 Haftalık raporun hazır (${r.period})`;
};

const stripTags = (html) => html.replace(/<[^>]*>/g, '').replace(/&rarr;/g, '→').replace(/&middot;/g, '·').replace(/&amp;/g, '&').trim();

const buildPreheader = (r) => {
  const insight = insightSentence(r);
  if (insight) return stripTags(insight.sentence);
  return `${r.coverage.meals}/7 gün öğün, ${r.coverage.workout}/7 gün antrenman kaydı. Detaylar içeride.`;
};

// Düz metin alternatifi: bazı istemcilerde ve spam puanında fark yaratır.
const renderText = (name, r) => {
  const insight = insightSentence(r);
  const lines = [
    `30 Gün Fit - Haftalık Rapor (${r.period})`,
    name,
    '',
    r.nutrition.avgDeficit != null
      ? `Ortalama ${Math.abs(r.nutrition.avgDeficit)} kcal ${r.nutrition.avgDeficit >= 0 ? 'açık' : 'fazla'} · ${r.nutrition.days} gün öğün kaydı`
      : `${r.nutrition.days} gün öğün kaydı`,
    insight ? stripTags(insight.sentence) : '',
    '',
    `Ortalama alınan: ${r.nutrition.cals} kcal · Protein ${r.nutrition.prot}g · Karbonhidrat ${r.nutrition.carb}g · Yağ ${r.nutrition.fat}g`,
    r.sleep ? `Uyku: ${r.sleep} saat` : '',
    r.water ? `Su: ${r.water} ml` : '',
    r.steps ? `Adım: ${r.steps}` : '',
    `Antrenman: ${r.workout.days} gün`,
    r.weight.end != null ? `Kilo: ${r.weight.end} kg${r.weight.toTarget != null ? ` (hedefe ${Math.abs(r.weight.toTarget)} kg)` : ''}` : '',
    r.cycle ? `Döngü: ${r.cycle.cycleDay}. gün${r.cycle.phase ? ` (${r.cycle.phase})` : ''} · sonraki tahmin ${r.cycle.nextStart}${r.cycle.overdue ? ` · ${r.cycle.overdue} gün gecikme` : ''}` : '',
    '',
    'Kayıt kapsamı: ' + [
      `öğün ${r.coverage.meals}/7`, `uyku ${r.coverage.sleep}/7`, `su ${r.coverage.water}/7`,
      `adım ${r.coverage.steps}/7`, `antrenman ${r.coverage.workout}/7`
    ].join(' · '),
    '',
    'Aksiyonlar:',
    ...actionList(r, summarizeWeek(r)).map((t, i) => `${i + 1}. ${stripTags(t)}`),
    '',
    'https://gunfit-c0243.web.app'
  ];
  return lines.filter((line) => line !== '').join('\n');
};

const renderHtml = (name, r) => {
  const g = r.goals || {};
  const n = r.nutrition;
  const summary = summarizeWeek(r);
  const actions = actionList(r, summary);
  const deficitColor = n.avgDeficit == null ? '#111827' : n.avgDeficit >= 0 ? '#047857' : '#b91c1c';
  const deficitValue = n.avgDeficit == null ? DASH : `${NF(Math.abs(n.avgDeficit))}`;
  const deficitDetail = n.avgDeficit == null
    ? 'BMR için geçerli profil gerekir'
    : `${n.avgDeficit >= 0 ? 'ortalama açık' : 'ortalama fazla'} · toplam ${NF(Math.abs(n.totalDeficit))} kcal`;
  const regionsInner = r.workout.regions.length
    ? r.workout.regions.map(([label, sets]) => barRow(label, sets, r.workout.regions[0][1])).join('')
    : `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Kas bölgesi verisi yok.</td></tr>`;
  const weightTrend = r.weight.change
    ? `<span style="color:${r.weight.change < 0 ? '#047857' : '#b91c1c'};font-weight:700;">${r.weight.change < 0 ? 'azalış' : 'artış'} ${Math.abs(r.weight.change)} kg</span>`
    : '';
  const weightNote = [
    r.weight.staleDays ? `${r.weight.staleDays} gün önceki son kayıt` : '',
    r.weight.toTarget != null
      ? (Math.abs(r.weight.toTarget) < 0.1
        ? `Hedef kiloda (${r.weight.target} kg)`
        : `Hedefe ${Math.abs(r.weight.toTarget)} kg ${r.weight.toTarget > 0 ? 'kaldı' : 'altındasın'} (hedef ${r.weight.target} kg)`)
      : ''
  ].filter(Boolean).join(' · ');
  const supplementNote = r.supplements.top.length
    ? r.supplements.top.map((item) => `${item.name} ${item.count}x`).join(', ')
    : '';

  // Antrenman kaydı var ama set girilmemişse sessizce "veri yok" demek yanıltıcı.
  const missingSetsNote = r.workout.days > 0 && r.workout.sets === 0
    ? `<div style="margin-top:10px;padding:10px 12px;background:#fef3c7;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#92400e;">${NF(r.workout.days)} antrenman günü kayıtlı ama hiçbirinde set/ağırlık girilmemiş. Hacim ve kas bölgesi dağılımı bu yüzden hesaplanamadı.</div>`
    : '';

  const hasActivity = r.workout.days > 0 || r.activity.active > 0 || r.steps > 0 || r.workout.checklist?.planned > 0;
  const hasRecovery = Boolean(r.water || r.sleep || r.sleepScore || r.weight.end != null || r.supplements.days);
  const hasAnyDaily = r.daily.some((d) => d.consumed || d.water || d.sleep || d.steps || d.active);


  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="x-ua-compatible" content="IE=edge">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Haftalık Sağlık Raporu</title>
</head>
<body style="margin:0;padding:0;background:#edf1f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${buildPreheader(r)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#edf1f7;">
  <tr><td align="center" style="padding:24px 10px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="width:640px;max-width:640px;border-collapse:separate;background:#f8fafc;border:1px solid #d7dee9;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">
      <tr><td bgcolor="#102033" style="padding:26px 28px;background:#102033;">
        <div style="font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:#93c5fd;font-weight:700;">30 Gün Fit Weekly Intelligence</div>
        <div style="font-size:26px;line-height:32px;color:#ffffff;font-weight:800;margin-top:6px;">Haftalık Sağlık Raporu</div>
        <div style="font-size:13px;line-height:20px;color:#cbd5e1;margin-top:8px;">${name} · ${r.period}</div>
      </td></tr>

      ${headlineBlock(r)}
      ${insightBlock(r)}

      <tr><td style="padding:12px 16px 8px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${kpi('Kalori Açığı', deficitValue, deficitDetail, deficitColor, deltaBadge(r.deltaByKey.deficit))}
            ${kpi('Tahmini Harcama', r.activity.burned ? NF(r.activity.burned) : DASH, `BMR ${r.activity.bmr ? NF(r.activity.bmr) : DASH} + aktif ${fmt(r.activity.active)}`, '#111827')}
          </tr>
          <tr>
            ${kpi('Ort. Alınan', fmt(n.cals), `${n.days} gün öğün kaydı`, '#111827', deltaBadge(r.deltaByKey.calories))}
            ${kpi('Aktivite', fmt(r.activity.active), `${fmt(r.activity.exercise, ' dk')} egzersiz · ${fmt(r.activity.distance, ' km')}`, '#111827', deltaBadge(r.deltaByKey.steps))}
          </tr>
        </table>
      </td></tr>

      ${sectionIf(n.days > 0, 'Enerji ve Beslenme', 'Günlük ortalamalar ve hedef karşılaştırması',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${progressRow('Kalori', n.cals, g.calories, ' kcal', '#f97316')}
          ${progressRow('Protein', n.prot, g.protein, 'g', '#16a34a')}
          ${r.deltaByKey.protein ? kvRow('Protein değişimi', `${fmtDeltaValue(r.deltaByKey.protein)} geçen haftaya göre`) : ''}
          ${progressRow('Karbonhidrat', n.carb, g.carbs, 'g', '#2563eb')}
          ${progressRow('Yağ', n.fat, g.fats, 'g', '#ca8a04')}
          ${microRows(r.micros)}
          ${kvRow('Enerji durumu', summary.energyStatus)}
          ${kvRow('Kalori hedefi üstü gün', summary.aboveTargetCalories != null ? `${summary.aboveTargetCalories} gün` : DASH)}
          ${kvRow('Hesap yöntemi', 'BMR + aktif kalori - alınan kalori', 'Kalori açığı hedef kaloriye göre hesaplanmaz.', true)}
        </table>`)}

      ${sectionIf(hasActivity, 'Aktivite ve Antrenman', 'Apple Watch aktivitesi ile antrenman kayıtları birlikte özetlenir',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${kvRow('Antrenman günü', `${NF(r.workout.days)} gün`, r.deltaByKey.workoutDays ? `${fmtDeltaValue(r.deltaByKey.workoutDays)} geçen haftaya göre` : '')}
          ${r.workout.checklist?.planned ? kvRow('Checklist', `${NF(r.workout.checklist.completed)}/${NF(r.workout.checklist.planned)} tamamlandı`) : ''}
          ${r.workout.duration ? kvRow('Toplam süre', `${NF(r.workout.duration)} dk`) : ''}
          ${r.workout.sets ? kvRow('Toplam set', NF(r.workout.sets)) : ''}
          ${r.workout.volume ? kvRow('Toplam hacim', `${NF(r.workout.volume)} kg`) : ''}
          ${r.steps ? kvRow('Ort. adım', NF(r.steps)) : ''}
          ${kvRow('Ort. aktif kalori', r.activity.active ? `${NF(r.activity.active)} kcal` : DASH, '', true)}
        </table>
        ${missingSetsNote}
        ${r.workout.checklist?.items?.length ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${checklistRows(r.workout.checklist)}</table>` : ''}
        ${r.workout.regions.length ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${regionsInner}</table>` : ''}`)}

      ${sectionIf(hasRecovery, 'Toparlanma ve Vücut', 'Uyku, su, takviye ve kilo takibi',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${r.water ? progressRow('Su', r.water, g.water, ' ml', '#0ea5e9') : ''}
          ${r.sleep ? kvRow('Ort. uyku', `${r.sleep} saat`, r.deltaByKey.sleep ? `${fmtDeltaValue(r.deltaByKey.sleep)} geçen haftaya göre` : '') : ''}
          ${r.sleepScore ? kvRow('Ort. uyku skoru', `${NF(r.sleepScore)}/100`) : ''}
          ${r.supplements.days ? kvRow('Takviye düzeni', `${r.supplements.days}/7 gün`, supplementNote) : ''}
          ${r.weight.end != null ? kvRow('Güncel kilo', `${r.weight.end} kg ${weightTrend}`, weightNote, true) : ''}
        </table>`)}

      ${cycleSection(r)}

      ${sectionIf(hasAnyDaily, 'Günlük Kırılım', 'Her gün için alınan kalori, gerçek açık, aktivite ve toparlanma', dailyTable(r))}

      ${sectionIf(r.notes.length > 0, 'Bu Haftaki Notların', 'Uygulamaya kendi yazdıkların',
        r.notes.map((note) => `<div style="padding:7px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#374151;"><span style="color:#6b7280;">${shortDate(note.date)}</span> &middot; ${escapeHtml(note.text)}</div>`).join(''))}

      ${section('Kayıt Kapsamı', 'Hangi alan kaç gün girilmiş', coverageInner(r))}

      ${section('Önümüzdeki Hafta İçin Aksiyonlar', 'Takibi iyileştirmek için öncelikli maddeler',
        actions.map((t, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td width="28" valign="top" style="padding:8px 8px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#ffffff;">
              <span style="display:inline-block;background:#102033;border-radius:99px;width:22px;height:22px;line-height:22px;text-align:center;font-weight:700;">${i + 1}</span>
            </td>
            <td valign="top" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#374151;">${t}</td>
          </tr>
        </table>`).join(''))}

      <tr><td align="center" style="padding:4px 22px 28px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
          <tr><td bgcolor="#102033" style="background:#102033;border-radius:8px;">
            <a href="https://gunfit-c0243.web.app" style="display:inline-block;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;">Uygulamayı Aç</a>
          </td></tr>
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#94a3b8;margin-top:14px;">30 Gün Fit · Otomatik haftalık rapor · Veriler Firestore kayıtlarından hesaplanır.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
};

const sendEmail = async (to, subject, html, text) => {
  const info = await transporter.sendMail({ from: REPORT_FROM, to, subject, html, text });
  return info.messageId;
};

// Örnek veri: şablonu Firebase/SMTP olmadan gözle kontrol etmek için (`--preview`).
const sampleDelta = (key, current, previous) =>
  computeDelta(key, current, 7, previous, 7);

// Örnek regl verisi. overdue=true ile gecikme uyarısının metnini de görebiliyoruz.
const sampleCycle = (dates, overdue = false) => {
  if (overdue) {
    const lastStart = shiftKeyLocal(dates[6], -36);
    const entries = [
      { date: lastStart, flow: 'medium', pain: 5, symptoms: [] },
      { date: shiftKeyLocal(lastStart, 1), flow: 'light', pain: 3, symptoms: [] },
      { date: shiftKeyLocal(lastStart, -28), flow: 'medium', pain: 6, symptoms: [] },
      { date: shiftKeyLocal(lastStart, -27), flow: 'light', pain: 4, symptoms: [] },
      { date: shiftKeyLocal(lastStart, -56), flow: 'medium', pain: 5, symptoms: [] },
      { date: dates[2], flow: 'none', pain: 0, symptoms: ['Şişkinlik', 'Tatlı isteği'] }
    ];
    return buildCycleSummary({ entries, settings: { cycleLength: 28, periodLength: 5 } }, dates, { gender: 'female' });
  }
  const entries = [
    { date: dates[1], flow: 'medium', pain: 6, symptoms: ['Kramp', 'Yorgunluk'] },
    { date: dates[2], flow: 'heavy', pain: 8, symptoms: ['Kramp'] },
    { date: dates[3], flow: 'light', pain: 3, symptoms: ['Bel ağrısı'] },
    { date: shiftKeyLocal(dates[1], -29), flow: 'medium', pain: 5, symptoms: [] },
    { date: shiftKeyLocal(dates[1], -28), flow: 'light', pain: 4, symptoms: [] },
    { date: shiftKeyLocal(dates[1], -59), flow: 'medium', pain: 6, symptoms: [] },
    { date: shiftKeyLocal(dates[1], -58), flow: 'light', pain: 3, symptoms: [] }
  ];
  return buildCycleSummary({ entries, settings: { cycleLength: 28, periodLength: 5 } }, dates, { gender: 'female' });
};

const sampleReport = (variant) => {
  const dates = lastNDates(7);
  const rich = variant === 'rich';
  const sampleDeltas = (rich
    ? [
      sampleDelta('deficit', 403, 268),
      sampleDelta('protein', 158, 131),
      sampleDelta('sleep', 7.2, 6.4),
      sampleDelta('steps', 8886, 7420),
      sampleDelta('workoutDays', 4, 2),
      sampleDelta('weight', 78.2, 78.9)
    ]
    : [sampleDelta('weight', 79.4, 79.1)]
  ).filter(Boolean);
  const daily = dates.map((date, i) => ({
    date,
    consumed: rich ? [2180, 2440, 1950, 2610, 2080, 2350, 0][i] : [0, 0, 1900, 0, 2100, 0, 0][i],
    active: rich ? [520, 610, 430, 700, 380, 640, 210][i] : 0,
    deficit: rich ? [430, 300, 640, 180, 520, 350, null][i] : [null, null, 380, null, 210, null, null][i],
    water: rich ? [3200, 2800, 3500, 2600, 3000, 3400, 1800][i] : 0,
    sleep: rich ? [7.2, 6.4, 7.8, 6.1, 7.5, 8.0, null][i] : null,
    steps: rich ? [9200, 11400, 7300, 12800, 6900, 10500, 4100][i] : null,
    exercise: rich ? 45 : null
  }));
  return {
    period: `${dates[0]} – ${dates[dates.length - 1]}`,
    deltas: sampleDeltas,
    deltaByKey: Object.fromEntries(sampleDeltas.map((d) => [d.key, d])),
    nutrition: rich
      ? { cals: 2268, prot: 158, carb: 212, fat: 74, days: 6, totalDeficit: 2420, avgDeficit: 403 }
      : { cals: 2000, prot: 96, carb: 180, fat: 62, days: 2, totalDeficit: 590, avgDeficit: 295 },
    micros: rich ? { fiber: 24.3, sugars: 58.2, sodium: 2.84, saturatedFat: 19.6, loggedDays: 4 } : { loggedDays: 0 },
    supplements: rich
      ? { days: 5, top: [{ name: 'Whey Protein', count: 5 }, { name: 'Kreatin', count: 4 }, { name: 'D2+K3', count: 3 }] }
      : { days: 0, top: [] },
    notes: rich ? [{ date: dates[3], text: 'Diz ağrısı yüzünden bacak günü hafif geçti.' }] : [],
    coverage: rich
      ? { meals: 6, sleep: 6, steps: 7, water: 7, workout: 4, supplements: 5, total: 7 }
      : { meals: 2, sleep: 0, steps: 0, water: 0, workout: 1, supplements: 0, total: 7 },
    goals: { calories: 2400, protein: 170, carbs: 230, fats: 80, water: 3500 },
    water: rich ? 2900 : 0,
    waterDays: rich ? 7 : 0,
    sleep: rich ? '7.2' : null,
    sleepScore: rich ? 84 : 0,
    steps: rich ? 8886 : 0,
    stepDays: rich ? 7 : 0,
    activity: rich
      ? { active: 498, burned: 2270, bmr: 1772, exercise: 45, distance: 6.4 }
      : { active: 0, burned: 1772, bmr: 1772, exercise: 0, distance: 0 },
    workout: {
      days: rich ? 4 : 1,
      sets: rich ? 62 : 0,
      volume: rich ? 24850 : 0,
      duration: rich ? 210 : 0,
      regions: rich ? [['Bacak', 18], ['Sırt', 16], ['Göğüs', 14], ['Omuz', 8], ['Kol', 6]] : [],
      checklist: rich
        ? { planned: 4, completed: 3, items: [
          { id: 'a', title: 'Full Body A', completed: true },
          { id: 'b', title: 'Full Body B', completed: true },
          { id: 'c', title: 'Kardiyo 30 dk', completed: true },
          { id: 'd', title: 'Esneme', optional: true, completed: false }
        ] }
        : { planned: 0, completed: 0, items: [] }
    },
    weight: rich
      ? { end: 78.2, change: -0.7, target: 75, toTarget: 3.2, staleDays: null }
      : { end: 79.4, change: null, target: 75, toTarget: 4.4, staleDays: 12 },
    cycle: rich ? null : sampleCycle(dates, variant === 'overdue'),
    daily
  };
};

const runPreview = async () => {
  const fs = await import('node:fs/promises');
  for (const variant of ['rich', 'sparse', 'overdue']) {
    const report = sampleReport(variant);
    const name = variant === 'rich' ? 'Melih' : 'Emine';
    const html = renderHtml(name, report);
    await fs.writeFile(`preview-${variant}.html`, html, 'utf8');
    await fs.writeFile(`preview-${variant}.txt`, renderText(name, report), 'utf8');
    console.log(`📄 preview-${variant}.html (${(html.length / 1024).toFixed(1)} KB) · konu: ${buildSubject(report)}`);
  }
};

(async () => {
  if (!PREVIEW && !USERS.length) {
    console.error(`REPORT_ONLY_EMAIL="${ONLY_EMAIL}" tanımlı kullanıcı listesinde yok.`);
    process.exit(1);
  }
  if (PREVIEW) {
    await runPreview();
    process.exit(0);
  }
  const weekKey = reportWeekKey();
  for (const email of USERS) {
    try {
      const logRef = sentLogRef(weekKey, email);
      if (MARK_SENT_ONLY) {
        await logRef.set({ email, weekKey, sentAt: admin.firestore.FieldValue.serverTimestamp(), markedOnly: true });
        console.log(`🔖 ${email}: ${weekKey} haftası gönderildi olarak işaretlendi (mail atılmadı).`);
        continue;
      }
      if (!FORCE_SEND && (await logRef.get()).exists) {
        console.log(`⏭️  ${email}: ${weekKey} haftası zaten gönderilmiş, atlandı.`);
        continue;
      }
      const userRecord = await auth.getUserByEmail(email);
      const name = userRecord.displayName || email.split('@')[0];
      const report = await buildReport(userRecord.uid, email);
      const html = renderHtml(name, report);
      const text = renderText(name, report);
      await sendEmail(email, buildSubject(report), html, text);
      await logRef.set({ email, weekKey, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`✅ Rapor gönderildi: ${email}`);
    } catch (err) {
      console.error(`❌ ${email}: ${err.message}`);
    }
  }
  process.exit(0);
})();
