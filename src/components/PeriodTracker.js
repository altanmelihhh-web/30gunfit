import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PeriodTracker.css';
import {
  buildPeriodBackup,
  deletePeriodEntry,
  getPeriodTracker,
  mergePeriodBackup,
  parsePeriodBackup,
  savePeriodTracker,
  upsertPeriodEntry
} from '../firebase/periodService';
import {
  buildCalendarMeta,
  formatDateKey,
  formatShortDateKey,
  getAlerts,
  getCalendarDays,
  getCycleHistory,
  getMonthKey,
  getPhaseInfo,
  getPredictions,
  shiftKey,
  todayKey
} from '../utils/cycleMath';

const EMPTY_ENTRY = {
  flow: 'none',
  pain: 0,
  mood: '',
  symptoms: [],
  notes: ''
};

const blankEntry = (date) => ({ ...EMPTY_ENTRY, date });

const FLOW_OPTIONS = [
  { key: 'none', label: 'Yok' },
  { key: 'spotting', label: 'Lekelenme' },
  { key: 'light', label: 'Az' },
  { key: 'medium', label: 'Orta' },
  { key: 'heavy', label: 'Yoğun' }
];

const SYMPTOMS = [
  'Kramp', 'Şişkinlik', 'Baş ağrısı', 'Bel ağrısı', 'Hassasiyet', 'Yorgunluk',
  'Tatlı isteği', 'Akne', 'Mide bulantısı', 'İshal', 'Uyku bozukluğu', 'İştah artışı',
  'Akıntı değişimi', 'Göğüs hassasiyeti'
];
const MOODS = ['Sakin', 'Enerjik', 'Hassas', 'Gergin', 'Düşük', 'Odaklı'];

const flowLabel = (flow) => FLOW_OPTIONS.find((option) => option.key === flow)?.label || 'Yok';

const normalizeRangeEntry = (baseEntry, date, index, fallbackPain) => ({
  ...EMPTY_ENTRY,
  ...(baseEntry || {}),
  date,
  flow: index === 0 ? 'medium' : baseEntry?.flow && baseEntry.flow !== 'none' ? baseEntry.flow : 'light',
  pain: baseEntry?.pain || fallbackPain || 0,
  symptoms: Array.isArray(baseEntry?.symptoms) ? baseEntry.symptoms : [],
  updatedAt: new Date().toISOString()
});

// Bir başlangıç tarihinden itibaren `length` günü regl olarak işaretler.
const applyPeriodRange = (entriesByDate, startKey, length, painFallback) => {
  for (let index = 0; index < length; index += 1) {
    const date = shiftKey(startKey, index);
    entriesByDate.set(date, normalizeRangeEntry(entriesByDate.get(date), date, index, painFallback));
  }
  return entriesByDate;
};

