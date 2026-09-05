import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../utils/geminiClient', () => ({
  callGeminiForJSON: jest.fn(),
  fileToBase64Image: jest.fn()
}));

jest.mock('../firebase/dataService', () => ({
  getWaterTracker: jest.fn(),
  saveWaterTracker: jest.fn(),
  saveDailyLog: jest.fn(),
  getDailyLog: jest.fn()
}));

jest.mock('../firebase/mealsService', () => ({
  addMeals: jest.fn(),
  getMealsSummary: jest.fn()
}));

jest.mock('./GeminiQuotaBadge', () => () => null);

const { callGeminiForJSON } = require('../utils/geminiClient');
const { addMeals, getMealsSummary } = require('../firebase/mealsService');
const { saveDailyLog, getDailyLog } = require('../firebase/dataService');

const analyze = async (draft) => {
  callGeminiForJSON.mockResolvedValue(draft);
  getMealsSummary.mockResolvedValue({ count: 0, totalCalories: 0 });
  getDailyLog.mockResolvedValue({ success: true, data: {} });
  addMeals.mockResolvedValue({ meals: [] });
  saveDailyLog.mockResolvedValue({ success: true });

  const AIDailyLog = require('./AIDailyLog').default;
  render(<AIDailyLog user={{ uid: 'test-uid' }} />);

  fireEvent.change(screen.getByPlaceholderText(/Sabah D vitamini/), { target: { value: 'bugün ne yedim' } });
  fireEvent.click(screen.getByText(/Analiz Et/));
  await screen.findByText(/Kontrol Et ve Onayla/);
};

test('AI taslağındaki imkânsız öğün kaydı durdurur ve sebebini yazar', async () => {
  await analyze({
    meals: [{ food_name: 'Mangal', meal_type: 'dinner', calories: 1, protein: 64, carbs: 0, fats: 70 }]
  });

  expect(screen.getByText(/Kalori değeri yanlış/)).toBeInTheDocument();

  fireEvent.click(screen.getByText(/Onayla ve Kaydet/));
  expect(await screen.findByText(/Kaydedilemez/)).toBeInTheDocument();
  expect(addMeals).not.toHaveBeenCalled();
});

test('AI taslağındaki 649 saat uyku kaydı durdurur', async () => {
  await analyze({ sleep: { duration_hours: 649 } });

  expect(screen.getByText(/649 saat uyku olamaz/)).toBeInTheDocument();

  fireEvent.click(screen.getByText(/Onayla ve Kaydet/));
  expect(await screen.findByText(/Kaydedilemez/)).toBeInTheDocument();
  expect(saveDailyLog).not.toHaveBeenCalled();
});

test('hatalı satır silinince kayıt tekrar mümkün olur', async () => {
  await analyze({
    meals: [
      { food_name: 'Mangal', meal_type: 'dinner', calories: 1, protein: 64, carbs: 0, fats: 70 },
      { food_name: 'Yulaf', meal_type: 'breakfast', calories: 400, protein: 20, carbs: 50, fats: 10 }
    ]
  });

  expect(screen.getByText(/Kalori değeri yanlış/)).toBeInTheDocument();

  // Hatalı öğünü sil
  fireEvent.click(screen.getAllByText('🗑️')[0]);
  expect(screen.queryByText(/Kalori değeri yanlış/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByText(/Onayla ve Kaydet/));
  await waitFor(() => expect(addMeals).toHaveBeenCalled());
  expect(addMeals.mock.calls[0][2]).toHaveLength(1);
  expect(addMeals.mock.calls[0][2][0].name).toBe('Yulaf');
});

test('tutarlı taslak uyarısız kaydedilir', async () => {
  await analyze({
    meals: [{ food_name: 'Yulaf', meal_type: 'breakfast', calories: 400, protein: 20, carbs: 50, fats: 10 }],
    sleep: { duration_hours: 7.5 }
  });

  expect(screen.queryByText(/besin değerlerini doğrula/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Kalori değeri yanlış/)).not.toBeInTheDocument();
  expect(screen.queryByText(/uyku olamaz/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByText(/Onayla ve Kaydet/));
  await waitFor(() => expect(addMeals).toHaveBeenCalled());
});
