import React from 'react';
import './ReportSettings.css';

const DAYS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 0, label: 'Pazar' }
];

const getTimeValue = (hour = 12, minute = 0) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const ReportSettings = ({ settings, onChange, notificationsSupported }) => {
  const update = (patch) => onChange({ ...settings, ...patch });
  const dailyTime = settings.times?.[0] || '20:00';
  const weeklyTime = getTimeValue(settings.weeklyReportHour ?? 12, settings.weeklyReportMinute ?? 0);

  const handleWeeklyTime = (value) => {
    const [hour = '12', minute = '00'] = value.split(':');
    update({ weeklyReportHour: parseInt(hour, 10), weeklyReportMinute: parseInt(minute, 10) });
  };

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
            <strong>Haftalık rapor hatırlatması</strong>
            <span>Varsayılan olarak Pazar 12:00. Uygulama açıkken bildirim gösterir; e-posta cron tercihi için de kaydedilir.</span>
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
        <div className="report-field-grid">
          <label>
            Gün
            <select
              value={settings.weeklyReportDay ?? 0}
              onChange={(e) => update({ weeklyReportDay: parseInt(e.target.value, 10) })}
              disabled={settings.weeklyReportEnabled === false}
            >
              {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </label>
          <label>
            Saat
            <input
              type="time"
              value={weeklyTime}
              onChange={(e) => handleWeeklyTime(e.target.value)}
              disabled={settings.weeklyReportEnabled === false}
            />
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
