// Regl döngüsü hesaplamaları.
// Tüm tarihler yerel saate göre "YYYY-MM-DD" anahtarı olarak taşınır.
// UTC (toISOString) kullanılmaz: TR'de gece 00:00-03:00 arasında bir gün geriye kayardı.

export const DAY_MS = 86400000;

// Ovülasyon, döngü uzunluğundan luteal faz çıkarılarak bulunur (klasik 14 gün kabulü).
export const LUTEAL_PHASE_DAYS = 14;

// Clue yaklaşımı: tahmin son 12 döngüden, ortalamalar son 6 döngüden.
export const PREDICTION_HISTORY = 12;
export const AVERAGE_HISTORY = 6;

// Kayıt hatalarını (ör. yanlışlıkla 6 ay öncesine işaretlenen gün) tahminden dışla.
const MIN_PLAUSIBLE_CYCLE = 15;
const MAX_PLAUSIBLE_CYCLE = 60;

// Aynı regl dönemi içinde 1 günün kaydedilmemesi normaldir; bu yeni dönem sayılmaz.
const MAX_WITHIN_PERIOD_GAP = 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const todayKey = () => dateKey(new Date());

export const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const shiftKey = (key, days) => dateKey(addDays(parseDateKey(key), days));

// Yaz saati geçişlerinde gün farkı 23/25 saat olabilir; yuvarlama bunu düzeltir.
export const dayDiff = (fromKey, toKey) =>
  Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / DAY_MS);

export const getMonthKey = (key) => key.slice(0, 7);

export const formatDateKey = (key, options = { day: 'numeric', month: 'long', weekday: 'short' }) =>
  parseDateKey(key).toLocaleDateString('tr-TR', options);

export const formatShortDateKey = (key) =>
  parseDateKey(key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export const hasFlow = (flow) => Boolean(flow) && flow !== 'none';

export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
};

export const average = (values) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

// Ardışık (en fazla 1 gün boşluklu) kanama günlerini tek bir regl dönemi olarak grupla.
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

export const getCycleLengths = (groups) =>
  groups.slice(1).map((group, index) => dayDiff(groups[index].start, group.start));

export const getCycleStats = (entries = [], settings = {}) => {
  const groups = getPeriodGroups(entries);
  const allCycleLengths = getCycleLengths(groups);
  const plausible = allCycleLengths
    .slice(-PREDICTION_HISTORY)
    .filter((days) => days >= MIN_PLAUSIBLE_CYCLE && days <= MAX_PLAUSIBLE_CYCLE);

  const recentCycles = plausible.slice(-AVERAGE_HISTORY);
  const periodLengths = groups.map((group) => group.dates.length).slice(-AVERAGE_HISTORY);

  const settingsCycle = clamp(parseInt(settings.cycleLength, 10) || 28, 18, 45);
  const settingsPeriod = clamp(parseInt(settings.periodLength, 10) || 5, 1, 10);

  const learnedCycleLength = recentCycles.length ? median(recentCycles) : null;
  const learnedPeriodLength = periodLengths.length >= 2 ? median(periodLengths) : null;

  let confidenceDays = null;
  if (plausible.length >= 3) {
    const spread = Math.max(...plausible) - Math.min(...plausible);
    confidenceDays = clamp(Math.ceil(spread / 2), 1, 7);
  } else if (plausible.length >= 1) {
    confidenceDays = 4;
  }

  return {
    groups,
    cycleLengths: plausible,
    sampleCount: plausible.length,
    avgCycleLength: learnedCycleLength,
    avgPeriodLength: average(periodLengths),
    cycleLength: learnedCycleLength || settingsCycle,
    periodLength: learnedPeriodLength || settingsPeriod,
    confidenceDays,
    source: learnedCycleLength ? 'learned' : 'settings'
  };
};

