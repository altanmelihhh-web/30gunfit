import React, { useState, useEffect, useCallback } from 'react';
import './MealPhotoGallery.css';
import { getCalorieTrackingRange } from '../firebase/dataService';
import { fetchDriveImageUrl } from '../utils/driveService';

const DAYS_TO_LOAD = 30;

const getRecentDates = (days) => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const MealPhotoGallery = ({ user, driveAccessToken, onRequestDriveAccess }) => {
  const [loading, setLoading] = useState(false);
  const [mealsWithPhotos, setMealsWithPhotos] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [failedIds, setFailedIds] = useState({});

  const loadMeals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dates = getRecentDates(DAYS_TO_LOAD);
      const data = await getCalorieTrackingRange(user.uid, dates);
      const found = [];
      dates.forEach((date) => {
        (data[date]?.meals || []).forEach((meal) => {
          if (meal.photoDriveId) {
            found.push({ ...meal, date });
          }
        });
      });
      setMealsWithPhotos(found);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    if (!driveAccessToken) return;
    mealsWithPhotos.forEach((meal) => {
      const key = meal.photoDriveId;
      if (imageUrls[key] || failedIds[key]) return;
      fetchDriveImageUrl(driveAccessToken, key)
        .then((url) => setImageUrls((prev) => ({ ...prev, [key]: url })))
        .catch(() => setFailedIds((prev) => ({ ...prev, [key]: true })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsWithPhotos, driveAccessToken]);

  if (!user) {
    return <div className="meal-gallery"><p>Galeriyi görmek için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className="meal-gallery">
      <div className="meal-gallery-header">
        <h3>📷 Yemek Galerisi</h3>
        <p>Son {DAYS_TO_LOAD} günde fotoğrafla eklediğin öğünler (Google Drive'ında saklanıyor)</p>
      </div>

      {!driveAccessToken && (
        <div className="meal-gallery-drive-warning">
          ⚠️ Drive bağlantın yok veya süresi dolmuş, fotoğraflar yüklenemiyor.
          <button onClick={onRequestDriveAccess}>Drive'a bağlan</button>
        </div>
      )}

      {loading ? (
        <p>Yükleniyor...</p>
      ) : mealsWithPhotos.length === 0 ? (
        <p className="meal-gallery-empty">Henüz fotoğraflı öğün yok. AI Günlük Giriş'te fotoğraf ekleyip kaydettiğinde burada görünecek.</p>
      ) : (
        <div className="meal-gallery-grid">
          {mealsWithPhotos.map((meal) => (
            <div key={meal.id} className="meal-gallery-card">
              <div className="meal-gallery-image">
                {imageUrls[meal.photoDriveId] ? (
                  <img src={imageUrls[meal.photoDriveId]} alt={meal.name} />
                ) : failedIds[meal.photoDriveId] ? (
                  <div className="meal-gallery-placeholder">🔒 Görüntülenemedi</div>
                ) : (
                  <div className="meal-gallery-placeholder">⏳</div>
                )}
              </div>
              <div className="meal-gallery-info">
                <span className="meal-gallery-name">{meal.name}</span>
                <span className="meal-gallery-meta">{formatDate(meal.date)} · {Math.round(meal.calories)} kcal</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MealPhotoGallery;
