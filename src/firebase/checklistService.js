import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';

const PLAN_KEY = 'weekly_workout_plan';
const CHECK_KEY = 'weekly_workout_checklist';

export const getWeeklyWorkoutPlan = async (userId) => {
  const local = getScopedJson(PLAN_KEY, userId, []);
  if (!userId) return local;
  const snap = await getDoc(doc(db, 'weeklyWorkoutPlans', userId));
  const items = snap.exists() ? (snap.data().items || []) : local;
  setScopedJson(PLAN_KEY, userId, items);
  return items;
};

export const saveWeeklyWorkoutPlan = async (userId, items) => {
  const normalized = (items || []).map((item) => ({
    id: item.id || `${Date.now()}-${Math.random()}`,
    day: parseInt(item.day, 10),
    title: item.title || '',
    type: item.type || 'other',
    duration: parseFloat(item.duration) || 0,
    optional: !!item.optional
  }));
  setScopedJson(PLAN_KEY, userId, normalized);
  if (userId) {
    await setDoc(doc(db, 'weeklyWorkoutPlans', userId), {
      items: normalized,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
  return normalized;
};

export const getWeeklyWorkoutChecklist = async (userId) => {
  const local = getScopedJson(CHECK_KEY, userId, {});
  if (!userId) return local;
  const snap = await getDoc(doc(db, 'weeklyWorkoutChecklists', userId));
  const checks = snap.exists() ? (snap.data().checks || {}) : local;
  setScopedJson(CHECK_KEY, userId, checks);
  return checks;
};

export const saveWeeklyWorkoutChecklist = async (userId, checks) => {
  setScopedJson(CHECK_KEY, userId, checks || {});
  if (userId) {
    await setDoc(doc(db, 'weeklyWorkoutChecklists', userId), {
      checks: checks || {},
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
  return checks || {};
};
