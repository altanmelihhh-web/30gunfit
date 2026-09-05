import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../firebase/dataService', () => ({
  getDailyLogsRange: jest.fn()
}));

jest.mock('../firebase/dailyLogService', () => ({
  saveSleep: jest.fn(),
  deleteSleep: jest.fn()
}));

const { getDailyLogsRange } = require('../firebase/dataService');
const { saveSleep } = require('../firebase/dailyLogService');

const renderTracker = async () => {
  const SleepTracker = require('./SleepTracker').default;
  render(<SleepTracker user={{ uid: 'test-uid' }} />);
  await screen.findByText(/Uyku Ekle/);
  fireEvent.click(screen.getByText(/➕ Uyku Ekle/));
};

beforeEach(() => {
  getDailyLogsRange.mockResolvedValue({});
  saveSleep.mockResolvedValue({ success: true });
});

test('649 saat uyku kaydedilemez ve 6.49 önerisi tek tıkla uygulanır', async () => {
  await renderTracker();

  const durationInput = screen.getByPlaceholderText('7.5');
  fireEvent.change(durationInput, { target: { value: '649' } });

  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent(/649 saat uyku olamaz/);
  expect(alert).toHaveTextContent(/6.49 saat mi demek istedin/);
  expect(screen.getByText(/💾 Kaydet/)).toBeDisabled();

  fireEvent.click(screen.getByText('6.49 saat yap'));
  expect(durationInput).toHaveValue(6.49);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText(/💾 Kaydet/));
  await waitFor(() => expect(saveSleep).toHaveBeenCalled());
  expect(saveSleep.mock.calls[0][2].duration_hours).toBe(6.49);
});

test('normal uyku süresi uyarısız kaydedilir', async () => {
  await renderTracker();

  fireEvent.change(screen.getByPlaceholderText('7.5'), { target: { value: '7.5' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText(/💾 Kaydet/));
  await waitFor(() => expect(saveSleep).toHaveBeenCalled());
});

test('18 saat uyku uyarır ama kaydı engellemez', async () => {
  await renderTracker();

  fireEvent.change(screen.getByPlaceholderText('7.5'), { target: { value: '18' } });
  expect(screen.getByRole('alert')).toHaveTextContent(/alışılmadık derecede uzun/);
  expect(screen.getByText(/💾 Kaydet/)).not.toBeDisabled();

  fireEvent.click(screen.getByText(/💾 Kaydet/));
  await waitFor(() => expect(saveSleep).toHaveBeenCalled());
});

test('geçmişte kayıtlı hatalı uyku listede işaretlenir', async () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  getDailyLogsRange.mockResolvedValue({
    [yesterday]: { sleep: { duration_hours: 649 } },
    [today]: { sleep: { duration_hours: 7.2 } }
  });

  const SleepTracker = require('./SleepTracker').default;
  render(<SleepTracker user={{ uid: 'test-uid' }} />);

  expect(await screen.findByText('⛔ Hatalı veri')).toBeInTheDocument();
  expect(screen.getAllByText('⛔ Hatalı veri')).toHaveLength(1);
});
