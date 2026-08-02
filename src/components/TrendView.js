import React, { useState, useEffect, useCallback } from 'react';
import './TrendView.css';
import { getCalorieTrackingRange, getDailyLogsRange, getWaterTracker, saveWaterTracker, saveDailyLog, getDailyLog, getNutritionGoals, saveNutritionGoals, getUserProfile } from '../firebase/dataService';
import { computeBMR, dayBurned, dayDeficit, avgDeficit as avgDeficitFn } from '../utils/calorieMath';
import {
  saveSleep, deleteSleep, saveVitals, deleteVitals,
  addSupplement, updateSupplement, deleteSupplement,
  addWorkout, updateWorkout, deleteWorkout
} from '../firebase/dailyLogService';
import { getMeals, addMeal, updateMeal, deleteMeal, getRecentMeals } from '../firebase/mealsService';
import { callGeminiForText } from '../utils/geminiClient';
import GeminiQuotaBadge from './GeminiQuotaBadge';

const WORKOUT_TYPE_LABELS = { strength: 'Antrenman', cardio: 'Kardiyo', walk: 'Yürüyüş', other: 'Aktivite' };

const RANGE_DAYS = { day: 1, week: 7, month: 30 };

// Gün görünümündeki öğün kategorileri - kullanıcının günlük rapor taslağındaki 5 öğün bölümü + Öğle
const MEAL_CATEGORIES = [
  { key: 'kahvalti', title: '🌅 Kahvaltı', mealType: 'breakfast', mealLabel: null },
  { key: 'ogle', title: '☀️ Öğle', mealType: 'lunch', mealLabel: null },
  { key: 'sporSonrasi', title: '🥤 Spor Sonrası', mealType: 'snack', mealLabel: 'Spor Sonrası' },
  { key: 'araOgun', title: '🍎 Ara Öğün', mealType: 'snack', mealLabel: 'Ara Öğün' },
  { key: 'aksam', title: '🌙 Akşam Yemeği', mealType: 'dinner', mealLabel: null },
  { key: 'gece', title: '🌃 Gece Atıştırması', mealType: 'snack', mealLabel: 'Gece Atıştırması' }
];

// Düzenli kullanılan takviyeler - tek dokunuşla "alındı" olarak eklenir
const QUICK_SUPPLEMENTS = [
  { name: 'Whey Protein', dose: '1 porsiyon' },
  { name: 'Kreatin', dose: '5g' },
  { name: 'Magnezyum', dose: '1 tablet' },
  { name: 'D2+K3', dose: '1 tablet' },
  { name: 'Omega-3', dose: '3 kapsül' }
];

const classifyMeal = (m) => {
  // Etiket öncelikli; eski kayıtlarda etiket yoksa öğün ADI üzerinden tahmin
  // (örn. Hızlı Giriş'le eklenen "Kahvaltı - 3 Tam Yumurta..." adlı snack kaydı)
  const label = (m.mealLabel || '').toLocaleLowerCase('tr');
  const name = (m.name || '').toLocaleLowerCase('tr');
  const text = label || name;
  if (text.includes('spor sonras')) return 'sporSonrasi';
  if (text.includes('gece')) return 'gece';
  if (text.includes('ara öğün') || text.includes('ara ogun')) return 'araOgun';
  if (text.includes('kahvalt') || m.mealType === 'breakfast') return 'kahvalti';
  if (text.includes('akşam') || m.mealType === 'dinner') return 'aksam';
  if (text.includes('öğle') || m.mealType === 'lunch') return 'ogle';
  return 'araOgun';
};

// Öğün adının başındaki gereksiz kategori önekini temizle ("Kahvaltı - 3 Yumurta" → "3 Yumurta")
const stripCategoryPrefix = (name) =>
  (name || '').replace(/^(kahvaltı|öğle( yemeği)?|akşam( yemeği)?|ara öğün|spor sonrası|gece atıştırması)\s*[-–—:]\s*/i, '');

// Takviye adı karşılaştırması: boşluk/nokta farklarını yok say ("D2 + K3" ≡ "D2+K3")
const normalizeSupplementName = (name) =>
  (name || '').toLocaleLowerCase('tr').replace(/[\s.]/g, '');

