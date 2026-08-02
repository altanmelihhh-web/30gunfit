import React, { useState } from 'react';
import './DailyLogForm.css';
import { getWaterTracker, saveWaterTracker, getDailyLog, saveDailyLog } from '../firebase/dataService';
import { addMeals, getMealsSummary } from '../firebase/mealsService';

/**
 * DailyLogForm - günün tamamını (uyku, öğünler, antrenman, takviye, su) tek seferde,
 * gerçek etiketli alanlarla girmek için form. AI'ya hiç gitmez, kısaltma (p/c/f) gerekmez.
 * ChatGPT'den alınan bir günlük raporu bu alanlara elle aktarmak için tasarlandı.
 */

const emptyMealSection = { content: '', calories: '', protein: '', carbs: '', fats: '' };

const MEAL_SECTIONS = [
  { key: 'kahvalti', title: '🌅 Kahvaltı', mealType: 'breakfast', mealLabel: null },
  { key: 'sporSonrasi', title: '🥤 Spor Sonrası', mealType: 'snack', mealLabel: 'Spor Sonrası' },
  { key: 'araOgun', title: '🍎 Ara Öğün', mealType: 'snack', mealLabel: 'Ara Öğün' },
  { key: 'aksamYemegi', title: '🌙 Akşam Yemeği', mealType: 'dinner', mealLabel: null },
  { key: 'geceAtistirmasi', title: '🌃 Gece Atıştırması', mealType: 'snack', mealLabel: 'Gece Atıştırması' }
];

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  sleep: { duration_hours: '', score: '', bedtime: '' },
  kahvalti: { ...emptyMealSection },
  sporSonrasi: { ...emptyMealSection },
  araOgun: { ...emptyMealSection },
  aksamYemegi: { ...emptyMealSection },
  geceAtistirmasi: { ...emptyMealSection },
  spor: { name: '', duration_min: '', active_calories: '', steps: '', distance_km: '' },
  su: { total_ml: '' }
});

