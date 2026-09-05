import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../utils/openFoodFactsClient', () => ({
  findProducts: jest.fn()
}));

const { findProducts } = require('../utils/openFoodFactsClient');

const makeProduct = (name, meal) => ({
  code: '123',
  name,
  brand: '',
  quantity: '',
  imageUrl: '',
  defaultGrams: 100,
  nutrition: {
    caloriesPer100g: meal.calories,
    proteinPer100g: meal.protein,
    carbsPer100g: meal.carbs,
    fatsPer100g: meal.fats
  },
  toMeal: () => ({ ...meal, name, portion: '100 g', mealType: 'snack', source: 'Open Food Facts' })
});

const searchAndSelect = async (product) => {
  findProducts.mockResolvedValue([product]);
  const OpenFoodFactsSearch = require('./OpenFoodFactsSearch').default;
  const onAddProduct = jest.fn();
  render(<OpenFoodFactsSearch onAddProduct={onAddProduct} disabled={false} />);

  fireEvent.change(screen.getByPlaceholderText(/Ürün adı|barkod/i), { target: { value: 'test' } });
  fireEvent.click(screen.getByText(/^Ara$/));
  fireEvent.click(await screen.findByText(product.name));
  return onAddProduct;
};

test('tutarsız OFF etiketi öğüne eklenemez', async () => {
  // 1 kcal ama 64g protein + 70g yağ -> fiziksel olarak imkânsız
  const onAddProduct = await searchAndSelect(
    makeProduct('Bozuk Kayıt', { calories: 1, protein: 64, carbs: 0, fats: 70 })
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(/Kalori değeri yanlış/);
  const addButton = screen.getByText('Öğüne Ekle');
  expect(addButton).toBeDisabled();

  fireEvent.click(addButton);
  await waitFor(() => expect(onAddProduct).not.toHaveBeenCalled());
});

test('tutarlı OFF etiketi sorunsuz eklenir', async () => {
  const onAddProduct = await searchAndSelect(
    makeProduct('Yulaf Ezmesi', { calories: 380, protein: 13, carbs: 60, fats: 7 })
  );

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Öğüne Ekle'));
  await waitFor(() => expect(onAddProduct).toHaveBeenCalled());
});
