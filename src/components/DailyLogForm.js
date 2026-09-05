import React, { useCallback, useEffect, useState } from 'react';
import './DailyLogForm.css';
import { getWaterTracker, saveWaterTracker, getDailyLog, saveDailyLog } from '../firebase/dataService';
import { addMeals, getMeals, updateMeal } from '../firebase/mealsService';
import { todayKey } from '../utils/cycleMath';
import { validateMealNutrition, validateSleepDuration, isBlocking } from '../utils/entryValidation';

/**
 * DailyLogForm - günün tamamını (uyku, öğünler, antrenman, takviye, su) tek seferde,
 * gerçek etiketli alanlarla girmek için form. AI'ya hiç gitmez, kısaltma (p/c/f) gerekmez.
 *
 * Seçili güne ait kayıtlar forma YÜKLENİR: dolu alan zaten kayıtlı demektir ve kaydedince
 * üzerine yazılır (yeni kayıt eklenmez). Eskiden form hep boş açıldığı için kullanıcı
 * girdiğini göremiyor, aynı öğünü ikinci kez ekliyordu.
 */

const emptyMealSection = { content: '', calories: '', protein: '', carbs: '', fats: '' };

const MEAL_SECTIONS = [
  { key: 'kahvalti', title: '🌅 Kahvaltı', mealType: 'breakfast', mealLabel: null },
  { key: 'ogle', title: '☀️ Öğle', mealType: 'lunch', mealLabel: null },
  { key: 'sporSonrasi', title: '🥤 Spor Sonrası', mealType: 'snack', mealLabel: 'Spor Sonrası' },
  { key: 'araOgun', title: '🍎 Ara Öğün', mealType: 'snack', mealLabel: 'Ara Öğün' },
  { key: 'aksamYemegi', title: '🌙 Akşam Yemeği', mealType: 'dinner', mealLabel: null },
  { key: 'geceAtistirmasi', title: '🌃 Gece Atıştırması', mealType: 'snack', mealLabel: 'Gece Atıştırması' }
];

const emptyForm = (date) => ({
  date,
  sleep: { duration_hours: '', score: '', bedtime: '' },
  kahvalti: { ...emptyMealSection },
  ogle: { ...emptyMealSection },
  sporSonrasi: { ...emptyMealSection },
  araOgun: { ...emptyMealSection },
  aksamYemegi: { ...emptyMealSection },
  geceAtistirmasi: { ...emptyMealSection },
  spor: { name: '', duration_min: '', active_calories: '', steps: '', distance_km: '' },
  su: { total_ml: '' }
});

// Sayısal alanları input'a basarken 0/null gösterip kafa karıştırmayalım.
const toInput = (value) => (value === 0 || value === null || value === undefined ? '' : String(value));

const matchesSection = (meal, section) => {
  const label = (meal.mealLabel || '').trim();
  if (section.mealLabel) return label === section.mealLabel;
  return meal.mealType === section.mealType && !label;
};

