/**
 * Program Generator - Kullanıcı profiline göre özel 30 günlük program oluşturur
 */

import {
  exerciseLibrary,
  getExercisesByCategory,
  getExercisesByDifficulty,
  getExercisesByGoal,
  EXERCISE_CATEGORIES,
  DIFFICULTY_LEVELS,
  FITNESS_GOALS
} from '../data/exerciseLibrary';

/**
 * Kullanıcı profili yapısı
 * {
 *   name: string,
 *   age: number,
 *   weight: number,
 *   height: number,
 *   gender: 'male' | 'female' | 'other',
 *   goal: FITNESS_GOALS.*,
 *   difficulty: DIFFICULTY_LEVELS.*,
 *   dailyDuration: 15 | 30 | 45 | 60 (dakika),
 *   weeklyDays: 3 | 4 | 5 | 6 | 7 (gün/hafta)
 * }
 */

// Helper: Array'den rastgele eleman seç
const getRandomItems = (array, count) => {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// Helper: Egzersizi kullanıcı zorluk seviyesine göre filtrele
const filterByUserDifficulty = (exercises, userDifficulty) => {
  const difficultyOrder = {
    [DIFFICULTY_LEVELS.BEGINNER]: [DIFFICULTY_LEVELS.BEGINNER],
    [DIFFICULTY_LEVELS.INTERMEDIATE]: [DIFFICULTY_LEVELS.BEGINNER, DIFFICULTY_LEVELS.INTERMEDIATE],
    [DIFFICULTY_LEVELS.ADVANCED]: [DIFFICULTY_LEVELS.BEGINNER, DIFFICULTY_LEVELS.INTERMEDIATE, DIFFICULTY_LEVELS.ADVANCED]
  };

  const allowedDifficulties = difficultyOrder[userDifficulty] || [DIFFICULTY_LEVELS.BEGINNER];
  return exercises.filter(ex => allowedDifficulties.includes(ex.difficulty));
};

// Helper: Süreye göre egzersiz sayısını hesapla
const calculateExerciseCount = (dailyDuration) => {
  const mapping = {
    15: { warmup: 1, main: 3, cooldown: 1 },
    30: { warmup: 2, main: 5, cooldown: 1 },
    45: { warmup: 2, main: 7, cooldown: 2 },
    60: { warmup: 3, main: 9, cooldown: 2 }
  };
  return mapping[dailyDuration] || mapping[30];
};

// Helper: Hedefe göre ana egzersiz kategorileri belirle
const getMainCategoriesForGoal = (goal) => {
  const mapping = {
    [FITNESS_GOALS.WEIGHT_LOSS]: [
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.HIIT,
      EXERCISE_CATEGORIES.STRENGTH_LOWER
    ],
    [FITNESS_GOALS.MUSCLE_GAIN]: [
      EXERCISE_CATEGORIES.STRENGTH_UPPER,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE
    ],
    [FITNESS_GOALS.GENERAL_FITNESS]: [
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.STRENGTH_UPPER,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE
    ],
    [FITNESS_GOALS.HIIT_FOCUS]: [
      EXERCISE_CATEGORIES.HIIT,
      EXERCISE_CATEGORIES.CARDIO
    ],
    [FITNESS_GOALS.BEGINNER_FRIENDLY]: [
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE,
      EXERCISE_CATEGORIES.FLEXIBILITY
    ]
  };

  return mapping[goal] || mapping[FITNESS_GOALS.GENERAL_FITNESS];
};

/**
 * Tek bir günlük antrenman oluştur
 */
const generateDayWorkout = (dayNumber, profile, isRestDay = false) => {
  if (isRestDay) {
    return {
      day: dayNumber,
      title: 'Dinlenme Günü',
      description: 'Bugün vücudunuzun kendini onarması için dinlenme günü. Hafif yürüyüş veya germe hareketleri yapabilirsiniz.',
      isRest: true,
      exercises: [],
      totalDuration: 0,
      totalCalories: 0
    };
  }

  const exerciseCounts = calculateExerciseCount(profile.dailyDuration);
  const mainCategories = getMainCategoriesForGoal(profile.goal);

  // Isınma egzersizleri
  const warmupPool = filterByUserDifficulty(
    getExercisesByCategory(EXERCISE_CATEGORIES.WARMUP),
    profile.difficulty
  );
  const warmupExercises = getRandomItems(warmupPool, exerciseCounts.warmup);

  // Ana egzersizler - kategoriler arası denge
  const mainExercises = [];
  const exercisesPerCategory = Math.ceil(exerciseCounts.main / mainCategories.length);

  mainCategories.forEach(category => {
    const categoryPool = filterByUserDifficulty(
      getExercisesByCategory(category),
      profile.difficulty
    );
    const selected = getRandomItems(categoryPool, exercisesPerCategory);
    mainExercises.push(...selected);
  });

  // Eğer hedef egzersiz sayısına ulaşamadıysak, genel havuzdan ekle
  if (mainExercises.length < exerciseCounts.main) {
    const allMainPool = filterByUserDifficulty(
      getExercisesByGoal(profile.goal),
      profile.difficulty
    ).filter(ex =>
      ex.category !== EXERCISE_CATEGORIES.WARMUP &&
      ex.category !== EXERCISE_CATEGORIES.COOLDOWN &&
      !mainExercises.some(m => m.id === ex.id)
    );
    const additional = getRandomItems(allMainPool, exerciseCounts.main - mainExercises.length);
    mainExercises.push(...additional);
  }

  // Soğuma egzersizleri
  const cooldownPool = filterByUserDifficulty(
    [...getExercisesByCategory(EXERCISE_CATEGORIES.COOLDOWN), ...getExercisesByCategory(EXERCISE_CATEGORIES.FLEXIBILITY)],
    profile.difficulty
  );
  const cooldownExercises = getRandomItems(cooldownPool, exerciseCounts.cooldown);

  // Tüm egzersizleri birleştir
  const allExercises = [...warmupExercises, ...mainExercises.slice(0, exerciseCounts.main), ...cooldownExercises];

  // Süre ve kalori hesapla
  const totalDuration = allExercises.reduce((sum, ex) => sum + (ex.duration * ex.sets), 0);
  const totalCalories = Math.round(
    allExercises.reduce((sum, ex) => sum + (ex.caloriesPerMinute * (ex.duration * ex.sets / 60)), 0)
  );

  // Gün başlığı oluştur
  const titleByGoal = {
    [FITNESS_GOALS.WEIGHT_LOSS]: 'Kilo Verme Antrenmanı',
    [FITNESS_GOALS.MUSCLE_GAIN]: 'Kas Geliştirme Antrenmanı',
    [FITNESS_GOALS.GENERAL_FITNESS]: 'Genel Fitness Antrenmanı',
    [FITNESS_GOALS.HIIT_FOCUS]: 'HIIT Antrenmanı',
    [FITNESS_GOALS.BEGINNER_FRIENDLY]: 'Başlangıç Antrenmanı'
  };

  const baseTitle = titleByGoal[profile.goal] || 'Antrenman';
  const dayTitle = `Gün ${dayNumber}: ${baseTitle}`;

  return {
    day: dayNumber,
    title: dayTitle,
    description: `${totalDuration / 60} dakikalık antrenman. Yaklaşık ${totalCalories} kalori yakacaksınız.`,
    isRest: false,
    exercises: allExercises,
    totalDuration,
    totalCalories
  };
};

/**
 * 30 günlük program oluştur
 */
export const generate30DayProgram = (userProfile) => {
  const program = [];
  const totalDays = 30;

  // Haftalık antrenman gününe göre dinlenme günlerini belirle
  const daysPerWeek = userProfile.weeklyDays;
  const restDaysPerWeek = 7 - daysPerWeek;

  // Her hafta hangi günler dinlenme günü olacak?
  const restDayPattern = [];
  if (restDaysPerWeek === 1) {
    restDayPattern.push(7); // Pazar
  } else if (restDaysPerWeek === 2) {
    restDayPattern.push(4, 7); // Çarşamba ve Pazar
  } else if (restDaysPerWeek === 3) {
    restDayPattern.push(3, 5, 7); // Salı, Perşembe, Pazar
  } else if (restDaysPerWeek === 4) {
    restDayPattern.push(2, 4, 6, 7);
  }

  // 30 gün için program oluştur
  for (let day = 1; day <= totalDays; day++) {
    const dayOfWeek = ((day - 1) % 7) + 1; // 1-7 arası
    const isRestDay = restDayPattern.includes(dayOfWeek);

    const dayWorkout = generateDayWorkout(day, userProfile, isRestDay);
    program.push(dayWorkout);
  }

  return program;
};

/**
 * Program özeti hesapla (mevcut workoutProgram.js ile uyumlu)
 */
export const calculateProgramSummary = (program, completedDays, completedExercises) => {
  const totalDays = program.length;
  const workoutDays = program.filter(d => !d.isRest).length;
  const restDays = program.filter(d => d.isRest).length;

  const allExercises = program.flatMap(d => d.exercises || []);
  const totalExercises = allExercises.length;

  const completedExerciseCount = Object.keys(completedExercises).filter(
    key => completedExercises[key]
  ).length;

  const totalDuration = program.reduce((sum, d) => sum + (d.totalDuration || 0), 0);
  const totalCalories = program.reduce((sum, d) => sum + (d.totalCalories || 0), 0);

  return {
    totalDays,
    workoutDays,
    restDays,
    totalExercises,
    completedDays: completedDays.length,
    completedExercises: completedExerciseCount,
    totalDuration: Math.round(totalDuration / 60), // dakika
    totalCalories,
    completionPercent: Math.round((completedDays.length / totalDays) * 100)
  };
};

/**
 * Günlük antrenman ilerlemesi hesapla
 */
export const getWorkoutProgress = (workout, completedExercises) => {
  if (!workout || workout.isRest || !workout.exercises) {
    return { percent: 0, completedCount: 0, totalCount: 0 };
  }

  const totalCount = workout.exercises.length;
  const completedCount = workout.exercises.filter(ex =>
    completedExercises[`${workout.day}-${ex.id}`]
  ).length;

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { percent, completedCount, totalCount };
};

/**
 * Gün numarasına göre antrenmanı getir
 */
export const getWorkoutByDay = (program, dayNumber) => {
  return program.find(w => w.day === dayNumber) || null;
};

export default {
  generate30DayProgram,
  calculateProgramSummary,
  getWorkoutProgress,
  getWorkoutByDay
};
