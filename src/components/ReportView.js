import React, { useState, useEffect, useCallback } from 'react';
import './ReportView.css';
import { getDailyLogsRange, getCalorieTrackingRange, getWaterTracker, getWeightTracker, getNutritionGoals, getUserProfile } from '../firebase/dataService';
import { analyzeRegions, REGION_LABELS } from '../utils/muscleMap';
import { workoutStats } from '../utils/hevyParser';
import { computeBMR, profileWithLatestWeight, avgDeficit as avgDeficitFn } from '../utils/calorieMath';

/**
 * ReportView - Haftalık/Aylık sağlık raporu.
 * Antrenman (set/hacim/bölge analizi), beslenme (kalori/makro ort. + hedef),
 * su/uyku ortalama, kilo değişimi ve kısa eğilim özeti.
 */

const RANGES = { week: 7, month: 30 };

const dateList = (days) => {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
};

const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0);

const ReportView = ({ user }) => {
  const [rangeKey, setRangeKey] = useState('week');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dates = dateList(RANGES[rangeKey]);
      const [logs, calories, water, weight, goalsRes, profileRes] = await Promise.all([
        getDailyLogsRange(user.uid, dates),
        getCalorieTrackingRange(user.uid, dates),
        getWaterTracker(user.uid),
        getWeightTracker(user.uid, user.email),
        getNutritionGoals(user.uid),
        getUserProfile(user.uid)
      ]);

      // Beslenme
      const dayCals = [], dayProt = [], dayCarb = [], dayFat = [];
      dates.forEach((d) => {
        const meals = calories[d]?.meals || [];
        if (meals.length === 0) return;
        dayCals.push(meals.reduce((s, m) => s + (parseFloat(m.calories) || 0), 0));
        dayProt.push(meals.reduce((s, m) => s + (parseFloat(m.protein) || 0), 0));
        dayCarb.push(meals.reduce((s, m) => s + (parseFloat(m.carbs) || 0), 0));
        dayFat.push(meals.reduce((s, m) => s + (parseFloat(m.fats) || 0), 0));
      });

      // Su (tarih bazlı toplam)
      const waterByDate = {};
      if (water.success) {
        (water.data.entries || []).forEach((e) => {
          if (dates.includes(e.date)) waterByDate[e.date] = (waterByDate[e.date] || 0) + e.amount;
        });
      }
      const waterVals = Object.values(waterByDate);

      // Uyku
      const sleepVals = [], sleepScores = [];
      const stepVals = [];
      const allWorkouts = [];
      let workoutDayCount = 0;
      let totalDurationMin = 0;
      dates.forEach((d) => {
        const log = logs[d];
        if (log?.sleep?.duration_hours) sleepVals.push(log.sleep.duration_hours);
        if (log?.sleep?.score) sleepScores.push(log.sleep.score);
        if (log?.vitals?.steps) stepVals.push(log.vitals.steps);
        const ws = (log?.workouts || []).filter((w) => (w.exercises && w.exercises.length) || w.title || w.duration_min);
        if (ws.length > 0) workoutDayCount += 1;
        ws.forEach((w) => {
          allWorkouts.push(w);
          if (w.duration_min) totalDurationMin += parseFloat(w.duration_min) || 0;
        });
      });

      // Antrenman istatistikleri
      let totalSets = 0, totalVolume = 0;
      allWorkouts.forEach((w) => {
        const s = workoutStats(w);
        totalSets += s.totalSets;
        totalVolume += s.volume;
      });
      const regions = analyzeRegions(allWorkouts);
      const regionList = Object.entries(regions)
        .map(([key, v]) => ({ key, label: REGION_LABELS[key] || key, sets: v.sets, volume: Math.round(v.volume) }))
        .sort((a, b) => b.sets - a.sets);

      // Kilo değişimi
      let weightChange = null, weightStart = null, weightEnd = null, weightInRange = false;
      if (weight.success) {
        const allEntries = (weight.data.entries || [])
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        const entries = allEntries.filter((e) => dates.includes(e.date));
        if (entries.length >= 1) {
          weightStart = entries[0].weight;
          weightEnd = entries[entries.length - 1].weight;
          weightChange = Math.round((weightEnd - weightStart) * 10) / 10;
          weightInRange = true;
        } else if (allEntries.length > 0) {
          const rangeEnd = dates[dates.length - 1];
          const latestKnown = [...allEntries]
            .reverse()
            .find((e) => !e.date || e.date <= rangeEnd) || allEntries[allEntries.length - 1];
          weightEnd = latestKnown.weight;
        }
      }

      const goals = goalsRes.success ? goalsRes.data : null;
      const bmrProfile = profileRes.success
        ? profileWithLatestWeight(profileRes.data, weight.success ? weight.data.entries || [] : [])
        : null;
      const bmr = computeBMR(bmrProfile);

      // Bilimsel kalori açığı: toplam harcama (BMR + aktif kalori) - alınan kalori.
      const calorieDays = dates.map((d) => {
        const meals = calories[d]?.meals || [];
        const consumed = meals.reduce((s, m) => s + (parseFloat(m.calories) || 0), 0);
        const workoutCalories = (logs[d]?.workouts || []).reduce((s, w) => s + (parseFloat(w.calories) || 0), 0);
        return { consumed, activeCalories: logs[d]?.vitals?.active_calories || workoutCalories, vitals: logs[d]?.vitals || {} };
      }).filter((d) => d.consumed > 0);
      const avgDeficit = avgDeficitFn(bmr, calorieDays);
      const totalDeficit = avgDeficit != null ? Math.round(avgDeficit * calorieDays.length) : null;

      setData({
        dates,
        nutrition: {
          avgCalories: avg(dayCals), avgProtein: avg(dayProt), avgCarbs: avg(dayCarb), avgFats: avg(dayFat),
          loggedDays: dayCals.length, totalDeficit, avgDeficit
        },
        goals,
        water: { avg: avg(waterVals), days: waterVals.length },
        sleep: { avg: sleepVals.length ? (sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length).toFixed(1) : null, avgScore: avg(sleepScores) },
        steps: { avg: avg(stepVals), days: stepVals.length },
        workout: { dayCount: workoutDayCount, totalSets, totalVolume: Math.round(totalVolume), totalDurationMin: Math.round(totalDurationMin), regions: regionList },
        body: { weightChange, weightStart, weightEnd, weightInRange }
      });
    } finally {
      setLoading(false);
    }
  }, [user, rangeKey]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  return (
    <div className="report-view">
      <div className="report-head">
        <h2>📊 Rapor</h2>
        <div className="report-range">
          <button className={rangeKey === 'week' ? 'active' : ''} onClick={() => setRangeKey('week')}>Hafta</button>
          <button className={rangeKey === 'month' ? 'active' : ''} onClick={() => setRangeKey('month')}>Ay</button>
        </div>
      </div>
      <p className="report-sub">Son {RANGES[rangeKey]} gün</p>

      {loading || !data ? (
        <p className="report-empty">Yükleniyor...</p>
      ) : (
        <>
          {/* Antrenman */}
          <div className="report-card">
            <h3>🏋️ Antrenman</h3>
            <div className="report-stats">
              <div><strong>{data.workout.dayCount}</strong><span>gün</span></div>
              <div><strong>{data.workout.totalSets}</strong><span>set</span></div>
              <div><strong>{data.workout.totalVolume}</strong><span>kg hacim</span></div>
              <div><strong>{data.workout.totalDurationMin || '–'}</strong><span>dk</span></div>
            </div>
            {data.workout.regions.length > 0 ? (
              <div className="report-regions">
                <div className="report-regions-title">Kas bölgesi (set)</div>
                {data.workout.regions.map((r) => {
                  const max = data.workout.regions[0].sets || 1;
                  return (
                    <div key={r.key} className="report-region">
                      <span className="report-region-label">{r.label}</span>
                      <div className="report-region-bar">
                        <div className="report-region-fill" style={{ width: `${(r.sets / max) * 100}%` }} />
                      </div>
                      <span className="report-region-val">{r.sets}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="report-empty">Bu dönemde antrenman kaydı yok.</p>
            )}
          </div>

          {/* Beslenme */}
          <div className="report-card">
            <h3>🍎 Beslenme (günlük ort.)</h3>
            {data.nutrition.loggedDays > 0 ? (
              <div className="report-macro-grid">
                <div className="report-macro"><span>🔥</span><strong>{data.nutrition.avgCalories}</strong><small>kcal{data.goals ? ` / ${data.goals.calories}` : ''}</small></div>
                <div className="report-macro"><span>🥩</span><strong>{data.nutrition.avgProtein}g</strong><small>protein{data.goals ? ` / ${data.goals.protein}` : ''}</small></div>
                <div className="report-macro"><span>🍞</span><strong>{data.nutrition.avgCarbs}g</strong><small>karb.{data.goals ? ` / ${data.goals.carbs}` : ''}</small></div>
                <div className="report-macro"><span>🥑</span><strong>{data.nutrition.avgFats}g</strong><small>yağ{data.goals ? ` / ${data.goals.fats}` : ''}</small></div>
              </div>
            ) : (
              <p className="report-empty">Bu dönemde öğün kaydı yok.</p>
            )}
            {data.nutrition.totalDeficit != null && (
              <div className={`report-deficit ${data.nutrition.totalDeficit >= 0 ? 'good' : 'over'}`}>
                <div>
                  <strong>{data.nutrition.totalDeficit >= 0 ? '📉' : '📈'} {Math.abs(data.nutrition.totalDeficit)} kcal</strong>
                  <span>{data.nutrition.totalDeficit >= 0 ? 'toplam açık' : 'toplam fazla'}</span>
                </div>
                <div>
                  <strong>{Math.abs(data.nutrition.avgDeficit)} kcal</strong>
                  <span>günlük ort. {data.nutrition.avgDeficit >= 0 ? 'açık' : 'fazla'}</span>
                </div>
              </div>
            )}
            <p className="report-note">{data.nutrition.loggedDays} gün kayıt girildi</p>
          </div>

          {/* Su / Uyku / Adım */}
          <div className="report-card">
            <h3>💧 Su · 😴 Uyku · 👟 Adım (ort.)</h3>
            <div className="report-stats">
              <div><strong>{data.water.avg || '–'}</strong><span>ml su{data.goals ? ` / ${data.goals.water}` : ''}</span></div>
              <div><strong>{data.sleep.avg || '–'}</strong><span>sa uyku</span></div>
              <div><strong>{data.sleep.avgScore || '–'}</strong><span>uyku skoru</span></div>
              <div><strong>{data.steps.avg || '–'}</strong><span>adım</span></div>
            </div>
          </div>

          {/* Vücut */}
          <div className="report-card">
            <h3>⚖️ Kilo</h3>
            {data.body.weightEnd != null ? (
              <div className="report-weight">
                <span className="report-weight-current">{data.body.weightEnd} kg</span>
                {data.body.weightChange != null && data.body.weightChange !== 0 && (
                  <span className={`report-weight-change ${data.body.weightChange < 0 ? 'down' : 'up'}`}>
                    {data.body.weightChange < 0 ? '↓' : '↑'} {Math.abs(data.body.weightChange)} kg (bu dönem)
                  </span>
                )}
                {!data.body.weightInRange && (
                  <span className="report-weight-change">Son bilinen kilo</span>
                )}
              </div>
            ) : (
              <p className="report-empty">Bu dönemde kilo kaydı yok.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportView;