// Ovülasyon döngü günü: 28 günlük döngüde 14. gün.
export const getOvulationCycleDay = (cycleLength) => Math.max(1, cycleLength - LUTEAL_PHASE_DAYS);

const buildCycle = (start, cycleLength, periodLength) => {
  const ovulation = shiftKey(start, getOvulationCycleDay(cycleLength) - 1);
  return {
    start,
    end: shiftKey(start, Math.max(0, periodLength - 1)),
    ovulation,
    fertileStart: shiftKey(ovulation, -5),
    fertileEnd: shiftKey(ovulation, 1)
  };
};

export const getPredictions = (entries = [], settings = {}, options = {}) => {
  const { cycleCount = 4, today = todayKey() } = options;
  const stats = getCycleStats(entries, settings);
  if (!stats.groups.length) return null;

  const latestStart = stats.groups[stats.groups.length - 1].start;
  const { cycleLength, periodLength, confidenceDays } = stats;

  const cycles = Array.from({ length: cycleCount }, (_, index) =>
    buildCycle(shiftKey(latestStart, cycleLength * index), cycleLength, periodLength)
  );

  const next = cycles[1];
  // Verimli dönem/ovülasyon için henüz geçmemiş ilk döngüyü göster.
  const upcoming = cycles.find((cycle) => dayDiff(today, cycle.ovulation) >= 0) || cycles[0];

  return {
    ...stats,
    latestStart,
    cycles,
    nextStart: next.start,
    nextEnd: next.end,
    nextStartEarly: confidenceDays ? shiftKey(next.start, -confidenceDays) : next.start,
    nextStartLate: confidenceDays ? shiftKey(next.start, confidenceDays) : next.start,
    ovulation: upcoming.ovulation,
    fertileStart: upcoming.fertileStart,
    fertileEnd: upcoming.fertileEnd,
    cycleDay: dayDiff(latestStart, today) + 1,
    daysUntilNext: dayDiff(today, next.start)
  };
};

export const getPhaseInfo = (cycleDay, cycleLength, periodLength) => {
  if (!cycleDay || cycleDay < 1) return { key: 'unknown', label: '-', note: 'Yeterli kayıt yok.' };
  const ovulationDay = getOvulationCycleDay(cycleLength);
  if (cycleDay <= periodLength) {
    return { key: 'menstrual', label: 'Regl', note: 'Kanama günleri ve ağrı/akış takibi öncelikli.' };
  }
  if (Math.abs(cycleDay - ovulationDay) <= 1) {
    return { key: 'ovulation', label: 'Ovülasyon çevresi', note: 'Tahmini verimli dönem civarı.' };
  }
  if (cycleDay < ovulationDay) {
    return { key: 'follicular', label: 'Foliküler', note: 'Regl sonrası dönem; enerji ve semptom değişimleri izlenebilir.' };
  }
  return { key: 'luteal', label: 'Luteal', note: 'PMS, iştah, uyku ve ruh hali değişimleri daha belirgin olabilir.' };
};

const markRange = (map, fromKey, toKey, flag) => {
  const total = dayDiff(fromKey, toKey);
  for (let index = 0; index <= total; index += 1) {
    const key = shiftKey(fromKey, index);
    const current = map.get(key) || {};
    map.set(key, { ...current, [flag]: true });
  }
};

// Takvim boyaması: gerçek kayıt + tahmini regl + verimli dönem + ovülasyon.
export const buildCalendarMeta = (entries = [], predictions, options = {}) => {
  const { today = todayKey() } = options;
  const meta = new Map();

  if (predictions) {
    predictions.cycles.forEach((cycle, index) => {
      markRange(meta, cycle.fertileStart, cycle.fertileEnd, 'fertile');
      const ovulationMeta = meta.get(cycle.ovulation) || {};
      meta.set(cycle.ovulation, { ...ovulationMeta, ovulation: true });
      // Mevcut döngünün geçmiş günleri gerçek kayıtla temsil edilir; tahmin ileriye bakar.
      if (index === 0 && dayDiff(today, cycle.end) < 0) return;
      markRange(meta, cycle.start, cycle.end, 'predictedPeriod');
    });
  }

  entries.forEach((entry) => {
    if (!entry?.date) return;
    const current = meta.get(entry.date) || {};
    meta.set(entry.date, {
      ...current,
      entry,
      flow: entry.flow,
      logged: true,
      bleeding: hasFlow(entry.flow)
    });
  });

  return meta;
};

