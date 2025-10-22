import React, { useState } from 'react';
import './ProfileSettings.css';
import { FITNESS_GOALS, DIFFICULTY_LEVELS } from '../data/exerciseLibrary';

function ProfileSettings({ profile, onSave, onRegenerateProgram }) {
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field, value) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // BMI yeniden hesapla
    if (editedProfile.height && editedProfile.weight) {
      const heightInMeters = editedProfile.height / 100;
      const bmi = (editedProfile.weight / (heightInMeters * heightInMeters)).toFixed(1);
      editedProfile.bmi = parseFloat(bmi);
    }

    onSave(editedProfile);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setEditedProfile({ ...profile });
    setHasChanges(false);
  };

  const handleRegenerateProgram = () => {
    handleSave();
    setTimeout(() => {
      onRegenerateProgram(editedProfile);
    }, 100);
  };

  const goalNames = {
    [FITNESS_GOALS.WEIGHT_LOSS]: 'Kilo Vermek',
    [FITNESS_GOALS.MUSCLE_GAIN]: 'Kas Yapmak',
    [FITNESS_GOALS.HIIT_FOCUS]: 'HIIT Antrenmanı',
    [FITNESS_GOALS.GENERAL_FITNESS]: 'Genel Fitness',
    [FITNESS_GOALS.BEGINNER_FRIENDLY]: 'Başlangıç Dostu'
  };

  const difficultyNames = {
    [DIFFICULTY_LEVELS.BEGINNER]: 'Başlangıç',
    [DIFFICULTY_LEVELS.INTERMEDIATE]: 'Orta Seviye',
    [DIFFICULTY_LEVELS.ADVANCED]: 'İleri Seviye'
  };

  return (
    <div className="profile-settings">
      <div className="profile-header">
        <h2>Profilim</h2>
        <p>Bilgilerinizi güncelleyin ve programınızı yenileyin</p>
      </div>

      <div className="profile-body">
        <div className="profile-section">
          <h3>Kişisel Bilgiler</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <label>İsim</label>
              <input
                type="text"
                value={editedProfile.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>

            <div className="profile-field">
              <label>Yaş</label>
              <input
                type="number"
                value={editedProfile.age || ''}
                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                min="13"
                max="100"
              />
            </div>

            <div className="profile-field">
              <label>Cinsiyet</label>
              <select
                value={editedProfile.gender || 'male'}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
                <option value="other">Diğer</option>
              </select>
            </div>

            <div className="profile-field">
              <label>Kilo (kg)</label>
              <input
                type="number"
                value={editedProfile.weight || ''}
                onChange={(e) => handleChange('weight', parseInt(e.target.value))}
                min="30"
                max="300"
              />
            </div>

            <div className="profile-field">
              <label>Boy (cm)</label>
              <input
                type="number"
                value={editedProfile.height || ''}
                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                min="100"
                max="250"
              />
            </div>

            <div className="profile-field">
              <label>BMI</label>
              <input
                type="text"
                value={profile.bmi || 'N/A'}
                disabled
                className="disabled-field"
              />
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h3>Antrenman Tercihleri</h3>
          <div className="profile-grid">
            <div className="profile-field full-width">
              <label>Hedef</label>
              <select
                value={editedProfile.goal || FITNESS_GOALS.GENERAL_FITNESS}
                onChange={(e) => handleChange('goal', e.target.value)}
              >
                {Object.entries(goalNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            <div className="profile-field full-width">
              <label>Deneyim Seviyesi</label>
              <select
                value={editedProfile.difficulty || DIFFICULTY_LEVELS.BEGINNER}
                onChange={(e) => handleChange('difficulty', e.target.value)}
              >
                {Object.entries(difficultyNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            <div className="profile-field">
              <label>Günlük Süre (dakika)</label>
              <select
                value={editedProfile.dailyDuration || 30}
                onChange={(e) => handleChange('dailyDuration', parseInt(e.target.value))}
              >
                <option value={15}>15 dakika</option>
                <option value={30}>30 dakika</option>
                <option value={45}>45 dakika</option>
                <option value={60}>60 dakika</option>
              </select>
            </div>

            <div className="profile-field">
              <label>Haftalık Antrenman</label>
              <select
                value={editedProfile.weeklyDays || 5}
                onChange={(e) => handleChange('weeklyDays', parseInt(e.target.value))}
              >
                <option value={3}>3 gün/hafta</option>
                <option value={4}>4 gün/hafta</option>
                <option value={5}>5 gün/hafta</option>
                <option value={6}>6 gün/hafta</option>
                <option value={7}>7 gün/hafta</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        {hasChanges && (
          <>
            <button className="btn-cancel" onClick={handleCancel}>
              İptal
            </button>
            <button className="btn-save" onClick={handleSave}>
              Değişiklikleri Kaydet
            </button>
          </>
        )}

        <button
          className="btn-regenerate"
          onClick={handleRegenerateProgram}
          title="Mevcut profil bilgilerinize göre yeni 30 günlük program oluşturur"
        >
          🔄 Yeni Program Oluştur
        </button>
      </div>

      <div className="profile-warning">
        <strong>⚠️ Uyarı:</strong> Yeni program oluşturduğunuzda mevcut ilerlemeniz sıfırlanacaktır.
        Bu işlem geri alınamaz!
      </div>
    </div>
  );
}

export default ProfileSettings;
