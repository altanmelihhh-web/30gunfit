import React, { useState, useEffect } from 'react';
import './CalorieTracker.css';

/**
 * CalorieTracker - Günlük kalori ve makro takibi
 * - Manuel yemek ekleme
 * - AI fotoğraf analizinden otomatik ekleme
 * - Günlük hedef karşılaştırması
 * - Geçmiş gün görüntüleme
 */

const CalorieTracker = ({ targetCalories, targetMacros, onDataChange }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState([]);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    mealType: 'breakfast',
    portion: ''
  });

  const MEAL_TYPES = {
    breakfast: { label: 'Kahvaltı', icon: '🌅' },
    lunch: { label: 'Öğle Yemeği', icon: '☀️' },
    dinner: { label: 'Akşam Yemeği', icon: '🌙' },
    snack: { label: 'Atıştırmalık', icon: '🍎' }
  };

  // localStorage'dan günlük verileri yükle
  useEffect(() => {
    const loadMeals = () => {
      const allTrackerData = JSON.parse(localStorage.getItem('calorie_tracker') || '{}');
      const todayMeals = allTrackerData[selectedDate] || [];
      setMeals(todayMeals);
    };
    loadMeals();
  }, [selectedDate]);

  // Veri değiştiğinde localStorage'a kaydet
  useEffect(() => {
    const allTrackerData = JSON.parse(localStorage.getItem('calorie_tracker') || '{}');
    allTrackerData[selectedDate] = meals;
    localStorage.setItem('calorie_tracker', JSON.stringify(allTrackerData));

    // Parent component'e bildir
    if (onDataChange) {
      onDataChange(meals);
    }
  }, [meals, selectedDate, onDataChange]);

  // Günlük toplamları hesapla
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

  // Yemek ekleme
  const handleAddMeal = () => {
    if (!newMeal.name || !newMeal.calories) {
      alert('Lütfen en az yemek adı ve kalori bilgisi girin');
      return;
    }

    const mealToAdd = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...newMeal,
      calories: parseFloat(newMeal.calories) || 0,
      protein: parseFloat(newMeal.protein) || 0,
      carbs: parseFloat(newMeal.carbs) || 0,
      fats: parseFloat(newMeal.fats) || 0
    };

    setMeals([...meals, mealToAdd]);
    setNewMeal({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      mealType: 'breakfast',
      portion: ''
    });
    setIsAddingMeal(false);
  };

  // AI analizinden yemek ekle (kullanılmıyor şu an - addMealFromAI export fonksiyonu kullanılıyor)
  // const handleAddFromAI = (foodData) => {
  //   const aiMeal = {
  //     id: Date.now(),
  //     timestamp: new Date().toISOString(),
  //     name: foodData.food_name,
  //     calories: foodData.calories,
  //     protein: foodData.protein,
  //     carbs: foodData.carbs,
  //     fats: foodData.fats,
  //     portion: foodData.portion_size,
  //     mealType: 'snack',
  //     source: 'AI Analysis'
  //   };
  //
  //   setMeals([...meals, aiMeal]);
  // };

  // Yemek silme
  const handleDeleteMeal = (mealId) => {
    if (window.confirm('Bu yemeği silmek istediğinize emin misiniz?')) {
      setMeals(meals.filter(m => m.id !== mealId));
    }
  };

  // Progress yüzdesi
  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  // Tarih değiştirme
  const changeDate = (direction) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + direction);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  // Bugüne dön
  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Tarih formatla
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
                className="progress-fill"
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
          onClick={() => setIsAddingMeal(!isAddingMeal)}
        >
          {isAddingMeal ? '❌ İptal' : '➕ Yemek Ekle'}
        </button>
      </div>

      {/* Manuel yemek ekleme formu */}
      {isAddingMeal && (
        <div className="add-meal-form">
          <h4>Yeni Yemek Ekle</h4>

          <div className="form-row">
            <div className="form-group">
              <label>Yemek Adı *</label>
              <input
                type="text"
                placeholder="Örn: Tavuk Göğsü Izgara"
                value={newMeal.name}
                onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
              />
            </div>

            <div className="form-group">
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
            <div className="form-group">
              <label>Kalori (kcal) *</label>
              <input
                type="number"
                placeholder="250"
                value={newMeal.calories}
                onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
              />
            </div>

            <div className="form-group">
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
            <div className="form-group">
              <label>Protein (g)</label>
              <input
                type="number"
                placeholder="30"
                value={newMeal.protein}
                onChange={(e) => setNewMeal({ ...newMeal, protein: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Karbonhidrat (g)</label>
              <input
                type="number"
                placeholder="40"
                value={newMeal.carbs}
                onChange={(e) => setNewMeal({ ...newMeal, carbs: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Yağ (g)</label>
              <input
                type="number"
                placeholder="10"
                value={newMeal.fats}
                onChange={(e) => setNewMeal({ ...newMeal, fats: e.target.value })}
              />
            </div>
          </div>

          <button className="btn-save-meal" onClick={handleAddMeal}>
            💾 Kaydet
          </button>
        </div>
      )}

      {/* Yemek listesi */}
      <div className="meals-list">
        <h4>Bugünün Öğünleri ({meals.length})</h4>

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
                      <div className="meal-name">{meal.name}</div>
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
                        <div className="nutrition-badge">P: {Math.round(meal.protein)}g</div>
                      )}
                      {meal.carbs > 0 && (
                        <div className="nutrition-badge">C: {Math.round(meal.carbs)}g</div>
                      )}
                      {meal.fats > 0 && (
                        <div className="nutrition-badge">F: {Math.round(meal.fats)}g</div>
                      )}
                    </div>

                    <button
                      className="btn-delete-meal"
                      onClick={() => handleDeleteMeal(meal.id)}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* AI'dan import için gizli callback */}
      <div style={{ display: 'none' }}>
        {/* Bu bir placeholder, gerçek entegrasyon App.js'te olacak */}
      </div>
    </div>
  );
};

// AI analizinden yemek eklemek için export edilen fonksiyon
export const addMealFromAI = (foodData, date = new Date().toISOString().split('T')[0]) => {
  const aiMeal = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    name: foodData.food_name,
    calories: foodData.calories,
    protein: foodData.protein,
    carbs: foodData.carbs,
    fats: foodData.fats,
    portion: foodData.portion_size,
    mealType: 'snack',
    source: 'AI Analysis'
  };

  const allTrackerData = JSON.parse(localStorage.getItem('calorie_tracker') || '{}');
  const dayMeals = allTrackerData[date] || [];
  dayMeals.push(aiMeal);
  allTrackerData[date] = dayMeals;
  localStorage.setItem('calorie_tracker', JSON.stringify(allTrackerData));

  return aiMeal;
};

export default CalorieTracker;
