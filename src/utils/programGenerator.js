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
  FITNESS_GOALS,
  GENDER_PREFERENCE,
  AGE_GROUPS,
  BMI_SUITABILITY
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
 *   weeklyDays: 3 | 4 | 5 | 6 | 7 (gün/hafta),
 *   bmi: number
 * }
 */

// ============ BİLİMSEL HESAPLAMA FONKSİYONLARI ============

/**
 * Yaş grubunu belirle (ACSM 2024 guidelines)
 */
const getAgeGroup = (age) => {
  if (age < 40) return AGE_GROUPS.YOUNG;     // 18-40: Yüksek intensity OK
  if (age < 65) return AGE_GROUPS.MIDDLE;    // 40-65: Orta intensity
  return AGE_GROUPS.SENIOR;                   // 65+: Düşük intensity, balance
};

/**
 * BMI kategorisini belirle
 */
const getBMICategory = (bmi) => {
  if (bmi < 25) return BMI_SUITABILITY.NORMAL;
  if (bmi < 30) return BMI_SUITABILITY.OVERWEIGHT;
  return BMI_SUITABILITY.OBESE;
};

/**
 * Egzersizin MET değerini al (2024 Compendium bazlı)
 * Eğer metadata yoksa tahmin et
 */
const getExerciseMET = (exercise) => {
  if (exercise.met) return exercise.met;

  // Metadata yoksa kategori ve zorluğa göre tahmin et
  const category = exercise.category;
  const difficulty = exercise.difficulty;

  // MET tahmin tablosu
  const metEstimates = {
    [EXERCISE_CATEGORIES.WARMUP]: 3.0,
    [EXERCISE_CATEGORIES.COOLDOWN]: 2.5,
    [EXERCISE_CATEGORIES.FLEXIBILITY]: 2.3,
    [EXERCISE_CATEGORIES.CARDIO]: difficulty === DIFFICULTY_LEVELS.BEGINNER ? 5.0 :
                                   difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 7.0 : 9.0,
    [EXERCISE_CATEGORIES.HIIT]: difficulty === DIFFICULTY_LEVELS.BEGINNER ? 7.0 :
                                 difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 8.5 : 10.0,
    [EXERCISE_CATEGORIES.STRENGTH_UPPER]: difficulty === DIFFICULTY_LEVELS.BEGINNER ? 3.8 :
                                           difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 5.0 : 8.0,
    [EXERCISE_CATEGORIES.STRENGTH_LOWER]: difficulty === DIFFICULTY_LEVELS.BEGINNER ? 4.0 :
                                           difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 5.5 : 7.0,
    [EXERCISE_CATEGORIES.STRENGTH_CORE]: difficulty === DIFFICULTY_LEVELS.BEGINNER ? 3.3 :
                                          difficulty === DIFFICULTY_LEVELS.INTERMEDIATE ? 4.5 : 6.0
  };

  return metEstimates[category] || 4.0;
};

/**
 * Gerçek kalori hesaplama (2024 Compendium formülü)
 * Calories = MET × Weight (kg) × Duration (hours)
 */
const calculateCalories = (met, weightKg, durationMinutes) => {
  const durationHours = durationMinutes / 60;
  return Math.round(met * weightKg * durationHours);
};

/**
 * Cinsiyet bazlı egzersiz skorlaması (2024 Cedars-Sinai araştırması)
 * Kadınlar: alt vücut, glutes, core, HIIT, cardio (daha az sürede daha fazla fayda)
 * Erkekler: üst vücut, göğüs, omuz, strength
 */
const scoreExerciseForGender = (exercise, gender) => {
  if (!gender || gender === 'other') return 1.0;

  const pref = exercise.genderPreference;
  if (!pref || pref === GENDER_PREFERENCE.NEUTRAL) return 1.0;

  // Tercih eşleşiyorsa bonus
  if (pref === GENDER_PREFERENCE.MALE && gender === 'male') return 1.3;
  if (pref === GENDER_PREFERENCE.FEMALE && gender === 'female') return 1.3;

  // Tercih eşleşmiyorsa hafif ceza (ama tamamen eleme değil)
  return 0.8;
};

/**
 * Yaş bazlı egzersiz uygunluğu (ACSM guidelines)
 */
const isExerciseSuitableForAge = (exercise, age) => {
  const ageGroup = getAgeGroup(age);

  // Metadata yoksa tüm yaşlar için uygun kabul et
  if (!exercise.ageGroups || exercise.ageGroups.length === 0) return true;

  return exercise.ageGroups.includes(ageGroup);
};

/**
 * BMI bazlı egzersiz uygunluğu (WebMD 2024)
 * BMI ≥30: jumping, burpee gibi yüksek impact egzersizleri çıkar
 */