const DailyLogForm = ({ user, nutritionResults, onSaved, refreshKey = 0 }) => {
  const [form, setForm] = useState(() => emptyForm(todayKey()));
  const [mealIds, setMealIds] = useState({});
  const [otherMeals, setOtherMeals] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [hadSupplements, setHadSupplements] = useState(false);
  const [workoutIndex, setWorkoutIndex] = useState(null);
  const [existingWorkouts, setExistingWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newSupplement, setNewSupplement] = useState({ name: '', dose: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [error, setError] = useState(null);

  // Seçili günün mevcut kayıtlarını forma yükler.
  const loadDay = useCallback(async (date) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [logResult, waterResult, meals] = await Promise.all([
        getDailyLog(user.uid, date),
        getWaterTracker(user.uid),
        getMeals(user.uid, date)
      ]);

      const log = logResult.success ? logResult.data : {};
      const next = emptyForm(date);

      if (log.sleep) {
        next.sleep = {
          duration_hours: toInput(log.sleep.duration_hours),
          score: toInput(log.sleep.score),
          bedtime: log.sleep.bedtime || ''
        };
      }

      const vitals = log.vitals || {};
      const workouts = log.workouts || [];
      const firstWorkout = workouts[0];
      next.spor = {
        name: firstWorkout?.exercises?.[0]?.name || firstWorkout?.title || '',
        duration_min: toInput(vitals.exercise_minutes),
        active_calories: toInput(vitals.active_calories),
        steps: toInput(vitals.steps),
        distance_km: toInput(vitals.distance_km)
      };

      const waterTotal = waterResult.success
        ? (waterResult.data.entries || [])
          .filter((entry) => entry.date === date)
          .reduce((sum, entry) => sum + (entry.amount || 0), 0)
        : 0;
      next.su.total_ml = waterTotal ? String(waterTotal) : '';

      const ids = {};
      const usedIds = new Set();
      MEAL_SECTIONS.forEach((section) => {
        const match = meals.find((meal) => !usedIds.has(meal.id) && matchesSection(meal, section));
        if (!match) return;
        usedIds.add(match.id);
        ids[section.key] = match.id;
        next[section.key] = {
          content: match.name || '',
          calories: toInput(match.calories),
          protein: toInput(match.protein),
          carbs: toInput(match.carbs),
          fats: toInput(match.fats)
        };
      });

      setForm(next);
      setMealIds(ids);
      setOtherMeals(meals.filter((meal) => !usedIds.has(meal.id)));
      setSupplements(log.supplements || []);
      setHadSupplements((log.supplements || []).length > 0);
      setExistingWorkouts(workouts);
      setWorkoutIndex(firstWorkout ? 0 : null);
    } catch (err) {
      setError(err.message || 'Günün kayıtları yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadDay(form.date); }, [loadDay, form.date, refreshKey]);

  const changeDate = (date) => {
    if (!date) return;
    setForm((prev) => ({ ...prev, date }));
  };

  const updateMealField = (key, field, value) => {
    setForm({ ...form, [key]: { ...form[key], [field]: value } });
  };

  const totals = MEAL_SECTIONS.reduce(
    (acc, s) => ({
      calories: acc.calories + (parseFloat(form[s.key].calories) || 0),
      protein: acc.protein + (parseFloat(form[s.key].protein) || 0),
      carbs: acc.carbs + (parseFloat(form[s.key].carbs) || 0),
      fats: acc.fats + (parseFloat(form[s.key].fats) || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
  const otherMealCalories = otherMeals.reduce((sum, meal) => sum + (parseFloat(meal.calories) || 0), 0);
  const otherMealMacros = otherMeals.reduce(
    (acc, meal) => ({
      protein: acc.protein + (parseFloat(meal.protein) || 0),
      carbs: acc.carbs + (parseFloat(meal.carbs) || 0),
      fats: acc.fats + (parseFloat(meal.fats) || 0)
    }),
    { protein: 0, carbs: 0, fats: 0 }
  );
  const totalMealCount = Object.keys(mealIds).length + otherMeals.length;

  const savedSummary = [
    form.sleep.duration_hours || form.sleep.score ? 'uyku' : null,
    totalMealCount ? `${totalMealCount} öğün` : null,
    form.su.total_ml ? 'su' : null,
    form.spor.name || form.spor.steps || form.spor.active_calories ? 'aktivite' : null,
    supplements.length ? 'takviye' : null
  ].filter(Boolean);

  const addSupplementRow = () => {
    if (!newSupplement.name.trim()) return;
    setSupplements([...supplements, { name: newSupplement.name.trim(), dose: newSupplement.dose.trim() || null }]);
    setNewSupplement({ name: '', dose: '' });
  };

  const removeSupplementRow = (index) => {
    setSupplements(supplements.filter((_, i) => i !== index));
  };

  // Bölüm bazlı mantık denetimi - imkânsız değerler kaydedilmeden yakalanır.
  const sleepCheck = form.sleep.duration_hours === '' ? null : validateSleepDuration(form.sleep.duration_hours);
  const mealChecks = MEAL_SECTIONS.reduce((acc, section) => {
    const entry = form[section.key];
    if (!entry.content.trim() && entry.calories === '') return acc;
    acc[section.key] = validateMealNutrition({ ...entry, name: entry.content.trim() });
    return acc;
  }, {});
  const formBlockers = [
    ...Object.values(mealChecks).filter(isBlocking),
    ...(sleepCheck && isBlocking(sleepCheck) ? [sleepCheck] : [])
  ];

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);

    if (formBlockers.length > 0) {
      setError(formBlockers.map((b) => b.message).join(' '));
      return;
    }

    const filledSections = MEAL_SECTIONS.filter((s) => form[s.key].content.trim() && form[s.key].calories);
    const mealsToUpdate = filledSections.filter((s) => mealIds[s.key]);
    const mealsToAdd = filledSections.filter((s) => !mealIds[s.key]);

    // Aynı isimde bir öğün o gün zaten varsa (başka bölümde/kayıtta) mükerrer uyarısı ver.
    const existingNames = new Set(otherMeals.map((meal) => (meal.name || '').trim().toLocaleLowerCase('tr')));
    const duplicate = mealsToAdd.find((s) => existingNames.has(form[s.key].content.trim().toLocaleLowerCase('tr')));
    if (duplicate) {
      const confirmed = window.confirm(
        `"${form[duplicate.key].content.trim()}" bu güne zaten kayıtlı görünüyor. Yine de yeni kayıt olarak eklensin mi?`
      );
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      const mealFields = (s) => ({
        name: form[s.key].content.trim(),
        meal_type: s.mealType,
        meal_label: s.mealLabel,
        calories: form[s.key].calories,
        protein: form[s.key].protein,
        carbs: form[s.key].carbs,
        fats: form[s.key].fats,
        source: 'Günlük Form'
      });

      for (const section of mealsToUpdate) {
        await updateMeal(user.uid, form.date, mealIds[section.key], mealFields(section));
      }
      if (mealsToAdd.length > 0) {
        await addMeals(user.uid, form.date, mealsToAdd.map(mealFields));
      }

      if (form.su.total_ml) {
        const existing = await getWaterTracker(user.uid);
        const currentEntries = existing.success ? (existing.data.entries || []) : [];
        const currentGoal = existing.success ? (existing.data.dailyGoal || 2500) : 2500;
        const otherEntries = currentEntries.filter((entry) => entry.date !== form.date);
        await saveWaterTracker(user.uid, [...otherEntries, {
          id: Date.now(),
          amount: parseInt(form.su.total_ml, 10),
          date: form.date,
          timestamp: new Date().toISOString()
        }], currentGoal);
      }

      const logFields = {};

      if (form.sleep.duration_hours || form.sleep.score) {
        logFields.sleep = {
          duration_hours: parseFloat(form.sleep.duration_hours) || 0,
          score: form.sleep.score ? parseInt(form.sleep.score, 10) : null,
          bedtime: form.sleep.bedtime || null
        };
      }

      if (form.spor.name) {
        const isCardio = /kardiyo|yürüyüş|yuruyus|koşu|kosu/i.test(form.spor.name);
        const workout = {
          ...(workoutIndex !== null ? existingWorkouts[workoutIndex] : {}),
          type: isCardio ? 'cardio' : 'strength',
          exercises: [{ name: form.spor.name.trim(), sets: [] }]
        };
        // Kayıtlı antrenman varsa üzerine yaz, yoksa yeni ekle (eskiden her kayıtta yenisi ekleniyordu).
        logFields.workouts = workoutIndex !== null
          ? existingWorkouts.map((item, index) => (index === workoutIndex ? workout : item))
          : [...existingWorkouts, workout];
      }

      const vitalsChanged = form.spor.duration_min || form.spor.active_calories || form.spor.steps || form.spor.distance_km;
      if (vitalsChanged) {
        logFields.vitals = {
          active_calories: form.spor.active_calories ? parseFloat(form.spor.active_calories) : null,
          steps: form.spor.steps ? parseInt(form.spor.steps, 10) : null,
          exercise_minutes: form.spor.duration_min ? parseFloat(form.spor.duration_min) : null,
          distance_km: form.spor.distance_km ? parseFloat(form.spor.distance_km) : null
        };
      }

      if (supplements.length > 0 || hadSupplements) {
        logFields.supplements = supplements;
      }

      if (Object.keys(logFields).length > 0) {
        await saveDailyLog(user.uid, form.date, logFields);
      }

      await loadDay(form.date);
      setSavedMessage(true);
      if (onSaved) onSaved();
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (err) {
      setError(err.message || 'Kaydetme sırasında hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return <div className="daily-log-form"><p>Günlük form için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className="daily-log-form">
      <div className="daily-log-form-header">
        <h3>📋 Günlük Form</h3>
        <p>Seçili güne ait kayıtlar aşağıda dolu gelir. Dolu bir alanı değiştirip kaydedersen mevcut kayıt güncellenir, yenisi eklenmez.</p>
      </div>

      <div className="dlf-field-row">
        <label>Tarih</label>
        <input type="date" value={form.date} onChange={(e) => changeDate(e.target.value)} max={todayKey()} />
      </div>

      <div className={`dlf-day-state ${savedSummary.length ? 'has-data' : ''}`}>
        {isLoading
          ? '⏳ Bu günün kayıtları yükleniyor...'
          : savedSummary.length
            ? `✅ Bu güne kayıtlı: ${savedSummary.join(' · ')}`
            : 'ℹ️ Bu güne ait kayıt yok — form boş.'}
      </div>

      {/* Hedefler - salt okunur */}
      <div className="dlf-section dlf-goals">
        <h4>🎯 Hedefler</h4>
        {nutritionResults ? (
          <div className="dlf-goals-grid">
            <span>Kalori: <strong>{nutritionResults.targetCalories} kcal</strong></span>
            <span>Protein: <strong>{nutritionResults.macros?.protein?.grams}g</strong></span>
            <span>Karbonhidrat: <strong>{nutritionResults.macros?.carbs?.grams}g</strong></span>
            <span>Yağ: <strong>{nutritionResults.macros?.fats?.grams}g</strong></span>
          </div>
        ) : (
          <p className="dlf-hint">Henüz hedef belirlenmemiş — Hesaplayıcı'dan belirleyebilirsin (opsiyonel).</p>
        )}
      </div>

      {/* Uyku */}
      <div className="dlf-section">
        <h4>😴 Uyku {(form.sleep.duration_hours || form.sleep.score) && <span className="dlf-saved-chip">kayıtlı</span>}</h4>
        <div className="dlf-field-grid">
          <div className="dlf-field">
            <label>Süre (saat)</label>
            <input type="number" step="0.1" placeholder="7.5" value={form.sleep.duration_hours} onChange={(e) => setForm({ ...form, sleep: { ...form.sleep, duration_hours: e.target.value } })} />
            {sleepCheck && sleepCheck.level !== 'ok' && (
              <div className={`dlf-validation ${sleepCheck.level}`} role="alert">
                {sleepCheck.level === 'error' ? '⛔' : '⚠️'} {sleepCheck.message}
                {sleepCheck.suggestion && (
                  <button
                    type="button"
                    className="dlf-validation-fix"
                    onClick={() => setForm({ ...form, sleep: { ...form.sleep, duration_hours: String(sleepCheck.suggestion) } })}
                  >
                    {sleepCheck.suggestion} saat yap
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="dlf-field">
            <label>Skor</label>
            <input type="number" placeholder="90" value={form.sleep.score} onChange={(e) => setForm({ ...form, sleep: { ...form.sleep, score: e.target.value } })} />
          </div>
          <div className="dlf-field">
            <label>Yatış Saati</label>
            <input type="text" placeholder="22:30" value={form.sleep.bedtime} onChange={(e) => setForm({ ...form, sleep: { ...form.sleep, bedtime: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Öğün bölümleri */}
      {MEAL_SECTIONS.map((s) => (
        <div className="dlf-section" key={s.key}>
          <h4>{s.title} {mealIds[s.key] && <span className="dlf-saved-chip">kayıtlı</span>}</h4>
          <div className="dlf-field">
            <label>İçerik</label>
            <textarea
              rows={2}
              placeholder="Örn: 3 Tam Yumurta, 60g Yulaf, Whey Protein"
              value={form[s.key].content}
              onChange={(e) => updateMealField(s.key, 'content', e.target.value)}
            />
          </div>
          <div className="dlf-field-grid dlf-field-grid-4">
            <div className="dlf-field">
              <label>Kalori</label>
              <input type="number" placeholder="600" value={form[s.key].calories} onChange={(e) => updateMealField(s.key, 'calories', e.target.value)} />
            </div>
            <div className="dlf-field">
              <label>Protein (g)</label>
              <input type="number" value={form[s.key].protein} onChange={(e) => updateMealField(s.key, 'protein', e.target.value)} />
            </div>
            <div className="dlf-field">
              <label>Karbonhidrat (g)</label>
              <input type="number" value={form[s.key].carbs} onChange={(e) => updateMealField(s.key, 'carbs', e.target.value)} />
            </div>
            <div className="dlf-field">
              <label>Yağ (g)</label>
              <input type="number" value={form[s.key].fats} onChange={(e) => updateMealField(s.key, 'fats', e.target.value)} />
            </div>
          </div>
          {mealChecks[s.key] && mealChecks[s.key].level !== 'ok' && (
            <div className={`dlf-validation ${mealChecks[s.key].level}`} role="alert">
              {mealChecks[s.key].level === 'error' ? '⛔' : '⚠️'} {mealChecks[s.key].message}
            </div>
          )}
        </div>
      ))}

      {/* Bu formdaki bölümlere denk gelmeyen öğünler (öğle yemeği, AI/foto kayıtları vb.) */}
      {otherMeals.length > 0 && (
        <div className="dlf-section dlf-other-meals">
          <h4>🍽️ Bu güne kayıtlı diğer öğünler</h4>
          <p className="dlf-hint">Bunlar özel etiketli, fotoğraflı, şablon veya hızlı giriş kayıtları olabilir. Tekrar eklemene gerek yok; düzenlemek için soldaki "Girilmiş Öğünler" listesindeki kalem butonunu kullan.</p>
          <ul className="dlf-other-meal-list">
            {otherMeals.map((meal) => (
              <li key={meal.id}>
                <strong>{meal.mealLabel || meal.name}</strong>
                <span>
                  {Math.round(meal.calories || 0)} kcal
                  {meal.protein > 0 ? ` · P${Math.round(meal.protein)}g` : ''}
                  {meal.carbs > 0 ? ` · K${Math.round(meal.carbs)}g` : ''}
                  {meal.fats > 0 ? ` · Y${Math.round(meal.fats)}g` : ''}
                  {meal.source ? ` · ${meal.source}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <div className="dlf-goals-grid">
            <span>Bu öğünlerin toplamı: <strong>{Math.round(otherMealCalories)} kcal</strong></span>
            <span>Protein: <strong>{Math.round(otherMealMacros.protein)}g</strong></span>
            <span>Karbonhidrat: <strong>{Math.round(otherMealMacros.carbs)}g</strong></span>
            <span>Yağ: <strong>{Math.round(otherMealMacros.fats)}g</strong></span>
          </div>
        </div>
      )}

      {/* Aktivite */}
      <div className="dlf-section">
        <h4>⌚ Aktivite {(form.spor.name || form.spor.steps || form.spor.active_calories) && <span className="dlf-saved-chip">kayıtlı</span>}</h4>
        <div className="dlf-field">
          <label>Aktivite / Antrenman</label>
          <input type="text" placeholder="Full Body + Günlük Aktivite" value={form.spor.name} onChange={(e) => setForm({ ...form, spor: { ...form.spor, name: e.target.value } })} />
        </div>
        <div className="dlf-field-grid dlf-field-grid-4">
          <div className="dlf-field">
            <label>Süre (dk)</label>
            <input type="number" value={form.spor.duration_min} onChange={(e) => setForm({ ...form, spor: { ...form.spor, duration_min: e.target.value } })} />
          </div>
          <div className="dlf-field">
            <label>Aktif Kalori</label>
            <input type="number" value={form.spor.active_calories} onChange={(e) => setForm({ ...form, spor: { ...form.spor, active_calories: e.target.value } })} />
          </div>
          <div className="dlf-field">
            <label>Adım</label>
            <input type="number" value={form.spor.steps} onChange={(e) => setForm({ ...form, spor: { ...form.spor, steps: e.target.value } })} />
          </div>
          <div className="dlf-field">
            <label>Mesafe (km)</label>
            <input type="number" step="0.01" value={form.spor.distance_km} onChange={(e) => setForm({ ...form, spor: { ...form.spor, distance_km: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Takviyeler */}
      <div className="dlf-section">
        <h4>💊 Takviyeler {supplements.length > 0 && <span className="dlf-saved-chip">{supplements.length} kayıtlı</span>}</h4>
        {supplements.map((s, i) => (
          <div key={i} className="dlf-supplement-row">
            <span>{s.name}{s.dose ? ` (${s.dose})` : ''}</span>
            <button onClick={() => removeSupplementRow(i)} title="Kaldır">🗑️</button>
          </div>
        ))}
        <div className="dlf-field-grid">
          <div className="dlf-field">
            <label>Ad</label>
            <input type="text" placeholder="Kreatin" value={newSupplement.name} onChange={(e) => setNewSupplement({ ...newSupplement, name: e.target.value })} />
          </div>
          <div className="dlf-field">
            <label>Doz</label>
            <input type="text" placeholder="5g" value={newSupplement.dose} onChange={(e) => setNewSupplement({ ...newSupplement, dose: e.target.value })} />
          </div>
        </div>
        <button type="button" className="dlf-add-btn" onClick={addSupplementRow}>➕ Takviye Ekle</button>
      </div>

      {/* Su */}
      <div className="dlf-section">
        <h4>💧 Su {form.su.total_ml && <span className="dlf-saved-chip">kayıtlı</span>}</h4>
        <div className="dlf-field">
          <label>Toplam (ml)</label>
          <input type="number" placeholder="4000" value={form.su.total_ml} onChange={(e) => setForm({ ...form, su: { total_ml: e.target.value } })} />
        </div>
      </div>

      {/* Günlük Toplam - otomatik hesaplanır */}
      <div className="dlf-section dlf-totals">
        <h4>📊 Günlük Toplam (otomatik)</h4>
        <div className="dlf-goals-grid">
          <span>Kalori: <strong>{Math.round(totals.calories + otherMealCalories)} kcal</strong></span>
          <span>Protein: <strong>{Math.round(totals.protein + otherMealMacros.protein)}g</strong></span>
          <span>Karbonhidrat: <strong>{Math.round(totals.carbs + otherMealMacros.carbs)}g</strong></span>
          <span>Yağ: <strong>{Math.round(totals.fats + otherMealMacros.fats)}g</strong></span>
        </div>
        {otherMeals.length > 0 && <p className="dlf-hint">Toplama yukarıdaki diğer öğünlerin kalorisi ve makroları da dahildir.</p>}
      </div>

      {error && <div className="dlf-error">⚠️ {error}</div>}
      {savedMessage && <div className="dlf-success">✅ Kaydedildi!</div>}

      <button className="dlf-submit-btn" onClick={handleSubmit} disabled={isSaving || isLoading}>
        {isSaving ? '💾 Kaydediliyor...' : '✅ Günü Kaydet'}
      </button>
    </div>
  );
};

export default DailyLogForm;
