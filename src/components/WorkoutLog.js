import React, { useState, useEffect, useCallback } from 'react';
import './WorkoutLog.css';
import { parseHevyWorkout, workoutStats } from '../utils/hevyParser';
import { getDailyLogsRange } from '../firebase/dataService';
import { addWorkout, deleteWorkout, updateWorkout } from '../firebase/dailyLogService';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';
import { getWeeklyWorkoutChecklist, getWeeklyWorkoutPlan, saveWeeklyWorkoutChecklist, saveWeeklyWorkoutPlan } from '../firebase/checklistService';
import { getWeekStart, isWeekChecked, toDateKey, weekKeyVariants } from '../utils/weekKeys';

/**
 * WorkoutLog - Hevy/ChatGPT antrenman metnini yapıştır → ayrıştır → seçili güne kaydet.
 * Veriyi dailyLogs/{uid}_{date}.workouts[] şemasına yazar (mevcut yapı).
 * Altında son antrenmanlar tarih tarih listelenir (düzenle/sil).
 */

const HISTORY_DAYS = 60;
const EMINE_EMAIL = 'emineay12@gmail.com';
const MELIH_EMAIL = 'altanmelihhh@gmail.com';
const DEFAULT_PLAN_FORM = { day: 1, title: '', type: 'walk', duration: '', optional: false };
const DEFAULT_HISTORY_FORM = { type: 'walk', title: '', duration_min: '', distance_km: '', exercises: [] };
const DAY_LABELS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const WORKOUT_TYPES = {
  walk: { label: 'Yürüyüş', detail: 'Adım, mesafe ve süre takibi', icon: '🚶' },
  cardio: { label: 'Kardiyo', detail: 'Koşu bandı, koşu, eliptik', icon: '❤️' },
  bike: { label: 'Bisiklet', detail: 'Açık alan veya kondisyon bisikleti', icon: '🚲' },
  sport: { label: 'Spor', detail: 'Tenis, basketbol, yüzme gibi', icon: '🎾' },
  strength: { label: 'Kuvvet / Set', detail: 'Ağırlık, reformer, makineler', icon: '🏋️' },
  mobility: { label: 'Mobilite', detail: 'Esneme, yoga, pilates', icon: '🧘' },
  other: { label: 'Diğer Aktivite', detail: 'Listeye uymayan hareket', icon: '✨' },
  rest: { label: 'Dinlenme', detail: 'Plan günü olarak işaretle', icon: '🌿' }
};
const EMINE_INITIAL_WEEKLY_PLAN = [
  { id: 'emine-walk-mon', day: 1, title: '30-45 dk yürüyüş', type: 'walk', duration: 45 },
  { id: 'emine-reformer-tue', day: 2, title: '50 dk Reformer', type: 'strength', duration: 50 },
  { id: 'emine-walk-wed', day: 3, title: '30-45 dk yürüyüş', type: 'walk', duration: 45 },
  { id: 'emine-reformer-thu', day: 4, title: '50 dk Reformer', type: 'strength', duration: 50 },
  { id: 'emine-walk-fri', day: 5, title: '30-45 dk yürüyüş', type: 'walk', duration: 45 },
  { id: 'emine-walk-sat', day: 6, title: 'İsteğe bağlı yürüyüş', type: 'walk', duration: 30, optional: true },
  { id: 'emine-rest-sun', day: 0, title: 'Dinlenme', type: 'rest', duration: 0 }
];
const MELIH_INITIAL_WEEKLY_PLAN = [
  { id: 'melih-fullbody-a-mon', day: 1, title: 'Full Body A + 15-20 dk Kardiyo', type: 'strength', duration: 80 },
  { id: 'melih-walk-tue', day: 2, title: '30-60 dk Tempolu Yürüyüş', type: 'walk', duration: 60 },
  { id: 'melih-fullbody-b-wed', day: 3, title: 'Full Body B + 15-20 dk Kardiyo', type: 'strength', duration: 80 },
  { id: 'melih-walk-thu', day: 4, title: '30-60 dk Tempolu Yürüyüş', type: 'walk', duration: 60 },
  { id: 'melih-fullbody-a-fri', day: 5, title: 'Full Body A + 15-20 dk Kardiyo', type: 'strength', duration: 80 },
  { id: 'melih-walk-sat', day: 6, title: '60-90 dk Tempolu Yürüyüş', type: 'walk', duration: 90 },
  { id: 'melih-walk-sun', day: 0, title: '60-90 dk Tempolu Yürüyüş', type: 'walk', duration: 90 }
];

