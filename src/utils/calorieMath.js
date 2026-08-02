/**
 * Kalori matematiği - tüm ekranlarda TEK ve tutarlı kalori açığı hesabı.
 *
 * Gerçek kalori açığı = (BMR + aktif kalori) - alınan kalori
 *   BMR  : Mifflin-St Jeor (profil: kilo/boy/yaş/cinsiyet)
 *   aktif: Apple Watch aktif kalori (o günün vitals.active_calories)
 *   alınan: o günün öğünlerinden toplam kalori
 *
 * Pozitif açık = kilo verme yönünde (yaktığından az yedin).
 */

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const inRange = (value, min, max) => value != null && value >= min && value <= max;

export const getBMRProfileIssue = (profile) => {
  if (!profile) return 'Profil bulunamadı.';
  const weight = toNumber(profile.weight);
  const height = toNumber(profile.height);
  const age = toNumber(profile.age);
  if (!inRange(weight, 30, 300)) return 'Kilo 30-300 kg aralığında olmalı.';
  if (!inRange(height, 100, 250)) return 'Boy 100-250 cm aralığında olmalı.';
  if (!inRange(age, 13, 100)) return 'Yaş 13-100 aralığında olmalı.';
  if (!profile.gender) return 'Cinsiyet seçili olmalı.';
  return null;
};

// Mifflin-St Jeor BMR (dinlenme metabolizması, kcal/gün). Eksik veri → null.
export const computeBMR = (profile) => {
  if (!profile) return null;
  if (getBMRProfileIssue(profile)) return null;
  const weight = toNumber(profile.weight);
  const height = toNumber(profile.height);
  const age = toNumber(profile.age);
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(profile.gender === 'female' ? base - 161 : base + 5);
};

// O günün toplam yaktığı kalori (BMR + aktif). BMR yoksa null.
export const dayBurned = (bmr, activeCalories = 0) =>
  bmr == null ? null : Math.round(bmr + (toNumber(activeCalories) || 0));

// O günün gerçek açığı: yaktığın − aldığın. BMR yoksa veya öğün yoksa null.
export const dayDeficit = (bmr, activeCalories, consumed) => {
  const c = toNumber(consumed);
  if (bmr == null || !c) return null;
  return Math.round((bmr + (toNumber(activeCalories) || 0)) - c);
};

// Bir dizi gün için ortalama gerçek açık (sadece öğün girilen günler).
// days: [{ consumed, activeCalories }]
export const avgDeficit = (bmr, days) => {
  if (bmr == null) return null;
  const withMeals = days.filter((d) => d.consumed > 0);
  if (!withMeals.length) return null;
  const total = withMeals.reduce(
    (s, d) => s + ((bmr + (toNumber(d.activeCalories) || 0)) - d.consumed),
    0
  );
  return Math.round(total / withMeals.length);
};
