import React from 'react';
import './ReportSettings.css';

const ReportSettings = ({ settings, onChange, notificationsSupported }) => {
  const update = (patch) => onChange({ ...settings, ...patch });
  const dailyTime = settings.times?.[0] || '20:00';

  const requestPermission = async () => {
    if (!notificationsSupported || !('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
  };

  return (
    <div className="report-settings">
      <div className="report-settings-header">
        <h2>Rapor Ayarları</h2>
        <p>Günlük kontrol ve haftalık rapor bildirimlerini kişi bazlı yönet.</p>
      </div>

      <div className="report-settings-section">
        <div className="report-setting-row">
          <div>
            <strong>Günlük kayıt hatırlatması</strong>
            <span>Seçtiğin saatte öğün, su, uyku ve antrenmanı tamamlamanı hatırlatır.</span>
          </div>
          <label className="report-switch">
            <input
              type="checkbox"
              checked={Boolean(settings.enabled)}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            <span />
          </label>
        </div>
        <div className="report-field-grid">
          <label>
            Saat
            <input
              type="time"
              value={dailyTime}
              onChange={(e) => update({ times: [e.target.value] })}
              disabled={!settings.enabled}
            />
          </label>
        </div>
      </div>

      <div className="report-settings-section">
        <div className="report-setting-row">
          <div>
            <strong>Haftalık rapor</strong>
            <span>Her Pazar 12:00'de rapor e-postan gönderilir. Uygulama o sırada açıksa bildirim de gösterilir.</span>
          </div>
          <label className="report-switch">
            <input
              type="checkbox"
              checked={settings.weeklyReportEnabled !== false}
              onChange={(e) => update({ weeklyReportEnabled: e.target.checked })}
            />
            <span />
          </label>
        </div>
      </div>

      <div className="report-settings-actions">
        {!notificationsSupported ? (
          <span>Bu cihaz/tarayıcı bildirim desteklemiyor.</span>
        ) : (
          <button type="button" onClick={requestPermission}>
            Bildirim İznini Kontrol Et
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportSettings;
