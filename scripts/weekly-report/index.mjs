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

const USERS = ['altanmelihhh@gmail.com', 'emineay12@gmail.com'];
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const REPORT_FROM = `30 Gün Fit <${GMAIL_USER}>`;

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('FIREBASE_SERVICE_ACCOUNT eksik'); process.exit(1);
}
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('GMAIL_USER / GMAIL_APP_PASSWORD eksik'); process.exit(1);
}

// Gmail SMTP - domain gerektirmez, her alıcıya gönderir (uygulama şifresi ile)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
});

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();
const auth = admin.auth();

// ---- yardımcılar ----
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

const buildReport = async (uid, email) => {
  const dates = lastNDates(7);

  const [calDocs, logDocs, waterDoc, weightDoc, goalsDoc, profileDoc] = await Promise.all([
    Promise.all(dates.map((d) => getDoc(`calorieTracking/${uid}_${d}`))),
    Promise.all(dates.map((d) => getDoc(`dailyLogs/${uid}_${d}`))),
    getDoc(`waterTracking/${uid}`),
    getWeightDoc(uid, email),
    getDoc(`nutritionGoals/${uid}`),
    getDoc(`userProfiles/${uid}`)
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

  // Kilo
  let weightEnd = null, weightChange = null;
  if (weightDoc) {
    const entries = (weightDoc.entries || []).filter((e) => dates.includes(e.date))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (entries.length) {
      weightEnd = entries[entries.length - 1].weight;
      weightChange = Math.round((weightEnd - entries[0].weight) * 10) / 10;
    }
  }

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

  return {
    period: `${dates[0]} – ${dates[dates.length - 1]}`,
    nutrition: { cals: avg(cals), prot: avg(prot), carb: avg(carb), fat: avg(fat), days: cals.length, totalDeficit, avgDeficit },
    goals: g,
    water: avg(waterVals),
    waterDays: waterVals.length,
    sleep: sleepVals.length ? (sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length).toFixed(1) : null,
    sleepScore: avg(sleepScores),
    steps: avg(stepVals),
    stepDays: stepVals.length,
    activity: { active: avgActive, burned: avgBurned, bmr, exercise: avg(exerciseVals), distance: Math.round(avg(distanceVals) * 10) / 10 },
    workout: { days: workoutDays, sets: totalSets, volume: Math.round(totalVolume), duration: Math.round(totalDuration), regions: regionRows },
    weight: { end: weightEnd, change: weightChange },
    daily
  };
};

// ---- e-posta şablonu (Outlook/Gmail uyumlu, tablo tabanlı ve inline CSS) ----
const NF = (n) => Number(n || 0).toLocaleString('tr-TR');
const DASH = '&ndash;';
const fmt = (n, unit = '') => (n != null && n !== 0 ? `${NF(n)}${unit}` : DASH);
const pct = (value, target) => (target ? Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(target)) * 100))) : 0);
const shortDate = (date) => new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

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

