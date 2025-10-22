import React, { useState, useEffect } from 'react';
import './WaterTracker.css';

/**
 * WaterTracker - Günlük su tüketimi takibi
 * - Hızlı ekleme butonları (bardak boyutları)
 * - Günlük hedef ve ilerleme
 * - Günlük/haftalık istatistikler
 * - localStorage ile kalıcı veri
 */

const WaterTracker = () => {
  const [dailyGoal, setDailyGoal] = useState(2500); // ml cinsinden varsayılan hedef
  const [waterEntries, setWaterEntries] = useState([]);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Bardak boyutları (ml)
  const glassSize = [
    { label: '🥛 Küçük', amount: 200, icon: '🥛' },
    { label: '💧 Bardak', amount: 250, icon: '💧' },
    { label: '🥤 Büyük', amount: 500, icon: '🥤' },
    { label: '🍶 Şişe', amount: 1000, icon: '🍶' }
  ];

  // localStorage'dan yükle
  useEffect(() => {
    const savedEntries = localStorage.getItem('water_tracker');
    if (savedEntries) {
      setWaterEntries(JSON.parse(savedEntries));
    }

    const savedGoal = localStorage.getItem('daily_water_goal');
    if (savedGoal) {
      setDailyGoal(parseInt(savedGoal));
    }
  }, []);

  // localStorage'a kaydet
  useEffect(() => {
    if (waterEntries.length > 0) {
      localStorage.setItem('water_tracker', JSON.stringify(waterEntries));
    }
  }, [waterEntries]);

  // Hedefi kaydet
  useEffect(() => {
    localStorage.setItem('daily_water_goal', dailyGoal.toString());
  }, [dailyGoal]);

  // Su ekleme
  const addWater = (amount) => {
    const entry = {
      id: Date.now(),
      amount: parseInt(amount),
      date: selectedDate,
      timestamp: new Date().toISOString()
    };

    setWaterEntries([...waterEntries, entry].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    ));

    setCustomAmount('');
    setShowCustomInput(false);
  };

  // Özel miktarla ekle
  const handleAddCustom = () => {
    if (!customAmount || parseInt(customAmount) <= 0) {
      alert('Lütfen geçerli bir miktar girin');
      return;
    }
    addWater(customAmount);
  };

  // Kayıt silme
  const deleteEntry = (id) => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      setWaterEntries(waterEntries.filter(e => e.id !== id));
    }
  };

  // Seçili tarih için toplam su tüketimi
  const getTodayTotal = () => {
    return waterEntries
      .filter(e => e.date === selectedDate)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // İlerleme yüzdesi
  const getProgress = () => {
    const total = getTodayTotal();
    return Math.min(Math.round((total / dailyGoal) * 100), 100);
  };

  // Haftalık ortalama
  const getWeeklyAverage = () => {
    const today = new Date(selectedDate);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const weekEntries = waterEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= sevenDaysAgo && entryDate <= today;
    });

    if (weekEntries.length === 0) return 0;

    // Günlük toplam hesapla
    const dailyTotals = {};
    weekEntries.forEach(entry => {
      if (!dailyTotals[entry.date]) {
        dailyTotals[entry.date] = 0;
      }
      dailyTotals[entry.date] += entry.amount;
    });

    const totalAmount = Object.values(dailyTotals).reduce((sum, amount) => sum + amount, 0);
    const dayCount = Object.keys(dailyTotals).length;

    return Math.round(totalAmount / dayCount);
  };

  // Bugünün kayıtları
  const todayEntries = waterEntries.filter(e => e.date === selectedDate);
  const todayTotal = getTodayTotal();
  const progressPercent = getProgress();
  const weeklyAvg = getWeeklyAverage();

  // Tarih formatla
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Motivasyon mesajı
  const getMotivationMessage = () => {
    const percent = progressPercent;
    if (percent >= 100) return '🎉 Harika! Günlük hedefinize ulaştınız!';
    if (percent >= 75) return '💪 Çok iyi gidiyorsun! Birazcık daha!';
    if (percent >= 50) return '👍 Yarı yoldasın! Devam et!';
    if (percent >= 25) return '⭐ Güzel başlangıç! Yolun daha çok var!';
    return '🚀 Hadi başlayalım! İlk bardağını iç!';
  };

  return (
    <div className="water-tracker">
      <div className="tracker-header">
        <h2>💧 Su Takibi</h2>
        <div className="date-selector">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Günlük hedef ayarı */}
      <div className="goal-section">
        <div className="goal-input">
          <label>🎯 Günlük Hedef (ml)</label>
          <input
            type="number"
            step="100"
            value={dailyGoal}
            onChange={(e) => setDailyGoal(parseInt(e.target.value) || 0)}
            min="500"
            max="10000"
          />
        </div>
      </div>

      {/* İlerleme göstergesi */}
      <div className="progress-section">
        <div className="progress-info">
          <div className="progress-main">
            <span className="progress-amount">{todayTotal} ml</span>
            <span className="progress-separator">/</span>
            <span className="progress-goal">{dailyGoal} ml</span>
          </div>
          <span className="progress-percent">{progressPercent}%</span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="motivation-message">{getMotivationMessage()}</p>
      </div>

      {/* İstatistikler */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-label">Haftalık Ort.</span>
            <span className="stat-value">{weeklyAvg} ml</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💧</span>
          <div className="stat-info">
            <span className="stat-label">Bugün</span>
            <span className="stat-value">{todayEntries.length} kayıt</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🏆</span>
          <div className="stat-info">
            <span className="stat-label">Durum</span>
            <span className="stat-value">
              {progressPercent >= 100 ? 'Tamamlandı' : progressPercent >= 75 ? 'Yakın' : 'Devam'}
            </span>
          </div>
        </div>
      </div>

      {/* Hızlı ekleme butonları */}
      <div className="quick-add-section">
        <h3>Hızlı Ekle</h3>
        <div className="glass-buttons">
          {glassSize.map((glass) => (
            <button
              key={glass.amount}
              className="glass-btn"
              onClick={() => addWater(glass.amount)}
            >
              <span className="glass-icon">{glass.icon}</span>
              <span className="glass-label">{glass.label}</span>
              <span className="glass-amount">{glass.amount} ml</span>
            </button>
          ))}
        </div>

        {/* Özel miktar */}
        <div className="custom-add">
          {!showCustomInput ? (
            <button
              className="btn-custom"
              onClick={() => setShowCustomInput(true)}
            >
              ➕ Özel Miktar
            </button>
          ) : (
            <div className="custom-input-group">
              <input
                type="number"
                placeholder="Miktar (ml)"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min="1"
                autoFocus
              />
              <button className="btn-add" onClick={handleAddCustom}>
                Ekle
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomAmount('');
                }}
              >
                İptal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kayıt listesi */}
      <div className="entries-section">
        <h3>Bugünün Kayıtları ({todayEntries.length})</h3>
        {todayEntries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💧</span>
            <p>Henüz su kaydı yok</p>
            <p className="empty-hint">Yukarıdaki butonlarla su tüketiminizi kaydedin</p>
          </div>
        ) : (
          <div className="entries-list">
            {todayEntries.map((entry) => (
              <div key={entry.id} className="entry-item">
                <div className="entry-time">
                  <span className="time-icon">🕐</span>
                  <span>{formatTime(entry.timestamp)}</span>
                </div>
                <div className="entry-amount">
                  <span className="amount-value">{entry.amount} ml</span>
                </div>
                <button
                  className="btn-delete-entry"
                  onClick={() => deleteEntry(entry.id)}
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Günlük ipuçları */}
      <div className="tips-section">
        <h4>💡 Su İçme İpuçları</h4>
        <ul>
          <li>Güne 1-2 bardak su içerek başlayın</li>
          <li>Her öğün öncesi bir bardak su için</li>
          <li>Egzersiz sırasında ve sonrasında bol su için</li>
          <li>Susuzluk hissetmeden düzenli aralıklarla su için</li>
        </ul>
      </div>
    </div>
  );
};

export default WaterTracker;
