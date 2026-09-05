import { getWeekStart, isWeekChecked, toDateKey, weekKeyVariants, weekStartKeyFor } from './weekKeys';

describe('weekKeys', () => {
  test('hafta başı her zaman Pazartesi', () => {
    expect(weekStartKeyFor('2026-08-05')).toBe('2026-08-03'); // Çarşamba
    expect(weekStartKeyFor('2026-08-03')).toBe('2026-08-03'); // Pazartesi
    expect(weekStartKeyFor('2026-08-09')).toBe('2026-08-03'); // Pazar
  });

  test('yerel gece yarısı ISO kayması yaşamaz', () => {
    // UTC+3'te toISOString() bir önceki güne düşerdi; toDateKey düşmemeli.
    const localMonday = new Date(2026, 7, 3, 0, 0, 0, 0);
    expect(toDateKey(localMonday)).toBe('2026-08-03');
    expect(toDateKey(getWeekStart(new Date(2026, 7, 5, 23, 30)))).toBe('2026-08-03');
  });

  test('eski kaymalı anahtar da işaretli sayılır', () => {
    const legacyChecks = { '2026-08-02:melih-walk-tue': true };
    expect(isWeekChecked(legacyChecks, '2026-08-03', 'melih-walk-tue')).toBe(true);
    expect(isWeekChecked(legacyChecks, '2026-08-10', 'melih-walk-tue')).toBe(false);
    expect(weekKeyVariants('2026-08-03')).toEqual(['2026-08-03', '2026-08-02']);
  });

  test('yeni anahtar okunur', () => {
    expect(isWeekChecked({ '2026-08-03:x': true }, '2026-08-03', 'x')).toBe(true);
    expect(isWeekChecked({}, '2026-08-03', 'x')).toBe(false);
  });
});
