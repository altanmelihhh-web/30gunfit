import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ScaleMetrics.css';
import { getScaleMetrics, saveScaleMetrics } from '../firebase/dataService';

const today = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);

const SCALE_FIELDS = [
  { key: 'weightKg', label: 'Ağırlık', unit: 'kg', step: '0.1', min: 20, max: 350 },
  { key: 'bmi', label: 'BMI', unit: '', step: '0.1', min: 5, max: 80 },
  { key: 'bodyFatPercent', label: 'Yağ', unit: '%', step: '0.1', min: 1, max: 80 },
  { key: 'bodyFatWeightPercent', label: 'Vücut Yağı Ağırlığı', unit: '%', step: '0.1', min: 1, max: 80 },
  { key: 'skeletalMuscleMassPercent', label: 'İskelet Kası Kütlesi Yüzdesi', unit: '%', step: '0.1', min: 1, max: 80 },
  { key: 'skeletalMuscleWeightKg', label: 'İskelet Kası Ağırlığı', unit: 'kg', step: '0.1', min: 1, max: 120 },
  { key: 'musclePercent', label: 'Kas', unit: '%', step: '0.1', min: 1, max: 90 },
  { key: 'muscleWeightKg', label: 'Kas Ağırlığı', unit: 'kg', step: '0.1', min: 1, max: 150 },
  { key: 'waterPercent', label: 'Su', unit: '%', step: '0.1', min: 1, max: 90 },
  { key: 'bodyFluidWeightKg', label: 'Vücut Sıvı Ağırlığı', unit: 'kg', step: '0.1', min: 1, max: 120 },
  { key: 'visceralFat', label: 'V-Yağ', unit: '', step: '1', min: 1, max: 40 },
  { key: 'metabolismKcal', label: 'Metabolizma', unit: 'kcal/gün', step: '1', min: 500, max: 5000 },
  { key: 'heightCm', label: 'Boy', unit: 'cm', step: '0.1', min: 80, max: 250 },
  { key: 'realAge', label: 'Gerçek Yaş', unit: '', step: '1', min: 1, max: 120 }
];

const QUICK_FIELDS = ['weightKg', 'bodyFatPercent', 'musclePercent', 'waterPercent', 'visceralFat', 'metabolismKcal'];

const emptyForm = () => SCALE_FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {});

const toNumberOrNull = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const sortEntries = (entries) => [...entries].sort((a, b) => (
  new Date(b.measuredAt || b.timestamp || b.date) - new Date(a.measuredAt || a.timestamp || a.date)
));

const formatValue = (entry, field) => {
  const value = entry?.[field.key];
  if (value == null) return '-';
  const rounded = Number.isInteger(value) ? value : Number(value).toFixed(1);
  return `${rounded}${field.unit ? ` ${field.unit}` : ''}`;
};

