import React, { useState, useEffect } from 'react';
import './NutritionCalculator.css';

/**
 * NutritionCalculator - Bilimsel beslenme hesaplayıcıları
 * - BMR (Basal Metabolic Rate): Mifflin-St Jeor formülü
 * - TDEE (Total Daily Energy Expenditure): BMR × aktivite seviyesi
 * - Makro hesaplama: Hedefe göre protein/karbonhidrat/yağ dağılımı
 */

// Aktivite seviyeleri (ACSM 2024)
const ACTIVITY_LEVELS = {
  SEDENTARY: { value: 1.2, label: 'Hareketsiz', description: 'Masabaşı iş, çok az egzersiz' },
  LIGHT: { value: 1.375, label: 'Az Aktif', description: 'Haftada 1-3 gün hafif egzersiz' },
  MODERATE: { value: 1.55, label: 'Orta Aktif', description: 'Haftada 3-5 gün orta egzersiz' },
  VERY_ACTIVE: { value: 1.725, label: 'Çok Aktif', description: 'Haftada 6-7 gün yoğun egzersiz' },
  EXTRA_ACTIVE: { value: 1.9, label: 'Ekstra Aktif', description: 'Günde 2x egzersiz, fiziksel iş' }
};

// Hedef bazlı makro oranları (ISSN 2024 guidelines)
const MACRO_RATIOS = {
  weight_loss: { protein: 35, carbs: 35, fats: 30, name: 'Kilo Verme' },
  muscle_gain: { protein: 30, carbs: 50, fats: 20, name: 'Kas Yapma' },
  maintenance: { protein: 25, carbs: 45, fats: 30, name: 'Koruma/Denge' },
  hiit_focus: { protein: 30, carbs: 45, fats: 25, name: 'HIIT/Performans' }
};

// Kalori ayarlamaları hedefe göre
const CALORIE_ADJUSTMENTS = {
  weight_loss: -500, // Haftalık ~0.5kg kayıp
  muscle_gain: +300, // Haftalık ~0.25kg alım
  maintenance: 0,
  hiit_focus: +100
};

