import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './config';

const normalizeEmailKey = (email) => (email || '').trim().toLowerCase();

const mergeEntriesByDate = (...entryLists) => {
  const byDate = new Map();
  entryLists.flat().filter(Boolean).forEach((entry) => {
    if (!entry?.date) return;
    const previous = byDate.get(entry.date);
    if (!previous || new Date(entry.timestamp || 0) >= new Date(previous.timestamp || 0)) {
      byDate.set(entry.date, entry);
    }
  });
  return Array.from(byDate.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
};

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

/**
 * Kullanıcı beslenme planını kaydet (BMR, TDEE, makrolar)
 */
export const saveNutritionPlan = async (userId, nutritionData) => {
  try {
    await setDoc(doc(db, 'nutritionPlans', userId), {
      bmr: nutritionData.bmr,
      tdee: nutritionData.tdee,
      targetCalories: nutritionData.targetCalories,
      macros: nutritionData.macros,
      waterIntake: nutritionData.waterIntake,
      goal: nutritionData.goal,
      activityLevel: nutritionData.activityLevel,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Nutrition plan save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcı beslenme planını al
 */
export const getNutritionPlan = async (userId) => {
  try {
    const docRef = doc(db, 'nutritionPlans', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Beslenme planı bulunamadı' };
    }
  } catch (error) {
    console.error('Nutrition plan fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Günlük kalori takibini kaydet
 */
export const saveDailyCalories = async (userId, date, mealsData) => {
  try {
    await setDoc(doc(db, 'calorieTracking', `${userId}_${date}`), {
      userId,
      date,
      meals: mealsData,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Daily calories save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Günlük kalori takibini al
 */
export const getDailyCalories = async (userId, date) => {
  try {
    const docRef = doc(db, 'calorieTracking', `${userId}_${date}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Günlük kayıt bulunamadı' };
    }
  } catch (error) {
    console.error('Daily calories fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Günlük su takibini kaydet (tüm kayıtlar tek dokümanda, WaterTracker'ın localStorage yapısıyla birebir aynı)
 */
export const saveWaterTracker = async (userId, entries, dailyGoal) => {
  try {
    await setDoc(doc(db, 'waterTracking', userId), {
      entries,
      dailyGoal,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Water tracker save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Su takibini al
 */
export const getWaterTracker = async (userId) => {
  try {
    const docRef = doc(db, 'waterTracking', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Su takibi bulunamadı' };
    }
  } catch (error) {
    console.error('Water tracker fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Günlük log kaydet (uyku, takviyeler, antrenman özeti, serbest not)
 * Var olan alanları korur, sadece gönderilenleri günceller
 */
export const saveDailyLog = async (userId, date, fields) => {
  try {
    await setDoc(doc(db, 'dailyLogs', `${userId}_${date}`), {
      userId,
      date,
      ...fields,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Daily log save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Günlük logu al
 */
export const getDailyLog = async (userId, date) => {
  try {
    const docRef = doc(db, 'dailyLogs', `${userId}_${date}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: 'Günlük log bulunamadı' };
  } catch (error) {
    console.error('Daily log fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Birden fazla günün loglarını/kalori kayıtlarını tek seferde al (trend ekranı için)
 */
export const getDailyLogsRange = async (userId, dates) => {
  const results = await Promise.all(
    dates.map((date) => getDoc(doc(db, 'dailyLogs', `${userId}_${date}`)))
  );
  const data = {};
  results.forEach((snap, i) => {
    if (snap.exists()) data[dates[i]] = snap.data();
  });
  return data;
};

export const getCalorieTrackingRange = async (userId, dates) => {
  const results = await Promise.all(
    dates.map((date) => getDoc(doc(db, 'calorieTracking', `${userId}_${date}`)))
  );
  const data = {};
  results.forEach((snap, i) => {
    if (snap.exists()) data[dates[i]] = snap.data();
  });
  return data;
};

/**
 * Kilo takibini kaydet (tüm kayıtlar tek dokümanda, WeightTracker'ın localStorage yapısıyla birebir aynı)
 */
export const saveWeightTracker = async (userId, entries, targetWeight, email) => {
  try {
    const payload = {
      entries,
      targetWeight: targetWeight || null,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'weightTracking', userId), payload);
    const emailKey = normalizeEmailKey(email);
    if (emailKey) {
      await setDoc(doc(db, 'weightTrackingByEmail', emailKey), {
        ...payload,
        ownerEmail: emailKey,
        ownerUid: userId
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Weight tracker save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vücut ölçüleri (tüm kayıtlar tek dokümanda, BodyMeasurements'ın localStorage yapısıyla aynı)
 */
export const saveBodyMeasurements = async (userId, entries) => {
  try {
    await setDoc(doc(db, 'bodyMeasurements', userId), {
      entries,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Body measurements save error:', error);
    return { success: false, error: error.message };
  }
};

export const getBodyMeasurements = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, 'bodyMeasurements', userId));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: 'Ölçüm bulunamadı' };
  } catch (error) {
    console.error('Body measurements fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vücut kompozisyonu (yağ oranı, kas kütlesi vb. - tek dokümanda)
 */
export const saveBodyComposition = async (userId, entries) => {
  try {
    await setDoc(doc(db, 'bodyComposition', userId), {
      entries,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Body composition save error:', error);
    return { success: false, error: error.message };
  }
};

export const getBodyComposition = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, 'bodyComposition', userId));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: 'Kompozisyon bulunamadı' };
  } catch (error) {
    console.error('Body composition fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * İlerleme fotoğrafı meta verileri (görselin kendisi Drive'da, burada sadece
 * {id, date, note, tag, driveFileId} listesi tutulur)
 */
export const saveProgressPhotos = async (userId, entries) => {
  try {
    await setDoc(doc(db, 'progressPhotos', userId), {
      entries,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Progress photos save error:', error);
    return { success: false, error: error.message };
  }
};

export const getProgressPhotos = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, 'progressPhotos', userId));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: 'Fotoğraf kaydı bulunamadı' };
  } catch (error) {
    console.error('Progress photos fetch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kullanıcının SABİT beslenme hedefleri (elle belirlenir, otomatik değişmez).
 * {calories, protein, carbs, fats, water}
 */
export const saveNutritionGoals = async (userId, goals) => {
  try {
    await setDoc(doc(db, 'nutritionGoals', userId), { ...goals, updatedAt: new Date().toISOString() });
    return { success: true };
  } catch (error) {
    console.error('Nutrition goals save error:', error);
    return { success: false, error: error.message };
  }
};

export const getNutritionGoals = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, 'nutritionGoals', userId));
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: 'Hedef bulunamadı' };
  } catch (error) {
    console.error('Nutrition goals fetch error:', error);
    return { success: false, error: error.message };
  }
};

export const getWeightTracker = async (userId, email) => {
  try {
    const uidSnap = await getDoc(doc(db, 'weightTracking', userId));
    const emailKey = normalizeEmailKey(email);
    const emailSnap = emailKey ? await getDoc(doc(db, 'weightTrackingByEmail', emailKey)) : null;
    const uidData = uidSnap.exists() ? uidSnap.data() : null;
    const emailData = emailSnap?.exists() ? emailSnap.data() : null;

    if (uidData || emailData) {
      const entries = mergeEntriesByDate(uidData?.entries || [], emailData?.entries || []);
      return {
        success: true,
        data: {
          ...(uidData || {}),
          ...(emailData || {}),
          entries,
          targetWeight: emailData?.targetWeight || uidData?.targetWeight || null
        }
      };
    }
    return { success: false, error: 'Kilo takibi bulunamadı' };
  } catch (error) {
    console.error('Weight tracker fetch error:', error);
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
  saveAllUserData,
  saveNutritionPlan,
  getNutritionPlan,
  saveDailyCalories,
  getDailyCalories,
  saveWaterTracker,
  getWaterTracker,
  saveWeightTracker,
  getWeightTracker,
  saveDailyLog,
  getDailyLog,
  getDailyLogsRange,
  getCalorieTrackingRange
};
