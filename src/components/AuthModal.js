import React, { useState } from 'react';
import './AuthModal.css';
import { registerWithEmail, loginWithEmail, loginWithGoogle, resetPassword } from '../firebase/authService';

const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER: 'register',
  RESET_PASSWORD: 'reset'
};

function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState(AUTH_MODES.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === AUTH_MODES.REGISTER) {
        if (!displayName.trim()) {
          setError('Lütfen adınızı girin');
          setLoading(false);
          return;
        }

        const result = await registerWithEmail(email, password, displayName);
        if (result.success) {
          setSuccessMessage('✅ Kayıt başarılı! Hoş geldiniz!');
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(result.user);
          }, 1000);
        } else {
          setError(getErrorMessage(result.error));
        }
      } else if (mode === AUTH_MODES.LOGIN) {
        const result = await loginWithEmail(email, password);
        if (result.success) {
          setSuccessMessage('✅ Giriş başarılı!');
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(result.user);
          }, 1000);
        } else {
          setError(getErrorMessage(result.error));
        }
      } else if (mode === AUTH_MODES.RESET_PASSWORD) {
        const result = await resetPassword(email);
        if (result.success) {
          setSuccessMessage('✅ Şifre sıfırlama linki email adresinize gönderildi!');
          setTimeout(() => {
            setMode(AUTH_MODES.LOGIN);
            setSuccessMessage('');
          }, 3000);
        } else {
          setError(getErrorMessage(result.error));
        }
      }
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await loginWithGoogle();
      if (result.success) {
        setSuccessMessage('✅ Google ile giriş başarılı!');
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess(result.user);
        }, 1000);
      } else {
        setError(getErrorMessage(result.error));
      }
    } catch (err) {
      setError('Google girişi sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    const errors = {
      'auth/email-already-in-use': 'Bu email adresi zaten kullanılıyor',
      'auth/weak-password': 'Şifre en az 6 karakter olmalı',
      'auth/invalid-email': 'Geçersiz email adresi',
      'auth/user-not-found': 'Kullanıcı bulunamadı',
      'auth/wrong-password': 'Hatalı şifre',
      'auth/too-many-requests': 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin',
      'auth/network-request-failed': 'İnternet bağlantınızı kontrol edin'
    };

    for (const [code, message] of Object.entries(errors)) {
      if (errorCode.includes(code)) return message;
    }

    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  };

  const renderTitle = () => {
    if (mode === AUTH_MODES.REGISTER) return 'Kayıt Ol';
    if (mode === AUTH_MODES.RESET_PASSWORD) return 'Şifre Sıfırla';
    return 'Giriş Yap';
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="auth-modal-header">
          <h2>{renderTitle()}</h2>
          <p>
            {mode === AUTH_MODES.LOGIN && 'Hesabınıza giriş yapın ve ilerlemenizi kaydedin'}
            {mode === AUTH_MODES.REGISTER && 'Yeni hesap oluşturun ve programınıza başlayın'}
            {mode === AUTH_MODES.RESET_PASSWORD && 'Email adresinize şifre sıfırlama linki göndereceğiz'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === AUTH_MODES.REGISTER && (
            <div className="form-group">
              <label>Adınız</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adınızı girin"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
            />
          </div>

          {mode !== AUTH_MODES.RESET_PASSWORD && (
            <div className="form-group">
              <label>Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {successMessage && <div className="auth-success">{successMessage}</div>}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? '⏳ Lütfen bekleyin...' : renderTitle()}
          </button>
        </form>

        {mode === AUTH_MODES.LOGIN && (
          <>
            <div className="auth-divider">
              <span>veya</span>
            </div>

            <button
              className="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Google ile Giriş Yap
            </button>
          </>
        )}

        <div className="auth-footer">
          {mode === AUTH_MODES.LOGIN && (
            <>
              <button
                type="button"
                className="auth-link"
                onClick={() => setMode(AUTH_MODES.REGISTER)}
              >
                Hesabınız yok mu? Kayıt olun
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => setMode(AUTH_MODES.RESET_PASSWORD)}
              >
                Şifrenizi mi unuttunuz?
              </button>
            </>
          )}

          {mode === AUTH_MODES.REGISTER && (
            <button
              type="button"
              className="auth-link"
              onClick={() => setMode(AUTH_MODES.LOGIN)}
            >
              Zaten hesabınız var mı? Giriş yapın
            </button>
          )}

          {mode === AUTH_MODES.RESET_PASSWORD && (
            <button
              type="button"
              className="auth-link"
              onClick={() => setMode(AUTH_MODES.LOGIN)}
            >
              Giriş sayfasına dön
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
