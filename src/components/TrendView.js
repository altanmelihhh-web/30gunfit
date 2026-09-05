import React, { useState, useEffect, useCallback } from 'react';
import './TrendView.css';
import { getCalorieTrackingRange, getDailyLogsRange, getWaterTracker, saveWaterTracker, saveDailyLog, getDailyLog, getNutritionGoals, saveNutritionGoals, getUserProfile, saveUserProfile, getWeightTracker, getBodyMeasurements } from '../firebase/dataService';
import { computeBMR, energyBalance, getActiveEnergy, getBMRProfileIssue, profileWithLatestWeight, avgDeficit as avgDeficitFn } from '../utils/calorieMath';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';
import {
  saveSleep, deleteSleep, saveVitals, deleteVitals,
  addSupplement, updateSupplement, deleteSupplement,
  addWorkout, updateWorkout, deleteWorkout
} from '../firebase/dailyLogService';
import { getMeals, addMeal, updateMeal, deleteMeal } from '../firebase/mealsService';
import { callGeminiForText } from '../utils/geminiClient';
import GeminiQuotaBadge from './GeminiQuotaBadge';
import { dayDiff, getPhaseInfo, getPredictions, parseDateKey, shiftKey, todayKey } from '../utils/cycleMath';
import { getPeriodTracker } from '../firebase/periodService';
import { MAX_CUSTOM_DAYS, RANGE_DAYS, RANGE_LABELS, getDateList, isCustomRangeTooLong } from '../utils/dateRange';

const WORKOUT_TYPE_LABELS = { strength: 'Antrenman', cardio: 'Kardiyo', walk: 'Yürüyüş', other: 'Aktivite' };


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

