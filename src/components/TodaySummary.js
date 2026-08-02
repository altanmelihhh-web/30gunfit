import React, { useState, useEffect, useCallback } from 'react';
import './TodaySummary.css';
import { getDailyCalories, getDailyLog, getWaterTracker, getNutritionGoals, getUserProfile } from '../firebase/dataService';
import { computeBMR, dayDeficit, getBMRProfileIssue } from '../utils/calorieMath';

/**
 * TodaySummary - Ana "Bugün" sekmesinin üstündeki günlük özet panosu.
 * Bugünün kalori/su/uyku/adım/antrenman verisini tek bakışta gösterir.
 * Veriyi Firestore'dan (bugünün tarihi) okur; kullanıcı yoksa gizlenir.
 */

const Ring = ({ value, target, unit, label, icon, color }) => {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const size = 68, stroke = 6, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <div className="today-ring-card">
      <svg width={size} height={size} className="today-ring">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="today-ring-icon">{icon}</text>
      </svg>
      <div className="today-ring-info">
        <span className="today-ring-value">{Math.round(value)}{target ? <span className="today-ring-target">/{target}</span> : ''}</span>
        <span className="today-ring-label">{label}{unit ? ` (${unit})` : ''}</span>
      </div>
    </div>
  );
};

const StatCard = ({ icon, value, label }) => (
  <div className="today-stat-card">
    <span className="today-stat-icon">{icon}</span>
    <span className="today-stat-value">{value}</span>
    <span className="today-stat-label">{label}</span>
  </div>
);

const TodaySummary = ({ user, refreshKey }) => {
  const [data, setData] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;
    const [cal, log, water, goals, profile] = await Promise.all([
      getDailyCalories(user.uid, today),
      getDailyLog(user.uid, today),
      getWaterTracker(user.uid),
      getNutritionGoals(user.uid),
      getUserProfile(user.uid)
    ]);

    const meals = cal.success ? (cal.data.meals || []) : [];
    const calories = meals.reduce((s, m) => s + (parseFloat(m.calories) || 0), 0);
    const protein = meals.reduce((s, m) => s + (parseFloat(m.protein) || 0), 0);

    let waterTotal = 0;
    let waterGoal = 2500;
    if (water.success) {
      waterGoal = water.data.dailyGoal || 2500;
      waterTotal = (water.data.entries || [])
        .filter((e) => e.date === today)
        .reduce((s, e) => s + (e.amount || 0), 0);
    }

    const logData = log.success ? log.data : {};
    let targetCalories = goals.success ? goals.data?.calories : 0;
    let targetProtein = goals.success ? goals.data?.protein : 0;
    if (!targetCalories || !targetProtein) {
      try {
        const saved = localStorage.getItem('nutrition_plan');
        if (saved) {
          const plan = JSON.parse(saved);
          targetCalories = targetCalories || plan?.targetCalories || 0;
          targetProtein = targetProtein || plan?.macros?.protein?.grams || 0;
        }
      } catch { /* yoksay */ }
    }
    let profileData = profile.success ? profile.data : null;
    let bmr = computeBMR(profileData);
    if (bmr == null) {
      try {
        const savedProfile = JSON.parse(localStorage.getItem('userProfile') || 'null');
        profileData = profileData || savedProfile;
        bmr = computeBMR(savedProfile);
      } catch { /* yoksay */ }
    }
    const bmrIssue = getBMRProfileIssue(profileData);
    const workoutCalories = (logData.workouts || []).reduce((s, w) => s + (parseFloat(w.calories) || 0), 0);
    const activeCalories = logData.vitals?.active_calories || workoutCalories || 0;
    const realDeficit = dayDeficit(bmr, activeCalories, calories);

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
      realDeficit
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshKey]);

  useEffect(() => { load(); }, [load]);

  if (!user || !data) return null;

  return (
    <div className="today-summary">
      <h2 className="today-summary-title">🗓️ Bugün · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</h2>
      <div className="today-rings">
        <Ring value={data.calories} target={data.targetCalories} unit="" label="Kalori" icon="🔥" color="#f97316" />
        <Ring value={data.waterTotal} target={data.waterGoal} unit="ml" label="Su" icon="💧" color="#0ea5e9" />
        {data.targetProtein > 0 && (
          <Ring value={data.protein} target={data.targetProtein} unit="g" label="Protein" icon="🥩" color="#22c55e" />
        )}
      </div>

      {data.meals > 0 && data.realDeficit != null && (() => {
        const isDeficit = data.realDeficit >= 0;
        return (
          <div className={`today-deficit ${isDeficit ? 'good' : 'over'}`}>
            <span className="today-deficit-icon">{isDeficit ? '📉' : '📈'}</span>
            <span className="today-deficit-text">
              {isDeficit
                ? <>Bugün <strong>{Math.abs(data.realDeficit)} kcal açık</strong> (BMR {data.bmr}{data.activeCalories ? ` + aktif ${Math.round(data.activeCalories)}` : ''} · alınan {Math.round(data.calories)})</>
                : <>Bugün <strong>{Math.abs(data.realDeficit)} kcal fazla</strong> (BMR {data.bmr}{data.activeCalories ? ` + aktif ${Math.round(data.activeCalories)}` : ''} · alınan {Math.round(data.calories)})</>}
            </span>
          </div>
        );
      })()}
      {data.meals > 0 && data.realDeficit == null && (
        <div className="today-deficit over">
          <span className="today-deficit-icon">⚠️</span>
          <span className="today-deficit-text">
            Kalori açığı hesaplanamadı: <strong>{data.bmrIssue || 'profil değerleri geçersiz.'}</strong>
          </span>
        </div>
      )}
      <div className="today-stats">
        <StatCard icon="😴" value={data.sleep?.duration_hours ? `${data.sleep.duration_hours} sa` : '—'} label="Uyku" />
        <StatCard icon="👟" value={data.steps ? data.steps.toLocaleString('tr-TR') : '—'} label="Adım" />
        <StatCard icon="⌚" value={data.activeCalories ? `${Math.round(data.activeCalories)} kcal` : data.workouts.length > 0 ? '✓' : '—'} label="Aktivite" />
        <StatCard icon="🍽️" value={data.meals} label="Öğün" />
      </div>
    </div>
  );
};

export default TodaySummary;
