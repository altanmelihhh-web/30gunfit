import React, { useState, useEffect } from 'react';
import NutritionCalculator from './NutritionCalculator';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';
import CalorieTracker from './CalorieTracker';
import WaterTracker from './WaterTracker';
import ShoppingList from './ShoppingList';
import TrendView from './TrendView';
import DailyLogForm from './DailyLogForm';
import ManualQuickEntry from './ManualQuickEntry';
import MealPhotoGallery from './MealPhotoGallery';
import GoalsCard, { DEFAULT_GOALS } from './GoalsCard';
import { addMeal } from '../firebase/mealsService';
import { getNutritionGoals, saveNutritionGoals } from '../firebase/dataService';
import './NutritionDashboard.css';

// Beslenme merkezindeki tüm sekmeler (kaydırmalı olarak hepsi görünür)
const NUTRITION_TABS = [
  { key: 'tracker', icon: '📝', label: 'Beslenme' },
  { key: 'quick-entry', icon: '⌨️', label: 'Toplu Giriş' },
  { key: 'ai-analyzer', icon: '🤖', label: 'AI Foto' },
  { key: 'water', icon: '💧', label: 'Su' },
  { key: 'trends', icon: '📈', label: 'Trend' },
  { key: 'tools', icon: '🧰', label: 'Araçlar' }
];

/**
 * NutritionDashboard - Tüm beslenme özelliklerini birleştiren ana dashboard
 * - Beslenme hesaplayıcı (BMR, TDEE, Makro)
 * - AI fotoğraf analizi
 * - Günlük kalori takibi
 */

