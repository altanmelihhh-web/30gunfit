import React, { useState } from 'react';
import NutritionCalculator from './NutritionCalculator';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';
import CalorieTracker, { addMealFromAI } from './CalorieTracker';
import WaterTracker from './WaterTracker';
import ShoppingList from './ShoppingList';
import './NutritionDashboard.css';

/**
 * NutritionDashboard - Tüm beslenme özelliklerini birleştiren ana dashboard
 * - Beslenme hesaplayıcı (BMR, TDEE, Makro)
 * - AI fotoğraf analizi
 * - Günlük kalori takibi
 */

const NutritionDashboard = ({ userProfile }) => {
  const [activeSection, setActiveSection] = useState('calculator'); // calculator, tracker, ai-analyzer, water, shopping-list
  const [nutritionResults, setNutritionResults] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [trackerRefreshKey, setTrackerRefreshKey] = useState(0);

  // Hesaplayıcıdan gelen sonuçları kaydet
  const handleNutritionResults = (results) => {
    setNutritionResults(results);
    localStorage.setItem('nutrition_plan', JSON.stringify(results));
  };

  // localStorage'dan yükle
  React.useEffect(() => {
    const savedPlan = localStorage.getItem('nutrition_plan');
    if (savedPlan) {
      setNutritionResults(JSON.parse(savedPlan));
    }
  }, []);

  // AI analizinden yemek ekle
  const handleFoodAnalyzed = (foodData) => {
    console.log('🍽️ NutritionDashboard: handleFoodAnalyzed çağrıldı:', foodData);

    const addedMeal = addMealFromAI(foodData);
    console.log('✅ addMealFromAI sonucu:', addedMeal);

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

      {/* Navigasyon tabları */}
      <div className="nutrition-nav">
        <button
          className={`nav-btn ${activeSection === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveSection('calculator')}
        >
          📊 Hesaplayıcı
        </button>
        <button
          className={`nav-btn ${activeSection === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveSection('tracker')}
        >
          📝 Kalori Takibi
        </button>
        <button
          className={`nav-btn ${activeSection === 'water' ? 'active' : ''}`}
          onClick={() => setActiveSection('water')}
        >
          💧 Su Takibi
        </button>
        <button
          className={`nav-btn ${activeSection === 'ai-analyzer' ? 'active' : ''}`}
          onClick={() => setActiveSection('ai-analyzer')}
        >
          🤖 AI Analiz
        </button>
        <button
          className={`nav-btn ${activeSection === 'shopping-list' ? 'active' : ''}`}
          onClick={() => setActiveSection('shopping-list')}
        >
          🛒 Alışveriş Listesi
        </button>
      </div>

      {/* Başarı mesajı */}
      {showSuccessMessage && (
        <div className="success-message">
          ✅ Yemek başarıyla günlük takibinize eklendi! Kalori Takibi sekmesine yönlendiriliyorsunuz...
        </div>
      )}

      {/* İçerik bölümleri */}
      <div className="dashboard-content">
        {activeSection === 'calculator' && (
          <div className="section-content">
            <NutritionCalculator
              userProfile={userProfile}
              onSaveResults={handleNutritionResults}
            />

            {nutritionResults && (
              <div className="quick-actions">
                <p>✅ Beslenme planınız hazır! Şimdi ne yapmak istersiniz?</p>
                <div className="action-buttons">
                  <button
                    className="action-btn tracker-btn"
                    onClick={() => setActiveSection('tracker')}
                  >
                    📝 Kalori Takibine Başla
                  </button>
                  <button
                    className="action-btn ai-btn"
                    onClick={() => setActiveSection('ai-analyzer')}
                  >
                    🤖 Yemek Fotoğrafı Analiz Et
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'tracker' && (
          <div className="section-content">
            {!nutritionResults ? (
              <div className="no-plan-warning">
                <span className="warning-icon">⚠️</span>
                <h3>Henüz bir beslenme planınız yok</h3>
                <p>Kalori takibi yapabilmek için önce beslenme hesaplayıcıyı kullanarak hedeflerinizi belirleyin.</p>
                <button
                  className="btn-go-calculator"
                  onClick={() => setActiveSection('calculator')}
                >
                  📊 Hesaplayıcıya Git
                </button>
              </div>
            ) : (
              <CalorieTracker
                key={trackerRefreshKey}
                targetCalories={nutritionResults.targetCalories}
                targetMacros={nutritionResults.macros}
              />
            )}
          </div>
        )}

        {activeSection === 'ai-analyzer' && (
          <div className="section-content">
            <FoodPhotoAnalyzer onFoodAnalyzed={handleFoodAnalyzed} />
          </div>
        )}

        {activeSection === 'water' && (
          <div className="section-content">
            <WaterTracker />
          </div>
        )}

        {activeSection === 'shopping-list' && (
          <div className="section-content">
            <ShoppingList />
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
