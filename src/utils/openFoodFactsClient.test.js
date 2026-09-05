import { normalizeOpenFoodFactsProduct } from './openFoodFactsClient';

test('normalizes Open Food Facts product and scales nutrition to grams', () => {
  const product = normalizeOpenFoodFactsProduct({
    code: '1234567890123',
    product_name: 'Greek Yogurt',
    brands: 'Test Brand',
    serving_quantity: '150',
    serving_size: '150 g',
    nutriments: {
      'energy-kcal_100g': 80,
      proteins_100g: 10,
      carbohydrates_100g: 4,
      fat_100g: 2,
      fiber_100g: 0,
      sugars_100g: 3.5,
      sodium_100g: 0.05,
      'saturated-fat_100g': 1.2
    }
  });

  expect(product.defaultGrams).toBe(150);
  expect(product.toMeal(150, 'breakfast')).toMatchObject({
    name: 'Greek Yogurt - Test Brand',
    calories: 120,
    protein: 15,
    carbs: 6,
    fats: 3,
    portion: '150 g',
    mealType: 'breakfast',
    source: 'Open Food Facts',
    micronutrients: {
      sugars: 5.3,
      sodium: 0.075,
      saturatedFat: 1.8
    }
  });
});
