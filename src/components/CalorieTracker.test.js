import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../firebase/mealsService', () => ({
  getMeals: jest.fn(),
  addMeal: jest.fn(),
  updateMeal: jest.fn(),
  deleteMeal: jest.fn(),
  getRecentMeals: jest.fn(),
  addMealFromTemplate: jest.fn()
}));

jest.mock('./MealTemplates', () => () => null);

const { getMeals, getRecentMeals, updateMeal } = require('../firebase/mealsService');

test('edit button opens the form inline and saves through updateMeal', async () => {
  // CRA jest ayarı resetMocks:true olduğu için implementasyonlar test içinde verilir.
  getMeals.mockResolvedValue([
    { id: 7, name: 'Yulaf', mealType: 'breakfast', mealLabel: '', calories: 400, protein: 20, carbs: 50, fats: 10 }
  ]);
  getRecentMeals.mockResolvedValue([]);
  updateMeal.mockResolvedValue([]);

  const CalorieTracker = require('./CalorieTracker').default;
  const targetMacros = { protein: { grams: 150 }, carbs: { grams: 200 }, fats: { grams: 70 } };
  render(<CalorieTracker user={{ uid: 'test-uid' }} targetCalories={2000} targetMacros={targetMacros} />);

  const editButton = await screen.findByTitle('Düzenle');
  // Form ancak düzenlemeye basınca açılır
  expect(screen.queryByText(/Yemeği Düzenle/)).not.toBeInTheDocument();

  fireEvent.click(editButton);
  expect(screen.getByText(/Yemeği Düzenle/)).toBeInTheDocument();

  fireEvent.change(screen.getByDisplayValue('Yulaf'), { target: { value: 'Yulaf + muz' } });
  fireEvent.click(screen.getByText(/Güncelle/));

  await waitFor(() => expect(updateMeal).toHaveBeenCalled());
  const [, , mealId, changes] = updateMeal.mock.calls[0];
  expect(mealId).toBe(7);
  expect(changes.name).toBe('Yulaf + muz');
});

test('1 kcal ama yüksek makrolu giriş kaydedilemez', async () => {
  getMeals.mockResolvedValue([]);
  getRecentMeals.mockResolvedValue([]);
  const { addMeal } = require('../firebase/mealsService');

  const CalorieTracker = require('./CalorieTracker').default;
  const macros = { protein: { grams: 150 }, carbs: { grams: 200 }, fats: { grams: 70 } };
  render(<CalorieTracker user={{ uid: 'test-uid' }} targetCalories={2000} targetMacros={macros} />);

  // Accordion kapalıyken içeriği aria-hidden; önce paneli aç.
  fireEvent.click(await screen.findByRole('button', { name: /Tek öğünü manuel kalori ve makro ile gir/ }));
  fireEvent.click(screen.getByText('➕ Yemek Ekle'));

  fireEvent.change(screen.getByPlaceholderText(/Tavuk Göğsü Izgara/), { target: { value: 'Mangal' } });
  fireEvent.change(screen.getByPlaceholderText('250'), { target: { value: '1' } });
  fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '64' } });
  fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '70' } });

  expect(screen.getByRole('alert')).toHaveTextContent(/Kalori değeri yanlış/);
  expect(screen.getByText(/💾 Kaydet/)).toBeDisabled();

  fireEvent.click(screen.getByText(/💾 Kaydet/));
  await waitFor(() => expect(addMeal).not.toHaveBeenCalled());
});

test('etiket yuvarlaması kadar fark uyarı üretmez', async () => {
  getMeals.mockResolvedValue([]);
  getRecentMeals.mockResolvedValue([]);

  const CalorieTracker = require('./CalorieTracker').default;
  const macros = { protein: { grams: 150 }, carbs: { grams: 200 }, fats: { grams: 70 } };
  render(<CalorieTracker user={{ uid: 'test-uid' }} targetCalories={2000} targetMacros={macros} />);

  // Accordion kapalıyken içeriği aria-hidden; önce paneli aç.
  fireEvent.click(await screen.findByRole('button', { name: /Tek öğünü manuel kalori ve makro ile gir/ }));
  fireEvent.click(screen.getByText('➕ Yemek Ekle'));
  fireEvent.change(screen.getByPlaceholderText(/Tavuk Göğsü Izgara/), { target: { value: 'Yoğurt' } });
  fireEvent.change(screen.getByPlaceholderText('250'), { target: { value: '250' } });
  fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '30' } });
  fireEvent.change(screen.getByPlaceholderText('40'), { target: { value: '20' } });
  fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '5' } });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/💾 Kaydet/)).not.toBeDisabled();
});
