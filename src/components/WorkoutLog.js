import React, { useState, useEffect, useCallback } from 'react';
import './WorkoutLog.css';
import { parseHevyWorkout, workoutStats } from '../utils/hevyParser';
import { getDailyLog, getDailyLogsRange } from '../firebase/dataService';
import { addWorkout, deleteWorkout, saveVitals } from '../firebase/dailyLogService';

/**
 * WorkoutLog - Hevy/ChatGPT antrenman metnini yapıştır → ayrıştır → seçili güne kaydet.
 * Veriyi dailyLogs/{uid}_{date}.workouts[] şemasına yazar (mevcut yapı).
 * Altında son antrenmanlar tarih tarih listelenir (düzenle/sil).
 */

const HISTORY_DAYS = 60;

const fmtDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

const WorkoutLog = ({ user }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pasteText, setPasteText] = useState('');
  const [draft, setDraft] = useState(null); // ayrıştırılmış {title, exercises}
  const [durationMin, setDurationMin] = useState('');
  const [entryMode, setEntryMode] = useState('manual');
  const [manualWorkout, setManualWorkout] = useState({
    type: 'strength',
    name: '',
    duration_min: '',
    active_calories: '',
    steps: '',
    distance_km: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [history, setHistory] = useState([]); // [{date, index, workout}]
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dates = [];
      const today = new Date();
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const logs = await getDailyLogsRange(user.uid, dates);
      const items = [];
      const weekDates = dates.slice(0, 7);
      const week = {
        sessions: 0,
        sets: 0,
        volume: 0,
        duration: 0,
        activeCalories: 0,
        steps: 0,
        exerciseMinutes: 0,
        distance: 0
      };
      dates.forEach((dt) => {
        (logs[dt]?.workouts || []).forEach((w, index) => {
          // Sadece hareket/set içeren gerçek antrenmanları göster (jenerik vitals değil)
          if ((w.exercises && w.exercises.length > 0) || w.title) {
            items.push({ date: dt, index, workout: w });
          }
        });
      });
      weekDates.forEach((dt) => {
        const log = logs[dt] || {};
        const workouts = (log.workouts || []).filter((w) => (w.exercises && w.exercises.length > 0) || w.title);
        if (workouts.length > 0) week.sessions += 1;
        workouts.forEach((w) => {
          const s = workoutStats(w);
          week.sets += s.totalSets;
          week.volume += s.volume;
          week.duration += parseFloat(w.duration_min) || 0;
        });
        week.activeCalories += parseFloat(log.vitals?.active_calories) || 0;
        week.steps += parseFloat(log.vitals?.steps) || 0;
        week.exerciseMinutes += parseFloat(log.vitals?.exercise_minutes) || 0;
        week.distance += parseFloat(log.vitals?.distance_km) || 0;
      });
      setHistory(items);
      setWeeklySummary(week);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseHevyWorkout(pasteText);
    if (parsed.exercises.length === 0) {
      alert('Metin ayrıştırılamadı. Hevy paylaşım metnini olduğu gibi yapıştırdığından emin ol.');
      return;
    }
    setDraft(parsed);
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s));
      return { ...ex, sets };
    });
    setDraft({ ...draft, exercises });
  };

  const removeExercise = (exIdx) => {
    setDraft({ ...draft, exercises: draft.exercises.filter((_, i) => i !== exIdx) });
  };

  const handleSave = async () => {
    if (!user || !draft) return;
    setIsSaving(true);
    try {
      const workout = {
        type: 'strength',
        source: 'hevy',
        title: draft.title || 'Antrenman',
        duration_min: durationMin ? parseFloat(durationMin) : null,
        calories: null,
        exercises: draft.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({
            weight_kg: s.weight_kg === '' || s.weight_kg == null ? null : parseFloat(s.weight_kg),
            reps: s.reps === '' || s.reps == null ? null : parseInt(s.reps, 10),
            isWarmup: !!s.isWarmup
          }))
        }))
      };
      await addWorkout(user.uid, date, workout);
      setSavedMsg(true);
      setPasteText('');
      setDraft(null);
      setDurationMin('');
      await loadHistory();
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      alert('Kaydetme hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (!user) return;
    const hasWorkout = manualWorkout.name.trim();
    const hasVitals = manualWorkout.duration_min || manualWorkout.active_calories || manualWorkout.steps || manualWorkout.distance_km;
    if (!hasWorkout && !hasVitals) {
      alert('En az antrenman adı veya aktivite değeri girin');
      return;
    }
    setIsSaving(true);
    try {
      if (hasWorkout) {
        await addWorkout(user.uid, date, {
          type: manualWorkout.type,
          source: 'manual',
          title: manualWorkout.name.trim(),
          duration_min: manualWorkout.duration_min ? parseFloat(manualWorkout.duration_min) : null,
          calories: null,
          distance_km: manualWorkout.distance_km ? parseFloat(manualWorkout.distance_km) : null,
          exercises: [{ name: manualWorkout.name.trim(), sets: [] }]
        });
      }
      if (hasVitals) {
        const existingLog = await getDailyLog(user.uid, date);
        const existingVitals = existingLog.success ? (existingLog.data.vitals || {}) : {};
        await saveVitals(user.uid, date, {
          ...existingVitals,
          active_calories: manualWorkout.active_calories ? parseFloat(manualWorkout.active_calories) : existingVitals.active_calories || null,
          exercise_minutes: manualWorkout.duration_min ? parseFloat(manualWorkout.duration_min) : existingVitals.exercise_minutes || null,
          steps: manualWorkout.steps ? parseInt(manualWorkout.steps, 10) : existingVitals.steps || null,
          distance_km: manualWorkout.distance_km ? parseFloat(manualWorkout.distance_km) : existingVitals.distance_km || null
        });
      }
      setSavedMsg(true);
      setManualWorkout({ type: 'strength', name: '', duration_min: '', active_calories: '', steps: '', distance_km: '' });
      await loadHistory();
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      alert('Kaydetme hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`${fmtDate(item.date)} - "${item.workout.title || 'Antrenman'}" silinsin mi?`)) return;
    await deleteWorkout(user.uid, item.date, item.index);
    await loadHistory();
  };

  if (!user) {
    return <div className="workout-log"><p className="wl-empty">Antrenman günlüğü için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className="workout-log">
      <div className="wl-header">
        <div>
          <span className="wl-eyebrow">Training Operations</span>
          <h2>🏋️ Antrenman Günlüğü</h2>
        </div>
        <p>Antrenman, süre, aktif kalori, mesafe ve adımı tek günlük kayıt altında takip et.</p>
      </div>

      {savedMsg && <div className="wl-success">✅ Antrenman kaydedildi!</div>}

      {weeklySummary && (
        <div className="wl-summary-grid">
          <div className="wl-summary-card"><span>Seans</span><strong>{weeklySummary.sessions}</strong><small>son 7 gün</small></div>
          <div className="wl-summary-card"><span>Set</span><strong>{weeklySummary.sets}</strong><small>toplam çalışma</small></div>
          <div className="wl-summary-card"><span>Hacim</span><strong>{Math.round(weeklySummary.volume).toLocaleString('tr-TR')}</strong><small>kg</small></div>
          <div className="wl-summary-card"><span>Aktif</span><strong>{Math.round(weeklySummary.activeCalories).toLocaleString('tr-TR')}</strong><small>kcal</small></div>
          <div className="wl-summary-card"><span>Süre</span><strong>{Math.round(weeklySummary.exerciseMinutes || weeklySummary.duration)}</strong><small>dk</small></div>
          <div className="wl-summary-card"><span>Adım</span><strong>{Math.round(weeklySummary.steps).toLocaleString('tr-TR')}</strong><small>son 7 gün</small></div>
        </div>
      )}

      <div className="wl-entry">
        <div className="wl-row">
          <label>Tarih</label>
          <input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="wl-mode-tabs">
          <button className={entryMode === 'manual' ? 'active' : ''} onClick={() => setEntryMode('manual')}>Manuel</button>
          <button className={entryMode === 'paste' ? 'active' : ''} onClick={() => setEntryMode('paste')}>Hevy Metni</button>
        </div>

        {entryMode === 'manual' ? (
          <div className="wl-manual">
            <div className="wl-field-grid">
              <div className="wl-field">
                <label>Tip</label>
                <select value={manualWorkout.type} onChange={(e) => setManualWorkout({ ...manualWorkout, type: e.target.value })}>
                  <option value="strength">Antrenman</option>
                  <option value="cardio">Kardiyo</option>
                  <option value="walk">Yürüyüş</option>
                  <option value="other">Aktivite</option>
                </select>
              </div>
              <div className="wl-field wl-field-wide">
                <label>Antrenman / Aktivite</label>
                <input
                  type="text"
                  placeholder="Full Body, yürüyüş, koşu..."
                  value={manualWorkout.name}
                  onChange={(e) => setManualWorkout({ ...manualWorkout, name: e.target.value })}
                />
              </div>
            </div>
            <div className="wl-field-grid">
              <div className="wl-field">
                <label>Süre (dk)</label>
                <input type="number" value={manualWorkout.duration_min} onChange={(e) => setManualWorkout({ ...manualWorkout, duration_min: e.target.value })} />
              </div>
              <div className="wl-field">
                <label>Aktif Kalori</label>
                <input type="number" value={manualWorkout.active_calories} onChange={(e) => setManualWorkout({ ...manualWorkout, active_calories: e.target.value })} />
              </div>
              <div className="wl-field">
                <label>Adım</label>
                <input type="number" value={manualWorkout.steps} onChange={(e) => setManualWorkout({ ...manualWorkout, steps: e.target.value })} />
              </div>
              <div className="wl-field">
                <label>Mesafe (km)</label>
                <input type="number" step="0.01" value={manualWorkout.distance_km} onChange={(e) => setManualWorkout({ ...manualWorkout, distance_km: e.target.value })} />
              </div>
            </div>
            <button className="wl-save-btn" onClick={handleSaveManual} disabled={isSaving}>
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        ) : !draft ? (
          <>
            <textarea
              className="wl-paste"
              rows={6}
              placeholder={'Hevy paylaşım metnini buraya yapıştır...\n\nÖrn:\nChest Press (Makine)\nSet 1: 9 kg x 12\nSet 2: 14 kg x 12'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button className="wl-parse-btn" onClick={handleParse} disabled={!pasteText.trim()}>
              🔍 Ayrıştır
            </button>
          </>
        ) : (
          <div className="wl-draft">
            <div className="wl-draft-title">
              <strong>{draft.title || 'Antrenman'}</strong>
              <span className="wl-draft-stats">
                {(() => { const s = workoutStats(draft); return `${s.exerciseCount} hareket · ${s.totalSets} set · ${s.volume} kg hacim`; })()}
              </span>
            </div>

            {draft.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="wl-ex">
                <div className="wl-ex-head">
                  <span className="wl-ex-name">{ex.name}</span>
                  <button className="wl-ex-remove" onClick={() => removeExercise(exIdx)} title="Hareketi kaldır">🗑️</button>
                </div>
                {ex.sets.length > 0 && (
                  <div className="wl-sets">
                    {ex.sets.map((s, setIdx) => (
                      <div key={setIdx} className={`wl-set ${s.isWarmup ? 'warmup' : ''}`}>
                        <span className="wl-set-no">{setIdx + 1}{s.isWarmup ? ' 🔥' : ''}</span>
                        <input type="number" step="0.5" value={s.weight_kg ?? ''} onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', e.target.value)} /> kg
                        <span className="wl-x">×</span>
                        <input type="number" value={s.reps ?? ''} onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)} /> tekrar
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="wl-row">
              <label>Süre (dk, ops.)</label>
              <input type="number" placeholder="70" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>

            <div className="wl-draft-actions">
              <button className="wl-save-btn" onClick={handleSave} disabled={isSaving}>
                {isSaving ? '💾 Kaydediliyor...' : `✅ ${fmtDate(date)} gününe kaydet`}
              </button>
              <button className="wl-cancel-btn" onClick={() => setDraft(null)}>İptal</button>
            </div>
          </div>
        )}
      </div>

      <div className="wl-history">
        <div className="wl-history-head">
          <h3>Geçmiş Antrenmanlar</h3>
          <span>{history.length} kayıt · son {HISTORY_DAYS} gün</span>
        </div>
        {loading ? (
          <p className="wl-empty">Yükleniyor...</p>
        ) : history.length === 0 ? (
          <p className="wl-empty">Henüz antrenman kaydı yok. Yukarıdan ilkini ekle!</p>
        ) : (
          history.map((item, i) => {
            const s = workoutStats(item.workout);
            return (
              <div key={i} className="wl-hist-item">
                <div className="wl-hist-info">
                  <div className="wl-hist-title">{item.workout.title || 'Antrenman'}</div>
                  <div className="wl-hist-meta">
                    {fmtDate(item.date)} · {s.exerciseCount} hareket · {s.totalSets} set
                    {s.volume > 0 ? ` · ${s.volume} kg` : ''}
                    {item.workout.duration_min ? ` · ${item.workout.duration_min} dk` : ''}
                  </div>
                  {item.workout.exercises?.length > 0 && (
                    <div className="wl-hist-exs">
                      {item.workout.exercises.map((e) => e.name).join(', ')}
                    </div>
                  )}
                </div>
                <button className="wl-hist-del" onClick={() => handleDelete(item)} title="Sil">🗑️</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkoutLog;