const DailyLogForm = ({ user, nutritionResults, onSaved }) => {
  const [form, setForm] = useState(emptyForm());
  const [supplements, setSupplements] = useState([]);
  const [newSupplement, setNewSupplement] = useState({ name: '', dose: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [error, setError] = useState(null);

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

  const addSupplementRow = () => {
    if (!newSupplement.name.trim()) return;
    setSupplements([...supplements, { name: newSupplement.name.trim(), dose: newSupplement.dose.trim() || null }]);
    setNewSupplement({ name: '', dose: '' });
  };

  const removeSupplementRow = (index) => {
    setSupplements(supplements.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);

    const mealsToAdd = MEAL_SECTIONS
      .filter((s) => form[s.key].content.trim() && form[s.key].calories)
      .map((s) => ({
        name: form[s.key].content.trim(),
        meal_type: s.mealType,
        meal_label: s.mealLabel,
        calories: form[s.key].calories,
        protein: form[s.key].protein,
        carbs: form[s.key].carbs,
        fats: form[s.key].fats,
        source: 'Günlük Form'
      }));

    if (mealsToAdd.length > 0) {
      const summary = await getMealsSummary(user.uid, form.date);
      if (summary.count > 0) {
        const confirmed = window.confirm(
          `${form.date} için zaten ${summary.count} öğün kayıtlı (toplam ${summary.totalCalories} kcal). ` +
          `Bu ${mealsToAdd.length} yeni öğünü yine de eklemek istiyor musunuz?`
        );
        if (!confirmed) return;
      }
    }

    setIsSaving(true);
    try {
      if (mealsToAdd.length > 0) {
        await addMeals(user.uid, form.date, mealsToAdd);
      }

      if (form.su.total_ml) {
        const existing = await getWaterTracker(user.uid);
        const currentEntries = existing.success ? (existing.data.entries || []) : [];
        const currentGoal = existing.success ? (existing.data.dailyGoal || 2500) : 2500;
        await saveWaterTracker(user.uid, [...currentEntries, {
          id: Date.now(),
          amount: parseInt(form.su.total_ml, 10),
          date: form.date,
          timestamp: new Date().toISOString()
        }], currentGoal);
      }

      const needsLogUpdate = form.sleep.duration_hours || form.sleep.score || form.spor.name ||
        form.spor.duration_min || form.spor.active_calories || form.spor.steps || form.spor.distance_km ||
        supplements.length > 0;

      if (needsLogUpdate) {
        const existingLogResult = await getDailyLog(user.uid, form.date);
        const existingLog = existingLogResult.success ? existingLogResult.data : {};
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
          const newWorkout = {
            type: isCardio ? 'cardio' : 'strength',
            duration_min: null,
            calories: null,
            exercises: form.spor.name.trim() ? [{ name: form.spor.name.trim(), sets: [] }] : []
          };
          logFields.workouts = [...(existingLog.workouts || []), newWorkout];
        }

        if (form.spor.duration_min || form.spor.active_calories || form.spor.steps || form.spor.distance_km) {
          logFields.vitals = {
            active_calories: form.spor.active_calories ? parseFloat(form.spor.active_calories) : null,
            steps: form.spor.steps ? parseInt(form.spor.steps, 10) : null,
            exercise_minutes: form.spor.duration_min ? parseFloat(form.spor.duration_min) : null,
            distance_km: form.spor.distance_km ? parseFloat(form.spor.distance_km) : null
          };
        }

        if (supplements.length > 0) {
          logFields.supplements = [...(existingLog.supplements || []), ...supplements];
        }

        if (Object.keys(logFields).length > 0) {
          await saveDailyLog(user.uid, form.date, logFields);
        }
      }

      setSavedMessage(true);
      setForm(emptyForm());
      setSupplements([]);
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
        <p>Her alanın adı belli — ChatGPT'den aldığın raporu buraya kendi elinle aktarabilirsin. AI'ya hiç gitmez.</p>
      </div>

      <div className="dlf-field-row">
        <label>Tarih</label>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} max={new Date().toISOString().split('T')[0]} />
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
        <h4>😴 Uyku</h4>
        <div className="dlf-field-grid">
          <div className="dlf-field">
            <label>Süre (saat)</label>
            <input type="number" step="0.1" placeholder="7.5" value={form.sleep.duration_hours} onChange={(e) => setForm({ ...form, sleep: { ...form.sleep, duration_hours: e.target.value } })} />
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
          <h4>{s.title}</h4>
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
        </div>
      ))}

      {/* Aktivite */}
      <div className="dlf-section">
        <h4>⌚ Aktivite</h4>
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
        <h4>💊 Takviyeler</h4>
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
        <h4>💧 Su</h4>
        <div className="dlf-field">
          <label>Toplam (ml)</label>
          <input type="number" placeholder="4000" value={form.su.total_ml} onChange={(e) => setForm({ ...form, su: { total_ml: e.target.value } })} />
        </div>
      </div>

      {/* Günlük Toplam - otomatik hesaplanır */}
      <div className="dlf-section dlf-totals">
        <h4>📊 Günlük Toplam (otomatik)</h4>
        <div className="dlf-goals-grid">
          <span>Kalori: <strong>{Math.round(totals.calories)} kcal</strong></span>
          <span>Protein: <strong>{Math.round(totals.protein)}g</strong></span>
          <span>Karbonhidrat: <strong>{Math.round(totals.carbs)}g</strong></span>
          <span>Yağ: <strong>{Math.round(totals.fats)}g</strong></span>
        </div>
      </div>

      {error && <div className="dlf-error">⚠️ {error}</div>}
      {savedMessage && <div className="dlf-success">✅ Kaydedildi!</div>}

      <button className="dlf-submit-btn" onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? '💾 Kaydediliyor...' : '✅ Günü Kaydet'}
      </button>
    </div>
  );
};

export default DailyLogForm;
