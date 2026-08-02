import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { getDailyLog, saveDailyLog } from './dataService';

/**
 * dailyLogs/{uid}_{date} dokümanındaki uyku/antrenman/takviye/vitals alanlarını
 * eklemek/düzenlemek/silmek için ortak yer - mealsService.js ile aynı desen:
 * her mutasyon önce Firestore'dan GÜNCEL veriyi okuyup üzerine işler.
 */

const getLog = async (userId, date) => {
  if (!userId) return {};
  const result = await getDailyLog(userId, date);
  return result.success ? result.data : {};
};

// ----- Uyku (tek obje) -----
export const saveSleep = async (userId, date, sleepData) => {
  await saveDailyLog(userId, date, { sleep: sleepData });
  return sleepData;
};

export const deleteSleep = async (userId, date) => {
  await saveDailyLog(userId, date, { sleep: null });
};

// ----- Apple Watch / vitals (tek obje) -----
export const saveVitals = async (userId, date, vitalsData) => {
  await saveDailyLog(userId, date, { vitals: vitalsData });
  return vitalsData;
};

export const deleteVitals = async (userId, date) => {
  await saveDailyLog(userId, date, { vitals: null });
};

// ----- Takviyeler (dizi) -----
export const addSupplement = async (userId, date, supplement) => {
  const current = await getLog(userId, date);
  const supplements = [...(current.supplements || []), supplement];
  await saveDailyLog(userId, date, { supplements });
  return supplements;
};

export const updateSupplement = async (userId, date, index, changes) => {
  const current = await getLog(userId, date);
  const supplements = (current.supplements || []).map((s, i) => (i === index ? { ...s, ...changes } : s));
  await saveDailyLog(userId, date, { supplements });
  return supplements;
};

export const deleteSupplement = async (userId, date, index) => {
  const current = await getLog(userId, date);
  const supplements = (current.supplements || []).filter((_, i) => i !== index);
  await saveDailyLog(userId, date, { supplements });
  return supplements;
};

// ----- Antrenmanlar (dizi) -----
export const addWorkout = async (userId, date, workout) => {
  const current = await getLog(userId, date);
  const workouts = [...(current.workouts || []), workout];
  await saveDailyLog(userId, date, { workouts });
  return workouts;
};

export const updateWorkout = async (userId, date, index, changes) => {
  const current = await getLog(userId, date);
  const workouts = (current.workouts || []).map((w, i) => (i === index ? { ...w, ...changes } : w));
  await saveDailyLog(userId, date, { workouts });
  return workouts;
};

export const deleteWorkout = async (userId, date, index) => {
  const current = await getLog(userId, date);
  const workouts = (current.workouts || []).filter((_, i) => i !== index);
  await saveDailyLog(userId, date, { workouts });
  return workouts;
};

// ----- Program egzersizleri için set kaydı (Hevy tarzı ağırlık×tekrar takibi) -----

/**
 * Bir program egzersizi için o gün yapılan setleri kaydeder.
 * dailyLogs/{uid}_{date}.workouts içinde source:'program' işaretli tek bir seans
 * kaydı tutulur; egzersiz adına göre upsert edilir. Ayrıca exerciseHistory/{uid}
 * dokümanına "bu egzersizin son setleri" yazılır ki bir sonraki seansta placeholder
 * olarak hızlıca (tek okuma ile) gösterilebilsin.
 */
export const logExerciseSets = async (userId, date, exerciseName, sets) => {
  const current = await getLog(userId, date);
  const workouts = [...(current.workouts || [])];

  let session = workouts.find((w) => w.source === 'program');
  if (!session) {
    session = { type: 'strength', source: 'program', duration_min: null, calories: null, exercises: [] };
    workouts.push(session);
  }

  const exercises = [...(session.exercises || [])];
  const idx = exercises.findIndex((e) => e.name === exerciseName);
  if (idx >= 0) {
    exercises[idx] = { ...exercises[idx], sets };
  } else {
    exercises.push({ name: exerciseName, sets });
  }
  session.exercises = exercises;

  await saveDailyLog(userId, date, { workouts });

  // Hızlı placeholder erişimi için son-set önbelleği
  await setDoc(doc(db, 'exerciseHistory', userId), {
    [exerciseName]: { sets, date }
  }, { merge: true });

  return workouts;
};

/** Egzersiz adı → {sets, date} son kayıt haritası (placeholder gösterimi için) */
export const getExerciseHistory = async (userId) => {
  if (!userId) return {};
  try {
    const snap = await getDoc(doc(db, 'exerciseHistory', userId));
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
};
