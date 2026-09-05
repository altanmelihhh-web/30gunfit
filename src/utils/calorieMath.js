/**
 * Kalori matematiği - tüm ekranlarda TEK ve tutarlı kalori açığı hesabı.
 *
 * Gerçek kalori açığı = BMR + aktif enerji - alınan kalori
 *   BMR  : Mifflin-St Jeor (profil + varsa en güncel kilo takibi)
 *   aktif: uygulamadaki vitals.active_calories
 *   alınan: o günün öğünlerinden toplam kalori
 *
 * TEF veya ekstra metabolizma katsayısı eklenmez.
 * Pozitif açık = kilo verme yönünde (yaktığından az yedin).
 */

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const inRange = (value, min, max) => value != null && value >= min && value <= max;

export const getActiveEnergy = (vitals = {}, fallback = 0) =>
  toNumber(vitals?.active_calories) ?? (toNumber(fallback) || 0);

export const getBasalEnergy = (vitals = {}) =>
  toNumber(vitals?.basal_energy) ??
  toNumber(vitals?.basalEnergyBurned) ??
  toNumber(vitals?.basal_energy_burned) ??
  toNumber(vitals?.resting_energy) ??
  toNumber(vitals?.restingEnergyBurned);

export const profileWithLatestWeight = (profile, weightEntries = []) => {
  if (!profile || !Array.isArray(weightEntries) || weightEntries.length === 0) return profile;
  const latest = [...weightEntries]
    .filter((entry) => inRange(toNumber(entry.weight), 30, 300))
    .sort((a, b) => new Date(b.date || b.timestamp || 0) - new Date(a.date || a.timestamp || 0))[0];
  return latest ? { ...profile, weight: toNumber(latest.weight) } : profile;
};

export const getBMRProfileIssue = (profile) => {
  if (!profile) return 'Profil bulunamadı.';
  const weight = toNumber(profile.weight);
  const height = toNumber(profile.height);
  const age = toNumber(profile.age);
  if (!inRange(weight, 30, 300)) return 'Kilo 30-300 kg aralığında olmalı.';
  if (!inRange(height, 100, 250)) return 'Boy 100-250 cm aralığında olmalı.';
  if (!inRange(age, 13, 100)) return 'Yaş 13-100 aralığında olmalı.';
  if (!['male', 'female'].includes(profile.gender)) return 'Cinsiyet erkek veya kadın olarak seçilmeli.';
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

export const elapsedDayRatio = (now = new Date()) => {
  const minutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() / 60);
  return Math.max(0, Math.min(1, minutes / 1440));
};

export const energyBalance = ({ bmr, vitals = {}, consumed = 0, workoutActiveCalories = 0, mode = 'full-day', now = new Date() }) => {
  const basalEnergy = getBasalEnergy(vitals);
  const activeEnergy = getActiveEnergy(vitals, workoutActiveCalories);
  const consumedCalories = toNumber(consumed) || 0;
  const ratio = mode === 'live' ? elapsedDayRatio(now) : 1;
  const restingEnergy = basalEnergy ?? (bmr == null ? null : bmr * ratio);
  const restingSource = basalEnergy != null ? 'basal-energy' : mode === 'live' ? 'prorated-bmr' : 'estimated-bmr';

  if (restingEnergy == null || !consumedCalories) {
    return {
      bmr,
      restingEnergy: restingEnergy == null ? null : Math.round(restingEnergy),
      restingSource: restingEnergy == null ? 'missing' : restingSource,
      activeEnergy: Math.round(activeEnergy),
      totalExpenditure: restingEnergy == null ? null : Math.round(restingEnergy + activeEnergy),
      deficit: null
    };
  }
  const totalExpenditure = restingEnergy + activeEnergy;
  return {
    bmr,
    restingEnergy: Math.round(restingEnergy),
    restingSource,
    activeEnergy: Math.round(activeEnergy),
    totalExpenditure: Math.round(totalExpenditure),
    deficit: Math.round(totalExpenditure - consumedCalories)
  };
};

export const dayBurned = (bmr, activeCalories = 0, vitals = {}) =>
  energyBalance({ bmr, vitals, workoutActiveCalories: activeCalories }).totalExpenditure;

// O günün gerçek açığı: yaktığın − aldığın. BMR yoksa veya öğün yoksa null.
export const dayDeficit = (bmr, activeCalories, consumed, vitals = {}) =>
  energyBalance({ bmr, vitals, consumed, workoutActiveCalories: activeCalories }).deficit;

// Bir dizi gün için ortalama gerçek açık (sadece öğün girilen günler).
// days: [{ consumed, activeCalories, vitals }]
export const avgDeficit = (bmr, days) => {
  if (bmr == null) return null;
  const withMeals = days.filter((d) => d.consumed > 0);
  if (!withMeals.length) return null;
  const total = withMeals.reduce(
    (s, d) => s + (dayDeficit(bmr, d.activeCalories, d.consumed, d.vitals) || 0),
    0
  );
  return Math.round(total / withMeals.length);
};
