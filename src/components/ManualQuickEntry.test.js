import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../firebase/dataService', () => ({
  getWaterTracker: jest.fn(),
  saveWaterTracker: jest.fn(),
  getWeightTracker: jest.fn(),
  saveWeightTracker: jest.fn(),
  getDailyLog: jest.fn(),
  saveDailyLog: jest.fn()
}));

jest.mock('../firebase/mealsService', () => ({
  addMeals: jest.fn(),
  getMealsSummary: jest.fn()
}));

const { addMeals, getMealsSummary } = require('../firebase/mealsService');

const typeAndParse = (text) => {
  const ManualQuickEntry = require('./ManualQuickEntry').default;
  render(<ManualQuickEntry user={{ uid: 'test-uid', email: 'a@b.c' }} />);
  fireEvent.change(screen.getByPlaceholderText(/su: 500/), { target: { value: text } });
  fireEvent.click(screen.getByText('Ayrıştır'));
};

test('649 saat uyku satırı reddedilir ve sebebi yazılır', () => {
  // Tek satırlık girişte hiçbir satır ayrıştırılamayınca bileşen tek hata kutusu gösteriyor.
  typeAndParse('uyku: 649 saat');

  const error = screen.getByText(/Hiçbir satır ayrıştırılamadı/);
  expect(error).toHaveTextContent(/649 saat uyku olamaz/);
  expect(error).toHaveTextContent(/6.49 saat mi demek istedin/);
  expect(screen.queryByText(/Hepsini Onayla/)).not.toBeInTheDocument();
});

test('1 kcal öğün satırı reddedilir', () => {
  typeAndParse('yemek: mangal 1kcal 64p 70f');

  expect(screen.getByText(/Hiçbir satır ayrıştırılamadı/)).toHaveTextContent(/Kalori değeri yanlış/);
  expect(screen.queryByText(/Hepsini Onayla/)).not.toBeInTheDocument();
});

test('hatalı satır diğer geçerli satırları düşürmez', () => {
  typeAndParse('su: 500\nuyku: 649 saat\nkilo: 78.5');

  expect(screen.getByText(/💧 500 ml su/)).toBeInTheDocument();
  expect(screen.getByText(/⚖️ 78.5 kg/)).toBeInTheDocument();
  expect(screen.getByText(/649 saat uyku olamaz/)).toBeInTheDocument();
  expect(screen.getByText(/Hepsini Onayla ve Kaydet \(2\)/)).toBeInTheDocument();
});

test('tutarsız ama mümkün öğün uyarıyla geçer ve kaydedilir', async () => {
  getMealsSummary.mockResolvedValue({ count: 0, totalCalories: 0 });
  addMeals.mockResolvedValue({ meals: [] });

  // 500 kcal etiket, 435 kcal makro -> %13 fark, uyarı ama engel değil
  typeAndParse('yemek: pilav 500kcal 30p 45c 15f');

  expect(screen.getByText(/besin değerlerini doğrula/)).toBeInTheDocument();

  fireEvent.click(screen.getByText(/Hepsini Onayla ve Kaydet \(1\)/));
  await waitFor(() => expect(addMeals).toHaveBeenCalled());
});

test('tutarlı öğün hiç uyarı göstermez', () => {
  typeAndParse('yemek: tavuk 300kcal 40p 5c 10f');

  expect(screen.queryByText(/doğrula/)).not.toBeInTheDocument();
  expect(screen.getByText(/Hepsini Onayla ve Kaydet \(1\)/)).toBeInTheDocument();
});
