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

  // Kalori açığı (hedef − alınan), sadece öğün girilen günler üzerinden
  let totalDeficit = null, avgDeficit = null;
  if (g.calories && cals.length) {
    const defs = cals.map((c) => g.calories - c);
    totalDeficit = Math.round(defs.reduce((s, x) => s + x, 0));
    avgDeficit = Math.round(totalDeficit / cals.length);
  }

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
    workout: { days: workoutDays, sets: totalSets, volume: Math.round(totalVolume), duration: Math.round(totalDuration), regions: regionRows },
    weight: { end: weightEnd, change: weightChange }
  };
};

// ---- e-posta şablonu (tablo-tabanlı, tüm istemcilerde hizalı) ----
const NF = (n) => Number(n || 0).toLocaleString('tr-TR');

// Net etiket → değer satırı (ince ayraçlı). value HTML olabilir.
const row = (label, value, last) => `
  <tr>
    <td style="padding:12px 0;${last ? '' : 'border-bottom:1px solid #eef1f6;'}font-size:14px;color:#475569;">${label}</td>
    <td align="right" style="padding:12px 0;${last ? '' : 'border-bottom:1px solid #eef1f6;'}font-size:15px;color:#0f172a;font-weight:700;white-space:nowrap;">${value}</td>
  </tr>`;

const goalSfx = (g, unit) => (g != null && g !== '' ? ` <span style="color:#94a3b8;font-weight:400;font-size:13px;">/ ${NF(g)}${unit}</span>` : ` <span style="color:#94a3b8;font-weight:400;font-size:13px;">${unit}</span>`);

// Beyaz kart sarmalayıcı
const card = (title, inner) => `
  <tr><td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8ecf3;border-radius:14px;margin-bottom:14px;">
      <tr><td style="padding:16px 18px 2px;font-size:15px;font-weight:800;color:#0f172a;">${title}</td></tr>
      <tr><td style="padding:2px 18px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>
      </td></tr>
    </table>
  </td></tr>`;

// Kas bölgesi barı (email-güvenli: iç içe tablo + bgcolor)
const barRow = (label, sets, max) => {
  const pct = Math.max(8, Math.round((sets / (max || 1)) * 100));
  return `<tr>
    <td width="80" style="padding:7px 8px 7px 0;font-size:13px;color:#334155;">${label}</td>
    <td style="padding:7px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="${pct}%" bgcolor="#6366f1" style="background:#6366f1;height:12px;border-radius:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
        <td bgcolor="#eef1f6" style="background:#eef1f6;height:12px;border-radius:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
      </tr></table>
    </td>
    <td width="36" align="right" style="padding:7px 0 7px 8px;font-size:13px;color:#475569;font-weight:700;">${sets}</td>
  </tr>`;
};

