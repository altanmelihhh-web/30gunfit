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
import AuthModal from './components/AuthModal';
import NutritionDashboard from './components/NutritionDashboard';
import WeightTracker from './components/WeightTracker';
import ProgressPhotos from './components/ProgressPhotos';
import BodyMeasurements from './components/BodyMeasurements';
import BodyComposition from './components/BodyComposition';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import {
  generate30DayProgram,
  calculateProgramSummary,
  getWorkoutByDay,
  getWorkoutProgress
} from './utils/programGenerator';
import { playNotificationSound } from './utils/notificationSounds';
import { FITNESS_GOALS, DIFFICULTY_LEVELS } from './data/exerciseLibrary';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { logout, handleGoogleRedirectResult, loginWithGoogle } from './firebase/authService';
import {
  getAllUserData,
  saveUserProfile,
  saveUserProgram,
  saveUserProgress,
  saveUserSettings
} from './firebase/dataService';

const DEFAULT_REMINDERS = {
  enabled: false,
  times: ['09:00', '13:00', '20:00'],
  soundType: 'phoneRing' // Daha dikkat çekici varsayılan ses
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
  // Bildirim desteği kontrolü (HTTPS veya localhost gerekli)
  const notificationsSupported = typeof window !== 'undefined' &&
    'Notification' in window &&
    (window.location.protocol === 'https:' ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');

  const [theme, setTheme] = useState(() => {
    const initialTheme = resolveInitialTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
    return initialTheme;
  });
  const [user, setUser] = useState(null);
  // Google Drive erişim token'ı - sadece bellekte, ~1 saat sonra süresi dolar
  const [driveAccessToken, setDriveAccessToken] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isProfileOnboardingOpen, setIsProfileOnboardingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'stats', 'calendar', 'nutrition', 'more'
  // "Daha Fazla" sekmesi altında ikincil bir menü - null iken menü listesi, dolu iken o alt sayfa gösterilir
  const [moreSection, setMoreSection] = useState(null); // null, 'settings', 'videos'

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
    // Varsayılan olarak DEFAULT_PROFILE ile program oluştur
    return generate30DayProgram(DEFAULT_PROFILE);
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

  // İlerleme verilerinin en son güncellenme zamanı
  const [progressUpdatedAt, setProgressUpdatedAt] = useState(() => {
    try {
      const saved = localStorage.getItem('progressUpdatedAt');
      return saved || null;
    } catch (error) {
      return null;
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
    const now = new Date().toISOString();
    localStorage.setItem('completedDays', JSON.stringify(completedDays));
    localStorage.setItem('progressUpdatedAt', now);
    setProgressUpdatedAt(now);

    // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
    if (user) {
      saveUserProgress(user.uid, {
        completedDays,
        completedExercises,
        startDate: startDate?.toISOString()
      }).catch(error => console.error('Progress save error:', error));
    }
  }, [completedDays, user, completedExercises, startDate]);

  useEffect(() => {
    const now = new Date().toISOString();
    localStorage.setItem('completedExercises', JSON.stringify(completedExercises));
    localStorage.setItem('progressUpdatedAt', now);
    setProgressUpdatedAt(now);

    // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
    if (user) {
      saveUserProgress(user.uid, {
        completedDays,
        completedExercises,
        startDate: startDate?.toISOString()
      }).catch(error => console.error('Progress save error:', error));
    }
  }, [completedExercises, user, completedDays, startDate]);

  useEffect(() => {
    if (startDate) {
      const now = new Date().toISOString();
      localStorage.setItem('programStartDate', startDate.toISOString());
      localStorage.setItem('progressUpdatedAt', now);
      setProgressUpdatedAt(now);

      // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
      if (user) {
        saveUserProgress(user.uid, {
          completedDays,
          completedExercises,
          startDate: startDate.toISOString()
        }).catch(error => console.error('Progress save error:', error));
      }
    }
  }, [startDate, user, completedDays, completedExercises]);

  useEffect(() => {
    localStorage.setItem('reminderSettings', JSON.stringify(reminderSettings));

    // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
    if (user) {
      saveUserSettings(user.uid, {
        reminderSettings,
        theme
      }).catch(error => console.error('Settings save error:', error));
    }
  }, [reminderSettings, user, theme]);

  // Kullanıcı profilini kaydet
  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile));

    // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
    if (user) {
      saveUserProfile(user.uid, userProfile)
        .catch(error => console.error('Profile save error:', error));
    }
  }, [userProfile, user]);

  // Kullanıcı programını kaydet
  useEffect(() => {
    localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(userProgram));

    // Firestore'a da kaydet (kullanıcı giriş yaptıysa)
    if (user) {
      saveUserProgram(user.uid, userProgram)
        .catch(error => console.error('Program save error:', error));
    }
  }, [userProgram, user]);

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

  // Firebase Authentication State Listener
  useEffect(() => {
    // Google ile yönlendirmeli girişten dönüldüyse sonucu işle (ilk girişte Firestore kullanıcı
    // belgesini oluşturur). onAuthStateChanged bu Promise'i bekler ki yeni bir Google girişinde
    // kullanıcı belgesi henüz oluşmadan Firestore'dan veri okumaya çalışıp "Missing or
    // insufficient permissions" hatası almayalım.
    const redirectResultPromise = handleGoogleRedirectResult().then((result) => {
      if (result?.driveAccessToken) {
        setDriveAccessToken(result.driveAccessToken);
      }
      return result;
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      await redirectResultPromise;

      if (firebaseUser) {
        // Kullanıcı giriş yaptı
        setUser(firebaseUser);

        // Firestore'dan kullanıcı verilerini yükle
        try {
          const result = await getAllUserData(firebaseUser.uid);
          if (result.success) {
            const data = result.data;

            // Profil varsa yükle
            if (data.profile) {
              setUserProfile(data.profile);
              // Kayıtlı kullanıcının profili var - onboarding ekranını atla
              localStorage.setItem(PROFILE_ONBOARDING_STORAGE_KEY, 'true');
              setIsProfileOnboardingOpen(false);
            }

            // Program varsa yükle
            if (data.program) {
              setUserProgram(data.program);
            } else if (data.profile) {
              // Program yoksa ama profil varsa, profil ile yeni program oluştur
              const newProgram = generate30DayProgram(data.profile);
              setUserProgram(newProgram);
              await saveUserProgram(firebaseUser.uid, newProgram);
            }

            // İlerleme varsa yükle - AMA localStorage ile karşılaştır (EN GÜNCEL OLAN KAZANSIN!)
            if (data.progress) {
              // localStorage'dan timestamp'i al
              const localProgressTimestamp = localStorage.getItem('progressUpdatedAt');
              const firebaseProgressTimestamp = data.progress.updatedAt;

              console.log('🔄 İlerleme Senkronizasyonu:');
              console.log('   📱 localStorage timestamp:', localProgressTimestamp);
              console.log('   ☁️  Firebase timestamp:', firebaseProgressTimestamp);

              // Timestamp karşılaştırması
              const useLocalData = localProgressTimestamp &&
                (!firebaseProgressTimestamp || new Date(localProgressTimestamp) > new Date(firebaseProgressTimestamp));

              if (useLocalData) {
                console.log('   ✅ localStorage daha güncel! localStorage verileri kullanılıyor.');
                console.log('   📤 Firebase güncelleniyor...');

                // localStorage daha güncel - Firebase'i güncelle
                const localCompletedDays = JSON.parse(localStorage.getItem('completedDays') || '[]');
                const localCompletedExercises = JSON.parse(localStorage.getItem('completedExercises') || '{}');
                const localStartDate = localStorage.getItem('programStartDate');

                await saveUserProgress(firebaseUser.uid, {
                  completedDays: localCompletedDays,
                  completedExercises: localCompletedExercises,
                  startDate: localStartDate
                });

                console.log('   ✅ Firebase güncellendi!');
              } else {
                console.log('   ✅ Firebase daha güncel! Firebase verileri kullanılıyor.');

                // Firebase daha güncel - state'i güncelle
                setCompletedDays(data.progress.completedDays || []);
                setCompletedExercises(data.progress.completedExercises || {});
                if (data.progress.startDate) {
                  setStartDate(normalizeDate(data.progress.startDate));
                }

                // localStorage'ı da güncelle
                localStorage.setItem('completedDays', JSON.stringify(data.progress.completedDays || []));
                localStorage.setItem('completedExercises', JSON.stringify(data.progress.completedExercises || {}));
                if (data.progress.startDate) {
                  localStorage.setItem('programStartDate', data.progress.startDate);
                }
                localStorage.setItem('progressUpdatedAt', firebaseProgressTimestamp);
              }
            } else {
              console.log('   ℹ️  Firebase\'de ilerleme verisi yok, localStorage verisi korunuyor.');
            }

            // Ayarlar varsa yükle
            if (data.settings) {
              setReminderSettings({
                enabled: data.settings.reminderSettings?.enabled || false,
                times: sanitizeTimes(data.settings.reminderSettings?.times),
                soundType: data.settings.reminderSettings?.soundType || 'beep3x'
              });
            }
          }
        } catch (error) {
          console.error('Firestore veri yükleme hatası:', error);
        }
      } else {
        // Kullanıcı çıkış yaptı
        setUser(null);
      }
    });

    return () => unsubscribe();
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
      const now = new Date();
      console.log('🔔 Hatırlatma kontrolü:', now.toLocaleTimeString('tr-TR'), '| Hatırlatmalar:', reminderSettings.enabled ? 'AÇIK' : 'KAPALI');

      if (!reminderSettings.enabled) {
        console.log('❌ Hatırlatmalar kapalı');
        return;
      }

      if (!todaysWorkout) {
        console.log('❌ Bugünkü antrenman yok');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.log('❌ Bildirim izni yok (Ayarlar > Hatırlatmalar > Test Bildirimi ile izin verin)');
        return;
      }

      if (completedDays.includes(todaysWorkout.day)) {
        console.log('✅ Gün zaten tamamlanmış - bildirim gerekmez');
        return;
      }

      const currentTime = getCurrentTimeString();
      console.log('⏰ Şu anki saat:', currentTime, '| Ayarlı saatler:', reminderSettings.times.join(', '));

      const isReminderTime = reminderSettings.times.includes(currentTime);
      console.log('🎯 Saat eşleşmesi:', isReminderTime ? 'EVET ✓' : 'HAYIR ✗');

      if (!isReminderTime) {
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

    // Her 20 saniyede bir kontrol et (daha güvenilir)
    const intervalId = setInterval(checkAndNotify, 20 * 1000);
    // İlk kontrolü hemen yap
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

  const handleAuthSuccess = (firebaseUser) => {
    setUser(firebaseUser);
    setIsAuthModalOpen(false);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Çıkış yapmak istediğinize emin misiniz?');
    if (!confirmed) return;

    const result = await logout();
    if (result.success) {
      setUser(null);
      alert('✅ Başarıyla çıkış yaptınız.');
    } else {
      alert('❌ Çıkış yapılırken bir hata oluştu.');
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-bar">
          <div className="header-content">
            <h1>💪 30 Gün Fit</h1>
            <p className="subtitle">
              Size Özel Fitness Programı · {userProfile.name}
              {user && <span style={{ marginLeft: '8px', opacity: 0.7 }}>({user.email})</span>}
            </p>
          </div>
          <div className="header-actions">
            {user ? (
              <button
                type="button"
                className="action-btn"
                onClick={handleLogout}
                style={{ background: 'linear-gradient(135deg, #f44336, #e53935)' }}
              >
                Çıkış Yap
              </button>
            ) : (
              <button
                type="button"
                className="action-btn"
                onClick={() => setIsAuthModalOpen(true)}
                style={{ background: 'linear-gradient(135deg, #4CAF50, #45a049)' }}
              >
                Giriş Yap
              </button>
            )}
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
        {/* Tab Navigation - mobilde alt sabit bar, masaüstünde üst bar (bkz. App.css) */}
        <nav className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="tab-btn-icon">🏠</span>
            <span className="tab-btn-label">Bugün</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <span className="tab-btn-icon">📅</span>
            <span className="tab-btn-label">Program</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'nutrition' ? 'active' : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            <span className="tab-btn-icon">🍎</span>
            <span className="tab-btn-label">Beslenme</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <span className="tab-btn-icon">📊</span>
            <span className="tab-btn-label">İlerleme</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'more' ? 'active' : ''}`}
            onClick={() => setActiveTab('more')}
          >
            <span className="tab-btn-icon">☰</span>
            <span className="tab-btn-label">Daha Fazla</span>
          </button>
        </nav>

        {/* Ana Sayfa Tab */}
        {activeTab === 'home' && (
          <div className="tab-content">
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

            {/* Bugünün Programı */}
            <div className="today-workout-section">
              <h2>Bugünün Programı</h2>
              <div className="detail-section" ref={detailSectionRef}>
                {todaysWorkout ? (
                  <DayDetail
                    workout={todaysWorkout}
                    completedExercises={completedExercises}
                    onToggleExercise={toggleExerciseComplete}
                    onToggleDayComplete={() => toggleDayComplete(todaysWorkout.day)}
                    isDayComplete={completedDays.includes(todaysWorkout.day)}
                  />
                ) : (
                  <div className="no-selection">
                    <p>Program tamamlandı! Tebrikler! 🎉</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* İlerlemem Tab (Genel Bakış) */}
        {activeTab === 'stats' && (
          <div className="tab-content">
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
            </div>

            {/* Kilo Takibi */}
            <div className="dashboard-sections" style={{ marginTop: '28px' }}>
              <WeightTracker user={user} />
            </div>

            {/* İlerleme Fotoğrafları */}
            <div style={{ marginTop: '28px' }}>
              <ProgressPhotos />
            </div>

            {/* Vücut Ölçüleri ve Kompozisyon */}
            <div className="dashboard-sections" style={{ marginTop: '28px' }}>
              <BodyMeasurements />
              <BodyComposition />
            </div>
          </div>
        )}

        {/* Takvim Tab */}
        {activeTab === 'calendar' && (
          <div className="tab-content">
            <div className="two-column-grid">
              <div className="calendar-section">
                <h2>Program Takvimi</h2>
                <Calendar
                  workouts={userProgram}
                  completedDays={completedDays}
                  onDayClick={handleDayClick}
                  selectedDay={selectedDay}
                  completedExercises={completedExercises}
                />
              </div>

              <div className="detail-section">
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
                    <p>Bir gün seçerek detayları görün</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Daha Fazla Tab - alt menü: Ayarlar / Video Portal */}
        {activeTab === 'more' && (
          <div className="tab-content">
            {!moreSection && (
              <div className="more-menu">
                <button className="more-menu-item" onClick={() => setMoreSection('settings')}>
                  <span className="more-menu-icon">⚙️</span>
                  <span className="more-menu-text">
                    <strong>Ayarlar</strong>
                    <small>Profil, hatırlatmalar, yedekleme</small>
                  </span>
                  <span className="more-menu-arrow">›</span>
                </button>
                <button className="more-menu-item" onClick={() => setMoreSection('videos')}>
                  <span className="more-menu-icon">🎥</span>
                  <span className="more-menu-text">
                    <strong>Video Portal</strong>
                    <small>Egzersiz videolarını yönet</small>
                  </span>
                  <span className="more-menu-arrow">›</span>
                </button>
              </div>
            )}

            {moreSection && (
              <>
                <button className="more-back-btn" onClick={() => setMoreSection(null)}>
                  ‹ Daha Fazla
                </button>

                {moreSection === 'settings' && (
                  <div className="dashboard-sections">
                    <ProfileSettings
                      profile={userProfile}
                      onSave={handleProfileSave}
                      onRegenerateProgram={handleRegenerateProgram}
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
                )}

                {moreSection === 'videos' && (
                  <VideoManager onSave={handleVideoSave} />
                )}
              </>
            )}
          </div>
        )}

        {/* Beslenme Tab */}
        {activeTab === 'nutrition' && (
          <div className="tab-content">
            <NutritionDashboard
              userProfile={userProfile}
              user={user}
              driveAccessToken={driveAccessToken}
              onRequestDriveAccess={async () => {
                await loginWithGoogle();
              }}
            />
          </div>
        )}
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* iOS Ana Ekrana Ekle Prompt */}
      <IOSInstallPrompt />
    </div>
  );
}

export default App;
