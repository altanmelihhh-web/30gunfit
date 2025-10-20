import React, { useState } from 'react';
import ExerciseCard from './ExerciseCard';
import { getWorkoutProgress } from '../data/workoutProgram';
import './DayDetail.css';

function DayDetail({ workout, completedExercises, onToggleExercise, onToggleDayComplete, isDayComplete }) {
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [adjustedDuration, setAdjustedDuration] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState('all'); // all, no-equipment, with-equipment

  const handleDurationChange = (e) => {
    const newDuration = parseInt(e.target.value);
    setAdjustedDuration(newDuration);
  };

  // Ekipman filtresi uygula
  const filteredExercises = workout.exercises.filter(ex => {
    // Isınma ve soğutma: filtre türüne göre değerlendir
    if (ex.isWarmup || ex.isCooldown) {
      if (equipmentFilter === 'no-equipment') {
        return !ex.requiresEquipment;
      }
      if (equipmentFilter === 'with-equipment') {
        return ex.requiresEquipment;
      }
      return true; // 'all' durumunda her zaman göster
    }

    // Normal egzersizler için filtre uygula
    if (equipmentFilter === 'no-equipment') {
      return !ex.requiresEquipment;
    }
    if (equipmentFilter === 'with-equipment') {
      return ex.requiresEquipment;
    }
    return true; // all
  });

  const equipmentExercises = workout.exercises.filter(ex => ex.requiresEquipment && !ex.isWarmup && !ex.isCooldown);
  const noEquipmentExercises = workout.exercises.filter(ex => !ex.requiresEquipment && !ex.isWarmup && !ex.isCooldown);

  const getCompletedExerciseCount = () => {
    return workout.exercises.filter(ex =>
      completedExercises[`${workout.day}-${ex.id}`]
    ).length;
  };

  const progress = getWorkoutProgress(workout, completedExercises);
  const totalDuration = adjustedDuration !== null ? adjustedDuration : workout.targetDuration;
  const durationRatio = workout.targetDuration ? totalDuration / workout.targetDuration : 1;
  const totalCalories = Math.round((workout.estimatedCalories || 0) * durationRatio);

  // Egzersizlerin süresini orantılı olarak ayarla
  const adjustedExercises = filteredExercises.map(ex => {
    if (adjustedDuration === null || durationRatio === 1) return ex;

    const originalDuration = ex.duration || 0;
    const newDuration = Math.max(1, Math.round(originalDuration * durationRatio));

    // Reps bilgisini de güncelle
    let newReps = ex.reps;
    if (typeof ex.reps === 'string' && ex.reps.includes('dakika')) {
      newReps = `${newDuration} dakika`;
    } else if (typeof ex.reps === 'string' && ex.reps.includes('tekrar')) {
      const originalReps = parseInt(ex.reps) || 0;
      const newRepsCount = Math.max(1, Math.round(originalReps * durationRatio));
      newReps = `${newRepsCount} tekrar`;
    } else if (typeof ex.reps === 'string' && ex.reps.includes('set')) {
      // Set sayısını değiştirme, sadece tekrar sayısını değiştir
      const match = ex.reps.match(/(\d+)\s*set\s*×\s*(\d+)\s*tekrar/);
      if (match) {
        const sets = parseInt(match[1]);
        const reps = parseInt(match[2]);
        const newRepsCount = Math.max(1, Math.round(reps * durationRatio));
        newReps = `${sets} set × ${newRepsCount} tekrar`;
      }
    }

    return {
      ...ex,
      duration: newDuration,
      reps: newReps,
      originalDuration: ex.duration,
      originalReps: ex.reps
    };
  });

  return (
    <div className="day-detail">
      <div className="detail-header">
        <div>
          <h2>Gün {workout.day} - {workout.title}</h2>
          <p className="description">{workout.description}</p>
        </div>
        <button
          className={`complete-btn ${isDayComplete ? 'completed' : ''}`}
          onClick={onToggleDayComplete}
        >
          {isDayComplete ? '✓ Tamamlandı' : 'Tamamla'}
        </button>
      </div>

      <div className="detail-stats">
        <div className="stat">
          <span className="label">Süre:</span>
          <span className="value">
            {totalDuration} dakika
            {adjustedDuration === null && workout.estimatedDuration && (
              <span className="sub-value"> (~{Math.round(workout.estimatedDuration)} dk egzersiz)</span>
            )}
          </span>
        </div>
        <div className="stat">
          <span className="label">Kalori:</span>
          <span className="value">
            {totalCalories} kcal
            {progress.completedCalories > 0 && (
              <span className="sub-value">({progress.completedCalories} kcal tamamlandı)</span>
            )}
          </span>
        </div>
        {workout.focus && (
          <div className="stat">
            <span className="label">Odak:</span>
            <span className="value">{workout.focus}</span>
          </div>
        )}
        <div className="stat">
          <span className="label">Egzersiz:</span>
          <span className="value">
            {getCompletedExerciseCount()}/{workout.exercises.length}
            <span className="sub-value">%{progress.percent} tamamlandı</span>
          </span>
        </div>
        <div className="stat">
          <span className="label">Zorluk:</span>
          <span className="value">Başlangıç</span>
        </div>
      </div>

      <div className="settings-section">
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Ayarlar {(adjustedDuration !== null || equipmentFilter !== 'all') && '•'}
        </button>
        {showSettings && (
          <div className="settings-panel">
            <div className="setting-item">
              <label>Gün Süresi (dakika):</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={adjustedDuration !== null ? adjustedDuration : workout.targetDuration}
                  onChange={handleDurationChange}
                  style={{ flex: 1 }}
                />
                {adjustedDuration !== null && (
                  <button
                    className="filter-btn"
                    onClick={() => setAdjustedDuration(null)}
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    Sıfırla
                  </button>
                )}
              </div>
              <small>Varsayılan: {workout.targetDuration} dakika. Hareketler otomatik ölçeklenir.</small>
            </div>
            <div className="setting-item">
              <label>Ekipman Tercihini Seç:</label>
              <div className="equipment-buttons">
                <button
                  className={`filter-btn ${equipmentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setEquipmentFilter('all')}
                >
                  Tüm Hareketler
                </button>
                <button
                  className={`filter-btn ${equipmentFilter === 'no-equipment' ? 'active' : ''}`}
                  onClick={() => setEquipmentFilter('no-equipment')}
                >
                  📱 Ekipmansız
                </button>
                <button
                  className={`filter-btn ${equipmentFilter === 'with-equipment' ? 'active' : ''}`}
                  onClick={() => setEquipmentFilter('with-equipment')}
                >
                  📦 Ekipmanlı
                </button>
              </div>
              <small>Bugün hangi hareketleri yapmak istiyorsun?</small>
            </div>
          </div>
        )}
      </div>

      <div className="exercises-section">
        <h3>Egzersizler ({adjustedExercises.length} hareket)</h3>
        {equipmentFilter !== 'all' && (
          <p className="filter-info">
            {equipmentFilter === 'no-equipment'
              ? `📱 Sadece ekipmansız hareketler gösteriliyor (${noEquipmentExercises.length} ana hareket)`
              : `📦 Sadece ekipmanlı hareketler gösteriliyor (${equipmentExercises.length} ana hareket)`
            }
            {adjustedExercises.length === 0 && ' - Bu günde bu filtreye uygun hareket yok.'}
          </p>
        )}
        {adjustedDuration !== null && durationRatio !== 1 && (
          <p className="filter-info" style={{ borderLeftColor: '#2563eb', color: '#1d4ed8' }}>
            ⏱️ Süre ayarlandı: Hareketler {Math.round(durationRatio * 100)}% oranında ölçeklendirildi
          </p>
        )}
        <div className="exercises-list">
          {adjustedExercises.length > 0 ? (
            adjustedExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                dayId={workout.day}
                isCompleted={completedExercises[`${workout.day}-${exercise.id}`]}
                onToggle={() => onToggleExercise(workout.day, exercise.id)}
                isExpanded={expandedExercise === exercise.id}
                onExpand={() => setExpandedExercise(
                  expandedExercise === exercise.id ? null : exercise.id
                )}
              />
            ))
          ) : (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
              Seçili filtreye uygun egzersiz bulunamadı. Lütfen filtreyi değiştirin.
            </p>
          )}
        </div>
      </div>

      {workout.isRest && (
        <div className="rest-day-message">
          <p>Bu bir dinlenme günüdür. Hafif aktiviteler ve esnetmeler yapabilirsiniz.</p>
        </div>
      )}
    </div>
  );
}

export default DayDetail;
