/**
 * Girdi mantık denetimleri - "kaydedilmeden önce bu veri fiziksel olarak mümkün mü?"
 *
 * Buradaki kurallar bilerek TOLERANSLI: etiket yuvarlaması, lif, şeker alkolleri ve
 * organik asitler yüzünden P×4 + C×4 + F×9 hiçbir zaman etiketteki kcal'e tam eşit
 * çıkmaz. Amaç birkaç kcal'lik farkı kovalamak değil, "1 kcal ama 64 g protein"
 * gibi imkânsız kayıtların veri setine girmesini engellemek.
 *
 * level: 'ok' | 'warning' | 'error'
 *   warning -> kaydı engellemez, kullanıcıya "doğrula" der
 *   error   -> kayıt engellenir, veri fiziksel olarak mümkün değil
 */

export const MACRO_KCAL = { protein: 4, carbs: 4, fats: 9 };

export const MEAL_RULES = {
  // 0 kcal (su, sade kahve) serbest; ama 1-2 kcal'lik "öğün" gerçek değildir.
  minCalories: 5,
  // Bu farkın altını hiç sorgulama - etiket yuvarlaması bu bandın içinde kalır.
  ignoreDiffKcal: 20,
  // Kullanıcı kuralı: fark >%10 VEYA >100 kcal ise doğrulama uyarısı.
  warnDiffPercent: 10,
  warnDiffKcal: 100,
  // Bu kadar sapma artık "yuvarlama" değil, yanlış giriştir.
  errorDiffPercent: 50,
  errorDiffKcal: 100
};

export const SLEEP_RULES = {
  // Tek bir günün uykusu 24 saati aşamaz; 649 saat gibi değerler 6.49 yazım hatasıdır.
  maxHours: 24,
  minHours: 0,
  lowWarnHours: 3,
  highWarnHours: 14
};

export const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Makrolardan gelen enerji (kcal). Eksik makrolar 0 sayılır. */
export const macroEnergy = (meal = {}) => {
  const protein = toNumber(meal.protein) || 0;
  const carbs = toNumber(meal.carbs) || 0;
  const fats = toNumber(meal.fats) || 0;
  return protein * MACRO_KCAL.protein + carbs * MACRO_KCAL.carbs + fats * MACRO_KCAL.fats;
};

const ok = (extra = {}) => ({ level: 'ok', code: null, message: null, ...extra });

/**
 * Bir öğünün kalori/makro tutarlılığını denetler.
 * @param {{calories:*, protein:*, carbs:*, fats:*, name?:string}} meal
 * @returns {{level:string, code:string|null, message:string|null, calories:number|null, macroEnergy:number, diff:number, diffPercent:number|null}}
 */
