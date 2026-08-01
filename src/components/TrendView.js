import React, { useState, useEffect, useCallback } from 'react';
import './TrendView.css';
import { getCalorieTrackingRange, getDailyLogsRange, getWaterTracker, saveDailyLog, getDailyLog } from '../firebase/dataService';
import { callGeminiForText } from '../utils/geminiClient';
import GeminiQuotaBadge from './GeminiQuotaBadge';

const RANGE_DAYS = { day: 1, week: 7, month: 30 };

const getDateList = (anchorDate, rangeKey) => {
  const days = RANGE_DAYS[rangeKey];
  const dates = [];
  const anchor = new Date(anchorDate);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const formatShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const TrendView = ({ user }) => {
  const [rangeKey, setRangeKey] = useState('week');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [calorieData, setCalorieData] = useState({});
  const [logData, setLogData] = useState({});
  const [waterByDate, setWaterByDate] = useState({});
  const [geminiComment, setGeminiComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const dates = getDateList(anchorDate, rangeKey);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setGeminiComment('');
    try {
      const [calories, logs, waterResult] = await Promise.all([
        getCalorieTrackingRange(user.uid, dates),
        getDailyLogsRange(user.uid, dates),
        getWaterTracker(user.uid)
      ]);
      setCalorieData(calories);
      setLogData(logs);

      const waterMap = {};
      if (waterResult.success) {
        (waterResult.data.entries || []).forEach((entry) => {
          if (dates.includes(entry.date)) {
            waterMap[entry.date] = (waterMap[entry.date] || 0) + entry.amount;
          }
        });
      }
      setWaterByDate(waterMap);

      // Gün görünümünde mevcut notu düzenleme kutusuna yükle
      if (rangeKey === 'day') {
        const todayLog = logs[anchorDate];
        setNoteDraft(todayLog?.notes || '');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, anchorDate, rangeKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dailyTotals = dates.map((date) => {
    const meals = calorieData[date]?.meals || [];
    const calories = meals.reduce((sum, m) => sum + (parseFloat(m.calories) || 0), 0);
    const protein = meals.reduce((sum, m) => sum + (parseFloat(m.protein) || 0), 0);
    const water = waterByDate[date] || 0;
    const log = logData[date];
    return {
      date,
      calories,
      protein,
      water,
      sleepHours: log?.sleep?.duration_hours || null,
      sleepScore: log?.sleep?.score || null,
      supplements: log?.supplements || [],
      workouts: log?.workouts || [],
      vitals: log?.vitals || null,
      notes: log?.notes || null
    };
  });

  const daysWithData = dailyTotals.filter((d) => d.calories > 0 || d.water > 0);
  const avgCalories = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length)
    : 0;
  const avgWater = daysWithData.length
    ? Math.round(daysWithData.reduce((s, d) => s + d.water, 0) / daysWithData.length)
    : 0;
  const sleepDays = dailyTotals.filter((d) => d.sleepHours);
  const avgSleep = sleepDays.length
    ? (sleepDays.reduce((s, d) => s + d.sleepHours, 0) / sleepDays.length).toFixed(1)
    : null;
  const workoutCount = dailyTotals.filter((d) => d.workouts.length > 0).length;
  const maxCalories = Math.max(...dailyTotals.map((d) => d.calories), 1);
  const maxWater = Math.max(...dailyTotals.map((d) => d.water), 1);

  const shiftAnchor = (direction) => {
    const step = RANGE_DAYS[rangeKey];
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + direction * step);
    const today = new Date().toISOString().split('T')[0];
    const newDate = d.toISOString().split('T')[0];
    setAnchorDate(newDate > today ? today : newDate);
  };

  const buildExportText = () => {
    const lines = [`30 Gün Fit - ${rangeKey === 'day' ? 'Günlük' : rangeKey === 'week' ? 'Haftalık' : 'Aylık'} Özet (${formatShort(dates[0])} - ${formatShort(dates[dates.length - 1])})`, ''];
    dailyTotals.forEach((d) => {
      if (d.calories === 0 && d.water === 0 && !d.sleepHours && d.workouts.length === 0 && d.supplements.length === 0 && !d.notes) return;
      lines.push(`${formatShort(d.date)}:`);
      if (d.calories) lines.push(`  Kalori: ${Math.round(d.calories)} kcal, Protein: ${Math.round(d.protein)}g`);
      if (d.water) lines.push(`  Su: ${d.water} ml`);
      if (d.sleepHours) lines.push(`  Uyku: ${d.sleepHours} saat${d.sleepScore ? `, Skor: ${d.sleepScore}` : ''}`);
      d.workouts.forEach((w) => lines.push(`  ${w.type === 'walk' ? 'Yürüyüş' : w.type === 'cardio' ? 'Kardiyo' : 'Antrenman'}: ${w.duration_min || '?'} dk, ${w.calories || '?'} kcal`));
      if (d.vitals) lines.push(`  Apple Watch: ${d.vitals.steps || '?'} adım, ${d.vitals.active_calories || '?'} kcal`);
      if (d.supplements.length) lines.push(`  Takviyeler: ${d.supplements.map((s) => s.name).join(', ')}`);
      if (d.notes) lines.push(`  Not: ${d.notes}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(buildExportText());
      alert('Kopyalandı! ChatGPT veya başka bir yere yapıştırabilirsin.');
    } catch {
      alert('Kopyalama başarısız oldu, metni manuel seçip kopyalayabilirsin.');
    }
  };

  const handleGeminiComment = async () => {
    setIsCommenting(true);
    setRetryStatus(null);
    try {
      const prompt = `Aşağıda bir kullanıcının fitness/beslenme günlüğü özeti var. Kısa, samimi, Türkçe bir değerlendirme yap: trendi yorumla (kalori, su, uyku, antrenman dengesi), 2-3 somut öneri ver. Uzun analiz yazma, en fazla 150 kelime.\n\n${buildExportText()}`;
      const comment = await callGeminiForText(prompt, (attempt, waitMs) => {
        setRetryStatus({ attempt, waitMs });
      });
      setGeminiComment(comment);
    } catch (err) {
      setGeminiComment('Yorum alınamadı: ' + err.message);
    } finally {
      setIsCommenting(false);
      setRetryStatus(null);
    }
  };

  const handleSaveNote = async () => {
    if (!user) return;
    setIsSavingNote(true);
    try {
      await saveDailyLog(user.uid, anchorDate, { notes: noteDraft });
      const refreshed = await getDailyLog(user.uid, anchorDate);
      setLogData({ ...logData, [anchorDate]: refreshed.data });
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!user) {
    return <div className="trend-view"><p>Trendleri görmek için giriş yapmanız gerekiyor.</p></div>;
  }

  return (
    <div className="trend-view">
      <div className="trend-header">
        <h3>📈 Trend & Özet</h3>
        <div className="trend-range-buttons">
          {Object.keys(RANGE_DAYS).map((key) => (
            <button
              key={key}
              className={rangeKey === key ? 'active' : ''}
              onClick={() => setRangeKey(key)}
            >
              {key === 'day' ? 'Gün' : key === 'week' ? 'Hafta' : 'Ay'}
            </button>
          ))}
        </div>
      </div>

      <div className="trend-date-nav">
        <button onClick={() => shiftAnchor(-1)}>◀</button>
        <span>{formatShort(dates[0])} - {formatShort(dates[dates.length - 1])}</span>
        <button onClick={() => shiftAnchor(1)} disabled={anchorDate === new Date().toISOString().split('T')[0]}>▶</button>
      </div>

      <GeminiQuotaBadge retryStatus={retryStatus} />

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <div className="trend-summary-cards">
            <div className="trend-card">
              <span className="trend-card-icon">🔥</span>
              <span className="trend-card-value">{avgCalories}</span>
              <span className="trend-card-label">Ort. Kalori</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">💧</span>
              <span className="trend-card-value">{avgWater}</span>
              <span className="trend-card-label">Ort. Su (ml)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">😴</span>
              <span className="trend-card-value">{avgSleep || '-'}</span>
              <span className="trend-card-label">Ort. Uyku (saat)</span>
            </div>
            <div className="trend-card">
              <span className="trend-card-icon">🏋️</span>
              <span className="trend-card-value">{workoutCount}</span>
              <span className="trend-card-label">Antrenman Günü</span>
            </div>
          </div>

          {rangeKey !== 'day' && (
            <div className="trend-bars">
              {dailyTotals.map((d) => (
                <div key={d.date} className="trend-bar-day">
                  <div className="trend-bar-track">
                    <div className="trend-bar-fill calories" style={{ height: `${(d.calories / maxCalories) * 100}%` }} />
                  </div>
                  <div className="trend-bar-track water-track">
                    <div className="trend-bar-fill water" style={{ height: `${(d.water / maxWater) * 100}%` }} />
                  </div>
                  <span className="trend-bar-label">{formatShort(d.date)}</span>
                </div>
              ))}
            </div>
          )}

          {rangeKey === 'day' && (
            <div className="trend-day-detail">
              {dailyTotals[0].calories === 0 && dailyTotals[0].water === 0 && !dailyTotals[0].sleepHours && dailyTotals[0].workouts.length === 0 ? (
                <p>Bu gün için henüz kayıt yok.</p>
              ) : (
                <ul>
                  {dailyTotals[0].calories > 0 && <li>🔥 {Math.round(dailyTotals[0].calories)} kcal, {Math.round(dailyTotals[0].protein)}g protein</li>}
                  {dailyTotals[0].water > 0 && <li>💧 {dailyTotals[0].water} ml su</li>}
                  {dailyTotals[0].sleepHours && <li>😴 {dailyTotals[0].sleepHours} saat uyku{dailyTotals[0].sleepScore ? ` (skor ${dailyTotals[0].sleepScore})` : ''}</li>}
                  {dailyTotals[0].workouts.map((w, i) => (
                    <li key={i}>🏋️ {w.type === 'walk' ? 'Yürüyüş' : w.type === 'cardio' ? 'Kardiyo' : 'Antrenman'}: {w.duration_min || '?'} dk{w.distance_km ? `, ${w.distance_km} km` : ''}, {w.calories || '?'} kcal</li>
                  ))}
                  {dailyTotals[0].vitals && <li>⌚ {dailyTotals[0].vitals.steps || '?'} adım, {dailyTotals[0].vitals.active_calories || '?'} kcal aktif</li>}
                  {dailyTotals[0].supplements.length > 0 && <li>💊 {dailyTotals[0].supplements.map((s) => s.name).join(', ')}</li>}
                </ul>
              )}

              <div className="trend-note-editor">
                <label>📝 Not (ChatGPT analizini buraya yapıştırabilirsin)</label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={4}
                  placeholder="Bu güne dair not..."
                />
                <button onClick={handleSaveNote} disabled={isSavingNote}>
                  {isSavingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                </button>
              </div>
            </div>
          )}

          <div className="trend-actions">
            <button onClick={handleCopyExport}>📋 Dışa Aktar (Kopyala)</button>
            <button onClick={handleGeminiComment} disabled={isCommenting}>
              {isCommenting ? '🤖 Yorumlanıyor...' : '🤖 Gemini ile Yorumla'}
            </button>
          </div>

          {geminiComment && (
            <div className="trend-gemini-comment">
              <h5>🤖 AI Değerlendirmesi</h5>
              <p>{geminiComment}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrendView;