const getInitialWeeklyPlan = (email) => {
  const normalized = (email || '').toLowerCase();
  if (normalized === EMINE_EMAIL) return EMINE_INITIAL_WEEKLY_PLAN;
  if (normalized === MELIH_EMAIL) return MELIH_INITIAL_WEEKLY_PLAN;
  return null;
};

const getPlanDate = (weekStart, planDay) => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + (planDay === 0 ? 6 : planDay - 1));
  return date;
};

const fmtDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

const fmtLongDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

const formatSet = (set, index) => {
  const weight = set.weight_kg == null || set.weight_kg === '' ? null : `${set.weight_kg} kg`;
  const reps = set.reps == null || set.reps === '' ? null : `${set.reps} tekrar`;
  const parts = [weight, reps].filter(Boolean);
  return `Set ${index + 1}: ${parts.length ? parts.join(' x ') : 'detay yok'}`;
};

const exerciseVolume = (exercise) =>
  (exercise.sets || []).reduce((sum, set) => {
    const weight = parseFloat(set.weight_kg) || 0;
    const reps = parseInt(set.reps, 10) || 0;
    return sum + (weight * reps);
  }, 0);

const exerciseBestSet = (exercise) => {
  const sets = (exercise.sets || []).filter((set) => set.weight_kg != null && set.reps != null);
  if (!sets.length) return null;
  return [...sets].sort((a, b) => ((b.weight_kg || 0) * (b.reps || 0)) - ((a.weight_kg || 0) * (a.reps || 0)))[0];
};

const cloneExercisesForForm = (exercises = []) =>
  exercises.map((exercise) => ({
    name: exercise.name || '',
    duration_min: exercise.duration_min ?? '',
    distance_km: exercise.distance_km ?? '',
    sets: (exercise.sets || []).map((set) => ({
      weight_kg: set.weight_kg ?? '',
      reps: set.reps ?? '',
      isWarmup: !!set.isWarmup
    }))
  }));

const normalizeExercisesFromForm = (exercises = []) =>
  exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      duration_min: exercise.duration_min === '' || exercise.duration_min == null ? null : parseFloat(exercise.duration_min),
      distance_km: exercise.distance_km === '' || exercise.distance_km == null ? null : parseFloat(exercise.distance_km),
      sets: (exercise.sets || [])
        .filter((set) => set.weight_kg !== '' || set.reps !== '')
        .map((set) => ({
          weight_kg: set.weight_kg === '' ? null : parseFloat(set.weight_kg),
          reps: set.reps === '' ? null : parseInt(set.reps, 10),
          isWarmup: !!set.isWarmup
        }))
    }))
    .filter((exercise) => exercise.name || exercise.sets.length > 0 || exercise.duration_min || exercise.distance_km);

