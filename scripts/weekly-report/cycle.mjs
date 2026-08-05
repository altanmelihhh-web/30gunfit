/**
 * Regl döngüsü hesaplarının rapor tarafındaki kopyası.
 *
 * NEDEN KOPYA: kaynak `src/utils/cycleMath.js` (tek doğruluk kaynağı, testleri
 * `src/utils/cycleMath.test.js` içinde). Doğrudan import edilemiyor çünkü kök
 * package.json "type: module" değil - Node o dosyayı CommonJS sanıp `export`ta patlıyor.
 * Buraya SADECE mailin ihtiyaç duyduğu fonksiyonlar alındı. Kaynak dosyadaki
 * eşikler (döngü penceresi, luteal faz, gruplama boşluğu) değişirse burası da güncellenmeli.
 */

const DAY_MS = 86400000;
const LUTEAL_PHASE_DAYS = 14;
const PREDICTION_HISTORY = 12;
const AVERAGE_HISTORY = 6;
const MIN_PLAUSIBLE_CYCLE = 15;
const MAX_PLAUSIBLE_CYCLE = 60;
const MAX_WITHIN_PERIOD_GAP = 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const parseDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shiftKey = (key, days) => {
  const next = parseDateKey(key);
  next.setDate(next.getDate() + days);
  return dateKey(next);
};

export const dayDiff = (fromKey, toKey) =>
  Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / DAY_MS);

export const hasFlow = (flow) => Boolean(flow) && flow !== 'none';

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
};

export const getPeriodGroups = (entries = []) => {
  const flowDates = entries
    .filter((entry) => hasFlow(entry?.flow))
    .map((entry) => entry.date)
    .sort();
  if (!flowDates.length) return [];

  const groups = [];
  let current = { start: flowDates[0], end: flowDates[0], dates: [flowDates[0]] };
  flowDates.slice(1).forEach((date) => {
    if (date === current.end) return;
    if (dayDiff(current.end, date) <= MAX_WITHIN_PERIOD_GAP) {
      current.end = date;
      current.dates.push(date);
    } else {
      groups.push(current);
      current = { start: date, end: date, dates: [date] };
    }
  });
  groups.push(current);
  return groups;
};

export const getCycleStats = (entries = [], settings = {}) => {
  const groups = getPeriodGroups(entries);
  const lengths = groups.slice(1)
    .map((group, index) => dayDiff(groups[index].start, group.start))
    .slice(-PREDICTION_HISTORY)
    .filter((days) => days >= MIN_PLAUSIBLE_CYCLE && days <= MAX_PLAUSIBLE_CYCLE);

  const recent = lengths.slice(-AVERAGE_HISTORY);
  const periodLengths = groups.map((group) => group.dates.length).slice(-AVERAGE_HISTORY);
  const settingsCycle = clamp(parseInt(settings.cycleLength, 10) || 28, 18, 45);
  const settingsPeriod = clamp(parseInt(settings.periodLength, 10) || 5, 1, 10);
  const learnedCycle = recent.length ? median(recent) : null;
  const learnedPeriod = periodLengths.length >= 2 ? median(periodLengths) : null;

  let confidenceDays = null;
  if (lengths.length >= 3) {
    confidenceDays = clamp(Math.ceil((Math.max(...lengths) - Math.min(...lengths)) / 2), 1, 7);
  } else if (lengths.length >= 1) {
    confidenceDays = 4;
  }

  return {
    groups,
    sampleCount: lengths.length,
    cycleLength: learnedCycle || settingsCycle,
    periodLength: learnedPeriod || settingsPeriod,
    confidenceDays,
    source: learnedCycle ? 'learned' : 'settings'
  };
};

const getOvulationCycleDay = (cycleLength) => Math.max(1, cycleLength - LUTEAL_PHASE_DAYS);

export const getPhaseLabel = (cycleDay, cycleLength, periodLength) => {
  if (!cycleDay || cycleDay < 1) return null;
  const ovulationDay = getOvulationCycleDay(cycleLength);
  if (cycleDay <= periodLength) return 'Regl';
  if (Math.abs(cycleDay - ovulationDay) <= 1) return 'Ovülasyon çevresi';
  if (cycleDay < ovulationDay) return 'Foliküler';
  return 'Luteal';
};

export const getPredictions = (entries = [], settings = {}, today) => {
  const stats = getCycleStats(entries, settings);
  if (!stats.groups.length) return null;
  const latestStart = stats.groups[stats.groups.length - 1].start;
  const nextStart = shiftKey(latestStart, stats.cycleLength);
  return {
    ...stats,
    latestStart,
    nextStart,
    nextStartEarly: stats.confidenceDays ? shiftKey(nextStart, -stats.confidenceDays) : nextStart,
    nextStartLate: stats.confidenceDays ? shiftKey(nextStart, stats.confidenceDays) : nextStart,
    cycleDay: dayDiff(latestStart, today) + 1,
    daysUntilNext: dayDiff(today, nextStart)
  };
};

/** Raporun kapsadığı 7 günün kanama/ağrı/semptom özeti. */
export const summarizeWeekEntries = (entries = [], dates = []) => {
  const inWeek = entries.filter((entry) => dates.includes(entry.date));
  const bleedingDays = inWeek.filter((entry) => hasFlow(entry.flow));
  const pains = inWeek.map((entry) => parseInt(entry.pain, 10) || 0).filter((pain) => pain > 0);
  const symptomCounts = new Map();
  inWeek.forEach((entry) => {
    (entry.symptoms || []).forEach((symptom) => {
      symptomCounts.set(symptom, (symptomCounts.get(symptom) || 0) + 1);
    });
  });
  return {
    loggedDays: inWeek.length,
    bleedingDays: bleedingDays.length,
    heavyDays: bleedingDays.filter((entry) => entry.flow === 'heavy').length,
    avgPain: pains.length ? Math.round(pains.reduce((sum, pain) => sum + pain, 0) / pains.length) : null,
    maxPain: pains.length ? Math.max(...pains) : null,
    topSymptoms: [...symptomCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))
  };
};
