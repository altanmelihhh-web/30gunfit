import React, { useEffect, useMemo, useState } from 'react';
import './OnboardingModal.css';

const formatDateInput = (date) => {
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

const formatTimeValue = (value) => {
  if (!value) return '09:00';
  const [hour = '00', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const presets = [
  ['07:30', '12:30', '19:30'],
  ['08:00', '13:30', '21:00'],
  ['09:00', '15:00']
];

function OnboardingModal({
  open,
  startDate,
  onStartDateChange,
  reminderSettings,
  onReminderChange,
  onComplete,
  onSkip
}) {
  const [dateValue, setDateValue] = useState(formatDateInput(startDate));
  const [localSettings, setLocalSettings] = useState(reminderSettings);

  useEffect(() => {
    if (!open) return;
    setDateValue(formatDateInput(startDate));
  }, [startDate, open]);

  useEffect(() => {
    if (!open) return;
    setLocalSettings(reminderSettings);
  }, [reminderSettings, open]);

  const reminderSummary = useMemo(() => {
    if (!localSettings.enabled) {
      return 'Hatırlatmalar kapalı';
    }
    return localSettings.times.map(formatTimeValue).join(' · ');
  }, [localSettings]);

  const handleToggle = () => {
    setLocalSettings((prev) => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };

  const handleTimeChange = (index, value) => {
    setLocalSettings((prev) => {
      const times = prev.times.map((time, idx) => (idx === index ? formatTimeValue(value) : time));
      return {
        ...prev,
        times
      };
    });
  };

  const handleAddTime = () => {
    setLocalSettings((prev) => {
      if (prev.times.length >= 4) return prev;
      return {
        ...prev,
        times: [...prev.times, '20:30']
      };
    });
  };

  const handleRemoveTime = (index) => {
    setLocalSettings((prev) => {
      if (prev.times.length <= 1) return prev;
      const times = prev.times.filter((_, idx) => idx !== index);
      return { ...prev, times };
    });
  };

  const handlePresetSelect = (times) => {
    setLocalSettings({
      enabled: true,
      times: times.map(formatTimeValue)
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (dateValue) {
      const parsed = new Date(dateValue);
      if (!Number.isNaN(parsed.getTime())) {
        onStartDateChange(parsed);
      }
    }
    onReminderChange({
      enabled: localSettings.enabled,
      times: localSettings.times.map(formatTimeValue)
    });
    onComplete();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-modal">
        <div className="onboarding-hero">
          <span className="onboarding-badge">Yeni Başlangıç</span>
          <h2>Programını kişiselleştir</h2>
          <p>
            Başlangıç tarihini belirle, hatırlatma saatlerini seç ve tüm cihazlarda aynı tempoyu yakala.
          </p>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="onboarding-field">
            <label htmlFor="startDate">Başlangıç tarihi</label>
            <input
              id="startDate"
              type="date"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              required
            />
            <small>Bu tarih ilerlemenizi hesaplamak için kullanılır.</small>
          </div>

          <div className="onboarding-field">
            <div className="field-header">
              <label>Hatırlatıcılar</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={localSettings.enabled}
                  onChange={handleToggle}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="field-description">
              {reminderSummary}
            </p>

            <div className="time-grid">
              {localSettings.times.map((time, index) => (
                <div key={`${time}-${index}`} className="time-control">
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => handleTimeChange(index, event.target.value)}
                    disabled={!localSettings.enabled}
                  />
                  {localSettings.times.length > 1 && (
                    <button
                      type="button"
                      className="time-remove"
                      onClick={() => handleRemoveTime(index)}
                      disabled={!localSettings.enabled}
                    >
                      Sil
                    </button>
                  )}
                </div>
              ))}
              {localSettings.times.length < 4 && (
                <button
                  type="button"
                  className="time-add"
                  onClick={handleAddTime}
                  disabled={!localSettings.enabled}
                >
                  Saat ekle
                </button>
              )}
            </div>

            <div className="preset-pills">
              {presets.map((times) => (
                <button
                  key={times.join('-')}
                  type="button"
                  className="preset-pill"
                  onClick={() => handlePresetSelect(times)}
                >
                  {times.join(' · ')}
                </button>
              ))}
            </div>
          </div>

          <div className="onboarding-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onSkip}
            >
              Sonra ayarlarım
            </button>
            <button
              type="submit"
              className="primary-btn"
            >
              Planı Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OnboardingModal;