const WorkoutLog = ({ user }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pasteText, setPasteText] = useState('');
  const [draft, setDraft] = useState(null); // ayrıştırılmış {title, exercises}
  const [durationMin, setDurationMin] = useState('');
  const [entryMode, setEntryMode] = useState('manual');
  const [manualWorkout, setManualWorkout] = useState({
    type: 'walk',
    name: '',
    duration_min: '',
    distance_km: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [history, setHistory] = useState([]); // [{date, index, workout}]
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [weeklyChecklist, setWeeklyChecklist] = useState({});
  const [planForm, setPlanForm] = useState(DEFAULT_PLAN_FORM);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [editingHistoryKey, setEditingHistoryKey] = useState(null);
  const [historyForm, setHistoryForm] = useState(DEFAULT_HISTORY_FORM);
  const [historyPasteText, setHistoryPasteText] = useState('');
  const [expandedHistoryKey, setExpandedHistoryKey] = useState(null);

  const weekStart = getWeekStart();
  const weekStartKey = toDateKey(weekStart);
  const completedPlanCount = weeklyPlan.filter((item) => isWeekChecked(weeklyChecklist, weekStartKey, item.id)).length;

  useEffect(() => {
    if (!user) return;
    (async () => {
      let plan = await getWeeklyWorkoutPlan(user.uid);
      const initialPlan = getInitialWeeklyPlan(user.email);
      const seededKey = `weekly_workout_plan_seeded_v3:${(user.email || '').toLowerCase()}`;
      const seeded = getScopedJson(seededKey, user.uid, false);
      if (initialPlan && !seeded && plan.length === 0) {
        plan = await saveWeeklyWorkoutPlan(user.uid, initialPlan);
      }
      if (initialPlan && !seeded) {
        setScopedJson(seededKey, user.uid, true);
      }
      setWeeklyPlan(plan);
      setWeeklyChecklist(await getWeeklyWorkoutChecklist(user.uid));
    })().catch(() => {
      setWeeklyPlan(getScopedJson('weekly_workout_plan', user.uid, []));
      setWeeklyChecklist(getScopedJson('weekly_workout_checklist', user.uid, {}));
    });
  }, [user]);

  const persistChecklist = async (next) => {
    setWeeklyChecklist(next);
    await saveWeeklyWorkoutChecklist(user?.uid, next);
  };

  const toggleWeeklyPlan = (item) => {
    const next = { ...weeklyChecklist };
    // Eski ISO kaymalı anahtar da temizlenmeli, yoksa işaret kaldırılamaz.
    weekKeyVariants(weekStartKey).forEach((key) => { delete next[`${key}:${item.id}`]; });
    if (!isWeekChecked(weeklyChecklist, weekStartKey, item.id)) {
      next[`${weekStartKey}:${item.id}`] = true;
    }
    persistChecklist(next);
  };

  const persistPlan = async (next) => {
    const saved = await saveWeeklyWorkoutPlan(user?.uid, next);
    setWeeklyPlan(saved);
  };

  const resetPlanForm = () => {
    setPlanForm(DEFAULT_PLAN_FORM);
    setEditingPlanId(null);
    setIsPlanFormOpen(false);
  };

  const handleSavePlanItem = async () => {
    if (!planForm.title.trim()) {
      alert('Plan adı boş olamaz.');
      return;
    }
    const item = {
      id: editingPlanId || `${Date.now()}-${Math.random()}`,
      day: parseInt(planForm.day, 10),
      title: planForm.title.trim(),
      type: planForm.type,
      duration: parseFloat(planForm.duration) || 0,
      optional: !!planForm.optional
    };
    const next = editingPlanId
      ? weeklyPlan.map((existing) => (existing.id === editingPlanId ? item : existing))
      : [...weeklyPlan, item];
    await persistPlan(next.sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)));
    resetPlanForm();
  };

  const handleEditPlanItem = (item) => {
    setPlanForm({
      day: item.day,
      title: item.title,
      type: item.type || 'other',
      duration: item.duration || '',
      optional: !!item.optional
    });
    setEditingPlanId(item.id);
    setIsPlanFormOpen(true);
  };

  const handleDeletePlanItem = async (item) => {
    if (!window.confirm(`"${item.title}" checklist'ten silinsin mi?`)) return;
    await persistPlan(weeklyPlan.filter((existing) => existing.id !== item.id));
    const nextChecks = { ...weeklyChecklist };
    Object.keys(nextChecks).forEach((key) => {
      if (key.endsWith(`:${item.id}`)) delete nextChecks[key];
    });
    await persistChecklist(nextChecks);
  };

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
          if ((w.type || 'other') === 'strength' || s.totalSets > 0) week.strengthSessions = (week.strengthSessions || 0) + 1;
          if ((w.type || 'other') !== 'strength' && (w.type || 'other') !== 'rest') week.activitySessions = (week.activitySessions || 0) + 1;
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
    if (parsed.date && parsed.date <= new Date().toISOString().split('T')[0]) {
      setDate(parsed.date);
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

  const updateDraftExercise = (exIdx, changes) => {
    const exercises = draft.exercises.map((ex, i) => (i === exIdx ? { ...ex, ...changes } : ex));
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
          duration_min: ex.duration_min ? parseFloat(ex.duration_min) : null,
          distance_km: ex.distance_km ? parseFloat(ex.distance_km) : null,
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
    const hasWorkout = manualWorkout.name.trim() || manualWorkout.duration_min || manualWorkout.distance_km;
    if (!hasWorkout) {
      alert('En az antrenman adı, süre veya mesafe girin');
      return;
    }
    setIsSaving(true);
    try {
      const typeMeta = WORKOUT_TYPES[manualWorkout.type] || WORKOUT_TYPES.other;
      await addWorkout(user.uid, date, {
        type: manualWorkout.type,
        source: 'manual',
        title: manualWorkout.name.trim() || typeMeta.label,
        duration_min: manualWorkout.duration_min ? parseFloat(manualWorkout.duration_min) : null,
        calories: null,
        distance_km: manualWorkout.distance_km ? parseFloat(manualWorkout.distance_km) : null,
        exercises: []
      });
      setSavedMsg(true);
      setManualWorkout({ type: 'walk', name: '', duration_min: '', distance_km: '' });
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

  const handleEditHistory = (item) => {
    const key = `${item.date}:${item.index}`;
    setEditingHistoryKey(key);
    setExpandedHistoryKey(key);
    setHistoryPasteText('');
    setHistoryForm({
      type: item.workout.type || 'other',
      title: item.workout.title || '',
      duration_min: item.workout.duration_min ?? '',
      distance_km: item.workout.distance_km ?? '',
      exercises: cloneExercisesForForm(item.workout.exercises || [])
    });
  };

  const handleCancelHistoryEdit = () => {
    setEditingHistoryKey(null);
    setHistoryPasteText('');
    setHistoryForm(DEFAULT_HISTORY_FORM);
  };

  const handleSaveHistoryEdit = async (item) => {
    if (!historyForm.title.trim()) {
      alert('Antrenman adı boş olamaz.');
      return;
    }
    setIsSaving(true);
    try {
      await updateWorkout(user.uid, item.date, item.index, {
        type: historyForm.type,
        title: historyForm.title.trim(),
        duration_min: historyForm.duration_min === '' ? null : parseFloat(historyForm.duration_min),
        distance_km: historyForm.distance_km === '' ? null : parseFloat(historyForm.distance_km),
        exercises: normalizeExercisesFromForm(historyForm.exercises)
      });
      handleCancelHistoryEdit();
      setSavedMsg(true);
      await loadHistory();
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      alert('Güncelleme hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateHistoryExercise = (exerciseIndex, changes) => {
    setHistoryForm((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => (
        index === exerciseIndex ? { ...exercise, ...changes } : exercise
      ))
    }));
  };

  const updateHistorySet = (exerciseIndex, setIndex, changes) => {
    setHistoryForm((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, innerIndex) => (
            innerIndex === setIndex ? { ...set, ...changes } : set
          ))
        };
      })
    }));
  };

  const addHistorySet = (exerciseIndex) => {
    setHistoryForm((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => (
        index === exerciseIndex
          ? { ...exercise, sets: [...exercise.sets, { weight_kg: '', reps: '', isWarmup: false }] }
          : exercise
      ))
    }));
  };

  const removeHistorySet = (exerciseIndex, setIndex) => {
    setHistoryForm((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => (
        index === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, innerIndex) => innerIndex !== setIndex) }
          : exercise
      ))
    }));
  };

  const addHistoryExercise = () => {
    setHistoryForm((current) => ({
      ...current,
      exercises: [...current.exercises, { name: '', sets: [{ weight_kg: '', reps: '', isWarmup: false }] }]
    }));
  };

  const removeHistoryExercise = (exerciseIndex) => {
    setHistoryForm((current) => ({
      ...current,
      exercises: current.exercises.filter((_, index) => index !== exerciseIndex)
    }));
  };

  const applyHistoryPasteText = () => {
    const parsed = parseHevyWorkout(historyPasteText);
    if (!parsed.exercises.length) {
      alert('Metinden hareket/set bulunamadı.');
      return;
    }
    setHistoryForm((current) => ({
      ...current,
      title: parsed.title || current.title,
      type: 'strength',
      exercises: cloneExercisesForForm(parsed.exercises)
    }));
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
          <div className="wl-summary-card"><span>Kuvvet</span><strong>{weeklySummary.strengthSessions || 0}</strong><small>setli antrenman</small></div>
          <div className="wl-summary-card"><span>Aktivite</span><strong>{weeklySummary.activitySessions || 0}</strong><small>yürüyüş/spor</small></div>
          <div className="wl-summary-card"><span>Aktif</span><strong>{Math.round(weeklySummary.activeCalories).toLocaleString('tr-TR')}</strong><small>kcal</small></div>
          <div className="wl-summary-card"><span>Süre</span><strong>{Math.round(weeklySummary.exerciseMinutes || weeklySummary.duration)}</strong><small>dk</small></div>
          <div className="wl-summary-card"><span>Mesafe</span><strong>{Math.round((weeklySummary.distance || 0) * 10) / 10}</strong><small>km</small></div>
        </div>
      )}

      <div className="emine-weekly-plan">
        <div className="emine-weekly-head">
          <div>
            <span className="wl-eyebrow">Haftalık Plan</span>
            <h3>Haftalık Spor Checklist</h3>
          </div>
          <div className="weekly-plan-head-actions">
            <strong>{completedPlanCount}/{weeklyPlan.length}</strong>
          </div>
        </div>

        <p className="wl-hist-edit-note">
          Yaptığın günü işaretlemen yeterli; ayrıca kayıt eklemene gerek yok. Antrenman detaylarını aşağıdaki bölümden ayrı giriyorsun.
        </p>

        {isPlanFormOpen && (
          <div className="weekly-plan-form">
            <div className="weekly-plan-form-grid">
              <label>Gün
                <select value={planForm.day} onChange={(e) => setPlanForm({ ...planForm, day: e.target.value })}>
                  {DAY_LABELS.map((label, day) => (
                    <option key={day} value={day}>{label}</option>
                  ))}
                </select>
              </label>
              <label>Aktivite
                <input value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} />
              </label>
              <label>Tip
                <select value={planForm.type} onChange={(e) => setPlanForm({ ...planForm, type: e.target.value })}>
                  {Object.entries(WORKOUT_TYPES).map(([key, type]) => (
                    <option key={key} value={key}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label>Süre
                <input type="number" value={planForm.duration} onChange={(e) => setPlanForm({ ...planForm, duration: e.target.value })} />
              </label>
              <label className="weekly-plan-check">
                <input type="checkbox" checked={planForm.optional} onChange={(e) => setPlanForm({ ...planForm, optional: e.target.checked })} />
                Opsiyonel
              </label>
            </div>
            <div className="weekly-plan-form-actions">
              <button type="button" onClick={handleSavePlanItem}>{editingPlanId ? 'Güncelle' : 'Kaydet'}</button>
              <button type="button" className="secondary" onClick={resetPlanForm}>İptal</button>
            </div>
          </div>
        )}

        <div className="emine-weekly-list">
          {weeklyPlan.length === 0 ? (
            <p className="wl-empty">Henüz checklist yok. Haftalık planını ekleyerek başlayabilirsin.</p>
          ) : weeklyPlan.map((item) => {
            const planDate = toDateKey(getPlanDate(weekStart, item.day));
            const checked = isWeekChecked(weeklyChecklist, weekStartKey, item.id);
            return (
              <div key={item.id} className={`emine-weekly-item ${checked ? 'done' : ''}`}>
                <label>
                  <input type="checkbox" checked={checked} onChange={() => toggleWeeklyPlan(item)} />
                  <span>
                    <strong>{DAY_LABELS[item.day]}</strong>
                    <small>{item.title}{item.optional ? ' · opsiyonel' : ''}</small>
                  </span>
                </label>
                <button type="button" onClick={() => handleEditPlanItem(item)} disabled={isSaving}>Düzenle</button>
                <button type="button" className="danger" onClick={() => handleDeletePlanItem(item)} disabled={isSaving}>Sil</button>
                <time>{fmtDate(planDate)}</time>
              </div>
            );
          })}
        </div>
      </div>

      <div className="wl-entry">
        <div className="wl-row">
          <label>Tarih</label>
          <input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="wl-mode-tabs">
          <button className={entryMode === 'manual' ? 'active' : ''} onClick={() => setEntryMode('manual')}>Aktivite Kaydı</button>
          <button className={entryMode === 'paste' ? 'active' : ''} onClick={() => setEntryMode('paste')}>Setli Antrenman</button>
        </div>

        {entryMode === 'manual' ? (
          <div className="wl-manual">
            <div className="wl-type-grid">
              {Object.entries(WORKOUT_TYPES).filter(([key]) => key !== 'rest').map(([key, type]) => (
                <button
                  key={key}
                  type="button"
                  className={manualWorkout.type === key ? 'active' : ''}
                  onClick={() => setManualWorkout({ ...manualWorkout, type: key })}
                >
                  <span>{type.icon}</span>
                  <strong>{type.label}</strong>
                  <small>{type.detail}</small>
                </button>
              ))}
            </div>
            <div className="wl-field-grid">
              <div className="wl-field wl-field-wide">
                <label>Aktivite Adı</label>
                <input
                  type="text"
                  placeholder="Örn: Yürüyüş, tenis, bisiklet, reformer..."
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
                <label>Mesafe (km)</label>
                <input type="number" step="0.01" value={manualWorkout.distance_km} onChange={(e) => setManualWorkout({ ...manualWorkout, distance_km: e.target.value })} />
              </div>
            </div>
            <p className="wl-form-note">
              Bu kayıt sadece antrenman geçmişine eklenir. Apple Watch adım, mesafe ve aktif kalori değerleri Bugün sekmesindeki Aktivite alanından ayrı girilir.
            </p>
            <button className="wl-save-btn" onClick={handleSaveManual} disabled={isSaving}>
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        ) : !draft ? (
          <>
            <textarea
              className="wl-paste"
              rows={10}
              placeholder={'Hevy paylaşım metnini buraya yapıştır...\n\nÖrn:\nTüm Vücut 1\nCuma, Ağu 07, 2026, 7:39am\n\nKoşu Bandı\nChest Press (Makine)\nSet 1: 9 kg x 15 [Isınma]\nSet 2: 14 kg x 12\nSet 3: 18 kg x 12\n\nYürüme'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button className="wl-parse-btn" onClick={handleParse} disabled={!pasteText.trim()}>
              🔍 Ayrıştır
            </button>
          </>
        ) : (
          <div className="wl-draft">
            <div className="wl-draft-title workout-session-title">
              <div>
                <small>Önizleme</small>
                <strong>{draft.title || 'Antrenman'}</strong>
                <span>{fmtLongDate(date)}{draft.time ? ` · ${draft.time}` : ''}</span>
              </div>
              <div className="wl-session-kpis">
                {(() => {
                  const s = workoutStats(draft);
                  return (
                    <>
                      <span><strong>{s.exerciseCount}</strong><small>hareket</small></span>
                      <span><strong>{s.totalSets}</strong><small>set</small></span>
                      <span><strong>{s.volume.toLocaleString('tr-TR')}</strong><small>kg hacim</small></span>
                    </>
                  );
                })()}
              </div>
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
                {ex.sets.length === 0 && (
                  <div className="wl-activity-note-fields">
                    <span>Setsiz aktivite</span>
                    <label>
                      Süre
                      <input
                        type="number"
                        placeholder="35"
                        value={ex.duration_min ?? ''}
                        onChange={(e) => updateDraftExercise(exIdx, { duration_min: e.target.value })}
                      />
                      dk
                    </label>
                    <label>
                      Mesafe
                      <input
                        type="number"
                        step="0.01"
                        placeholder="ops."
                        value={ex.distance_km ?? ''}
                        onChange={(e) => updateDraftExercise(exIdx, { distance_km: e.target.value })}
                      />
                      km
                    </label>
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
            const type = WORKOUT_TYPES[item.workout.type] || WORKOUT_TYPES.other;
            const isStrength = item.workout.type === 'strength' || s.totalSets > 0;
            const showExerciseKpis = isStrength && s.exerciseCount > 0;
            const editKey = `${item.date}:${item.index}`;
            const isEditing = editingHistoryKey === editKey;
            const isExpanded = expandedHistoryKey === editKey;
            return (
              <div key={i} className={`wl-hist-item ${isExpanded ? 'expanded' : ''}`}>
                {isEditing ? (
                  <div className="wl-history-edit">
                    <div className="wl-field-grid">
                      <div className="wl-field">
                        <label>Tür</label>
                        <select value={historyForm.type} onChange={(e) => setHistoryForm({ ...historyForm, type: e.target.value })}>
                          {Object.entries(WORKOUT_TYPES).filter(([key]) => key !== 'rest').map(([key, workoutType]) => (
                            <option key={key} value={key}>{workoutType.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="wl-field wl-field-wide">
                        <label>Ad</label>
                        <input value={historyForm.title} onChange={(e) => setHistoryForm({ ...historyForm, title: e.target.value })} />
                      </div>
                      <div className="wl-field">
                        <label>Süre (dk)</label>
                        <input type="number" value={historyForm.duration_min} onChange={(e) => setHistoryForm({ ...historyForm, duration_min: e.target.value })} />
                      </div>
                      <div className="wl-field">
                        <label>Mesafe (km)</label>
                        <input type="number" step="0.01" value={historyForm.distance_km} onChange={(e) => setHistoryForm({ ...historyForm, distance_km: e.target.value })} />
                      </div>
                    </div>
                    <div className="wl-history-set-editor">
                      <div className="wl-history-set-editor-head">
                        <strong>Hareketler ve setler</strong>
                        <button type="button" className="secondary" onClick={addHistoryExercise}>Hareket ekle</button>
                      </div>
                      <div className="wl-history-paste-replace">
                        <textarea
                          rows={5}
                          placeholder="Hevy/set metnini buraya yapıştırıp mevcut hareketleri metinden doldurabilirsin."
                          value={historyPasteText}
                          onChange={(event) => setHistoryPasteText(event.target.value)}
                        />
                        <button type="button" className="secondary" onClick={applyHistoryPasteText} disabled={!historyPasteText.trim()}>
                          Setleri metinden doldur
                        </button>
                      </div>
                      {historyForm.exercises.length === 0 ? (
                        <p className="wl-hist-edit-note">Bu kayıtta setli hareket yok. İstersen hareket ekleyebilirsin.</p>
                      ) : (
                        <div className="wl-history-exercise-editor-list">
                          {historyForm.exercises.map((exercise, exerciseIndex) => (
                            <div key={exerciseIndex} className="wl-history-exercise-editor">
                              <div className="wl-history-exercise-editor-head">
                                <input
                                  value={exercise.name}
                                  placeholder="Hareket adı"
                                  onChange={(event) => updateHistoryExercise(exerciseIndex, { name: event.target.value })}
                                />
                                <button type="button" className="danger" onClick={() => removeHistoryExercise(exerciseIndex)}>Sil</button>
                              </div>
                              <div className="wl-history-set-editor-list">
                                {exercise.sets.map((set, setIndex) => (
                                  <div key={setIndex} className={`wl-history-set-editor-row ${set.isWarmup ? 'warmup' : ''}`}>
                                    <span>Set {setIndex + 1}</span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={set.weight_kg}
                                      placeholder="kg"
                                      onChange={(event) => updateHistorySet(exerciseIndex, setIndex, { weight_kg: event.target.value })}
                                    />
                                    <input
                                      type="number"
                                      value={set.reps}
                                      placeholder="tekrar"
                                      onChange={(event) => updateHistorySet(exerciseIndex, setIndex, { reps: event.target.value })}
                                    />
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={set.isWarmup}
                                        onChange={(event) => updateHistorySet(exerciseIndex, setIndex, { isWarmup: event.target.checked })}
                                      />
                                      Isınma
                                    </label>
                                    <button type="button" className="secondary" onClick={() => removeHistorySet(exerciseIndex, setIndex)}>Sil</button>
                                  </div>
                                ))}
                              </div>
                              {exercise.sets.length === 0 && (
                                <div className="wl-activity-note-fields history">
                                  <span>Setsiz aktivite</span>
                                  <label>
                                    Süre
                                    <input
                                      type="number"
                                      placeholder="35"
                                      value={exercise.duration_min ?? ''}
                                      onChange={(event) => updateHistoryExercise(exerciseIndex, { duration_min: event.target.value })}
                                    />
                                    dk
                                  </label>
                                  <label>
                                    Mesafe
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="ops."
                                      value={exercise.distance_km ?? ''}
                                      onChange={(event) => updateHistoryExercise(exerciseIndex, { distance_km: event.target.value })}
                                    />
                                    km
                                  </label>
                                </div>
                              )}
                              <button type="button" className="secondary wl-add-set-btn" onClick={() => addHistorySet(exerciseIndex)}>Set ekle</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="wl-history-edit-actions">
                      <button type="button" onClick={() => handleSaveHistoryEdit(item)} disabled={isSaving}>Kaydet</button>
                      <button type="button" className="secondary" onClick={handleCancelHistoryEdit} disabled={isSaving}>İptal</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="wl-hist-info">
                      <button
                        type="button"
                        className="wl-session-header"
                        onClick={() => setExpandedHistoryKey(isExpanded ? null : editKey)}
                        aria-expanded={isExpanded}
                      >
                        <div className="wl-session-title">
                          <small>{fmtLongDate(item.date)}</small>
                          <strong><span>{type.icon}</span>{item.workout.title || type.label}</strong>
                        </div>
                        <div className="wl-session-kpis">
                          {showExerciseKpis && <span><strong>{s.exerciseCount}</strong><small>hareket</small></span>}
                          {showExerciseKpis && s.totalSets > 0 && <span><strong>{s.totalSets}</strong><small>set</small></span>}
                          {isStrength && s.volume > 0 && <span><strong>{s.volume.toLocaleString('tr-TR')}</strong><small>kg hacim</small></span>}
                          {item.workout.duration_min && <span><strong>{item.workout.duration_min}</strong><small>dk</small></span>}
                          {item.workout.distance_km && <span><strong>{item.workout.distance_km}</strong><small>km</small></span>}
                        </div>
                        <span className="wl-expand-indicator">{isExpanded ? 'Kapat' : 'Aç'}</span>
                      </button>
                      {isExpanded && isStrength && item.workout.exercises?.length > 0 && (
                        <div className="wl-workout-detail">
                          <div className="wl-workout-detail-head">
                            {showExerciseKpis && <span>{s.exerciseCount} hareket</span>}
                            {showExerciseKpis && <span>{s.totalSets} set</span>}
                            {s.volume > 0 && <span>{s.volume.toLocaleString('tr-TR')} kg hacim</span>}
                          </div>
                          <div className="wl-exercise-list">
                            {item.workout.exercises.map((exercise, exIndex) => {
                              const sets = exercise.sets || [];
                              const volume = exerciseVolume(exercise);
                              const bestSet = exerciseBestSet(exercise);
                              return (
                                <div key={`${exercise.name}-${exIndex}`} className={`wl-exercise-detail ${sets.length === 0 ? 'no-sets' : ''}`}>
                                  <div className="wl-exercise-detail-head">
                                    <strong>{exercise.name}</strong>
                                    <span>
                                      {sets.length > 0
                                        ? `${sets.length} set${volume > 0 ? ` · ${Math.round(volume).toLocaleString('tr-TR')} kg` : ''}`
                                        : [
                                            'setsiz aktivite',
                                            exercise.duration_min ? `${exercise.duration_min} dk` : null,
                                            exercise.distance_km ? `${exercise.distance_km} km` : null
                                          ].filter(Boolean).join(' · ')}
                                    </span>
                                  </div>
                                  {bestSet && (
                                    <div className="wl-best-set">
                                      En iyi set: {bestSet.weight_kg} kg x {bestSet.reps}
                                    </div>
                                  )}
                                  {sets.length > 0 ? (
                                    <div className="wl-set-table">
                                      {sets.map((set, setIndex) => (
                                        <div key={setIndex} className={`wl-set-row ${set.isWarmup ? 'warmup' : ''}`}>
                                          <span>{formatSet(set, setIndex)}</span>
                                          {set.isWarmup && <small>Isınma</small>}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>
                                      Bu satır kardiyo/aktivite notu olarak saklandı.
                                      {exercise.duration_min ? ` Süre: ${exercise.duration_min} dk.` : ''}
                                      {exercise.distance_km ? ` Mesafe: ${exercise.distance_km} km.` : ''}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {isExpanded && !isStrength && (
                        <div className="wl-workout-detail">
                          <div className="wl-workout-detail-head">
                            <span>{type.label}</span>
                            {item.workout.duration_min && <span>{item.workout.duration_min} dk</span>}
                            {item.workout.distance_km && <span>{item.workout.distance_km} km</span>}
                          </div>
                          <p className="wl-activity-detail-note">
                            Bu kayıt setli kuvvet antrenmanı değil; süre ve mesafe bilgisi antrenman geçmişinde tutulur.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="wl-hist-actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleEditHistory(item); }} title="Düzenle">Düzenle</button>
                      <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); handleDelete(item); }} title="Sil">Sil</button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkoutLog;