export const validateMealNutrition = (meal = {}) => {
  const calories = toNumber(meal.calories);
  const energy = Math.round(macroEnergy(meal));
  const label = meal.name ? `"${meal.name}"` : 'Bu öğün';
  const base = { calories, macroEnergy: energy, diff: 0, diffPercent: null };

  if (calories === null) {
    return { ...base, level: 'error', code: 'missing-calories', message: 'Kalori değeri girilmeli.' };
  }
  if (calories < 0 || (toNumber(meal.protein) || 0) < 0 || (toNumber(meal.carbs) || 0) < 0 || (toNumber(meal.fats) || 0) < 0) {
    return { ...base, level: 'error', code: 'negative', message: 'Besin değerleri negatif olamaz.' };
  }

  const diff = Math.abs(calories - energy);
  const diffPercent = calories > 0 ? (diff / calories) * 100 : null;
  const stats = { ...base, diff: Math.round(diff), diffPercent: diffPercent === null ? null : Math.round(diffPercent) };

  // 0 kcal + 0 makro = su, sade kahve, baharat. Sorun değil.
  if (calories === 0 && energy === 0) return ok(stats);

  if (calories < MEAL_RULES.minCalories && energy >= MEAL_RULES.ignoreDiffKcal) {
    return {
      ...stats,
      level: 'error',
      code: 'calories-vs-macros',
      message: `${label} ${calories} kcal görünüyor ama makrolardan ${energy} kcal geliyor. Kalori değeri yanlış.`
    };
  }

  if (calories > 0 && calories < MEAL_RULES.minCalories) {
    return {
      ...stats,
      level: 'error',
      code: 'implausible-calories',
      message: `${label} için ${calories} kcal gerçekçi değil. Gerçekten kalorisiz bir şeyse 0 gir, değilse doğru kaloriyi yaz.`
    };
  }

  if (energy === 0) return ok(stats); // sadece kalori girilmiş, makro yok - serbest

  if (diff > MEAL_RULES.errorDiffKcal && diffPercent !== null && diffPercent > MEAL_RULES.errorDiffPercent) {
    return {
      ...stats,
      level: 'error',
      code: 'macro-mismatch',
      message: `${label}: etiket ${calories} kcal, makrolar ${energy} kcal (P×4 + K×4 + Y×9). Bu fark yuvarlamayla açıklanamaz, değerleri düzelt.`
    };
  }

  const exceedsPercent = diff > MEAL_RULES.ignoreDiffKcal && diffPercent !== null && diffPercent > MEAL_RULES.warnDiffPercent;
  const exceedsAbsolute = diff > MEAL_RULES.warnDiffKcal;
  if (exceedsPercent || exceedsAbsolute) {
    return {
      ...stats,
      level: 'warning',
      code: 'macro-mismatch',
      message: `Bu öğünün besin değerlerini doğrula: ${calories} kcal girildi, makrolar ${energy} kcal veriyor (${stats.diff} kcal fark).`
    };
  }

  return ok(stats);
};

/**
 * 649 saat uyku gibi ondalık atlanmış girişleri yakalar ve olası doğru değeri önerir.
 * 649 -> 6.49, 75 -> 7.5
 */
export const suggestSleepHours = (hours) => {
  const value = toNumber(hours);
  if (value === null || value <= SLEEP_RULES.maxHours) return null;
  for (const divisor of [10, 100, 1000]) {
    const candidate = value / divisor;
    if (candidate >= 1 && candidate <= 16) return Math.round(candidate * 100) / 100;
  }
  return null;
};

/**
 * Uyku süresini (saat) denetler.
 * @returns {{level:string, code:string|null, message:string|null, hours:number|null, suggestion:number|null}}
 */
export const validateSleepDuration = (hours) => {
  const value = toNumber(hours);
  const base = { hours: value, suggestion: null };

  if (value === null) {
    return { ...base, level: 'error', code: 'missing', message: 'Uyku süresi girilmeli.' };
  }
  if (value <= SLEEP_RULES.minHours) {
    return { ...base, level: 'error', code: 'non-positive', message: 'Uyku süresi 0 saatten büyük olmalı.' };
  }
  if (value > SLEEP_RULES.maxHours) {
    const suggestion = suggestSleepHours(value);
    return {
      ...base,
      level: 'error',
      code: 'out-of-range',
      suggestion,
      message: `${value} saat uyku olamaz (bir gün en fazla 24 saat).${suggestion ? ` ${suggestion} saat mi demek istedin?` : ''}`
    };
  }
  if (value > SLEEP_RULES.highWarnHours) {
    return { ...base, level: 'warning', code: 'unusually-high', message: `${value} saat uyku alışılmadık derecede uzun, değeri doğrula.` };
  }
  if (value < SLEEP_RULES.lowWarnHours) {
    return { ...base, level: 'warning', code: 'unusually-low', message: `${value} saat uyku alışılmadık derecede kısa, değeri doğrula.` };
  }
  return ok(base);
};

export const isBlocking = (result) => result?.level === 'error';
export const hasIssue = (result) => result?.level === 'warning' || result?.level === 'error';
