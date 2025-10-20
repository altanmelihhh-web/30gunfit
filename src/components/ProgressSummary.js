import React from 'react';
import './ProgressSummary.css';

const formatDate = (date) => {
  if (!date) return '-';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    return '-';
  }
};

function ProgressSummary({
  summary,
  todaysWorkout,
  todaysProgress,
  currentDay,
  startDate
}) {
  const todayTitle = todaysWorkout ? `${todaysWorkout.title}` : 'Program tamamlandı';

  return (
    <section className="progress-summary">
      <div className="summary-header">
        <div>
          <h2>Genel Durum</h2>
          <p>Başlangıç tarihi: {formatDate(startDate)}</p>
        </div>
        <div className="summary-overall">
          <span>Genel Tamamlama</span>
          <strong>%{summary.overallPercent}</strong>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-label">Tamamlanan Gün</span>
          <strong>{summary.completedDays}/{summary.totalDays}</strong>
          <small>Kalan {summary.totalDays - summary.completedDays} gün</small>
        </div>
        <div className="summary-card">
          <span className="summary-label">Toplam Süre</span>
          <strong>{summary.completedMinutes} dk</strong>
          <small>Hedef: {summary.totalTargetMinutes} dk</small>
        </div>
        <div className="summary-card">
          <span className="summary-label">Tahmini Kalori</span>
          <strong>{summary.completedCalories} kcal</strong>
          <small>Kalan ≈ {summary.remainingCalories} kcal</small>
        </div>
        <div className="summary-card">
          <span className="summary-label">Bugün Gün {Math.min(currentDay, summary.totalDays)}</span>
          <strong>%{todaysProgress?.percent || 0}</strong>
          <small>{todaysProgress?.completedCount || 0}/{todaysProgress?.totalCount || 0} egzersiz</small>
        </div>
      </div>

      {todaysWorkout && (
        <div className="today-highlight">
          <div className="today-info">
            <h3>Bugünkü Hedef: Gün {todaysWorkout.day}</h3>
            <p>{todayTitle}</p>
          </div>
          <div className="today-progress">
            <div className="today-progress-bar">
              <div
                className="today-progress-fill"
                style={{ width: `${todaysProgress.percent}%` }}
              />
            </div>
            <span className="today-progress-text">
              %{todaysProgress.percent} · {todaysProgress.completedMinutes} dk · {todaysProgress.completedCalories} kcal
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProgressSummary;
