import { averageMicronutrients, sumMicronutrients } from './micronutrients';

test('sums micronutrients only from meals that include micro data', () => {
  const totals = sumMicronutrients([
    { name: 'OFF yogurt', micronutrients: { fiber: 1.2, sugars: 5, sodium: 0.08, saturatedFat: 1.4 } },
    { name: 'Manual meal', calories: 400 },
    { name: 'OFF bar', micronutrients: { fiber: 6, sugars: 2.5, sodium: 0.2, saturatedFat: 2 } }
  ]);

  expect(totals).toMatchObject({
    fiber: 7.2,
    sugars: 7.5,
    sodium: 0.28,
    saturatedFat: 3.4,
    sourceMealCount: 2
  });
});

test('averages micronutrients across days that have micronutrient data', () => {
  const avg = averageMicronutrients([
    { micros: { fiber: 10, sugars: 12, sodium: 1, saturatedFat: 4, sourceMealCount: 2 } },
    { micros: { fiber: 0, sugars: 0, sodium: 0, saturatedFat: 0, sourceMealCount: 0 } },
    { micros: { fiber: 20, sugars: 8, sodium: 0.5, saturatedFat: 2, sourceMealCount: 1 } }
  ]);

  expect(avg).toMatchObject({
    fiber: 15,
    sugars: 10,
    sodium: 0.75,
    saturatedFat: 3,
    loggedDays: 2
  });
});
