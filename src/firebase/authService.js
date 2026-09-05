import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './config';

const upsertGoogleUserDocument = async (user) => {
  const userDoc = await getDoc(doc(db, 'users', user.uid));

  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });
    return;
  }

  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLogin: new Date().toISOString()
  }, { merge: true });
};

/**
 * Email ile kayıt ol
 */
export const registerWithEmail = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Kullanıcı profilini güncelle
    await updateProfile(user, { displayName });

    // Firestore'da kullanıcı belgesi oluştur
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });

    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Email ile giriş yap
 */
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Son giriş zamanını güncelle
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      lastLogin: new Date().toISOString()
    }, { merge: true });

    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Google ile giriş yap - redirect yöntemi kullanılır (popup mobil tarayıcılarda
 * ve PWA modunda güvenilir çalışmıyor, oturum hatalarına yol açabiliyor)
 * Sayfa Google'a yönlenip geri döner; sonuç handleGoogleRedirectResult() ile alınır.
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await upsertGoogleUserDocument(result.user);
    return { success: true, user: result.user };
  } catch (error) {
    if ([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ].some((code) => error.code === code || error.message?.includes(code))) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return { success: true, pendingRedirect: true };
      } catch (redirectError) {
        return { success: false, error: redirectError.code || redirectError.message };
      }
    }
    return { success: false, error: error.message };
  }
};

/**
 * Google Drive iznini normal girişten ayrı ister.
 * Sadece kullanıcının uygulamanın oluşturduğu Drive dosyalarına erişim kapsamı eklenir.
 */
export const requestGoogleDriveAccess = async () => {
  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope('https://www.googleapis.com/auth/drive.file');

  try {
    const result = await signInWithPopup(auth, driveProvider);
    await upsertGoogleUserDocument(result.user);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { success: true, user: result.user, driveAccessToken: credential?.accessToken || null };
  } catch (error) {
    if ([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ].some((code) => error.code === code || error.message?.includes(code))) {
      try {
        await signInWithRedirect(auth, driveProvider);
        return { success: true, pendingRedirect: true };
      } catch (redirectError) {
        return { success: false, error: redirectError.code || redirectError.message };
      }
    }
    return { success: false, error: error.code || error.message };
  }
};

/**
 * Uygulama açılışında bir kere çağrılır - kullanıcı Google'dan yeni yönlendiyse
 * ilk girişse Firestore kullanıcı belgesini oluşturur, değilse son giriş zamanını günceller
 */
export const handleGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) {
      return { success: false };
    }
    const user = result.user;
    await upsertGoogleUserDocument(user);

    // Google Drive erişim token'ı - sadece bellekte tutulur, Firestore'a kaydedilmez
    // (kısa ömürlü, ~1 saat sonra süresi doluyor, gerekirse tekrar giriş istenir)
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const driveAccessToken = credential?.accessToken || null;

    return { success: true, user, driveAccessToken };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Çıkış yap
 */
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Şifre sıfırlama emaili gönder
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Mevcut kullanıcıyı al
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

export default {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  requestGoogleDriveAccess,
  handleGoogleRedirectResult,
  logout,
  resetPassword,
  getCurrentUser
};