export const getCalendarDays = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1; // hafta Pazartesi başlar
  const start = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: dateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1
    };
  });
};

// Geçmiş döngülerin listesi: uzunluk, kanama süresi, ortalama ağrı.
export const getCycleHistory = (entries = []) => {
  const groups = getPeriodGroups(entries);
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));

  return groups
    .map((group, index) => {
      const nextGroup = groups[index + 1];
      const pains = group.dates
        .map((date) => parseInt(byDate.get(date)?.pain, 10) || 0)
        .filter((pain) => pain > 0);
      return {
        start: group.start,
        end: group.end,
        periodDays: group.dates.length,
        cycleLength: nextGroup ? dayDiff(group.start, nextGroup.start) : null,
        maxPain: pains.length ? Math.max(...pains) : null,
        avgPain: average(pains),
        heavyDays: group.dates.filter((date) => byDate.get(date)?.flow === 'heavy').length
      };
    })
    .reverse();
};

export const getAlerts = (entries = [], predictions, options = {}) => {
  const { today = todayKey() } = options;
  const alerts = [];
  if (!predictions) return alerts;

  const cycleLengths = getCycleLengths(predictions.groups);
  if (cycleLengths.some((days) => days < 21 || days > 35)) {
    alerts.push('Kayıtlarda 21-35 gün dışına çıkan döngü var.');
  }
  if (predictions.groups.some((group) => group.dates.length > 7)) {
    alerts.push('Kayıtlarda 7 günden uzun kanama dönemi var.');
  }

  const heavyDays = entries.filter((entry) => entry.flow === 'heavy').length;
  if (heavyDays >= 2) alerts.push(`${heavyDays} yoğun kanama günü işaretlenmiş.`);

  const highPainDays = entries.filter((entry) => (parseInt(entry.pain, 10) || 0) >= 8).length;
  if (highPainDays >= 1) alerts.push(`${highPainDays} gün ağrı 8/10 veya üzeri kaydedilmiş.`);

  const overdue = -dayDiff(today, predictions.nextStart);
  const tolerance = predictions.confidenceDays || 3;
  if (overdue > tolerance) {
    alerts.push(`Tahmini tarihe göre ${overdue} gün gecikme var.`);
  }

  return alerts;
};

// Bildirim kararı: "yaklaşıyor" veya "gecikti". Günde bir kez tetiklenmesi çağıran tarafın sorumluluğu.
export const getCycleNotification = (predictions, options = {}) => {
  const { today = todayKey(), notifyBeforeDays = 2, overdueAfterDays = 3 } = options;
  if (!predictions) return null;

  const daysUntil = dayDiff(today, predictions.nextStart);
  if (daysUntil >= 0 && daysUntil <= notifyBeforeDays) {
    return {
      kind: 'upcoming',
      daysUntil,
      title: '🌙 Regl yaklaşıyor',
      body: daysUntil === 0
        ? 'Bugün regl bekleniyor. Takvimden işaretlemeyi unutma.'
        : `${daysUntil} gün içinde regl bekleniyor.`
    };
  }
  if (-daysUntil >= overdueAfterDays) {
    return {
      kind: 'overdue',
      daysUntil,
      title: '🌙 Regl gecikmesi',
      body: `Tahmini tarihten ${-daysUntil} gün geçti. Kaydın güncel değilse takvimi güncelle.`
    };
  }
  return null;
};
