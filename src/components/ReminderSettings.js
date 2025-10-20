import React, { useMemo } from 'react';
import './ReminderSettings.css';

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

  const handleTimeChange = (index, value) => {
    const safe = formatTime(value);
    const times = settings.times.map((time, idx) => (idx === index ? safe : time));
    onChange({ ...settings, times });
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
            {settings.times.map((time, index) => (
              <div key={time + index} className="time-row">
                <input
                  type="time"
                  value={time}
                  onChange={(event) => handleTimeChange(index, event.target.value)}
                  disabled={!settings.enabled}
                />
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
            ))}
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
