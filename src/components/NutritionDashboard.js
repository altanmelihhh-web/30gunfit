import React, { useState } from 'react';
import NutritionCalculator from './NutritionCalculator';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';
import CalorieTracker, { addMealFromAI } from './CalorieTracker';
import WaterTracker from './WaterTracker';
import ShoppingList from './ShoppingList';
import AIDailyLog from './AIDailyLog';
import TrendView from './TrendView';
import ManualQuickEntry from './ManualQuickEntry';
import MealPhotoGallery from './MealPhotoGallery';
import { saveDailyCalories } from '../firebase/dataService';
import './NutritionDashboard.css';

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
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [trackerRefreshKey, setTrackerRefreshKey] = useState(0);

  const ADD_SECTIONS = ['ai-analyzer', 'ai-daily-log', 'manual-entry'];
  const MORE_SECTIONS = ['calculator', 'trends', 'photo-gallery', 'shopping-list'];

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
  const handleFoodAnalyzed = async (foodData) => {
    addMealFromAI(foodData);

    // Giriş yapmışsa, güncellenmiş günün tamamını Firestore'a da yaz
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const allTrackerData = JSON.parse(localStorage.getItem('calorie_tracker') || '{}');
      await saveDailyCalories(user.uid, today, allTrackerData[today] || []);
    }

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

      {/* Navigasyon - 4 ana hedef, ikincil özellikler "Ekle" ve "Daha Fazla" menülerinde */}
      <div className="nutrition-nav">
        <button
          className={`nav-btn ${activeSection === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveSection('tracker')}
        >
          <span className="nav-btn-icon">📝</span>
          <span className="nav-btn-label">Bugün</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'water' ? 'active' : ''}`}
          onClick={() => setActiveSection('water')}
        >
          <span className="nav-btn-icon">💧</span>
          <span className="nav-btn-label">Su</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'add-menu' || ADD_SECTIONS.includes(activeSection) ? 'active' : ''}`}
          onClick={() => setActiveSection('add-menu')}
        >
          <span className="nav-btn-icon">➕</span>
          <span className="nav-btn-label">Ekle</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'more-menu' || MORE_SECTIONS.includes(activeSection) ? 'active' : ''}`}
          onClick={() => setActiveSection('more-menu')}
        >
          <span className="nav-btn-icon">☰</span>
          <span className="nav-btn-label">Diğer</span>
        </button>
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
                user={user}
              />
            )}
          </div>
        )}

        {activeSection === 'water' && (
          <div className="section-content">
            <WaterTracker user={user} />
          </div>
        )}

        {/* "Ekle" menüsü - yemek/günlük giriş yöntemleri arasından seçim */}
        {activeSection === 'add-menu' && (
          <div className="section-content">
            <div className="more-menu">
              <button className="more-menu-item" onClick={() => setActiveSection('ai-analyzer')}>
                <span className="more-menu-icon">🤖</span>
                <span className="more-menu-text">
                  <strong>AI Fotoğraf Analizi</strong>
                  <small>Yemek fotoğrafı çek, AI kalori/makro hesaplasın</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
              <button className="more-menu-item" onClick={() => setActiveSection('ai-daily-log')}>
                <span className="more-menu-icon">🤖</span>
                <span className="more-menu-text">
                  <strong>AI Günlük Giriş</strong>
                  <small>Serbest metin veya ekran görüntüsü yapıştır, AI ayırsın</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
              <button className="more-menu-item" onClick={() => setActiveSection('manual-entry')}>
                <span className="more-menu-icon">⌨️</span>
                <span className="more-menu-text">
                  <strong>Hızlı Giriş</strong>
                  <small>Anahtar kelimeyle kendin yaz, AI'ya hiç gitmez</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
            </div>
          </div>
        )}

        {activeSection === 'ai-analyzer' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('add-menu')}>‹ Ekle</button>
            <FoodPhotoAnalyzer onFoodAnalyzed={handleFoodAnalyzed} />
          </div>
        )}

        {activeSection === 'ai-daily-log' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('add-menu')}>‹ Ekle</button>
            <AIDailyLog
              user={user}
              driveAccessToken={driveAccessToken}
              onRequestDriveAccess={onRequestDriveAccess}
              onSaved={() => setTrackerRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}

        {activeSection === 'manual-entry' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('add-menu')}>‹ Ekle</button>
            <ManualQuickEntry user={user} onSaved={() => setTrackerRefreshKey((prev) => prev + 1)} />
          </div>
        )}

        {/* "Daha Fazla" menüsü - ikincil özellikler */}
        {activeSection === 'more-menu' && (
          <div className="section-content">
            <div className="more-menu">
              <button className="more-menu-item" onClick={() => setActiveSection('calculator')}>
                <span className="more-menu-icon">📊</span>
                <span className="more-menu-text">
                  <strong>Hesaplayıcı</strong>
                  <small>Günlük kalori ve makro hedeflerinizi belirleyin</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
              <button className="more-menu-item" onClick={() => setActiveSection('trends')}>
                <span className="more-menu-icon">📈</span>
                <span className="more-menu-text">
                  <strong>Trend</strong>
                  <small>Geçmiş günlerin özeti ve grafikleri</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
              <button className="more-menu-item" onClick={() => setActiveSection('photo-gallery')}>
                <span className="more-menu-icon">📷</span>
                <span className="more-menu-text">
                  <strong>Yemek Galerisi</strong>
                  <small>Kaydedilen yemek fotoğrafları</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
              <button className="more-menu-item" onClick={() => setActiveSection('shopping-list')}>
                <span className="more-menu-icon">🛒</span>
                <span className="more-menu-text">
                  <strong>Alışveriş Listesi</strong>
                  <small>Haftalık listeni işaretle, AI ile alternatif bul</small>
                </span>
                <span className="more-menu-arrow">›</span>
              </button>
            </div>
          </div>
        )}

        {activeSection === 'calculator' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('more-menu')}>‹ Daha Fazla</button>
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

        {activeSection === 'shopping-list' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('more-menu')}>‹ Daha Fazla</button>
            <ShoppingList />
          </div>
        )}

        {activeSection === 'trends' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('more-menu')}>‹ Daha Fazla</button>
            <TrendView user={user} />
          </div>
        )}

        {activeSection === 'photo-gallery' && (
          <div className="section-content">
            <button className="more-back-btn" onClick={() => setActiveSection('more-menu')}>‹ Daha Fazla</button>
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
