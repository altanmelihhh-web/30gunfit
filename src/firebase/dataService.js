import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

/**
 * Kullanıcı profilini kaydet
 */
export const saveUserProfile = async (userId, profileData) => {
  try {
    await setDoc(doc(db, 'userProfiles', userId), {
      ...profileData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Profile save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı profilini al
 */
export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, 'userProfiles', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Profil bulunamadı' };
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı programını kaydet
 */
export const saveUserProgram = async (userId, programData) => {
  try {
    await setDoc(doc(db, 'userPrograms', userId), {
      program: programData,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Program save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı programını al
 */
export const getUserProgram = async (userId) => {
  try {
    const docRef = doc(db, 'userPrograms', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data().program };
    } else {
      return { success: false, error: 'Program bulunamadı' };
    }
  } catch (error) {
    console.error('Program fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı ilerlemesini kaydet (tamamlanan günler ve egzersizler)
 */
export const saveUserProgress = async (userId, progressData) => {
  try {
    await setDoc(doc(db, 'userProgress', userId), {
      completedDays: progressData.completedDays,
      completedExercises: progressData.completedExercises,
      startDate: progressData.startDate,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Progress save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı ilerlemesini al
 */
export const getUserProgress = async (userId) => {
  try {
    const docRef = doc(db, 'userProgress', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'İlerleme bulunamadı' };
    }
  } catch (error) {
    console.error('Progress fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı ayarlarını kaydet (hatırlatmalar, tema)
 */
export const saveUserSettings = async (userId, settingsData) => {
  try {
    await setDoc(doc(db, 'userSettings', userId), {
      reminderSettings: settingsData.reminderSettings,
      theme: settingsData.theme,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Settings save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı ayarlarını al
 */
export const getUserSettings = async (userId) => {
  try {
    const docRef = doc(db, 'userSettings', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Ayarlar bulunamadı' };
    }
  } catch (error) {
    console.error('Settings fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tüm kullanıcı verilerini al (profil, program, ilerleme, ayarlar)
 */
export const getAllUserData = async (userId) => {
  try {
    const [profile, program, progress, settings] = await Promise.all([
      getUserProfile(userId),
      getUserProgram(userId),
      getUserProgress(userId),
      getUserSettings(userId)
    ]);

    return {
      success: true,
      data: {
        profile: profile.success ? profile.data : null,
        program: program.success ? program.data : null,
        progress: progress.success ? progress.data : null,
        settings: settings.success ? settings.data : null
      }
    };
  } catch (error) {
    console.error('Get all user data error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tüm kullanıcı verilerini kaydet
 */
export const saveAllUserData = async (userId, allData) => {
  try {
    await Promise.all([
      saveUserProfile(userId, allData.profile),
      saveUserProgram(userId, allData.program),
      saveUserProgress(userId, allData.progress),
      saveUserSettings(userId, allData.settings)
    ]);

    return { success: true };
  } catch (error) {
    console.error('Save all user data error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  saveUserProfile,
  getUserProfile,
  saveUserProgram,
  getUserProgram,
  saveUserProgress,
  getUserProgress,
  saveUserSettings,
  getUserSettings,
  getAllUserData,
  saveAllUserData
};
