import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import Calendar from './components/Calendar';
import DayDetail from './components/DayDetail';
import ProgressSummary from './components/ProgressSummary';
import ReminderSettings from './components/ReminderSettings';
import ThemeToggle from './components/ThemeToggle';
import OnboardingModal from './components/OnboardingModal';
import StreakCounter from './components/StreakCounter';
import DataBackup from './components/DataBackup';
import DailyMotivation from './components/DailyMotivation';
import {
  allWorkouts,
  calculateProgramSummary,
  getWorkoutByDay,
  getWorkoutProgress
} from './data/workoutProgram';

const DEFAULT_REMINDERS = {
  enabled: false,
  times: ['09:00', '13:00', '20:00']
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = 'appTheme';
const ONBOARDING_STORAGE_KEY = 'onboardingComplete';

const resolveInitialTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (error) {
    // ignore storage failures and fallback to system preference
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const formatTimeValue = (value) => {
  if (!value) return '09:00';
  const [hour = '00', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const sanitizeTimes = (times = []) => {
  const unique = Array.from(new Set(times.map(formatTimeValue))).sort();
  return unique.length > 0 ? unique.slice(0, 4) : [...DEFAULT_REMINDERS.times];
};

const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateCurrentDay = (startDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = normalizeDate(startDate) || today;
  const diff = Math.floor((today - start) / MS_IN_DAY);
  let dayNumber = diff + 1;
  if (dayNumber < 1) dayNumber = 1;
  if (dayNumber > allWorkouts.length) dayNumber = allWorkouts.length;
  return dayNumber;
};

const getCurrentTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

function App() {
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [theme, setTheme] = useState(() => {
    const initialTheme = resolveInitialTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
    return initialTheme;
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const [completedDays, setCompletedDays] = useState(() => {
    try {
      const saved = localStorage.getItem('completedDays');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  });

  const [completedExercises, setCompletedExercises] = useState(() => {
    try {
      const saved = localStorage.getItem('completedExercises');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      return {};
    }
  });

  const [startDate, setStartDate] = useState(() => {
    try {
      const saved = localStorage.getItem('programStartDate');
      if (saved) {
        const parsed = normalizeDate(saved);
        if (parsed) {
          return parsed;
        }
      }
    } catch (error) {
      // ignore
    }
    return normalizeDate(new Date());
  });

  const [reminderSettings, setReminderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('reminderSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          enabled: Boolean(parsed.enabled),
          times: sanitizeTimes(parsed.times)
        };
      }
    } catch (error) {
      // ignore
    }
    return { ...DEFAULT_REMINDERS };
  });

  const [selectedDay, setSelectedDay] = useState(null);
  const lastReminderRef = useRef({});
  const detailSectionRef = useRef(null);

  const currentDay = useMemo(() => calculateCurrentDay(startDate), [startDate]);
  const todaysWorkout = useMemo(() => getWorkoutByDay(currentDay), [currentDay]);

  const summary = useMemo(
    () => calculateProgramSummary(allWorkouts, completedDays, completedExercises),
    [completedDays, completedExercises]
  );

  const todaysProgress = useMemo(
    () => getWorkoutProgress(todaysWorkout, completedExercises),
    [todaysWorkout, completedExercises]
  );

  const dayCompletionPercent = useMemo(() => {
    return Math.round((completedDays.length / allWorkouts.length) * 100);
  }, [completedDays.length]);

  const daysRemaining = useMemo(() => {
    return Math.max(allWorkouts.length - completedDays.length, 0);
  }, [completedDays.length]);

  const upcomingWorkout = useMemo(() => {
    if (currentDay >= allWorkouts.length) {
      return null;
    }
    return getWorkoutByDay(Math.min(currentDay + 1, allWorkouts.length));
  }, [currentDay]);

  const nextRestDay = useMemo(() => {
    return allWorkouts.slice(currentDay).find((workout) => workout.isRest) || null;
  }, [currentDay]);

  // Streak hesapla
  const streak = useMemo(() => {
    if (!completedDays || completedDays.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - start) / (24 * 60 * 60 * 1000));
    const currentDayNum = diffDays + 1;

    // Son günden geriye doğru streak hesapla
    let streakCount = 0;
    for (let day = currentDayNum; day >= 1; day--) {
      if (completedDays.includes(day)) {
        streakCount++;
      } else {
        break;
      }
    }

    return streakCount;
  }, [completedDays, startDate]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('completedDays', JSON.stringify(completedDays));
  }, [completedDays]);

  useEffect(() => {
    localStorage.setItem('completedExercises', JSON.stringify(completedExercises));
  }, [completedExercises]);

  useEffect(() => {
    if (startDate) {
      localStorage.setItem('programStartDate', startDate.toISOString());
    }
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('reminderSettings', JSON.stringify(reminderSettings));
  }, [reminderSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true') {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      }
    } catch (error) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const originalOverflow = document.body.style.overflow;
    if (isOnboardingOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow;
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOnboardingOpen]);

  useEffect(() => {
    if (!selectedDay && todaysWorkout) {
      setSelectedDay(todaysWorkout);
    }
  }, [selectedDay, todaysWorkout]);

  useEffect(() => {
    if (!reminderSettings.enabled || !notificationsSupported) {
      return undefined;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkAndNotify = () => {
      console.log('🔔 Hatırlatma kontrolü:', new Date().toLocaleTimeString('tr-TR'));

      if (!todaysWorkout) {
        console.log('❌ Bugünkü antrenman yok');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.log('❌ Bildirim izni yok');
        return;
      }

      if (completedDays.includes(todaysWorkout.day)) {
        console.log('✅ Gün zaten tamamlanmış');
        return;
      }

      const currentTime = getCurrentTimeString();
      console.log('⏰ Şu anki saat:', currentTime);
      console.log('📋 Ayarlı saatler:', reminderSettings.times);

      if (!reminderSettings.times.includes(currentTime)) {
        console.log('⏭️ Şu an hatırlatma zamanı değil');
        return;
      }

      const todayKey = `${new Date().toISOString().split('T')[0]}-${currentTime}`;
      if (lastReminderRef.current[todayKey]) {
        console.log('🔁 Bu saat için zaten bildirim gönderildi');
        return;
      }

      const progress = getWorkoutProgress(todaysWorkout, completedExercises);
      if (progress.percent >= 100) {
        console.log('✅ Antrenman %100 tamamlanmış');
        return;
      }

      console.log('🚀 BİLDİRİM GÖNDERİLİYOR!');

      new Notification('💪 30 Gün Fit - Hatırlatma', {
        body: `Gün ${todaysWorkout.day} (${todaysWorkout.title}) · %${progress.percent} tamamlandı. Hadi devam!`,
        icon: '/logo192.png'
      });

      // Özel bildirim sesi çal (3 kere bip - dikkat çekici!)
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        [0, 300, 600].forEach((delay) => {
          setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 523.25; // C note
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
          }, delay);
        });
      } catch (error) {
        console.log('Ses çalınamadı:', error);
      }

      lastReminderRef.current[todayKey] = true;
    };

    const intervalId = setInterval(checkAndNotify, 60 * 1000);
    checkAndNotify();

    return () => clearInterval(intervalId);
  }, [
    reminderSettings,
    notificationsSupported,
    todaysWorkout,
    completedExercises,
    completedDays
  ]);

  const toggleDayComplete = (day) => {
    setCompletedDays((prev) => (
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    ));
  };

  const toggleExerciseComplete = (dayId, exerciseId) => {
    const key = `${dayId}-${exerciseId}`;
    setCompletedExercises((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleReminderChange = (nextSettings) => {
    setReminderSettings({
      enabled: Boolean(nextSettings.enabled),
      times: sanitizeTimes(nextSettings.times)
    });
  };

  const handleStartDateChange = (date) => {
    const normalized = normalizeDate(date);
    if (normalized) {
      setStartDate(normalized);
    }
  };

  const handleOnboardingComplete = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (error) {
      // ignore
    }
    setIsOnboardingOpen(false);
  };

  const handleOpenOnboarding = () => {
    setIsOnboardingOpen(true);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleDayClick = (workout) => {
    setSelectedDay(workout);
    // Mobilde detay bölümüne otomatik scroll yap
    if (detailSectionRef.current) {
      setTimeout(() => {
        detailSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  };

  const handleDataImport = (importedData) => {
    setCompletedDays(importedData.completedDays);
    setCompletedExercises(importedData.completedExercises);
    setStartDate(importedData.startDate);
    setReminderSettings(importedData.reminderSettings);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-bar">
          <div className="header-content">
            <h1>💪 30 Günlük Spor Programı</h1>
            <p className="subtitle">Başlangıç Seviyesi - Zayıflama &amp; Sıkılaşma</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleOpenOnboarding}
            >
              Planı Güncelle
            </button>
            <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
          </div>
        </div>
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${dayCompletionPercent}%` }} />
          </div>
          <p className="progress-text">
            <span>%{dayCompletionPercent} Gün Tamamlandı ({completedDays.length}/{allWorkouts.length})</span>
            <span>{daysRemaining} gün kaldı</span>
          </p>
        </div>
      </header>

      <main className="app-main">
        {/* Günlük Motivasyon */}
        <DailyMotivation
          completedDays={completedDays}
          currentDay={currentDay}
          streak={streak}
        />

        <section className="insight-strip">
          <article className="insight-card">
            <span className="insight-label">Bugünkü Odak</span>
            <h3>
              {todaysWorkout ? `Gün ${todaysWorkout.day}` : 'Program tamamlandı'}
            </h3>
            <p>{todaysWorkout?.title || 'Tebrikler, tüm egzersizleri bitirdin!'}</p>
          </article>

          <article className="insight-card">
            <span className="insight-label">Sıradaki Plan</span>
            <h3>
              {nextRestDay
                ? `Dinlenme · Gün ${nextRestDay.day}`
                : upcomingWorkout
                  ? `Gün ${upcomingWorkout.day}`
                  : 'Program tamamlandı'}
            </h3>
            <p>
              {nextRestDay?.title ||
                upcomingWorkout?.title ||
                'Yeni programa başlamak için hazır mısın?'}
            </p>
          </article>

          <article className="insight-card">
            <span className="insight-label">Hatırlatmalar</span>
            <h3>{reminderSettings.enabled ? `${reminderSettings.times.length} zaman` : 'Pasif'}</h3>
            <p>
              {reminderSettings.enabled
                ? reminderSettings.times.join(' · ')
                : 'Bildirimleri açarak motivasyonu taze tut.'}
            </p>
          </article>
        </section>

        <div className="main-sections">
          <div className="dashboard-sections">
            <ProgressSummary
              summary={summary}
              todaysWorkout={todaysWorkout}
              todaysProgress={todaysProgress}
              currentDay={currentDay}
              startDate={startDate}
            />
            <StreakCounter
              completedDays={completedDays}
              startDate={startDate}
            />
            <ReminderSettings
              settings={reminderSettings}
              onChange={handleReminderChange}
              startDate={startDate}
              onStartDateChange={handleStartDateChange}
              todaysProgress={todaysProgress}
              todaysWorkout={todaysWorkout}
              currentDay={currentDay}
              notificationsSupported={notificationsSupported}
            />
            <DataBackup
              completedDays={completedDays}
              completedExercises={completedExercises}
              startDate={startDate}
              reminderSettings={reminderSettings}
              onImport={handleDataImport}
            />
          </div>

          <div className="two-column-grid">
            <div className="calendar-section">
              <h2>Takvim</h2>
              <Calendar
                workouts={allWorkouts}
                completedDays={completedDays}
                onDayClick={handleDayClick}
                selectedDay={selectedDay}
                completedExercises={completedExercises}
              />
            </div>

            <div className="detail-section" ref={detailSectionRef}>
              {selectedDay ? (
                <DayDetail
                  workout={selectedDay}
                  completedExercises={completedExercises}
                  onToggleExercise={toggleExerciseComplete}
                  onToggleDayComplete={() => toggleDayComplete(selectedDay.day)}
                  isDayComplete={completedDays.includes(selectedDay.day)}
                />
              ) : (
                <div className="no-selection">
                  <p>Bir gün seçin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <OnboardingModal
        open={isOnboardingOpen}
        startDate={startDate}
        onStartDateChange={handleStartDateChange}
        reminderSettings={reminderSettings}
        onReminderChange={handleReminderChange}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingComplete}
      />
    </div>
  );
}

export default App;
