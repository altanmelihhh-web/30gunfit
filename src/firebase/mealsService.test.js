import { addMealFromTemplate, deleteMealTemplate, getMealTemplates, saveMealTemplate } from './mealsService';

jest.mock('./dataService', () => {
  let meals = {};
  return {
    getDailyCalories: jest.fn((userId, date) => Promise.resolve({
      success: Boolean(meals[date]),
      data: { meals: meals[date] || [] }
    })),
    saveDailyCalories: jest.fn((userId, date, nextMeals) => {
      meals[date] = nextMeals;
      return Promise.resolve({ success: true });
    }),
    getCalorieTrackingRange: jest.fn(() => Promise.resolve({})),
    __resetMeals: () => { meals = {}; }
  };
});

jest.mock('./config', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, collection, id) => ({ collection, id })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: jest.fn(() => Promise.resolve())
}));

beforeEach(() => {
  localStorage.clear();
  require('./dataService').__resetMeals();
});

test('saves, reads and deletes local meal templates', async () => {
  const saved = await saveMealTemplate(null, {
    name: 'Protein Bowl',
    calories: '450',
    protein: '35',
    carbs: '40',
    fats: '12',
    mealType: 'lunch'
  });

  expect(saved.template).toMatchObject({
    name: 'Protein Bowl',
    calories: 450,
    protein: 35,
    carbs: 40,
    fats: 12,
    mealType: 'lunch'
  });

  expect(await getMealTemplates(null)).toHaveLength(1);
  expect(await deleteMealTemplate(null, saved.template.id)).toEqual([]);
});

test('adds a meal from template without reusing template id', async () => {
  const template = {
    id: 'template-1',
    name: 'Oats',
    calories: 300,
    protein: 12,
    carbs: 45,
    fats: 8,
    mealType: 'breakfast'
  };

  const result = await addMealFromTemplate(null, '2026-08-03', template);

  expect(result.meal).toMatchObject({
    name: 'Oats',
    calories: 300,
    source: 'Öğün Şablonu'
  });
  expect(result.meal.id).not.toBe('template-1');
});
