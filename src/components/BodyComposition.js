import React, { useState, useEffect, useRef } from 'react';
import './BodyComposition.css';
import { getBodyComposition, saveBodyComposition } from '../firebase/dataService';

/**
 * BodyComposition - Vücut kompozisyonu analizi
 * - Vücut yağ oranı, iç yağ, kas kütlesi
 * - Metabolik yaş, BMR, vücut suyu
 * - Trend grafikleri
 * - Firestore (giriş yapılınca) + localStorage (offline yedek) ile kalıcı veri
 */

const BodyComposition = ({ user }) => {
  const [compositions, setCompositions] = useState([]);
  const isLoadedRef = useRef(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Kompozisyon alanları
  const compositionFields = [
    { key: 'bodyFat', label: '🧈 Vücut Yağı', icon: '🧈', unit: '%', type: 'percentage', color: '#f59e0b' },
    { key: 'visceralFat', label: '🫀 İç Yağ', icon: '🫀', unit: 'seviye', type: 'level', color: '#ef4444' },
    { key: 'muscleMass', label: '💪 Kas Kütlesi', icon: '💪', unit: 'kg', type: 'weight', color: '#10b981' },
    { key: 'boneMass', label: '🦴 Kemik Kütlesi', icon: '🦴', unit: 'kg', type: 'weight', color: '#6b7280' },
    { key: 'bodyWater', label: '💧 Vücut Suyu', icon: '💧', unit: '%', type: 'percentage', color: '#3b82f6' },
    { key: 'bmr', label: '🔥 BMR', icon: '🔥', unit: 'kcal', type: 'number', color: '#f97316' },
    { key: 'metabolicAge', label: '⏳ Metabolik Yaş', icon: '⏳', unit: 'yaş', type: 'age', color: '#8b5cf6' },
    { key: 'protein', label: '🥩 Protein', icon: '🥩', unit: '%', type: 'percentage', color: '#ec4899' },
    { key: 'subcutaneousFat', label: '🧴 Deri Altı Yağ', icon: '🧴', unit: '%', type: 'percentage', color: '#f59e0b' }
  ];

  const [formData, setFormData] = useState(
    compositionFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {})
  );

  // Yükle - giriş yapılmışsa Firestore (bulut esas kaynak), yoksa localStorage
  useEffect(() => {
    const load = async () => {
      if (user) {
        const result = await getBodyComposition(user.uid);
        if (result.success) {
          setCompositions(result.data.entries || []);
          localStorage.setItem('body_composition', JSON.stringify(result.data.entries || []));
          isLoadedRef.current = true;
          return;
        }
        // Bulutta hiç kayıt yok - localStorage'daki eski veriyi (varsa) buluta taşı
        const saved = localStorage.getItem('body_composition');
        if (saved) {
          try {
            const local = JSON.parse(saved);
            setCompositions(local);
            if (local.length > 0) {
              await saveBodyComposition(user.uid, local);
            }
          } catch (error) {
            console.error('Kompozisyon verileri yüklenirken hata:', error);
          }
        }
        isLoadedRef.current = true;
        return;
      }

      const saved = localStorage.getItem('body_composition');
      if (saved) {
        try {
          setCompositions(JSON.parse(saved));
        } catch (error) {
          console.error('Kompozisyon verileri yüklenirken hata:', error);
        }
      }
      isLoadedRef.current = true;
    };
    load();
  }, [user]);

  // Kaydet - ilk yükleme tamamlanmadan yazma (boş state'in kayıtlı veriyi ezmesini önler)
  useEffect(() => {
    if (!isLoadedRef.current) return;
    localStorage.setItem('body_composition', JSON.stringify(compositions));
    if (user) {
      saveBodyComposition(user.uid, compositions).catch((error) =>
        console.error('Kompozisyon Firestore kayıt hatası:', error)
      );
    }
  }, [compositions, user]);

  // Form input değişimi
  const handleInputChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  // Kompozisyon ekleme
  const handleAddComposition = () => {
    // En az bir değer girilmiş mi kontrol et
    const hasValues = Object.values(formData).some(val => val && parseFloat(val) > 0);
    if (!hasValues) {
      alert('Lütfen en az bir değer girin');
      return;
    }

    const composition = {
      id: Date.now(),
      date: selectedDate,
      timestamp: new Date().toISOString(),
      notes,
      ...compositionFields.reduce((acc, field) => {
        const value = formData[field.key];
        acc[field.key] = value && parseFloat(value) > 0 ? parseFloat(value) : null;
        return acc;
      }, {})
    };

    // Aynı tarihte kayıt varsa güncelle
    const existingIndex = compositions.findIndex(c => c.date === selectedDate);
    if (existingIndex >= 0) {
      const updated = [...compositions];
      updated[existingIndex] = composition;
      setCompositions(updated);
    } else {
      setCompositions([...compositions, composition].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      ));
    }

    // Formu temizle
    setFormData(compositionFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {}));
    setNotes('');
    setShowAddForm(false);
  };

  // Kompozisyon silme
  const deleteComposition = (id) => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      setCompositions(compositions.filter(c => c.id !== id));
    }
  };

  // Değer aralığı ve durum
  const getValueStatus = (field, value) => {
    if (!value) return null;

    // Vücut yağı oranı (erkek/kadın için farklı)
    if (field === 'bodyFat') {
      if (value < 10) return { status: 'low', text: 'Düşük', color: '#3b82f6' };
      if (value < 20) return { status: 'good', text: 'İdeal', color: '#10b981' };
      if (value < 25) return { status: 'normal', text: 'Normal', color: '#f59e0b' };
      return { status: 'high', text: 'Yüksek', color: '#ef4444' };
    }

    // İç yağ seviyesi
    if (field === 'visceralFat') {
      if (value < 10) return { status: 'good', text: 'İdeal', color: '#10b981' };
      if (value < 15) return { status: 'normal', text: 'Normal', color: '#f59e0b' };
      return { status: 'high', text: 'Yüksek', color: '#ef4444' };
    }

    // Vücut suyu
    if (field === 'bodyWater') {
      if (value < 50) return { status: 'low', text: 'Düşük', color: '#ef4444' };
      if (value < 65) return { status: 'good', text: 'İdeal', color: '#10b981' };
      return { status: 'high', text: 'Yüksek', color: '#3b82f6' };
    }

    return null;
  };

  // İlerleme karşılaştırması
  const getComparison = (field) => {
    if (compositions.length < 2) return null;

    const sorted = [...compositions].sort((a, b) => new Date(a.date) - new Date(b.date));
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

  // Ana metrikler
  const mainMetrics = ['bodyFat', 'muscleMass', 'visceralFat', 'bmr'];

  return (
    <div className="body-composition">
      <div className="composition-header">
        <h2>🧬 Vücut Kompozisyonu</h2>
        <button
          className="btn-add-composition"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '❌ İptal' : '➕ Analiz Ekle'}
        </button>
      </div>

      {/* Info Banner */}
      <div className="info-banner">
        <span className="info-icon">ℹ️</span>
        <p>
          Vücut kompozisyonu verileri akıllı terazi veya vücut analiz cihazlarından alınabilir.
          Bu değerler sağlık ve fitness ilerlemenizi takip etmek için önemlidir.
        </p>
      </div>

      {/* Ekleme formu */}
      {showAddForm && (
        <div className="add-composition-form">
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

          <div className="composition-grid">
            {compositionFields.map((field) => (
              <div key={field.key} className="body-composition-form-group">
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

          <div className="body-composition-form-group">
            <label>📝 Notlar (Opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ölçümle ilgili notlar..."
              rows="2"
            />
          </div>

          <button className="body-composition-btn-save" onClick={handleAddComposition}>
            💾 Kaydet
          </button>
        </div>
      )}

      {/* Ana metrik kartları */}
      {compositions.length > 0 && (
        <div className="main-metrics">
          {mainMetrics.map((key) => {
            const field = compositionFields.find(f => f.key === key);
            const latest = compositions[0];
            const comparison = getComparison(key);
            const status = getValueStatus(key, latest[key]);

            if (!latest[key]) return null;

            return (
              <div key={key} className="metric-card-main" style={{ borderLeftColor: field.color }}>
                <span className="metric-icon-large">{field.icon}</span>
                <div className="metric-content-main">
                  <span className="metric-label-main">{field.label.split(' ')[1]}</span>
                  <span className="metric-value-main">
                    {latest[key].toFixed(1)} <span className="unit-text">{field.unit}</span>
                  </span>
                  {status && (
                    <span className="metric-status" style={{ color: status.color }}>
                      {status.text}
                    </span>
                  )}
                  {comparison && (
                    <span className={`metric-change ${comparison.diff > 0 ? 'positive' : comparison.diff < 0 ? 'negative' : ''}`}>
                      {comparison.diff > 0 ? '↑' : comparison.diff < 0 ? '↓' : '→'} {Math.abs(comparison.diff).toFixed(1)} {field.unit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kompozisyon geçmişi */}
      <div className="composition-history">
        <h3>Analiz Geçmişi ({compositions.length})</h3>

        {compositions.length === 0 ? (
          <div className="body-composition-empty-state">
            <span className="empty-icon">🧬</span>
            <p>Henüz vücut kompozisyonu kaydı yok</p>
            <p className="empty-hint">Akıllı terazinizden veya analiz cihazınızdan alınan verileri kaydedin</p>
          </div>
        ) : (
          <div className="composition-list">
            {compositions.map((composition) => (
              <div key={composition.id} className="composition-card">
                <div className="composition-card-header">
                  <div>
                    <h4>📅 {formatDate(composition.date)}</h4>
                    {composition.notes && (
                      <p className="composition-notes">{composition.notes}</p>
                    )}
                  </div>
                  <button
                    className="btn-delete-composition"
                    onClick={() => deleteComposition(composition.id)}
                  >
                    🗑️
                  </button>
                </div>

                <div className="composition-values">
                  {compositionFields.map((field) => {
                    if (!composition[field.key]) return null;
                    const status = getValueStatus(field.key, composition[field.key]);

                    return (
                      <div key={field.key} className="composition-item">
                        <span className="composition-icon">{field.icon}</span>
                        <div className="composition-item-content">
                          <span className="composition-label">{field.label.split(' ')[1]}</span>
                          <div className="composition-value-row">
                            <span className="composition-value">
                              {composition[field.key].toFixed(1)} {field.unit}
                            </span>
                            {status && (
                              <span className="composition-status" style={{ color: status.color }}>
                                {status.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* İpuçları */}
      {compositions.length === 0 && (
        <div className="tips-section">
          <h4>💡 Vücut Kompozisyonu İpuçları</h4>
          <ul>
            <li>Ölçümleri her zaman sabah aç karnına yapın</li>
            <li>Ölçümden önce tuvalete gidin</li>
            <li>Akıllı terazi kullanıyorsanız çıplak ayakla ölçüm yapın</li>
            <li>Ölçümler haftada 1-2 kez yapılmalıdır</li>
            <li>Vücut kompozisyonu kilo kaybından daha önemli bir göstergedir</li>
            <li>İç yağ seviyesi genel sağlık için kritik bir metriktir</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default BodyComposition;