const renderHtml = (name, r) => {
  const g = r.goals || {};
  const n = r.nutrition;

  // Kalori açığı kutusu
  let deficitBox = '';
  if (n.avgDeficit != null) {
    const under = n.avgDeficit >= 0;
    const bg = under ? '#ecfdf5' : '#fef2f2', bd = under ? '#a7f3d0' : '#fecaca';
    const fg = under ? '#047857' : '#b91c1c', fg2 = under ? '#065f46' : '#991b1b';
    deficitBox = `<tr><td colspan="2" style="padding:4px 0 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${bg}" style="background:${bg};border:1px solid ${bd};border-radius:12px;padding:14px 16px;">
          <span style="font-size:22px;font-weight:800;color:${fg};">${under ? '📉' : '📈'} ${NF(Math.abs(n.avgDeficit))} kcal</span>
          <span style="font-size:13px;color:${fg2};"> günlük ort. ${under ? 'açık' : 'fazla'}</span>
          <div style="font-size:12px;color:${fg2};margin-top:4px;">Hafta toplamı: ${NF(Math.abs(n.totalDeficit))} kcal ${under ? 'açık' : 'fazla'} · hedef ${NF(g.calories)} kcal/gün</div>
        </td>
      </tr></table>
    </td></tr>`;
  }

  const nutritionCard = n.days > 0
    ? card('🍎 Beslenme <span style="font-weight:400;color:#94a3b8;font-size:12px;">· günlük ortalama</span>',
        deficitBox +
        row('🔥 Kalori', `${NF(n.cals)}${goalSfx(g.calories, ' kcal')}`) +
        row('🥩 Protein', `${NF(n.prot)}${goalSfx(g.protein, 'g')}`) +
        row('🍞 Karbonhidrat', `${NF(n.carb)}${goalSfx(g.carbs, 'g')}`) +
        row('🥑 Yağ', `${NF(n.fat)}${goalSfx(g.fats, 'g')}`, true) +
        `<tr><td colspan="2" style="padding-top:10px;font-size:12px;color:#94a3b8;">Bu hafta ${n.days} gün öğün kaydı girildi</td></tr>`)
    : card('🍎 Beslenme', `<tr><td style="font-size:13px;color:#94a3b8;padding:4px 0;">Bu hafta öğün kaydı yok.</td></tr>`);

  const regionsInner = r.workout.regions.length
    ? r.workout.regions.map(([label, sets]) => barRow(label, sets, r.workout.regions[0][1])).join('')
    : '';
  const workoutCard = r.workout.days > 0
    ? card('🏋️ Antrenman',
        row('📅 Antrenman günü', `${r.workout.days} gün`) +
        row('🔢 Toplam set', NF(r.workout.sets)) +
        row('🏋️ Toplam hacim', `${NF(r.workout.volume)} kg`) +
        row('⏱️ Toplam süre', r.workout.duration ? `${NF(r.workout.duration)} dk` : '–', true) +
        (regionsInner ? `<tr><td colspan="2" style="padding:14px 0 4px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">Kas bölgesi dağılımı (set)</td></tr>
          <tr><td colspan="2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${regionsInner}</table></td></tr>` : ''))
    : card('🏋️ Antrenman', `<tr><td style="font-size:13px;color:#94a3b8;padding:4px 0;">Bu hafta antrenman kaydı yok.</td></tr>`);

  const vitalsCard = card('💧 Su · 😴 Uyku · 👟 Adım <span style="font-weight:400;color:#94a3b8;font-size:12px;">· günlük ortalama</span>',
    row('💧 Su', `${r.water ? NF(r.water) : '–'}${goalSfx(g.water, ' ml')}`) +
    row('😴 Uyku', r.sleep ? `${r.sleep} saat` : '–') +
    row('⭐ Uyku skoru', r.sleepScore ? `${r.sleepScore}/100` : '–') +
    row('👟 Adım', r.steps ? NF(r.steps) : '–', true));

  const weightCard = card('⚖️ Kilo',
    r.weight.end != null
      ? row('Güncel kilo', `${r.weight.end} kg${r.weight.change ? ` <span style="font-size:13px;font-weight:700;color:${r.weight.change < 0 ? '#16a34a' : '#dc2626'};">${r.weight.change < 0 ? '↓' : '↑'} ${Math.abs(r.weight.change)} kg</span>` : ''}`, true)
      : `<tr><td style="font-size:13px;color:#94a3b8;padding:4px 0;">Bu hafta kilo kaydı yok.</td></tr>`);

  // Kısa değerlendirme
  const ins = [];
  if (n.avgDeficit != null) {
    const pct = g.calories ? Math.round((Math.abs(n.avgDeficit) / g.calories) * 100) : null;
    ins.push(n.avgDeficit >= 0
      ? `Günlük ortalama <b>${NF(Math.abs(n.avgDeficit))} kcal açık</b> verdin${pct != null ? ` (hedefinin ~%${pct} altı)` : ''} — kilo verme yönünde iyi.`
      : `Günlük ortalama <b>${NF(Math.abs(n.avgDeficit))} kcal fazla</b> aldın${pct != null ? ` (hedefinin ~%${pct} üstü)` : ''}.`);
  }
  if (g.protein && n.days > 0) {
    ins.push(n.prot >= g.protein
      ? `Protein hedefini tutturuyorsun (ort. ${NF(n.prot)}g).`
      : `Protein hedefinin altındasın: ort. ${NF(n.prot)}g / ${NF(g.protein)}g — kas için biraz artır.`);
  }
  if (r.workout.days > 0) {
    ins.push(`Bu hafta <b>${r.workout.days} gün</b> antrenman, ${NF(r.workout.sets)} set, ${NF(r.workout.volume)} kg hacim.`);
    if (r.workout.regions.length) ins.push(`En çok <b>${r.workout.regions[0][0]}</b> çalıştın; en az çalışılan bölgeye de ağırlık verebilirsin.`);
  } else {
    ins.push('Bu hafta hiç antrenman kaydı yok — haftaya en az 3 seans hedefle.');
  }
  if (r.sleep) ins.push(parseFloat(r.sleep) >= 7 ? `Uyku ortalaman iyi (${r.sleep} saat).` : `Uyku ortalaman ${r.sleep} saat — 7+ saati hedefle.`);
  if (r.steps) ins.push(`Ortalama ${NF(r.steps)} adım/gün.`);
  const insightsCard = ins.length
    ? card('🧭 Kısa değerlendirme',
        `<tr><td>${ins.map((t) => `<div style="padding:6px 0;font-size:13px;color:#334155;line-height:1.5;">• ${t}</div>`).join('')}</td></tr>`)
    : '';

  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Haftalık Sağlık Raporu</title>
</head>
<body style="margin:0;padding:0;background:#eef1f7;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Bu haftaki beslenme, antrenman, uyku ve kilo özetin — ${r.period}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#f7f8fb;border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

      <tr><td bgcolor="#4f46e5" style="background:#4f46e5;background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 24px;">
        <div style="font-size:12px;color:#e0e7ff;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Haftalık Sağlık Raporu</div>
        <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:6px;">💪 ${name}</div>
        <div style="font-size:13px;color:#e0e7ff;margin-top:6px;">${r.period}</div>
      </td></tr>

      <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

      ${nutritionCard}
      ${workoutCard}
      ${vitalsCard}
      ${weightCard}
      ${insightsCard}

      <tr><td style="padding:8px 24px 28px;text-align:center;">
        <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
          <b style="color:#64748b;">30 Gün Fit</b><br>
          Track Everything · Understand Everything · Improve Every Day<br>
          <a href="https://gunfit-c0243.web.app" style="color:#6366f1;text-decoration:none;">Uygulamayı aç →</a>
        </div>
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
