import React, { useState } from 'react';
import './ExerciseCard.css';
import ExerciseTimer from './ExerciseTimer';

function ExerciseCard({
  exercise,
  dayId,
  isCompleted,
  onToggle,
  isExpanded,
  onExpand
}) {
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const [showTimer, setShowTimer] = useState(false);
  const [mediaType, setMediaType] = useState('gif'); // 'gif' veya 'video'

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Kolay':
        return '#4CAF50';
      case 'Orta':
        return '#FF9800';
      case 'Zor':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const displayExercise = selectedAlternative !== null && exercise.alternatives ? exercise.alternatives[selectedAlternative] : exercise;

  // Defaults
  const safeExercise = {
    name: displayExercise.name || 'Hareket',
    description: displayExercise.description || '',
    videoGuide: displayExercise.videoGuide || '',
    videoUrl: displayExercise.videoUrl || '',
    previewImage: displayExercise.previewImage || '',
    videoCredit: displayExercise.videoCredit || '',
    gifUrl: displayExercise.gifUrl || '',
    difficulty: displayExercise.difficulty || 'Kolay',
    targetMuscles: displayExercise.targetMuscles || [],
    requiresEquipment: displayExercise.requiresEquipment === true,
    equipment: displayExercise.equipment || [],
    reps: displayExercise.reps || '',
    duration: displayExercise.duration || 0
  };

  return (
    <div className={`exercise-card ${isCompleted ? 'completed' : ''}`}>
      <div className="exercise-header" onClick={onExpand}>
        <div className="exercise-title-section">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="exercise-checkbox"
          />
          <div>
            <h4 className="exercise-name">
              {safeExercise.name}
              {selectedAlternative !== null && <span className="alt-badge">ALT</span>}
            </h4>
            <span className="exercise-reps">{safeExercise.reps}</span>
          </div>
        </div>
        <div className="exercise-meta">
          <span
            className="difficulty"
            style={{ backgroundColor: getDifficultyColor(safeExercise.difficulty) }}
          >
            {safeExercise.difficulty}
          </span>
          <span className="exercise-duration">{safeExercise.duration} dk</span>
          <button className="expand-btn" onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}>
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="exercise-details">
          <p className="description">{safeExercise.description}</p>

          {/* Timer Butonu */}
          {!exercise.isWarmup && !exercise.isCooldown && safeExercise.duration > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <button
                className="timer-toggle-btn"
                onClick={() => setShowTimer(!showTimer)}
              >
                {showTimer ? '⏱️ Timer\'ı Gizle' : '⏱️ Timer Başlat'}
              </button>
            </div>
          )}

          {/* Timer Komponenti */}
          {showTimer && (
            <ExerciseTimer
              exercise={safeExercise}
              onComplete={() => {
                setShowTimer(false);
                if (!isCompleted) {
                  onToggle();
                }
              }}
            />
          )}

          {(safeExercise.gifUrl || safeExercise.videoUrl || safeExercise.videoGuide) && (
            <div className="video-guide-section">
              <div className="media-header">
                <h5>💡 Nasıl Yapılır</h5>

                {/* Hem GIF hem Video varsa seçim butonları göster */}
                {safeExercise.gifUrl && safeExercise.videoUrl && (
                  <div className="media-toggle">
                    <button
                      className={`media-btn ${mediaType === 'gif' ? 'active' : ''}`}
                      onClick={() => setMediaType('gif')}
                    >
                      🎬 GIF
                    </button>
                    <button
                      className={`media-btn ${mediaType === 'video' ? 'active' : ''}`}
                      onClick={() => setMediaType('video')}
                    >
                      📹 Video
                    </button>
                  </div>
                )}
              </div>

              {/* GIF gösterimi */}
              {safeExercise.gifUrl && (mediaType === 'gif' || !safeExercise.videoUrl) && (
                <img
                  src={safeExercise.gifUrl}
                  alt={safeExercise.name}
                  className="exercise-gif"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
              )}

              {/* Video gösterimi */}
              {safeExercise.videoUrl && (mediaType === 'video' || !safeExercise.gifUrl) && (
                <div className="video-wrapper">
                  <iframe
                    src={safeExercise.videoUrl}
                    title={`${safeExercise.name} video anlatımı`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>
              )}

              {safeExercise.videoGuide && (
                <p className="video-guide">{safeExercise.videoGuide}</p>
              )}

              {safeExercise.videoCredit && (
                <p className="video-credit">
                  {mediaType === 'gif' && safeExercise.gifUrl ? 'GIF' : 'Video'} kaynağı: {safeExercise.videoCredit}
                </p>
              )}
            </div>
          )}

          <div className="exercise-info">
            {safeExercise.targetMuscles && safeExercise.targetMuscles.length > 0 && (
              <div className="info-group">
                <span className="label">Hedef Kaslar:</span>
                <div className="muscle-tags">
                  {safeExercise.targetMuscles.map((muscle, idx) => (
                    <span key={idx} className="muscle-tag">{muscle}</span>
                  ))}
                </div>
              </div>
            )}

            {safeExercise.requiresEquipment && safeExercise.equipment && safeExercise.equipment.length > 0 && (
              <div className="info-group equipment-info">
                <span className="label">📦 Gerekli Ekipman:</span>
                <div className="equipment-list">
                  {safeExercise.equipment.map((item, idx) => (
                    <span key={idx} className="equipment-tag">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {safeExercise.requiresEquipment === false && (
              <div className="info-group no-equipment">
                <span className="label">✓ Ekipman Gerekli Değil</span>
              </div>
            )}

            <div className="info-group">
              <span className="label">📝 İpuçları:</span>
              <ul className="tips-list">
                <li>Hareketleri yavaş ve kontrollü yap</li>
                <li>Her tekrarda doğru form'u koru</li>
                <li>Gerekirse dinlen ve tekrarlayabilirsin</li>
                <li>Ağrı hissedersen alternatif harekete geç</li>
              </ul>
            </div>
          </div>

          {exercise.alternatives && exercise.alternatives && exercise.alternatives.length > 0 && (
            <div className="alternatives-section">
              <h5>🔄 Alternatif Hareketler</h5>
              <div className="alternatives-list">
                <button
                  className={`alternative-btn ${selectedAlternative === null ? 'active' : ''}`}
                  onClick={() => setSelectedAlternative(null)}
                >
                  <span className="alt-name">{exercise.name}</span>
                  <span className="alt-duration">{exercise.duration} dk</span>
                </button>
                {exercise.alternatives && exercise.alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    className={`alternative-btn ${selectedAlternative === idx ? 'active' : ''}`}
                    onClick={() => setSelectedAlternative(idx)}
                  >
                    <span className="alt-name">{alt.name || 'Alternatif'}</span>
                    <span className="alt-duration">{alt.duration || 2} dk</span>
                  </button>
                ))}
              </div>
              {selectedAlternative !== null && (
                <p className="alt-note">
                  ℹ️ Bu alternatif hareketi tamamlayabilirsin. Her ikisi de hesaplanır!
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExerciseCard;
