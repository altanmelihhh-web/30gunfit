import React, { useState, useEffect, useCallback } from 'react';
import './WorkoutLog.css';
import { parseHevyWorkout, workoutStats } from '../utils/hevyParser';
import { getDailyLogsRange } from '../firebase/dataService';
import { addWorkout, deleteWorkout } from '../firebase/dailyLogService';

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
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [history, setHistory] = useState([]); // [{date, index, workout}]
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
      dates.forEach((dt) => {
        (logs[dt]?.workouts || []).forEach((w, index) => {
          // Sadece hareket/set içeren gerçek antrenmanları göster (jenerik vitals değil)
          if ((w.exercises && w.exercises.length > 0) || w.title) {
            items.push({ date: dt, index, workout: w });
          }
        });
      });
      setHistory(items);
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
        <h2>🏋️ Antrenman Günlüğü</h2>
        <p>Hevy veya ChatGPT antrenman metnini yapıştır, ayrıştır, o güne kaydet.</p>
      </div>

      {savedMsg && <div className="wl-success">✅ Antrenman kaydedildi!</div>}

      <div className="wl-entry">
        <div className="wl-row">
          <label>Tarih</label>
          <input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} />
        </div>

        {!draft ? (
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
        <h3>Geçmiş Antrenmanlar</h3>
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
