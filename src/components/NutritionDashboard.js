import React, { Suspense, lazy, useState, useEffect } from 'react';
import GoalsCard, { DEFAULT_GOALS } from './GoalsCard';
import { addMeal } from '../firebase/mealsService';
import { getNutritionGoals, saveNutritionGoals } from '../firebase/dataService';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';
import './NutritionDashboard.css';

const NutritionCalculator = lazy(() => import('./NutritionCalculator'));
const FoodPhotoAnalyzer = lazy(() => import('./FoodPhotoAnalyzer'));
const CalorieTracker = lazy(() => import('./CalorieTracker'));
const WaterTracker = lazy(() => import('./WaterTracker'));
const ShoppingList = lazy(() => import('./ShoppingList'));
const TrendView = lazy(() => import('./TrendView'));
const ManualQuickEntry = lazy(() => import('./ManualQuickEntry'));
const MealPhotoGallery = lazy(() => import('./MealPhotoGallery'));

// Beslenme merkezindeki tüm sekmeler (kaydırmalı olarak hepsi görünür)
const NUTRITION_TABS = [
  { key: 'tracker', icon: '📝', label: 'Bugün' },
  { key: 'quick-entry', icon: '⌨️', label: 'Toplu Giriş' },
  { key: 'ai-analyzer', icon: '🤖', label: 'AI Foto' },
  { key: 'water', icon: '💧', label: 'Su' },
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
  const [dailyFormRefreshKey, setDailyFormRefreshKey] = useState(0);
  const [showDailyForm, setShowDailyForm] = useState(true);

  // Hesaplayıcıdan gelen sonuçları kaydet
  const handleNutritionResults = (results) => {
    setNutritionResults(results);
    setScopedJson('nutrition_plan', user?.uid, results);
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
    setScopedJson('nutrition_goals', user?.uid, newGoals);
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
    const savedPlan = user ? getScopedJson('nutrition_plan', user.uid, null) : null;
    if (savedPlan) setNutritionResults(savedPlan);
  }, [user]);

  // SABİT hedefleri yükle: önce Firestore, yoksa localStorage, yoksa varsayılan
  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await getNutritionGoals(user.uid);
      if (result.success) {
        setGoals(result.data);
        setScopedJson('nutrition_goals', user.uid, result.data);
        return;
      }
      const saved = getScopedJson('nutrition_goals', user.uid, null);
      setGoals(saved || DEFAULT_GOALS);
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
      mealType: foodData.mealType || 'snack',
      source: 'AI Analiz'
    });

    setShowSuccessMessage(true);
    setSuccessMessage('Yemek bugünkü takibinize eklendi.');
    setTrackerRefreshKey(prev => prev + 1);
    setDailyFormRefreshKey(prev => prev + 1);
    setTimeout(() => {
      setShowSuccessMessage(false);
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
      <Suspense fallback={<div className="nutrition-lazy-loading">Yükleniyor...</div>}>
      <div className="dashboard-content">
        {activeSection === 'tracker' && (
          <div className="section-content">
            <div className="nutrition-today-layout">
              <div className="nutrition-today-main">
                <GoalsCard user={user} goals={goals} onSave={setGoals} />
                <CalorieTracker
                  key={trackerRefreshKey}
                  targetCalories={targetCalories}
                  targetMacros={targetMacros}
                  user={user}
                  onDataChange={() => setDailyFormRefreshKey((prev) => prev + 1)}
                />
              </div>
              <div className="nutrition-today-side">
                <div className="daily-form-launcher primary">
                  <div>
                    <strong>Bugün Girişi</strong>
                    <span>Öğün, su, uyku, Apple Watch aktivite, antrenman ve takviyeyi buradan gir.</span>
                  </div>
                  <button onClick={() => setShowDailyForm((prev) => !prev)}>
                    {showDailyForm ? 'Formu Gizle' : 'Formu Göster'}
                  </button>
                </div>
                <div className={`nutrition-daily-form-body ${showDailyForm ? 'open' : ''}`} aria-hidden={!showDailyForm}>
                  <TrendView
                    user={user}
                    initialRangeKey="day"
                    lockRangeKey="day"
                    embedded
                    key={`today-trend-${dailyFormRefreshKey}`}
                  />
                </div>
              </div>
            </div>
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
          <ManualQuickEntry
            user={user}
            onSaved={() => {
              setTrackerRefreshKey((prev) => prev + 1);
              setDailyFormRefreshKey((prev) => prev + 1);
            }}
          />
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

        {activeSection === 'photo-gallery' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <MealPhotoGallery
              user={user}
              driveAccessToken={driveAccessToken}
            />
          </div>
        )}

        {activeSection === 'daily-log-form' && (
          <div className="section-content">
            <button className="tool-back-btn" onClick={() => setActiveSection('tools')}>← Araçlar</button>
            <TrendView
              user={user}
              initialRangeKey="day"
              lockRangeKey="day"
              embedded
              key={`advanced-trend-${dailyFormRefreshKey}`}
            />
          </div>
        )}
      </div>
      </Suspense>

    </div>
  );
};

export default NutritionDashboard;
