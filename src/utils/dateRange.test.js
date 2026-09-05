import { MAX_CUSTOM_DAYS, getDateList, isCustomRangeTooLong } from './dateRange';

test('builds fixed ranges ending on the anchor date', () => {
  expect(getDateList('2026-03-10', 'day')).toEqual(['2026-03-10']);

  const week = getDateList('2026-03-10', 'week');
  expect(week).toHaveLength(7);
  expect(week[0]).toBe('2026-03-04');
  expect(week[6]).toBe('2026-03-10');

  expect(getDateList('2026-03-10', 'month')).toHaveLength(30);
});

test('custom range includes both ends and handles reversed input', () => {
  const range = getDateList('2026-03-10', 'custom', { start: '2026-02-26', end: '2026-03-02' });
  expect(range).toEqual(['2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);

  const reversed = getDateList('2026-03-10', 'custom', { start: '2026-03-02', end: '2026-02-26' });
  expect(reversed).toEqual(range);

  expect(getDateList('2026-03-10', 'custom', { start: '2026-03-10', end: '2026-03-10' })).toEqual(['2026-03-10']);
});

test('custom range is capped and flagged when too long', () => {
  const long = { start: '2026-01-01', end: '2026-12-31' };
  expect(getDateList('2026-03-10', 'custom', long)).toHaveLength(MAX_CUSTOM_DAYS);
  expect(isCustomRangeTooLong(long)).toBe(true);
  expect(isCustomRangeTooLong({ start: '2026-03-01', end: '2026-03-10' })).toBe(false);
});
