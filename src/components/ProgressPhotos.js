import React, { useState, useEffect, useRef } from 'react';
import './ProgressPhotos.css';

/**
 * ProgressPhotos - İlerleme fotoğrafları takibi
 * - Fotoğraf yükleme/çekme
 * - Karşılaştırma (before/after)
 * - Tarih ve notlarla birlikte saklama
 * - localStorage ile kalıcı veri
 */

const ProgressPhotos = () => {
  const [photos, setPhotos] = useState([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedComparePhotos, setSelectedComparePhotos] = useState([]);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadTag, setUploadTag] = useState('front');
  const fileInputRef = useRef(null);

  // Fotoğraf etiketleri
  const photoTags = [
    { value: 'front', label: '📸 Ön', icon: '📸' },
    { value: 'back', label: '🔄 Arka', icon: '🔄' },
    { value: 'side', label: '↔️ Yan', icon: '↔️' },
    { value: 'other', label: '📷 Diğer', icon: '📷' }
  ];

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('progress_photos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPhotos(parsed);
      } catch (error) {
        console.error('Fotoğraflar yüklenirken hata:', error);
      }
    }
  }, []);

  // localStorage'a kaydet
  useEffect(() => {
    if (photos.length > 0) {
      try {
        localStorage.setItem('progress_photos', JSON.stringify(photos));
      } catch (error) {
        console.error('Fotoğraflar kaydedilirken hata:', error);
        alert('Fotoğraf kaydedilemedi. Muhtemelen çok büyük bir dosya seçtiniz.');
      }
    }
  }, [photos]);

  // Fotoğraf yükleme
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Dosya boyutu kontrolü (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Fotoğraf boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    // Dosya tipi kontrolü
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir resim dosyası seçin');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const photo = {
        id: Date.now(),
        image: e.target.result,
        date: new Date().toISOString(),
        note: uploadNote,
        tag: uploadTag
      };

      setPhotos([photo, ...photos]);
      setUploadNote('');
      setUploadTag('front');
      setShowUploadForm(false);

      // Input'u temizle
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Fotoğraf silme
  const deletePhoto = (id) => {
    if (window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) {
      setPhotos(photos.filter(p => p.id !== id));
      if (selectedPhoto?.id === id) {
        setSelectedPhoto(null);
      }
      // Karşılaştırma modundaysa seçimleri temizle
      if (compareMode) {
        setSelectedComparePhotos(selectedComparePhotos.filter(p => p.id !== id));
      }
    }
  };

  // Karşılaştırma modu toggle
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedComparePhotos([]);
    setSelectedPhoto(null);
  };

  // Karşılaştırma için fotoğraf seçme
  const selectForCompare = (photo) => {
    if (selectedComparePhotos.length < 2) {
      setSelectedComparePhotos([...selectedComparePhotos, photo]);
    } else {
      // İki fotoğraf zaten seçiliyse, ilkini çıkar yenisini ekle
      setSelectedComparePhotos([selectedComparePhotos[1], photo]);
    }
  };

  // Karşılaştırma seçimini iptal et
  const deselectForCompare = (photoId) => {
    setSelectedComparePhotos(selectedComparePhotos.filter(p => p.id !== photoId));
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Tag label'ını al
  const getTagLabel = (tag) => {
    const found = photoTags.find(t => t.value === tag);
    return found ? found.label : '📷 Diğer';
  };

  // Etiket bazlı gruplandırma
  const groupedPhotos = photos.reduce((acc, photo) => {
    if (!acc[photo.tag]) {
      acc[photo.tag] = [];
    }
    acc[photo.tag].push(photo);
    return acc;
  }, {});

  return (
    <div className="progress-photos">
      <div className="photos-header">
        <h2>📸 İlerleme Fotoğrafları</h2>
        <div className="header-actions">
          {photos.length >= 2 && (
            <button
              className={`btn-compare ${compareMode ? 'active' : ''}`}
              onClick={toggleCompareMode}
            >
              {compareMode ? '✖️ Karşılaştırmayı Kapat' : '⚖️ Karşılaştır'}
            </button>
          )}
          <button
            className="btn-upload"
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? '❌ İptal' : '➕ Fotoğraf Ekle'}
          </button>
        </div>
      </div>

      {/* Yükleme formu */}
      {showUploadForm && (
        <div className="upload-form">
          <div className="form-section">
            <label>📷 Fotoğraf Seç</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="file-input"
            />
            <p className="help-text">Maksimum 5MB, JPG, PNG veya WebP formatında</p>
          </div>

          <div className="form-section">
            <label>🏷️ Etiket</label>
            <div className="tag-buttons">
              {photoTags.map((tag) => (
                <button
                  key={tag.value}
                  className={`tag-btn ${uploadTag === tag.value ? 'active' : ''}`}
                  onClick={() => setUploadTag(tag.value)}
                >
                  {tag.icon} {tag.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label>📝 Not (Opsiyonel)</label>
            <textarea
              value={uploadNote}
              onChange={(e) => setUploadNote(e.target.value)}
              placeholder="Kilo, vücut ölçüleri, hisleriniz vs..."
              rows="3"
            />
          </div>
        </div>
      )}

      {/* Karşılaştırma modu */}
      {compareMode && (
        <div className="compare-section">
          <h3>⚖️ Fotoğraf Karşılaştırma</h3>
          <p className="compare-hint">
            {selectedComparePhotos.length === 0 && 'Karşılaştırmak için 2 fotoğraf seçin'}
            {selectedComparePhotos.length === 1 && 'Bir fotoğraf daha seçin'}
            {selectedComparePhotos.length === 2 && 'Karşılaştırma hazır! Aşağıda görüntüleniyor'}
          </p>

          {selectedComparePhotos.length === 2 && (
            <div className="compare-view">
              {selectedComparePhotos.map((photo, index) => (
                <div key={photo.id} className="compare-item">
                  <div className="compare-label">
                    {index === 0 ? '📅 Önce' : '📅 Sonra'}
                  </div>
                  <img src={photo.image} alt={`Karşılaştırma ${index + 1}`} />
                  <div className="compare-info">
                    <span className="compare-date">{formatDate(photo.date)}</span>
                    {photo.note && <p className="compare-note">{photo.note}</p>}
                  </div>
                  <button
                    className="btn-remove-compare"
                    onClick={() => deselectForCompare(photo.id)}
                  >
                    ✖️ Kaldır
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* İstatistikler */}
      {photos.length > 0 && (
        <div className="stats-section">
          <div className="stat-box">
            <span className="stat-icon">📷</span>
            <div className="stat-content">
              <span className="stat-value">{photos.length}</span>
              <span className="stat-label">Toplam Fotoğraf</span>
            </div>
          </div>
          {Object.keys(groupedPhotos).map((tag) => (
            <div key={tag} className="stat-box">
              <span className="stat-icon">{photoTags.find(t => t.value === tag)?.icon || '📷'}</span>
              <div className="stat-content">
                <span className="stat-value">{groupedPhotos[tag].length}</span>
                <span className="stat-label">{getTagLabel(tag).split(' ')[1]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fotoğraf galerisi */}
      <div className="photos-gallery">
        {photos.length === 0 ? (
          <div className="progress-photos-empty-state">
            <span className="empty-icon">📸</span>
            <h3>Henüz fotoğraf eklenmemiş</h3>
            <p>İlerlemenizi takip etmek için fotoğraf eklemeye başlayın</p>
            <button
              className="btn-start"
              onClick={() => setShowUploadForm(true)}
            >
              ➕ İlk Fotoğrafı Ekle
            </button>
          </div>
        ) : (
          <div className="photos-grid">
            {photos.map((photo) => {
              const isSelected = selectedComparePhotos.some(p => p.id === photo.id);
              const selectionOrder = selectedComparePhotos.findIndex(p => p.id === photo.id) + 1;

              return (
                <div
                  key={photo.id}
                  className={`photo-card ${isSelected ? 'selected' : ''} ${compareMode ? 'compare-mode' : ''}`}
                  onClick={() => {
                    if (compareMode) {
                      if (isSelected) {
                        deselectForCompare(photo.id);
                      } else if (selectedComparePhotos.length < 2) {
                        selectForCompare(photo);
                      }
                    } else {
                      setSelectedPhoto(photo);
                    }
                  }}
                >
                  {isSelected && (
                    <div className="selection-badge">{selectionOrder}</div>
                  )}
                  <div className="photo-image">
                    <img src={photo.image} alt="Progress" />
                  </div>
                  <div className="photo-details">
                    <div className="photo-meta">
                      <span className="photo-tag">{getTagLabel(photo.tag)}</span>
                      <span className="photo-date">{formatDate(photo.date)}</span>
                    </div>
                    {photo.note && (
                      <p className="photo-note">{photo.note}</p>
                    )}
                    <button
                      className="btn-delete-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhoto(photo.id);
                      }}
                    >
                      🗑️ Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detay modal */}
      {selectedPhoto && !compareMode && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setSelectedPhoto(null)}
            >
              ✖️
            </button>
            <img src={selectedPhoto.image} alt="Progress Detail" />
            <div className="modal-info">
              <div className="modal-meta">
                <span className="modal-tag">{getTagLabel(selectedPhoto.tag)}</span>
                <span className="modal-date">{formatDate(selectedPhoto.date)}</span>
              </div>
              {selectedPhoto.note && (
                <p className="modal-note">{selectedPhoto.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kullanım ipuçları */}
      {photos.length === 0 && (
        <div className="tips-section">
          <h4>💡 Fotoğraf İpuçları</h4>
          <ul>
            <li>Her hafta aynı gün ve saatte fotoğraf çekin</li>
            <li>Aynı kıyafet ve aydınlatma kullanın</li>
            <li>Ön, arka ve yan pozisyonlarda çekim yapın</li>
            <li>Kilo ve ölçülerinizi notlara ekleyin</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProgressPhotos;
