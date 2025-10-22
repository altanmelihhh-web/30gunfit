/**
 * Ses & Motivasyon Ayarları Yönetimi
 * localStorage'da kaydedilir
 */

const STORAGE_KEY = 'soundSettings';

const DEFAULT_SETTINGS = {
  soundEffects: true,      // Bip sesleri (başlama, bitiş, vb.)
  speech: true,            // Konuşma sentezi (tekrar sayma, motivasyon)
  motivationMessages: true // Motivasyon mesajları
};

export const getSoundSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Ses ayarları okunamadı:', error);
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveSoundSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Ses ayarları kaydedilemedi:', error);
    return false;
  }
};

export const updateSoundSetting = (key, value) => {
  const current = getSoundSettings();
  current[key] = value;
  return saveSoundSettings(current);
};
