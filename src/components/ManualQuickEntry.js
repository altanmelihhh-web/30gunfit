import React, { useState } from 'react';
import './ManualQuickEntry.css';
import { parseManualEntryBatch, AVAILABLE_KEYWORDS } from '../utils/manualEntryParser';
import {
  getWaterTracker, saveWaterTracker,
  getWeightTracker, saveWeightTracker,
  getDailyLog, saveDailyLog
} from '../firebase/dataService';
import { addMeals, getMealsSummary } from '../firebase/mealsService';

const ManualQuickEntry = ({ user, onSaved }) => {
  const [inputText, setInputText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [parsedItems, setParsedItems] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleParse = () => {
    setError(null);
    setParsedItems([]);
    setParseErrors([]);
    if (!inputText.trim()) {
      setError('Bir şeyler yaz. Örn: su: 500');
      return;
    }
    const { items, errors } = parseManualEntryBatch(inputText);
    if (items.length === 0 && errors.length > 0) {
      setError(`Hiçbir satır ayrıştırılamadı. İlk hata (satır ${errors[0].line}): ${errors[0].error}`);
      return;
    }
    setParsedItems(items);
    setParseErrors(errors);
  };

  const removeItem = (index) => {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (!user || parsedItems.length === 0) return;

    const meals = parsedItems.filter((p) => p.category === 'meal').map((p) => p.data);

    // Mükerrer kayıt uyarısı - bu tarihte zaten öğün varsa kullanıcıya sor
    if (meals.length > 0) {
      const summary = await getMealsSummary(user.uid, selectedDate);
      if (summary.count > 0) {
        const confirmed = window.confirm(
          `${selectedDate} için zaten ${summary.count} öğün kayıtlı (toplam ${summary.totalCalories} kcal). ` +
          `Bu ${meals.length} yeni öğünü yine de eklemek istiyor musunuz?`
        );
        if (!confirmed) return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const waterEntries = parsedItems.filter((p) => p.category === 'water');
      const weightEntries = parsedItems.filter((p) => p.category === 'weight');
      const sleepEntries = parsedItems.filter((p) => p.category === 'sleep');
      const supplements = parsedItems.filter((p) => p.category === 'supplement').map((p) => p.data);
      const workouts = parsedItems.filter((p) => p.category === 'workout').map((p) => p.data);
      const vitalsEntries = parsedItems.filter((p) => p.category === 'vitals');

      if (meals.length > 0) {
        const newMeals = meals.map((m) => ({
          name: m.food_name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fats: m.fats,
          portion: '',
          mealType: 'snack',
          source: 'Manuel Toplu Giriş'
        }));
        await addMeals(user.uid, selectedDate, newMeals);
      }

      if (waterEntries.length > 0) {
        const existing = await getWaterTracker(user.uid);
        const currentEntries = existing.success ? (existing.data.entries || []) : [];
        const goal = existing.success ? (existing.data.dailyGoal || 2500) : 2500;
        const newEntries = waterEntries.map((w) => ({
          id: Date.now() + Math.random(),
          amount: w.data.water_ml,
          date: selectedDate,
          timestamp: new Date().toISOString()
        }));
        await saveWaterTracker(user.uid, [...currentEntries, ...newEntries], goal);
      }

      if (weightEntries.length > 0) {
        const last = weightEntries[weightEntries.length - 1];
        const existing = await getWeightTracker(user.uid);
        const currentEntries = existing.success ? (existing.data.entries || []) : [];
        const target = existing.success ? existing.data.targetWeight : null;
        const newEntry = { id: Date.now(), weight: last.data.weight_kg, date: selectedDate, timestamp: new Date().toISOString() };
        const existingIndex = currentEntries.findIndex((e) => e.date === selectedDate);
        const updated = existingIndex >= 0
          ? currentEntries.map((e, i) => (i === existingIndex ? newEntry : e))
          : [...currentEntries, newEntry].sort((a, b) => new Date(a.date) - new Date(b.date));
        await saveWeightTracker(user.uid, updated, target);
      }

      // Uyku / takviye / antrenman / vitals - günlük log dokümanında ayrı alanlar,
      // diziler için mevcut kayıtlarla birleştir (Firestore merge:true diziyi ezer, deep-merge yapmaz)
      if (sleepEntries.length > 0 || supplements.length > 0 || workouts.length > 0 || vitalsEntries.length > 0) {
        const existingLog = await getDailyLog(user.uid, selectedDate);
        const currentSupplements = existingLog.success ? (existingLog.data.supplements || []) : [];
        const currentWorkouts = existingLog.success ? (existingLog.data.workouts || []) : [];

        const logFields = {};
        if (sleepEntries.length > 0) logFields.sleep = sleepEntries[sleepEntries.length - 1].data.sleep;
        if (supplements.length > 0) logFields.supplements = [...currentSupplements, ...supplements];
        if (workouts.length > 0) logFields.workouts = [...currentWorkouts, ...workouts];
        if (vitalsEntries.length > 0) logFields.vitals = vitalsEntries[vitalsEntries.length - 1].data.vitals;

        await saveDailyLog(user.uid, selectedDate, logFields);
      }

      setSavedMessage(true);
      setInputText('');
      setParsedItems([]);
      setParseErrors([]);
      if (onSaved) onSaved();
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (err) {
      setError(err.message || 'Kaydetme sırasında hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="manual-quick-entry">
        <div className="manual-login-warning">⚠️ Hızlı Giriş için giriş yapmanız gerekiyor.</div>
      </div>
    );
  }

  return (
    <div className="manual-quick-entry">
      <div className="manual-header">
        <h3>⌨️ Hızlı Giriş (Anahtar Kelimeli)</h3>
        <p>AI'ya gitmez, anında kaydeder. Her satır ayrı bir anahtar kelimeyle başlamalı, istediğin kadar satırı tek seferde yapıştırabilirsin. Öğünlerde sadece kalori zorunlu — protein/karb/yağ tamamen opsiyonel:</p>
        <div className="manual-keywords">
          {AVAILABLE_KEYWORDS.map((k) => (
            <span key={k} className="keyword-chip">{k}:</span>
          ))}
        </div>
      </div>

      <div className="manual-date">
        <label>Tarih</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <textarea
        className="manual-input manual-textarea"
        placeholder={'örn:\nsu: 500\nuyku: 7 saat 30 dakika skor 90\nyemek: tavuk göğsü 300kcal'}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={6}
      />

      {error && <div className="manual-error">⚠️ {error}</div>}
      {savedMessage && <div className="manual-success">✅ Kaydedildi!</div>}

      {parsedItems.length === 0 ? (
        <button className="manual-parse-btn" onClick={handleParse} disabled={!inputText.trim()}>
          Ayrıştır
        </button>
      ) : (
        <div className="manual-preview">
          <div className="manual-preview-list">
            {parsedItems.map((it, i) => (
              <div key={i} className="manual-preview-item">
                <span>{it.preview}</span>
                <button onClick={() => removeItem(i)}>🗑️</button>
              </div>
            ))}
          </div>

          {parseErrors.length > 0 && (
            <div className="manual-preview-errors">
              <strong>⚠️ Ayrıştırılamayan satırlar ({parseErrors.length}):</strong>
              <ul>
                {parseErrors.map((e, i) => (
                  <li key={i}>Satır {e.line}: "{e.raw}" — {e.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="manual-preview-actions">
            <button className="manual-save-btn" onClick={handleSaveAll} disabled={isSaving || parsedItems.length === 0}>
              {isSaving ? 'Kaydediliyor...' : `✅ Hepsini Onayla ve Kaydet (${parsedItems.length})`}
            </button>
            <button className="manual-cancel-btn" onClick={() => { setParsedItems([]); setParseErrors([]); }}>
              ❌ İptal
            </button>
          </div>
        </div>
      )}

      <div className="manual-examples">
        <h5>💡 Örnekler</h5>
        <ul>
          <li><code>su: 500</code></li>
          <li><code>kilo: 78.5</code></li>
          <li><code>uyku: 7 saat 30 dakika skor 90</code></li>
          <li><code>takviye: kreatin 5g</code></li>
          <li><code>antrenman: bench press: 20x12, 25x10</code></li>
          <li><code>antrenman: yürüyüş 15 dk</code> (set bilgisi yoksa)</li>
          <li><code>yemek: tavuk göğsü 300kcal</code> (en basit hali — sadece kalori yeterli)</li>
          <li><code>yemek: tavuk göğsü 300kcal 40p 5c 10f</code> (protein/karb/yağ eklemek istersen, opsiyonel)</li>
          <li><code>aktivite: 9617 adım 1105 aktif kalori 96 dk egzersiz 13 saat duruş 6.56 km</code></li>
        </ul>
      </div>
    </div>
  );
};

export default ManualQuickEntry;
