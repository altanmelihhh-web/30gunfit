import React, { useState } from 'react';
import './GoalsCard.css';
import { saveNutritionGoals } from '../firebase/dataService';

/**
 * GoalsCard - kullanıcının SABİT beslenme/su hedeflerini gösterir ve düzenlemeye izin verir.
 * Değerler nutritionGoals dokümanında (Firestore + localStorage) tutulur, otomatik değişmez.
 */

export const DEFAULT_GOALS = { calories: 2400, protein: 180, carbs: 210, fats: 80, water: 4000 };

const GoalsCard = ({ user, goals, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goals || DEFAULT_GOALS);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setForm(goals || DEFAULT_GOALS);
    setEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newGoals = {
        calories: parseInt(form.calories, 10) || 0,
        protein: parseInt(form.protein, 10) || 0,
        carbs: parseInt(form.carbs, 10) || 0,
        fats: parseInt(form.fats, 10) || 0,
        water: parseInt(form.water, 10) || 0
      };
      if (user) await saveNutritionGoals(user.uid, newGoals);
      localStorage.setItem('nutrition_goals', JSON.stringify(newGoals));
      if (onSave) onSave(newGoals);
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const g = goals || DEFAULT_GOALS;

  return (
    <div className="goals-card">
      <div className="goals-card-head">
        <h4>🎯 Günlük Hedeflerim</h4>
        {!editing && (
          <button className="goals-edit-btn" onClick={startEdit}>✏️ Düzenle</button>
        )}
      </div>

      {editing ? (
        <div className="goals-edit">
          <div className="goals-edit-grid">
            <label>Kalori (kcal)<input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></label>
            <label>Protein (g)<input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} /></label>
            <label>Karbonhidrat (g)<input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} /></label>
            <label>Yağ (g)<input type="number" value={form.fats} onChange={(e) => setForm({ ...form, fats: e.target.value })} /></label>
            <label>Su (ml)<input type="number" value={form.water} onChange={(e) => setForm({ ...form, water: e.target.value })} /></label>
          </div>
          <div className="goals-edit-actions">
            <button className="goals-save-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
            <button className="goals-cancel-btn" onClick={() => setEditing(false)}>İptal</button>
          </div>
        </div>
      ) : (
        <div className="goals-grid">
          <div className="goals-item"><span>🔥</span><strong>{g.calories}</strong><small>kcal</small></div>
          <div className="goals-item"><span>🥩</span><strong>{g.protein}g</strong><small>protein</small></div>
          <div className="goals-item"><span>🍞</span><strong>{g.carbs}g</strong><small>karb.</small></div>
          <div className="goals-item"><span>🥑</span><strong>{g.fats}g</strong><small>yağ</small></div>
          <div className="goals-item"><span>💧</span><strong>{g.water}</strong><small>ml su</small></div>
        </div>
      )}
    </div>
  );
};

export default GoalsCard;
