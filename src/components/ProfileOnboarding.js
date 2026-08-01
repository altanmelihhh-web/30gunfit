import React, { useState } from 'react';
import './ProfileOnboarding.css';
import { FITNESS_GOALS, DIFFICULTY_LEVELS } from '../data/exerciseLibrary';

const STEPS = {
  WELCOME: 0,
  PERSONAL_INFO: 1,
  GOAL: 2,
  EXPERIENCE: 3,
  SCHEDULE: 4,
  SUMMARY: 5
};

const TOTAL_STEPS = Object.keys(STEPS).length;

function ProfileOnboarding({ isOpen, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    weight: '',
    height: '',
    gender: 'male',
    goal: FITNESS_GOALS.GENERAL_FITNESS,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    dailyDuration: 30,
    weeklyDays: 5
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = () => {
    const newErrors = {};

    if (currentStep === STEPS.PERSONAL_INFO) {
      if (!formData.name.trim()) newErrors.name = 'İsim gerekli';
      if (!formData.age || formData.age < 13 || formData.age > 100) newErrors.age = 'Geçerli yaş girin (13-100)';
      if (!formData.weight || formData.weight < 30 || formData.weight > 300) newErrors.weight = 'Geçerli kilo girin (30-300 kg)';
      if (!formData.height || formData.height < 100 || formData.height > 250) newErrors.height = 'Geçerli boy girin (100-250 cm)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // BMI hesapla
    const heightInMeters = formData.height / 100;
    const bmi = (formData.weight / (heightInMeters * heightInMeters)).toFixed(1);

    const profile = {
      ...formData,
      age: parseInt(formData.age),
      weight: parseInt(formData.weight),
      height: parseInt(formData.height),
      bmi: parseFloat(bmi),
      createdAt: new Date().toISOString()
    };

    onComplete(profile);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const renderProgress = () => (
    <div className="onboarding-progress">
      <div className="progress-bar">
        <div
          className="profile-onboarding-progress-fill"
          style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>
      <span className="progress-text">
        Adım {currentStep + 1} / {TOTAL_STEPS}
      </span>
    </div>
  );

  const renderWelcome = () => (
    <div className="onboarding-step welcome-step">
      <div className="welcome-icon">💪</div>
      <h2>30 Gün Fit'e Hoş Geldiniz!</h2>
      <p className="welcome-description">
        Size özel bir fitness programı oluşturmak için birkaç soru soracağız.
        Sadece 2 dakikanızı alacak!
      </p>
      <ul className="welcome-features">
        <li>✨ Kişiselleştirilmiş 30 günlük program</li>
        <li>🎯 Hedefinize uygun egzersizler</li>
        <li>📊 İlerleme takibi</li>
        <li>🔔 Hatırlatmalar</li>
      </ul>
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="onboarding-step">
      <h2>Kendini Tanıtalım</h2>
      <p className="step-description">Bu bilgiler programınızı kişiselleştirmemize yardımcı olacak.</p>

      <div className="profile-onboarding-form-group">
        <label>İsminiz</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Örn: Ahmet"
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="profile-onboarding-form-group">
          <label>Yaş</label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => handleChange('age', e.target.value)}
            placeholder="25"
            min="13"
            max="100"
            className={errors.age ? 'error' : ''}
          />
          {errors.age && <span className="error-text">{errors.age}</span>}
        </div>

        <div className="profile-onboarding-form-group">
          <label>Cinsiyet</label>
          <select
            value={formData.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
          >
            <option value="male">Erkek</option>
            <option value="female">Kadın</option>
            <option value="other">Diğer</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="profile-onboarding-form-group">
          <label>Kilo (kg)</label>
          <input
            type="number"
            value={formData.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            placeholder="70"
            min="30"
            max="300"
            className={errors.weight ? 'error' : ''}
          />
          {errors.weight && <span className="error-text">{errors.weight}</span>}
        </div>

        <div className="profile-onboarding-form-group">
          <label>Boy (cm)</label>
          <input
            type="number"
            value={formData.height}
            onChange={(e) => handleChange('height', e.target.value)}
            placeholder="175"
            min="100"
            max="250"
            className={errors.height ? 'error' : ''}
          />
          {errors.height && <span className="error-text">{errors.height}</span>}
        </div>
      </div>
    </div>
  );

  const renderGoal = () => (
    <div className="onboarding-step">
      <h2>Hedefiniz Nedir?</h2>
      <p className="step-description">Sizin için en uygun programı oluşturalım.</p>

      <div className="goal-options">
        <button
          className={`goal-card ${formData.goal === FITNESS_GOALS.WEIGHT_LOSS ? 'selected' : ''}`}
          onClick={() => handleChange('goal', FITNESS_GOALS.WEIGHT_LOSS)}
        >
          <div className="goal-icon">🔥</div>
          <h3>Kilo Vermek</h3>
          <p>Yoğun cardio ve HIIT odaklı program</p>
        </button>

        <button
          className={`goal-card ${formData.goal === FITNESS_GOALS.MUSCLE_GAIN ? 'selected' : ''}`}
          onClick={() => handleChange('goal', FITNESS_GOALS.MUSCLE_GAIN)}
        >
          <div className="goal-icon">💪</div>
          <h3>Kas Yapmak</h3>
          <p>Strength training odaklı program</p>
        </button>

        <button
          className={`goal-card ${formData.goal === FITNESS_GOALS.HIIT_FOCUS ? 'selected' : ''}`}
          onClick={() => handleChange('goal', FITNESS_GOALS.HIIT_FOCUS)}
        >
          <div className="goal-icon">⚡</div>
          <h3>HIIT Antrenmanı</h3>
          <p>Kısa süre, yüksek yoğunluk</p>
        </button>

        <button
          className={`goal-card ${formData.goal === FITNESS_GOALS.GENERAL_FITNESS ? 'selected' : ''}`}
          onClick={() => handleChange('goal', FITNESS_GOALS.GENERAL_FITNESS)}
        >
          <div className="goal-icon">🎯</div>
          <h3>Genel Fitness</h3>
          <p>Dengeli ve kapsamlı program</p>
        </button>

        <button
          className={`goal-card ${formData.goal === FITNESS_GOALS.BEGINNER_FRIENDLY ? 'selected' : ''}`}
          onClick={() => handleChange('goal', FITNESS_GOALS.BEGINNER_FRIENDLY)}
        >
          <div className="goal-icon">🌱</div>
          <h3>Başlangıç Dostu</h3>
          <p>Kolay ve temel hareketler</p>
        </button>
      </div>
    </div>
  );

  const renderExperience = () => (
    <div className="onboarding-step">
      <h2>Deneyim Seviyeniz</h2>
      <p className="step-description">Egzersizlerin zorluk seviyesini belirleyelim.</p>

      <div className="experience-options">
        <button
          className={`experience-card ${formData.difficulty === DIFFICULTY_LEVELS.BEGINNER ? 'selected' : ''}`}
          onClick={() => handleChange('difficulty', DIFFICULTY_LEVELS.BEGINNER)}
        >
          <h3>🌱 Başlangıç</h3>
          <p>Spor yapmaya yeni başlıyorum</p>
        </button>

        <button
          className={`experience-card ${formData.difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 'selected' : ''}`}
          onClick={() => handleChange('difficulty', DIFFICULTY_LEVELS.INTERMEDIATE)}
        >
          <h3>🏃 Orta Seviye</h3>
          <p>Düzenli olarak spor yapıyorum</p>
        </button>

        <button
          className={`experience-card ${formData.difficulty === DIFFICULTY_LEVELS.ADVANCED ? 'selected' : ''}`}
          onClick={() => handleChange('difficulty', DIFFICULTY_LEVELS.ADVANCED)}
        >
          <h3>💪 İleri Seviye</h3>
          <p>Deneyimliyim, challenge istiyorum</p>
        </button>
      </div>

      <div className="profile-onboarding-form-group" style={{ marginTop: '32px' }}>
        <label>Günlük Ne Kadar Süre Ayırabilirsiniz?</label>
        <p className="slider-description" style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Hızlı seçim için tıklayın veya kaydırıcıyı kullanın (10-90 dakika)
        </p>

        {/* Hızlı seçim butonları */}
        <div className="duration-options">
          {[15, 30, 45, 60].map(duration => (
            <button
              key={duration}
              className={`duration-btn ${formData.dailyDuration === duration ? 'selected' : ''}`}
              onClick={() => handleChange('dailyDuration', duration)}
            >
              {duration} dk
            </button>
          ))}
        </div>

        {/* Custom süre slider */}
        <div className="custom-duration-slider" style={{ marginTop: '24px', padding: '20px', background: 'var(--color-surface-muted)', borderRadius: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: '600' }}>Özel Süre:</span>
            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6366f1' }}>{formData.dailyDuration} dakika</span>
          </label>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={formData.dailyDuration}
            onChange={(e) => handleChange('dailyDuration', parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.dailyDuration - 10) / 80) * 100}%, #e5e7eb ${((formData.dailyDuration - 10) / 80) * 100}%, #e5e7eb 100%)`,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span>10 dk</span>
            <span>50 dk</span>
            <span>90 dk</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="onboarding-step">
      <h2>Haftalık Program</h2>
      <p className="step-description">Haftada kaç gün antrenman yapmak istersiniz?</p>

      <div className="schedule-options">
        {[3, 4, 5, 6, 7].map(days => (
          <button
            key={days}
            className={`schedule-card ${formData.weeklyDays === days ? 'selected' : ''}`}
            onClick={() => handleChange('weeklyDays', days)}
          >
            <div className="schedule-number">{days}</div>
            <div className="schedule-label">gün/hafta</div>
            <div className="schedule-rest">{7 - days} dinlenme günü</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSummary = () => {
    const heightInMeters = formData.height / 100;
    const bmi = formData.height > 0 ? (formData.weight / (heightInMeters * heightInMeters)).toFixed(1) : 0;

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
      <div className="onboarding-step summary-step">
        <h2>Profiliniz Hazır! 🎉</h2>
        <p className="step-description">Bilgilerinizi kontrol edin ve başlayalım.</p>

        <div className="summary-card">
          <div className="summary-row">
            <span className="summary-label">İsim:</span>
            <span className="summary-value">{formData.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Yaş:</span>
            <span className="summary-value">{formData.age}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Kilo / Boy:</span>
            <span className="summary-value">{formData.weight} kg / {formData.height} cm</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">BMI:</span>
            <span className="summary-value">{bmi}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Hedef:</span>
            <span className="summary-value">{goalNames[formData.goal]}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Seviye:</span>
            <span className="summary-value">{difficultyNames[formData.difficulty]}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Antrenman Süresi:</span>
            <span className="summary-value">{formData.dailyDuration} dakika/gün</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Haftalık Program:</span>
            <span className="summary-value">{formData.weeklyDays} gün antrenman, {7 - formData.weeklyDays} gün dinlenme</span>
          </div>
        </div>

        <div className="summary-note">
          Size özel 30 günlük fitness programınızı oluşturmaya hazırız! 🚀
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.WELCOME:
        return renderWelcome();
      case STEPS.PERSONAL_INFO:
        return renderPersonalInfo();
      case STEPS.GOAL:
        return renderGoal();
      case STEPS.EXPERIENCE:
        return renderExperience();
      case STEPS.SCHEDULE:
        return renderSchedule();
      case STEPS.SUMMARY:
        return renderSummary();
      default:
        return renderWelcome();
    }
  };

  return (
    <div className="profile-onboarding-overlay">
      <div className="profile-onboarding-modal">
        {currentStep !== STEPS.WELCOME && renderProgress()}

        <div className="onboarding-content">
          {renderStep()}
        </div>

        <div className="profile-onboarding-actions">
          {currentStep === STEPS.WELCOME ? (
            <>
              <button className="btn-secondary" onClick={handleSkip}>
                Atla, Varsayılan Programla Başla
              </button>
              <button className="btn-primary" onClick={handleNext}>
                Başlayalım
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={handleBack}>
                Geri
              </button>
              <button className="btn-primary" onClick={handleNext}>
                {currentStep === TOTAL_STEPS - 1 ? 'Programı Oluştur' : 'İleri'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileOnboarding;
