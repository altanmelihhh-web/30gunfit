/**
 * Kalori matematiği - tüm ekranlarda TEK ve tutarlı kalori açığı hesabı.
 *
 * Gerçek kalori açığı = (BMR + aktif kalori) − alınan kalori
 *   BMR  : Mifflin-St Jeor (profil: kilo/boy/yaş/cinsiyet)
 *   aktif: Apple Watch aktif kalori (o günün vitals.active_calories)
 *   alınan: o günün öğünlerinden toplam kalori
 *
 * Pozitif açık = kilo verme yönünde (yaktığından az yedin).
 */

// Mifflin-St Jeor BMR (dinlenme metabolizması, kcal/gün). Eksik veri → null.
export const computeBMR = (profile) => {
  if (!profile) return null;
  const weight = parseFloat(profile.weight);
  const height = parseFloat(profile.height);
  const age = parseFloat(profile.age);
  if (!weight || !height || !age) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(profile.gender === 'female' ? base - 161 : base + 5);
};

// O günün toplam yaktığı kalori (BMR + aktif). BMR yoksa null.
export const dayBurned = (bmr, activeCalories = 0) =>
  bmr == null ? null : Math.round(bmr + (parseFloat(activeCalories) || 0));

// O günün gerçek açığı: yaktığın − aldığın. BMR yoksa veya öğün yoksa null.
export const dayDeficit = (bmr, activeCalories, consumed) => {
  if (bmr == null || !consumed) return null;
  return Math.round((bmr + (parseFloat(activeCalories) || 0)) - consumed);
};

// Bir dizi gün için ortalama gerçek açık (sadece öğün girilen günler).
// days: [{ consumed, activeCalories }]
export const avgDeficit = (bmr, days) => {
  if (bmr == null) return null;
  const withMeals = days.filter((d) => d.consumed > 0);
  if (!withMeals.length) return null;
  const total = withMeals.reduce(
    (s, d) => s + ((bmr + (parseFloat(d.activeCalories) || 0)) - d.consumed),
    0
  );
  return Math.round(total / withMeals.length);
};
