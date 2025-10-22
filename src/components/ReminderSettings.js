import React, { useMemo } from 'react';
import './ReminderSettings.css';
import { playNotificationSound, getSoundOptions } from '../utils/notificationSounds';

const formatTime = (value) => {
  if (!value) return '00:00';
  const [hour = '00', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const formatDateForInput = (date) => {
  if (!date) return '';
  try {
    // Local timezone'da formatla (timezone farkı sorununu önler)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
};

const getTodayKey = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

function ReminderSettings({
  settings,
  onChange,
  startDate,
  onStartDateChange,
  todaysProgress,
  todaysWorkout,
  currentDay,
  notificationsSupported
}) {
  const handleToggle = () => {
    onChange({ ...settings, enabled: !settings.enabled });
  };

  const handleTimeChange = (index, hour, minute) => {
    const newTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const times = settings.times.map((time, idx) => (idx === index ? newTime : time));
    onChange({ ...settings, times });
  };

  const handleSoundChange = (event) => {
    onChange({ ...settings, soundType: event.target.value });
  };

  const handlePreviewSound = (soundType) => {
    playNotificationSound(soundType);
  };

  const handleAddTime = () => {
    const times = [...settings.times, '21:00'];
    onChange({ ...settings, times });
  };

  const handleRemoveTime = (index) => {
    if (settings.times.length === 1) return;
    const times = settings.times.filter((_, idx) => idx !== index);
    onChange({ ...settings, times });
  };

  const handleStartDateChange = (event) => {
    const { value } = event.target;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      onStartDateChange(parsed);
    }
  };

  const handleTestNotification = () => {
    // Bildirim izni kontrol et
    if (!('Notification' in window)) {
      alert('❌ Bu tarayıcı bildirimleri desteklemiyor!');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('❌ Bildirim izni reddedilmiş! Lütfen tarayıcı ayarlarından izin verin.');
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          sendTestNotification();
        } else {
          alert('❌ Bildirim izni verilmedi!');
        }
      });
    } else {
      sendTestNotification();
    }
  };

  const sendTestNotification = () => {
    try {
      new Notification('🧪 Test Bildirimi - 30 Gün Fit', {
        body: 'Tebrikler! Bildirim sistemi çalışıyor! ✅',
        icon: '/logo192.png'
      });

      // Seçili bildirim sesini çal
      playNotificationSound(settings.soundType || 'beep3x');

      alert('✅ Bildirim gönderildi! Ekranınızı kontrol edin.');
    } catch (error) {
      alert('❌ Bildirim gönderilemedi: ' + error.message);
      console.error('Bildirim hatası:', error);
    }
  };

  const reminderMessage = useMemo(() => {
    const percent = todaysProgress?.percent ?? 0;
    const completed = todaysProgress?.completedCount ?? 0;
    const total = todaysProgress?.totalCount ?? 0;
    const workoutTitle = todaysWorkout ? todaysWorkout.title : 'Program';
    return `30 Gün Fit hatırlatma (${getTodayKey()}): Gün ${currentDay} - ${workoutTitle}. İlerleme: %${percent} (${completed}/${total}). Hadi egzersizi tamamla!`;
  }, [todaysProgress, todaysWorkout, currentDay]);

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(reminderMessage)}`;
  const smsLink = `sms:?body=${encodeURIComponent(reminderMessage)}`;

  return (
    <section className="reminder-settings">
      <div className="reminder-header">
        <div>
          <h2>Hatırlatmalar</h2>
          <p>Günde en fazla 3 kez bildirim al. Gün tamamlanmadıysa hatırlatmalar tetiklenir.</p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={handleToggle}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {!notificationsSupported && (
        <div className="reminder-warning">
          Tarayıcınız bildirimleri desteklemiyor. Yine de WhatsApp veya SMS kısa yolunu kullanabilirsiniz.
        </div>
      )}

      <div className="reminder-body">
        <div className="reminder-block">
          <span className="block-label">Bildirim Saatleri</span>
          <div className="time-list">
            {settings.times.map((time, index) => {
              const [hour, minute] = time.split(':');
              return (
                <div key={time + index} className="time-row">
                  <div className="time-picker-wrapper">
                    <select
                      value={hour}
                      onChange={(e) => handleTimeChange(index, e.target.value, minute)}
                      disabled={!settings.enabled}
                      className="time-select"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="time-separator">:</span>
                    <select
                      value={minute}
                      onChange={(e) => handleTimeChange(index, hour, e.target.value)}
                      disabled={!settings.enabled}
                      className="time-select"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {settings.times.length > 1 && (
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveTime(index)}
                      disabled={!settings.enabled}
                    >
                      Sil
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {settings.times.length < 4 && (
            <button
              type="button"
              className="add-btn"
              onClick={handleAddTime}
              disabled={!settings.enabled}
            >
              Saat Ekle
            </button>
          )}
        </div>

        <div className="reminder-block">
          <span className="block-label">Bildirim Sesi</span>
          <select
            value={settings.soundType || 'beep3x'}
            onChange={handleSoundChange}
            disabled={!settings.enabled}
            className="sound-select"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              cursor: settings.enabled ? 'pointer' : 'not-allowed',
              marginBottom: '12px'
            }}
          >
            {getSoundOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.name} - {option.description}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handlePreviewSound(settings.soundType || 'beep3x')}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 3px 10px rgba(139, 92, 246, 0.25)'
            }}
          >
            🔊 Sesi Dinle
          </button>
          <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            Bildirim geldiğinde duyacağınız sesi seçin ve önizleyin
          </small>
        </div>

        <div className="reminder-block">
          <span className="block-label">Bildirim Testi</span>
          <button
            type="button"
            className="test-notification-btn"
            onClick={handleTestNotification}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            🧪 Test Bildirimi Gönder
          </button>
          <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            Bildirim sisteminizin çalışıp çalışmadığını test edin
          </small>
        </div>

        <div className="reminder-block">
          <span className="block-label">Program Başlangıcı</span>
          <input
            type="date"
            value={formatDateForInput(startDate)}
            onChange={handleStartDateChange}
          />
          <small>Bugün: {getTodayKey()} · Gün {currentDay}</small>
          <small style={{ display: 'block', marginTop: '4px', color: 'var(--color-text-muted)' }}>
            İstediğiniz zaman değiştirebilirsiniz
          </small>
        </div>
      </div>

      <div className="share-block">
        <span className="block-label">Elle hatırlatma gönder</span>
        <p className="share-description">
          Kendine veya bir arkadaşına hızlıca mesaj atmak için aşağıdaki kısayolları kullan.
        </p>
        <div className="share-actions">
          <a href={whatsappLink} className="share-btn whatsapp" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a href={smsLink} className="share-btn sms">
            SMS
          </a>
        </div>
        <code className="share-message">{reminderMessage}</code>
      </div>
    </section>
  );
}

export default ReminderSettings;
