import React, { useEffect, useState } from 'react';
import './ProfileSettings.css';

function ProfileSettings({ profile, onSave }) {
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedProfile({ ...profile });
    setHasChanges(false);
  }, [profile]);

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
                value={editedProfile.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="">Seçiniz</option>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>

            <div className="profile-field">
              <label>Kilo (kg)</label>
              <input
                type="number"
                value={editedProfile.weight || ''}
                onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
                min="30"
                max="300"
                step="0.1"
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

      </div>

      <div className="profile-actions">
        {hasChanges && (
          <>
            <button className="btn-cancel" onClick={handleCancel}>
              İptal
            </button>
            <button className="profile-settings-btn-save" onClick={handleSave}>
              Değişiklikleri Kaydet
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfileSettings;
