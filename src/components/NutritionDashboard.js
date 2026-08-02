import React, { useState, useEffect } from 'react';
import NutritionCalculator from './NutritionCalculator';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';
import CalorieTracker from './CalorieTracker';
import WaterTracker from './WaterTracker';
import ShoppingList from './ShoppingList';
import TrendView from './TrendView';
import DailyLogForm from './DailyLogForm';
import MealPhotoGallery from './MealPhotoGallery';
import GoalsCard, { DEFAULT_GOALS } from './GoalsCard';
import { addMeal } from '../firebase/mealsService';
import { getNutritionGoals } from '../firebase/dataService';
import './NutritionDashboard.css';

// Beslenme merkezindeki tüm sekmeler (kaydırmalı olarak hepsi görünür)
const NUTRITION_TABS = [
  { key: 'tracker', icon: '📝', label: 'Bugün' },
  { key: 'daily-log-form', icon: '📋', label: 'Günlük Form' },
  { key: 'ai-analyzer', icon: '🤖', label: 'AI Foto' },
  { key: 'water', icon: '💧', label: 'Su' },
  { key: 'calculator', icon: '📊', label: 'Hesaplayıcı' },
  { key: 'trends', icon: '📈', label: 'Trend' },
  { key: 'photo-gallery', icon: '📷', label: 'Galeri' },
  { key: 'shopping-list', icon: '🛒', label: 'Alışveriş' }
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
  const [trackerRefreshKey, setTrackerRefreshKey] = useState(0);

  // Hesaplayıcıdan gelen sonuçları kaydet
  const handleNutritionResults = (results) => {
    setNutritionResults(results);
    localStorage.setItem('nutrition_plan', JSON.stringify(results));
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
        <h1>🍎 Beslenme Merkezi</h1>
        <p>Kişiselleştirilmiş beslenme planınızı oluşturun, günlük kalorinizi takip edin</p>
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
          ✅ Yemek başarıyla günlük takibinize eklendi! Bugün sekmesine yönlendiriliyorsunuz...
        </div>
      )}

      {/* İçerik bölümleri */}
      <div className="dashboard-content">
        {activeSection === 'tracker' && (
          <div className="section-content">
            <GoalsCard user={user} goals={goals} onSave={setGoals} />
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

        {activeSection === 'daily-log-form' && (
          <div className="section-content">
            <DailyLogForm
              user={user}
              nutritionResults={{ targetCalories, macros: targetMacros }}
              onSaved={() => setTrackerRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}

        {activeSection === 'calculator' && (
          <div className="section-content">
            <NutritionCalculator
              userProfile={userProfile}
              onSaveResults={handleNutritionResults}
            />
            {nutritionResults && (
              <div className="quick-actions">
                <p>💡 Bu hesaplama önerisini <strong>Bugün → 🎯 Hedeflerim</strong> bölümünden hedeflerine kopyalayabilirsin.</p>
                <div className="action-buttons">
                  <button className="action-btn tracker-btn" onClick={() => setActiveSection('tracker')}>
                    📝 Bugün'e Git
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'shopping-list' && (
          <div className="section-content">
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
            <MealPhotoGallery
              user={user}
              driveAccessToken={driveAccessToken}
              onRequestDriveAccess={onRequestDriveAccess}
            />
          </div>
        )}
      </div>

      {/* Bilgilendirme kartı */}
      <div className="info-card">
        <h4>💡 İpuçları</h4>
        <ul>
          <li>
            <strong>Hesaplayıcı:</strong> Kişisel bilgilerinize göre günlük kalori ve makro hedeflerinizi hesaplayın
          </li>
          <li>
            <strong>Kalori Takibi:</strong> Günlük yediklerinizi kaydedin, hedeflerinize ne kadar yakın olduğunuzu görün
          </li>
          <li>
            <strong>Su Takibi:</strong> Günlük su tüketiminizi takip edin, yeterli hidrasyon için hedeflerinize ulaşın
          </li>
          <li>
            <strong>AI Analiz:</strong> Yemek fotoğrafı yükleyin, yapay zeka kalori ve makroları otomatik hesaplasın
          </li>
          <li>
            <strong>Alışveriş Listesi:</strong> Diyetisyenin haftalık listesini girin, evdekileri işaretleyin, AI ile alternatif malzemeler bulun
          </li>
        </ul>
      </div>
    </div>
  );
};

export default NutritionDashboard;
