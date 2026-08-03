import React, { useEffect, useState, useCallback } from 'react';
import './TodayQuickEdit.css';
import { getDailyLog, saveDailyLog, getWaterTracker, saveWaterTracker } from '../firebase/dataService';

const todayKey = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  water_ml: '',
  sleep_hours: '',
  sleep_score: '',
  bedtime: '',
  active_calories: '',
  exercise_minutes: '',
  steps: '',
  distance_km: ''
});

const TodayQuickEdit = ({ user, onSaved }) => {
  const [form, setForm] = useState(emptyForm());
  const [supplements, setSupplements] = useState([]);
  const [newSupplement, setNewSupplement] = useState({ name: '', dose: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const date = todayKey();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [water, log] = await Promise.all([
        getWaterTracker(user.uid),
        getDailyLog(user.uid, date)
      ]);
      const waterTotal = water.success
        ? (water.data.entries || [])
          .filter((entry) => entry.date === date)
          .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
        : 0;
      const logData = log.success ? log.data : {};
      setForm({
        water_ml: waterTotal || '',
        sleep_hours: logData.sleep?.duration_hours || '',
        sleep_score: logData.sleep?.score || '',
        bedtime: logData.sleep?.bedtime || '',
        active_calories: logData.vitals?.active_calories || '',
        exercise_minutes: logData.vitals?.exercise_minutes || '',
        steps: logData.vitals?.steps || '',
        distance_km: logData.vitals?.distance_km || ''
      });
      setSupplements(logData.supplements || []);
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => { load(); }, [load]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const addSupplement = () => {
    const name = newSupplement.name.trim();
    if (!name) return;
    setSupplements((prev) => [...prev, { name, dose: newSupplement.dose.trim() || null }]);
    setNewSupplement({ name: '', dose: '' });
  };

  const removeSupplement = (index) => {
    setSupplements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const [water, log] = await Promise.all([
        getWaterTracker(user.uid),
        getDailyLog(user.uid, date)
      ]);

      const waterEntries = water.success ? (water.data.entries || []) : [];
      const waterGoal = water.success ? (water.data.dailyGoal || 2500) : 2500;
      const waterValue = parseInt(form.water_ml, 10);
      const otherWaterEntries = waterEntries.filter((entry) => entry.date !== date);
      const nextWaterEntries = Number.isFinite(waterValue) && waterValue > 0
        ? [...otherWaterEntries, { id: Date.now(), amount: waterValue, date, timestamp: new Date().toISOString() }]
        : otherWaterEntries;
      await saveWaterTracker(user.uid, nextWaterEntries, waterGoal);

      const existingLog = log.success ? log.data : {};
      const sleepHours = parseFloat(form.sleep_hours);
      const sleepScore = parseInt(form.sleep_score, 10);
      const activeCalories = parseFloat(form.active_calories);
      const exerciseMinutes = parseFloat(form.exercise_minutes);
      const steps = parseInt(form.steps, 10);
      const distanceKm = parseFloat(form.distance_km);

      await saveDailyLog(user.uid, date, {
        sleep: {
          ...(existingLog.sleep || {}),
          duration_hours: Number.isFinite(sleepHours) ? sleepHours : null,
          score: Number.isFinite(sleepScore) ? sleepScore : null,
          bedtime: form.bedtime || null
        },
        vitals: {
          ...(existingLog.vitals || {}),
          active_calories: Number.isFinite(activeCalories) ? activeCalories : null,
          exercise_minutes: Number.isFinite(exerciseMinutes) ? exerciseMinutes : null,
          steps: Number.isFinite(steps) ? steps : null,
          distance_km: Number.isFinite(distanceKm) ? distanceKm : null
        },
        supplements
      });

      setSaved(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="today-quick-edit">
      <div className="tqe-head">
        <div>
          <span className="tqe-eyebrow">Bugün Düzenle</span>
          <h3>Günlük Kayıt</h3>
        </div>
        <button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {saved && <div className="tqe-saved">Kaydedildi.</div>}

      <div className="tqe-grid">
        <div className="tqe-section">
          <h4>Su</h4>
          <label>
            <span>Toplam ml</span>
            <input type="number" value={form.water_ml} onChange={(e) => update('water_ml', e.target.value)} placeholder="4000" />
          </label>
        </div>

        <div className="tqe-section">
          <h4>Uyku</h4>
          <div className="tqe-fields">
            <label><span>Saat</span><input type="number" step="0.1" value={form.sleep_hours} onChange={(e) => update('sleep_hours', e.target.value)} placeholder="7.5" /></label>
            <label><span>Skor</span><input type="number" value={form.sleep_score} onChange={(e) => update('sleep_score', e.target.value)} placeholder="85" /></label>
            <label><span>Yatış</span><input type="text" value={form.bedtime} onChange={(e) => update('bedtime', e.target.value)} placeholder="23:30" /></label>
          </div>
        </div>

        <div className="tqe-section tqe-wide">
          <h4>Aktivite</h4>
          <div className="tqe-fields four">
            <label><span>Aktif kcal</span><input type="number" value={form.active_calories} onChange={(e) => update('active_calories', e.target.value)} placeholder="884" /></label>
            <label><span>Süre dk</span><input type="number" value={form.exercise_minutes} onChange={(e) => update('exercise_minutes', e.target.value)} placeholder="75" /></label>
            <label><span>Adım</span><input type="number" value={form.steps} onChange={(e) => update('steps', e.target.value)} placeholder="10000" /></label>
            <label><span>Mesafe km</span><input type="number" step="0.01" value={form.distance_km} onChange={(e) => update('distance_km', e.target.value)} placeholder="6.5" /></label>
          </div>
        </div>

        <div className="tqe-section tqe-wide">
          <h4>Takviyeler</h4>
          <div className="tqe-supp-input">
            <input value={newSupplement.name} onChange={(e) => setNewSupplement({ ...newSupplement, name: e.target.value })} placeholder="Kreatin" />
            <input value={newSupplement.dose} onChange={(e) => setNewSupplement({ ...newSupplement, dose: e.target.value })} placeholder="5g" />
            <button type="button" onClick={addSupplement}>Ekle</button>
          </div>
          {supplements.length > 0 && (
            <div className="tqe-supp-list">
              {supplements.map((supplement, index) => (
                <span key={`${supplement.name}-${index}`}>
                  {supplement.name}{supplement.dose ? ` · ${supplement.dose}` : ''}
                  <button type="button" onClick={() => removeSupplement(index)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodayQuickEdit;
