/**
 * Bildirim Sesleri Kütüphanesi
 * Farklı bildirim sesi seçenekleri sunar
 */

// Ses çalma yardımcı fonksiyonu
const playTone = (audioContext, frequency, startTime, duration, volume = 0.3) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(volume, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

// Ses Pattern'leri
const soundPatterns = {
  beep3x: {
    name: '3 Bip (Klasik)',
    description: 'Üç kez tekrarlayan standart bip sesi',
    play: (audioContext) => {
      // C note - 3 kere
      [0, 0.3, 0.6].forEach((delay) => {
        playTone(audioContext, 523.25, audioContext.currentTime + delay, 0.2, 0.3);
      });
    }
  },

  chime: {
    name: 'Çan Sesi',
    description: 'Yumuşak çan melodisi',
    play: (audioContext) => {
      // C - E - G akordu (C major)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        playTone(audioContext, freq, audioContext.currentTime + (i * 0.15), 0.5, 0.25);
      });
    }
  },

  alert: {
    name: 'Uyarı',
    description: 'Dikkat çekici uyarı sesi',
    play: (audioContext) => {
      // Yüksek-alçak tekrarlayan ton
      [0, 0.25, 0.5, 0.75].forEach((delay, i) => {
        const freq = i % 2 === 0 ? 800 : 600;
        playTone(audioContext, freq, audioContext.currentTime + delay, 0.15, 0.3);
      });
    }
  },

  bell: {
    name: 'Zil',
    description: 'Uzun zil sesi',
    play: (audioContext) => {
      // A note - uzun süre
      playTone(audioContext, 880, audioContext.currentTime, 0.8, 0.25);
      // Eko efekti
      playTone(audioContext, 880, audioContext.currentTime + 0.4, 0.6, 0.15);
    }
  },

  melody: {
    name: 'Melodi',
    description: 'Kısa motivasyon melodisi',
    play: (audioContext) => {
      // C - D - E - G - C (basit melodi)
      const melody = [
        { freq: 523.25, delay: 0, duration: 0.15 },
        { freq: 587.33, delay: 0.15, duration: 0.15 },
        { freq: 659.25, delay: 0.3, duration: 0.15 },
        { freq: 783.99, delay: 0.45, duration: 0.15 },
        { freq: 1046.5, delay: 0.6, duration: 0.3 }
      ];
      melody.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.25);
      });
    }
  },

  success: {
    name: 'Başarı',
    description: 'Neşeli başarı sesi',
    play: (audioContext) => {
      // Yükselen tonlar - C - E - G - C
      const notes = [
        { freq: 523.25, delay: 0 },
        { freq: 659.25, delay: 0.1 },
        { freq: 783.99, delay: 0.2 },
        { freq: 1046.5, delay: 0.3 }
      ];
      notes.forEach(({ freq, delay }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, 0.2, 0.2);
      });
    }
  },

  gentle: {
    name: 'Yumuşak',
    description: 'Nazik hatırlatma sesi',
    play: (audioContext) => {
      // Düşük frekanslı yumuşak ton
      playTone(audioContext, 440, audioContext.currentTime, 0.6, 0.2);
    }
  },

  urgent: {
    name: 'Acil',
    description: 'Hızlı ve keskin uyarı',
    play: (audioContext) => {
      // Hızlı bip'ler
      [0, 0.15, 0.3, 0.45, 0.6, 0.75].forEach((delay) => {
        playTone(audioContext, 1000, audioContext.currentTime + delay, 0.1, 0.35);
      });
    }
  }
};

/**
 * Bildirim sesi çalar
 * @param {string} soundType - Ses tipi ('beep3x', 'chime', 'alert', vb.)
 */
export const playNotificationSound = (soundType = 'beep3x') => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const pattern = soundPatterns[soundType] || soundPatterns.beep3x;
    pattern.play(audioContext);
  } catch (error) {
    console.log('Ses çalınamadı:', error);
  }
};

/**
 * Mevcut tüm ses seçeneklerini döndürür
 */
export const getSoundOptions = () => {
  return Object.entries(soundPatterns).map(([key, value]) => ({
    value: key,
    name: value.name,
    description: value.description
  }));
};

export default playNotificationSound;
