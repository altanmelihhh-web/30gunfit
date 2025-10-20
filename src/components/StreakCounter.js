import React, { useMemo } from 'react';
import './StreakCounter.css';

function StreakCounter({ completedDays, startDate }) {
  // Streak hesapla
  const streak = useMemo(() => {
    if (!completedDays || completedDays.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - start) / (24 * 60 * 60 * 1000));
    const currentDay = diffDays + 1;

    // Son günden geriye doğru streak hesapla
    let streakCount = 0;
    for (let day = currentDay; day >= 1; day--) {
      if (completedDays.includes(day)) {
        streakCount++;
      } else {
        break;
      }
    }

    return streakCount;
  }, [completedDays, startDate]);

  // En uzun streak hesapla
  const longestStreak = useMemo(() => {
    if (!completedDays || completedDays.length === 0) return 0;

    const sorted = [...completedDays].sort((a, b) => a - b);
    let longest = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }, [completedDays]);

  // Başarılar
  const achievements = useMemo(() => {
    const total = completedDays.length;
    const badges = [];

    if (streak >= 3) badges.push({ icon: '🔥', title: '3 Gün Streak!', color: '#f59e0b' });
    if (streak >= 7) badges.push({ icon: '⚡', title: '7 Gün Streak!', color: '#3b82f6' });
    if (streak >= 14) badges.push({ icon: '💪', title: '2 Hafta Streak!', color: '#8b5cf6' });
    if (streak >= 30) badges.push({ icon: '👑', title: '30 Gün Streak!', color: '#ec4899' });

    if (total >= 7) badges.push({ icon: '🏅', title: '7 Gün Tamamlandı!', color: '#22c55e' });
    if (total >= 15) badges.push({ icon: '🎖️', title: '15 Gün Tamamlandı!', color: '#10b981' });
    if (total >= 30) badges.push({ icon: '🏆', title: '30 Gün Tamamlandı!', color: '#fbbf24' });

    if (longestStreak >= 7) badges.push({ icon: '🌟', title: `En Uzun Streak: ${longestStreak}`, color: '#6366f1' });

    return badges;
  }, [streak, longestStreak, completedDays.length]);

  const getStreakMessage = () => {
    if (streak === 0) return 'Bugün başla ve streak\'ini oluştur! 🚀';
    if (streak === 1) return 'Harika başlangıç! Devam et! 💪';
    if (streak < 7) return `${streak} gün üst üste! Devam et! 🔥`;
    if (streak < 14) return `${streak} gün streak! İnanılmaz! ⚡`;
    if (streak < 30) return `${streak} gün streak! Efsanesin! 🌟`;
    return `${streak} gün streak! Şampiyonsun! 👑`;
  };

  const getStreakEmoji = () => {
    if (streak === 0) return '💤';
    if (streak < 3) return '🔥';
    if (streak < 7) return '⚡';
    if (streak < 14) return '💪';
    if (streak < 30) return '🌟';
    return '👑';
  };

  return (
    <div className="streak-counter">
      <div className="streak-header">
        <h3>Streak & Başarılar</h3>
      </div>

      <div className="streak-main">
        <div className="streak-circle">
          <div className="streak-emoji">{getStreakEmoji()}</div>
          <div className="streak-number">{streak}</div>
          <div className="streak-label">Gün Streak</div>
        </div>
        <p className="streak-message">{getStreakMessage()}</p>
      </div>

      <div className="streak-stats">
        <div className="stat-item">
          <span className="stat-value">{longestStreak}</span>
          <span className="stat-label">En Uzun Streak</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{completedDays.length}</span>
          <span className="stat-label">Toplam Gün</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{Math.round((completedDays.length / 30) * 100)}%</span>
          <span className="stat-label">Tamamlanma</span>
        </div>
      </div>

      {achievements.length > 0 && (
        <div className="achievements">
          <h4>🏆 Başarılar</h4>
          <div className="achievements-grid">
            {achievements.map((badge, idx) => (
              <div
                key={idx}
                className="achievement-badge"
                style={{ borderColor: badge.color }}
              >
                <span className="badge-icon">{badge.icon}</span>
                <span className="badge-title" style={{ color: badge.color }}>
                  {badge.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {achievements.length === 0 && (
        <div className="no-achievements">
          <p>🎯 Egzersiz yapmaya devam et ve rozetleri topla!</p>
        </div>
      )}
    </div>
  );
}

export default StreakCounter;
