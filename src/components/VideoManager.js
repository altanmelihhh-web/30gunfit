import React, { useState } from 'react';
import './VideoManager.css';
import { exerciseLibrary, EXERCISE_CATEGORIES } from '../data/exerciseLibrary';

function VideoManager({ onSave }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingExercise, setEditingExercise] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');

  // Kategori filtresi
  const filteredExercises = exerciseLibrary.filter(ex => {
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    const matchesSearch = searchTerm === '' ||
      ex.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEditClick = (exercise) => {
    setEditingExercise(exercise);
    setVideoUrl(exercise.videoUrl || '');
  };

  const handleSaveVideo = () => {
    if (!editingExercise) return;

    // YouTube URL'den video ID'sini çıkar
    let finalUrl = videoUrl;
    if (videoUrl.includes('youtube.com/watch?v=')) {
      const videoId = videoUrl.split('v=')[1].split('&')[0];
      finalUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (videoUrl.includes('youtu.be/')) {
      const videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
      finalUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    // ExerciseLibrary'yi güncelle
    const index = exerciseLibrary.findIndex(ex => ex.id === editingExercise.id);
    if (index !== -1) {
      exerciseLibrary[index].videoUrl = finalUrl;
    }

    if (onSave) {
      onSave(exerciseLibrary);
    }

    setEditingExercise(null);
    setVideoUrl('');
    alert('✅ Video kaydedildi!');
  };

  const handleCancel = () => {
    setEditingExercise(null);
    setVideoUrl('');
  };

  const getYouTubeSearchUrl = (exerciseName) => {
    const query = encodeURIComponent(`${exerciseName} exercise tutorial`);
    return `https://www.youtube.com/results?search_query=${query}`;
  };

  return (
    <div className="video-manager">
      <div className="video-manager-header">
        <h2>Video Yönetim Paneli</h2>
        <p>Her egzersiz için YouTube videosu ekleyin veya düzenleyin</p>
      </div>

      <div className="video-manager-filters">
        <input
          type="text"
          placeholder="Egzersiz ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-select"
        >
          <option value="all">Tüm Kategoriler</option>
          {Object.values(EXERCISE_CATEGORIES).map(cat => (
            <option key={cat} value={cat}>
              {cat.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="video-stats">
        <div className="stat">
          <span className="stat-label">Toplam Egzersiz:</span>
          <span className="stat-value">{exerciseLibrary.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Video Eklenmiş:</span>
          <span className="stat-value success">
            {exerciseLibrary.filter(ex => ex.videoUrl).length}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Video Bekleniyor:</span>
          <span className="stat-value warning">
            {exerciseLibrary.filter(ex => !ex.videoUrl).length}
          </span>
        </div>
      </div>

      <div className="exercise-list">
        {filteredExercises.map(exercise => (
          <div key={exercise.id} className="exercise-item">
            <div className="exercise-info">
              <h3>{exercise.name}</h3>
              <div className="exercise-meta">
                <span className="category-badge">{exercise.category}</span>
                <span className="difficulty-badge">{exercise.difficulty}</span>
                {exercise.videoUrl ? (
                  <span className="video-status has-video">✅ Video var</span>
                ) : (
                  <span className="video-status no-video">❌ Video yok</span>
                )}
              </div>
            </div>

            <div className="exercise-actions">
              {exercise.videoUrl && (
                <a
                  href={exercise.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-preview"
                >
                  👁️ İzle
                </a>
              )}
              <a
                href={getYouTubeSearchUrl(exercise.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-search"
              >
                🔍 YouTube'da Ara
              </a>
              <button
                className="btn-edit"
                onClick={() => handleEditClick(exercise)}
              >
                ✏️ Video Ekle/Düzenle
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingExercise && (
        <div className="video-modal">
          <div className="video-modal-content">
            <h3>Video Ekle: {editingExercise.name}</h3>

            <div className="video-instructions">
              <p><strong>Nasıl Eklerim?</strong></p>
              <ol>
                <li>YouTube'da "{editingExercise.name} exercise tutorial" ara</li>
                <li>Uygun videoyu bul</li>
                <li>Video URL'ini kopyala (örn: https://youtube.com/watch?v=xxxxx)</li>
                <li>Aşağıya yapıştır</li>
              </ol>
            </div>

            <div className="form-group">
              <label>YouTube Video URL</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=xxxxx"
                className="video-url-input"
              />
              <small>
                Desteklenen formatlar: youtube.com/watch?v=xxx veya youtu.be/xxx
              </small>
            </div>

            {videoUrl && (
              <div className="video-preview">
                <h4>Önizleme:</h4>
                <iframe
                  width="100%"
                  height="315"
                  src={videoUrl.includes('youtube.com/watch?v=')
                    ? `https://www.youtube.com/embed/${videoUrl.split('v=')[1].split('&')[0]}`
                    : videoUrl.includes('youtu.be/')
                    ? `https://www.youtube.com/embed/${videoUrl.split('youtu.be/')[1].split('?')[0]}`
                    : videoUrl
                  }
                  title={editingExercise.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleCancel}>
                İptal
              </button>
              <button
                className="btn-save"
                onClick={handleSaveVideo}
                disabled={!videoUrl}
              >
                💾 Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoManager;
