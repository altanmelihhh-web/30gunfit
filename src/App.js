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
import ProfileOnboarding from './components/ProfileOnboarding';
import ProfileSettings from './components/ProfileSettings';
import VideoManager from './components/VideoManager';
import { allWorkouts as defaultProgram } from './data/workoutProgram';
import {
  generate30DayProgram,
  calculateProgramSummary,
  getWorkoutByDay,
  getWorkoutProgress
} from './utils/programGenerator';
import { playNotificationSound } from './utils/notificationSounds';
import { FITNESS_GOALS, DIFFICULTY_LEVELS } from './data/exerciseLibrary';

const DEFAULT_REMINDERS = {
  enabled: false,
  times: ['09:00', '13:00', '20:00'],
  soundType: 'beep3x'
};

const DEFAULT_PROFILE = {
  name: 'Misafir',
  age: 25,
  weight: 70,
  height: 170,
  gender: 'male',
  goal: FITNESS_GOALS.GENERAL_FITNESS,
  difficulty: DIFFICULTY_LEVELS.BEGINNER,
  dailyDuration: 30,
  weeklyDays: 5,
  bmi: 24.2
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = 'appTheme';
const ONBOARDING_STORAGE_KEY = 'onboardingComplete';
const PROFILE_STORAGE_KEY = 'userProfile';
const PROGRAM_STORAGE_KEY = 'userProgram';
const PROFILE_ONBOARDING_STORAGE_KEY = 'profileOnboardingComplete';

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

const calculateCurrentDay = (startDate, programLength) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = normalizeDate(startDate) || today;
  const diff = Math.floor((today - start) / MS_IN_DAY);
  let dayNumber = diff + 1;
  if (dayNumber < 1) dayNumber = 1;
  if (dayNumber > programLength) dayNumber = programLength;
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
  const [isProfileOnboardingOpen, setIsProfileOnboardingOpen] = useState(false);

  // Kullanıcı profili
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // ignore
    }
    return { ...DEFAULT_PROFILE };
  });

  // Kullanıcı programı (dinamik)
  const [userProgram, setUserProgram] = useState(() => {
    try {
      const saved = localStorage.getItem(PROGRAM_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // ignore
    }
    // Eğer profil varsa ve program yoksa, profil ile program oluştur
    try {
      const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        return generate30DayProgram(profile);
      }
    } catch (error) {
      // ignore
    }
    // Varsayılan olarak eski sabit programı kullan
    return defaultProgram;
  });

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
          times: sanitizeTimes(parsed.times),
          soundType: parsed.soundType || 'beep3x'
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

  const currentDay = useMemo(() => calculateCurrentDay(startDate, userProgram.length), [startDate, userProgram.length]);
  const todaysWorkout = useMemo(() => getWorkoutByDay(userProgram, currentDay), [userProgram, currentDay]);

  const summary = useMemo(
    () => calculateProgramSummary(userProgram, completedDays, completedExercises),
    [userProgram, completedDays, completedExercises]
  );

  const todaysProgress = useMemo(
    () => getWorkoutProgress(todaysWorkout, completedExercises),
    [todaysWorkout, completedExercises]
  );

  const dayCompletionPercent = useMemo(() => {
    return Math.round((completedDays.length / userProgram.length) * 100);
  }, [completedDays.length, userProgram.length]);

  const daysRemaining = useMemo(() => {
    return Math.max(userProgram.length - completedDays.length, 0);
  }, [completedDays.length, userProgram.length]);

  const upcomingWorkout = useMemo(() => {
    if (currentDay >= userProgram.length) {
      return null;
    }
    return getWorkoutByDay(userProgram, Math.min(currentDay + 1, userProgram.length));
  }, [userProgram, currentDay]);

  const nextRestDay = useMemo(() => {
    return userProgram.slice(currentDay).find((workout) => workout.isRest) || null;
  }, [userProgram, currentDay]);

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

  // Kullanıcı profilini kaydet
  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
  }, [userProfile]);

  // Kullanıcı programını kaydet
  useEffect(() => {
    localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(userProgram));
  }, [userProgram]);

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

  // İlk açılışta profil onboarding kontrol et
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const profileOnboardingDone = localStorage.getItem(PROFILE_ONBOARDING_STORAGE_KEY);
      if (profileOnboardingDone !== 'true') {
        setIsProfileOnboardingOpen(true);
      }
    } catch (error) {
      // ignore
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

      // Seçili bildirim sesini çal
      playNotificationSound(reminderSettings.soundType);

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
      times: sanitizeTimes(nextSettings.times),
      soundType: nextSettings.soundType || 'beep3x'
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

  const handleProfileOnboardingComplete = (profile) => {
    setUserProfile(profile);

    // Yeni profil ile program oluştur
    const newProgram = generate30DayProgram(profile);
    setUserProgram(newProgram);

    // İlerlemeleri sıfırla
    setCompletedDays([]);
    setCompletedExercises({});

    // Başlangıç tarihini bugün yap
    setStartDate(normalizeDate(new Date()));

    // Onboarding tamamlandı olarak işaretle
    localStorage.setItem(PROFILE_ONBOARDING_STORAGE_KEY, 'true');
    setIsProfileOnboardingOpen(false);

    // İlk günü seç
    if (newProgram.length > 0) {
      setSelectedDay(newProgram[0]);
    }
  };

  const handleProfileOnboardingSkip = () => {
    // Varsayılan profil ile program oluştur
    const newProgram = generate30DayProgram(DEFAULT_PROFILE);
    setUserProgram(newProgram);

    localStorage.setItem(PROFILE_ONBOARDING_STORAGE_KEY, 'true');
    setIsProfileOnboardingOpen(false);

    if (newProgram.length > 0) {
      setSelectedDay(newProgram[0]);
    }
  };

  const handleProfileSave = (updatedProfile) => {
    setUserProfile(updatedProfile);
  };

  const handleRegenerateProgram = (profile) => {
    const confirmed = window.confirm(
      'Yeni program oluşturduğunuzda tüm ilerlemeniz sıfırlanacak. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    // Yeni program oluştur
    const newProgram = generate30DayProgram(profile);
    setUserProgram(newProgram);

    // İlerlemeleri sıfırla
    setCompletedDays([]);
    setCompletedExercises({});

    // Başlangıç tarihini bugün yap
    setStartDate(normalizeDate(new Date()));

    // İlk günü seç
    if (newProgram.length > 0) {
      setSelectedDay(newProgram[0]);
    }

    alert('✅ Yeni programınız oluşturuldu! İyi antrenmanlar!');
  };

  const handleVideoSave = (updatedLibrary) => {
    // Video güncellemeleri exerciseLibrary.js'de zaten yapıldı
    // Programı yeniden oluştur (güncel videolarla)
    const newProgram = generate30DayProgram(userProfile);
    setUserProgram(newProgram);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-bar">
          <div className="header-content">
            <h1>💪 30 Gün Fit</h1>
            <p className="subtitle">Size Özel Fitness Programı · {userProfile.name}</p>
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
            <span>%{dayCompletionPercent} Gün Tamamlandı ({completedDays.length}/{userProgram.length})</span>
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
            <ProfileSettings
              profile={userProfile}
              onSave={handleProfileSave}
              onRegenerateProgram={handleRegenerateProgram}
            />
            <VideoManager
              onSave={handleVideoSave}
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
                workouts={userProgram}
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

      <ProfileOnboarding
        isOpen={isProfileOnboardingOpen}
        onComplete={handleProfileOnboardingComplete}
        onSkip={handleProfileOnboardingSkip}
      />
    </div>
  );
}

export default App;
