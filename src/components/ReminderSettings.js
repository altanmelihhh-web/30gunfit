import React, { useMemo, useState, useEffect } from 'react';
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
  // Local state ile değişiklikleri tut
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Props'tan gelen settings değişince local'i güncelle
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleToggle = () => {
    const newSettings = { ...localSettings, enabled: !localSettings.enabled };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleTimeChange = (index, hour, minute) => {
    const newTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const times = localSettings.times.map((time, idx) => (idx === index ? newTime : time));
    setLocalSettings({ ...localSettings, times });
    setHasChanges(true);
  };

  const handleSoundChange = (event) => {
    setLocalSettings({ ...localSettings, soundType: event.target.value });
    setHasChanges(true);
  };

  const handleSave = () => {
    onChange(localSettings);
    setHasChanges(false);
    setSaveMessage('✅ Kaydedildi!');

    // 2 saniye sonra mesajı temizle
    setTimeout(() => {
      setSaveMessage('');
    }, 2000);
  };

  const handlePreviewSound = (soundType) => {
    playNotificationSound(soundType);
  };

  const handleAddTime = () => {
    const times = [...localSettings.times, '21:00'];
    setLocalSettings({ ...localSettings, times });
    setHasChanges(true);
  };

  const handleRemoveTime = (index) => {
    if (localSettings.times.length === 1) return;
    const times = localSettings.times.filter((_, idx) => idx !== index);
    setLocalSettings({ ...localSettings, times });
    setHasChanges(true);
  };

  const handleStartDateChange = (event) => {
    const { value } = event.target;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      onStartDateChange(parsed);
    }
  };

  const handleTestNotification = () => {
    console.log('🧪 Test bildirimi başlatıldı...');
    console.log('📍 window.location:', window.location.href);
    console.log('🔐 HTTPS mi?', window.location.protocol === 'https:');
    console.log('🏠 Localhost mu?', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Bildirim API'si var mı?
    if (!('Notification' in window)) {
      console.error('❌ Notification API bulunamadı');
      alert('❌ Bu tarayıcı bildirimleri desteklemiyor!\n\nTarayıcı: ' + navigator.userAgent);
      return;
    }

    console.log('✅ Notification API mevcut');
    console.log('🔔 Mevcut izin durumu:', Notification.permission);

    // HTTPS kontrolü (localhost hariç)
    const isLocalhost = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '[::1]';
    const isHTTPS = window.location.protocol === 'https:';

    if (!isHTTPS && !isLocalhost) {
      alert('❌ Web bildirimleri sadece HTTPS sitelerinde çalışır!\n\n' +
            'Şu anda: ' + window.location.protocol + '\n' +
            'Gerekli: https://\n\n' +
            'Canlı siteyi (https://...) kullanın.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('❌ Bildirim izni reddedilmiş!\n\n' +
            'Tarayıcı ayarlarından izin vermeniz gerekiyor:\n\n' +
            'Chrome: Ayarlar > Gizlilik ve güvenlik > Site ayarları > Bildirimler\n' +
            'Safari: Sistem Tercihleri > Bildirimler > [Tarayıcı]');
      return;
    }

    if (Notification.permission === 'default') {
      console.log('📋 İzin isteniyor...');
      Notification.requestPermission().then((permission) => {
        console.log('📋 İzin sonucu:', permission);
        if (permission === 'granted') {
          sendTestNotification();
        } else {
          alert('❌ Bildirim izni verilmedi!\n\nİzin durumu: ' + permission);
        }
      }).catch((error) => {
        console.error('❌ İzin hatası:', error);
        alert('❌ İzin isteği başarısız: ' + error.message);
      });
    } else {
      console.log('✅ İzin zaten verilmiş, bildirim gönderiliyor...');
      sendTestNotification();
    }
  };

  const sendTestNotification = () => {
    try {
      console.log('📤 Bildirim oluşturuluyor...');
      const notification = new Notification('🧪 Test Bildirimi - 30 Gün Fit', {
        body: 'Tebrikler! Bildirim sistemi çalışıyor! ✅',
        icon: '/logo192.png',
        badge: '/logo192.png',
        requireInteraction: false,
        silent: false
      });

      console.log('✅ Bildirim objesi oluşturuldu:', notification);

      // Bildirim olaylarını dinle
      notification.onshow = () => console.log('✅ Bildirim gösterildi');
      notification.onerror = (e) => console.error('❌ Bildirim hatası:', e);
      notification.onclose = () => console.log('🔔 Bildirim kapatıldı');

      // Seçili bildirim sesini çal
      playNotificationSound(localSettings.soundType || 'phoneRing');

      alert('✅ Bildirim gönderildi!\n\nEkranınızın sağ üst köşesini kontrol edin.\n\n' +
            '(Bildirim gösterimi birkaç saniye sürebilir)');
    } catch (error) {
      console.error('❌ Bildirim hatası:', error);
      alert('❌ Bildirim gönderilemedi!\n\n' +
            'Hata: ' + error.message + '\n\n' +
            'Tarayıcı: ' + navigator.userAgent);
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
          {saveMessage && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '600',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              {saveMessage}
            </div>
          )}
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={localSettings.enabled}
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
            {localSettings.times.map((time, index) => {
              const [hour, minute] = time.split(':');
              return (
                <div key={time + index} className="time-row">
                  <div className="time-picker-wrapper">
                    <select
                      value={hour}
                      onChange={(e) => handleTimeChange(index, e.target.value, minute)}
                      disabled={!localSettings.enabled}
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
                      disabled={!localSettings.enabled}
                      className="time-select"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {localSettings.times.length > 1 && (
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveTime(index)}
                      disabled={!localSettings.enabled}
                    >
                      Sil
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {localSettings.times.length < 4 && (
            <button
              type="button"
              className="add-btn"
              onClick={handleAddTime}
              disabled={!localSettings.enabled}
            >
              Saat Ekle
            </button>
          )}
        </div>

        <div className="reminder-block">
          <span className="block-label">Bildirim Sesi</span>
          <select
            value={localSettings.soundType || 'phoneRing'}
            onChange={handleSoundChange}
            className="sound-select"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              cursor: 'pointer',
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
            onClick={() => handlePreviewSound(localSettings.soundType || 'phoneRing')}
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
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            🔊 Sesi Dinle
          </button>
          <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            {localSettings.enabled
              ? 'Bildirim geldiğinde duyacağınız sesi seçin ve önizleyin'
              : 'Sesi seçin ve önizleyin (hatırlatmaları aktif etmeyi unutmayın)'}
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

        {hasChanges && (
          <div className="reminder-block" style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.35)';
              }}
            >
              💾 Değişiklikleri Kaydet
            </button>
            <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Yaptığınız değişiklikler henüz kaydedilmedi
            </small>
          </div>
        )}

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
