import React, { useState, useEffect } from 'react';
import './CalorieTracker.css';
import { getMeals, addMeal, updateMeal, deleteMeal } from '../firebase/mealsService';

/**
 * CalorieTracker - Günlük kalori ve makro takibi
 * - Manuel yemek ekleme/düzenleme
 * - AI fotoğraf analizinden otomatik ekleme
 * - Günlük hedef karşılaştırması
 * - Geçmiş gün görüntüleme
 *
 * Not: Tüm yazma işlemleri mealsService üzerinden gidiyor - her ekleme/silme/düzenleme
 * önce Firestore'dan GÜNCEL listeyi okuyup üzerine işliyor, bu component'in kendi
 * (bayat olabilecek) state'ini olduğu gibi geri yazmıyor.
 */

const EMPTY_MEAL = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  mealType: 'breakfast',
  portion: ''
};

const CalorieTracker = ({ targetCalories, targetMacros, onDataChange, user }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState([]);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState(null);
  const [newMeal, setNewMeal] = useState(EMPTY_MEAL);
  const [isSaving, setIsSaving] = useState(false);

  const MEAL_TYPES = {
    breakfast: { label: 'Kahvaltı', icon: '🌅' },
    lunch: { label: 'Öğle Yemeği', icon: '☀️' },
    dinner: { label: 'Akşam Yemeği', icon: '🌙' },
    snack: { label: 'Atıştırmalık', icon: '🍎' }
  };

  const refreshMeals = async () => {
    const freshMeals = await getMeals(user?.uid, selectedDate);
    setMeals(freshMeals);
    if (onDataChange) onDataChange(freshMeals);
  };

  useEffect(() => {
    refreshMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, user]);

  const calculateTotals = () => {
    return meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + (parseFloat(meal.calories) || 0),
        protein: totals.protein + (parseFloat(meal.protein) || 0),
        carbs: totals.carbs + (parseFloat(meal.carbs) || 0),
        fats: totals.fats + (parseFloat(meal.fats) || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  };

  const totals = calculateTotals();

  const resetForm = () => {
    setNewMeal(EMPTY_MEAL);
    setIsAddingMeal(false);
    setEditingMealId(null);
  };

  const handleSaveMeal = async () => {
    if (!newMeal.name || !newMeal.calories) {
      alert('Lütfen en az yemek adı ve kalori bilgisi girin');
      return;
    }
    setIsSaving(true);
    try {
      if (editingMealId) {
        await updateMeal(user?.uid, selectedDate, editingMealId, newMeal);
      } else {
        await addMeal(user?.uid, selectedDate, newMeal);
      }
      await refreshMeals();
      resetForm();
    } catch (error) {
      alert('Kaydetme sırasında hata oluştu: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (meal) => {
    setNewMeal({
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
      mealType: meal.mealType || 'snack',
      portion: meal.portion || ''
    });
    setEditingMealId(meal.id);
    setIsAddingMeal(true);
  };

  const handleDeleteMeal = async (mealId) => {
    if (!window.confirm('Bu yemeği silmek istediğinize emin misiniz?')) return;
    try {
      await deleteMeal(user?.uid, selectedDate, mealId);
      await refreshMeals();
      if (editingMealId === mealId) resetForm();
    } catch (error) {
      alert('Silme sırasında hata oluştu: ' + error.message);
    }
  };

  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const changeDate = (direction) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + direction);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) return 'Bugün';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('tr-TR', options);
  };

  return (
    <div className="calorie-tracker">
      {/* Tarih seçici */}
      <div className="date-selector">
        <button onClick={() => changeDate(-1)} className="date-nav-btn">
          ◀
        </button>
        <div className="date-display">
          <span className="date-text">{formatDate(selectedDate)}</span>
          {selectedDate !== new Date().toISOString().split('T')[0] && (
            <button onClick={goToToday} className="today-btn">
              📅 Bugüne Dön
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="date-nav-btn">
          ▶
        </button>
      </div>

      {/* Günlük özet */}
      {targetCalories && (
        <div className="daily-summary">
          <div className="summary-card main-calories">
            <div className="summary-header">
              <span className="summary-icon">🔥</span>
              <span className="summary-label">Günlük Kalori</span>
            </div>
            <div className="summary-values">
              <span className="current-value">{Math.round(totals.calories)}</span>
              <span className="target-divider">/</span>
              <span className="target-value">{targetCalories}</span>
              <span className="unit">kcal</span>
            </div>
            <div className="progress-bar">
              <div
                className="calorie-tracker-progress-fill"
                style={{
                  width: `${getProgressPercentage(totals.calories, targetCalories)}%`,
                  background: totals.calories > targetCalories ?
                    'linear-gradient(90deg, #ef4444, #dc2626)' :
                    'linear-gradient(90deg, #22c55e, #16a34a)'
                }}
              />
            </div>
            <div className="summary-remaining">
              {targetCalories - totals.calories > 0 ? (
                <span style={{ color: '#22c55e' }}>
                  ✓ {Math.round(targetCalories - totals.calories)} kcal kaldı
                </span>
              ) : (
                <span style={{ color: '#ef4444' }}>
                  ⚠️ {Math.round(totals.calories - targetCalories)} kcal fazla
                </span>
              )}
            </div>
          </div>

          {/* Makro özeti */}
          {targetMacros && (
            <div className="macros-summary">
              <div className="macro-summary-item">
                <span className="macro-icon">🥩</span>
                <div className="macro-info">
                  <span className="macro-label">Protein</span>
                  <span className="macro-value">
                    {Math.round(totals.protein)}g / {targetMacros.protein.grams}g
                  </span>
                </div>
                <div className="macro-mini-bar">
                  <div
                    className="macro-mini-fill protein-fill"
                    style={{ width: `${getProgressPercentage(totals.protein, targetMacros.protein.grams)}%` }}
                  />
                </div>
              </div>

              <div className="macro-summary-item">
                <span className="macro-icon">🍞</span>
                <div className="macro-info">
                  <span className="macro-label">Karbonhidrat</span>
                  <span className="macro-value">
                    {Math.round(totals.carbs)}g / {targetMacros.carbs.grams}g
                  </span>
                </div>
                <div className="macro-mini-bar">
                  <div
                    className="macro-mini-fill carbs-fill"
                    style={{ width: `${getProgressPercentage(totals.carbs, targetMacros.carbs.grams)}%` }}
                  />
                </div>
              </div>

              <div className="macro-summary-item">
                <span className="macro-icon">🥑</span>
                <div className="macro-info">
                  <span className="macro-label">Yağ</span>
                  <span className="macro-value">
                    {Math.round(totals.fats)}g / {targetMacros.fats.grams}g
                  </span>
                </div>
                <div className="macro-mini-bar">
                  <div
                    className="macro-mini-fill fats-fill"
                    style={{ width: `${getProgressPercentage(totals.fats, targetMacros.fats.grams)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Yemek ekleme butonu */}
      <div className="add-meal-section">
        <button
          className="btn-add-meal"
          onClick={() => (isAddingMeal ? resetForm() : setIsAddingMeal(true))}
        >
          {isAddingMeal ? '❌ İptal' : '➕ Yemek Ekle'}
        </button>
      </div>

      {/* Manuel yemek ekleme/düzenleme formu */}
      {isAddingMeal && (
        <div className="add-meal-form">
          <h4>{editingMealId ? 'Yemeği Düzenle' : 'Yeni Yemek Ekle'}</h4>

          <div className="form-row">
            <div className="calorie-tracker-form-group">
              <label>Yemek Adı *</label>
              <input
                type="text"
                placeholder="Örn: Tavuk Göğsü Izgara"
                value={newMeal.name}
                onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
              />
            </div>

            <div className="calorie-tracker-form-group">
              <label>Öğün Tipi</label>
              <select
                value={newMeal.mealType}
                onChange={(e) => setNewMeal({ ...newMeal, mealType: e.target.value })}
              >
                {Object.entries(MEAL_TYPES).map(([key, type]) => (
                  <option key={key} value={key}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="calorie-tracker-form-group">
              <label>Kalori (kcal) *</label>
              <input
                type="number"
                placeholder="250"
                value={newMeal.calories}
                onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
              />
            </div>

            <div className="calorie-tracker-form-group">
              <label>Porsiyon</label>
              <input
                type="text"
                placeholder="1 porsiyon, 200g"
                value={newMeal.portion}
                onChange={(e) => setNewMeal({ ...newMeal, portion: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="calorie-tracker-form-group">
              <label>Protein (g)</label>
              <input
                type="number"
                placeholder="30"
                value={newMeal.protein}
                onChange={(e) => setNewMeal({ ...newMeal, protein: e.target.value })}
              />
            </div>

            <div className="calorie-tracker-form-group">
              <label>Karbonhidrat (g)</label>
              <input
                type="number"
                placeholder="40"
                value={newMeal.carbs}
                onChange={(e) => setNewMeal({ ...newMeal, carbs: e.target.value })}
              />
            </div>

            <div className="calorie-tracker-form-group">
              <label>Yağ (g)</label>
              <input
                type="number"
                placeholder="10"
                value={newMeal.fats}
                onChange={(e) => setNewMeal({ ...newMeal, fats: e.target.value })}
              />
            </div>
          </div>

          <button className="btn-save-meal" onClick={handleSaveMeal} disabled={isSaving}>
            {isSaving ? '💾 Kaydediliyor...' : editingMealId ? '💾 Güncelle' : '💾 Kaydet'}
          </button>
        </div>
      )}

      {/* Yemek listesi */}
      <div className="meals-list">
        <h4>Öğünler ({meals.length})</h4>

        {meals.length === 0 ? (
          <div className="empty-meals">
            <span className="empty-icon">🍽️</span>
            <p>Henüz yemek eklenmemiş</p>
            <p className="empty-hint">Yukarıdaki butonu kullanarak yemek ekleyin</p>
          </div>
        ) : (
          Object.entries(MEAL_TYPES).map(([mealType, typeData]) => {
            const mealsByType = meals.filter(m => m.mealType === mealType);
            if (mealsByType.length === 0) return null;

            return (
              <div key={mealType} className="meal-type-group">
                <h5 className="meal-type-header">
                  <span>{typeData.icon}</span>
                  <span>{typeData.label}</span>
                  <span className="meal-count">({mealsByType.length})</span>
                </h5>

                {mealsByType.map((meal) => (
                  <div key={meal.id} className="meal-item">
                    <div className="meal-info">
                      <div className="meal-name">{meal.mealLabel || meal.name}</div>
                      {meal.mealLabel && <div className="meal-portion">{meal.name}</div>}
                      {meal.portion && (
                        <div className="meal-portion">{meal.portion}</div>
                      )}
                      {meal.source && (
                        <div className="meal-source">🤖 {meal.source}</div>
                      )}
                    </div>

                    <div className="meal-nutrition">
                      <div className="nutrition-badge calories-badge">
                        🔥 {Math.round(meal.calories)} kcal
                      </div>
                      {meal.protein > 0 && (
                        <div className="nutrition-badge">Protein: {Math.round(meal.protein)}g</div>
                      )}
                      {meal.carbs > 0 && (
                        <div className="nutrition-badge">Karbonhidrat: {Math.round(meal.carbs)}g</div>
                      )}
                      {meal.fats > 0 && (
                        <div className="nutrition-badge">Yağ: {Math.round(meal.fats)}g</div>
                      )}
                    </div>

                    <div className="meal-actions">
                      <button
                        className="btn-edit-meal"
                        onClick={() => handleStartEdit(meal)}
                        title="Düzenle"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete-meal"
                        onClick={() => handleDeleteMeal(meal.id)}
                        title="Sil"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CalorieTracker;
