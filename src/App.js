import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ThemeToggle from './components/ThemeToggle';
import AuthModal from './components/AuthModal';
import { playNotificationSound } from './utils/notificationSounds';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { logout, handleGoogleRedirectResult, requestGoogleDriveAccess } from './firebase/authService';
import { getAllUserData, saveUserProfile, saveUserSettings, getDailyLogsRange, getCalorieTrackingRange, getWaterTracker } from './firebase/dataService';
import { getScopedJson, setScopedJson } from './utils/userScopedStorage';
import { getCachedPeriodTracker, getPeriodTracker } from './firebase/periodService';
import { getCycleNotification, getPredictions, todayKey } from './utils/cycleMath';

const ReportSettings = lazy(() => import('./components/ReportSettings'));
const DailyMotivation = lazy(() => import('./components/DailyMotivation'));
const ProfileSettings = lazy(() => import('./components/ProfileSettings'));
const WorkoutLog = lazy(() => import('./components/WorkoutLog'));
const PeriodTracker = lazy(() => import('./components/PeriodTracker'));
const NutritionDashboard = lazy(() => import('./components/NutritionDashboard'));
const TrendView = lazy(() => import('./components/TrendView'));
const WeightTracker = lazy(() => import('./components/WeightTracker'));
const ScaleMetrics = lazy(() => import('./components/ScaleMetrics'));
const SleepTracker = lazy(() => import('./components/SleepTracker'));
const TodaySummary = lazy(() => import('./components/TodaySummary'));
const ReportView = lazy(() => import('./components/ReportView'));
const BodyMeasurements = lazy(() => import('./components/BodyMeasurements'));
const IOSInstallPrompt = lazy(() => import('./components/IOSInstallPrompt'));

// Haftalık rapor e-postası GitHub Actions cron'u ile Pazar 12:00'de (Europe/Istanbul)
// gönderilir; uygulama içi bildirim de aynı anı kullanır.
const WEEKLY_REPORT_DAY = 0;
const WEEKLY_REPORT_HOUR = 12;

const DEFAULT_REMINDERS = {
  enabled: false,
  times: ['20:00'],
  soundType: 'phoneRing',
  weeklyReportEnabled: true
};

const DEFAULT_PROFILE = {
  name: '',
  age: 25,
  weight: 70,
  height: 170,
  gender: '',
  goal: 'general_fitness',
  bmi: 24.2
};

const THEME_STORAGE_KEY = 'appTheme';
const PROFILE_STORAGE_KEY = 'userProfile';
// Regl takibi profildeki cinsiyete göre açılır. Cinsiyet henüz seçilmemiş ama
// kayıt varsa özellik kapanmasın diye mevcut veri de kontrol ediliyor.
const isFemaleProfile = (profile) => (profile?.gender || '').toLowerCase() === 'female';

const resolveInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (error) { /* ignore */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

const getCurrentTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const LoadingPanel = () => <div className="lazy-loading-panel">Yükleniyor...</div>;

const dateKey = (date) => date.toISOString().split('T')[0];

const datesFromAccountStart = (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rawCreatedAt = user?.metadata?.creationTime;
  const start = rawCreatedAt ? new Date(rawCreatedAt) : new Date(today.getFullYear(), 0, 1);
  if (Number.isNaN(start.getTime())) start.setTime(new Date(today.getFullYear(), 0, 1).getTime());
  start.setHours(0, 0, 0, 0);
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

// Tüm dailyLogs içinden antrenman kaydedilen günleri bul
const computeWorkoutStats = (logsByDate, dates) => {
  const workoutDates = dates.filter((d) => (logsByDate[d]?.workouts || []).some(
    (w) => (w.exercises && w.exercises.length > 0) || w.title || w.duration_min
  ));
  const count = workoutDates.length;
  // Streak: bugünden (veya dünden) geriye ardışık antrenman günleri
  const set = new Set(workoutDates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Bugün yoksa dünden başla (bugün henüz antrenman girilmemiş olabilir)
  const todayStr = cursor.toISOString().split('T')[0];
  if (!set.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().split('T')[0];
    if (set.has(key)) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return { count, streak };
};

const hasDailyLogData = (log = {}) =>
  !!(
    log.sleep ||
    log.notes ||
    log.vitals ||
    (log.workouts || []).length > 0 ||
    (log.supplements || []).length > 0
  );

const computeDailyDataStats = (logsByDate, caloriesByDate, waterEntries, dates) => {
  const waterDates = new Set((waterEntries || []).map((entry) => entry.date));
  const dataDates = dates.filter((date) => {
    const meals = caloriesByDate[date]?.meals || [];
    return meals.length > 0 || waterDates.has(date) || hasDailyLogData(logsByDate[date]);
  });
  const set = new Set(dataDates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayStr = cursor.toISOString().split('T')[0];
  if (!set.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().split('T')[0];
    if (set.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return { count: dataDates.length, streak };
};

function App() {
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
  const [authChecked, setAuthChecked] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'workout' | 'nutrition' | 'stats' | 'settings'
  const [openStatsSections, setOpenStatsSections] = useState({
    trend: true,
    weight: false,
    sleep: false,
    scale: false,
    measurements: false
  });

  const [userProfile, setUserProfile] = useState(() => {
    return { ...DEFAULT_PROFILE };
  });
  const [profileReady, setProfileReady] = useState(false);

  const [reminderSettings, setReminderSettings] = useState(() => {
    return { ...DEFAULT_REMINDERS };
  });
  const [settingsReady, setSettingsReady] = useState(false);

  const [workoutStreak, setWorkoutStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [dataStreak, setDataStreak] = useState(0);
  const [dataDayCount, setDataDayCount] = useState(0);
  const lastReminderRef = useRef({});
  const [hasCycleData, setHasCycleData] = useState(false);
  const showCycleTab = isFemaleProfile(userProfile) || hasCycleData;

  // Tema kalıcılığı
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (error) { /* ignore */ }
  }, [theme]);

  // Hatırlatma ayarları kalıcılığı (+ Firestore)
  useEffect(() => {
    if (!user || !settingsReady) return;
    setScopedJson('reminderSettings', user.uid, reminderSettings);
    if (user) {
      saveUserSettings(user.uid, { reminderSettings, theme }).catch((e) => console.error('Settings save error:', e));
    }
  }, [reminderSettings, user, theme, settingsReady]);

  // Profil kalıcılığı (+ Firestore)
  useEffect(() => {
    if (!user || !profileReady) return;
    setScopedJson(PROFILE_STORAGE_KEY, user.uid, userProfile);
    if (user) {
      saveUserProfile(user.uid, userProfile).catch((e) => console.error('Profile save error:', e));
    }
  }, [userProfile, user, profileReady]);

  // Antrenman ve kayıt streak/sayısı (tüm geçmiş)
  const loadWorkoutStats = useCallback(async () => {
    if (!user) return;
    const dates = datesFromAccountStart(user);
    try {
      const [logs, calories, water] = await Promise.all([
        getDailyLogsRange(user.uid, dates),
        getCalorieTrackingRange(user.uid, dates),
        getWaterTracker(user.uid)
      ]);
      const waterEntries = water.success ? water.data.entries || [] : [];
      const allDates = Array.from(new Set([
        ...dates,
        ...waterEntries.map((entry) => entry.date).filter(Boolean)
      ])).sort();
      const { count, streak } = computeWorkoutStats(logs, allDates);
      const dataStats = computeDailyDataStats(logs, calories, waterEntries, allDates);
      setWorkoutCount(count);
      setWorkoutStreak(streak);
      setDataDayCount(dataStats.count);
      setDataStreak(dataStats.streak);
    } catch (e) { /* yoksay */ }
  }, [user]);

  useEffect(() => { loadWorkoutStats(); }, [loadWorkoutStats, activeTab]);

  useEffect(() => {
    if (!profileReady) return;
    if (activeTab === 'period' && !showCycleTab) setActiveTab('home');
  }, [activeTab, showCycleTab, profileReady]);

  // Yerel önbellekte regl kaydı varsa sekme cinsiyet seçilmemiş olsa da açık kalsın
  useEffect(() => {
    if (!user) { setHasCycleData(false); return; }
    try {
      setHasCycleData((getCachedPeriodTracker(user.uid).entries || []).length > 0);
    } catch (error) {
      setHasCycleData(false);
    }
  }, [user]);

  // Firebase auth listener - sadece profil + ayarları yükler (program yok)
  useEffect(() => {
    const redirectResultPromise = handleGoogleRedirectResult().then((result) => {
      if (result?.driveAccessToken) setDriveAccessToken(result.driveAccessToken);
      return result;
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      await redirectResultPromise;

      if (firebaseUser) {
        setProfileReady(false);
        setSettingsReady(false);
        setUser(firebaseUser);
        const cachedProfile = getScopedJson(PROFILE_STORAGE_KEY, firebaseUser.uid, null);
        const cachedSettings = getScopedJson('reminderSettings', firebaseUser.uid, null);
        setUserProfile(cachedProfile || { ...DEFAULT_PROFILE });
        setReminderSettings(cachedSettings ? {
          ...DEFAULT_REMINDERS,
          ...cachedSettings,
          enabled: Boolean(cachedSettings.enabled),
          times: sanitizeTimes(cachedSettings.times)
        } : { ...DEFAULT_REMINDERS });
        try {
          const result = await getAllUserData(firebaseUser.uid);
          if (result.success) {
            const data = result.data;
            if (data.profile) setUserProfile(data.profile);
            if (data.settings) {
              setReminderSettings({
                ...DEFAULT_REMINDERS,
                ...(data.settings.reminderSettings || {}),
                enabled: Boolean(data.settings.reminderSettings?.enabled),
                times: sanitizeTimes(data.settings.reminderSettings?.times)
              });
            }
          }
        } catch (error) {
          console.error('Firestore veri yükleme hatası:', error);
        } finally {
          setProfileReady(true);
          setSettingsReady(true);
        }
      } else {
        setUser(null);
        setProfileReady(false);
        setSettingsReady(false);
        setUserProfile({ ...DEFAULT_PROFILE });
        setReminderSettings({ ...DEFAULT_REMINDERS });
      }
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // Hatırlatma bildirim döngüsü - program bağımsız, jenerik mesaj
  useEffect(() => {
    if (!reminderSettings.enabled || !notificationsSupported) return undefined;
    if (Notification.permission === 'default') Notification.requestPermission();

    const checkAndNotify = () => {
      if (!reminderSettings.enabled || Notification.permission !== 'granted') return;
      const currentTime = getCurrentTimeString();
      if (!reminderSettings.times.includes(currentTime)) return;
      const key = `${new Date().toISOString().split('T')[0]}-${currentTime}`;
      if (lastReminderRef.current[key]) return;

      new Notification('💪 30 Gün Fit', {
        body: 'Günlüğünü güncellemeyi unutma: öğün, su, antrenman, uyku 💪',
        icon: '/logo192.png'
      });
      playNotificationSound(reminderSettings.soundType);
      lastReminderRef.current[key] = true;
    };

    const intervalId = setInterval(checkAndNotify, 20 * 1000);
    checkAndNotify();
    return () => clearInterval(intervalId);
  }, [reminderSettings, notificationsSupported]);

  // Pazar 12:00 haftalık rapor hatırlatması (en iyi çaba - uygulama açıkken/açılışında).
  // Saat e-posta cron'u ile aynı tutulur; kullanıcıya seçtirilmez, çünkü mail sabit saatte gider.
  useEffect(() => {
    if (!user || !notificationsSupported) return undefined;
    if (reminderSettings.weeklyReportEnabled === false) return undefined;

    const check = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      if (now.getDay() !== WEEKLY_REPORT_DAY) return;
      if (now.getHours() < WEEKLY_REPORT_HOUR) return;
      // O haftaya ait Pazar tarihini anahtar yap
      const key = `weeklyReport-${user.uid}-${now.toISOString().split('T')[0]}`;
      if (localStorage.getItem(key)) return;
      new Notification('📊 Haftalık Raporun Hazır', {
        body: 'Bu haftanın özetine göz at: antrenman, beslenme, uyku ve kilo. İlerleme sekmesi → Rapor.',
        icon: '/logo192.png'
      });
      localStorage.setItem(key, '1');
    };

    check();
    const id = setInterval(check, 5 * 60 * 1000); // 5 dk'da bir kontrol
    return () => clearInterval(id);
  }, [user, notificationsSupported, reminderSettings]);

  // Regl hatırlatması: tahmini tarihe yaklaşınca veya gecikince günde bir bildirim
  useEffect(() => {
    if (!user || !showCycleTab || !notificationsSupported) return undefined;

    let cancelled = false;
    let periodData = getCachedPeriodTracker(user.uid);

    const check = () => {
      if (Notification.permission !== 'granted') return;
      if (periodData.settings.notifyEnabled === false) return;
      const predictions = getPredictions(periodData.entries, periodData.settings);
      const message = getCycleNotification(predictions, {
        notifyBeforeDays: periodData.settings.notifyBeforeDays
      });
      if (!message) return;
      const key = `periodReminder-${user.uid}-${todayKey()}-${message.kind}`;
      if (localStorage.getItem(key)) return;
      new Notification(message.title, { body: message.body, icon: '/logo192.png' });
      localStorage.setItem(key, '1');
    };

    check(); // önce önbellek, sonra Firestore'dan tazele
    getPeriodTracker(user.uid)
      .then((data) => {
        if (cancelled) return;
        periodData = data;
        check();
      })
      .catch(() => { /* yoksay */ });

    const id = setInterval(check, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, showCycleTab, notificationsSupported]);

  const handleReminderChange = (nextSettings) => {
    setReminderSettings({
      ...DEFAULT_REMINDERS,
      ...nextSettings,
      enabled: Boolean(nextSettings.enabled),
      times: sanitizeTimes(nextSettings.times),
      soundType: nextSettings.soundType || 'beep3x'
    });
    setSettingsReady(true);
  };

  const handleThemeToggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const handleProfileSave = (updatedProfile) => {
    setProfileReady(true);
    setUserProfile(updatedProfile);
  };
  const handleAuthSuccess = (firebaseUser) => {
    setUser(firebaseUser);
    setIsAuthModalOpen(false);
  };

  const handleRequestDriveAccess = async () => {
    const result = await requestGoogleDriveAccess();
    if (result?.driveAccessToken) setDriveAccessToken(result.driveAccessToken);
    return result;
  };

  const handleLogout = async () => {
    if (!window.confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
    const result = await logout();
    if (result.success) {
      setUser(null);
      alert('✅ Başarıyla çıkış yaptınız.');
    } else {
      alert('❌ Çıkış yapılırken bir hata oluştu.');
    }
  };

  const toggleStatsSection = (key) => {
    setOpenStatsSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderStatsSection = (key, title, subtitle, children) => {
    const isOpen = Boolean(openStatsSections[key]);
    return (
      <section className={`stats-accordion ${isOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="stats-accordion-head"
          onClick={(event) => {
            event.preventDefault();
            toggleStatsSection(key);
          }}
          aria-expanded={isOpen}
        >
          <span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
          <b>{isOpen ? 'Kapat' : 'Aç'}</b>
        </button>
        <div className="stats-accordion-body" aria-hidden={!isOpen}>
          {children}
        </div>
      </section>
    );
  };

  if (!authChecked) {
    return <div className="App" />;
  }

  if (!user) {
    return (
      <div className="App">
        <div className="login-gate">
          <div className="login-gate-card">
            <h1>💪 30 Gün Fit</h1>
            <p>Bu uygulamayı kullanmak için giriş yapmanız gerekiyor.</p>
          </div>
        </div>
        <AuthModal isOpen={true} onClose={() => {}} onAuthSuccess={handleAuthSuccess} hideCloseButton />
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-bar">
          <div className="header-content">
            <h1>💪 30 Gün Fit</h1>
            <p className="subtitle">
              Kişisel Sağlık Asistanı · {
                userProfile.name && userProfile.name !== 'Misafir'
                  ? userProfile.name
                  : (user?.displayName || user?.email?.split('@')[0] || '')
              }
              {user && <span style={{ marginLeft: '8px', opacity: 0.7 }}>({user.email})</span>}
            </p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleLogout}
              style={{ background: 'linear-gradient(135deg, #f44336, #e53935)' }}
            >
              Çıkış Yap
            </button>
            <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Alt sabit navigasyon (mobil) / üst bar (masaüstü) */}
        <nav className="tab-navigation">
          <button className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="tab-btn-icon">🏠</span>
            <span className="tab-btn-label">Panel</span>
          </button>
          <button className={`tab-btn ${activeTab === 'workout' ? 'active' : ''}`} onClick={() => setActiveTab('workout')}>
            <span className="tab-btn-icon">🏋️</span>
            <span className="tab-btn-label">Antrenman</span>
          </button>
          {showCycleTab && (
            <button className={`tab-btn ${activeTab === 'period' ? 'active' : ''}`} onClick={() => setActiveTab('period')}>
              <span className="tab-btn-icon">🌙</span>
              <span className="tab-btn-label">Regl</span>
            </button>
          )}
          <button className={`tab-btn ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
            <span className="tab-btn-icon">🍎</span>
            <span className="tab-btn-label">Beslenme</span>
          </button>
          <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
            <span className="tab-btn-icon">📊</span>
            <span className="tab-btn-label">İlerleme</span>
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="tab-btn-icon">⚙️</span>
            <span className="tab-btn-label">Ayarlar</span>
          </button>
        </nav>

        <Suspense fallback={<LoadingPanel />}>
          {/* Panel (Dashboard) - bugün + hafta/ay rapor + günün sözü */}
          {activeTab === 'home' && (
            <div className="tab-content">
              <TodaySummary user={user} />
              <ReportView user={user} />
              <DailyMotivation
                streak={workoutStreak}
                workoutCount={workoutCount}
                dataStreak={dataStreak}
                dataDayCount={dataDayCount}
              />
            </div>
          )}

        {/* Antrenman */}
          {activeTab === 'workout' && (
            <div className="tab-content">
              <WorkoutLog user={user} />
            </div>
          )}

          {activeTab === 'period' && showCycleTab && (
            <div className="tab-content">
              <PeriodTracker user={user} />
            </div>
          )}

        {/* İlerleme - vücut takibi veri girişi */}
          {activeTab === 'stats' && (
            <div className="tab-content stats-tab-content">
              <div className="stats-accordion-list">
                {renderStatsSection(
                  'trend',
                  '📈 Genel İlerleme',
                  'Trend, uyum skoru, hedef rotası ve günlük eğilimler',
                  <TrendView user={user} />
                )}
                <div className="stats-accordion-grid">
                  {renderStatsSection(
                    'weight',
                    '⚖️ Kilo Takibi',
                    'Kilo geçmişi, hedef kilo ve kilo grafiği',
                    <WeightTracker user={user} initialWeight={userProfile?.weight} />
                  )}
                  {renderStatsSection(
                    'sleep',
                    '😴 Uyku Takibi',
                    'Uyku kayıtları, ortalama ve toparlanma verileri',
                    <SleepTracker user={user} />
                  )}
                </div>
                <div className="stats-accordion-grid">
                  {renderStatsSection(
                    'scale',
                    '⚖️ Tartı Verileri',
                    'OKOK verileri, tüm ölçümler ve metrik grafikleri',
                    <ScaleMetrics user={user} />
                  )}
                  {renderStatsSection(
                    'measurements',
                    '📏 Vücut Ölçüleri',
                    'Vücut ölçüleri, ana kartlar ve geçmiş kayıtları',
                    <BodyMeasurements user={user} />
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Ayarlar */}
          {activeTab === 'settings' && (
            <div className="tab-content">
              <div className="dashboard-sections">
                <ProfileSettings profile={userProfile} onSave={handleProfileSave} />
                <ReportSettings
                  settings={reminderSettings}
                  onChange={handleReminderChange}
                  notificationsSupported={notificationsSupported}
                />
              </div>
            </div>
          )}

        {/* Beslenme */}
          {activeTab === 'nutrition' && (
            <div className="tab-content">
              <NutritionDashboard
                userProfile={userProfile}
                user={user}
                driveAccessToken={driveAccessToken}
                onRequestDriveAccess={handleRequestDriveAccess}
              />
            </div>
          )}
        </Suspense>
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <Suspense fallback={null}>
        <IOSInstallPrompt />
      </Suspense>
    </div>
  );
}

export default App;
