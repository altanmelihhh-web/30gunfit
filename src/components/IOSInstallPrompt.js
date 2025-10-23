import React, { useState, useEffect } from 'react';

const IOSInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // iOS Safari algılama
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // PWA olarak yüklü mü kontrol et
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                                window.navigator.standalone === true;

    // Daha önce kapatıldı mı kontrol et
    const wasDismissed = localStorage.getItem('iosInstallPromptDismissed');

    // iOS + PWA değil + daha önce kapatılmamış
    if (isIOS && !isInStandaloneMode && !wasDismissed) {
      // 3 saniye bekle
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('iosInstallPromptDismissed', 'true');
    setShowPrompt(false);
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // 24 saat sonra tekrar göster
    setTimeout(() => {
      localStorage.removeItem('iosInstallPromptDismissed');
    }, 24 * 60 * 60 * 1000);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      zIndex: 10000,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <div style={{ fontSize: '2rem' }}>💪</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700' }}>
              iPhone'da Bildirimler İçin Ana Ekrana Ekleyin!
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5', opacity: 0.95 }}>
              iOS'ta web bildirimleri sadece ana ekrana eklenen uygulamalarda çalışır.
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '600', fontSize: '0.95rem' }}>
                📱 Nasıl Kurulur?
              </p>
              <ol style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '0.85rem',
                lineHeight: '1.6'
              }}>
                <li>Safari'nin <strong>alt</strong> menüsünden <strong>Paylaş</strong> butonuna basın</li>
                <li><strong>"Ana Ekrana Ekle"</strong> seçeneğini bulun</li>
                <li><strong>"Ekle"</strong> butonuna basın</li>
                <li>Ana ekrandan uygulamayı açın</li>
                <li>Bildirimlere izin verin ✅</li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleRemindLater}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Sonra Hatırlat
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '10px 16px',
                  background: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#667eea',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default IOSInstallPrompt;