const kpi = (label, value, detail, color = '#111827') => `
  <td width="50%" valign="top" style="padding:6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:14px 14px 12px 14px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:.4px;text-transform:uppercase;color:#6b7280;font-weight:700;">${label}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;color:${color};font-weight:800;margin-top:4px;">${value}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#6b7280;margin-top:2px;">${detail || '&nbsp;'}</div>
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

const summarizeWeek = (r) => {
  const g = r.goals || {};
  const n = r.nutrition || {};
  const daysWithMeals = r.daily.filter((d) => d.consumed > 0);
  const daysWithDeficit = r.daily.filter((d) => d.deficit != null);
  const biggestDeficit = daysWithDeficit.length ? [...daysWithDeficit].sort((a, b) => b.deficit - a.deficit)[0] : null;
  const smallestDeficit = daysWithDeficit.length ? [...daysWithDeficit].sort((a, b) => a.deficit - b.deficit)[0] : null;
  const highCalorieDay = daysWithMeals.length ? [...daysWithMeals].sort((a, b) => b.consumed - a.consumed)[0] : null;
  const lowWaterDays = g.water ? r.daily.filter((d) => d.water > 0 && d.water < g.water).length : null;
  const lowSleepDays = r.daily.filter((d) => d.sleep && d.sleep < 7).length;
  const aboveTargetCalories = g.calories ? daysWithMeals.filter((d) => d.consumed > g.calories).length : null;
  return {
    biggestDeficit,
    smallestDeficit,
    highCalorieDay,
    lowWaterDays,
    lowSleepDays,
    aboveTargetCalories,
    mealCoverage: `${daysWithMeals.length}/7`,
    energyStatus: n.avgDeficit == null ? 'Veri bekleniyor' : n.avgDeficit >= 0 ? 'Açıkta' : 'Fazlada'
  };
};

const actionList = (r, summary) => {
  const g = r.goals || {};
  const n = r.nutrition || {};
  const actions = [];
  if (n.avgDeficit != null && n.avgDeficit > 900) {
    actions.push('Ortalama açık 900 kcal üstünde. Performans ve toparlanma düşüyorsa alımı kontrollü artırmayı değerlendir.');
  } else if (n.avgDeficit != null && n.avgDeficit < 0) {
    actions.push('Hafta ortalaması fazla görünüyor. En yüksek kalorili günü inceleyip porsiyon veya atıştırma kaynaklarını daralt.');
  } else if (n.avgDeficit != null) {
    actions.push('Enerji dengesi kilo verme yönünde. Aynı düzeni sürdürürken protein ve uyku istikrarına odaklan.');
  }
  if (g.protein && n.days && n.prot < g.protein) actions.push(`Protein ortalaması hedefin altında (${NF(n.prot)}g / ${NF(g.protein)}g). Her güne net bir protein ana öğünü ekle.`);
  if (summary.lowWaterDays > 0) actions.push(`${summary.lowWaterDays} gün su hedefinin altında kalmış. Öğünlerle birlikte sabit su zamanları ekle.`);
  if (summary.lowSleepDays > 0) actions.push(`${summary.lowSleepDays} gün 7 saatin altında uyku var. Ağır antrenman günlerinden önce uyku süresini koru.`);
  if (r.activity.active && r.steps && r.steps < 8000) actions.push('Aktif kalori var ama adım ortalaması düşük. Günlük düşük yoğunluklu yürüyüş hacmini artır.');
  if (!actions.length) actions.push('Bu hafta ana metrikler dengeli. Bir sonraki hafta aynı kayıt disiplinini koru ve günlük kırılımı izlemeye devam et.');
  return actions.slice(0, 5);
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
  const notes = [];
  if (n.avgDeficit != null) notes.push(`Enerji dengesi BMR + aktif kalori - alınan kalori ile hesaplandı. Haftalık ortalama ${NF(Math.abs(n.avgDeficit))} kcal ${n.avgDeficit >= 0 ? 'açık' : 'fazla'}.`);
  if (g.protein && n.days) notes.push(n.prot >= g.protein ? `Protein hedefi karşılanıyor: ${NF(n.prot)}g / ${NF(g.protein)}g.` : `Protein hedefinin altında: ${NF(n.prot)}g / ${NF(g.protein)}g.`);
  if (r.sleep) notes.push(parseFloat(r.sleep) >= 7 ? `Uyku ortalaması sürdürülebilir seviyede: ${r.sleep} saat.` : `Uyku ortalaması düşük: ${r.sleep} saat.`);
  if (r.activity.active) notes.push(`Ortalama aktif kalori ${NF(r.activity.active)} kcal; tahmini günlük harcama ${r.activity.burned ? NF(r.activity.burned) : DASH} kcal.`);

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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${r.period} dönemi için enerji, beslenme, aktivite, uyku ve kilo raporu.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#edf1f7;">
  <tr><td align="center" style="padding:24px 10px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;border-collapse:separate;background:#f8fafc;border:1px solid #d7dee9;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">
      <tr><td style="padding:26px 28px;background:#102033;">
        <div style="font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:#93c5fd;font-weight:700;">30 Gün Fit Weekly Intelligence</div>
        <div style="font-size:26px;line-height:32px;color:#ffffff;font-weight:800;margin-top:6px;">Haftalık Sağlık Raporu</div>
        <div style="font-size:13px;line-height:20px;color:#cbd5e1;margin-top:8px;">${name} · ${r.period}</div>
      </td></tr>

      <tr><td style="padding:18px 16px 8px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${kpi('Kalori Açığı', deficitValue, deficitDetail, deficitColor)}
            ${kpi('Tahmini Harcama', r.activity.burned ? NF(r.activity.burned) : DASH, `BMR ${r.activity.bmr ? NF(r.activity.bmr) : DASH} + aktif ${fmt(r.activity.active)}`, '#111827')}
          </tr>
          <tr>
            ${kpi('Ort. Alınan', fmt(n.cals), `${n.days} gün öğün kaydı`, '#111827')}
            ${kpi('Aktivite', fmt(r.activity.active), `${fmt(r.activity.exercise, ' dk')} egzersiz · ${fmt(r.activity.distance, ' km')}`, '#111827')}
          </tr>
        </table>
      </td></tr>

      ${section('Enerji ve Beslenme', 'Günlük ortalamalar ve hedef karşılaştırması',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${progressRow('Kalori', n.cals, g.calories, ' kcal', '#f97316')}
          ${progressRow('Protein', n.prot, g.protein, 'g', '#16a34a')}
          ${progressRow('Karbonhidrat', n.carb, g.carbs, 'g', '#2563eb')}
          ${progressRow('Yağ', n.fat, g.fats, 'g', '#ca8a04')}
          ${kvRow('Hesap yöntemi', 'BMR + aktif kalori - alınan kalori', 'Kalori açığı hedef kaloriye göre hesaplanmaz.', true)}
        </table>`)}

      ${section('Haftanın Özeti', 'En hızlı karar verdiren metrikler',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${kvRow('Enerji durumu', summary.energyStatus)}
          ${kvRow('Öğün kayıt kapsamı', summary.mealCoverage)}
          ${kvRow('En yüksek kalorili gün', summary.highCalorieDay ? `${shortDate(summary.highCalorieDay.date)} · ${NF(Math.round(summary.highCalorieDay.consumed))} kcal` : DASH)}
          ${kvRow('En yüksek açık', summary.biggestDeficit ? `${shortDate(summary.biggestDeficit.date)} · ${NF(Math.abs(summary.biggestDeficit.deficit))} kcal` : DASH)}
          ${kvRow('En düşük açık / fazla', summary.smallestDeficit ? `${shortDate(summary.smallestDeficit.date)} · ${summary.smallestDeficit.deficit >= 0 ? NF(summary.smallestDeficit.deficit) + ' kcal açık' : NF(Math.abs(summary.smallestDeficit.deficit)) + ' kcal fazla'}` : DASH)}
          ${kvRow('Kalori hedefi üstü gün', summary.aboveTargetCalories != null ? `${summary.aboveTargetCalories} gün` : DASH, '', true)}
        </table>`)}

      ${section('Günlük Kırılım', 'Her gün için alınan kalori, gerçek açık, aktivite ve toparlanma', dailyTable(r))}

      ${section('Aktivite ve Antrenman', 'Apple Watch aktivitesi ile antrenman kayıtları birlikte özetlenir',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${kvRow('Antrenman günü', `${NF(r.workout.days)} gün`)}
          ${kvRow('Toplam süre', r.workout.duration ? `${NF(r.workout.duration)} dk` : DASH)}
          ${kvRow('Toplam set', NF(r.workout.sets))}
          ${kvRow('Toplam hacim', `${NF(r.workout.volume)} kg`)}
          ${kvRow('Ort. adım', r.steps ? NF(r.steps) : DASH)}
          ${kvRow('Ort. aktif kalori', r.activity.active ? `${NF(r.activity.active)} kcal` : DASH, '', true)}
        </table>
        <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${regionsInner}</table>`)}

      ${section('Toparlanma ve Vücut', 'Uyku, su ve kilo takibi',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${progressRow('Su', r.water, g.water, ' ml', '#0ea5e9')}
          ${kvRow('Ort. uyku', r.sleep ? `${r.sleep} saat` : DASH)}
          ${kvRow('Ort. uyku skoru', r.sleepScore ? `${NF(r.sleepScore)}/100` : DASH)}
          ${kvRow('Güncel kilo', r.weight.end != null ? `${r.weight.end} kg ${weightTrend}` : DASH, '', true)}
        </table>`)}

      ${section('Değerlendirme', 'Veriye dayalı kısa okuma',
        notes.length
          ? notes.map((t) => `<div style="padding:7px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#374151;">${t}</div>`).join('')
          : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#6b7280;">Bu hafta değerlendirme için yeterli veri yok.</div>`)}

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

const sendEmail = async (to, subject, html) => {
  const info = await transporter.sendMail({ from: REPORT_FROM, to, subject, html });
  return info.messageId;
};

(async () => {
  for (const email of USERS) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      const name = userRecord.displayName || email.split('@')[0];
      const report = await buildReport(userRecord.uid, email);
      const html = renderHtml(name, report);
      const subject = `💪 Haftalık Sağlık Raporun (${report.period})`;
      await sendEmail(email, subject, html);
      console.log(`✅ Rapor gönderildi: ${email}`);
    } catch (err) {
      console.error(`❌ ${email}: ${err.message}`);
    }
  }
  process.exit(0);
})();