const PeriodTracker = ({ user }) => {
  const [today, setToday] = useState(todayKey);
  const [tracker, setTracker] = useState({
    settings: { cycleLength: 28, periodLength: 5, notifyEnabled: true, notifyBeforeDays: 2 },
    entries: []
  });
  const [entry, setEntry] = useState(() => blankEntry(todayKey()));
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthKey(todayKey()));
  const [settingsDraft, setSettingsDraft] = useState({ cycleLength: 28, periodLength: 5 });
  const [pastStarts, setPastStarts] = useState(['', '', '']);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const settingsTimer = useRef(null);
  const importInputRef = useRef(null);

  // Uygulama açıkken gece yarısı geçilirse "bugün" güncellensin.
  useEffect(() => {
    const id = setInterval(() => {
      const next = todayKey();
      setToday((prev) => (prev === next ? prev : next));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    if (!user) return;
    try {
      const data = await getPeriodTracker(user.uid);
      setTracker(data);
      setSettingsDraft({
        cycleLength: data.settings.cycleLength,
        periodLength: data.settings.periodLength
      });
    } catch (err) {
      setError(err.message || 'Regl takibi yüklenemedi.');
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(settingsTimer.current), []);

  const selectedExisting = tracker.entries.find((item) => item.date === entry.date);
  const entryByDate = useMemo(() => new Map(tracker.entries.map((item) => [item.date, item])), [tracker.entries]);

  useEffect(() => {
    if (selectedExisting) {
      setEntry({
        date: selectedExisting.date,
        flow: selectedExisting.flow,
        pain: selectedExisting.pain,
        mood: selectedExisting.mood,
        symptoms: selectedExisting.symptoms || [],
        notes: selectedExisting.notes || ''
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.date, tracker.entries]);

  const predictions = useMemo(
    () => getPredictions(tracker.entries, tracker.settings, { today }),
    [tracker.entries, tracker.settings, today]
  );

  const calendarMeta = useMemo(
    () => buildCalendarMeta(tracker.entries, predictions, { today }),
    [tracker.entries, predictions, today]
  );

  const alerts = useMemo(
    () => getAlerts(tracker.entries, predictions, { today }),
    [tracker.entries, predictions, today]
  );

  const history = useMemo(() => getCycleHistory(tracker.entries), [tracker.entries]);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const recentEntries = tracker.entries.slice(0, 8);
  const maxHistoryCycle = Math.max(...history.map((item) => item.cycleLength || 0), 1);

  const phase = predictions
    ? getPhaseInfo(predictions.cycleDay, predictions.cycleLength, predictions.periodLength)
    : getPhaseInfo(null);

  const needsHistory = !predictions || predictions.sampleCount === 0;

  const flashNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  };

  const selectDate = (date) => {
    if (!date) return;
    const existing = entryByDate.get(date);
    setEntry(existing ? { ...blankEntry(date), ...existing } : blankEntry(date));
    setVisibleMonth(getMonthKey(date));
  };

  const shiftMonth = (direction) => {
    const [year, month] = visibleMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setVisibleMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToday = () => selectDate(today);

  // Sayı alanında her tuş vuruşunda Firestore'a yazmamak için gecikmeli kaydeder.
  const handleSettingChange = (field, value) => {
    const draft = { ...settingsDraft, [field]: value };
    setSettingsDraft(draft);
    clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      const parsed = parseInt(draft[field], 10);
      if (!parsed) return;
      const settings = { ...tracker.settings, [field]: parsed };
      try {
        setTracker(await savePeriodTracker(user.uid, { ...tracker, settings }));
      } catch (err) {
        setError(err.message || 'Ayar kaydedilemedi.');
      }
    }, 700);
  };

  const handleNotifyChange = async (patch) => {
    const settings = { ...tracker.settings, ...patch };
    try {
      setTracker(await savePeriodTracker(user.uid, { ...tracker, settings }));
    } catch (err) {
      setError(err.message || 'Bildirim ayarı kaydedilemedi.');
    }
  };

  const toggleSymptom = (symptom) => {
    const exists = entry.symptoms.includes(symptom);
    setEntry({
      ...entry,
      symptoms: exists ? entry.symptoms.filter((item) => item !== symptom) : [...entry.symptoms, symptom]
    });
  };

  const runSave = async (task, failureMessage) => {
    if (!user) return;
    setIsSaving(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.message || failureMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => runSave(async () => {
    setTracker(await upsertPeriodEntry(user.uid, entry));
  }, 'Kayıt kaydedilemedi.');

  const handleMarkPeriod = () => {
    const length = Math.max(1, Math.min(10, tracker.settings.periodLength || 5));
    if (!window.confirm(`${formatDateKey(entry.date)} başlangıç kabul edilip ${length} gün regl olarak işaretlensin mi?`)) return;
    runSave(async () => {
      const entriesByDate = applyPeriodRange(new Map(entryByDate), entry.date, length, entry.pain);
      const next = await savePeriodTracker(user.uid, { ...tracker, entries: [...entriesByDate.values()] });
      setTracker(next);
      const selected = next.entries.find((item) => item.date === entry.date);
      setEntry(selected ? { ...blankEntry(entry.date), ...selected } : blankEntry(entry.date));
      setVisibleMonth(getMonthKey(entry.date));
    }, 'Regl aralığı işaretlenemedi.');
  };

  const handleAddPastStarts = () => {
    const starts = pastStarts.filter(Boolean);
    if (!starts.length) return;
    const length = Math.max(1, Math.min(10, tracker.settings.periodLength || 5));
    runSave(async () => {
      const entriesByDate = new Map(entryByDate);
      starts.forEach((start) => applyPeriodRange(entriesByDate, start, length, 0));
      setTracker(await savePeriodTracker(user.uid, { ...tracker, entries: [...entriesByDate.values()] }));
      setPastStarts(['', '', '']);
      flashNotice(`${starts.length} geçmiş regl dönemi eklendi. Tahminler bu kayıtlara göre güncellendi.`);
    }, 'Geçmiş kayıtlar eklenemedi.');
  };

  const handleDelete = (date) => {
    if (!window.confirm(`${formatDateKey(date)} kaydı silinsin mi?`)) return;
    runSave(async () => {
      setTracker(await deletePeriodEntry(user.uid, date));
      if (entry.date === date) setEntry(blankEntry(date));
    }, 'Kayıt silinemedi.');
  };

  const handleClearSelected = () => {
    if (!selectedExisting) {
      setEntry(blankEntry(entry.date));
      return;
    }
    if (!window.confirm(`${formatDateKey(entry.date)} kaydı temizlensin mi?`)) return;
    runSave(async () => {
      setTracker(await deletePeriodEntry(user.uid, entry.date));
      setEntry(blankEntry(entry.date));
    }, 'Kayıt temizlenemedi.');
  };

  const handleClearMarkedRange = () => {
    const length = Math.max(1, Math.min(10, tracker.settings.periodLength || 5));
    const datesToRemove = Array.from({ length }, (_, index) => shiftKey(entry.date, index));
    const existingCount = datesToRemove.filter((date) => entryByDate.has(date)).length;
    if (existingCount === 0) {
      setEntry(blankEntry(entry.date));
      return;
    }
    if (!window.confirm(`${formatDateKey(entry.date)} tarihinden başlayan ${existingCount} kayıt temizlensin mi?`)) return;
    runSave(async () => {
      const removeSet = new Set(datesToRemove);
      setTracker(await savePeriodTracker(user.uid, {
        ...tracker,
        entries: tracker.entries.filter((item) => !removeSet.has(item.date))
      }));
      setEntry(blankEntry(entry.date));
    }, 'Aralık temizlenemedi.');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(buildPeriodBackup(tracker), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `30gunfit-regl-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    flashNotice(`${tracker.entries.length} kayıt dışa aktarıldı.`);
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loaded) => {
      runSave(async () => {
        const payload = parsePeriodBackup(loaded.target.result);
        setTracker(await mergePeriodBackup(user.uid, payload));
        flashNotice(`${payload.entries.length} kayıt içe aktarıldı.`);
      }, 'Yedek yüklenemedi.');
    };
    reader.onerror = () => setError('Dosya okunamadı.');
    reader.readAsText(file);
  };

  if (!user) return null;

  const predictionRange = predictions && predictions.confidenceDays
    ? `${formatShortDateKey(predictions.nextStartEarly)} - ${formatShortDateKey(predictions.nextStartLate)}`
    : null;

  return (
    <div className="period-tracker">
      <div className="period-header">
        <div>
          <span className="period-eyebrow">Emine Ay Altan</span>
          <h2>Regl Takibi</h2>
        </div>
        <div className="period-settings">
          <label>Döngü
            <input
              type="number"
              min="18"
              max="45"
              value={settingsDraft.cycleLength}
              onChange={(e) => handleSettingChange('cycleLength', e.target.value)}
            />
          </label>
          <label>Süre
            <input
              type="number"
              min="1"
              max="10"
              value={settingsDraft.periodLength}
              onChange={(e) => handleSettingChange('periodLength', e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && <div className="period-error">{error}</div>}
      {notice && <div className="period-notice">{notice}</div>}

      {needsHistory && (
        <section className="period-card period-onboarding">
          <h3>Tahminleri şimdi başlat</h3>
          <p>Son 3 reglinin başlangıç tarihini gir; uygulama kendi döngü uzunluğunu buradan öğrenir.</p>
          <div className="period-onboarding-row">
            {pastStarts.map((value, index) => (
              <input
                key={index}
                type="date"
                max={today}
                value={value}
                onChange={(e) => {
                  const next = [...pastStarts];
                  next[index] = e.target.value;
                  setPastStarts(next);
                }}
              />
            ))}
            <button type="button" onClick={handleAddPastStarts} disabled={isSaving || !pastStarts.some(Boolean)}>
              Ekle
            </button>
          </div>
        </section>
      )}

      <div className="period-grid">
        <section className="period-card period-entry-card">
          <div className="period-card-head">
            <h3>Günlük Kayıt</h3>
            {selectedExisting && <span>Kayıt var · düzenlenebilir</span>}
          </div>

          <div className="period-selected-date">
            <div>
              <span>Seçili tarih</span>
              <strong>{formatDateKey(entry.date)}</strong>
            </div>
            <button type="button" onClick={goToday}>Bugün</button>
          </div>

          <div className="period-calendar">
            <div className="period-calendar-head">
              <button type="button" onClick={() => shiftMonth(-1)}>Önceki</button>
              <input type="month" value={visibleMonth} onChange={(e) => e.target.value && setVisibleMonth(e.target.value)} />
              <button type="button" onClick={() => shiftMonth(1)}>Sonraki</button>
            </div>
            <div className="period-weekdays">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="period-calendar-grid">
              {calendarDays.map((day) => {
                const meta = calendarMeta.get(day.key) || {};
                const classes = [
                  day.inMonth ? '' : 'muted',
                  entry.date === day.key ? 'active' : '',
                  meta.bleeding ? 'has-flow' : '',
                  !meta.bleeding && meta.predictedPeriod ? 'predicted' : '',
                  meta.fertile ? 'fertile' : '',
                  meta.ovulation ? 'ovulation' : '',
                  day.key === today ? 'is-today' : ''
                ].filter(Boolean).join(' ');
                return (
                  <button key={day.key} type="button" className={classes} onClick={() => selectDate(day.key)}>
                    <strong>{day.day}</strong>
                    {meta.bleeding && <span>{flowLabel(meta.flow)}</span>}
                    {!meta.bleeding && meta.predictedPeriod && <span className="hint">tahmin</span>}
                    {!meta.bleeding && !meta.predictedPeriod && meta.ovulation && <span className="hint">ovül.</span>}
                  </button>
                );
              })}
            </div>
            <div className="period-calendar-legend">
              <span><i /> Kayıtlı regl</span>
              <span><i className="predicted" /> Tahmini regl</span>
              <span><i className="fertile" /> Verimli dönem</span>
              <span><i className="ovulation" /> Ovülasyon</span>
              <span><i className="selected" /> Seçili gün</span>
            </div>
          </div>

          <div className="period-form-grid">
            <label>Tarih<input type="date" value={entry.date} onChange={(e) => selectDate(e.target.value)} /></label>
            <label>Ruh hali
              <select value={entry.mood} onChange={(e) => setEntry({ ...entry, mood: e.target.value })}>
                <option value="">Seçiniz</option>
                {MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
              </select>
            </label>
          </div>

          <div className="period-flow-row">
            {FLOW_OPTIONS.map((flow) => (
              <button
                key={flow.key}
                className={entry.flow === flow.key ? 'active' : ''}
                type="button"
                onClick={() => setEntry({ ...entry, flow: flow.key })}
              >
                {flow.label}
              </button>
            ))}
          </div>

          <label className="period-pain">Ağrı
            <input type="range" min="0" max="10" value={entry.pain} onChange={(e) => setEntry({ ...entry, pain: parseInt(e.target.value, 10) })} />
            <strong>{entry.pain}/10</strong>
          </label>

          <div className="period-symptoms">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom}
                className={entry.symptoms.includes(symptom) ? 'active' : ''}
                type="button"
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </button>
            ))}
          </div>

          <label className="period-notes">Not
            <textarea rows={3} value={entry.notes} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} />
          </label>

          <div className="period-actions">
            <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            <button type="button" className="secondary" onClick={handleMarkPeriod} disabled={isSaving}>Başlangıçtan İşaretle</button>
            <button type="button" className="secondary" onClick={handleClearSelected} disabled={isSaving}>{selectedExisting ? 'Günü Temizle' : 'Formu Sıfırla'}</button>
            <button type="button" className="danger" onClick={handleClearMarkedRange} disabled={isSaving}>Aralığı Temizle</button>
          </div>
          <p className="period-action-note">Kaydet seçili günü günceller. Başlangıçtan işaretle seçili tarihi ilk gün kabul eder; temizle butonları yanlış deneme kayıtlarını kaldırır.</p>
        </section>

        <section className="period-card">
          <h3>Döngü Özeti</h3>
          <div className="period-kpis">
            <div><span>Son başlangıç</span><strong>{predictions ? formatDateKey(predictions.latestStart) : '-'}</strong></div>
            <div>
              <span>Sonraki tahmin</span>
              <strong>{predictions ? formatDateKey(predictions.nextStart) : '-'}</strong>
              {predictionRange && <small>{predictionRange} aralığı</small>}
            </div>
            <div><span>Tahmini bitiş</span><strong>{predictions ? formatDateKey(predictions.nextEnd) : '-'}</strong></div>
            <div><span>Ovülasyon</span><strong>{predictions ? formatDateKey(predictions.ovulation) : '-'}</strong></div>
          </div>

          <div className="period-window">
            <span>Verimli dönem</span>
            <strong>{predictions ? `${formatDateKey(predictions.fertileStart)} - ${formatDateKey(predictions.fertileEnd)}` : '-'}</strong>
          </div>

          <p className="period-confidence">
            {!predictions && 'Henüz kayıt yok. İlk regl gününü işaretlediğinde tahmin başlar.'}
            {predictions && predictions.source === 'settings' &&
              `Şu an ayardaki ${predictions.cycleLength} günlük varsayım kullanılıyor. İkinci regl kaydından sonra kendi döngü uzunluğunu öğrenir.`}
            {predictions && predictions.source === 'learned' &&
              `Son ${predictions.sampleCount} döngüden öğrenildi: ${predictions.cycleLength} gün · tahmin ±${predictions.confidenceDays} gün.`}
          </p>

          <div className="period-insights">
            <h4>Döngü İçgörüleri</h4>
            <div className="period-phase-card">
              <span>Tahmini faz</span>
              <strong>{phase.label}</strong>
              <p>{phase.note}</p>
            </div>
            <div className="period-insight-grid">
              <div><span>Bugün</span><strong>{predictions?.cycleDay ? `${predictions.cycleDay}. gün` : '-'}</strong></div>
              <div>
                <span>Tahmine kalan</span>
                <strong>
                  {!predictions ? '-'
                    : predictions.daysUntilNext >= 0 ? `${predictions.daysUntilNext} gün`
                      : `${Math.abs(predictions.daysUntilNext)} gün geçti`}
                </strong>
              </div>
              <div><span>Ort. döngü</span><strong>{predictions?.avgCycleLength ? `${predictions.avgCycleLength} gün` : '-'}</strong></div>
              <div><span>Ort. süre</span><strong>{predictions?.avgPeriodLength ? `${predictions.avgPeriodLength} gün` : '-'}</strong></div>
            </div>
          </div>

          <div className={`period-health-notes ${alerts.length > 0 ? 'has-alerts' : ''}`}>
            <h4>Takip Notları</h4>
            {alerts.length === 0 ? (
              <p>Kayıtlarda belirgin bir takip uyarısı görünmüyor. Tahminler düzenli kayıt oldukça iyileşir.</p>
            ) : (
              <ul>
                {alerts.map((alert) => <li key={alert}>{alert}</li>)}
              </ul>
            )}
          </div>

          <div className="period-notify">
            <label className="period-notify-toggle">
              <input
                type="checkbox"
                checked={tracker.settings.notifyEnabled !== false}
                onChange={(e) => handleNotifyChange({ notifyEnabled: e.target.checked })}
              />
              Regl yaklaşınca bildirim gönder
            </label>
            <label className="period-notify-days">
              Kaç gün önce
              <input
                type="number"
                min="0"
                max="7"
                value={tracker.settings.notifyBeforeDays ?? 2}
                onChange={(e) => handleNotifyChange({ notifyBeforeDays: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
          </div>
        </section>
      </div>

      <section className="period-card">
        <div className="period-card-head">
          <h3>Döngü Geçmişi</h3>
          <span>{history.length} dönem</span>
        </div>
        {history.length === 0 ? (
          <p className="period-empty">Henüz tamamlanmış bir dönem yok.</p>
        ) : (
          <div className="period-history-list">
            {history.map((item) => (
              <div key={item.start} className="period-cycle-row">
                <button type="button" className="period-cycle-dates" onClick={() => selectDate(item.start)}>
                  <strong>{formatShortDateKey(item.start)} - {formatShortDateKey(item.end)}</strong>
                  <small>{item.periodDays} gün kanama{item.heavyDays ? ` · ${item.heavyDays} yoğun` : ''}{item.maxPain ? ` · en yüksek ağrı ${item.maxPain}/10` : ''}</small>
                </button>
                <div className="period-cycle-bar">
                  <div style={{ width: `${((item.cycleLength || 0) / maxHistoryCycle) * 100}%` }} />
                </div>
                <span className="period-cycle-length">{item.cycleLength ? `${item.cycleLength} gün` : 'devam ediyor'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="period-card">
        <div className="period-card-head">
          <h3>Son Kayıtlar</h3>
          <span>{tracker.entries.length} kayıt</span>
        </div>
        {recentEntries.length === 0 ? (
          <p className="period-empty">Henüz kayıt yok.</p>
        ) : (
          <div className="period-history">
            {recentEntries.map((item) => (
              <div key={item.date} className="period-history-item">
                <button type="button" onClick={() => selectDate(item.date)}>
                  <strong>{formatDateKey(item.date)}</strong>
                  <span>{flowLabel(item.flow)} · ağrı {item.pain}/10{item.mood ? ` · ${item.mood}` : ''}</span>
                  {item.symptoms.length > 0 && <small>{item.symptoms.join(', ')}</small>}
                </button>
                <button type="button" className="period-history-delete" onClick={() => handleDelete(item.date)} disabled={isSaving}>Sil</button>
              </div>
            ))}
          </div>
        )}
        <div className="period-backup-row">
          <button type="button" className="secondary" onClick={handleExport} disabled={isSaving}>Yedek Al (JSON)</button>
          <button type="button" className="secondary" onClick={() => importInputRef.current?.click()} disabled={isSaving}>Yedek Yükle</button>
          <input ref={importInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
        </div>
      </section>
    </div>
  );
};

export default PeriodTracker;