const getDateList = (anchorDate, rangeKey) => {
  const days = RANGE_DAYS[rangeKey];
  const dates = [];
  const anchor = new Date(anchorDate);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const formatShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const TrendView = ({ user }) => {
  const [rangeKey, setRangeKey] = useState('week');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [calorieData, setCalorieData] = useState({});
  const [logData, setLogData] = useState({});
  const [waterByDate, setWaterByDate] = useState({});
  const [geminiComment, setGeminiComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Gün görünümünde düzenleme - null | 'sleep' | 'vitals' | 'water' | 'workout-new' | 'workout-{i}'
  // | 'supplement-new' | 'supplement-{i}' | 'meal-new-{catKey}' | 'meal-{id}'
  const [editingSection, setEditingSection] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [recentMeals, setRecentMeals] = useState([]);
  const [goals, setGoals] = useState(null); // {calories, protein, carbs, fats, water}
  const [bmr, setBmr] = useState(null); // profil BMR'si (gerçek kalori açığı için)

  // Profil → BMR (kalori açığı hesabı için)
  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((res) => {
      if (res?.success && res.data) setBmr(computeBMR(res.data));
    }).catch(() => {});
  }, [user]);

  // SABİT hedefleri yükle: önce Firestore, yoksa localStorage, yoksa Hesaplayıcı planından türet
  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await getNutritionGoals(user.uid);
      if (result.success) {
        setGoals(result.data);
        localStorage.setItem('nutrition_goals', JSON.stringify(result.data));
        return;
      }
      const savedGoals = localStorage.getItem('nutrition_goals');
      if (savedGoals) { setGoals(JSON.parse(savedGoals)); return; }
      // İlk kez: eski Hesaplayıcı planı varsa ondan başlangıç değeri al
      try {
        const plan = JSON.parse(localStorage.getItem('nutrition_plan') || 'null');
        if (plan) {
          setGoals({
            calories: plan.targetCalories || 2400,
            protein: plan.macros?.protein?.grams || 180,
            carbs: plan.macros?.carbs?.grams || 210,
            fats: plan.macros?.fats?.grams || 80,
            water: 4000
          });
        }
      } catch { /* yoksay */ }
    })();
  }, [user]);

  const waterGoal = goals?.water || 4000;

  // Sık yenenler - gün görünümünde öğün eklerken hızlı-tekrar için
  useEffect(() => {
    if (!user || rangeKey !== 'day') return;
    getRecentMeals(user.uid).then(setRecentMeals).catch(() => {});
  }, [user, rangeKey]);

  const dates = getDateList(anchorDate, rangeKey);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setGeminiComment('');
    try {
      const [calories, logs, waterResult] = await Promise.all([
        getCalorieTrackingRange(user.uid, dates),
        getDailyLogsRange(user.uid, dates),
        getWaterTracker(user.uid)
      ]);
      setCalorieData(calories);
      setLogData(logs);

      const waterMap = {};
      if (waterResult.success) {
        (waterResult.data.entries || []).forEach((entry) => {
          if (dates.includes(entry.date)) {
            waterMap[entry.date] = (waterMap[entry.date] || 0) + entry.amount;
          }
        });
      }
      setWaterByDate(waterMap);

      // Gün görünümünde mevcut notu düzenleme kutusuna yükle
      if (rangeKey === 'day') {
        const todayLog = logs[anchorDate];
        setNoteDraft(todayLog?.notes || '');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, anchorDate, rangeKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dailyTotals = dates.map((date) => {
    const meals = calorieData[date]?.meals || [];
    const calories = meals.reduce((sum, m) => sum + (parseFloat(m.calories) || 0), 0);
    const protein = meals.reduce((sum, m) => sum + (parseFloat(m.protein) || 0), 0);
    const carbs = meals.reduce((sum, m) => sum + (parseFloat(m.carbs) || 0), 0);
    const fats = meals.reduce((sum, m) => sum + (parseFloat(m.fats) || 0), 0);
    const water = waterByDate[date] || 0;
    const log = logData[date];
    return {
      date,
      meals,
      calories,
      protein,
      carbs,
      fats,
      water,
      sleepHours: log?.sleep?.duration_hours || null,
      sleepScore: log?.sleep?.score || null,
      supplements: log?.supplements || [],
      workouts: log?.workouts || [],
      vitals: log?.vitals || null,
      notes: log?.notes || null
    };
  });

  const daysWithData = dailyTotals.filter((d) => d.calories > 0 || d.water > 0);
  const avgCalories = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length)
    : 0;
  const avgWater = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.water, 0) / daysWithData.length)
    : 0;
  const sleepDays = dailyTotals.filter((d) => d.sleepHours);
  const avgSleep = sleepDays.length
    ? (sleepDays.reduce((s, d) => s + d.sleepHours, 0) / sleepDays.length).toFixed(1)
    : null;
  const stepsDays = dailyTotals.filter((d) => d.vitals?.steps);
  const avgSteps = stepsDays.length
    ? Math.round(stepsDays.reduce((s, d) => s + (d.vitals.steps || 0), 0) / stepsDays.length)
    : null;
  // Antrenman süresi ortalaması - antrenman yapılan günler üzerinden (seanslardaki dk toplamı)
  const workoutMinByDay = dailyTotals.map((d) =>
    d.workouts.reduce((s, w) => s + (parseFloat(w.duration_min) || 0), 0)
  );
  const workoutDaysMin = workoutMinByDay.filter((m) => m > 0);
  const avgWorkoutMin = workoutDaysMin.length
    ? Math.round(workoutDaysMin.reduce((s, m) => s + m, 0) / workoutDaysMin.length)
    : null;
  // Aktif kalori ortalaması - vitals verisi olan günler üzerinden
  const activeCalDays = dailyTotals.filter((d) => d.vitals?.active_calories);
  const avgActiveCal = activeCalDays.length
    ? Math.round(activeCalDays.reduce((s, d) => s + (d.vitals.active_calories || 0), 0) / activeCalDays.length)
    : null;
  // Gerçek kalori açığı ortalaması: (BMR + aktif) − alınan, sadece öğün girilen günler
  const calorieDays = dailyTotals.filter((d) => d.calories > 0);
  const avgRealDeficit = avgDeficitFn(
    bmr,
    calorieDays.map((d) => ({ consumed: d.calories, activeCalories: d.vitals?.active_calories }))
  );
  // BMR yoksa hedef-bazlı yedek (hedef − alınan) — kart hep görünsün
  const avgGoalDeficit = (goals?.calories && calorieDays.length)
    ? Math.round(goals.calories - (calorieDays.reduce((s, d) => s + d.calories, 0) / calorieDays.length))
    : null;
  const avgShownDeficit = avgRealDeficit != null ? avgRealDeficit : avgGoalDeficit;
  const deficitIsReal = avgRealDeficit != null;
  // Ort. yakılan (toplam): BMR + ort. aktif kalori
  const avgBurned = bmr != null ? Math.round(bmr + (avgActiveCal || 0)) : null;
  const maxCalories = Math.max(...dailyTotals.map((d) => d.calories), 1);
  const maxWater = Math.max(...dailyTotals.map((d) => d.water), 1);
  const maxSleep = Math.max(...dailyTotals.map((d) => d.sleepHours || 0), 1);

  const shiftAnchor = (direction) => {
    const step = RANGE_DAYS[rangeKey];
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + direction * step);
    const today = new Date().toISOString().split('T')[0];
    const newDate = d.toISOString().split('T')[0];
    setAnchorDate(newDate > today ? today : newDate);
  };

  const buildExportText = () => {
    const lines = [`30 Gün Fit - ${rangeKey === 'day' ? 'Günlük' : rangeKey === 'week' ? 'Haftalık' : 'Aylık'} Özet (${formatShort(dates[0])} - ${formatShort(dates[dates.length - 1])})`, ''];
    dailyTotals.forEach((d) => {
      if (d.calories === 0 && d.water === 0 && !d.sleepHours && d.workouts.length === 0 && d.supplements.length === 0 && !d.notes) return;
      lines.push(`${formatShort(d.date)}:`);
      if (d.calories) lines.push(`  Kalori: ${Math.round(d.calories)} kcal, Protein: ${Math.round(d.protein)}g, Karbonhidrat: ${Math.round(d.carbs)}g, Yağ: ${Math.round(d.fats)}g`);
      if (d.water) lines.push(`  Su: ${d.water} ml`);
      if (d.sleepHours) lines.push(`  Uyku: ${d.sleepHours} saat${d.sleepScore ? `, Skor: ${d.sleepScore}` : ''}`);
      d.workouts.forEach((w) => lines.push(`  ${WORKOUT_TYPE_LABELS[w.type] || 'Antrenman'}: ${workoutSummary(w)}`));
      if (d.vitals && vitalsSummary(d.vitals)) lines.push(`  Apple Watch: ${vitalsSummary(d.vitals)}`);
      if (d.supplements.length) lines.push(`  Takviyeler: ${d.supplements.map((s) => s.name).join(', ')}`);
      if (d.notes) lines.push(`  Not: ${d.notes}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(buildExportText());
      alert('Kopyalandı! ChatGPT veya başka bir yere yapıştırabilirsin.');
    } catch {
      alert('Kopyalama başarısız oldu, metni manuel seçip kopyalayabilirsin.');
    }
  };

  const handleGeminiComment = async () => {
    setIsCommenting(true);
    setRetryStatus(null);
    try {
      const prompt = `Aşağıda bir kullanıcının fitness/beslenme günlüğü özeti var. Kısa, samimi, Türkçe bir değerlendirme yap: trendi yorumla (kalori, su, uyku, antrenman dengesi), 2-3 somut öneri ver. Uzun analiz yazma, en fazla 150 kelime.\n\n${buildExportText()}`;
      const comment = await callGeminiForText(prompt, (attempt, waitMs) => {
        setRetryStatus({ attempt, waitMs });
      });
      setGeminiComment(comment);
    } catch (err) {
      setGeminiComment('Yorum alınamadı: ' + err.message);
    } finally {
      setIsCommenting(false);
      setRetryStatus(null);
    }
  };

  const handleSaveNote = async () => {
    if (!user) return;
    setIsSavingNote(true);
    try {
      await saveDailyLog(user.uid, anchorDate, { notes: noteDraft });
      const refreshed = await getDailyLog(user.uid, anchorDate);
      setLogData({ ...logData, [anchorDate]: refreshed.data });
    } finally {
      setIsSavingNote(false);
    }
  };

  // ---- Gün görünümü: ekleme/düzenleme/silme ----
  const closeEdit = () => {
    setEditingSection(null);
    setEditForm({});
  };

  const handleDeleteMealInDay = async (mealId) => {
    if (!window.confirm('Bu öğünü silmek istediğinize emin misiniz?')) return;
    await deleteMeal(user.uid, anchorDate, mealId);
    await loadData();
  };

  const startEditSleep = () => {
    const sleep = logData[anchorDate]?.sleep || {};
    setEditForm({
      duration_hours: sleep.duration_hours || '',
      score: sleep.score || '',
      bedtime: sleep.bedtime || '',
      night_wakes: sleep.night_wakes || '',
      wake_minutes: sleep.wake_minutes || ''
    });
    setEditingSection('sleep');
  };

  const saveSleepEdit = async () => {
    setIsSavingEdit(true);
    try {
      await saveSleep(user.uid, anchorDate, {
        duration_hours: parseFloat(editForm.duration_hours) || 0,
        score: editForm.score ? parseInt(editForm.score, 10) : null,
        bedtime: editForm.bedtime || null,
        night_wakes: editForm.night_wakes ? parseInt(editForm.night_wakes, 10) : null,
        wake_minutes: editForm.wake_minutes ? parseInt(editForm.wake_minutes, 10) : null
      });
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSleepEntry = async () => {
    if (!window.confirm('Uyku kaydını silmek istediğinize emin misiniz?')) return;
    await deleteSleep(user.uid, anchorDate);
    await loadData();
  };

  const startEditVitals = () => {
    const vitals = logData[anchorDate]?.vitals || {};
    setEditForm({
      steps: vitals.steps || '',
      active_calories: vitals.active_calories || '',
      exercise_minutes: vitals.exercise_minutes || '',
      distance_km: vitals.distance_km || ''
    });
    setEditingSection('vitals');
  };

  const saveVitalsEdit = async () => {
    setIsSavingEdit(true);
    try {
      await saveVitals(user.uid, anchorDate, {
        steps: editForm.steps ? parseInt(editForm.steps, 10) : null,
        active_calories: editForm.active_calories ? parseFloat(editForm.active_calories) : null,
        exercise_minutes: editForm.exercise_minutes ? parseFloat(editForm.exercise_minutes) : null,
        distance_km: editForm.distance_km ? parseFloat(editForm.distance_km) : null
      });
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteVitalsEntry = async () => {
    if (!window.confirm('Apple Watch verisini silmek istediğinize emin misiniz?')) return;
    await deleteVitals(user.uid, anchorDate);
    await loadData();
  };

  const startAddWorkout = () => {
    setEditForm({ type: 'strength', name: '', duration_min: '', distance_km: '' });
    setEditingSection('workout-new');
  };

  const startEditWorkout = (index, w) => {
    setEditForm({
      type: w.type || 'strength',
      name: w.exercises?.[0]?.name || '',
      duration_min: w.duration_min || '',
      distance_km: w.distance_km || ''
    });
    setEditingSection(`workout-${index}`);
  };

  const saveWorkoutEdit = async (index) => {
    setIsSavingEdit(true);
    try {
      // Not: kalori bilerek yok - aktif kalori günün geneline aittir, Apple Watch bölümünde tutulur.
      // Eski kayıtlarda yanlışlıkla antrenmana yazılmış kalori, düzenleyip kaydedince temizlenir.
      const existing = index !== null ? (logData[anchorDate]?.workouts?.[index] || {}) : {};
      const workout = {
        type: editForm.type,
        duration_min: editForm.duration_min ? parseFloat(editForm.duration_min) : null,
        calories: null,
        distance_km: editForm.distance_km ? parseFloat(editForm.distance_km) : null,
        exercises: editForm.name?.trim()
          ? [{ name: editForm.name.trim(), sets: existing.exercises?.[0]?.sets || [] }]
          : (existing.exercises || [])
      };
      if (index === null) {
        await addWorkout(user.uid, anchorDate, workout);
      } else {
        await updateWorkout(user.uid, anchorDate, index, workout);
      }
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Antrenman satırı: sadece dolu alanları göster, "?" asla gösterme
  const workoutSummary = (w) => {
    const parts = [];
    if (w.exercises?.length) parts.push(w.exercises.map((e) => e.name).join(', '));
    if (w.duration_min) parts.push(`${w.duration_min} dk`);
    if (w.distance_km) parts.push(`${w.distance_km} km`);
    return parts.length ? parts.join(' · ') : 'Detay yok';
  };

  // Apple Watch satırı: sadece dolu alanları göster
  const vitalsSummary = (v) => {
    const parts = [];
    if (v.steps) parts.push(`${v.steps} adım`);
    if (v.active_calories) parts.push(`${v.active_calories} kcal aktif`);
    if (v.exercise_minutes) parts.push(`${v.exercise_minutes} dk egzersiz`);
    if (v.distance_km) parts.push(`${v.distance_km} km`);
    return parts.join(' · ');
  };

  const handleDeleteWorkoutEntry = async (index) => {
    if (!window.confirm('Bu antrenmanı silmek istediğinize emin misiniz?')) return;
    await deleteWorkout(user.uid, anchorDate, index);
    await loadData();
  };

  const startAddSupplement = () => {
    setEditForm({ name: '', dose: '' });
    setEditingSection('supplement-new');
  };

  const startEditSupplement = (index, s) => {
    setEditForm({ name: s.name || '', dose: s.dose || '' });
    setEditingSection(`supplement-${index}`);
  };

  const saveSupplementEdit = async (index) => {
    if (!editForm.name?.trim()) return;
    setIsSavingEdit(true);
    try {
      const supplement = { name: editForm.name.trim(), dose: editForm.dose?.trim() || null };
      if (index === null) {
        await addSupplement(user.uid, anchorDate, supplement);
      } else {
        await updateSupplement(user.uid, anchorDate, index, supplement);
      }
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSupplementEntry = async (index) => {
    if (!window.confirm('Bu takviyeyi silmek istediğinize emin misiniz?')) return;
    await deleteSupplement(user.uid, anchorDate, index);
    await loadData();
  };

  const handleQuickSupplement = async (quick) => {
    await addSupplement(user.uid, anchorDate, { name: quick.name, dose: quick.dose });
    await loadData();
  };

  // ---- Öğün ekleme/düzenleme ----
  const startAddMeal = (cat) => {
    setEditForm({ name: '', calories: '', protein: '', carbs: '', fats: '', catKey: cat.key });
    setEditingSection(`meal-new-${cat.key}`);
  };

  const startEditMeal = (meal) => {
    setEditForm({
      name: meal.name || '',
      calories: meal.calories || '',
      protein: meal.protein || '',
      carbs: meal.carbs || '',
      fats: meal.fats || '',
      catKey: classifyMeal(meal)
    });
    setEditingSection(`meal-${meal.id}`);
  };

  const saveMealEdit = async (mealId) => {
    if (!editForm.name?.trim() || !editForm.calories) {
      alert('En az içerik ve kalori girin');
      return;
    }
    setIsSavingEdit(true);
    try {
      const selectedCat = MEAL_CATEGORIES.find((c) => c.key === editForm.catKey) || MEAL_CATEGORIES[3];
      const fields = {
        name: editForm.name.trim(),
        calories: editForm.calories,
        protein: editForm.protein,
        carbs: editForm.carbs,
        fats: editForm.fats,
        mealType: selectedCat.mealType,
        mealLabel: selectedCat.mealLabel
      };
      if (mealId === null) {
        await addMeal(user.uid, anchorDate, { ...fields, source: 'Trend Düzenleme' });
      } else {
        await updateMeal(user.uid, anchorDate, mealId, fields);
      }
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---- Su düzenleme (günün toplamını tek kayda indirger) ----
  const startEditWater = () => {
    setEditForm({ total_ml: dailyTotals[0]?.water || '' });
    setEditingSection('water');
  };

  const saveWaterEdit = async () => {
    setIsSavingEdit(true);
    try {
      const result = await getWaterTracker(user.uid);
      const entries = result.success ? (result.data.entries || []) : [];
      const goal = result.success ? (result.data.dailyGoal || 2500) : 2500;
      const others = entries.filter((e) => e.date !== anchorDate);
      const total = parseInt(editForm.total_ml, 10);
      const updated = total > 0
        ? [...others, { id: Date.now(), amount: total, date: anchorDate, timestamp: new Date().toISOString() }]
        : others;
      await saveWaterTracker(user.uid, updated, goal);
      await loadData();
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteWaterEntry = async () => {
    if (!window.confirm('Bu günün su kaydını silmek istediğinize emin misiniz?')) return;
    const result = await getWaterTracker(user.uid);
    const entries = result.success ? (result.data.entries || []) : [];
    const goal = result.success ? (result.data.dailyGoal || 2500) : 2500;
    await saveWaterTracker(user.uid, entries.filter((e) => e.date !== anchorDate), goal);
    await loadData();
  };

  // ---- Sabit hedefleri düzenle ----
  const DEFAULT_GOALS = { calories: 2400, protein: 180, carbs: 210, fats: 80, water: 4000 };

  const startEditGoals = () => {
    const g = goals || DEFAULT_GOALS;
    setEditForm({ calories: g.calories, protein: g.protein, carbs: g.carbs, fats: g.fats, water: g.water });
    setEditingSection('goals');
  };

  const saveGoalsEdit = async () => {
    setIsSavingEdit(true);
    try {
      const newGoals = {
        calories: parseInt(editForm.calories, 10) || 0,
        protein: parseInt(editForm.protein, 10) || 0,
        carbs: parseInt(editForm.carbs, 10) || 0,
        fats: parseInt(editForm.fats, 10) || 0,
        water: parseInt(editForm.water, 10) || 0
      };
      await saveNutritionGoals(user.uid, newGoals);
      localStorage.setItem('nutrition_goals', JSON.stringify(newGoals));
      setGoals(newGoals);
      closeEdit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---- Bu günün OLASI tekrar kayıtlarını temizle (öğün + takviye) ----
  // KRİTİK: aynı öğünü gün içinde gerçekten iki kez yemiş olabilirsin. O yüzden:
  // 1) Sadece adı VE tüm besin değerleri (kalori/P/K/Y) birebir aynı olanları aday say
  // 2) Hiçbir şeyi otomatik silme - önce neyin sileneceğini göster, ONAY iste
  const handleCleanDuplicates = async () => {
    const meals = await getMeals(user.uid, anchorDate);
    const seenMeals = new Set();
    const mealsToRemove = [];
    meals.forEach((m) => {
      const key = [
        (m.name || '').trim().toLocaleLowerCase('tr'),
        Math.round(m.calories || 0), Math.round(m.protein || 0),
        Math.round(m.carbs || 0), Math.round(m.fats || 0)
      ].join('|');
      if (seenMeals.has(key)) mealsToRemove.push(m);
      else seenMeals.add(key);
    });

    const logResult = await getDailyLog(user.uid, anchorDate);
    const supplements = logResult.success ? (logResult.data.supplements || []) : [];
    const seenSupps = new Set();
    const dedupedSupps = [];
    const suppsToRemove = [];
    supplements.forEach((s) => {
      const key = normalizeSupplementName(s.name);
      if (seenSupps.has(key)) suppsToRemove.push(s);
      else { seenSupps.add(key); dedupedSupps.push(s); }
    });

    if (mealsToRemove.length === 0 && suppsToRemove.length === 0) {
      alert('Bu günde birebir aynı (tekrar eden) kayıt bulunamadı ✓');
      return;
    }

    // Onay - ne silineceğini açıkça göster
    const lines = ['Aşağıdaki BİREBİR AYNI kayıtlar tekrar sayıldı ve silinecek:', ''];
    mealsToRemove.forEach((m) => lines.push(`• ${stripCategoryPrefix(m.name)} (${Math.round(m.calories)} kcal)`));
    suppsToRemove.forEach((s) => lines.push(`• ${s.name}${s.dose ? ` (${s.dose})` : ''}`));
    lines.push('', 'Aynı yemeği gün içinde gerçekten iki kez yediysen İPTAL et. Devam edilsin mi?');
    if (!window.confirm(lines.join('\n'))) return;

    for (const m of mealsToRemove) {
      await deleteMeal(user.uid, anchorDate, m.id);
    }
    if (suppsToRemove.length > 0) {
      await saveDailyLog(user.uid, anchorDate, { supplements: dedupedSupps });
    }

    await loadData();
    alert(`Temizlendi: ${mealsToRemove.length} tekrar öğün, ${suppsToRemove.length} tekrar takviye silindi.`);
  };

  // Bir çipe/sık-yenene tıklayınca formu o öğünün değerleriyle doldur (kategori aynı kalır)
  const fillFromRecent = (meal) => {
    setEditForm((prev) => ({
      ...prev,
      name: meal.name,
      calories: meal.calories || '',
      protein: meal.protein || '',
      carbs: meal.carbs || '',
      fats: meal.fats || ''
    }));
  };

  // Öğün ekleme/düzenleme formu (kategoriler arasında ortak, kategori de değiştirilebilir)
  const renderMealForm = (mealId) => (
    <div className="trend-edit-form">
      {mealId === null && recentMeals.length > 0 && (
        <div className="trend-recent-meals">
          <span className="trend-recent-label">🔁 Sık yenenler (dokun, doldur):</span>
          <div className="trend-recent-chips">
            {recentMeals.slice(0, 12).map((meal, i) => (
              <button
                key={i}
                type="button"
                className="trend-recent-chip"
                onClick={() => fillFromRecent(meal)}
                title={`${Math.round(meal.calories)} kcal · P:${Math.round(meal.protein)} K:${Math.round(meal.carbs)} Y:${Math.round(meal.fats)}`}
              >
                {stripCategoryPrefix(meal.name).slice(0, 28)}{meal.count > 1 ? ` ×${meal.count}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      <select
        value={editForm.catKey}
        onChange={(e) => setEditForm({ ...editForm, catKey: e.target.value })}
      >
        {MEAL_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>{c.title}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="İçerik (örn: 3 Tam Yumurta, 60g Yulaf)"
        value={editForm.name}
        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
      />
      <div className="trend-edit-grid">
        <input type="number" placeholder="Kalori" value={editForm.calories} onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })} />
        <input type="number" placeholder="Protein (g)" value={editForm.protein} onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })} />
        <input type="number" placeholder="Karbonhidrat (g)" value={editForm.carbs} onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })} />
        <input type="number" placeholder="Yağ (g)" value={editForm.fats} onChange={(e) => setEditForm({ ...editForm, fats: e.target.value })} />
      </div>
      <div className="trend-edit-actions">
        <button onClick={() => saveMealEdit(mealId)} disabled={isSavingEdit}>Kaydet</button>
        <button onClick={closeEdit}>İptal</button>
      </div>
    </div>
  );

  if (!user) {
    return <div className="trend-view"><p>Trendleri görmek için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className="trend-view">
      <div className="trend-header">
        <h3>📈 Trend & Özet</h3>
        <div className="trend-range-buttons">
          {Object.keys(RANGE_DAYS).map((key) => (
            <button
              key={key}
              className={rangeKey === key ? 'active' : ''}
              onClick={() => setRangeKey(key)}
            >
              {key === 'day' ? 'Gün' : key === 'week' ? 'Hafta' : 'Ay'}
            </button>
          ))}
        </div>
      </div>

      <div className="trend-date-nav">
        <button onClick={() => shiftAnchor(-1)}>◀</button>
        <span>{formatShort(dates[0])} - {formatShort(dates[dates.length - 1])}</span>
        <button onClick={() => shiftAnchor(1)} disabled={anchorDate === new Date().toISOString().split('T')[0]}>▶</button>
      </div>

      <GeminiQuotaBadge retryStatus={retryStatus} />

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <div className="trend-summary-cards">
            <div className="trend-card">
              <span className="trend-card-icon">🔥</span>
              <span className="trend-card-value">{avgCalories}</span>
              <span className="trend-card-label">Ort. Kalori</span>
            </div>
            {avgShownDeficit != null && (
              <div className="trend-card" title={deficitIsReal ? '(BMR + aktif kalori) − alınan' : 'hedef − alınan (BMR için profilini doldur)'}>
                <span className="trend-card-icon">{avgShownDeficit >= 0 ? '📉' : '📈'}</span>
                <span className="trend-card-value" style={{ color: avgShownDeficit >= 0 ? '#16a34a' : '#dc2626' }}>{Math.abs(avgShownDeficit)}</span>
                <span className="trend-card-label">Ort. Kalori {avgShownDeficit >= 0 ? 'Açığı' : 'Fazlası'}{deficitIsReal ? '' : '*'}</span>
              </div>
            )}
            {avgBurned != null && (
              <div className="trend-card">
                <span className="trend-card-icon">🔥</span>
                <span className="trend-card-value">{avgBurned}</span>
                <span className="trend-card-label">Ort. Yakılan (BMR+aktif)</span>
              </div>
            )}
            <div className="trend-card">
              <span className="trend-card-icon">💧</span>
              <span className="trend-card-value">{avgWater}</span>
              <span className="trend-card-label">Ort. Su (ml)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">😴</span>
              <span className="trend-card-value">{avgSleep || '-'}</span>
              <span className="trend-card-label">Ort. Uyku (saat)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">👟</span>
              <span className="trend-card-value">{avgSteps || '-'}</span>
              <span className="trend-card-label">Ort. Adım</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">🏋️</span>
              <span className="trend-card-value">{avgWorkoutMin || '-'}</span>
              <span className="trend-card-label">Ort. Antrenman (dk)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">⚡</span>
              <span className="trend-card-value">{avgActiveCal || '-'}</span>
              <span className="trend-card-label">Ort. Aktif Kalori</span>
            </div>
          </div>

          {rangeKey !== 'day' && (
            <div className="trend-chart">
              <div className="trend-legend">
                <span className="trend-legend-item"><i className="lg-dot lg-cal" />🔥 Kalori</span>
                <span className="trend-legend-item"><i className="lg-dot lg-water" />💧 Su</span>
                <span className="trend-legend-item"><i className="lg-dot lg-sleep" />😴 Uyku</span>
              </div>
              <div className="trend-bars">
                {dailyTotals.map((d) => (
                  <div key={d.date} className="trend-bar-day">
                    <div className="trend-bar-group">
                      <div className="trend-bar-track" title={`🔥 ${Math.round(d.calories)} kcal`}>
                        <div className="trend-bar-fill calories" style={{ height: `${(d.calories / maxCalories) * 100}%` }} />
                      </div>
                      <div className="trend-bar-track water-track" title={`💧 ${Math.round(d.water)} ml`}>
                        <div className="trend-bar-fill water" style={{ height: `${(d.water / maxWater) * 100}%` }} />
                      </div>
                      <div className="trend-bar-track sleep-track" title={`😴 ${d.sleepHours || 0} saat`}>
                        <div className="trend-bar-fill sleep" style={{ height: `${((d.sleepHours || 0) / maxSleep) * 100}%` }} />
                      </div>
                    </div>
                    <span className="trend-bar-value">{d.calories ? Math.round(d.calories) : '–'}</span>
                    <span className="trend-bar-label">{formatShort(d.date)}</span>
                  </div>
                ))}
              </div>
              <p className="trend-chart-hint">Çubukların üstüne gelince tam değer görünür · alttaki sayı o günün kalorisi</p>
            </div>
          )}

          {rangeKey === 'day' && (
            <div className="trend-day-detail">
              {/* Tarih */}
              <div className="trend-day-section trend-day-date">
                <div className="trend-day-date-row">
                  <h5>📅 {new Date(anchorDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(anchorDate).toLocaleDateString('tr-TR', { weekday: 'long' })}</h5>
                  <button className="trend-clean-btn" onClick={handleCleanDuplicates} title="Bu günün tekrar eden kayıtlarını temizle">🧹 Temizle</button>
                </div>
              </div>

              {/* Hedefler - SABİT, elle belirlenir ve düzenlenebilir */}
              <div className="trend-day-section trend-day-goals">
                <h5>
                  🎯 Hedefler
                  {editingSection !== 'goals' && (
                    <button className="trend-goals-edit" onClick={startEditGoals} title="Hedefleri düzenle">✏️</button>
                  )}
                </h5>
                {editingSection === 'goals' ? (
                  <div className="trend-edit-form">
                    <div className="trend-edit-grid">
                      <input type="number" placeholder="Kalori" value={editForm.calories} onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })} />
                      <input type="number" placeholder="Protein (g)" value={editForm.protein} onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })} />
                      <input type="number" placeholder="Karbonhidrat (g)" value={editForm.carbs} onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })} />
                      <input type="number" placeholder="Yağ (g)" value={editForm.fats} onChange={(e) => setEditForm({ ...editForm, fats: e.target.value })} />
                      <input type="number" placeholder="Su (ml)" value={editForm.water} onChange={(e) => setEditForm({ ...editForm, water: e.target.value })} />
                    </div>
                    <div className="trend-edit-actions">
                      <button onClick={saveGoalsEdit} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : goals ? (
                  <div className="trend-goals-grid">
                    <span>Kalori: <strong>{goals.calories} kcal</strong></span>
                    <span>Protein: <strong>{goals.protein}g</strong></span>
                    <span>Karbonhidrat: <strong>{goals.carbs}g</strong></span>
                    <span>Yağ: <strong>{goals.fats}g</strong></span>
                    <span>Su: <strong>{goals.water} ml</strong></span>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startEditGoals}>➕ Hedef Belirle</button>
                )}
              </div>

              {/* Öğün kategorileri - her birinde ekle/düzenle/sil */}
              {MEAL_CATEGORIES.map((cat) => {
                const catMeals = dailyTotals[0].meals.filter((m) => classifyMeal(m) === cat.key);
                return (
                  <div className="trend-day-section" key={cat.key}>
                    <h5>{cat.title}</h5>
                    {catMeals.map((m) => (
                      editingSection === `meal-${m.id}` ? (
                        <React.Fragment key={m.id}>{renderMealForm(m.id)}</React.Fragment>
                      ) : (
                        <div key={m.id} className="trend-day-item">
                          <span>
                            {stripCategoryPrefix(m.name)} — {Math.round(m.calories)} kcal
                            {m.protein > 0 ? `, P:${Math.round(m.protein)}g` : ''}
                            {m.carbs > 0 ? `, K:${Math.round(m.carbs)}g` : ''}
                            {m.fats > 0 ? `, Y:${Math.round(m.fats)}g` : ''}
                          </span>
                          <div className="trend-day-item-actions">
                            <button onClick={() => startEditMeal(m)} title="Düzenle">✏️</button>
                            <button onClick={() => handleDeleteMealInDay(m.id)} title="Sil">🗑️</button>
                          </div>
                        </div>
                      )
                    ))}
                    {editingSection === `meal-new-${cat.key}` ? (
                      renderMealForm(null)
                    ) : (
                      <button className="trend-add-btn" onClick={() => startAddMeal(cat)}>➕ Ekle</button>
                    )}
                  </div>
                );
              })}

              {/* Su - toplam düzenlenebilir, hedef ve tamamlanma otomatik */}
              <div className="trend-day-section">
                <h5>💧 Su</h5>
                {editingSection === 'water' ? (
                  <div className="trend-edit-form">
                    <input
                      type="number"
                      placeholder="Toplam (ml)"
                      value={editForm.total_ml}
                      onChange={(e) => setEditForm({ ...editForm, total_ml: e.target.value })}
                    />
                    <div className="trend-edit-actions">
                      <button onClick={saveWaterEdit} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : dailyTotals[0].water > 0 ? (
                  <div className="trend-day-item">
                    <span>
                      Toplam: {dailyTotals[0].water} ml · Hedef: {waterGoal} ml · %{Math.round((dailyTotals[0].water / waterGoal) * 100)}
                    </span>
                    <div className="trend-day-item-actions">
                      <button onClick={startEditWater} title="Düzenle">✏️</button>
                      <button onClick={handleDeleteWaterEntry} title="Sil">🗑️</button>
                    </div>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startEditWater}>➕ Su Ekle</button>
                )}
              </div>

              {/* Uyku */}
              <div className="trend-day-section">
                <h5>😴 Uyku</h5>
                {editingSection === 'sleep' ? (
                  <div className="trend-edit-form">
                    <div className="trend-edit-grid">
                      <input type="number" step="0.1" placeholder="Süre (saat)" value={editForm.duration_hours} onChange={(e) => setEditForm({ ...editForm, duration_hours: e.target.value })} />
                      <input type="number" placeholder="Skor" value={editForm.score} onChange={(e) => setEditForm({ ...editForm, score: e.target.value })} />
                      <input type="number" placeholder="Uyanma (kaç kez)" value={editForm.night_wakes} onChange={(e) => setEditForm({ ...editForm, night_wakes: e.target.value })} />
                      <input type="number" placeholder="Uyanık kalınan (dk)" value={editForm.wake_minutes} onChange={(e) => setEditForm({ ...editForm, wake_minutes: e.target.value })} />
                    </div>
                    <input type="text" placeholder="Yatış saati (22:30)" value={editForm.bedtime} onChange={(e) => setEditForm({ ...editForm, bedtime: e.target.value })} />
                    <div className="trend-edit-actions">
                      <button onClick={saveSleepEdit} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : dailyTotals[0].sleepHours ? (
                  <div className="trend-day-item">
                    <span>
                      {dailyTotals[0].sleepHours} saat
                      {dailyTotals[0].sleepScore ? ` · skor ${dailyTotals[0].sleepScore}` : ''}
                      {logData[anchorDate]?.sleep?.night_wakes ? ` · ${logData[anchorDate].sleep.night_wakes}x uyanma${logData[anchorDate].sleep.wake_minutes ? ` (${logData[anchorDate].sleep.wake_minutes} dk)` : ''}` : ''}
                      {logData[anchorDate]?.sleep?.bedtime ? ` · yatış ${logData[anchorDate].sleep.bedtime}` : ''}
                    </span>
                    <div className="trend-day-item-actions">
                      <button onClick={startEditSleep} title="Düzenle">✏️</button>
                      <button onClick={handleDeleteSleepEntry} title="Sil">🗑️</button>
                    </div>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startEditSleep}>➕ Uyku Ekle</button>
                )}
              </div>

              {/* Antrenman - seansın kendisi (tür, hareket, süre). Aktif kalori burada DEĞİL,
                  günün geneline ait olduğu için Apple Watch bölümünde tutulur. */}
              <div className="trend-day-section">
                <h5>🏋️ Antrenman</h5>
                {dailyTotals[0].workouts.map((w, i) => (
                  editingSection === `workout-${i}` ? (
                    <div key={i} className="trend-edit-form">
                      <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                        <option value="strength">Kuvvet</option>
                        <option value="cardio">Kardiyo</option>
                        <option value="walk">Yürüyüş</option>
                        <option value="other">Aktivite</option>
                      </select>
                      <input type="text" placeholder="Antrenman adı (örn: Full Body)" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      <div className="trend-edit-grid">
                        <input type="number" placeholder="Süre (dk)" value={editForm.duration_min} onChange={(e) => setEditForm({ ...editForm, duration_min: e.target.value })} />
                        <input type="number" step="0.1" placeholder="Mesafe (km, kardiyo için)" value={editForm.distance_km} onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })} />
                      </div>
                      <div className="trend-edit-actions">
                        <button onClick={() => saveWorkoutEdit(i)} disabled={isSavingEdit}>Kaydet</button>
                        <button onClick={closeEdit}>İptal</button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="trend-day-item">
                      <span>{WORKOUT_TYPE_LABELS[w.type] || w.type}: {workoutSummary(w)}</span>
                      <div className="trend-day-item-actions">
                        <button onClick={() => startEditWorkout(i, w)} title="Düzenle">✏️</button>
                        <button onClick={() => handleDeleteWorkoutEntry(i)} title="Sil">🗑️</button>
                      </div>
                    </div>
                  )
                ))}
                {editingSection === 'workout-new' ? (
                  <div className="trend-edit-form">
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                      <option value="strength">Kuvvet</option>
                      <option value="cardio">Kardiyo</option>
                      <option value="walk">Yürüyüş</option>
                      <option value="other">Aktivite</option>
                    </select>
                    <input type="text" placeholder="Antrenman adı (örn: Full Body)" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <div className="trend-edit-grid">
                      <input type="number" placeholder="Süre (dk)" value={editForm.duration_min} onChange={(e) => setEditForm({ ...editForm, duration_min: e.target.value })} />
                      <input type="number" step="0.1" placeholder="Mesafe (km, kardiyo için)" value={editForm.distance_km} onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })} />
                    </div>
                    <div className="trend-edit-actions">
                      <button onClick={() => saveWorkoutEdit(null)} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startAddWorkout}>➕ Antrenman Ekle</button>
                )}
              </div>

              {/* Apple Watch - günün geneli: adım, aktif kalori, egzersiz dk, mesafe */}
              <div className="trend-day-section">
                <h5>⌚ Apple Watch / Aktivite</h5>
                {editingSection === 'vitals' ? (
                  <div className="trend-edit-form">
                    <div className="trend-edit-grid">
                      <input type="number" placeholder="Adım" value={editForm.steps} onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })} />
                      <input type="number" placeholder="Aktif kalori" value={editForm.active_calories} onChange={(e) => setEditForm({ ...editForm, active_calories: e.target.value })} />
                      <input type="number" placeholder="Egzersiz (dk)" value={editForm.exercise_minutes} onChange={(e) => setEditForm({ ...editForm, exercise_minutes: e.target.value })} />
                      <input type="number" step="0.01" placeholder="Mesafe (km)" value={editForm.distance_km} onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })} />
                    </div>
                    <div className="trend-edit-actions">
                      <button onClick={saveVitalsEdit} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : dailyTotals[0].vitals && vitalsSummary(dailyTotals[0].vitals) ? (
                  <div className="trend-day-item">
                    <span>{vitalsSummary(dailyTotals[0].vitals)}</span>
                    <div className="trend-day-item-actions">
                      <button onClick={startEditVitals} title="Düzenle">✏️</button>
                      <button onClick={handleDeleteVitalsEntry} title="Sil">🗑️</button>
                    </div>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startEditVitals}>➕ Aktivite Verisi Ekle</button>
                )}
              </div>

              {/* Takviyeler */}
              <div className="trend-day-section">
                <h5>💊 Takviyeler</h5>
                <div className="trend-quick-chips">
                  {QUICK_SUPPLEMENTS.map((quick) => {
                    const alreadyTaken = dailyTotals[0].supplements.some(
                      (s) => normalizeSupplementName(s.name) === normalizeSupplementName(quick.name)
                    );
                    return (
                      <button
                        key={quick.name}
                        className={`trend-quick-chip ${alreadyTaken ? 'taken' : ''}`}
                        disabled={alreadyTaken}
                        onClick={() => handleQuickSupplement(quick)}
                        title={alreadyTaken ? 'Bugün alındı' : `${quick.name} (${quick.dose}) ekle`}
                      >
                        {alreadyTaken ? '✅' : '➕'} {quick.name}
                      </button>
                    );
                  })}
                </div>
                {dailyTotals[0].supplements.map((s, i) => (
                  editingSection === `supplement-${i}` ? (
                    <div key={i} className="trend-edit-form">
                      <input type="text" placeholder="Ad" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      <input type="text" placeholder="Doz (örn: 5g)" value={editForm.dose} onChange={(e) => setEditForm({ ...editForm, dose: e.target.value })} />
                      <div className="trend-edit-actions">
                        <button onClick={() => saveSupplementEdit(i)} disabled={isSavingEdit}>Kaydet</button>
                        <button onClick={closeEdit}>İptal</button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="trend-day-item">
                      <span>{s.name}{s.dose ? ` (${s.dose})` : ''}</span>
                      <div className="trend-day-item-actions">
                        <button onClick={() => startEditSupplement(i, s)} title="Düzenle">✏️</button>
                        <button onClick={() => handleDeleteSupplementEntry(i)} title="Sil">🗑️</button>
                      </div>
                    </div>
                  )
                ))}
                {editingSection === 'supplement-new' ? (
                  <div className="trend-edit-form">
                    <input type="text" placeholder="Ad" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <input type="text" placeholder="Doz (örn: 5g)" value={editForm.dose} onChange={(e) => setEditForm({ ...editForm, dose: e.target.value })} />
                    <div className="trend-edit-actions">
                      <button onClick={() => saveSupplementEdit(null)} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : (
                  <button className="trend-add-btn" onClick={startAddSupplement}>➕ Takviye Ekle</button>
                )}
              </div>

              {/* Günlük Toplam - öğünlerden otomatik hesaplanır */}
              <div className="trend-day-section trend-day-totals">
                <h5>📊 Günlük Toplam (otomatik)</h5>
                <div className="trend-goals-grid">
                  <span>Kalori: <strong>{Math.round(dailyTotals[0].calories)} kcal</strong>{goals ? ` / ${goals.calories}` : ''}</span>
                  <span>Protein: <strong>{Math.round(dailyTotals[0].protein)}g</strong>{goals ? ` / ${goals.protein}g` : ''}</span>
                  <span>Karbonhidrat: <strong>{Math.round(dailyTotals[0].carbs)}g</strong>{goals ? ` / ${goals.carbs}g` : ''}</span>
                  <span>Yağ: <strong>{Math.round(dailyTotals[0].fats)}g</strong>{goals ? ` / ${goals.fats}g` : ''}</span>
                </div>
                {bmr != null && dailyTotals[0].calories > 0 && (() => {
                  const active = dailyTotals[0].vitals?.active_calories || 0;
                  const burned = dayBurned(bmr, active);
                  const def = dayDeficit(bmr, active, dailyTotals[0].calories);
                  return (
                    <div className={`trend-day-deficit ${def >= 0 ? 'good' : 'over'}`}>
                      {def >= 0 ? '📉' : '📈'} Bu gün <strong>{Math.abs(def)} kcal {def >= 0 ? 'açık' : 'fazla'}</strong>
                      <span> (yakılan {burned} = BMR {bmr}{active ? ` + aktif ${Math.round(active)}` : ''} · alınan {Math.round(dailyTotals[0].calories)})</span>
                    </div>
                  );
                })()}
                {bmr == null && dailyTotals[0].calories > 0 && (
                  <div className="trend-day-deficit over">
                    ⚠️ Kalori açığı için profilinde <strong>boy · kilo · yaş · cinsiyet</strong> dolu olmalı (Ayarlar → Profil).
                  </div>
                )}
              </div>

              <div className="trend-note-editor">
                <label>📝 Not (ChatGPT analizini buraya yapıştırabilirsin)</label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={4}
                  placeholder="Bu güne dair not..."
                />
                <button onClick={handleSaveNote} disabled={isSavingNote}>
                  {isSavingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                </button>
              </div>
            </div>
          )}

          <div className="trend-actions">
            <button onClick={handleCopyExport}>📋 Dışa Aktar (Kopyala)</button>
            <button onClick={handleGeminiComment} disabled={isCommenting}>
              {isCommenting ? '🤖 Yorumlanıyor...' : '🤖 Gemini ile Yorumla'}
            </button>
          </div>

          {geminiComment && (
            <div className="trend-gemini-comment">
              <h5>🤖 AI Değerlendirmesi</h5>
              <p>{geminiComment}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrendView;
