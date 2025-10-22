import React, { useState, useEffect } from 'react';
import './BodyMeasurements.css';

/**
 * BodyMeasurements - Vücut ölçüleri takibi
 * - Kol, bacak, göğüs, bel, kalça, boyun, omuz ölçüleri
 * - Grafik ile trend gösterimi
 * - Ölçü karşılaştırma
 * - localStorage ile kalıcı veri
 */

const BodyMeasurements = () => {
  const [measurements, setMeasurements] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Ölçüm alanları (cm cinsinden)
  const measurementFields = [
    { key: 'chest', label: '💪 Göğüs', icon: '💪', unit: 'cm' },
    { key: 'waist', label: '⭕ Bel', icon: '⭕', unit: 'cm' },
    { key: 'hips', label: '🍑 Kalça', icon: '🍑', unit: 'cm' },
    { key: 'rightArm', label: '💪 Sağ Kol', icon: '💪', unit: 'cm' },
    { key: 'leftArm', label: '💪 Sol Kol', icon: '💪', unit: 'cm' },
    { key: 'rightThigh', label: '🦵 Sağ Uyluk', icon: '🦵', unit: 'cm' },
    { key: 'leftThigh', label: '🦵 Sol Uyluk', icon: '🦵', unit: 'cm' },
    { key: 'rightCalf', label: '🦵 Sağ Baldır', icon: '🦵', unit: 'cm' },
    { key: 'leftCalf', label: '🦵 Sol Baldır', icon: '🦵', unit: 'cm' },
    { key: 'neck', label: '👔 Boyun', icon: '👔', unit: 'cm' },
    { key: 'shoulders', label: '💪 Omuz', icon: '💪', unit: 'cm' },
    { key: 'forearm', label: '💪 Ön Kol', icon: '💪', unit: 'cm' }
  ];

  const [formData, setFormData] = useState(
    measurementFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {})
  );

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('body_measurements');
    if (saved) {
      try {
        setMeasurements(JSON.parse(saved));
      } catch (error) {
        console.error('Ölçüler yüklenirken hata:', error);
      }
    }
  }, []);

  // localStorage'a kaydet
  useEffect(() => {
    if (measurements.length > 0) {
      localStorage.setItem('body_measurements', JSON.stringify(measurements));
    }
  }, [measurements]);

  // Form input değişimi
  const handleInputChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  // Ölçüm ekleme
  const handleAddMeasurement = () => {
    // En az bir değer girilmiş mi kontrol et
    const hasValues = Object.values(formData).some(val => val && parseFloat(val) > 0);
    if (!hasValues) {
      alert('Lütfen en az bir ölçü değeri girin');
      return;
    }

    const measurement = {
      id: Date.now(),
      date: selectedDate,
      timestamp: new Date().toISOString(),
      notes,
      ...measurementFields.reduce((acc, field) => {
        const value = formData[field.key];
        acc[field.key] = value && parseFloat(value) > 0 ? parseFloat(value) : null;
        return acc;
      }, {})
    };

    // Aynı tarihte kayıt varsa güncelle
    const existingIndex = measurements.findIndex(m => m.date === selectedDate);
    if (existingIndex >= 0) {
      const updated = [...measurements];
      updated[existingIndex] = measurement;
      setMeasurements(updated);
    } else {
      setMeasurements([...measurements, measurement].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      ));
    }

    // Formu temizle
    setFormData(measurementFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {}));
    setNotes('');
    setShowAddForm(false);
  };

  // Ölçüm silme
  const deleteMeasurement = (id) => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      setMeasurements(measurements.filter(m => m.id !== id));
    }
  };

  // En son ve ilk ölçüm karşılaştırması
  const getComparison = (field) => {
    if (measurements.length < 2) return null;

    const sorted = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first[field] || !last[field]) return null;

    const diff = last[field] - first[field];
    return {
      first: first[field],
      last: last[field],
      diff: diff,
      percent: ((diff / first[field]) * 100).toFixed(1)
    };
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // İstatistik kartları için ana ölçümler
  const mainMeasurements = ['chest', 'waist', 'hips', 'rightArm'];

  return (
    <div className="body-measurements">
      <div className="measurements-header">
        <h2>📏 Vücut Ölçüleri</h2>
        <button
          className="btn-add-measurement"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '❌ İptal' : '➕ Ölçü Ekle'}
        </button>
      </div>

      {/* Ekleme formu */}
      {showAddForm && (
        <div className="add-measurement-form">
          <div className="form-header">
            <div className="form-group-inline">
              <label>📅 Tarih</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="measurements-grid">
            {measurementFields.map((field) => (
              <div key={field.key} className="form-group">
                <label>{field.label}</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={formData[field.key]}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                  />
                  <span className="unit">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label>📝 Notlar (Opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ölçümle ilgili notlar..."
              rows="2"
            />
          </div>

          <button className="btn-save" onClick={handleAddMeasurement}>
            💾 Kaydet
          </button>
        </div>
      )}

      {/* Ana ölçüm kartları */}
      {measurements.length > 0 && (
        <div className="main-stats">
          {mainMeasurements.map((key) => {
            const field = measurementFields.find(f => f.key === key);
            const latest = measurements[0];
            const comparison = getComparison(key);

            if (!latest[key]) return null;

            return (
              <div key={key} className="stat-card-main">
                <span className="stat-icon-large">{field.icon}</span>
                <div className="stat-content-main">
                  <span className="stat-label-main">{field.label.split(' ')[1]}</span>
                  <span className="stat-value-main">
                    {latest[key].toFixed(1)} <span className="unit-text">{field.unit}</span>
                  </span>
                  {comparison && (
                    <span className={`stat-change ${comparison.diff > 0 ? 'positive' : comparison.diff < 0 ? 'negative' : ''}`}>
                      {comparison.diff > 0 ? '↑' : comparison.diff < 0 ? '↓' : '→'} {Math.abs(comparison.diff).toFixed(1)} cm
                      ({comparison.diff > 0 ? '+' : ''}{comparison.percent}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ölçüm geçmişi */}
      <div className="measurements-history">
        <h3>Ölçüm Geçmişi ({measurements.length})</h3>

        {measurements.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📏</span>
            <p>Henüz ölçüm kaydı yok</p>
            <p className="empty-hint">Vücut ölçülerinizi takip etmeye başlayın</p>
          </div>
        ) : (
          <div className="measurements-list">
            {measurements.map((measurement) => (
              <div key={measurement.id} className="measurement-card">
                <div className="measurement-card-header">
                  <div>
                    <h4>📅 {formatDate(measurement.date)}</h4>
                    {measurement.notes && (
                      <p className="measurement-notes">{measurement.notes}</p>
                    )}
                  </div>
                  <button
                    className="btn-delete-measurement"
                    onClick={() => deleteMeasurement(measurement.id)}
                  >
                    🗑️
                  </button>
                </div>

                <div className="measurement-values">
                  {measurementFields.map((field) => {
                    if (!measurement[field.key]) return null;
                    return (
                      <div key={field.key} className="measurement-item">
                        <span className="measurement-icon">{field.icon}</span>
                        <span className="measurement-label">{field.label.split(' ')[1]}</span>
                        <span className="measurement-value">
                          {measurement[field.key].toFixed(1)} {field.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Karşılaştırma bölümü */}
      {measurements.length >= 2 && (
        <div className="comparison-section">
          <h3>📊 İlerleme Karşılaştırması</h3>
          <p className="comparison-subtitle">
            İlk ölçüm: {formatDate(measurements[measurements.length - 1].date)} →
            Son ölçüm: {formatDate(measurements[0].date)}
          </p>

          <div className="comparison-grid">
            {measurementFields.map((field) => {
              const comparison = getComparison(field.key);
              if (!comparison) return null;

              return (
                <div key={field.key} className="comparison-card">
                  <div className="comparison-header">
                    <span className="comparison-icon">{field.icon}</span>
                    <span className="comparison-label">{field.label.split(' ')[1]}</span>
                  </div>
                  <div className="comparison-values">
                    <div className="comparison-value-item">
                      <span className="comparison-value-label">Başlangıç</span>
                      <span className="comparison-value">{comparison.first.toFixed(1)} cm</span>
                    </div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value-item">
                      <span className="comparison-value-label">Şimdi</span>
                      <span className="comparison-value">{comparison.last.toFixed(1)} cm</span>
                    </div>
                  </div>
                  <div className={`comparison-diff ${comparison.diff > 0 ? 'positive' : comparison.diff < 0 ? 'negative' : 'neutral'}`}>
                    {comparison.diff > 0 ? '↑' : comparison.diff < 0 ? '↓' : '→'}
                    {Math.abs(comparison.diff).toFixed(1)} cm
                    ({comparison.diff > 0 ? '+' : ''}{comparison.percent}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* İpuçları */}
      {measurements.length === 0 && (
        <div className="tips-section">
          <h4>💡 Ölçüm İpuçları</h4>
          <ul>
            <li>Ölçümleri her zaman aynı günün aynı saatinde yapın (tercihen sabah)</li>
            <li>Ölçüm bandı cildinize sıkı ama acıtmayacak şekilde tutun</li>
            <li>Göğüs ölçümünü göğsün en geniş noktasından alın</li>
            <li>Bel ölçümünü göbek hizasından alın</li>
            <li>Kol ölçümünü kolun en geniş noktasından (biceps) alın</li>
            <li>Ölçümleri ayda 1-2 kez tekrarlayın</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default BodyMeasurements;
