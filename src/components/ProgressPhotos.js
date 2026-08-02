import React, { useState, useEffect, useRef } from 'react';
import './ProgressPhotos.css';
import { getProgressPhotos, saveProgressPhotos } from '../firebase/dataService';
import { uploadProgressPhotoToDrive, fetchDriveImageUrl } from '../utils/driveService';

/**
 * ProgressPhotos - İlerleme fotoğrafları takibi
 * - Fotoğraf yükleme/çekme
 * - Karşılaştırma (before/after)
 * - Tarih ve notlarla birlikte saklama
 * - Görsel Google Drive'da, meta veri Firestore'da (localStorage quota sorunu yok)
 * - Eski base64/localStorage fotoğraflar Drive bağlantısı kurulunca otomatik buluta taşınır
 */

const ProgressPhotos = ({ user, driveAccessToken, onRequestDriveAccess }) => {
  const [photos, setPhotos] = useState([]);
  const [imageUrls, setImageUrls] = useState({}); // driveFileId -> blob URL
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedComparePhotos, setSelectedComparePhotos] = useState([]);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadTag, setUploadTag] = useState('front');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const isLoadedRef = useRef(false);

  // Fotoğraf etiketleri
  const photoTags = [
    { value: 'front', label: '📸 Ön', icon: '📸' },
    { value: 'back', label: '🔄 Arka', icon: '🔄' },
    { value: 'side', label: '↔️ Yan', icon: '↔️' },
    { value: 'other', label: '📷 Diğer', icon: '📷' }
  ];

  // Yükle - giriş yapılmışsa Firestore meta verisi + localStorage'daki eski base64 kayıtlar
  useEffect(() => {
    const load = async () => {
      let cloudEntries = [];
      if (user) {
        const result = await getProgressPhotos(user.uid);
        if (result.success) {
          cloudEntries = result.data.entries || [];
        }
      }

      let localEntries = [];
      const saved = localStorage.getItem('progress_photos');
      if (saved) {
        try {
          // Eski format: base64 image alanı olan kayıtlar
          localEntries = JSON.parse(saved).filter((p) => p.image);
        } catch (error) {
          console.error('Fotoğraflar yüklenirken hata:', error);
        }
      }

      // Bulut + eski yerel kayıtlar (id çakışması olursa bulut kazanır)
      const cloudIds = new Set(cloudEntries.map((p) => p.id));
      setPhotos([...cloudEntries, ...localEntries.filter((p) => !cloudIds.has(p.id))]
        .sort((a, b) => new Date(b.date) - new Date(a.date)));
      isLoadedRef.current = true;
    };
    load();
  }, [user]);

  // Eski base64 fotoğrafları Drive bağlantısı kurulunca otomatik buluta taşı
  useEffect(() => {
    if (!user || !driveAccessToken || !isLoadedRef.current) return;
    const legacy = photos.filter((p) => p.image);
    if (legacy.length === 0) return;

    let cancelled = false;
    (async () => {
      const migrated = [];
      for (const photo of legacy) {
        try {
          const blob = await (await fetch(photo.image)).blob();
          const file = new File([blob], `legacy_${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
          const driveFileId = await uploadProgressPhotoToDrive(driveAccessToken, file, `progress_${photo.id}.jpg`);
          migrated.push({ id: photo.id, date: photo.date, note: photo.note || '', tag: photo.tag || 'other', driveFileId });
        } catch (err) {
          console.error('Eski fotoğraf taşıma hatası:', err);
        }
      }
      if (cancelled || migrated.length === 0) return;

      const migratedIds = new Set(migrated.map((m) => m.id));
      const updated = [...photos.filter((p) => !migratedIds.has(p.id)), ...migrated]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setPhotos(updated);
      await saveProgressPhotos(user.uid, updated.filter((p) => p.driveFileId));
      // Taşınanları localStorage'dan temizle (quota geri kazanılır)
      localStorage.setItem('progress_photos', JSON.stringify(updated.filter((p) => p.image)));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, driveAccessToken, photos.length]);

  // Drive'daki görselleri blob URL'e çevir
  useEffect(() => {
    if (!driveAccessToken) return;
    photos.forEach((photo) => {
      if (!photo.driveFileId || imageUrls[photo.driveFileId]) return;
      fetchDriveImageUrl(driveAccessToken, photo.driveFileId)
        .then((url) => setImageUrls((prev) => ({ ...prev, [photo.driveFileId]: url })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, driveAccessToken]);

  const getPhotoSrc = (photo) => photo.image || imageUrls[photo.driveFileId] || null;

  // Fotoğraf yükleme
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Fotoğraf boyutu 10MB\'dan küçük olmalıdır');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir resim dosyası seçin');
      return;
    }

    // Buluta yükleme (esas yol): görsel Drive'a, meta veri Firestore'a
    if (user && driveAccessToken) {
      setIsUploading(true);
      try {
        const id = Date.now();
        const driveFileId = await uploadProgressPhotoToDrive(driveAccessToken, file, `progress_${id}.jpg`);
        const photo = { id, date: new Date().toISOString(), note: uploadNote, tag: uploadTag, driveFileId };
        const updated = [photo, ...photos];
        setPhotos(updated);
        await saveProgressPhotos(user.uid, updated.filter((p) => p.driveFileId));
        setUploadNote('');
        setUploadTag('front');
        setShowUploadForm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('Drive yükleme hatası: ' + err.message + '. Drive bağlantını yenilemeyi dene.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Drive bağlantısı yoksa eski base64/localStorage yolu (geçici yedek)
    const reader = new FileReader();
    reader.onload = (e) => {
      const photo = {
        id: Date.now(),
        image: e.target.result,
        date: new Date().toISOString(),
        note: uploadNote,
        tag: uploadTag
      };
      const updated = [photo, ...photos];
      setPhotos(updated);
      try {
        localStorage.setItem('progress_photos', JSON.stringify(updated.filter((p) => p.image)));
      } catch (error) {
        alert('Fotoğraf yerel olarak kaydedilemedi (alan doldu). Drive\'a bağlanarak buluta kaydedebilirsin.');
      }
      setUploadNote('');
      setUploadTag('front');
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Fotoğraf silme
  const deletePhoto = async (id) => {
    if (!window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) return;
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    if (selectedPhoto?.id === id) {
      setSelectedPhoto(null);
    }
    if (compareMode) {
      setSelectedComparePhotos(selectedComparePhotos.filter(p => p.id !== id));
    }
    if (user) {
      await saveProgressPhotos(user.uid, updated.filter((p) => p.driveFileId));
    }
    localStorage.setItem('progress_photos', JSON.stringify(updated.filter((p) => p.image)));
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

      {/* Drive bağlantı ipucu */}
      {user && !driveAccessToken && (
        <div className="drive-hint">
          ☁️ Fotoğrafların buluta (Google Drive) kaydedilmesi için bağlantı gerekli — bağlanmazsan fotoğraflar sadece bu cihazda kalır.{' '}
          <button type="button" className="drive-connect-btn" onClick={onRequestDriveAccess}>
            Drive'a Bağlan
          </button>
        </div>
      )}

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
              disabled={isUploading}
            />
            <p className="help-text">
              {isUploading ? '☁️ Drive\'a yükleniyor...' : 'Maksimum 10MB, JPG, PNG veya WebP formatında'}
            </p>
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
                  {getPhotoSrc(photo)
                    ? <img src={getPhotoSrc(photo)} alt={`Karşılaştırma ${index + 1}`} />
                    : <div className="photo-placeholder">📷 Drive bağlantısı gerekli</div>}
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
                    {getPhotoSrc(photo)
                      ? <img src={getPhotoSrc(photo)} alt="Progress" />
                      : <div className="photo-placeholder">📷 Drive bağlantısı gerekli</div>}
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
            {getPhotoSrc(selectedPhoto)
              ? <img src={getPhotoSrc(selectedPhoto)} alt="Progress Detail" />
              : <div className="photo-placeholder">📷 Drive bağlantısı gerekli</div>}
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
