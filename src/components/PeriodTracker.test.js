import { render, screen } from '@testing-library/react';
import { shiftKey, todayKey } from '../utils/cycleMath';

// 30 günlük iki tamamlanmış döngü: bugüne göre kurgulanır ki tahmin hep ileriyi göstersin.
const firstStart = shiftKey(todayKey(), -65);
const buildEntries = () =>
  [firstStart, shiftKey(firstStart, 30), shiftKey(firstStart, 60)].flatMap((start) =>
    Array.from({ length: 4 }, (_, index) => ({
      date: shiftKey(start, index),
      flow: index === 0 ? 'medium' : 'light',
      pain: 3,
      mood: '',
      symptoms: [],
      notes: ''
    }))
  );

jest.mock('../firebase/periodService', () => ({
  getPeriodTracker: jest.fn(),
  savePeriodTracker: jest.fn(),
  upsertPeriodEntry: jest.fn(),
  deletePeriodEntry: jest.fn(),
  buildPeriodBackup: jest.fn(),
  parsePeriodBackup: jest.fn(),
  mergePeriodBackup: jest.fn()
}));

const { getPeriodTracker } = require('../firebase/periodService');

test('shows a learned prediction instead of the default 28 day assumption', async () => {
  getPeriodTracker.mockResolvedValue({
    settings: { cycleLength: 28, periodLength: 4, notifyEnabled: true, notifyBeforeDays: 2 },
    entries: buildEntries()
  });

  const PeriodTracker = require('./PeriodTracker').default;
  render(<PeriodTracker user={{ uid: 'test-uid' }} />);

  expect(await screen.findByText(/Son 2 döngüden öğrenildi: 30 gün/)).toBeInTheDocument();
  expect(screen.getByText(/Döngü Geçmişi/)).toBeInTheDocument();
  // Tamamlanan döngülerin uzunluğu listelenir
  expect(screen.getAllByText('30 gün').length).toBeGreaterThan(0);
});

test('offers the past-periods shortcut while there is no completed cycle', async () => {
  getPeriodTracker.mockResolvedValue({
    settings: { cycleLength: 28, periodLength: 5, notifyEnabled: true, notifyBeforeDays: 2 },
    entries: []
  });

  const PeriodTracker = require('./PeriodTracker').default;
  render(<PeriodTracker user={{ uid: 'test-uid' }} />);

  expect(await screen.findByText(/Tahminleri şimdi başlat/)).toBeInTheDocument();
  expect(screen.getByText(/İlk regl gününü işaretlediğinde tahmin başlar/)).toBeInTheDocument();
});
