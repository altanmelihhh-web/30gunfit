/**
 * Haftalık checklist anahtarları için tek kaynak.
 *
 * Eskiden hafta başı anahtarı `new Date(...).toISOString().slice(0, 10)` ile
 * üretiliyordu. UTC+3'te yerel gece yarısı ISO'da bir önceki güne düştüğü için
 * WorkoutLog "Pazar" anahtarı yazıyor, rapor tarafı "Pazartesi" anahtarını
 * arıyordu; checklist raporda hep 0/N görünüyordu. Burada tüm tarih işlemleri
 * yerel takvim bileşenleriyle yapılır, ISO kaymasına yer yoktur.
 */

export const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** "YYYY-MM-DD" metnini yerel takvim tarihi olarak çözer (UTC kayması yok). */
export const parseDateKey = (dateStr) => {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

/** Verilen günün içinde bulunduğu haftanın Pazartesi'si. */
export const getWeekStart = (baseDate = new Date()) => {
  const start = baseDate instanceof Date ? new Date(baseDate) : parseDateKey(baseDate);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
};

export const weekStartKeyFor = (dateStr) => toDateKey(getWeekStart(parseDateKey(dateStr)));

/**
 * Eski (ISO kaymalı) yazımlarla uyumluluk: UTC+ saat diliminde yazılan
 * anahtarlar Pazartesi yerine bir önceki güne düşmüştü. Okurken her iki
 * varyantı da kabul ediyoruz.
 */
export const weekKeyVariants = (weekStartKey) => {
  const monday = parseDateKey(weekStartKey);
  const shifted = new Date(monday);
  shifted.setDate(shifted.getDate() - 1);
  return [weekStartKey, toDateKey(shifted)];
};

/** Bir plan maddesi verilen hafta için işaretli mi (eski anahtarlar dahil). */
export const isWeekChecked = (checks, weekStartKey, itemId) =>
  weekKeyVariants(weekStartKey).some((key) => !!(checks || {})[`${key}:${itemId}`]);
