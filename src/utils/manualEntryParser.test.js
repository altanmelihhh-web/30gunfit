import { parseManualEntryBatch } from './manualEntryParser';

test('parses meal, water, sleep and workout quick entries', () => {
  const { items, errors } = parseManualEntryBatch([
    'yemek: tavuk göğsü 300kcal 40p 5c 10f',
    'su: 500',
    'uyku: 7 saat 30 dakika skor 90',
    'antrenman: bench press: 20x12, 25x10'
  ].join('\n'));

  expect(errors).toEqual([]);
  expect(items).toHaveLength(4);
  expect(items[0]).toMatchObject({
    category: 'meal',
    data: { food_name: 'tavuk göğsü', calories: 300, protein: 40, carbs: 5, fats: 10 }
  });
  expect(items[1]).toMatchObject({ category: 'water', data: { water_ml: 500 } });
  expect(items[2]).toMatchObject({ category: 'sleep', data: { sleep: { duration_hours: 7.5, score: 90 } } });
  expect(items[3].data.exercises[0].sets).toEqual([
    { weight_kg: 20, reps: 12 },
    { weight_kg: 25, reps: 10 }
  ]);
});

test('returns line errors for unknown entries without dropping valid lines', () => {
  const { items, errors } = parseManualEntryBatch('su: 250\nbilinmeyen: test');

  expect(items).toHaveLength(1);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({ line: 2, raw: 'bilinmeyen: test' });
});
