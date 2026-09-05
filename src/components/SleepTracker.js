import React, { useState, useEffect, useCallback } from 'react';
import './SleepTracker.css';
import { getDailyLogsRange } from '../firebase/dataService';
import { saveSleep, deleteSleep } from '../firebase/dailyLogService';
import { validateSleepDuration, isBlocking } from '../utils/entryValidation';

/**
 * SleepTracker - adanmış uyku takibi ekranı
 * dailyLogs/{uid}_{date}.sleep alanını okur/yazar (Günlük Form ve Trend ile aynı veri).
 * WeightTracker deseni: hızlı ekleme formu + istatistik kartları + SVG trend çizgisi + geçmiş listesi.
 */

const HISTORY_DAYS = 30;

const getDateList = (days) => {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const formatShort = (dateStr) =>
  new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

const SleepTracker = ({ user }) => {
  const [entries, setEntries] = useState([]); // [{date, duration_hours, score, bedtime}]
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    duration_hours: '',
    score: '',
    bedtime: '',
    night_wakes: '',
    wake_minutes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dates = getDateList(HISTORY_DAYS);
      const logs = await getDailyLogsRange(user.uid, dates);
      const sleepEntries = dates
        .filter((date) => logs[date]?.sleep?.duration_hours)
        .map((date) => ({ date, ...logs[date].sleep }));
      setEntries(sleepEntries);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Canlı denetim: 649 saat gibi ondalık atlanmış girişleri kaydetmeden yakalar.
  const sleepValidation = form.duration_hours === '' ? null : validateSleepDuration(form.duration_hours);

  const applySuggestion = () => {
    if (sleepValidation?.suggestion) {
      setForm({ ...form, duration_hours: String(sleepValidation.suggestion) });
    }
  };

  const handleSave = async () => {
    if (!user || !form.duration_hours) {
      alert('En az uyku süresini girin');
      return;
    }
    const validation = validateSleepDuration(form.duration_hours);
    if (isBlocking(validation)) {
      alert(validation.message);
      return;
    }
    setIsSaving(true);
    try {
      await saveSleep(user.uid, form.date, {
        duration_hours: parseFloat(form.duration_hours),
        score: form.score ? parseInt(form.score, 10) : null,
        bedtime: form.bedtime || null,
        night_wakes: form.night_wakes ? parseInt(form.night_wakes, 10) : null,
        wake_minutes: form.wake_minutes ? parseInt(form.wake_minutes, 10) : null
      });
      await loadEntries();
      setForm({ date: new Date().toISOString().split('T')[0], duration_hours: '', score: '', bedtime: '', night_wakes: '', wake_minutes: '' });
      setIsAdding(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setForm({
      date: entry.date,
      duration_hours: entry.duration_hours,
      score: entry.score || '',
      bedtime: entry.bedtime || '',
      night_wakes: entry.night_wakes || '',
      wake_minutes: entry.wake_minutes || ''
    });
    setIsAdding(true);
  };

  const handleDelete = async (date) => {
    if (!window.confirm(`${formatShort(date)} uyku kaydını silmek istediğinize emin misiniz?`)) return;
    await deleteSleep(user.uid, date);
    await loadEntries();
  };

  const avgDuration = entries.length
    ? (entries.reduce((s, e) => s + e.duration_hours, 0) / entries.length).toFixed(1)
    : null;
  const scored = entries.filter((e) => e.score);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length)
    : null;
  const best = entries.length
    ? entries.reduce((a, b) => (b.duration_hours > a.duration_hours ? b : a))
    : null;

  // SVG trend çizgisi (WeightTracker deseninde, elle çizilen hafif grafik)
  const renderChart = () => {
    if (entries.length < 2) return null;
    const W = 320, H = 120, PAD = 10;
    const values = entries.map((e) => e.duration_hours);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const points = entries.map((e, i) => {
      const x = PAD + (i / (entries.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((e.duration_hours - min) / range) * (H - 2 * PAD);
      return `${x},${y}`;
    });
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="sleep-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124, 58, 237, 0.35)" />
            <stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
          </linearGradient>
        </defs>
        <polygon
          points={`${PAD},${H - PAD} ${points.join(' ')} ${W - PAD},${H - PAD}`}
          fill="url(#sleepGradient)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  if (!user) {
    return (
      <div className="sleep-tracker">
        <div className="sleep-header"><h3>😴 Uyku Takibi</h3></div>
        <p className="sleep-empty">Uyku takibi için giriş yapmanız gerekiyor.</p>
      </div>
    );
  }

  return (
    <div className="sleep-tracker">
      <div className="sleep-header">
        <h3>😴 Uyku Takibi</h3>
        <button className="sleep-add-toggle" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? '❌ İptal' : '➕ Uyku Ekle'}
        </button>
      </div>

      {isAdding && (
        <div className="sleep-form">
          <div className="sleep-form-grid">
            <div className="sleep-field">
              <label>Tarih</label>
              <input
                type="date"
                value={form.date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="sleep-field">
              <label>Süre (saat) *</label>
              <input
                type="number"
                step="0.1"
                placeholder="7.5"
                value={form.duration_hours}
                onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
              />
            </div>
            <div className="sleep-field">
              <label>Skor</label>
              <input
                type="number"
                placeholder="90"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
              />
            </div>
            <div className="sleep-field">
              <label>Yatış Saati</label>
              <input
                type="text"
                placeholder="22:30"
                value={form.bedtime}
                onChange={(e) => setForm({ ...form, bedtime: e.target.value })}
              />
            </div>
            <div className="sleep-field">
              <label>Uyanma (kaç kez)</label>
              <input
                type="number"
                placeholder="0"
                value={form.night_wakes}
                onChange={(e) => setForm({ ...form, night_wakes: e.target.value })}
              />
            </div>
            <div className="sleep-field">
              <label>Uyanık (dk)</label>
              <input
                type="number"
                placeholder="0"
                value={form.wake_minutes}
                onChange={(e) => setForm({ ...form, wake_minutes: e.target.value })}
              />
            </div>
          </div>
          {sleepValidation && sleepValidation.level !== 'ok' && (
            <div className={`sleep-validation ${sleepValidation.level}`} role="alert">
              <span>{sleepValidation.level === 'error' ? '⛔' : '⚠️'} {sleepValidation.message}</span>
              {sleepValidation.suggestion && (
                <button type="button" className="sleep-validation-fix" onClick={applySuggestion}>
                  {sleepValidation.suggestion} saat yap
                </button>
              )}
            </div>
          )}
          <button
            className="sleep-save-btn"
            onClick={handleSave}
            disabled={isSaving || (sleepValidation ? isBlocking(sleepValidation) : false)}
          >
            {isSaving ? '💾 Kaydediliyor...' : '💾 Kaydet'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="sleep-empty">Yükleniyor...</p>
      ) : entries.length === 0 ? (
        <p className="sleep-empty">Son {HISTORY_DAYS} günde uyku kaydı yok. İlk kaydını ekle!</p>
      ) : (
        <>
          <div className="sleep-stats">
            <div className="sleep-stat">
              <span className="sleep-stat-value">{avgDuration}</span>
              <span className="sleep-stat-label">Ort. Süre (saat)</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-value">{avgScore || '-'}</span>
              <span className="sleep-stat-label">Ort. Skor</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-value">{best.duration_hours}</span>
              <span className="sleep-stat-label">En İyi ({formatShort(best.date)})</span>
            </div>
          </div>

          {renderChart()}

          <div className="sleep-history">
            {[...entries].reverse().map((entry) => {
              // Geçmişte kaydedilmiş hatalı değerler (649 saat gibi) listede işaretlenir.
              const check = validateSleepDuration(entry.duration_hours);
              return (
              <div key={entry.date} className={`sleep-history-item ${check.level !== 'ok' ? `has-${check.level}` : ''}`}>
                <span className="sleep-history-date">{formatShort(entry.date)}</span>
                <span className="sleep-history-info">
                  {entry.duration_hours} saat
                  {entry.score ? ` · skor ${entry.score}` : ''}
                  {entry.night_wakes ? ` · ${entry.night_wakes}x uyanma${entry.wake_minutes ? ` (${entry.wake_minutes} dk)` : ''}` : ''}
                  {entry.bedtime ? ` · yatış ${entry.bedtime}` : ''}
                  {check.level !== 'ok' && (
                    <small className={`sleep-history-flag ${check.level}`} title={check.message}>
                      {check.level === 'error' ? '⛔ Hatalı veri' : '⚠️ Doğrula'}
                    </small>
                  )}
                </span>
                <div className="sleep-history-actions">
                  <button onClick={() => handleEdit(entry)} title="Düzenle">✏️</button>
                  <button onClick={() => handleDelete(entry.date)} title="Sil">🗑️</button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default SleepTracker;
