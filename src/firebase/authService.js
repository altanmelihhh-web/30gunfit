import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './config';

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
 * Google ile giriş yap
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Kullanıcı ilk defa mı giriş yapıyor kontrol et
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      // İlk giriş - kullanıcı belgesi oluştur
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
    } else {
      // Var olan kullanıcı - son giriş zamanını güncelle
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: new Date().toISOString()
      }, { merge: true });
    }

    return { success: true, user };
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
  logout,
  resetPassword,
  getCurrentUser
};
