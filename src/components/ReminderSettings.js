import React, { useMemo, useState, useEffect } from 'react';
import './ReminderSettings.css';
import { playNotificationSound, getSoundOptions } from '../utils/notificationSounds';

// Mobil cihaz ve işletim sistemi algılama
const getMobileInfo = () => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true;

  return { isIOS, isAndroid, isMobile, isStandalone, userAgent: ua };
};

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

  const handleToggle = async () => {
    const willBeEnabled = !localSettings.enabled;

    // Eğer hatırlatmaları açıyorsa, bildirim izni iste
    if (willBeEnabled && notificationsSupported && 'Notification' in window) {
      if (Notification.permission === 'default') {
        console.log('📋 Hatırlatmalar açılıyor, bildirim izni isteniyor...');

        try {
          const permission = await Notification.requestPermission();
          console.log('📋 İzin sonucu:', permission);

          if (permission === 'granted') {
            // İzin verildi, sesi çal ve kullanıcıyı bilgilendir
            playNotificationSound(localSettings.soundType || 'phoneRing');
            alert('✅ Bildirim izni verildi!\n\nHatırlatmalar aktif edildi.\n\n' +
                  'Artık belirlediğiniz saatlerde bildirim alacaksınız.\n\n' +
                  'Değişiklikleri kaydetmeyi unutmayın!');
          } else if (permission === 'denied') {
            alert('❌ Bildirim izni reddedildi!\n\n' +
                  'Hatırlatmaları kullanmak için tarayıcı ayarlarından bildirim izni vermeniz gerekiyor.\n\n' +
                  'Chrome: Ayarlar > Gizlilik ve güvenlik > Site ayarları > Bildirimler\n' +
                  'Safari: Sistem Tercihleri > Bildirimler');
            // İzin reddedildi ama yine de açabilir, belki sonra izin verir
          }
        } catch (error) {
          console.error('❌ İzin isteme hatası:', error);
          alert('⚠️ Bildirim izni istenemedi.\n\n' +
                'Hata: ' + error.message + '\n\n' +
                'Yine de hatırlatmaları açabilirsiniz.');
        }
      } else if (Notification.permission === 'denied') {
        // Önceden reddedilmiş
        alert('⚠️ Bildirim izni daha önce reddedilmiş.\n\n' +
              'Hatırlatmaları açabilirsiniz ama bildirim almak için tarayıcı ayarlarından izin vermeniz gerekecek.\n\n' +
              'Chrome: Ayarlar > Gizlilik ve güvenlik > Site ayarları > Bildirimler\n' +
              'Safari: Sistem Tercihleri > Bildirimler');
      } else {
        // Zaten izin verilmiş
        console.log('✅ Bildirim izni zaten verilmiş');
      }
    }

    const newSettings = { ...localSettings, enabled: willBeEnabled };
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

  const handleTestNotification = () => {
    console.log('🧪 Test bildirimi başlatıldı...');
    console.log('📍 window.location:', window.location.href);
    console.log('🔐 HTTPS mi?', window.location.protocol === 'https:');
    console.log('🏠 Localhost mu?', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Mobil bilgilerini al
    const mobileInfo = getMobileInfo();
    console.log('📱 Mobil bilgi:', mobileInfo);

    // Bildirim API'si var mı?
    if (!('Notification' in window)) {
      console.error('❌ Notification API bulunamadı');

      // iOS özel mesajı
      if (mobileInfo.isIOS) {
        alert('📱 iPhone/iPad Kullanıcısı\n\n' +
              '❌ Maalesef iOS Safari\'de web bildirimleri tarayıcıdan çalışmıyor.\n' +
              '(Apple\'ın kısıtlaması - iOS 16.4+ gerekli ve PWA modunda olmalı)\n\n' +
              '✅ KOLAY ÇÖZÜM:\n' +
              'Aşağıdaki "WhatsApp" veya "SMS" butonlarını kullanarak kendinize hatırlatma gönderebilirsiniz!\n\n' +
              '💡 Alternatif Yöntemler:\n' +
              '• iPhone Saat uygulamasından alarm kurun\n' +
              '• Takvim\'e hatırlatıcı ekleyin\n' +
              '• Chrome veya Firefox mobil kullanın (bu tarayıcılar iOS\'ta da çalışmaz)\n\n' +
              'Web bildirimleri Mac Safari, Windows/Android Chrome, Firefox\'ta ÇALIŞIR ✅');
      } else if (mobileInfo.isAndroid) {
        alert('📱 Android Kullanıcısı\n\n' +
              '❌ Bu tarayıcı bildirimleri desteklemiyor.\n\n' +
              '✅ ÇOK KOLAY ÇÖZÜM:\n' +
              'Android\'de Chrome veya Firefox kullanın.\n' +
              'Bu tarayıcılarda bildirimler %100 çalışır!\n\n' +
              'Şu an kullandığınız tarayıcı:\n' + mobileInfo.userAgent.substring(0, 60) + '...');
      } else {
        alert('❌ Bu tarayıcı bildirimleri desteklemiyor!\n\n' +
              '✅ Modern tarayıcı kullanın:\n' +
              '• Chrome (önerilen)\n' +
              '• Firefox\n' +
              '• Edge\n' +
              '• Safari (macOS)\n\n' +
              'Tarayıcı: ' + navigator.userAgent.substring(0, 60) + '...');
      }
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

  const reminderMessage = `30 Gün Fit hatırlatma (${getTodayKey()}): Günlüğünü güncellemeyi unutma — öğün, su, antrenman, uyku 💪`;

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(reminderMessage)}`;
  const smsLink = `sms:?body=${encodeURIComponent(reminderMessage)}`;

  // Mobil bilgilerini al
  const mobileInfo = getMobileInfo();

  return (
    <section className="reminder-settings">
      <div className="reminder-header">
        <div>
          <h2>Hatırlatmalar</h2>
          {mobileInfo.isIOS ? (
            <p>iPhone/iPad için manuel hatırlatma seçenekleri aşağıda 👇</p>
          ) : (
            <p>Günde en fazla 3 kez bildirim al. Gün tamamlanmadıysa hatırlatmalar tetiklenir.</p>
          )}
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
        {/* Toggle sadece iOS harici göster */}
        {!mobileInfo.isIOS && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={localSettings.enabled}
              onChange={handleToggle}
            />
            <span className="toggle-slider" />
          </label>
        )}
      </div>

      {!notificationsSupported && mobileInfo.isIOS && (
        <div className="reminder-warning" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <strong style={{ fontSize: '1.1rem' }}>📱 iPhone/iPad Kullanıcısı</strong>
          <p style={{ marginTop: '12px', marginBottom: '4px', fontSize: '0.95rem', lineHeight: '1.5' }}>
            iOS Safari'de web bildirimleri çalışmıyor (Apple kısıtlaması).
          </p>
          <p style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', fontSize: '1rem' }}>
            ✅ ÇÖZÜM: Aşağıdaki butonları kullanın!
          </p>
          <ul style={{ marginLeft: '20px', marginTop: '8px', lineHeight: '1.6' }}>
            <li><strong>WhatsApp/SMS</strong> ile kendinize hatırlatma gönderin 💬</li>
            <li>iPhone Saat uygulamasından alarm kurun ⏰</li>
            <li>Takvim'e hatırlatıcı ekleyin 📅</li>
          </ul>
          <p style={{ marginTop: '12px', fontSize: '0.85rem', opacity: '0.9' }}>
            💡 Mac/PC'den kullanırsanız web bildirimleri çalışır!
          </p>
        </div>
      )}

      {!notificationsSupported && mobileInfo.isAndroid && (
        <div className="reminder-warning" style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <strong style={{ fontSize: '1.1rem' }}>📱 Android Kullanıcısı</strong>
          <p style={{ marginTop: '12px', marginBottom: '8px', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Bu tarayıcı bildirimleri desteklemiyor.
          </p>
          <p style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', fontSize: '1rem' }}>
            ✅ KOLAY ÇÖZÜM:
          </p>
          <p style={{ marginTop: '8px', fontSize: '0.95rem', lineHeight: '1.5' }}>
            <strong>Chrome</strong> veya <strong>Firefox</strong> tarayıcısı kullanın.<br/>
            Bu tarayıcılarda bildirimler %100 çalışır! 🚀
          </p>
          <p style={{ marginTop: '12px', fontSize: '0.85rem', opacity: '0.9' }}>
            💡 Alternatif: WhatsApp/SMS butonlarını kullanabilirsiniz (aşağıda)
          </p>
        </div>
      )}

      {!notificationsSupported && !mobileInfo.isMobile && (
        <div className="reminder-warning">
          Tarayıcınız bildirimleri desteklemiyor. Yine de WhatsApp veya SMS kısa yolunu kullanabilirsiniz.
        </div>
      )}

      <div className="reminder-body">
        {/* iOS kullanıcılarına önce WhatsApp/SMS seçeneğini göster */}
        {mobileInfo.isIOS && (
          <div className="reminder-block" style={{
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <span className="block-label" style={{ color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
              📱 iPhone İçin Önerilen: Manuel Hatırlatma
            </span>
            <p style={{ color: 'white', marginTop: '12px', marginBottom: '16px', lineHeight: '1.6' }}>
              iPhone'da web bildirimleri çalışmadığı için aşağıdaki butonlarla kendinize hatırlatma gönderin:
            </p>
            <div className="share-actions" style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <a
                href={whatsappLink}
                className="share-btn whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  background: '#25D366',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                💬 WhatsApp
              </a>
              <a
                href={smsLink}
                className="share-btn sms"
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  background: '#007AFF',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0, 122, 255, 0.4)',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                📱 SMS
              </a>
            </div>
            <small style={{ display: 'block', marginTop: '12px', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>
              💡 İpucu: Sabah, öğle ve akşam kendinize mesaj gönderin!
            </small>
          </div>
        )}

        {/* iOS'ta bildirim ayarlarını gizle, sadece bilgisayarda göster */}
        {!mobileInfo.isIOS && (
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
        )}

        {/* Bildirim Sesi - sadece iOS harici */}
        {!mobileInfo.isIOS && (
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
        )}

        {/* Bildirim Testi - sadece iOS harici */}
        {!mobileInfo.isIOS && (
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
        )}

        {/* Kaydet Butonu - sadece iOS harici ve değişiklik varsa */}
        {!mobileInfo.isIOS && hasChanges && (
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