const formatShort = (dateStr) => parseDateKey(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatExportValue = (value) => {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '-';
  return value;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const removePrivateExportFields = (value) => {
  if (Array.isArray(value)) return value.map(removePrivateExportFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['userId', 'uid', 'ownerUid', 'ownerEmail'].includes(key))
      .map(([key, item]) => [key, removePrivateExportFields(item)])
  );
};

const dateKeyFromDate = (date) => date.toISOString().split('T')[0];

const getExportDatesFromAccountStart = (user) => {
  const today = parseDateKey(todayKey());
  const rawCreatedAt = user?.metadata?.creationTime;
  const start = rawCreatedAt ? new Date(rawCreatedAt) : new Date(today.getFullYear(), 0, 1);
  if (Number.isNaN(start.getTime())) start.setTime(new Date(today.getFullYear(), 0, 1).getTime());
  start.setHours(0, 0, 0, 0);
  const datesOut = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    datesOut.push(dateKeyFromDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return datesOut;
};

const isValidTargetDate = (value) => {
  if (!isDateKey(value)) return false;
  const year = parseInt(value.slice(0, 4), 10);
  return year >= 2026 && year <= 2035 && value >= todayKey();
};

const activityTotals = (day) => {
  const vitals = day.vitals || {};
  const workoutDuration = day.workouts.reduce((s, w) => s + (parseFloat(w.duration_min) || 0), 0);
  const workoutCalories = day.workouts.reduce((s, w) => s + (parseFloat(w.calories) || 0), 0);
  const workoutDistance = day.workouts.reduce((s, w) => s + (parseFloat(w.distance_km) || 0), 0);
  return {
    steps: parseFloat(vitals.steps) || null,
    activeCalories: getActiveEnergy(vitals, workoutCalories) || null,
    durationMin: parseFloat(vitals.exercise_minutes) || workoutDuration || null,
    distanceKm: parseFloat(vitals.distance_km) || workoutDistance || null
  };
};

const activitySummary = (activity) => {
  const parts = [];
  if (activity.activeCalories) parts.push(`${Math.round(activity.activeCalories)} kcal`);
  if (activity.durationMin) parts.push(`${Math.round(activity.durationMin)} dk`);
  if (activity.distanceKm) parts.push(`${activity.distanceKm} km`);
  if (activity.steps) parts.push(`${Math.round(activity.steps)} adım`);
  return parts.join(' · ');
};

const TrendView = ({ user, initialRangeKey = 'week', lockRangeKey = null, embedded = false }) => {
  const [rangeKey, setRangeKeyState] = useState(lockRangeKey || initialRangeKey);
  const [anchorDate, setAnchorDate] = useState(todayKey);
  const [customRange, setCustomRange] = useState(() => ({ start: shiftKey(todayKey(), -13), end: todayKey() }));
  const [chartTab, setChartTab] = useState('nutrition');
  const [loading, setLoading] = useState(false);
  const [calorieData, setCalorieData] = useState({});
  const [logData, setLogData] = useState({});
  const [waterByDate, setWaterByDate] = useState({});
  const [bodyMeasurements, setBodyMeasurements] = useState([]);
  const [weightState, setWeightState] = useState({ entries: [], targetWeight: '' });
  const [progressProfile, setProgressProfile] = useState(null);
  const [geminiComment, setGeminiComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [cycleInsight, setCycleInsight] = useState(null);

  // Gün görünümünde düzenleme - null | 'sleep' | 'vitals' | 'water' | 'workout-new' | 'workout-{i}'
  // | 'supplement-new' | 'supplement-{i}' | 'meal-new-{catKey}' | 'meal-{id}'
  const [editingSection, setEditingSection] = useState(null);
  const [openDaySections, setOpenDaySections] = useState({ totals: true });
  const [editForm, setEditForm] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingTargetDate, setIsSavingTargetDate] = useState(false);
  const [goals, setGoals] = useState(null); // {calories, protein, carbs, fats, water}
  const [bmr, setBmr] = useState(null); // profil BMR'si (gerçek kalori açığı için)
  const [bmrIssue, setBmrIssue] = useState(null);

  // Profil → BMR (kalori açığı hesabı için)
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(user.uid),
      getWeightTracker(user.uid, user.email)
    ]).then(([res, weight]) => {
      if (weight?.success) {
        setWeightState({
          entries: weight.data.entries || [],
          targetWeight: weight.data.targetWeight || ''
        });
      }
      if (res?.success && res.data) {
        setProgressProfile(res.data);
        const profile = profileWithLatestWeight(res.data, weight?.success ? weight.data.entries || [] : []);
        setBmr(computeBMR(profile));
        setBmrIssue(getBMRProfileIssue(profile));
        return;
      }
      try {
        const savedProfile = getScopedJson('userProfile', user.uid, null);
        setProgressProfile(savedProfile);
        setBmr(computeBMR(savedProfile));
        setBmrIssue(getBMRProfileIssue(savedProfile));
      } catch {
        setProgressProfile(null);
        setBmr(null);
        setBmrIssue('Profil okunamadı.');
      }
    }).catch(() => {
      setWeightState({ entries: [], targetWeight: '' });
      try {
        const savedProfile = getScopedJson('userProfile', user.uid, null);
        setProgressProfile(savedProfile);
        setBmr(computeBMR(savedProfile));
        setBmrIssue(getBMRProfileIssue(savedProfile));
      } catch {
        setProgressProfile(null);
        setBmr(null);
        setBmrIssue('Profil okunamadı.');
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const isFemale = (progressProfile?.gender || '').toLowerCase() === 'female';
    if (!isFemale) {
      setCycleInsight(null);
      return;
    }

    let cancelled = false;
    getPeriodTracker(user.uid).then((tracker) => {
      if (cancelled) return;
      const predictions = getPredictions(tracker.entries || [], tracker.settings || {});
      if (!predictions) {
        setCycleInsight(null);
        return;
      }
      const phase = getPhaseInfo(predictions.cycleDay, predictions.cycleLength, predictions.periodLength);
      const today = todayKey();
      const daysUntil = dayDiff(today, predictions.nextStart);
      const inPredictedPeriod = daysUntil <= 0 && dayDiff(today, predictions.nextEnd) >= 0;
      const entryToday = (tracker.entries || []).find((entry) => entry.date === today);
      const isLoggedPeriod = entryToday && entryToday.flow && entryToday.flow !== 'none';

      let weightNote = null;
      let supportNote = null;
      if (isLoggedPeriod || phase.key === 'menstrual' || inPredictedPeriod) {
        weightNote = 'Döngü/kanama günlerinde tartı geçici yüksek oynayabilir; su tutma ve iştah artışı normal olabilir.';
        supportNote = 'Bugün hedef kusursuzluk değil: protein, su ve rahat tolere edilen hareket yeterli bir kazanım sayılır.';
      } else if (daysUntil > 0 && daysUntil <= 3) {
        weightNote = `${daysUntil} gün içinde döngü bekleniyor; tartı ve iştah birkaç gün daha dalgalı görünebilir.`;
        supportNote = 'Bu dönemde tuz, uyku ve su takibi rota yorumundan daha değerli olabilir.';
      } else if (phase.key === 'luteal') {
        weightNote = 'Luteal dönemde iştah, uyku ve su tutma artabilir; tek tartıyı karar sebebi yapma.';
        supportNote = 'Planı koru, ama açlık belirginse proteini ve lifli öğünleri öne al.';
      }

      setCycleInsight({
        phase,
        cycleDay: predictions.cycleDay,
        daysUntilNext: daysUntil,
        weightNote,
        supportNote
      });
    }).catch(() => {
      if (!cancelled) setCycleInsight(null);
    });

    return () => { cancelled = true; };
  }, [user, progressProfile?.gender]);

  useEffect(() => {
    if (!user) return;
    getBodyMeasurements(user.uid).then((result) => {
      setBodyMeasurements(result.success ? result.data.entries || [] : []);
    }).catch(() => setBodyMeasurements([]));
  }, [user]);

  // SABİT hedefleri yükle: önce Firestore, yoksa localStorage, yoksa Hesaplayıcı planından türet
  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await getNutritionGoals(user.uid);
      if (result.success) {
        setGoals(result.data);
        setScopedJson('nutrition_goals', user.uid, result.data);
        return;
      }
      const savedGoals = getScopedJson('nutrition_goals', user.uid, null);
      if (savedGoals) { setGoals(savedGoals); return; }
      // İlk kez: eski Hesaplayıcı planı varsa ondan başlangıç değeri al
      try {
        const plan = getScopedJson('nutrition_plan', user.uid, null);
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
  const effectiveRangeKey = lockRangeKey || rangeKey;
  const setRangeKey = (key) => {
    if (lockRangeKey) return;
    setRangeKeyState(key);
  };

  const dates = getDateList(anchorDate, effectiveRangeKey, customRange);
  const customTooLong = effectiveRangeKey === 'custom' && isCustomRangeTooLong(customRange);

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
      if (effectiveRangeKey === 'day') {
        const todayLog = logs[anchorDate];
        setNoteDraft(todayLog?.notes || '');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, anchorDate, effectiveRangeKey, customRange.start, customRange.end]);

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
  const meaningfulDays = dailyTotals.filter((d) =>
    d.calories > 0 ||
    d.water > 0 ||
    d.sleepHours ||
    d.workouts.length > 0 ||
    d.supplements.length > 0 ||
    d.vitals
  );
  const dataCoverage = dates.length ? Math.round((meaningfulDays.length / dates.length) * 100) : 0;
  const avgCalories = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length)
    : 0;
  const avgWater = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.water, 0) / daysWithData.length)
    : 0;
  const macroDays = dailyTotals.filter((d) => d.calories > 0 || d.protein > 0 || d.carbs > 0 || d.fats > 0);
  const avgProtein = macroDays.length
    ? Math.round(macroDays.reduce((s, d) => s + d.protein, 0) / macroDays.length)
    : 0;
  const avgCarbs = macroDays.length
    ? Math.round(macroDays.reduce((s, d) => s + d.carbs, 0) / macroDays.length)
    : 0;
  const avgFats = macroDays.length
    ? Math.round(macroDays.reduce((s, d) => s + d.fats, 0) / macroDays.length)
    : 0;
  const sleepDays = dailyTotals.filter((d) => d.sleepHours);
  const avgSleep = sleepDays.length
    ? (sleepDays.reduce((s, d) => s + d.sleepHours, 0) / sleepDays.length).toFixed(1)
    : null;
  const activityDays = dailyTotals
    .map((d) => ({ ...d, activity: activityTotals(d) }))
    .filter((d) => d.activity.steps || d.activity.activeCalories || d.activity.durationMin || d.activity.distanceKm);
  const stepsDays = activityDays.filter((d) => d.activity.steps);
  const avgSteps = stepsDays.length
    ? Math.round(stepsDays.reduce((s, d) => s + (d.activity.steps || 0), 0) / stepsDays.length)
    : null;
  const activityDaysMin = activityDays.map((d) => d.activity.durationMin).filter((m) => m > 0);
  const avgWorkoutMin = activityDaysMin.length
    ? Math.round(activityDaysMin.reduce((s, m) => s + m, 0) / activityDaysMin.length)
    : null;
  // Bilimsel kalori açığı: toplam harcama (BMR + aktif) - alınan, sadece öğün girilen günler
  const calorieDays = dailyTotals.filter((d) => d.calories > 0);
  const avgRealDeficit = avgDeficitFn(
    bmr,
    calorieDays.map((d) => ({ consumed: d.calories, activeCalories: activityTotals(d).activeCalories, vitals: d.vitals || {}, date: d.date }))
  );
  const maxCalories = Math.max(...dailyTotals.map((d) => d.calories), 1);
  const maxWater = Math.max(...dailyTotals.map((d) => d.water), 1);
  const maxSleep = Math.max(...dailyTotals.map((d) => d.sleepHours || 0), 1);
  const maxProtein = Math.max(...dailyTotals.map((d) => d.protein), goals?.protein || 1, 1);
  const maxCarbs = Math.max(...dailyTotals.map((d) => d.carbs), goals?.carbs || 1, 1);
  const maxFats = Math.max(...dailyTotals.map((d) => d.fats), goals?.fats || 1, 1);
  const maxSteps = Math.max(...dailyTotals.map((d) => activityTotals(d).steps || 0), 1);
  const maxActiveCalories = Math.max(...dailyTotals.map((d) => activityTotals(d).activeCalories || 0), 1);
  const maxActivityMin = Math.max(...dailyTotals.map((d) => activityTotals(d).durationMin || 0), 1);

  const calorieGoalDays = goals ? calorieDays.filter((d) => d.calories >= goals.calories * 0.9 && d.calories <= goals.calories * 1.1).length : 0;
  const proteinGoalDays = goals ? macroDays.filter((d) => d.protein >= goals.protein * 0.8).length : 0;
  const waterGoalDays = goals ? dailyTotals.filter((d) => d.water >= goals.water).length : 0;
  const activityGoalDays = activityDays.length;
  const complianceChecks = goals ? [
    { done: calorieGoalDays, total: Math.max(calorieDays.length, 1) },
    { done: proteinGoalDays, total: Math.max(macroDays.length, 1) },
    { done: waterGoalDays, total: dates.length },
    { done: activityGoalDays, total: dates.length }
  ] : [];
  const complianceScore = complianceChecks.length
    ? Math.round((complianceChecks.reduce((sum, item) => sum + (item.done / item.total), 0) / complianceChecks.length) * 100)
    : null;
  const targetCalorieBalances = goals
    ? calorieDays.map((d) => goals.calories - d.calories)
    : [];
  const avgTargetCalorieBalance = targetCalorieBalances.length
    ? Math.round(targetCalorieBalances.reduce((sum, value) => sum + value, 0) / targetCalorieBalances.length)
    : null;
  const todayTargetCalorieBalance = goals && dailyTotals[0]
    ? Math.round(goals.calories - dailyTotals[0].calories)
    : null;

  const sortedMeasurements = [...bodyMeasurements].sort((a, b) => new Date(a.date) - new Date(b.date));
  const waistEntries = sortedMeasurements.filter((item) => item.waist);
  const waistChange = waistEntries.length >= 2
    ? waistEntries[waistEntries.length - 1].waist - waistEntries[0].waist
    : null;
  const sortedWeights = [...(weightState.entries || [])].filter((item) => item.weight).sort((a, b) => new Date(a.date) - new Date(b.date));
  const rangeWeights = sortedWeights.filter((item) => item.date >= dates[0] && item.date <= dates[dates.length - 1]);
  const recentWeights = sortedWeights.slice(-7);
  const currentWeight = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : null;
  const previousWeight = sortedWeights.length >= 2 ? sortedWeights[sortedWeights.length - 2].weight : null;
  const weightChange = rangeWeights.length >= 2
    ? rangeWeights[rangeWeights.length - 1].weight - rangeWeights[0].weight
    : sortedWeights.length >= 2 ? sortedWeights[sortedWeights.length - 1].weight - sortedWeights[0].weight : null;
  const weightAverage7 = recentWeights.length
    ? recentWeights.reduce((sum, item) => sum + item.weight, 0) / recentWeights.length
    : null;
  const targetWeight = parseFloat(weightState.targetWeight);
  const targetRemaining = currentWeight != null && targetWeight ? currentWeight - targetWeight : null;
  const lastWeightDate = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].date : null;
  const lastWaistDate = waistEntries.length ? waistEntries[waistEntries.length - 1].date : null;
  const daysSince = (date) => date ? Math.max(0, Math.floor((parseDateKey(todayKey()) - parseDateKey(date)) / 86400000)) : null;
  const dayDiffLocal = (from, to) => Math.round((parseDateKey(to) - parseDateKey(from)) / 86400000);
  const formatLongDate = (key) => parseDateKey(key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const rawTargetDate = progressProfile?.targetDate || progressProfile?.goalDate || '';
  const fallbackTargetDate = !rawTargetDate && (user?.email || '').toLowerCase() === 'emineay12@gmail.com' ? '2027-01-01' : '';
  const targetDate = isValidTargetDate(rawTargetDate) ? rawTargetDate : fallbackTargetDate;
  const targetDateIssue = rawTargetDate && !isValidTargetDate(rawTargetDate)
    ? 'Hedef tarihi geçersiz. 2026-2035 arasında gelecek bir tarih seç.'
    : '';
  const weightRateKgPerDay = sortedWeights.length >= 2
    ? (sortedWeights[sortedWeights.length - 1].weight - sortedWeights[0].weight) / Math.max(1, dayDiffLocal(sortedWeights[0].date, sortedWeights[sortedWeights.length - 1].date))
    : null;
  const dailyTargetDirection = currentWeight != null && targetWeight ? Math.sign(targetWeight - currentWeight) : 0;
  const movingTowardTarget = weightRateKgPerDay != null && dailyTargetDirection !== 0 && Math.sign(weightRateKgPerDay) === dailyTargetDirection;
  const etaDays = movingTowardTarget && targetRemaining != null
    ? Math.ceil(Math.abs(targetRemaining) / Math.max(Math.abs(weightRateKgPerDay), 0.001))
    : null;
  const etaDate = etaDays != null && etaDays <= 730 ? shiftKey(todayKey(), etaDays) : null;
  const plannedWeightToday = targetDate && sortedWeights.length && targetWeight && dayDiffLocal(sortedWeights[0].date, targetDate) > 0
    ? (() => {
      const start = sortedWeights[0];
      const totalDays = Math.max(1, dayDiffLocal(start.date, targetDate));
      const elapsed = Math.max(0, Math.min(totalDays, dayDiffLocal(start.date, todayKey())));
      return start.weight + ((targetWeight - start.weight) * (elapsed / totalDays));
    })()
    : null;
  const planDelta = plannedWeightToday != null && currentWeight != null ? currentWeight - plannedWeightToday : null;
  const latestDelta = currentWeight != null && previousWeight != null ? currentWeight - previousWeight : null;
  const averageDirection = weightAverage7 != null && currentWeight != null ? currentWeight - weightAverage7 : null;
  const formatKg = (value, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)} kg`;
  const scaleNoiseNote = (() => {
    if (latestDelta == null || weightAverage7 == null) return null;
    if (latestDelta > 0.4 && averageDirection <= 0.2) return 'Son tartı yükselmiş ama 7 kayıt ortalaması panik gerektirmiyor; tek güne göre karar verme.';
    if (latestDelta < -0.4 && Math.abs(averageDirection) <= 0.2) return 'Son tartı hızlı düşmüş olabilir; trendi 7 kayıt ortalamasıyla doğrulamak daha doğru.';
    if (Math.abs(latestDelta) >= 0.7) {
      const cyclePart = cycleInsight?.weightNote ? ` ${cycleInsight.weightNote}` : '';
      return `Son tartıda belirgin oynama var. Tuz, su, uyku, antrenman yoğunluğu ve tartı saatini kontrol et.${cyclePart}`;
    }
    return null;
  })();
  const dayQuality = (d) => {
    const activity = activityTotals(d);
    const checks = [];
    const addCheck = (label, status, detail) => checks.push({ label, status, detail });

    if (goals && d.calories > 0) {
      const ok = d.calories >= goals.calories * 0.9 && d.calories <= goals.calories * 1.1;
      addCheck('Kalori', ok, `${Math.round(d.calories)} / ${goals.calories} kcal`);
    } else {
      addCheck('Kalori', null, 'veri yok');
    }

    if (goals && (d.protein || d.calories)) {
      const target = Math.round(goals.protein * 0.8);
      addCheck('Protein', d.protein >= target, `${Math.round(d.protein)}g / min ${target}g`);
    } else {
      addCheck('Protein', null, 'veri yok');
    }

    if (goals && d.water > 0) {
      addCheck('Su', d.water >= goals.water, `${Math.round(d.water)} / ${goals.water} ml`);
    } else {
      addCheck('Su', null, 'veri yok');
    }

    if (activity.steps || activity.durationMin) {
      addCheck('Aktivite', true, activity.steps ? `${Math.round(activity.steps)} adım` : `${Math.round(activity.durationMin)} dk`);
    } else {
      addCheck('Aktivite', null, 'veri yok');
    }

    const scored = checks.filter((item) => item.status !== null);
    if (!scored.length) {
      return {
        quality: 'empty',
        scoreText: 'kayıt yok',
        detail: checks.map((item) => `${item.label}: ${item.detail}`).join(' · ')
      };
    }
    const passed = scored.filter((item) => item.status).length;
    const ratio = passed / scored.length;
    const quality = ratio >= 0.75 ? 'good' : ratio >= 0.45 ? 'ok' : 'low';
    return {
      quality,
      scoreText: `${passed}/${scored.length} kriter`,
      detail: checks.map((item) => {
        if (item.status === null) return `${item.label}: ${item.detail}`;
        return `${item.label}: ${item.status ? 'tamam' : 'eksik'} (${item.detail})`;
      }).join(' · ')
    };
  };
  const progressCalendarDays = dailyTotals.map((d) => ({ date: d.date, ...dayQuality(d) }));
  const insightItems = [];
  if (weightChange != null) {
    insightItems.push({
      label: 'Kilo Trendi',
      value: `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`,
      tone: weightChange < 0 ? 'good' : weightChange > 0 ? 'watch' : 'neutral'
    });
  }
  if (weightAverage7 != null) {
    insightItems.push({
      label: '7 Kayıt Ort.',
      value: `${weightAverage7.toFixed(1)} kg`,
      tone: previousWeight && currentWeight < previousWeight ? 'good' : 'neutral'
    });
  }
  if (targetRemaining != null) {
    insightItems.push({
      label: targetRemaining >= 0 ? 'Hedefe Kalan' : 'Hedef Altı',
      value: `${Math.abs(targetRemaining).toFixed(1)} kg`,
      tone: targetRemaining <= 0 ? 'good' : 'neutral'
    });
  }
  if (etaDate) {
    insightItems.push({
      label: 'Tahmini Hedef',
      value: formatShort(etaDate),
      tone: targetDate && etaDate <= targetDate ? 'good' : 'neutral'
    });
  }
  if (planDelta != null) {
    insightItems.push({
      label: 'Plana Göre',
      value: `${planDelta > 0 ? '+' : ''}${planDelta.toFixed(1)} kg`,
      tone: planDelta <= 0 ? 'good' : 'watch'
    });
  }
  if (waistChange != null) {
    insightItems.push({
      label: 'Bel Değişimi',
      value: `${waistChange > 0 ? '+' : ''}${waistChange.toFixed(1)} cm`,
      tone: waistChange < 0 ? 'good' : waistChange > 0 ? 'watch' : 'neutral'
    });
  }

  const dataWarnings = [];
  const weightAge = daysSince(lastWeightDate);
  const waistAge = daysSince(lastWaistDate);
  if (weightAge == null) dataWarnings.push('Kilo kaydı yok.');
  else if (weightAge >= 7) dataWarnings.push(`Son kilo kaydı ${weightAge} gün önce.`);
  if (waistAge == null) dataWarnings.push('Bel ölçüsü yok.');
  else if (waistAge >= 14) dataWarnings.push(`Son bel ölçüsü ${waistAge} gün önce.`);
  if (dataCoverage < 60) dataWarnings.push(`Bu aralıkta veri doluluğu düşük: %${dataCoverage}.`);
  if (sleepDays.length === 0 && effectiveRangeKey !== 'day') dataWarnings.push('Uyku verisi yok.');

  const routeDetails = (() => {
    const items = [];
    if (!currentWeight || !targetWeight) {
      items.push('Hedef rotası için mevcut kilo ve hedef kilo birlikte gerekli.');
      return items;
    }
    if (targetDate && plannedWeightToday != null && planDelta != null) {
      const status = Math.abs(planDelta) < 0.3
        ? 'plan çizgisine çok yakınsın'
        : planDelta > 0
          ? `bugünkü plan çizgisinin ${formatKg(planDelta)} üzerindesin`
          : `bugünkü plan çizgisinin ${Math.abs(planDelta).toFixed(1)} kg altındasın`;
      items.push(`Hedef tarih çizgisi: ${formatLongDate(targetDate)} için bugün beklenen ${plannedWeightToday.toFixed(1)} kg; şu an ${currentWeight.toFixed(1)} kg, yani ${status}.`);
    } else if (!targetDate) {
      items.push('Hedef tarih girilirse uygulama bugünkü beklenen kiloyu ve plandan farkı hesaplar.');
    }

    if (etaDate) {
      const etaGap = targetDate ? dayDiffLocal(targetDate, etaDate) : null;
      const etaStatus = etaGap == null
        ? ''
        : etaGap <= 0
          ? ` Bu hız hedef tarihinden yaklaşık ${Math.abs(etaGap)} gün erken/yakın bitiriyor.`
          : ` Bu hız hedef tarihinden yaklaşık ${etaGap} gün geç kalıyor.`;
      items.push(`Trend tahmini: son kayıtların ortalama yönü korunursa hedefe varış ${formatLongDate(etaDate)}.${etaStatus}`);
    } else if (sortedWeights.length < 2) {
      items.push('Trend tahmini için en az iki kilo kaydı gerekiyor.');
    } else if (!movingTowardTarget) {
      items.push('Trend tahmini şu an hedef yönünde değil veya çok kararsız; tek tarih yerine birkaç tartı daha beklemek daha doğru.');
    }

    if (scaleNoiseNote) {
      items.push('Son tartı tek başına karar sinyali değil; rota yorumunda 7 kayıt ortalaması daha önemli.');
    } else if (weightAverage7 != null) {
      items.push(`7 kayıt ortalaması ${weightAverage7.toFixed(1)} kg; günlük iniş çıkışları buna göre süzmek daha sağlıklı.`);
    }

    return items.slice(0, 3);
  })();

  const routeSummary = (() => {
    if (!currentWeight || !targetWeight) {
      return {
        tone: 'neutral',
        title: 'Rota eksik',
        text: 'Mevcut kilo ve hedef kilo birlikte olmadan plan çizgisi kurulamaz.',
        next: 'Önce hedef kilo ve düzenli tartı kaydı gerekir.'
      };
    }
    if (planDelta != null && Math.abs(planDelta) <= 0.3) {
      return {
        tone: 'good',
        title: 'Plan çizgisine yakın',
        text: `Bugünkü beklenen kilo ile gerçek kilo arasındaki fark ${Math.abs(planDelta).toFixed(1)} kg. Bu pratikte aynı çizgi sayılır.`,
        next: 'Bugün büyük ayar yapma; aynı düzeni birkaç kayıt daha sürdür.'
      };
    }
    if (planDelta != null && planDelta > 0) {
      return {
        tone: planDelta > 1 ? 'watch' : 'neutral',
        title: 'Planın biraz gerisinde',
        text: `Bugünkü hedef çizgisine göre ${planDelta.toFixed(1)} kg yukarıdasın. Bu tek tartıysa önce dalgalanma ihtimalini elemek gerekir.`,
        next: 'İlk hamle kalori kısmak değil; kayıt kaçağı, adım ortalaması, uyku ve tartı saatini sabitlemek.'
      };
    }
    if (planDelta != null && planDelta < 0) {
      return {
        tone: 'good',
        title: 'Planın önünde',
        text: `Bugünkü hedef çizgisine göre ${Math.abs(planDelta).toFixed(1)} kg aşağıdasın. Hız fazla agresifse sürdürülebilirlik bozulabilir.`,
        next: 'Protein, uyku ve antrenman performansını koruyarak devam et.'
      };
    }
    if (etaDate) {
      return {
        tone: targetDate && etaDate > targetDate ? 'watch' : 'neutral',
        title: 'Trend tahmini var',
        text: `Son kilo yönü korunursa tahmini varış ${formatLongDate(etaDate)}.`,
        next: 'Hedef tarih girersen bugünkü beklenen kilo ve gerçek fark da görünür.'
      };
    }
    return {
      tone: 'neutral',
      title: 'Trend kararsız',
      text: 'Kilo yönü hedefe doğru değil veya veri sayısı düşük. Bu durumda varış tarihi güvenilir olmaz.',
      next: 'Aynı tartı koşulunda birkaç kayıt daha eklemek rota yorumunu güçlendirir.'
    };
  })();

  const progressSignal = (() => {
    if (meaningfulDays.length === 0) return 'Bu aralıkta yorum yapacak kadar kayıt yok.';
    if (scaleNoiseNote) return scaleNoiseNote;
    if (planDelta != null && planDelta > 0.8) return `Planın yaklaşık ${planDelta.toFixed(1)} kg gerisindesin. Kaloriyi sert kısmadan önce kayıt doğruluğu, adım ortalaması ve uyku düzeni birlikte kontrol edilmeli.`;
    if (planDelta != null && planDelta < -0.5) return `Planın yaklaşık ${Math.abs(planDelta).toFixed(1)} kg önündesin. Çok agresifleşmeden sürdürülebilirliği koru.`;
    if (avgRealDeficit != null && weightChange != null && waistChange != null && avgRealDeficit > 250 && Math.abs(weightChange) < 0.3 && waistChange < 0) return 'Kilo sabit ama bel düşüyor; yağ kaybı veya kompozisyon iyileşmesi olabilir.';
    if (avgRealDeficit != null && weightChange != null && avgRealDeficit > 250 && weightChange > 0.4) return 'Kalori açığı görünmesine rağmen kilo artmış. Tartı saati, su tutma ve kayıt doğruluğunu kontrol etmek gerekir.';
    if (avgRealDeficit != null && weightChange != null && avgRealDeficit < 100 && weightChange >= 0) return 'Kilo ilerlemesi zayıf. Kaloriyi kısmadan önce hareketi veya adımı artırmak daha mantıklı.';
    if (goals && complianceScore >= 75) return 'Genel uyum iyi. Aynı düzeni koruyup kilo ve bel trendini izlemek mantıklı.';
    if (goals && avgProtein && avgProtein < goals.protein * 0.8) return 'Protein ortalaması hedefin altında. Öncelik öğünleri kısmadan proteini tamamlamak olmalı.';
    if (goals && avgWater && avgWater < goals.water * 0.75) return 'Su tarafı zayıf görünüyor. Gün içinde daha erken saatlere su hedefi bölmek işe yarar.';
    if (!avgSteps && !avgWorkoutMin) return 'Beslenme kaydı var ama hareket verisi zayıf. İlerleme yorumunu güçlendirmek için aktivite girilmeli.';
    return 'Veri akışı yeterli. Bir sonraki karar için kilo ve bel ölçüsüyle birlikte takip edelim.';
  })();

  const actionItems = [];
  if (scaleNoiseNote) actionItems.push(`Tartı dalgalanması ${formatKg(latestDelta)}: bugün plan değiştirme, aynı tartı saatinde 3-4 kayıt daha bekle.`);
  if (cycleInsight?.supportNote) actionItems.push(cycleInsight.supportNote);
  if (etaDate && targetDate && etaDate > targetDate) actionItems.push(`Tahmini varış ${formatLongDate(etaDate)}; hedef tarihe yetişmek için önce yürüyüş/adım ve protein uyumunu artır.`);
  if (planDelta != null && planDelta > 0.8) actionItems.push(`Plan farkı ${formatKg(planDelta)}: kalori düşürmeden önce 7 günlük adım ortalamasını ve kayıt kaçaklarını kontrol et.`);
  if (dataWarnings.length > 0) actionItems.push(dataWarnings[0]);
  if (goals && avgProtein && avgProtein < goals.protein * 0.8) actionItems.push(`Protein ortalaması ${avgProtein}g; hedefe yaklaşmak için +${Math.max(5, Math.round(goals.protein - avgProtein))}g ekle.`);
  if (goals && avgWater && avgWater < goals.water * 0.75) actionItems.push(`Su ortalaması ${avgWater} ml; hedef ${goals.water} ml.`);
  if (!avgSteps && !avgWorkoutMin) actionItems.push('Aktivite girilmemiş; yürüyüş/adım verisi eklenirse yorum netleşir.');
  if (actionItems.length === 0) actionItems.push('Bu aralık için ana sinyal temiz. Planı bozma, aynı rutini sürdür.');

  const trendEvidenceItems = [
    weightChange != null ? `Kilo değişimi: seçili aralıkta ${formatKg(weightChange)}; son tartı farkı ${latestDelta == null ? 'yok' : formatKg(latestDelta)}.` : null,
    goals ? `Uyum dağılımı: kalori ${calorieGoalDays}/${Math.max(calorieDays.length, 1)}, protein ${proteinGoalDays}/${Math.max(macroDays.length, 1)}, su ${waterGoalDays}/${dates.length}, aktivite ${activityGoalDays}/${dates.length}.` : null,
    avgRealDeficit != null ? `Enerji sinyali: BMR + aktif kaloriye göre ortalama günlük açık yaklaşık ${Math.round(avgRealDeficit)} kcal.` : null,
    avgTargetCalorieBalance != null ? `Hedef sinyali: günlük kalori hedefine göre ortalama ${Math.abs(avgTargetCalorieBalance)} kcal ${avgTargetCalorieBalance >= 0 ? 'kalan' : 'hedef üstü'} var.` : null,
    waistChange == null ? 'Bel ölçüsü olmadığı için yağ kaybı ile su/kas glikojeni ayrımı zayıf kalıyor.' : `Bel değişimi: ${waistChange > 0 ? '+' : ''}${waistChange.toFixed(1)} cm.`,
    cycleInsight?.weightNote ? `Döngü notu: ${cycleInsight.phase.label}, ${cycleInsight.cycleDay}. gün. ${cycleInsight.weightNote}` : null
  ].filter(Boolean).slice(0, 4);

  const bestProteinDay = macroDays.length > 0 ? [...macroDays].sort((a, b) => b.protein - a.protein)[0] : null;
  const highestCalorieDay = daysWithData.length > 0 ? [...daysWithData].sort((a, b) => b.calories - a.calories)[0] : null;
  const waterLoggedDays = dailyTotals.filter((d) => d.water > 0);
  const lowestWaterDay = waterLoggedDays.length > 0 ? [...waterLoggedDays].sort((a, b) => a.water - b.water)[0] : null;
  const bestWorstItems = [
    bestProteinDay ? {
      label: 'En iyi protein',
      value: `${formatShort(bestProteinDay.date)} · ${Math.round(bestProteinDay.protein)}g`
    } : null,
    highestCalorieDay ? {
      label: 'En yüksek kalori',
      value: `${formatShort(highestCalorieDay.date)} · ${Math.round(highestCalorieDay.calories)} kcal`
    } : null,
    lowestWaterDay ? {
      label: 'En düşük su',
      value: `${formatShort(lowestWaterDay.date)} · ${Math.round(lowestWaterDay.water)} ml`
    } : null
  ].filter(Boolean);

  // Özel aralıkta pencerenin tamamını (gün sayısı kadar) ileri/geri kaydırır.
  const shiftAnchor = (direction) => {
    const today = todayKey();
    if (effectiveRangeKey === 'custom') {
      const step = dates.length * direction;
      const nextEnd = shiftKey(customRange.end, step);
      if (nextEnd > today) {
        setCustomRange({ start: shiftKey(today, -(dates.length - 1)), end: today });
        return;
      }
      setCustomRange({ start: shiftKey(customRange.start, step), end: nextEnd });
      return;
    }
    const next = shiftKey(anchorDate, direction * RANGE_DAYS[effectiveRangeKey]);
    setAnchorDate(next > today ? today : next);
  };

  const buildExportText = () => {
    const rangeTitle = { day: 'Günlük', week: 'Haftalık', month: 'Aylık', custom: `${dates.length} Günlük` }[effectiveRangeKey];
    const lines = [`30 Gün Fit - ${rangeTitle} Özet (${formatShort(dates[0])} - ${formatShort(dates[dates.length - 1])})`, ''];
    dailyTotals.forEach((d) => {
      if (d.calories === 0 && d.water === 0 && !d.sleepHours && d.workouts.length === 0 && d.supplements.length === 0 && !d.notes) return;
      lines.push(`${formatShort(d.date)}:`);
      if (d.calories) lines.push(`  Kalori: ${Math.round(d.calories)} kcal, Protein: ${Math.round(d.protein)}g, Karbonhidrat: ${Math.round(d.carbs)}g, Yağ: ${Math.round(d.fats)}g`);
      if (d.water) lines.push(`  Su: ${d.water} ml`);
      if (d.sleepHours) lines.push(`  Uyku: ${d.sleepHours} saat${d.sleepScore ? `, Skor: ${d.sleepScore}` : ''}`);
      const activity = activityTotals(d);
      if (activitySummary(activity)) lines.push(`  Aktivite: ${activitySummary(activity)}`);
      if (d.supplements.length) lines.push(`  Takviyeler: ${d.supplements.map((s) => s.name).join(', ')}`);
      if (d.notes) lines.push(`  Not: ${d.notes}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const buildExportTable = (title, columns, rows) => {
    const safeRows = rows.length ? rows : [columns.reduce((acc, column) => ({ ...acc, [column.key]: '-' }), {})];
    return `
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${safeRows.map((row) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(formatExportValue(row[column.key]))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const handleExcelExport = () => {
    const rangeTitle = { day: 'Günlük', week: 'Haftalık', month: 'Aylık', custom: `${dates.length} Günlük Özel` }[effectiveRangeKey];
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const rangeMeasurements = sortedMeasurements.filter((item) => item.date >= startDate && item.date <= endDate);
    const exportWeights = rangeWeights.length ? rangeWeights : (currentWeight != null ? [{ date: lastWeightDate, weight: currentWeight }] : []);

    const summaryRows = [
      { metric: 'Aralık', value: `${rangeTitle} (${startDate} - ${endDate})` },
      { metric: 'Gün sayısı', value: dates.length },
      { metric: 'Kayıtlı gün', value: meaningfulDays.length },
      { metric: 'Veri doluluğu', value: `%${dataCoverage}` },
      { metric: 'Uyum skoru', value: complianceScore == null ? '-' : `%${complianceScore}` },
      { metric: 'Ortalama kalori', value: avgCalories ? `${avgCalories} kcal` : '-' },
      { metric: 'Ortalama protein', value: avgProtein ? `${avgProtein} g` : '-' },
      { metric: 'Ortalama karbonhidrat', value: avgCarbs ? `${avgCarbs} g` : '-' },
      { metric: 'Ortalama yağ', value: avgFats ? `${avgFats} g` : '-' },
      { metric: 'Ortalama su', value: avgWater ? `${avgWater} ml` : '-' },
      { metric: 'Ortalama uyku', value: avgSleep ? `${avgSleep} saat` : '-' },
      { metric: 'Ortalama adım', value: avgSteps || '-' },
      { metric: 'Ortalama aktivite', value: avgWorkoutMin ? `${avgWorkoutMin} dk` : '-' },
      { metric: 'Ortalama kalori açığı/fazlası', value: avgRealDeficit == null ? '-' : `${avgRealDeficit} kcal` },
      { metric: 'Kilo değişimi', value: weightChange == null ? '-' : `${weightChange.toFixed(1)} kg` },
      { metric: 'Bel değişimi', value: waistChange == null ? '-' : `${waistChange.toFixed(1)} cm` },
      { metric: 'Ana yorum', value: progressSignal },
      { metric: 'Aksiyon', value: actionItems.slice(0, 3).join(' | ') }
    ];

    const dailyRows = dailyTotals.map((d) => {
      const activity = activityTotals(d);
      const quality = dayQuality(d);
      return {
        date: d.date,
        day: parseDateKey(d.date).toLocaleDateString('tr-TR', { weekday: 'long' }),
        calories: Math.round(d.calories || 0),
        protein: Math.round(d.protein || 0),
        carbs: Math.round(d.carbs || 0),
        fats: Math.round(d.fats || 0),
        water: Math.round(d.water || 0),
        sleepHours: d.sleepHours || '',
        sleepScore: d.sleepScore || '',
        steps: activity.steps ? Math.round(activity.steps) : '',
        activeCalories: activity.activeCalories ? Math.round(activity.activeCalories) : '',
        activityMinutes: activity.durationMin ? Math.round(activity.durationMin) : '',
        distanceKm: activity.distanceKm || '',
        workouts: d.workouts.length,
        supplements: d.supplements.map((s) => `${s.name}${s.dose ? ` (${s.dose})` : ''}`).join(', '),
        score: quality.scoreText,
        notes: d.notes || ''
      };
    });

    const mealRows = dailyTotals.flatMap((d) => d.meals.map((meal) => ({
      date: d.date,
      category: MEAL_CATEGORIES.find((cat) => cat.key === classifyMeal(meal))?.title || 'Öğün',
      name: stripCategoryPrefix(meal.name),
      calories: Math.round(Number(meal.calories) || 0),
      protein: Math.round(Number(meal.protein) || 0),
      carbs: Math.round(Number(meal.carbs) || 0),
      fats: Math.round(Number(meal.fats) || 0)
    })));

    const workoutRows = dailyTotals.flatMap((d) => d.workouts.map((workout) => ({
      date: d.date,
      type: WORKOUT_TYPE_LABELS[workout.type] || workout.type || 'Aktivite',
      title: workout.title || workout.exercises?.map((exercise) => exercise.name).join(', ') || '',
      durationMin: workout.duration_min || '',
      distanceKm: workout.distance_km || '',
      calories: workout.calories || '',
      exercises: workout.exercises?.map((exercise) => {
        const sets = (exercise.sets || []).map((set) => `${set.reps || '-'}x${set.weight || '-'}`).join(', ');
        return sets ? `${exercise.name}: ${sets}` : exercise.name;
      }).join(' | ') || ''
    })));

    const dayDetailRows = dailyTotals.map((d) => {
      const activity = activityTotals(d);
      const mealsText = d.meals.length
        ? d.meals.map((meal) => {
          const category = MEAL_CATEGORIES.find((cat) => cat.key === classifyMeal(meal))?.title || 'Öğün';
          return `${category}: ${stripCategoryPrefix(meal.name)} (${Math.round(Number(meal.calories) || 0)} kcal, P:${Math.round(Number(meal.protein) || 0)}g, K:${Math.round(Number(meal.carbs) || 0)}g, Y:${Math.round(Number(meal.fats) || 0)}g)`;
        }).join('\n')
        : '';
      const workoutsText = d.workouts.length
        ? d.workouts.map((workout) => {
          const title = workout.title || workout.exercises?.map((exercise) => exercise.name).join(', ') || WORKOUT_TYPE_LABELS[workout.type] || 'Antrenman';
          const exerciseText = workout.exercises?.map((exercise) => {
            const sets = (exercise.sets || []).map((set) => `${set.reps || '-'} tekrar x ${set.weight || '-'} kg`).join(', ');
            return sets ? `${exercise.name}: ${sets}` : exercise.name;
          }).join(' | ');
          const parts = [
            title,
            workout.duration_min ? `${workout.duration_min} dk` : null,
            workout.distance_km ? `${workout.distance_km} km` : null,
            exerciseText || null
          ].filter(Boolean);
          return parts.join(' · ');
        }).join('\n')
        : '';
      return {
        date: d.date,
        day: parseDateKey(d.date).toLocaleDateString('tr-TR', { weekday: 'long' }),
        nutritionTotals: `${Math.round(d.calories || 0)} kcal · P:${Math.round(d.protein || 0)}g · K:${Math.round(d.carbs || 0)}g · Y:${Math.round(d.fats || 0)}g`,
        meals: mealsText || 'Öğün kaydı yok',
        workoutTotals: activitySummary(activity) || 'Aktivite/antrenman kaydı yok',
        workouts: workoutsText || 'Antrenman detayı yok',
        water: d.water ? `${Math.round(d.water)} ml` : '',
        sleep: d.sleepHours ? `${d.sleepHours} saat${d.sleepScore ? ` · skor ${d.sleepScore}` : ''}` : '',
        notes: d.notes || ''
      };
    });

    const bodyRows = exportWeights.map((entry) => ({
      date: entry.date,
      type: 'Kilo',
      weight: entry.weight,
      waist: '',
      chest: '',
      hips: '',
      arm: '',
      thigh: '',
      note: ''
    })).concat(rangeMeasurements.map((entry) => ({
      date: entry.date,
      type: 'Ölçü',
      weight: '',
      waist: entry.waist || '',
      chest: entry.chest || '',
      hips: entry.hips || '',
      arm: entry.arm || '',
      thigh: entry.thigh || '',
      note: entry.notes || entry.note || ''
    })));

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            h2 { font-size: 16px; margin: 22px 0 8px; }
            p { margin: 0 0 12px; color: #4b5563; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
            th { background: #102033; color: #ffffff; font-weight: 700; }
            th, td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 12px; vertical-align: top; }
            td { mso-number-format:"\\@"; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>30 Gün Fit İlerleme Export</h1>
          <p>${escapeHtml(`${rangeTitle} · ${startDate} - ${endDate}`)}</p>
          ${buildExportTable('Özet', [
            { key: 'metric', label: 'Metrik' },
            { key: 'value', label: 'Değer' }
          ], summaryRows)}
          ${buildExportTable('Günlük Takip', [
            { key: 'date', label: 'Tarih' },
            { key: 'day', label: 'Gün' },
            { key: 'calories', label: 'Kalori' },
            { key: 'protein', label: 'Protein (g)' },
            { key: 'carbs', label: 'Karbonhidrat (g)' },
            { key: 'fats', label: 'Yağ (g)' },
            { key: 'water', label: 'Su (ml)' },
            { key: 'sleepHours', label: 'Uyku (saat)' },
            { key: 'sleepScore', label: 'Uyku skoru' },
            { key: 'steps', label: 'Adım' },
            { key: 'activeCalories', label: 'Aktif kcal' },
            { key: 'activityMinutes', label: 'Aktivite dk' },
            { key: 'distanceKm', label: 'Mesafe km' },
            { key: 'workouts', label: 'Antrenman sayısı' },
            { key: 'supplements', label: 'Takviyeler' },
            { key: 'score', label: 'Gün skoru' },
            { key: 'notes', label: 'Not' }
          ], dailyRows)}
          ${buildExportTable('Gün Gün Beslenme ve Antrenman', [
            { key: 'date', label: 'Tarih' },
            { key: 'day', label: 'Gün' },
            { key: 'nutritionTotals', label: 'Beslenme toplamı' },
            { key: 'meals', label: 'Öğün detayları' },
            { key: 'workoutTotals', label: 'Aktivite toplamı' },
            { key: 'workouts', label: 'Antrenman detayları' },
            { key: 'water', label: 'Su' },
            { key: 'sleep', label: 'Uyku' },
            { key: 'notes', label: 'Not' }
          ], dayDetailRows)}
          ${buildExportTable('Öğünler', [
            { key: 'date', label: 'Tarih' },
            { key: 'category', label: 'Kategori' },
            { key: 'name', label: 'İçerik' },
            { key: 'calories', label: 'Kalori' },
            { key: 'protein', label: 'Protein (g)' },
            { key: 'carbs', label: 'Karbonhidrat (g)' },
            { key: 'fats', label: 'Yağ (g)' }
          ], mealRows)}
          ${buildExportTable('Antrenmanlar', [
            { key: 'date', label: 'Tarih' },
            { key: 'type', label: 'Tür' },
            { key: 'title', label: 'Başlık' },
            { key: 'durationMin', label: 'Süre dk' },
            { key: 'distanceKm', label: 'Mesafe km' },
            { key: 'calories', label: 'Kalori' },
            { key: 'exercises', label: 'Egzersizler' }
          ], workoutRows)}
          ${buildExportTable('Kilo ve Ölçüler', [
            { key: 'date', label: 'Tarih' },
            { key: 'type', label: 'Kayıt türü' },
            { key: 'weight', label: 'Kilo' },
            { key: 'waist', label: 'Bel' },
            { key: 'chest', label: 'Göğüs' },
            { key: 'hips', label: 'Kalça' },
            { key: 'arm', label: 'Kol' },
            { key: 'thigh', label: 'Bacak' },
            { key: 'note', label: 'Not' }
          ], bodyRows)}
        </body>
      </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    downloadBlob(blob, `30gunfit-ilerleme-${startDate}-${endDate}.xls`);
  };

  const handleChatGptFullExport = async () => {
    if (!user) return;
    try {
      const exportDates = getExportDatesFromAccountStart(user);
      const [
        allLogs,
        allCalories,
        waterResult,
        weightResult,
        measurementsResult,
        goalsResult,
        profileResult
      ] = await Promise.all([
        getDailyLogsRange(user.uid, exportDates),
        getCalorieTrackingRange(user.uid, exportDates),
        getWaterTracker(user.uid),
        getWeightTracker(user.uid, user.email),
        getBodyMeasurements(user.uid),
        getNutritionGoals(user.uid),
        getUserProfile(user.uid)
      ]);

      const allDates = Array.from(new Set([
        ...Object.keys(allLogs || {}),
        ...Object.keys(allCalories || {}),
        ...(waterResult.success ? (waterResult.data.entries || []).map((entry) => entry.date).filter(Boolean) : []),
        ...(weightResult.success ? (weightResult.data.entries || []).map((entry) => entry.date).filter(Boolean) : []),
        ...(measurementsResult.success ? (measurementsResult.data.entries || []).map((entry) => entry.date).filter(Boolean) : [])
      ])).sort();

      const numberOrZero = (value) => Number(value) || 0;
      const formatMacro = (value, unit = 'g') => `${Math.round(numberOrZero(value))}${unit}`;
      const waterByExportDate = {};
      if (waterResult.success) {
        (waterResult.data.entries || []).forEach((entry) => {
          if (!entry.date) return;
          waterByExportDate[entry.date] = (waterByExportDate[entry.date] || 0) + numberOrZero(entry.amount);
        });
      }
      const weightsByDate = {};
      if (weightResult.success) {
        (weightResult.data.entries || []).forEach((entry) => {
          if (entry.date && entry.weight) weightsByDate[entry.date] = entry.weight;
        });
      }
      const measurementsByDate = {};
      if (measurementsResult.success) {
        (measurementsResult.data.entries || []).forEach((entry) => {
          if (entry.date) measurementsByDate[entry.date] = entry;
        });
      }
      const mealText = (meal) => {
        const category = MEAL_CATEGORIES.find((cat) => cat.key === classifyMeal(meal))?.title || meal.mealType || 'Öğün';
        const lines = [
          `- ${category}: ${stripCategoryPrefix(meal.name) || 'Adsız öğün'}${meal.portion ? ` (${meal.portion})` : ''}`,
          `  Besin değerleri: ${Math.round(numberOrZero(meal.calories))} kcal | Protein ${formatMacro(meal.protein)} | Karbonhidrat ${formatMacro(meal.carbs)} | Yağ ${formatMacro(meal.fats)}`
        ];
        if (Array.isArray(meal.items) && meal.items.length > 0) {
          lines.push(`  İçerikler: ${meal.items.map((item) => {
            if (typeof item === 'string') return item;
            const name = item.name || item.food || item.foodName || item.title || 'ürün';
            const amount = item.amount || item.quantity || item.portion || item.serving || '';
            const calories = item.calories ? `, ${Math.round(numberOrZero(item.calories))} kcal` : '';
            const protein = item.protein ? `, P ${formatMacro(item.protein)}` : '';
            return `${name}${amount ? ` ${amount}` : ''}${calories}${protein}`;
          }).join('; ')}`);
        }
        if (meal.micronutrients && typeof meal.micronutrients === 'object') {
          const micros = Object.entries(meal.micronutrients)
            .filter(([, value]) => value != null && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .slice(0, 12);
          if (micros.length) lines.push(`  Mikro besinler: ${micros.join(', ')}`);
        }
        if (meal.source) lines.push(`  Kaynak: ${meal.source}`);
        return lines.join('\n');
      };
      const workoutText = (workout) => {
        const title = workout.title || workout.exercises?.map((exercise) => exercise.name).join(', ') || WORKOUT_TYPE_LABELS[workout.type] || 'Antrenman';
        const header = [
          `- ${title}`,
          workout.duration_min ? `${workout.duration_min} dk` : null,
          workout.distance_km ? `${workout.distance_km} km` : null,
          workout.calories ? `${Math.round(numberOrZero(workout.calories))} kcal` : null
        ].filter(Boolean).join(' | ');
        const exerciseLines = (workout.exercises || []).map((exercise) => {
          const sets = (exercise.sets || []).map((set, index) => {
            const weight = set.weight_kg ?? set.weight ?? set.kg;
            const reps = set.reps ?? set.repeat ?? set.count;
            const warmup = set.isWarmup ? 'ısınma, ' : '';
            if (weight != null && reps != null) return `${index + 1}. set: ${warmup}${weight} kg x ${reps} tekrar`;
            if (reps != null) return `${index + 1}. set: ${warmup}${reps} tekrar`;
            if (weight != null) return `${index + 1}. set: ${warmup}${weight} kg`;
            return `${index + 1}. set`;
          }).join('; ');
          return `  ${exercise.name || 'Egzersiz'}${sets ? ` -> ${sets}` : ''}`;
        });
        return [header, ...exerciseLines].join('\n');
      };

      const lines = [
        '30 Gün Fit - ChatGPT Analiz Dosyası',
        `Oluşturma zamanı: ${new Date().toLocaleString('tr-TR')}`,
        `Veri aralığı: ${allDates[0] || '-'} - ${allDates[allDates.length - 1] || '-'}`,
        '',
        'ChatGPT için talimat:',
        'Bu dosyada gün gün beslenme, antrenman, aktivite, su, uyku, kilo ve ölçü kayıtları var. Lütfen sadece ortalama özetlere bakma; gün bazında örüntüleri, eksik kayıtları, kalori/protein/su uyumunu, antrenman yoğunluğu ile kilo-bel trendini birlikte değerlendir. Sağlık/medikal tanı koymadan uygulanabilir öneriler ver.',
        '',
        'Kullanıcı hedefleri:',
        goalsResult.success
          ? `- Kalori: ${goalsResult.data.calories || '-'} kcal | Protein: ${goalsResult.data.protein || '-'}g | Karbonhidrat: ${goalsResult.data.carbs || '-'}g | Yağ: ${goalsResult.data.fats || '-'}g | Su: ${goalsResult.data.water || '-'} ml`
          : '- Hedef kaydı yok',
        '',
        'Profil özeti:',
        profileResult.success
          ? `- Yaş: ${profileResult.data.age || '-'} | Boy: ${profileResult.data.height || '-'} cm | Kilo: ${profileResult.data.weight || '-'} kg | Cinsiyet: ${profileResult.data.gender || '-'} | Hedef: ${profileResult.data.goal || '-'}`
          : '- Profil kaydı yok',
        '',
        'GÜN GÜN KAYITLAR'
      ];

      allDates.forEach((date) => {
        const log = allLogs[date] || {};
        const meals = allCalories[date]?.meals || [];
        const water = waterByExportDate[date] || 0;
        const sleep = log.sleep || {};
        const vitals = log.vitals || {};
        const measurements = measurementsByDate[date] || {};
        const totals = meals.reduce((acc, meal) => ({
          calories: acc.calories + numberOrZero(meal.calories),
          protein: acc.protein + numberOrZero(meal.protein),
          carbs: acc.carbs + numberOrZero(meal.carbs),
          fats: acc.fats + numberOrZero(meal.fats)
        }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

        lines.push('');
        lines.push(`## ${date} - ${parseDateKey(date).toLocaleDateString('tr-TR', { weekday: 'long' })}`);
        lines.push(`Beslenme toplamı: ${Math.round(totals.calories)} kcal | Protein ${formatMacro(totals.protein)} | Karbonhidrat ${formatMacro(totals.carbs)} | Yağ ${formatMacro(totals.fats)}`);
        lines.push('Öğünler:');
        lines.push(meals.length ? meals.map(mealText).join('\n') : '- Öğün kaydı yok');
        lines.push('Antrenmanlar:');
        lines.push((log.workouts || []).length ? (log.workouts || []).map(workoutText).join('\n') : '- Antrenman kaydı yok');
        lines.push(`Aktivite: ${vitals.steps ? `${vitals.steps} adım` : '-'} | Aktif kalori: ${vitals.active_calories || '-'} | Egzersiz: ${vitals.exercise_minutes || '-'} dk | Mesafe: ${vitals.distance_km || '-'} km`);
        lines.push(`Su: ${water || '-'} ml`);
        lines.push(`Uyku: ${sleep.duration_hours || '-'} saat${sleep.score ? ` | Skor: ${sleep.score}` : ''}`);
        lines.push(`Kilo/ölçü: Kilo ${weightsByDate[date] || '-'} kg | Bel ${measurements.waist || '-'} cm | Göğüs ${measurements.chest || '-'} cm | Kalça ${measurements.hips || '-'} cm | Kol ${measurements.arm || '-'} cm | Bacak ${measurements.thigh || '-'} cm`);
        if (log.notes) lines.push(`Not: ${log.notes}`);
      });

      const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
      const start = allDates[0] || todayKey();
      const end = allDates[allDates.length - 1] || todayKey();
      downloadBlob(blob, `30gunfit-chatgpt-analiz-dosyasi-${start}-${end}.txt`);
    } catch (error) {
      alert(`ChatGPT veri export alınamadı: ${error.message}`);
    }
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
      setScopedJson('nutrition_goals', user.uid, newGoals);
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

  const handleTargetDateChange = async (value) => {
    if (!user) return;
    if (value && !isValidTargetDate(value)) {
      const cleanedProfile = { ...(progressProfile || {}), targetDate: null };
      setProgressProfile(cleanedProfile);
      setScopedJson('userProfile', user.uid, cleanedProfile);
      setIsSavingTargetDate(true);
      try {
        await saveUserProfile(user.uid, cleanedProfile);
      } finally {
        setIsSavingTargetDate(false);
      }
      return;
    }
    const nextProfile = { ...(progressProfile || {}), targetDate: value || null };
    setProgressProfile(nextProfile);
    setScopedJson('userProfile', user.uid, nextProfile);
    setIsSavingTargetDate(true);
    try {
      await saveUserProfile(user.uid, nextProfile);
    } finally {
      setIsSavingTargetDate(false);
    }
  };

  // Öğün ekleme/düzenleme formu (kategoriler arasında ortak, kategori de değiştirilebilir)
  const renderMealForm = (mealId) => (
    <div className="trend-edit-form">
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

  const chartTabs = [
    { key: 'nutrition', label: 'Beslenme' },
    { key: 'activity', label: 'Aktivite' },
    { key: 'recovery', label: 'Uyku & Su' }
  ];

  const chartSeries = {
    nutrition: [
      { key: 'calories', label: 'Kalori', dot: 'lg-cal', fill: 'calories', max: Math.max(maxCalories, goals?.calories || 1), value: (d) => d.calories, unit: 'kcal' },
      { key: 'protein', label: 'Protein', dot: 'lg-protein', fill: 'protein', max: maxProtein, value: (d) => d.protein, unit: 'g' },
      { key: 'carbs', label: 'Karb.', dot: 'lg-carbs', fill: 'carbs', max: maxCarbs, value: (d) => d.carbs, unit: 'g' },
      { key: 'fats', label: 'Yağ', dot: 'lg-fats', fill: 'fats', max: maxFats, value: (d) => d.fats, unit: 'g' }
    ],
    activity: [
      { key: 'steps', label: 'Adım', dot: 'lg-steps', fill: 'steps', max: maxSteps, value: (d) => activityTotals(d).steps || 0, unit: 'adım' },
      { key: 'activeCalories', label: 'Aktif kalori', dot: 'lg-active', fill: 'active', max: maxActiveCalories, value: (d) => activityTotals(d).activeCalories || 0, unit: 'kcal' },
      { key: 'durationMin', label: 'Egzersiz', dot: 'lg-duration', fill: 'duration', max: maxActivityMin, value: (d) => activityTotals(d).durationMin || 0, unit: 'dk' }
    ],
    recovery: [
      { key: 'water', label: 'Su', dot: 'lg-water', fill: 'water', max: Math.max(maxWater, goals?.water || 1), value: (d) => d.water, unit: 'ml' },
      { key: 'sleep', label: 'Uyku', dot: 'lg-sleep', fill: 'sleep', max: maxSleep, value: (d) => d.sleepHours || 0, unit: 'saat' }
    ]
  };

  const activeSeries = chartSeries[chartTab] || chartSeries.nutrition;
  const chartValueLabel = (d) => {
    if (chartTab === 'nutrition') return d.calories ? `${Math.round(d.calories)} kcal` : '–';
    if (chartTab === 'activity') {
      const activity = activityTotals(d);
      return activity.steps ? `${Math.round(activity.steps)}` : activity.durationMin ? `${Math.round(activity.durationMin)} dk` : '–';
    }
    return d.water ? `${Math.round(d.water)} ml` : d.sleepHours ? `${d.sleepHours}s` : '–';
  };

  const toggleDaySection = (sectionKey) => {
    setOpenDaySections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const isEditingDaySection = (sectionKey) => {
    if (!editingSection) return false;
    if (sectionKey === 'goals') return editingSection === 'goals';
    if (sectionKey === 'water') return editingSection === 'water';
    if (sectionKey === 'sleep') return editingSection === 'sleep';
    if (sectionKey === 'activity') return editingSection === 'vitals';
    if (sectionKey === 'supplements') return editingSection.startsWith('supplement-');
    if (sectionKey.startsWith('meal-')) {
      const catKey = sectionKey.replace('meal-', '');
      if (editingSection === `meal-new-${catKey}`) return true;
      if (!editingSection.startsWith('meal-')) return false;
      const editingMealId = editingSection.replace('meal-', '');
      const meal = dailyTotals[0]?.meals?.find((m) => m.id === editingMealId);
      return meal ? classifyMeal(meal) === catKey : false;
    }
    return false;
  };

  const renderDaySection = (sectionKey, title, summary, children, className = '') => {
    const sectionClass = `trend-day-section ${className}`.trim();
    if (!embedded) {
      return (
        <div className={sectionClass} key={sectionKey}>
          <h5>{title}</h5>
          {children}
        </div>
      );
    }

    const isOpen = Boolean(openDaySections[sectionKey] || isEditingDaySection(sectionKey));
    return (
      <div
        className={`${sectionClass} trend-day-accordion ${isOpen ? 'open' : ''}`}
        key={sectionKey}
      >
        <button
          type="button"
          className="trend-day-accordion-head"
          onClick={() => toggleDaySection(sectionKey)}
          aria-expanded={isOpen}
        >
          <span>{title}</span>
          <small>{summary || 'boş'}</small>
          <strong>{isOpen ? 'Kapat' : 'Aç'}</strong>
        </button>
        {isOpen && (
          <div className="trend-day-accordion-body">
            {children}
          </div>
        )}
      </div>
    );
  };

  const formatMacroSummary = (d) => {
    if (!d) return 'boş';
    const parts = [];
    if (d.calories) parts.push(`${Math.round(d.calories)} kcal`);
    if (d.protein) parts.push(`P${Math.round(d.protein)}`);
    if (d.carbs) parts.push(`K${Math.round(d.carbs)}`);
    if (d.fats) parts.push(`Y${Math.round(d.fats)}`);
    return parts.join(' · ') || 'boş';
  };

  const renderExportActions = (placement = '') => (
    <div className={`trend-actions ${placement ? `trend-actions-${placement}` : ''}`.trim()}>
      <button onClick={handleCopyExport}>📋 Dışa Aktar (Kopyala)</button>
      <button onClick={handleExcelExport}>📊 Excel Export</button>
      <button onClick={handleChatGptFullExport}>🧠 ChatGPT Analiz Dosyası</button>
      <button onClick={handleGeminiComment} disabled={isCommenting}>
        {isCommenting ? '🤖 Yorumlanıyor...' : '🤖 Gemini ile Yorumla'}
      </button>
    </div>
  );

  if (!user) {
    return <div className="trend-view"><p>Trendleri görmek için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className={`trend-view ${embedded ? 'trend-view-embedded' : ''}`}>
      {!embedded && (
      <div className="trend-header">
        <h3>📈 Trend & Özet</h3>
        <div className="trend-range-buttons">
          {Object.keys(RANGE_LABELS).map((key) => (
            <button
              key={key}
              className={effectiveRangeKey === key ? 'active' : ''}
              onClick={() => setRangeKey(key)}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
      )}

      {effectiveRangeKey === 'custom' && (
        <div className="trend-custom-range">
          <label>
            Başlangıç
            <input
              type="date"
              value={customRange.start}
              max={customRange.end || todayKey()}
              onChange={(e) => e.target.value && setCustomRange({ ...customRange, start: e.target.value })}
            />
          </label>
          <label>
            Bitiş
            <input
              type="date"
              value={customRange.end}
              min={customRange.start}
              max={todayKey()}
              onChange={(e) => e.target.value && setCustomRange({ ...customRange, end: e.target.value })}
            />
          </label>
          <div className="trend-custom-presets">
            {[7, 14, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setCustomRange({ start: shiftKey(todayKey(), -(days - 1)), end: todayKey() })}
              >
                Son {days} gün
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="trend-date-nav">
        <button onClick={() => shiftAnchor(-1)}>◀</button>
        <span>
          {formatShort(dates[0])} - {formatShort(dates[dates.length - 1])}
          <small>{dates.length} gün</small>
        </span>
        <button
          onClick={() => shiftAnchor(1)}
          disabled={effectiveRangeKey === 'custom' ? customRange.end === todayKey() : anchorDate === todayKey()}
        >▶</button>
      </div>

      {customTooLong && (
        <div className="trend-range-warning">
          Seçilen aralık {MAX_CUSTOM_DAYS} günden uzun; ilk {MAX_CUSTOM_DAYS} gün gösteriliyor.
        </div>
      )}

      {!embedded && <GeminiQuotaBadge retryStatus={retryStatus} />}

      {!embedded && renderExportActions('top')}

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          {!embedded && effectiveRangeKey !== 'day' && <section className="trend-status-panel">
            <div className="trend-status-main">
              <span className="trend-status-eyebrow">Genel Durum</span>
              <strong>{progressSignal}</strong>
              <p>{dates.length} günün {meaningfulDays.length} gününde kayıt var · veri doluluğu %{dataCoverage}</p>
              {trendEvidenceItems.length > 0 && (
                <div className="trend-evidence-list">
                  {trendEvidenceItems.map((item) => <span key={item}>{item}</span>)}
                </div>
              )}
              <div className="trend-action-list">
                {actionItems.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
            <div className="trend-status-score">
              <span>Uyum Skoru</span>
              <strong>{complianceScore == null ? '-' : `%${complianceScore}`}</strong>
              <small>Kalori, protein, su ve aktiviteye göre</small>
            </div>
            <div className="trend-status-breakdown">
              <span>Kalori: <strong>{goals ? `${calorieGoalDays}/${Math.max(calorieDays.length, 1)}` : '-'}</strong></span>
              <span>Protein: <strong>{goals ? `${proteinGoalDays}/${Math.max(macroDays.length, 1)}` : '-'}</strong></span>
              <span>Su: <strong>{goals ? `${waterGoalDays}/${dates.length}` : '-'}</strong></span>
              <span>Aktivite: <strong>{activityGoalDays}/{dates.length}</strong></span>
              <span>Makro Ort.: <strong>P{avgProtein || 0} K{avgCarbs || 0} Y{avgFats || 0}</strong></span>
              <span>Uyku Ort.: <strong>{avgSleep || '-'}</strong></span>
              <span>Bel: <strong>{waistChange == null ? '-' : `${waistChange > 0 ? '+' : ''}${waistChange.toFixed(1)} cm`}</strong></span>
            </div>
          </section>}

          {!embedded && effectiveRangeKey !== 'day' && (insightItems.length > 0 || bestWorstItems.length > 0) && (
            <section className="trend-intelligence-grid">
              {insightItems.length > 0 && (
                <div className="trend-intelligence-card">
                  <h4>Vücut Sinyali</h4>
                  <p className="trend-card-explainer">Gerçek ölçümlerin özeti: kilo trendi, 7 kayıt ortalaması, hedefe kalan kilo ve varsa bel değişimi. Bu kart “vücuttan gelen veri ne söylüyor?” sorusunu cevaplar.</p>
                  <div className="trend-mini-metrics">
                    {insightItems.map((item) => (
                      <span key={item.label} className={item.tone}>
                        <small>{item.label}</small>
                        <strong>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(targetDate || etaDate || planDelta != null || scaleNoiseNote) && (
                <div className="trend-intelligence-card">
                  <h4>Hedef Rotası</h4>
                  <p className="trend-route-help">Bu kart iki şeyi ayırır: hedef tarih çizgisine göre bugün nerede olman gerektiği ve son kilo trendi korunursa tahmini varışın ne olduğu.</p>
                  <div className={`trend-route-summary ${routeSummary.tone}`}>
                    <small>Şu anki yorum</small>
                    <strong>{routeSummary.title}</strong>
                    <p>{routeSummary.text}</p>
                    <span>{routeSummary.next}</span>
                  </div>
                  <div className="trend-route-card">
                    <label className="trend-route-date">
                      <small>Hedef tarih</small>
                      <input
                        type="date"
                        value={targetDate || ''}
                        min={todayKey()}
                        max="2035-12-31"
                        onChange={(e) => handleTargetDateChange(e.target.value)}
                        disabled={isSavingTargetDate}
                      />
                    </label>
                    <span>
                      <small>Tahmini varış</small>
                      <strong>{etaDate ? formatLongDate(etaDate) : movingTowardTarget ? 'Daha fazla kayıt lazım' : 'Trend ters/kararsız'}</strong>
                    </span>
                    <span>
                      <small>Bugün beklenen</small>
                      <strong>{plannedWeightToday != null ? `${plannedWeightToday.toFixed(1)} kg` : targetDate ? 'Kilo hedefi gerekli' : 'Hedef tarihi gerekli'}</strong>
                    </span>
                    <span>
                      <small>Gerçek fark</small>
                      <strong>{planDelta == null ? 'Hedef tarihi gerekli' : `${planDelta > 0 ? '+' : ''}${planDelta.toFixed(1)} kg`}</strong>
                    </span>
                  </div>
                  {routeDetails.length > 0 && (
                    <div className="trend-route-details">
                      {routeDetails.map((item) => <p key={item}>{item}</p>)}
                    </div>
                  )}
                  {targetDateIssue && <p className="trend-route-warning">{targetDateIssue}</p>}
                  {scaleNoiseNote && <p className="trend-scale-note">{scaleNoiseNote}</p>}
                </div>
              )}
              {bestWorstItems.length > 0 && (
                <div className="trend-intelligence-card">
                  <h4>Aralık İçinden</h4>
                  <div className="trend-best-worst">
                    {bestWorstItems.map((item) => (
                      <span key={item.label}>
                        <small>{item.label}</small>
                        <strong>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {!embedded && effectiveRangeKey !== 'day' && (
            <section className="trend-calendar-card">
              <div className="trend-calendar-head">
                <div>
                  <h4>İlerleme Takvimi</h4>
                  <p>Renkler o gün kayıtlı olan kriterlere göre hesaplanır: kalori hedef aralığı, protein min. %80, su hedefi ve aktivite girişi.</p>
                </div>
                <span><i className="good" /> iyi <i className="ok" /> orta <i className="low" /> zayıf <i className="empty" /> boş</span>
              </div>
              <div className="trend-quality-calendar">
                {progressCalendarDays.map((day) => (
                  <span key={day.date} className={day.quality} title={`${formatShort(day.date)} · ${day.scoreText} · ${day.detail}`}>
                    <strong>{parseDateKey(day.date).getDate()}</strong>
                    <small>{day.scoreText}</small>
                  </span>
                ))}
              </div>
            </section>
          )}

          {!embedded && effectiveRangeKey !== 'day' && <div className="trend-summary-cards">
            <div className="trend-card">
              <span className="trend-card-icon">🔥</span>
              <span className="trend-card-value">{avgCalories}</span>
              <span className="trend-card-label">Ort. Kalori</span>
            </div>
            {avgRealDeficit != null && (
              <div className="trend-card" title="(BMR + aktif kalori) - alınan kalori">
                <span className="trend-card-icon">{avgRealDeficit >= 0 ? '📉' : '📈'}</span>
                <span className="trend-card-value" style={{ color: avgRealDeficit >= 0 ? '#16a34a' : '#dc2626' }}>{Math.abs(avgRealDeficit)}</span>
                <span className="trend-card-label">Ort. Kalori {avgRealDeficit >= 0 ? 'Açığı' : 'Fazlası'}</span>
              </div>
            )}
            {avgTargetCalorieBalance != null && (
              <div className="trend-card" title="Günlük kalori hedefi - alınan kalori">
                <span className="trend-card-icon">🎯</span>
                <span className="trend-card-value" style={{ color: avgTargetCalorieBalance >= 0 ? '#16a34a' : '#dc2626' }}>{Math.abs(avgTargetCalorieBalance)}</span>
                <span className="trend-card-label">Ort. Hedefe {avgTargetCalorieBalance >= 0 ? 'Kalan' : 'Üstü'} kcal</span>
              </div>
            )}
            {avgRealDeficit == null && calorieDays.length > 0 && (
              <div className="trend-card" title={bmrIssue || 'Kalori açığı için geçerli profil bilgisi gerekir'}>
                <span className="trend-card-icon">⚠️</span>
                <span className="trend-card-value">BMR</span>
                <span className="trend-card-label">Profil Değeri Geçersiz</span>
              </div>
            )}
            <div className="trend-card">
              <span className="trend-card-icon">💧</span>
              <span className="trend-card-value">{avgWater}</span>
              <span className="trend-card-label">Ort. Su (ml)</span>
            </div>
            <div className="trend-card" title={goals ? `Hedef: ${goals.protein}g` : undefined}>
              <span className="trend-card-icon">🥩</span>
              <span className="trend-card-value">{avgProtein || '-'}</span>
              <span className="trend-card-label">Ort. Protein (g)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">👟</span>
              <span className="trend-card-value">{avgSteps || avgWorkoutMin || '-'}</span>
              <span className="trend-card-label">{avgSteps ? 'Ort. Adım' : 'Ort. Aktivite (dk)'}</span>
            </div>
          </div>}

          {!embedded && effectiveRangeKey !== 'day' && (
            <div className="trend-chart">
              <div className="trend-chart-tabs">
                {chartTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={chartTab === tab.key ? 'active' : ''}
                    onClick={() => setChartTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="trend-legend">
                {activeSeries.map((series) => (
                  <span key={series.key} className="trend-legend-item"><i className={`lg-dot ${series.dot}`} />{series.label}</span>
                ))}
              </div>
              <div className="trend-bars">
                {dailyTotals.map((d) => (
                  <div key={d.date} className="trend-bar-day">
                    <div className="trend-bar-group">
                      {activeSeries.map((series) => {
                        const value = series.value(d);
                        return (
                          <div key={series.key} className="trend-bar-track" title={`${series.label}: ${Math.round(value)} ${series.unit}`}>
                            <div className={`trend-bar-fill ${series.fill}`} style={{ height: `${Math.min((value / series.max) * 100, 100)}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <span className="trend-bar-value">
                      {chartValueLabel(d)}
                      {chartTab === 'nutrition' && (d.protein || d.carbs || d.fats) ? <small>P{Math.round(d.protein)} K{Math.round(d.carbs)} Y{Math.round(d.fats)}</small> : null}
                    </span>
                    <span className="trend-bar-label">{formatShort(d.date)}</span>
                  </div>
                ))}
              </div>
              <p className="trend-chart-hint">Çubukların üstüne gelince tam değer görünür · sekmeler grafiği sade tutar</p>
            </div>
          )}

          {effectiveRangeKey === 'day' && (
            <div className="trend-day-detail">
              {/* Tarih */}
              <div className="trend-day-section trend-day-date">
                <div className="trend-day-date-row">
                  <h5>📅 {new Date(anchorDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(anchorDate).toLocaleDateString('tr-TR', { weekday: 'long' })}</h5>
                  <button className="trend-clean-btn" onClick={handleCleanDuplicates} title="Bu günün tekrar eden kayıtlarını temizle">🧹 Temizle</button>
                </div>
              </div>

              {/* Hedefler - SABİT, elle belirlenir ve düzenlenebilir */}
              {renderDaySection('goals', '🎯 Hedefler', goals ? `${goals.calories} kcal · P${goals.protein}` : 'hedef yok', (
                <>
                {editingSection !== 'goals' && (
                  <button className="trend-goals-edit trend-goals-edit-inline" onClick={startEditGoals} title="Hedefleri düzenle">✏️ Hedefleri düzenle</button>
                )}
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
                </>
              ), 'trend-day-goals')}

              {/* Öğün kategorileri - her birinde ekle/düzenle/sil */}
              {MEAL_CATEGORIES.map((cat) => {
                const catMeals = dailyTotals[0].meals.filter((m) => classifyMeal(m) === cat.key);
                const mealCalories = catMeals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
                const mealSummary = catMeals.length ? `${catMeals.length} kayıt · ${Math.round(mealCalories)} kcal` : 'boş';
                return renderDaySection(`meal-${cat.key}`, cat.title, mealSummary, (
                  <>
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
                  </>
                ));
              })}

              {/* Su - toplam düzenlenebilir, hedef ve tamamlanma otomatik */}
              {renderDaySection('water', '💧 Su', dailyTotals[0].water > 0 ? `${dailyTotals[0].water} ml · hedef ${waterGoal}` : 'boş', (
                <>
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
                </>
              ))}

              {/* Uyku */}
              {renderDaySection('sleep', '😴 Uyku', dailyTotals[0].sleepHours ? `${dailyTotals[0].sleepHours} saat${dailyTotals[0].sleepScore ? ` · skor ${dailyTotals[0].sleepScore}` : ''}` : 'boş', (
                <>
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
                </>
              ))}

              {/* Aktivite - Apple Watch varsa o esas alınır; eski workout alanları sadece yedek veridir. */}
              {renderDaySection('activity', '⌚ Aktivite', activitySummary(activityTotals(dailyTotals[0])) || 'boş', (
                <>
                {editingSection === 'vitals' ? (
                  <div className="trend-edit-form">
                    <div className="trend-edit-grid">
                      <input type="number" placeholder="Aktif kalori" value={editForm.active_calories} onChange={(e) => setEditForm({ ...editForm, active_calories: e.target.value })} />
                      <input type="number" placeholder="Egzersiz (dk)" value={editForm.exercise_minutes} onChange={(e) => setEditForm({ ...editForm, exercise_minutes: e.target.value })} />
                      <input type="number" step="0.01" placeholder="Mesafe (km)" value={editForm.distance_km} onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })} />
                      <input type="number" placeholder="Adım" value={editForm.steps} onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })} />
                    </div>
                    <div className="trend-edit-actions">
                      <button onClick={saveVitalsEdit} disabled={isSavingEdit}>Kaydet</button>
                      <button onClick={closeEdit}>İptal</button>
                    </div>
                  </div>
                ) : (() => {
                  const activity = activityTotals(dailyTotals[0]);
                  const summary = activitySummary(activity);
                  return summary ? (
                    <div className="trend-day-item">
                      <span>{summary}</span>
                      <div className="trend-day-item-actions">
                        <button onClick={startEditVitals} title="Düzenle">✏️</button>
                        {dailyTotals[0].vitals && (
                          <button onClick={handleDeleteVitalsEntry} title="Sil">🗑️</button>
                        )}
                      </div>
                    </div>
                  ) : null;
                })() || (
                  <button className="trend-add-btn" onClick={startEditVitals}>➕ Aktivite Verisi Ekle</button>
                )}
                </>
              ))}

              {/* Takviyeler */}
              {renderDaySection('supplements', '💊 Takviyeler', dailyTotals[0].supplements.length ? `${dailyTotals[0].supplements.length} kayıt` : 'boş', (
                <>
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
                </>
              ))}

              {/* Günlük Toplam - öğünlerden otomatik hesaplanır */}
              {renderDaySection('totals', '📊 Günlük Toplam (otomatik)', formatMacroSummary(dailyTotals[0]), (
                <>
                <div className="trend-goals-grid">
                  <span>Kalori: <strong>{Math.round(dailyTotals[0].calories)} kcal</strong>{goals ? ` / ${goals.calories}` : ''}</span>
                  {todayTargetCalorieBalance != null && (
                    <span>Hedefe göre: <strong>{Math.abs(todayTargetCalorieBalance)} kcal {todayTargetCalorieBalance >= 0 ? 'kalan' : 'üstü'}</strong></span>
                  )}
                  <span>Protein: <strong>{Math.round(dailyTotals[0].protein)}g</strong>{goals ? ` / ${goals.protein}g` : ''}</span>
                  <span>Karbonhidrat: <strong>{Math.round(dailyTotals[0].carbs)}g</strong>{goals ? ` / ${goals.carbs}g` : ''}</span>
                  <span>Yağ: <strong>{Math.round(dailyTotals[0].fats)}g</strong>{goals ? ` / ${goals.fats}g` : ''}</span>
                </div>
                {bmr != null && dailyTotals[0].calories > 0 && (() => {
                  const activity = activityTotals(dailyTotals[0]);
                  const balance = energyBalance({
                    bmr,
                    vitals: dailyTotals[0].vitals || {},
                    consumed: dailyTotals[0].calories,
                    date: dailyTotals[0].date,
                    mode: 'full-day',
                    workoutActiveCalories: activity.activeCalories || 0
                  });
                  const def = balance.deficit;
                  return (
                    <div className={`trend-day-deficit ${def >= 0 ? 'good' : 'over'}`}>
                      {def >= 0 ? '📉' : '📈'} Bu gün <strong>{Math.abs(def)} kcal {def >= 0 ? 'açık' : 'fazla'}</strong>
                      <span> (harcama {balance.totalExpenditure} = dinlenme {balance.restingEnergy}{balance.activeEnergy ? ` + aktif ${Math.round(balance.activeEnergy)}` : ''} · alınan {Math.round(dailyTotals[0].calories)})</span>
                    </div>
                  );
                })()}
                {bmr == null && dailyTotals[0].calories > 0 && (
                  <div className="trend-day-deficit over">
                    ⚠️ Kalori açığı hesaplanamadı: <strong>{bmrIssue || 'profil değerleri geçersiz.'}</strong>
                  </div>
                )}
                </>
              ), 'trend-day-totals')}

              {renderDaySection('note', '📝 Not', noteDraft?.trim() ? 'not var' : 'boş', (
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
              ))}
            </div>
          )}

          {renderExportActions('bottom')}

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