const NutritionDashboard = ({ userProfile, user, driveAccessToken, onRequestDriveAccess }) => {
  // tracker, water, add-menu, ai-analyzer, ai-daily-log, manual-entry,
  // more-menu, calculator, trends, photo-gallery, shopping-list
  const [activeSection, setActiveSection] = useState('tracker');
  const [nutritionResults, setNutritionResults] = useState(null);
  const [goals, setGoals] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [trackerRefreshKey, setTrackerRefreshKey] = useState(0);
  const [showDailyForm, setShowDailyForm] = useState(false);

  // Hesaplayıcıdan gelen sonuçları kaydet
  const handleNutritionResults = (results) => {
    setNutritionResults(results);
    localStorage.setItem('nutrition_plan', JSON.stringify(results));
  };

  const applyCalculatorResultsToGoals = async () => {
    if (!nutritionResults) return;
    const newGoals = {
      calories: Math.round(nutritionResults.targetCalories || DEFAULT_GOALS.calories),
      protein: Math.round(nutritionResults.macros?.protein?.grams || DEFAULT_GOALS.protein),
      carbs: Math.round(nutritionResults.macros?.carbs?.grams || DEFAULT_GOALS.carbs),
      fats: Math.round(nutritionResults.macros?.fats?.grams || DEFAULT_GOALS.fats),
      water: Math.round((nutritionResults.waterIntake || 4) * 1000)
    };
    if (user) await saveNutritionGoals(user.uid, newGoals);
    localStorage.setItem('nutrition_goals', JSON.stringify(newGoals));
    setGoals(newGoals);
    setSuccessMessage('Hesaplayıcı sonucu günlük hedeflerine uygulandı.');
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
      setActiveSection('tracker');
    }, 1200);
  };

  // localStorage'dan hesaplayıcı planını yükle (opsiyonel)
  useEffect(() => {
    const savedPlan = localStorage.getItem('nutrition_plan');
    if (savedPlan) setNutritionResults(JSON.parse(savedPlan));
  }, []);

  // SABİT hedefleri yükle: önce Firestore, yoksa localStorage, yoksa varsayılan
  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await getNutritionGoals(user.uid);
      if (result.success) {
        setGoals(result.data);
        localStorage.setItem('nutrition_goals', JSON.stringify(result.data));
        return;
      }
      const saved = localStorage.getItem('nutrition_goals');
      setGoals(saved ? JSON.parse(saved) : DEFAULT_GOALS);
    })();
  }, [user]);

  // Sabit hedeflerden CalorieTracker'ın beklediği hedef yapısını türet
  const effectiveGoals = goals || DEFAULT_GOALS;
  const targetCalories = effectiveGoals.calories;
  const targetMacros = {
    protein: { grams: effectiveGoals.protein },
    carbs: { grams: effectiveGoals.carbs },
    fats: { grams: effectiveGoals.fats }
  };

  // AI analizinden yemek ekle
  const handleFoodAnalyzed = async (foodData) => {
    const today = new Date().toISOString().split('T')[0];
    await addMeal(user?.uid, today, {
      name: foodData.food_name,
      calories: foodData.calories,
      protein: foodData.protein,
      carbs: foodData.carbs,
      fats: foodData.fats,
      portion: foodData.portion_size,
      mealType: 'snack',
      source: 'AI Analiz'
    });

    setShowSuccessMessage(true);
    setSuccessMessage('Yemek başarıyla günlük takibinize eklendi. Bugün sekmesine yönlendiriliyorsunuz.');

    // 2 saniye sonra mesajı gizle ve tracker'a geç
    setTimeout(() => {
      setShowSuccessMessage(false);
      setTrackerRefreshKey(prev => prev + 1); // Force refresh
      setActiveSection('tracker');
    }, 2000);
  };

  return (
    <div className="nutrition-dashboard">
      <div className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">Nutrition Command Center</span>
          <h1>Beslenme Operasyonları</h1>
        </div>
        <p>Günlük kalori, makro, su ve aktivite kayıtlarını tek akışta gir, izle ve haftalık eğilime bağla.</p>
      </div>

      {/* Navigasyon - tüm sekmeler görünür (yatay kaydırmalı) */}
      <div className="nutrition-nav">
        {NUTRITION_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`nav-btn ${activeSection === tab.key ? 'active' : ''}`}
            onClick={() => setActiveSection(tab.key)}
          >
            <span className="nav-btn-icon">{tab.icon}</span>
            <span className="nav-btn-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Başarı mesajı */}
      {showSuccessMessage && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}

      {/* İçerik bölümleri */}
      <div className="dashboard-content">
        {activeSection === 'tracker' && (
          <div className="section-content">
            <GoalsCard user={user} goals={goals} onSave={setGoals} />
            <div className="daily-form-launcher">
              <div>
                <strong>Günlük Form</strong>
                <span>Öğün, su, uyku, aktivite ve takviyeyi tek ekrandan gir.</span>
              </div>
              <button onClick={() => setShowDailyForm((prev) => !prev)}>
                {showDailyForm ? 'Formu Kapat' : 'Formu Aç'}
              </button>
            </div>
            {showDailyForm && (
              <DailyLogForm
                user={user}
                nutritionResults={{ targetCalories, macros: targetMacros }}
                onSaved={() => {
                  setTrackerRefreshKey((prev) => prev + 1);
                  setShowDailyForm(false);
                }}
              />
            )}
            <CalorieTracker
              key={trackerRefreshKey}
              targetCalories={targetCalories}
              targetMacros={targetMacros}
              user={user}
            />
          </div>
        )}

        {activeSection === 'water' && (
          <div className="section-content">
            <WaterTracker user={user} />
          </div>
        )}

        {activeSection === 'ai-analyzer' && (
          <div className="section-content">
            <FoodPhotoAnalyzer onFoodAnalyzed={handleFoodAnalyzed} />
          </div>
        )}

        {activeSection === 'quick-entry' && (
          <div className="section-content">
            <ManualQuickEntry user={user} onSaved={() => setTrackerRefreshKey((prev) => prev + 1)} />
          </div>
        )}

        {activeSection === 'tools' && (
          <div className="section-content">
            <div className="tools-grid">
              <button className="tool-card" onClick={() => setActiveSection('calculator')}>
                <span>📊</span><strong>Hesaplayıcı</strong><small>BMR, TDEE ve hedef önerisi</small>
              </button>
              <button className="tool-card" onClick={() => setActiveSection('photo-gallery')}>
                <span>📷</span><strong>Galeri</strong><small>Öğün fotoğrafları</small>
              </button>
              <button className="tool-card" onClick={() => setActiveSection('shopping-list')}>
                <span>🛒</span><strong>Alışveriş</strong><small>Liste ve alternatifler</small>
              </button>
              <button className="tool-card" onClick={() => setActiveSection('daily-log-form')}>
                <span>📋</span><strong>Gelişmiş Form</strong><small>Tüm günü tek formda gir</small>
              </button>
            </div>
          </div>
        )}

        {activeSection === 'calculator' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <NutritionCalculator userProfile={userProfile} onSaveResults={handleNutritionResults} />
            {nutritionResults && (
              <div className="quick-actions">
                <p>Bu hesaplama önerisini günlük hedeflerine tek tıkla uygulayabilirsin.</p>
                <div className="action-buttons">
                  <button className="action-btn tracker-btn" onClick={applyCalculatorResultsToGoals}>🎯 Hedeflere Uygula</button>
                  <button className="action-btn" onClick={() => setActiveSection('tracker')}>Bugün'e Git</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'shopping-list' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <ShoppingList />
          </div>
        )}

        {activeSection === 'trends' && (
          <div className="section-content">
            <TrendView user={user} />
          </div>
        )}

        {activeSection === 'photo-gallery' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <MealPhotoGallery
              user={user}
              driveAccessToken={driveAccessToken}
              onRequestDriveAccess={onRequestDriveAccess}
            />
          </div>
        )}

        {activeSection === 'daily-log-form' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <DailyLogForm
              user={user}
              nutritionResults={{ targetCalories, macros: targetMacros }}
              onSaved={() => setTrackerRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default NutritionDashboard;
