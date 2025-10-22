import React, { useState, useEffect } from 'react';
import './WeightTracker.css';

/**
 * WeightTracker - Kilo takibi ve görselleştirme
 * - Günlük kilo kaydı
 * - Grafik ile trend gösterimi
 * - İlerleme hesaplama
 */

const WeightTracker = ({ initialWeight }) => {
  const [weightEntries, setWeightEntries] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetWeight, setTargetWeight] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('weight_tracker');
    if (saved) {
      setWeightEntries(JSON.parse(saved));
    }

    const savedTarget = localStorage.getItem('target_weight');
    if (savedTarget) {
      setTargetWeight(savedTarget);
    }
  }, []);

  // localStorage'a kaydet
  useEffect(() => {
    if (weightEntries.length > 0) {
      localStorage.setItem('weight_tracker', JSON.stringify(weightEntries));
    }
  }, [weightEntries]);

  // Hedef kiloya kaydet
  useEffect(() => {
    if (targetWeight) {
      localStorage.setItem('target_weight', targetWeight);
    }
  }, [targetWeight]);

  // Kilo ekleme
  const handleAddWeight = () => {
    if (!newWeight || parseFloat(newWeight) <= 0) {
      alert('Lütfen geçerli bir kilo değeri girin');
      return;
    }

    const entry = {
      id: Date.now(),
      weight: parseFloat(newWeight),
      date: selectedDate,
      timestamp: new Date().toISOString()
    };

    // Aynı tarihte kayıt varsa güncelle, yoksa ekle
    const existingIndex = weightEntries.findIndex(e => e.date === selectedDate);
    if (existingIndex >= 0) {
      const updated = [...weightEntries];
      updated[existingIndex] = entry;
      setWeightEntries(updated);
    } else {
      setWeightEntries([...weightEntries, entry].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
      ));
    }

    setNewWeight('');
    setShowAddForm(false);
  };

  // Kilo silme
  const handleDeleteWeight = (id) => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      setWeightEntries(weightEntries.filter(e => e.id !== id));
    }
  };

  // İstatistikler
  const getStats = () => {
    if (weightEntries.length === 0) {
      return {
        current: initialWeight || 0,
        start: initialWeight || 0,
        change: 0,
        min: 0,
        max: 0,
        avg: 0
      };
    }

    const sorted = [...weightEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const weights = sorted.map(e => e.weight);
    const current = sorted[sorted.length - 1].weight;
    const start = sorted[0].weight;

    return {
      current,
      start,
      change: current - start,
      min: Math.min(...weights),
      max: Math.max(...weights),
      avg: weights.reduce((sum, w) => sum + w, 0) / weights.length
    };
  };

  const stats = getStats();

  // Grafik için normalize değerler (0-100 arası)
  const getNormalizedValues = () => {
    if (weightEntries.length === 0) return [];

    const weights = weightEntries.map(e => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;

    return weightEntries.map(entry => ({
      ...entry,
      normalized: ((entry.weight - min) / range) * 100
    }));
  };

  const normalizedData = getNormalizedValues();

  // Tarih formatla
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Hedef kilo progress
  const getTargetProgress = () => {
    if (!targetWeight || weightEntries.length === 0) return 0;

    const target = parseFloat(targetWeight);
    const start = stats.start;
    const current = stats.current;

    if (target === start) return 100;

    const totalDiff = target - start;
    const currentDiff = current - start;

    return Math.min(Math.round((currentDiff / totalDiff) * 100), 100);
  };

  return (
    <div className="weight-tracker">
      <div className="tracker-header">
        <h2>⚖️ Kilo Takibi</h2>
        <button
          className="btn-add-weight"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '❌ İptal' : '➕ Kilo Ekle'}
        </button>
      </div>

      {/* Kilo ekleme formu */}
      {showAddForm && (
        <div className="add-weight-form">
          <div className="form-row">
            <div className="form-group">
              <label>Tarih</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label>Kilo (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="70.5"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-save" onClick={handleAddWeight}>
            💾 Kaydet
          </button>
        </div>
      )}

      {/* İstatistik kartları */}
      <div className="stats-cards">
        <div className="stat-card primary">
          <span className="stat-icon">📊</span>
          <div className="stat-content">
            <span className="stat-label">Mevcut</span>
            <span className="stat-value">{stats.current.toFixed(1)} kg</span>
          </div>
        </div>

        <div className={`stat-card ${stats.change < 0 ? 'positive' : stats.change > 0 ? 'negative' : ''}`}>
          <span className="stat-icon">{stats.change < 0 ? '📉' : stats.change > 0 ? '📈' : '➖'}</span>
          <div className="stat-content">
            <span className="stat-label">Değişim</span>
            <span className="stat-value">
              {stats.change > 0 ? '+' : ''}{stats.change.toFixed(1)} kg
            </span>
          </div>
        </div>

        {weightEntries.length > 0 && (
          <>
            <div className="stat-card">
              <span className="stat-icon">🎯</span>
              <div className="stat-content">
                <span className="stat-label">Başlangıç</span>
                <span className="stat-value">{stats.start.toFixed(1)} kg</span>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon">📏</span>
              <div className="stat-content">
                <span className="stat-label">Ortalama</span>
                <span className="stat-value">{stats.avg.toFixed(1)} kg</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hedef kilo */}
      <div className="target-weight-section">
        <div className="target-input">
          <label>🎯 Hedef Kilo (kg)</label>
          <input
            type="number"
            step="0.1"
            placeholder="65.0"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
          />
        </div>
        {targetWeight && weightEntries.length > 0 && (
          <div className="target-progress">
            <div className="progress-header">
              <span>İlerleme: {getTargetProgress()}%</span>
              <span>{(parseFloat(targetWeight) - stats.current).toFixed(1)} kg kaldı</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(0, getTargetProgress())}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Grafik */}
      {normalizedData.length > 0 && (
        <div className="weight-chart">
          <h3>Kilo Grafiği</h3>
          <div className="chart-container">
            <div className="chart-y-axis">
              <span>{stats.max.toFixed(1)} kg</span>
              <span>{((stats.max + stats.min) / 2).toFixed(1)} kg</span>
              <span>{stats.min.toFixed(1)} kg</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />

                {/* Hedef çizgisi */}
                {targetWeight && (
                  <line
                    x1="0"
                    y1={100 - ((parseFloat(targetWeight) - stats.min) / (stats.max - stats.min)) * 100}
                    x2="100"
                    y2={100 - ((parseFloat(targetWeight) - stats.min) / (stats.max - stats.min)) * 100}
                    stroke="#22c55e"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                )}

                {/* Çizgi grafiği */}
                <polyline
                  points={normalizedData
                    .map((entry, index) => {
                      const x = (index / (normalizedData.length - 1)) * 100;
                      const y = 100 - entry.normalized;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Alan dolgusu */}
                <polygon
                  points={`
                    0,100
                    ${normalizedData
                      .map((entry, index) => {
                        const x = (index / (normalizedData.length - 1)) * 100;
                        const y = 100 - entry.normalized;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    100,100
                  `}
                  fill="url(#areaGradient)"
                />

                {/* Noktalar */}
                {normalizedData.map((entry, index) => {
                  const x = (index / (normalizedData.length - 1)) * 100;
                  const y = 100 - entry.normalized;
                  return (
                    <circle
                      key={entry.id}
                      cx={x}
                      cy={y}
                      r="2"
                      fill="#6366f1"
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Gradients */}
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.05)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* X ekseni tarihleri */}
          <div className="chart-x-axis">
            {normalizedData.map((entry, index) => {
              // Sadece ilk, son ve bazı ara tarihleri göster
              if (index === 0 || index === normalizedData.length - 1 || index % Math.ceil(normalizedData.length / 5) === 0) {
                return <span key={entry.id}>{formatDate(entry.date)}</span>;
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Kayıtlar listesi */}
      <div className="weight-list">
        <h3>Kayıtlar ({weightEntries.length})</h3>
        {weightEntries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">⚖️</span>
            <p>Henüz kilo kaydı eklenmemiş</p>
          </div>
        ) : (
          <div className="entries">
            {[...weightEntries]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((entry) => (
                <div key={entry.id} className="weight-entry">
                  <div className="entry-info">
                    <span className="entry-date">
                      {new Date(entry.date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="entry-weight">{entry.weight.toFixed(1)} kg</span>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteWeight(entry.id)}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeightTracker;
