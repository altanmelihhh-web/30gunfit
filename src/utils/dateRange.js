import { dayDiff, shiftKey } from './cycleMath';

export const RANGE_DAYS = { day: 1, week: 7, month: 30 };
export const RANGE_LABELS = { day: 'Gün', week: 'Hafta', month: 'Ay', custom: 'Özel' };

// Özel aralıkta tek seferde çekilen gün sayısı sınırı (her gün = 2 Firestore okuması)
export const MAX_CUSTOM_DAYS = 92;

/**
 * Trend ekranının çalışacağı tarih listesini (eskiden yeniye) üretir.
 * Özel aralıkta her iki uç da dahildir; ters girilen tarihler düzeltilir.
 */
export const getDateList = (anchorDate, rangeKey, customRange) => {
  if (rangeKey === 'custom') {
    if (!customRange?.start || !customRange?.end) return [anchorDate];
    const [from, to] = customRange.start <= customRange.end
      ? [customRange.start, customRange.end]
      : [customRange.end, customRange.start];
    const span = Math.min(dayDiff(from, to), MAX_CUSTOM_DAYS - 1);
    return Array.from({ length: span + 1 }, (_, index) => shiftKey(from, index));
  }
  const days = RANGE_DAYS[rangeKey] || 1;
  return Array.from({ length: days }, (_, index) => shiftKey(anchorDate, index - (days - 1)));
};

export const isCustomRangeTooLong = (customRange) =>
  Boolean(customRange?.start && customRange?.end &&
    Math.abs(dayDiff(customRange.start, customRange.end)) + 1 > MAX_CUSTOM_DAYS);
