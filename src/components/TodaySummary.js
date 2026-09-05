import React, { useState, useEffect, useCallback } from 'react';
import './TodaySummary.css';
import { getDailyCalories, getDailyLog, getWaterTracker, getNutritionGoals, getUserProfile, getWeightTracker } from '../firebase/dataService';
import { computeBMR, energyBalance, getActiveEnergy, getBMRProfileIssue, profileWithLatestWeight } from '../utils/calorieMath';
import { getScopedJson } from '../utils/userScopedStorage';

/**
 * TodaySummary - Ana "Bugün" sekmesinin üstündeki günlük özet panosu.
 * Bugünün kalori/su/uyku/adım/antrenman verisini tek bakışta gösterir.
 * Veriyi Firestore'dan (bugünün tarihi) okur; kullanıcı yoksa gizlenir.
 */

const ProgressMetric = ({ value, target, unit, label, color }) => {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="today-progress-metric">
      <div className="today-progress-head">
        <span>{label}</span>
        <strong>{Math.round(value)}{unit}{target ? <small> / {target}{unit}</small> : ''}</strong>
      </div>
      <div className="today-progress-track">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const MetricCard = ({ icon, value, label, note }) => (
  <div className="today-metric-card">
    <span className="today-stat-icon">{icon}</span>
    <div>
      <span className="today-stat-value">{value}</span>
      <span className="today-stat-label">{label}</span>
      {note && <span className="today-stat-note">{note}</span>}
    </div>
  </div>
);

const TodaySummary = ({ user, refreshKey }) => {
  const [data, setData] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;
    const [cal, log, water, goals, profile, weight] = await Promise.all([
      getDailyCalories(user.uid, today),
      getDailyLog(user.uid, today),
      getWaterTracker(user.uid),
      getNutritionGoals(user.uid),
      getUserProfile(user.uid),
      getWeightTracker(user.uid, user.email)
    ]);

    const meals = cal.success ? (cal.data.meals || []) : [];
    const calories = meals.reduce((s, m) => s + (parseFloat(m.calories) || 0), 0);
    const protein = meals.reduce((s, m) => s + (parseFloat(m.protein) || 0), 0);

    let waterTotal = 0;
    let waterTrackerGoal = 2500;
    if (water.success) {
      waterTrackerGoal = water.data.dailyGoal || 2500;
      waterTotal = (water.data.entries || [])
        .filter((e) => e.date === today)
        .reduce((s, e) => s + (e.amount || 0), 0);
    }

    const logData = log.success ? log.data : {};
    let targetCalories = goals.success ? goals.data?.calories : 0;
    let targetProtein = goals.success ? goals.data?.protein : 0;
    const waterGoal = goals.success && goals.data?.water ? goals.data.water : waterTrackerGoal;
    if (!targetCalories || !targetProtein) {
      try {
        const plan = getScopedJson('nutrition_plan', user.uid, null);
        if (plan) {
          targetCalories = targetCalories || plan?.targetCalories || 0;
          targetProtein = targetProtein || plan?.macros?.protein?.grams || 0;
        }
      } catch { /* yoksay */ }
    }
    let profileData = profile.success ? profileWithLatestWeight(profile.data, weight.success ? weight.data.entries || [] : []) : null;
    let bmr = computeBMR(profileData);
    if (bmr == null) {
      try {
        const savedProfile = getScopedJson('userProfile', user.uid, null);
        profileData = savedProfile;
        bmr = computeBMR(savedProfile);
      } catch { /* yoksay */ }
    }
    const bmrIssue = getBMRProfileIssue(profileData);
    const workoutCalories = (logData.workouts || []).reduce((s, w) => s + (parseFloat(w.calories) || 0), 0);
    const vitals = logData.vitals || {};
    const activeCalories = getActiveEnergy(vitals, workoutCalories);
    const currentBalance = energyBalance({ bmr, vitals, consumed: calories, workoutActiveCalories: workoutCalories, mode: 'full-day' });
    const totalBurned = currentBalance.totalExpenditure;
    const caloriePct = targetCalories > 0 ? Math.round((calories / targetCalories) * 100) : null;
    const targetCalorieBalance = targetCalories > 0 ? Math.round(targetCalories - calories) : null;

    setData({
      calories, protein, meals: meals.length,
      waterTotal, waterGoal,
      sleep: logData.sleep || null,
      steps: logData.vitals?.steps || null,
      workouts: logData.workouts || [],
      targetCalories,
      targetProtein,
      bmr,
      bmrIssue,
      activeCalories,
      currentBalance,
      realDeficit: currentBalance.deficit,
      totalBurned,
      caloriePct,
      targetCalorieBalance
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshKey]);

  useEffect(() => { load(); }, [load]);

  if (!user || !data) return null;

  return (
    <div className="today-summary">
      <div className="today-summary-head">
        <div>
          <span className="today-eyebrow">Günlük Operasyon Paneli</span>
          <h2 className="today-summary-title">Bugün · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</h2>
        </div>
        <span className="today-data-badge">{data.meals} öğün kaydı</span>
      </div>

      <div className="today-command-grid">
        <div className={`today-energy-panel ${data.realDeficit != null && data.realDeficit < 0 ? 'over' : ''}`}>
          <span className="today-panel-label">Enerji Dengesi</span>
          {data.realDeficit != null ? (
            <>
              <strong>{Math.abs(data.currentBalance.deficit).toLocaleString('tr-TR')} kcal</strong>
              <span>{data.currentBalance.deficit >= 0 ? 'kalori açığı' : 'kalori fazlası'}</span>
              <div className="today-equation">
                Harcama {data.currentBalance.totalExpenditure.toLocaleString('tr-TR')} = BMR {data.bmr.toLocaleString('tr-TR')} + aktif {Math.round(data.activeCalories || 0).toLocaleString('tr-TR')} - alınan {Math.round(data.calories).toLocaleString('tr-TR')}
              </div>
            </>
          ) : (
            <>
              <strong>Eksik</strong>
              <span>Kalori açığı hesaplanamadı</span>
              <div className="today-equation">{data.bmrIssue || 'Profil değerleri geçersiz.'}</div>
            </>
          )}
        </div>

        <div className="today-metric-grid">
          <MetricCard icon="🔥" value={`${Math.round(data.calories).toLocaleString('tr-TR')} kcal`} label="Alınan Kalori" note={data.caloriePct != null ? `hedefin %${data.caloriePct}` : null} />
          <MetricCard icon="🛌" value={data.currentBalance.restingEnergy != null ? `${data.currentBalance.restingEnergy.toLocaleString('tr-TR')} kcal` : '—'} label="Dinlenme Enerjisi" note={`BMR ${data.bmr?.toLocaleString('tr-TR')}`} />
          <MetricCard icon="⚡" value={`${Math.round(data.activeCalories || 0).toLocaleString('tr-TR')} kcal`} label="Aktif Enerji" />
          <MetricCard icon="Σ" value={data.currentBalance.totalExpenditure ? `${data.currentBalance.totalExpenditure.toLocaleString('tr-TR')} kcal` : '—'} label="Toplam Harcama" note="dinlenme + aktif" />
          <MetricCard icon="📉" value={data.currentBalance.deficit != null ? `${Math.abs(data.currentBalance.deficit).toLocaleString('tr-TR')} kcal` : '—'} label="Kalori Açığı" note={data.currentBalance.deficit != null && data.currentBalance.deficit < 0 ? 'fazla' : 'açık'} />
          <MetricCard
            icon="🎯"
            value={data.targetCalorieBalance != null ? `${Math.abs(data.targetCalorieBalance).toLocaleString('tr-TR')} kcal` : '—'}
            label={data.targetCalorieBalance == null ? 'Hedef Farkı' : data.targetCalorieBalance >= 0 ? 'Hedefe Kalan' : 'Hedef Üstü'}
            note={data.targetCalories ? `${data.targetCalories.toLocaleString('tr-TR')} kcal hedefe göre` : null}
          />
        </div>
      </div>

      <div className="today-progress-grid">
        <ProgressMetric value={data.calories} target={data.targetCalories} unit=" kcal" label="Kalori Hedefi" color="#f97316" />
        <ProgressMetric value={data.waterTotal} target={data.waterGoal} unit=" ml" label="Su Hedefi" color="#0ea5e9" />
        {data.targetProtein > 0 && <ProgressMetric value={data.protein} target={data.targetProtein} unit="g" label="Protein Hedefi" color="#16a34a" />}
      </div>

      <div className="today-ops-row">
        <MetricCard icon="👟" value={data.steps ? data.steps.toLocaleString('tr-TR') : '—'} label="Adım" />
        <MetricCard icon="⌚" value={data.activeCalories ? `${Math.round(data.activeCalories)} kcal` : data.workouts.length > 0 ? '✓' : '—'} label="Aktivite" />
        <MetricCard icon="🍽️" value={data.meals} label="Öğün" />
        <MetricCard icon="🥩" value={`${Math.round(data.protein).toLocaleString('tr-TR')}g`} label="Protein" />
      </div>

      {data.meals > 0 && data.realDeficit == null && (
        <div className="today-deficit over">
          <span className="today-deficit-icon">⚠️</span>
          <span className="today-deficit-text">
            Kalori açığı hesaplanamadı: <strong>{data.bmrIssue || 'profil değerleri geçersiz.'}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default TodaySummary;