const isExerciseSuitableForBMI = (exercise, bmi) => {
  const bmiCategory = getBMICategory(bmi);

  // Metadata yoksa uygun kabul et
  if (!exercise.bmiSuitability || exercise.bmiSuitability.length === 0) return true;

  return exercise.bmiSuitability.includes(bmiCategory);
};

/**
 * Egzersizleri kullanıcı profiline göre filtrele ve skorla
 */
const filterAndScoreExercises = (exercises, profile) => {
  return exercises
    .filter(ex => isExerciseSuitableForAge(ex, profile.age))
    .filter(ex => isExerciseSuitableForBMI(ex, profile.bmi))
    .map(ex => ({
      ...ex,
      score: scoreExerciseForGender(ex, profile.gender)
    }))
    .sort((a, b) => b.score - a.score); // Yüksek skorlu önce
};

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

// Helper: Süreye göre egzersiz sayısını hesapla (10-90 dk custom support)
const calculateExerciseCount = (dailyDuration) => {
  // Sabit mapping (hızlı seçim için)
  const mapping = {
    15: { warmup: 1, main: 3, cooldown: 1 },
    30: { warmup: 2, main: 5, cooldown: 1 },
    45: { warmup: 2, main: 7, cooldown: 2 },
    60: { warmup: 3, main: 9, cooldown: 2 }
  };

  // Eğer mapping'de varsa direkt döndür
  if (mapping[dailyDuration]) {
    return mapping[dailyDuration];
  }

  // Custom süre için dinamik hesaplama
  // Her egzersiz ortalama 3-5 dakika sürüyor
  const avgExerciseDuration = 4; // dakika
  const totalExercises = Math.floor(dailyDuration / avgExerciseDuration);

  // Warmup: %15, Main: %70, Cooldown: %15
  const warmup = Math.max(1, Math.round(totalExercises * 0.15));
  const cooldown = Math.max(1, Math.round(totalExercises * 0.15));
  const main = Math.max(2, totalExercises - warmup - cooldown);

  return { warmup, main, cooldown };
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

  // Isınma egzersizleri (yaş/BMI/cinsiyet bazlı filtreleme)
  let warmupPool = filterByUserDifficulty(
    getExercisesByCategory(EXERCISE_CATEGORIES.WARMUP),
    profile.difficulty
  );
  warmupPool = filterAndScoreExercises(warmupPool, profile);
  const warmupExercises = warmupPool.slice(0, exerciseCounts.warmup); // En yüksek skorlu olanları al

  // Ana egzersizler - kategoriler arası denge (cinsiyet/yaş/BMI filtrelemeli)
  const mainExercises = [];
  const exercisesPerCategory = Math.ceil(exerciseCounts.main / mainCategories.length);

  mainCategories.forEach(category => {
    let categoryPool = filterByUserDifficulty(
      getExercisesByCategory(category),
      profile.difficulty
    );
    categoryPool = filterAndScoreExercises(categoryPool, profile);
    const selected = categoryPool.slice(0, exercisesPerCategory); // Skorlu seçim
    mainExercises.push(...selected);
  });

  // Eğer hedef egzersiz sayısına ulaşamadıysak, genel havuzdan ekle
  if (mainExercises.length < exerciseCounts.main) {
    let allMainPool = filterByUserDifficulty(
      getExercisesByGoal(profile.goal),
      profile.difficulty
    ).filter(ex =>
      ex.category !== EXERCISE_CATEGORIES.WARMUP &&
      ex.category !== EXERCISE_CATEGORIES.COOLDOWN &&
      !mainExercises.some(m => m.id === ex.id)
    );
    allMainPool = filterAndScoreExercises(allMainPool, profile);
    const additional = allMainPool.slice(0, exerciseCounts.main - mainExercises.length);
    mainExercises.push(...additional);
  }

  // Soğuma egzersizleri
  let cooldownPool = filterByUserDifficulty(
    [...getExercisesByCategory(EXERCISE_CATEGORIES.COOLDOWN), ...getExercisesByCategory(EXERCISE_CATEGORIES.FLEXIBILITY)],
    profile.difficulty
  );
  cooldownPool = filterAndScoreExercises(cooldownPool, profile);
  const cooldownExercises = cooldownPool.slice(0, exerciseCounts.cooldown);

  // Tüm egzersizleri birleştir
  const allExercises = [...warmupExercises, ...mainExercises.slice(0, exerciseCounts.main), ...cooldownExercises];

  // Süre ve kalori hesapla (GERÇEKçi MET bazlı formül)
  const totalDuration = allExercises.reduce((sum, ex) => sum + (ex.duration * ex.sets), 0);
  const totalCalories = allExercises.reduce((sum, ex) => {
    const met = getExerciseMET(ex);
    const durationMinutes = (ex.duration * ex.sets) / 60;
    return sum + calculateCalories(met, profile.weight, durationMinutes);
  }, 0);

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