const formatDateTime = (entry) => {
  const date = new Date(entry.measuredAt || entry.timestamp || entry.date);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ` · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};

const ScaleMetrics = ({ user }) => {
  const [entries, setEntries] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedTime, setSelectedTime] = useState(nowTime());
  const [notes, setNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chartKey, setChartKey] = useState('weightKg');
  const loadedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      const local = JSON.parse(localStorage.getItem('scale_metrics') || '[]');
      if (!user) {
        setEntries(sortEntries(local));
        loadedRef.current = true;
        return;
      }

      const result = await getScaleMetrics(user.uid);
      if (result.success) {
        const cloud = sortEntries(result.data.entries || []);
        setEntries(cloud);
        localStorage.setItem('scale_metrics', JSON.stringify(cloud));
      } else {
        setEntries(sortEntries(local));
        if (local.length) await saveScaleMetrics(user.uid, sortEntries(local));
      }
      loadedRef.current = true;
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!loadedRef.current) return;
    localStorage.setItem('scale_metrics', JSON.stringify(entries));
    if (user) {
      saveScaleMetrics(user.uid, entries).catch((error) =>
        console.error('Tartı verisi Firestore kayıt hatası:', error)
      );
    }
  }, [entries, user]);

  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const latest = sorted[0] || null;
  const oldest = sorted[sorted.length - 1] || null;
  const chartField = SCALE_FIELDS.find((field) => field.key === chartKey) || SCALE_FIELDS[0];

  const chartData = useMemo(() => {
    const data = [...entries]
      .filter((entry) => entry[chartField.key] != null)
      .sort((a, b) => new Date(a.measuredAt || a.timestamp || a.date) - new Date(b.measuredAt || b.timestamp || b.date));
    if (!data.length) return [];
    const values = data.map((entry) => Number(entry[chartField.key]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return data.map((entry, index) => ({
      ...entry,
      x: data.length === 1 ? 50 : (index / (data.length - 1)) * 100,
      y: 100 - (((Number(entry[chartField.key]) - min) / range) * 80 + 10),
      value: Number(entry[chartField.key]),
      min,
      max
    }));
  }, [entries, chartField]);

  const comparison = (key) => {
    if (!latest || !oldest || latest[key] == null || oldest[key] == null || latest.id === oldest.id) return null;
    const diff = Number(latest[key]) - Number(oldest[key]);
    return diff;
  };

  const handleInput = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdd = () => {
    const values = SCALE_FIELDS.reduce((acc, field) => {
      acc[field.key] = toNumberOrNull(formData[field.key]);
      return acc;
    }, {});
    const hasValue = Object.values(values).some((value) => value != null);
    if (!hasValue) {
      alert('En az bir tartı değeri gir.');
      return;
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: selectedDate,
      measuredAt: `${selectedDate}T${selectedTime || '00:00'}:00`,
      timestamp: new Date().toISOString(),
      notes: notes.trim(),
      ...values
    };
    setEntries((prev) => sortEntries([entry, ...prev]));
    setFormData(emptyForm());
    setNotes('');
    setSelectedTime(nowTime());
    setShowAddForm(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bu tartı kaydını silmek istediğine emin misin?')) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  };

  const statFields = QUICK_FIELDS.map((key) => SCALE_FIELDS.find((field) => field.key === key)).filter(Boolean);
  const chartPath = chartData.map((point) => `${point.x},${point.y}`).join(' ');
  const chartArea = chartData.length ? `0,100 ${chartPath} 100,100` : '';

  return (
    <div className="scale-metrics">
      <div className="scale-header">
        <div>
          <h2>⚖️ Tartı Verileri</h2>
          <p>OKOK gibi tartı uygulamalarından gelen ölçümleri ayrı geçmiş olarak saklar.</p>
        </div>
        <button className="scale-add-btn" onClick={() => setShowAddForm((value) => !value)}>
          {showAddForm ? 'İptal' : 'Tartı Verisi Ekle'}
        </button>
      </div>

      {showAddForm && (
        <div className="scale-form">
          <div className="scale-form-top">
            <label>
              Tarih
              <input type="date" value={selectedDate} max={today()} onChange={(e) => setSelectedDate(e.target.value)} />
            </label>
            <label>
              Saat
              <input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
            </label>
          </div>
          <div className="scale-form-grid">
            {SCALE_FIELDS.map((field) => (
              <label key={field.key}>
                {field.label}
                <span>
                  <input
                    type="number"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    value={formData[field.key]}
                    onChange={(e) => handleInput(field.key, e.target.value)}
                    placeholder="0"
                  />
                  {field.unit && <small>{field.unit}</small>}
                </span>
              </label>
            ))}
          </div>
          <label className="scale-notes">
            Not
            <textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} placeholder="Örn: sabah aç karnına, antrenman sonrası..." />
          </label>
          <button className="scale-save-btn" onClick={handleAdd}>Kaydet</button>
        </div>
      )}

      {latest && (
        <div className="scale-stat-grid">
          {statFields.map((field) => {
            const diff = comparison(field.key);
            return latest[field.key] == null ? null : (
              <div key={field.key} className="scale-stat-card">
                <span>{field.label}</span>
                <strong>{formatValue(latest, field)}</strong>
                {diff != null && (
                  <small className={diff < 0 ? 'down' : diff > 0 ? 'up' : ''}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)} {field.unit} ilk kayda göre
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="scale-chart-card">
          <div className="scale-chart-head">
            <h3>Eğilim Grafiği</h3>
            <select value={chartKey} onChange={(e) => setChartKey(e.target.value)}>
              {SCALE_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
          </div>
          {chartData.length ? (
            <>
              <div className="scale-chart">
                <div className="scale-y-axis">
                  <span>{chartData[0].max.toFixed(1)}{chartField.unit}</span>
                  <span>{chartData[0].min.toFixed(1)}{chartField.unit}</span>
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
                  <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
                  <polygon points={chartArea} fill="rgba(20, 184, 166, 0.12)" />
                  <polyline points={chartPath} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {chartData.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="2.2" fill="#0f766e" stroke="#fff" strokeWidth="1" />)}
                </svg>
              </div>
              <div className="scale-chart-foot">
                <span>{formatDateTime(chartData[0]).split(' · ')[0]}</span>
                <span>{formatDateTime(chartData[chartData.length - 1]).split(' · ')[0]}</span>
              </div>
            </>
          ) : (
            <p className="scale-empty-line">Bu metrik için henüz veri yok.</p>
          )}
        </div>
      )}

      <div className="scale-history">
        <div className="scale-history-head">
          <h3>Geçmiş ({entries.length})</h3>
          {entries.length > 0 && (
            <button className="scale-history-toggle" onClick={() => setShowHistory((value) => !value)}>
              {showHistory ? 'Geçmişi Gizle' : 'Geçmişi Göster'}
            </button>
          )}
        </div>
        {!entries.length ? (
          <div className="scale-empty">
            <strong>Henüz tartı verisi yok</strong>
            <span>OKOK ölçümünü buraya ekleyince tüm kayıtlar zaman sırasıyla tutulur.</span>
          </div>
        ) : showHistory ? (
          <div className="scale-entry-list">
            {sorted.map((entry) => (
              <div key={entry.id} className="scale-entry">
                <div className="scale-entry-head">
                  <div>
                    <strong>{formatDateTime(entry)}</strong>
                    {entry.notes && <p>{entry.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(entry.id)} title="Sil">Sil</button>
                </div>
                <div className="scale-entry-values">
                  {SCALE_FIELDS.map((field) => entry[field.key] == null ? null : (
                    <span key={field.key}>
                      <small>{field.label}</small>
                      <strong>{formatValue(entry, field)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="scale-empty">
            <strong>Son kayıt: {formatDateTime(sorted[0])}</strong>
            <span>Tüm ölçümleri açmak için Geçmişi Göster’e bas.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export { SCALE_FIELDS };
export default ScaleMetrics;