const NutritionCalculator = ({ userProfile, onSaveResults }) => {
  const [formData, setFormData] = useState({
    weight: userProfile?.weight || 70,
    height: userProfile?.height || 170,
    age: userProfile?.age || 25,
    gender: userProfile?.gender || '',
    activityLevel: 'MODERATE',
    goal: userProfile?.goal || 'maintenance'
  });

  const [results, setResults] = useState(null);

  // BMR hesaplama (Mifflin-St Jeor formülü - 2024 standart)
  const calculateBMR = (weight, height, age, gender) => {
    if (!weight || !height || !age || !['male', 'female'].includes(gender)) return null;
    // BMR = (10 × kilo) + (6.25 × boy cm) - (5 × yaş) + c
    // c = +5 erkek, -161 kadın
    const base = (10 * weight) + (6.25 * height) - (5 * age);
    return gender === 'male' ? base + 5 : base - 161;
  };

  // TDEE hesaplama
  const calculateTDEE = (bmr, activityLevel) => {
    return bmr * ACTIVITY_LEVELS[activityLevel].value;
  };

  // Makro hesaplama
  const calculateMacros = (calories, goal) => {
    const ratios = MACRO_RATIOS[goal] || MACRO_RATIOS.maintenance;

    // Kalori değerleri: Protein = 4 cal/g, Karb = 4 cal/g, Yağ = 9 cal/g
    const proteinCals = (calories * ratios.protein) / 100;
    const carbsCals = (calories * ratios.carbs) / 100;
    const fatsCals = (calories * ratios.fats) / 100;

    return {
      protein: {
        grams: Math.round(proteinCals / 4),
        calories: Math.round(proteinCals),
        percentage: ratios.protein
      },
      carbs: {
        grams: Math.round(carbsCals / 4),
        calories: Math.round(carbsCals),
        percentage: ratios.carbs
      },
      fats: {
        grams: Math.round(fatsCals / 9),
        calories: Math.round(fatsCals),
        percentage: ratios.fats
      }
    };
  };

  const calculateFromData = (data) => {
    const { weight, height, age, gender, activityLevel, goal } = data;

    // BMR hesapla
    const bmr = calculateBMR(weight, height, age, gender);
    if (bmr == null) {
      return null;
    }

    // TDEE hesapla
    const tdee = calculateTDEE(bmr, activityLevel);

    // Hedefe göre kalori ayarla
    const targetCalories = tdee + (CALORIE_ADJUSTMENTS[goal] || 0);

    // Makroları hesapla
    const macros = calculateMacros(targetCalories, goal);

    // Su ihtiyacı (30-35ml/kg - ACSM 2024)
    const waterIntake = Math.round((weight * 33) / 1000 * 10) / 10; // Litre, ondalıklı

    // Sonuçları kaydet
    const calculatedResults = {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories: Math.round(targetCalories),
      macros,
      waterIntake,
      goal: MACRO_RATIOS[goal]?.name || 'Denge',
      activityLevel: ACTIVITY_LEVELS[activityLevel].label
    };

    return calculatedResults;
  };

  // Ana hesaplama fonksiyonu
  const handleCalculate = () => {
    const calculatedResults = calculateFromData(formData);
    if (!calculatedResults) {
      setResults(null);
      return;
    }

    setResults(calculatedResults);

    // Parent component'e kaydet (optional)
    if (onSaveResults) {
      onSaveResults(calculatedResults);
    }
  };

  // Form değişikliği
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Component mount olduğunda otomatik hesapla
  useEffect(() => {
    if (userProfile) {
      const nextFormData = {
        ...formData,
        weight: userProfile?.weight || 70,
        height: userProfile?.height || 170,
        age: userProfile?.age || 25,
        gender: userProfile?.gender || '',
        goal: userProfile?.goal || 'maintenance'
      };
      setFormData(nextFormData);
      const calculatedResults = calculateFromData(nextFormData);
      if (calculatedResults) {
        setResults(calculatedResults);
        if (onSaveResults) onSaveResults(calculatedResults);
      } else {
        setResults(null);
      }
    }
    // eslint-disable-next-line
  }, [userProfile]);

  return (
    <div className="nutrition-calculator">
      <div className="calculator-header">
        <h2>🍎 Beslenme Hesaplayıcı</h2>
        <p>Bilimsel formüllerle kişiselleştirilmiş beslenme planınızı oluşturun</p>
      </div>

      <div className="calculator-form">
        <div className="form-row">
          <div className="nutrition-calc-form-group">
            <label>Kilo (kg)</label>
            <input
              type="number"
              value={formData.weight}
              onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
              min="30"
              max="200"
            />
          </div>

          <div className="nutrition-calc-form-group">
            <label>Boy (cm)</label>
            <input
              type="number"
              value={formData.height}
              onChange={(e) => handleChange('height', parseFloat(e.target.value))}
              min="100"
              max="250"
            />
          </div>

          <div className="nutrition-calc-form-group">
            <label>Yaş</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => handleChange('age', parseInt(e.target.value))}
              min="15"
              max="100"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="nutrition-calc-form-group">
            <label>Cinsiyet</label>
            <div className="radio-group">
              <label className={formData.gender === 'male' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={(e) => handleChange('gender', e.target.value)}
                />
                Erkek
              </label>
              <label className={formData.gender === 'female' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={(e) => handleChange('gender', e.target.value)}
                />
                Kadın
              </label>
            </div>
            {!formData.gender && <small>Cinsiyet seçilmeden BMR hesaplanmaz.</small>}
          </div>
        </div>

        <div className="nutrition-calc-form-group">
          <label>Aktivite Seviyeniz</label>
          <select
            value={formData.activityLevel}
            onChange={(e) => handleChange('activityLevel', e.target.value)}
          >
            {Object.entries(ACTIVITY_LEVELS).map(([key, level]) => (
              <option key={key} value={key}>
                {level.label} - {level.description}
              </option>
            ))}
          </select>
        </div>

        <div className="nutrition-calc-form-group">
          <label>Hedefiniz</label>
          <select
            value={formData.goal}
            onChange={(e) => handleChange('goal', e.target.value)}
          >
            {Object.entries(MACRO_RATIOS).map(([key, ratio]) => (
              <option key={key} value={key}>
                {ratio.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-calculate" onClick={handleCalculate}>
          📊 Hesapla
        </button>
      </div>

      {results && (
        <div className="calculator-results">
          <h3>📈 Sonuçlarınız</h3>

          {/* Kalori sonuçları */}
          <div className="results-section">
            <div className="result-card primary">
              <div className="result-icon">🔥</div>
              <div className="result-content">
                <span className="result-label">BMR (Bazal Metabolizma)</span>
                <span className="result-value">{results.bmr} kcal</span>
                <span className="result-description">Hiçbir şey yapmadan yakılan</span>
              </div>
            </div>

            <div className="result-card primary">
              <div className="result-icon">⚡</div>
              <div className="result-content">
                <span className="result-label">TDEE (Günlük Harcama)</span>
                <span className="result-value">{results.tdee} kcal</span>
                <span className="result-description">{results.activityLevel} seviye</span>
              </div>
            </div>

            <div className="result-card highlight">
              <div className="result-icon">🎯</div>
              <div className="result-content">
                <span className="result-label">Hedef Kalori ({results.goal})</span>
                <span className="result-value">{results.targetCalories} kcal</span>
                <span className="result-description">
                  {results.targetCalories > results.tdee ? '↑ Surplus' :
                   results.targetCalories < results.tdee ? '↓ Deficit' : '= Maintenance'}
                </span>
              </div>
            </div>
          </div>

          {/* Makro dağılımı */}
          <div className="results-section">
            <h4>Makro Besin Dağılımı</h4>

            <div className="macro-cards">
              <div className="macro-card protein">
                <div className="macro-header">
                  <span className="macro-icon">🥩</span>
                  <span className="macro-name">Protein</span>
                </div>
                <div className="macro-value">{results.macros.protein.grams}g</div>
                <div className="macro-details">
                  <span>{results.macros.protein.calories} kcal</span>
                  <span className="macro-percentage">{results.macros.protein.percentage}%</span>
                </div>
                <div className="macro-bar">
                  <div
                    className="macro-fill protein-fill"
                    style={{ width: `${results.macros.protein.percentage}%` }}
                  />
                </div>
              </div>

              <div className="macro-card carbs">
                <div className="macro-header">
                  <span className="macro-icon">🍞</span>
                  <span className="macro-name">Karbonhidrat</span>
                </div>
                <div className="macro-value">{results.macros.carbs.grams}g</div>
                <div className="macro-details">
                  <span>{results.macros.carbs.calories} kcal</span>
                  <span className="macro-percentage">{results.macros.carbs.percentage}%</span>
                </div>
                <div className="macro-bar">
                  <div
                    className="macro-fill carbs-fill"
                    style={{ width: `${results.macros.carbs.percentage}%` }}
                  />
                </div>
              </div>

              <div className="macro-card fats">
                <div className="macro-header">
                  <span className="macro-icon">🥑</span>
                  <span className="macro-name">Yağ</span>
                </div>
                <div className="macro-value">{results.macros.fats.grams}g</div>
                <div className="macro-details">
                  <span>{results.macros.fats.calories} kcal</span>
                  <span className="macro-percentage">{results.macros.fats.percentage}%</span>
                </div>
                <div className="macro-bar">
                  <div
                    className="macro-fill fats-fill"
                    style={{ width: `${results.macros.fats.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Su ihtiyacı */}
          <div className="results-section">
            <div className="result-card water">
              <div className="result-icon">💧</div>
              <div className="result-content">
                <span className="result-label">Günlük Su İhtiyacı</span>
                <span className="result-value">{results.waterIntake} Litre</span>
                <span className="result-description">~{Math.round(results.waterIntake * 4)} su bardağı</span>
              </div>
            </div>
          </div>

          {/* Bilgi notu */}
          <div className="results-info">
            <h4>📚 Bilimsel Temeller</h4>
            <ul>
              <li><strong>BMR Formülü:</strong> Mifflin-St Jeor denklemi (2024 standardı)</li>
              <li><strong>TDEE:</strong> ACSM 2024 aktivite çarpanları kullanıldı</li>
              <li><strong>Makrolar:</strong> ISSN 2024 (International Society of Sports Nutrition) önerileri</li>
              <li><strong>Su İhtiyacı:</strong> 33ml/kg (ACSM 2024 guidelines)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionCalculator;
