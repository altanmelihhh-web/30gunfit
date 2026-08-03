import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ReminderSettings from './components/ReminderSettings';
import ThemeToggle from './components/ThemeToggle';
import DailyMotivation from './components/DailyMotivation';
import ProfileSettings from './components/ProfileSettings';
import WorkoutLog from './components/WorkoutLog';
import AuthModal from './components/AuthModal';
import NutritionDashboard from './components/NutritionDashboard';
import WeightTracker from './components/WeightTracker';
import SleepTracker from './components/SleepTracker';
import TodaySummary from './components/TodaySummary';
import ReportView from './components/ReportView';
import ProgressPhotos from './components/ProgressPhotos';
import BodyMeasurements from './components/BodyMeasurements';
import BodyComposition from './components/BodyComposition';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import { playNotificationSound } from './utils/notificationSounds';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { logout, handleGoogleRedirectResult, loginWithGoogle } from './firebase/authService';
import { getAllUserData, saveUserProfile, saveUserSettings, getDailyLogsRange } from './firebase/dataService';

// Bu kişisel uygulamayı sadece bu hesaplar kullanabilir
const ALLOWED_EMAILS = ['altanmelihhh@gmail.com', 'emineay12@gmail.com'];

const DEFAULT_REMINDERS = {
  enabled: false,
  times: ['09:00', '13:00', '20:00'],
  soundType: 'phoneRing'
};

const DEFAULT_PROFILE = {
  name: '',
  age: 25,
  weight: 70,
  height: 170,
  gender: 'male',
  goal: 'general_fitness',
  bmi: 24.2
};

const THEME_STORAGE_KEY = 'appTheme';
const PROFILE_STORAGE_KEY = 'userProfile';

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

// Son N günün dailyLogs'undan antrenman kaydedilen günleri bul
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

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) { /* ignore */ }
    return { ...DEFAULT_PROFILE };
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
    } catch (error) { /* ignore */ }
    return { ...DEFAULT_REMINDERS };
  });

  const [workoutStreak, setWorkoutStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const lastReminderRef = useRef({});

  // Tema kalıcılığı
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (error) { /* ignore */ }
  }, [theme]);

  // Hatırlatma ayarları kalıcılığı (+ Firestore)
  useEffect(() => {
    localStorage.setItem('reminderSettings', JSON.stringify(reminderSettings));
    if (user) {
      saveUserSettings(user.uid, { reminderSettings, theme }).catch((e) => console.error('Settings save error:', e));
    }
  }, [reminderSettings, user, theme]);

  // Profil kalıcılığı (+ Firestore)
  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
    if (user) {
      saveUserProfile(user.uid, userProfile).catch((e) => console.error('Profile save error:', e));
    }
  }, [userProfile, user]);

  // Antrenman streak/sayısı (son 60 gün)
  const loadWorkoutStats = useCallback(async () => {
    if (!user) return;
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    try {
      const logs = await getDailyLogsRange(user.uid, dates);
      const { count, streak } = computeWorkoutStats(logs, dates);
      setWorkoutCount(count);
      setWorkoutStreak(streak);
    } catch (e) { /* yoksay */ }
  }, [user]);

  useEffect(() => { loadWorkoutStats(); }, [loadWorkoutStats, activeTab]);

  // Firebase auth listener - sadece profil + ayarları yükler (program yok)
  useEffect(() => {
    const redirectResultPromise = handleGoogleRedirectResult().then((result) => {
      if (result?.driveAccessToken) setDriveAccessToken(result.driveAccessToken);
      return result;
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      await redirectResultPromise;

      if (firebaseUser) {
        if (!ALLOWED_EMAILS.includes(firebaseUser.email)) {
          alert('Bu uygulama sadece belirli hesaplara açık. Bu hesapla erişim yetkiniz yok.');
          await logout();
          setUser(null);
          setAuthChecked(true);
          return;
        }
        setUser(firebaseUser);
        try {
          const result = await getAllUserData(firebaseUser.uid);
          if (result.success) {
            const data = result.data;
            if (data.profile) setUserProfile(data.profile);
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
        setUser(null);
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

  // Pazar 12:00 haftalık rapor hatırlatması (en iyi çaba - uygulama açıkken/açılışında)
  useEffect(() => {
    if (!user || !notificationsSupported) return undefined;

    const check = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      if (now.getDay() !== 0 || now.getHours() < 12) return; // Pazar & >=12:00
      // O haftaya ait Pazar tarihini anahtar yap
      const key = `weeklyReport-${now.toISOString().split('T')[0]}`;
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
  }, [user, notificationsSupported]);

  const handleReminderChange = (nextSettings) => {
    setReminderSettings({
      enabled: Boolean(nextSettings.enabled),
      times: sanitizeTimes(nextSettings.times),
      soundType: nextSettings.soundType || 'beep3x'
    });
  };

  const handleThemeToggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const handleProfileSave = (updatedProfile) => setUserProfile(updatedProfile);
  const handleAuthSuccess = (firebaseUser) => { setUser(firebaseUser); setIsAuthModalOpen(false); };

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

        {/* Panel (Dashboard) - bugün + hafta/ay rapor + günün sözü */}
        {activeTab === 'home' && (
          <div className="tab-content">
            <TodaySummary user={user} />
            <ReportView user={user} />
            <DailyMotivation streak={workoutStreak} workoutCount={workoutCount} />
          </div>
        )}

        {/* Antrenman */}
        {activeTab === 'workout' && (
          <div className="tab-content">
            <WorkoutLog user={user} />
          </div>
        )}

        {/* İlerleme - vücut takibi veri girişi */}
        {activeTab === 'stats' && (
          <div className="tab-content">
            <div className="dashboard-sections">
              <WeightTracker user={user} initialWeight={userProfile?.weight} />
              <SleepTracker user={user} />
            </div>
            <div style={{ marginTop: '28px' }}>
              <ProgressPhotos
                user={user}
                driveAccessToken={driveAccessToken}
                onRequestDriveAccess={async () => { await loginWithGoogle(); }}
              />
            </div>
            <div className="dashboard-sections" style={{ marginTop: '28px' }}>
              <BodyMeasurements user={user} />
              <BodyComposition user={user} />
            </div>
          </div>
        )}

        {/* Ayarlar */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <div className="dashboard-sections">
              <ProfileSettings profile={userProfile} onSave={handleProfileSave} />
              <ReminderSettings
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
              onRequestDriveAccess={async () => { await loginWithGoogle(); }}
            />
          </div>
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <IOSInstallPrompt />
    </div>
  );
}

export default App;
