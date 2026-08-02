import { getDailyCalories, saveDailyCalories, getCalorieTrackingRange } from './dataService';

/**
 * Bir günün öğünlerini eklemek/düzenlemek/silmek için TEK ortak yer.
 * Önceki mimaride CalorieTracker, AIDailyLog ve ManualQuickEntry aynı işi
 * (id/timestamp üretme + Firestore'a yazma) kendi kopyalarıyla yapıyordu; biri
 * elindeki BAYAT listeyi olduğu gibi geri yazınca diğerinin az önce eklediği
 * veriyi sessizce siliyordu. Burada her mutasyon önce Firestore'dan GÜNCEL
 * listeyi okuyup üzerine ekliyor/çıkarıyor - asla "elimdeki state neyse onu bas" yapmıyor.
 */

const LOCAL_KEY = 'calorie_tracker';

const genId = () => Date.now() + Math.random();

const normalizeMeal = (mealData) => ({
  id: mealData.id ?? genId(),
  timestamp: mealData.timestamp ?? new Date().toISOString(),
  name: mealData.name || mealData.food_name || 'Öğün',
  calories: parseFloat(mealData.calories) || 0,
  protein: parseFloat(mealData.protein) || 0,
  carbs: parseFloat(mealData.carbs) || 0,
  fats: parseFloat(mealData.fats) || 0,
  portion: mealData.portion || mealData.portion_size || '',
  mealType: mealData.mealType || mealData.meal_type || 'snack',
  mealLabel: mealData.mealLabel || mealData.meal_label || '',
  source: mealData.source || null
});

const readLocalMeals = (date) => {
  const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  return all[date] || [];
};

const writeLocalMeals = (date, meals) => {
  const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  all[date] = meals;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
};

/**
 * O günün GÜNCEL öğün listesini döndürür - giriş yapılmışsa her zaman
 * Firestore'dan okur (localStorage sadece offline yedek olarak güncellenir).
 */
export const getMeals = async (userId, date) => {
  if (userId) {
    const result = await getDailyCalories(userId, date);
    const meals = result.success ? (result.data.meals || []) : [];
    writeLocalMeals(date, meals);
    return meals;
  }
  return readLocalMeals(date);
};

const persist = async (userId, date, meals) => {
  writeLocalMeals(date, meals);
  if (userId) {
    await saveDailyCalories(userId, date, meals);
  }
};

export const addMeal = async (userId, date, mealData) => {
  const newMeal = normalizeMeal(mealData);
  const currentMeals = await getMeals(userId, date);
  const updatedMeals = [...currentMeals, newMeal];
  await persist(userId, date, updatedMeals);
  return { meal: newMeal, meals: updatedMeals };
};

/** Birden fazla öğünü tek seferde ekler (AI Günlük Giriş / Hızlı Giriş için) */
export const addMeals = async (userId, date, mealDataList) => {
  const newMeals = mealDataList.map(normalizeMeal);
  const currentMeals = await getMeals(userId, date);
  const updatedMeals = [...currentMeals, ...newMeals];
  await persist(userId, date, updatedMeals);
  return { meals: updatedMeals, added: newMeals };
};

export const updateMeal = async (userId, date, mealId, changes) => {
  const currentMeals = await getMeals(userId, date);
  const updatedMeals = currentMeals.map((m) =>
    m.id === mealId ? normalizeMeal({ ...m, ...changes, id: m.id }) : m
  );
  await persist(userId, date, updatedMeals);
  return updatedMeals;
};

export const deleteMeal = async (userId, date, mealId) => {
  const currentMeals = await getMeals(userId, date);
  const updatedMeals = currentMeals.filter((m) => m.id !== mealId);
  await persist(userId, date, updatedMeals);
  return updatedMeals;
};

/** Kaydetmeden önce mükerrer-kayıt uyarısı için o tarihte zaten ne var, göster */
export const getMealsSummary = async (userId, date) => {
  const meals = await getMeals(userId, date);
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  return { count: meals.length, totalCalories: Math.round(totalCalories), meals };
};

/**
 * Son N günde eklenen öğünleri isme göre tekilleştirip "sık yenenler" listesi döndürür.
 * Her öğünün en güncel besin değerlerini ve kaç kez yendiğini tutar; önce sıklık,
 * sonra güncellik sırasına göre döner. Hızlı-tekrar çipleri için kullanılır.
 */
export const getRecentMeals = async (userId, days = 30, limit = 20) => {
  if (!userId) {
    // Giriş yoksa localStorage'daki tüm günlerden derle
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    const flat = Object.values(all).flat();
    return dedupeMeals(flat, limit);
  }

  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const range = await getCalorieTrackingRange(userId, dates);
  const flat = Object.values(range).flatMap((day) => day.meals || []);
  return dedupeMeals(flat, limit);
};

const dedupeMeals = (meals, limit) => {
  const map = new Map();
  meals.forEach((m) => {
    if (!m.name) return;
    const key = m.name.trim().toLocaleLowerCase('tr');
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      // en güncel değerleri koru (timestamp daha yeniyse güncelle)
      if ((m.timestamp || '') > (existing.timestamp || '')) {
        Object.assign(existing, {
          calories: m.calories, protein: m.protein, carbs: m.carbs, fats: m.fats,
          mealType: m.mealType, mealLabel: m.mealLabel, timestamp: m.timestamp
        });
      }
    } else {
      map.set(key, {
        name: m.name.trim(),
        calories: m.calories || 0, protein: m.protein || 0, carbs: m.carbs || 0, fats: m.fats || 0,
        mealType: m.mealType || 'snack', mealLabel: m.mealLabel || '',
        timestamp: m.timestamp || '', count: 1
      });
    }
  });
  return [...map.values()]
    .sort((a, b) => (b.count - a.count) || ((b.timestamp || '') > (a.timestamp || '') ? 1 : -1))
    .slice(0, limit);
};
