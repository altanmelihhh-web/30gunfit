import {
  buildCalendarMeta,
  dateKey,
  dayDiff,
  getAlerts,
  getCycleHistory,
  getCycleNotification,
  getCycleStats,
  getOvulationCycleDay,
  getPeriodGroups,
  getPhaseInfo,
  getPredictions,
  shiftKey
} from './cycleMath';

// Verilen başlangıç tarihlerinden `length` günlük kanama kayıtları üretir.
const buildEntries = (starts, length = 5) =>
  starts.flatMap((start) =>
    Array.from({ length }, (_, index) => ({
      date: shiftKey(start, index),
      flow: index === 0 ? 'medium' : 'light',
      pain: 0,
      symptoms: []
    }))
  );

test('date keys follow local time, not UTC (gece yarısı sonrası gün kayması)', () => {
  // UTC+3'te bu an ISO tarihinde bir gün geride görünürdü.
  expect(dateKey(new Date(2026, 7, 3, 1, 30))).toBe('2026-08-03');
  expect(dateKey(new Date(2026, 7, 3, 23, 59))).toBe('2026-08-03');
  expect(dayDiff('2026-02-27', '2026-03-02')).toBe(3);
  expect(shiftKey('2026-01-31', 30)).toBe('2026-03-02');
});

test('groups consecutive bleeding days and splits on gaps', () => {
  const entries = [
    { date: '2026-01-01', flow: 'medium' },
    { date: '2026-01-02', flow: 'light' },
    { date: '2026-01-04', flow: 'spotting' }, // 1 günlük boşluk -> aynı dönem
    { date: '2026-01-20', flow: 'none' }, // kanama yok -> sayılmaz
    { date: '2026-01-31', flow: 'medium' }
  ];
  const groups = getPeriodGroups(entries);

  expect(groups).toHaveLength(2);
  expect(groups[0]).toMatchObject({ start: '2026-01-01', end: '2026-01-04' });
  expect(groups[0].dates).toHaveLength(3);
  expect(groups[1].start).toBe('2026-01-31');
});

test('learns cycle length from history instead of using the fixed setting', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-31', '2026-03-02']);
  const stats = getCycleStats(entries, { cycleLength: 28, periodLength: 5 });

  expect(stats.cycleLengths).toEqual([30, 30]);
  expect(stats.cycleLength).toBe(30);
  expect(stats.source).toBe('learned');

  const predictions = getPredictions(entries, { cycleLength: 28, periodLength: 5 }, { today: '2026-03-10' });
  expect(predictions.nextStart).toBe('2026-04-01'); // 28 günlük ayar kullanılsaydı 2026-03-30 olurdu
  expect(predictions.cycleDay).toBe(9);
  expect(predictions.daysUntilNext).toBe(22);
});

test('falls back to settings when there is no completed cycle yet', () => {
  const entries = buildEntries(['2026-01-01']);
  const predictions = getPredictions(entries, { cycleLength: 26, periodLength: 4 }, { today: '2026-01-03' });

  expect(predictions.source).toBe('settings');
  expect(predictions.confidenceDays).toBeNull();
  expect(predictions.nextStart).toBe('2026-01-27');
  expect(predictions.nextStartEarly).toBe(predictions.nextStart);
});

test('ignores implausible cycle gaps caused by mis-entered dates', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-29', '2026-08-01']);
  const stats = getCycleStats(entries, { cycleLength: 28, periodLength: 5 });

  expect(stats.cycleLengths).toEqual([28]); // 184 günlük boşluk elenir
  expect(stats.cycleLength).toBe(28);
});

test('confidence window widens with irregular cycles', () => {
  const stable = getCycleStats(buildEntries(['2026-01-01', '2026-01-29']), {});
  expect(stable.confidenceDays).toBe(4); // tek döngü -> temkinli varsayılan

  const irregular = getCycleStats(
    buildEntries(['2026-01-01', '2026-01-29', '2026-02-28', '2026-04-03']),
    {}
  );
  expect(irregular.cycleLengths).toEqual([28, 30, 34]);
  expect(irregular.confidenceDays).toBe(3); // (34-28)/2
});

test('ovulation date and phase label use the same cycle day', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-29']); // 28 günlük döngü
  const predictions = getPredictions(entries, {}, { today: '2026-02-05' });
  const current = predictions.cycles[0];

  const ovulationCycleDay = dayDiff(current.start, current.ovulation) + 1;
  expect(ovulationCycleDay).toBe(getOvulationCycleDay(predictions.cycleLength));
  expect(getPhaseInfo(ovulationCycleDay, predictions.cycleLength, predictions.periodLength).key)
    .toBe('ovulation');
  expect(getPhaseInfo(3, 28, 5).key).toBe('menstrual');
  expect(getPhaseInfo(8, 28, 5).key).toBe('follicular');
  expect(getPhaseInfo(22, 28, 5).key).toBe('luteal');
});

test('calendar meta marks logged, predicted, fertile and ovulation days', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-29']);
  const predictions = getPredictions(entries, {}, { today: '2026-02-05' });
  const meta = buildCalendarMeta(entries, predictions, { today: '2026-02-05' });

  expect(meta.get('2026-01-29')).toMatchObject({ bleeding: true, logged: true });
  expect(meta.get('2026-02-26')).toMatchObject({ predictedPeriod: true }); // sonraki döngü
  expect(meta.get(predictions.cycles[1].ovulation)).toMatchObject({ ovulation: true, fertile: true });
  // Tamamlanmış mevcut döngünün kanama günleri tahmin olarak tekrar boyanmaz.
  expect(meta.get('2026-01-30').predictedPeriod).toBeUndefined();
});

test('cycle history lists newest first with lengths and pain', () => {
  const entries = [
    { date: '2026-01-01', flow: 'medium', pain: 6 },
    { date: '2026-01-02', flow: 'heavy', pain: 8 },
    { date: '2026-01-29', flow: 'medium', pain: 2 }
  ];
  const history = getCycleHistory(entries);

  expect(history[0]).toMatchObject({ start: '2026-01-29', cycleLength: null, periodDays: 1 });
  expect(history[1]).toMatchObject({ start: '2026-01-01', cycleLength: 28, periodDays: 2, heavyDays: 1, maxPain: 8 });
});

test('flags a delay once the prediction window has passed', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-29']);
  const predictions = getPredictions(entries, {}, { today: '2026-03-10' });

  expect(getAlerts(entries, predictions, { today: '2026-02-27' })).not.toEqual(
    expect.arrayContaining([expect.stringContaining('gecikme')])
  );
  expect(getAlerts(entries, predictions, { today: '2026-03-10' })).toEqual(
    expect.arrayContaining([expect.stringContaining('gecikme')])
  );
});

test('notification fires before the predicted start and after a delay', () => {
  const entries = buildEntries(['2026-01-01', '2026-01-29']);
  const predictions = getPredictions(entries, {}, { today: '2026-02-20' });

  expect(getCycleNotification(predictions, { today: '2026-02-20' })).toBeNull();
  expect(getCycleNotification(predictions, { today: '2026-02-24' })).toMatchObject({ kind: 'upcoming', daysUntil: 2 });
  expect(getCycleNotification(predictions, { today: '2026-02-26' })).toMatchObject({ kind: 'upcoming', daysUntil: 0 });
  expect(getCycleNotification(predictions, { today: '2026-03-01' })).toMatchObject({ kind: 'overdue' });
});
