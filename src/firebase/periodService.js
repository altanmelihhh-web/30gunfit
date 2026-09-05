import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';

export const PERIOD_STORAGE_KEY = 'period_tracker';
const STORAGE_KEY = PERIOD_STORAGE_KEY;
const DEFAULT_DATA = {
  settings: { cycleLength: 28, periodLength: 5, notifyEnabled: true, notifyBeforeDays: 2 },
  entries: []
};

const normalizeEntry = (entry) => ({
  date: entry.date,
  flow: entry.flow || 'none',
  pain: parseInt(entry.pain, 10) || 0,
  mood: entry.mood || '',
  symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
  notes: entry.notes || '',
  updatedAt: entry.updatedAt || new Date().toISOString()
});

const normalizeData = (data = DEFAULT_DATA) => ({
  settings: {
    cycleLength: parseInt(data.settings?.cycleLength, 10) || 28,
    periodLength: parseInt(data.settings?.periodLength, 10) || 5,
    notifyEnabled: data.settings?.notifyEnabled !== false,
    notifyBeforeDays: Math.min(7, Math.max(0, parseInt(data.settings?.notifyBeforeDays, 10) || 2))
  },
  entries: (data.entries || [])
    .filter((entry) => entry?.date)
    .map(normalizeEntry)
    .sort((a, b) => b.date.localeCompare(a.date))
});

export const getPeriodTracker = async (userId) => {
  const local = getScopedJson(STORAGE_KEY, userId, DEFAULT_DATA);
  if (!userId) return normalizeData(local);
  const snap = await getDoc(doc(db, 'periodTrackers', userId));
  const data = normalizeData(snap.exists() ? snap.data() : local);
  setScopedJson(STORAGE_KEY, userId, data);
  return data;
};

export const savePeriodTracker = async (userId, data) => {
  const normalized = normalizeData(data);
  setScopedJson(STORAGE_KEY, userId, normalized);
  if (userId) {
    await setDoc(doc(db, 'periodTrackers', userId), {
      ...normalized,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
  return normalized;
};

export const upsertPeriodEntry = async (userId, entry) => {
  const current = await getPeriodTracker(userId);
  const nextEntry = normalizeEntry({ ...entry, updatedAt: new Date().toISOString() });
  const entries = [
    nextEntry,
    ...current.entries.filter((item) => item.date !== nextEntry.date)
  ];
  return savePeriodTracker(userId, { ...current, entries });
};

export const deletePeriodEntry = async (userId, date) => {
  const current = await getPeriodTracker(userId);
  return savePeriodTracker(userId, {
    ...current,
    entries: current.entries.filter((entry) => entry.date !== date)
  });
};

// Ağ isteği yapmadan yerel önbellekten okur (bildirim kontrolü gibi arka plan işleri için).
export const getCachedPeriodTracker = (userId) =>
  normalizeData(getScopedJson(STORAGE_KEY, userId, DEFAULT_DATA));

export const buildPeriodBackup = (tracker) => ({
  type: '30gunfit-period-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  settings: tracker.settings,
  entries: tracker.entries
});

export const parsePeriodBackup = (raw) => {
  const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error('Geçersiz regl yedeği: entries listesi yok.');
  }
  if (payload.type && payload.type !== '30gunfit-period-backup') {
    throw new Error('Bu dosya regl yedeği değil.');
  }
  return payload;
};

// Yedekten gelen kayıtları mevcutlarla birleştirir; aynı tarih varsa yedekteki kazanır.
export const mergePeriodBackup = async (userId, payload) => {
  const current = await getPeriodTracker(userId);
  const byDate = new Map(current.entries.map((entry) => [entry.date, entry]));
  payload.entries
    .filter((entry) => entry?.date)
    .forEach((entry) => byDate.set(entry.date, normalizeEntry(entry)));

  return savePeriodTracker(userId, {
    settings: { ...current.settings, ...(payload.settings || {}) },
    entries: [...byDate.values()]
  });
};
