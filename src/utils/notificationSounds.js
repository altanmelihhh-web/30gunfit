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
  },

  longRingtone: {
    name: 'Uzun Zil',
    description: 'Uzun süre devam eden dikkat çekici zil sesi',
    play: (audioContext) => {
      // Uzun zil melodisi - yaklaşık 4 saniye
      // Melodi: C-E-G-C, C-E-G-C (tekrar eden)
      const pattern = [
        { freq: 523.25, delay: 0, duration: 0.4 },     // C
        { freq: 659.25, delay: 0.4, duration: 0.4 },   // E
        { freq: 783.99, delay: 0.8, duration: 0.4 },   // G
        { freq: 1046.5, delay: 1.2, duration: 0.6 },   // C (yüksek)

        { freq: 523.25, delay: 1.9, duration: 0.4 },   // C
        { freq: 659.25, delay: 2.3, duration: 0.4 },   // E
        { freq: 783.99, delay: 2.7, duration: 0.4 },   // G
        { freq: 1046.5, delay: 3.1, duration: 0.8 }    // C (yüksek, uzun)
      ];
      pattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.3);
      });
    }
  },

  phoneRing: {
    name: 'Telefon Zili',
    description: 'Klasik telefon zil sesi (uzun ve dikkat çekici)',
    play: (audioContext) => {
      // Klasik telefon zili paterni - 2 çift zil
      const ringPattern = [
        // İlk çift zil
        { freq: 440, delay: 0, duration: 0.3 },
        { freq: 480, delay: 0.05, duration: 0.3 },
        { freq: 440, delay: 0.4, duration: 0.3 },
        { freq: 480, delay: 0.45, duration: 0.3 },

        // Kısa ara

        // İkinci çift zil
        { freq: 440, delay: 1.2, duration: 0.3 },
        { freq: 480, delay: 1.25, duration: 0.3 },
        { freq: 440, delay: 1.6, duration: 0.3 },
        { freq: 480, delay: 1.65, duration: 0.3 }
      ];
      ringPattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.35);
      });
    }
  },

  alarm: {
    name: 'Alarm',
    description: 'Yüksek sesli uzun alarm sesi',
    play: (audioContext) => {
      // Yükselen-alçalan alarm sesi
      const alarmPattern = [];
      // 3 saniye boyunca 10 kez yükselen-alçalan ton
      for (let i = 0; i < 10; i++) {
        alarmPattern.push({
          freq: i % 2 === 0 ? 900 : 700,
          delay: i * 0.3,
          duration: 0.25
        });
      }
      alarmPattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.4);
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
