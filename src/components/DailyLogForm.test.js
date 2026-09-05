import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../firebase/dataService', () => ({
  getDailyLog: jest.fn(),
  saveDailyLog: jest.fn(() => Promise.resolve({ success: true })),
  getWaterTracker: jest.fn(),
  saveWaterTracker: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../firebase/mealsService', () => ({
  getMeals: jest.fn(),
  addMeals: jest.fn(() => Promise.resolve({ meals: [] })),
  updateMeal: jest.fn(() => Promise.resolve([]))
}));

const { getDailyLog, getWaterTracker } = require('../firebase/dataService');
const { getMeals } = require('../firebase/mealsService');
const { todayKey } = require('../utils/cycleMath');

test('prefills the form with what is already logged for the day', async () => {
  const today = todayKey();
  getDailyLog.mockResolvedValue({
    success: true,
    data: {
      sleep: { duration_hours: 7.5, score: 88, bedtime: '23:10' },
      vitals: { steps: 9500, active_calories: 620 },
      supplements: [{ name: 'Kreatin', dose: '5g' }]
    }
  });
  getWaterTracker.mockResolvedValue({
    success: true,
    data: { entries: [{ date: today, amount: 2200 }], dailyGoal: 3000 }
  });
  getMeals.mockResolvedValue([
    { id: 1, name: 'Yulaf + yumurta', mealType: 'breakfast', mealLabel: '', calories: 520, protein: 32, carbs: 45, fats: 18 },
    { id: 2, name: 'Mercimek çorbası', mealType: 'lunch', mealLabel: '', calories: 300, source: 'AI Analiz' }
  ]);

  const DailyLogForm = require('./DailyLogForm').default;
  render(<DailyLogForm user={{ uid: 'test-uid' }} nutritionResults={null} />);

  // Kahvaltı bölümü kayıtlı öğünle dolu gelir
  expect(await screen.findByDisplayValue('Yulaf + yumurta')).toBeInTheDocument();
  expect(screen.getByDisplayValue('7.5')).toBeInTheDocument();
  expect(screen.getByDisplayValue('2200')).toBeInTheDocument();
  expect(screen.getByDisplayValue('9500')).toBeInTheDocument();
  expect(screen.getByText(/Kreatin \(5g\)/)).toBeInTheDocument();

  // Öğle de ayrı form bölümü olarak dolu gelir
  expect(screen.getByDisplayValue('Mercimek çorbası')).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText('kayıtlı').length).toBeGreaterThan(0));
});

test('shows an empty state when the day has no records', async () => {
  getDailyLog.mockResolvedValue({ success: false });
  getWaterTracker.mockResolvedValue({ success: true, data: { entries: [], dailyGoal: 3000 } });
  getMeals.mockResolvedValue([]);

  const DailyLogForm = require('./DailyLogForm').default;
  render(<DailyLogForm user={{ uid: 'test-uid' }} nutritionResults={null} />);

  expect(await screen.findByText(/Bu güne ait kayıt yok/)).toBeInTheDocument();
});

test('649 saat uyku girişi kaydı engeller ve öneriyi tek tıkla uygular', async () => {
  getDailyLog.mockResolvedValue({ success: false });
  getWaterTracker.mockResolvedValue({ success: true, data: { entries: [], dailyGoal: 3000 } });
  getMeals.mockResolvedValue([]);
  const { saveDailyLog } = require('../firebase/dataService');
  const { fireEvent } = require('@testing-library/react');

  const DailyLogForm = require('./DailyLogForm').default;
  render(<DailyLogForm user={{ uid: 'test-uid' }} nutritionResults={null} />);

  const sleepInput = await screen.findByPlaceholderText('7.5');
  fireEvent.change(sleepInput, { target: { value: '649' } });

  expect(screen.getByRole('alert')).toHaveTextContent(/649 saat uyku olamaz/);

  fireEvent.click(screen.getByText(/Günü Kaydet/));
  await waitFor(() => expect(saveDailyLog).not.toHaveBeenCalled());

  fireEvent.click(screen.getByText('6.49 saat yap'));
  expect(sleepInput).toHaveValue(6.49);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('imkânsız öğün değerleri günü kaydettirmez', async () => {
  getDailyLog.mockResolvedValue({ success: false });
  getWaterTracker.mockResolvedValue({ success: true, data: { entries: [], dailyGoal: 3000 } });
  getMeals.mockResolvedValue([]);
  const { addMeals } = require('../firebase/mealsService');
  const { fireEvent } = require('@testing-library/react');

  const DailyLogForm = require('./DailyLogForm').default;
  render(<DailyLogForm user={{ uid: 'test-uid' }} nutritionResults={null} />);

  const contentInputs = await screen.findAllByPlaceholderText(/3 Tam Yumurta/);
  fireEvent.change(contentInputs[0], { target: { value: 'Mangal' } });

  const calorieInputs = screen.getAllByPlaceholderText('600');
  fireEvent.change(calorieInputs[0], { target: { value: '1' } });

  expect(screen.getByRole('alert')).toHaveTextContent(/gerçekçi değil/);

  fireEvent.click(screen.getByText(/Günü Kaydet/));
  await waitFor(() => expect(addMeals).not.toHaveBeenCalled());
});
