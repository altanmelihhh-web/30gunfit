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

const buildReport = async (uid) => {
  const dates = lastNDates(7);

  const [calDocs, logDocs, waterDoc, weightDoc, goalsDoc] = await Promise.all([
    Promise.all(dates.map((d) => getDoc(`calorieTracking/${uid}_${d}`))),
    Promise.all(dates.map((d) => getDoc(`dailyLogs/${uid}_${d}`))),
    getDoc(`waterTracking/${uid}`),
    getDoc(`weightTracking/${uid}`),
    getDoc(`nutritionGoals/${uid}`)
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
  const sleepVals = [], sleepScores = [], stepVals = [], workouts = [];
  let workoutDays = 0, totalDuration = 0;
  logDocs.forEach((log) => {
    if (log?.sleep?.duration_hours) sleepVals.push(log.sleep.duration_hours);
    if (log?.sleep?.score) sleepScores.push(log.sleep.score);
    if (log?.vitals?.steps) stepVals.push(log.vitals.steps);
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

  return {
    period: `${dates[0]} – ${dates[dates.length - 1]}`,
    nutrition: { cals: avg(cals), prot: avg(prot), carb: avg(carb), fat: avg(fat), days: cals.length },
    goals: g,
    water: avg(waterVals),
    sleep: sleepVals.length ? (sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length).toFixed(1) : null,
    sleepScore: avg(sleepScores),
    steps: avg(stepVals),
    workout: { days: workoutDays, sets: totalSets, volume: Math.round(totalVolume), duration: Math.round(totalDuration), regions: regionRows },
    weight: { end: weightEnd, change: weightChange }
  };
};

const cell = (label, value) =>
  `<td style="padding:10px 12px;background:#f4f6fb;border-radius:10px;text-align:center;">
     <div style="font-size:18px;font-weight:700;color:#0f172a;">${value}</div>
     <div style="font-size:11px;color:#64748b;">${label}</div>
   </td>`;

const renderHtml = (name, r) => {
  const goalTxt = (v, g) => (g ? `${v} / ${g}` : `${v}`);
  const regionBars = r.workout.regions.length
    ? r.workout.regions.map(([label, sets]) => {
        const max = r.workout.regions[0][1] || 1;
        return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
          <span style="width:70px;font-size:13px;color:#0f172a;">${label}</span>
          <div style="flex:1;height:10px;background:#eef2ff;border-radius:6px;overflow:hidden;">
            <div style="height:100%;width:${(sets / max) * 100}%;background:linear-gradient(135deg,#6366f1,#8b5cf6);"></div>
          </div>
          <span style="width:26px;text-align:right;font-size:13px;color:#475569;">${sets}</span>
        </div>`;
      }).join('')
    : '<p style="color:#64748b;font-size:13px;">Bu hafta antrenman kaydı yok.</p>';

  return `<!doctype html><html><body style="margin:0;background:#eef1f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:24px;border-radius:16px;margin-bottom:16px;">
      <h1 style="margin:0;font-size:22px;">💪 Haftalık Sağlık Raporun</h1>
      <p style="margin:6px 0 0;opacity:.9;">${name} · ${r.period}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:14px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">🍎 Beslenme (günlük ort.)</h2>
      ${r.nutrition.days > 0
        ? `<table width="100%" cellspacing="8"><tr>
             ${cell('kcal', goalTxt(r.nutrition.cals, r.goals.calories))}
             ${cell('protein', goalTxt(r.nutrition.prot + 'g', r.goals.protein && r.goals.protein + 'g'))}
             ${cell('karb.', goalTxt(r.nutrition.carb + 'g', r.goals.carbs && r.goals.carbs + 'g'))}
             ${cell('yağ', goalTxt(r.nutrition.fat + 'g', r.goals.fats && r.goals.fats + 'g'))}
           </tr></table>
           <p style="color:#64748b;font-size:12px;margin:10px 0 0;">${r.nutrition.days} gün kayıt girildi</p>`
        : '<p style="color:#64748b;font-size:13px;">Bu hafta öğün kaydı yok.</p>'}
    </div>

    <div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:14px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">🏋️ Antrenman</h2>
      <table width="100%" cellspacing="8"><tr>
        ${cell('gün', r.workout.days)}
        ${cell('set', r.workout.sets)}
        ${cell('kg hacim', r.workout.volume)}
        ${cell('dk', r.workout.duration || '–')}
      </tr></table>
      <div style="margin-top:14px;">${regionBars}</div>
    </div>

    <div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:14px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">💧 Su · 😴 Uyku · 👟 Adım (ort.)</h2>
      <table width="100%" cellspacing="8"><tr>
        ${cell('ml su', goalTxt(r.water || '–', r.goals.water))}
        ${cell('sa uyku', r.sleep || '–')}
        ${cell('uyku skoru', r.sleepScore || '–')}
        ${cell('adım', r.steps || '–')}
      </tr></table>
    </div>

    <div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:14px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">⚖️ Kilo</h2>
      ${r.weight.end != null
        ? `<div style="font-size:24px;font-weight:700;color:#0f172a;">${r.weight.end} kg
             ${r.weight.change ? `<span style="font-size:14px;color:${r.weight.change < 0 ? '#16a34a' : '#dc2626'};">${r.weight.change < 0 ? '↓' : '↑'} ${Math.abs(r.weight.change)} kg</span>` : ''}
           </div>`
        : '<p style="color:#64748b;font-size:13px;">Bu hafta kilo kaydı yok.</p>'}
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">
      30 Gün Fit · Track Everything. Understand Everything. Improve Every Day.
    </p>
  </div></body></html>`;
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
      const report = await buildReport(userRecord.uid);
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
