import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../utils/geminiClient', () => ({
  callGeminiForJSON: jest.fn(),
  fileToBase64Image: jest.fn()
}));

const { callGeminiForJSON } = require('../utils/geminiClient');

const analyzeText = async (aiResult) => {
  callGeminiForJSON.mockResolvedValue(aiResult);
  const FoodPhotoAnalyzer = require('./FoodPhotoAnalyzer').default;
  const onFoodAnalyzed = jest.fn(() => Promise.resolve());
  render(<FoodPhotoAnalyzer onFoodAnalyzed={onFoodAnalyzed} />);

  fireEvent.click(screen.getByText('Malzeme Yazarak'));
  fireEvent.change(screen.getByPlaceholderText(/300 gram tavuk/), { target: { value: 'mangal' } });
  fireEvent.click(screen.getByText(/Kalori Hesapla/));
  await screen.findByText(/Analiz Tamamlandı/);
  return onFoodAnalyzed;
};

test('AI imkânsız değer döndürürse güne eklenemez', async () => {
  const onFoodAnalyzed = await analyzeText({
    food_name: 'Mangal',
    description: 'Izgara',
    calories: 1,
    protein: 64,
    carbs: 0,
    fats: 70,
    portion_size: '1 porsiyon',
    confidence: 'high'
  });

  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent(/Kalori değeri yanlış/);
  expect(alert).toHaveTextContent(/güne eklenemez/);

  const addButton = screen.getByText('Bugünüme Ekle');
  expect(addButton).toBeDisabled();
  fireEvent.click(addButton);
  await waitFor(() => expect(onFoodAnalyzed).not.toHaveBeenCalled());
});

test('AI tutarsız ama mümkün değer döndürürse uyarır, eklemeye izin verir', async () => {
  // 500 kcal etiket, 435 kcal makro
  const onFoodAnalyzed = await analyzeText({
    food_name: 'Pilav',
    description: 'Tereyağlı',
    calories: 500,
    protein: 30,
    carbs: 45,
    fats: 15,
    portion_size: '1 kase',
    confidence: 'medium'
  });

  expect(screen.getByRole('alert')).toHaveTextContent(/besin değerlerini doğrula/);
  const addButton = screen.getByText('Bugünüme Ekle');
  expect(addButton).not.toBeDisabled();

  fireEvent.click(addButton);
  await waitFor(() => expect(onFoodAnalyzed).toHaveBeenCalled());
});

test('tutarlı AI sonucu hiç uyarı göstermez', async () => {
  await analyzeText({
    food_name: 'Tavuk Salata',
    description: 'Izgara tavuk',
    calories: 415,
    protein: 40,
    carbs: 20,
    fats: 17,
    portion_size: '1 tabak',
    confidence: 'high'
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Bugünüme Ekle')).not.toBeDisabled();
});
