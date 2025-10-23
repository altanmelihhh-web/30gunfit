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
  },

  marimba: {
    name: 'Marimba',
    description: 'iPhone tarzı yumuşak marimba sesi',
    play: (audioContext) => {
      // Marimba benzeri melodi (E-G#-B-E yükselen)
      const notes = [
        { freq: 659.25, delay: 0, duration: 0.15 },      // E
        { freq: 830.61, delay: 0.1, duration: 0.15 },    // G#
        { freq: 987.77, delay: 0.2, duration: 0.2 },     // B
        { freq: 1318.5, delay: 0.35, duration: 0.4 }     // E (yüksek)
      ];
      notes.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.25);
        // Echo efekti
        playTone(audioContext, freq, audioContext.currentTime + delay + 0.05, duration, 0.1);
      });
    }
  },

  ascending: {
    name: 'Yükselen',
    description: 'Yukarı tırmanan motivasyon sesi',
    play: (audioContext) => {
      // C major scale yükselen
      const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      scale.forEach((freq, i) => {
        playTone(audioContext, freq, audioContext.currentTime + (i * 0.08), 0.12, 0.3);
      });
    }
  },

  digital: {
    name: 'Dijital',
    description: 'Modern dijital bildirim sesi',
    play: (audioContext) => {
      // Dijital ses efekti
      const pattern = [
        { freq: 1000, delay: 0, duration: 0.05 },
        { freq: 1200, delay: 0.05, duration: 0.05 },
        { freq: 1400, delay: 0.1, duration: 0.1 },
        { freq: 1200, delay: 0.25, duration: 0.05 },
        { freq: 1400, delay: 0.3, duration: 0.15 }
      ];
      pattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.35);
      });
    }
  },

  cosmic: {
    name: 'Uzay',
    description: 'Uzaysal sintetik ses',
    play: (audioContext) => {
      // Uzay temalı ses - yavaş yükselen ve alçalan
      const cosmicPattern = [
        { freq: 200, delay: 0, duration: 0.3 },
        { freq: 400, delay: 0.2, duration: 0.3 },
        { freq: 600, delay: 0.4, duration: 0.3 },
        { freq: 800, delay: 0.6, duration: 0.4 },
        { freq: 600, delay: 1.0, duration: 0.3 },
        { freq: 400, delay: 1.2, duration: 0.3 }
      ];
      cosmicPattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.25);
      });
    }
  },

  twinkle: {
    name: 'Pırıltı',
    description: 'Pırıl pırıl parlak ses',
    play: (audioContext) => {
      // Yüksek frekanslı parlak sesler
      const twinkles = [
        { freq: 1500, delay: 0 },
        { freq: 1800, delay: 0.1 },
        { freq: 2000, delay: 0.15 },
        { freq: 2200, delay: 0.2 },
        { freq: 2500, delay: 0.3 },
        { freq: 2800, delay: 0.35 }
      ];
      twinkles.forEach(({ freq, delay }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, 0.08, 0.2);
      });
    }
  },

  fanfare: {
    name: 'Zafer',
    description: 'Başarı zafer fanfarı',
    play: (audioContext) => {
      // Zafer trompet sesi benzeri
      const fanfareNotes = [
        { freq: 523.25, delay: 0, duration: 0.3 },      // C
        { freq: 523.25, delay: 0.3, duration: 0.3 },    // C
        { freq: 783.99, delay: 0.6, duration: 0.3 },    // G
        { freq: 1046.5, delay: 0.9, duration: 0.5 }     // C yüksek
      ];
      fanfareNotes.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.35);
      });
    }
  },

  ripple: {
    name: 'Dalga',
    description: 'Dalga gibi yumuşak ses',
    play: (audioContext) => {
      // Dalga benzeri yumuşak ses
      [0, 0.15, 0.3, 0.45].forEach((delay, i) => {
        const freq = 440 + (i * 100);
        playTone(audioContext, freq, audioContext.currentTime + delay, 0.4, 0.2);
      });
    }
  },

  pulse: {
    name: 'Nabız',
    description: 'Ritmik nabız sesi',
    play: (audioContext) => {
      // Kalp atışı benzeri ritim
      const pulsePattern = [
        { delay: 0, duration: 0.1 },
        { delay: 0.15, duration: 0.15 },
        { delay: 0.5, duration: 0.1 },
        { delay: 0.65, duration: 0.15 },
        { delay: 1.0, duration: 0.1 },
        { delay: 1.15, duration: 0.15 }
      ];
      pulsePattern.forEach(({ delay, duration }) => {
        playTone(audioContext, 200, audioContext.currentTime + delay, duration, 0.35);
      });
    }
  },

  crystal: {
    name: 'Kristal',
    description: 'Berrak kristal ses',
    play: (audioContext) => {
      // Kristal çan benzeri berrak sesler
      const crystalNotes = [
        { freq: 1046.5, delay: 0 },
        { freq: 1318.5, delay: 0.1 },
        { freq: 1568.0, delay: 0.2 },
        { freq: 2093.0, delay: 0.3 }
      ];
      crystalNotes.forEach(({ freq, delay }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, 0.5, 0.2);
        // Rezonans efekti
        playTone(audioContext, freq * 1.5, audioContext.currentTime + delay + 0.02, 0.3, 0.1);
      });
    }
  },

  breeze: {
    name: 'Esinti',
    description: 'Hafif rüzgar esintisi',
    play: (audioContext) => {
      // Hafif yumuşak ton değişimleri
      const breezePattern = [];
      for (let i = 0; i < 8; i++) {
        breezePattern.push({
          freq: 300 + (Math.sin(i) * 100),
          delay: i * 0.12,
          duration: 0.15
        });
      }
      breezePattern.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.15);
      });
    }
  },

  radar: {
    name: 'Radar',
    description: 'Radar tarama sesi',
    play: (audioContext) => {
      // Radar benzeri sweep
      [0, 0.4, 0.8, 1.2].forEach((delay) => {
        playTone(audioContext, 800, audioContext.currentTime + delay, 0.15, 0.3);
        playTone(audioContext, 1200, audioContext.currentTime + delay + 0.1, 0.15, 0.2);
      });
    }
  },

  sonar: {
    name: 'Sonar',
    description: 'Denizaltı sonar sesi',
    play: (audioContext) => {
      // Sonar ping
      [0, 0.5, 1.0, 1.5, 2.0].forEach((delay) => {
        playTone(audioContext, 600, audioContext.currentTime + delay, 0.2, 0.35);
      });
    }
  },

  trumpet: {
    name: 'Trompet',
    description: 'Şanlı trompet çağrısı',
    play: (audioContext) => {
      // Trompet fanfar
      const trumpetCall = [
        { freq: 392.00, delay: 0, duration: 0.25 },    // G
        { freq: 523.25, delay: 0.25, duration: 0.25 }, // C
        { freq: 659.25, delay: 0.5, duration: 0.25 },  // E
        { freq: 783.99, delay: 0.75, duration: 0.5 }   // G
      ];
      trumpetCall.forEach(({ freq, delay, duration }) => {
        playTone(audioContext, freq, audioContext.currentTime + delay, duration, 0.35);
      });
    }
  },

  xylophone: {
    name: 'Ksilofon',
    description: 'Neşeli ksilofon melodisi',
    play: (audioContext) => {
      // Ksilofon benzeri kısa notalar
      const xyloNotes = [523.25, 587.33, 659.25, 783.99, 880.00];
      xyloNotes.forEach((freq, i) => {
        playTone(audioContext, freq, audioContext.currentTime + (i * 0.1), 0.15, 0.3);
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
