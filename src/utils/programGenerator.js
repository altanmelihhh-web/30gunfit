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

/**
 * Hibrit Seçim Sistemi: Kaliteli + Çeşitli Egzersiz Seçimi
 *
 * 1. Uygun egzersizleri filtrele + skorla (profil bazlı)
 * 2. En iyi %30'luk dilimi al (kalite garantisi)
 * 3. Kullanım geçmişine göre yeniden skorla (az kullanılan = öncelikli)
 * 4. En az kullanılan %50'lik dilimden RASTGELE seç (hem çeşitlilik hem kalite)
 *
 * Sonuç: Her gün farklı AMA kaliteli egzersizler
 */
const selectExercisesWithVariety = (pool, count, usageHistory = {}) => {
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool;

  // Adım 1: En iyi %30'luk dilimi al (kalite garantisi)
  const topPercentile = Math.max(
    Math.ceil(pool.length * 0.3),
    count * 2, // En az 2x istenen miktar
    5 // En az 5 egzersiz
  );
  const topExercises = pool.slice(0, Math.min(topPercentile, pool.length));

  // Adım 2: Kullanım geçmişine göre yeniden skorla
  const scoredByUsage = topExercises.map(ex => {
    const timesUsed = usageHistory[ex.id] || 0;
    // Az kullanılan egzersizler daha yüksek skor alır
    // Hiç kullanılmayanlar en yüksek skor
    const usageScore = 1000 - (timesUsed * 100);

    return {
      ...ex,
      usageScore,
      timesUsed
    };
  }).sort((a, b) => {
    // Önce kullanım skoruna göre
    if (b.usageScore !== a.usageScore) {
      return b.usageScore - a.usageScore;
    }
    // Eşitse orijinal profile skoruna göre
    return (b.score || 1) - (a.score || 1);
  });

  // Adım 3: En az kullanılan %50'lik dilimden RASTGELE seç
  const selectionPool = scoredByUsage.slice(0, Math.ceil(scoredByUsage.length * 0.5));
  const selected = getRandomItems(selectionPool, count);

  return selected;
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
 * Günlük fokus belirleme - Kas grupları ve yoğunluğa göre dengeli rotasyon
 * Her 30 gün için benzersiz, mantıklı bir plan oluşturur
 */
const getDailyFocus = (dayNumber, goal) => {
  // 7 günlük rotasyon (4 hafta boyunca tekrarlanır ama egzersizler farklı olur)
  const dayOfWeek = ((dayNumber - 1) % 7) + 1;

  // Genel fitness rotasyonu (tüm hedefler için temel)
  const baseRotation = [
    { day: 1, focus: 'upper', intensity: 'moderate', title: 'Üst Vücut', categories: [EXERCISE_CATEGORIES.STRENGTH_UPPER] },
    { day: 2, focus: 'cardio', intensity: 'high', title: 'Kardiyovasküler', categories: [EXERCISE_CATEGORIES.CARDIO, EXERCISE_CATEGORIES.HIIT] },
    { day: 3, focus: 'lower', intensity: 'moderate', title: 'Alt Vücut', categories: [EXERCISE_CATEGORIES.STRENGTH_LOWER] },
    { day: 4, focus: 'core', intensity: 'light', title: 'Core & Esneklik', categories: [EXERCISE_CATEGORIES.STRENGTH_CORE, EXERCISE_CATEGORIES.FLEXIBILITY] },
    { day: 5, focus: 'full', intensity: 'high', title: 'Tüm Vücut', categories: [EXERCISE_CATEGORIES.STRENGTH_UPPER, EXERCISE_CATEGORIES.STRENGTH_LOWER, EXERCISE_CATEGORIES.STRENGTH_CORE] },
    { day: 6, focus: 'hiit', intensity: 'very_high', title: 'HIIT & Dayanıklılık', categories: [EXERCISE_CATEGORIES.HIIT, EXERCISE_CATEGORIES.CARDIO] },
    { day: 7, focus: 'active_recovery', intensity: 'light', title: 'Aktif Toparlanma', categories: [EXERCISE_CATEGORIES.FLEXIBILITY, EXERCISE_CATEGORIES.STRENGTH_CORE] }
  ];

  // Hedefe göre rotasyonu özelleştir
  if (goal === FITNESS_GOALS.WEIGHT_LOSS) {
    // Kilo verme: Daha fazla kardiyovasküler ve HIIT
    if (dayOfWeek === 2 || dayOfWeek === 6) {
      return { ...baseRotation[dayOfWeek - 1], intensity: 'very_high' }; // Kardiyoyu arttır
    }
  } else if (goal === FITNESS_GOALS.MUSCLE_GAIN) {
    // Kas kazanma: Daha fazla strength, daha az kardiyovasküler
    if (dayOfWeek === 2) {
      return { day: 2, focus: 'upper', intensity: 'high', title: 'Üst Vücut - Yoğun', categories: [EXERCISE_CATEGORIES.STRENGTH_UPPER] };
    }
    if (dayOfWeek === 6) {
      return { day: 6, focus: 'lower', intensity: 'high', title: 'Alt Vücut - Yoğun', categories: [EXERCISE_CATEGORIES.STRENGTH_LOWER] };
    }
  } else if (goal === FITNESS_GOALS.HIIT_FOCUS) {
    // HIIT odaklı: Her üçüncü gün HIIT
    if (dayOfWeek % 3 === 0) {
      return { ...baseRotation[dayOfWeek - 1], intensity: 'very_high', categories: [EXERCISE_CATEGORIES.HIIT] };
    }
  }

  return baseRotation[dayOfWeek - 1];
};

/**
 * Tek bir günlük antrenman oluştur - Hibrit sistem (kalite + çeşitlilik)
 */
const generateDayWorkout = (dayNumber, profile, usageHistory = {}, isRestDay = false) => {
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

  // Günlük fokus belirle (kas grubu ve yoğunluk rotasyonu)
  const dailyFocus = getDailyFocus(dayNumber, profile.goal);

  // Isınma egzersizleri - HİBRİT SEÇİM (kalite + çeşitlilik)
  let warmupPool = filterByUserDifficulty(
    getExercisesByCategory(EXERCISE_CATEGORIES.WARMUP),
    profile.difficulty
  );
  warmupPool = filterAndScoreExercises(warmupPool, profile);
  const warmupExercises = selectExercisesWithVariety(warmupPool, exerciseCounts.warmup, usageHistory);

  // Ana egzersizler - Günlük fokusa göre + HİBRİT SEÇİM
  const mainExercises = [];
  const focusCategories = dailyFocus.categories;
  const exercisesPerCategory = Math.ceil(exerciseCounts.main / focusCategories.length);

  focusCategories.forEach(category => {
    let categoryPool = filterByUserDifficulty(
      getExercisesByCategory(category),
      profile.difficulty
    );
    categoryPool = filterAndScoreExercises(categoryPool, profile);

    // HİBRİT SEÇİM: Hem kaliteli hem çeşitli
    const selected = selectExercisesWithVariety(categoryPool, exercisesPerCategory, usageHistory);
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
    const additional = selectExercisesWithVariety(
      allMainPool,
      exerciseCounts.main - mainExercises.length,
      usageHistory
    );
    mainExercises.push(...additional);
  }

  // Soğuma egzersizleri - HİBRİT SEÇİM
  let cooldownPool = filterByUserDifficulty(
    [...getExercisesByCategory(EXERCISE_CATEGORIES.COOLDOWN), ...getExercisesByCategory(EXERCISE_CATEGORIES.FLEXIBILITY)],
    profile.difficulty
  );
  cooldownPool = filterAndScoreExercises(cooldownPool, profile);
  const cooldownExercises = selectExercisesWithVariety(cooldownPool, exerciseCounts.cooldown, usageHistory);

  // Tüm egzersizleri birleştir
  const allExercises = [...warmupExercises, ...mainExercises.slice(0, exerciseCounts.main), ...cooldownExercises];

  // Süre ve kalori hesapla (GERÇEKçi MET bazlı formül)
  const totalDuration = allExercises.reduce((sum, ex) => sum + (ex.duration * ex.sets), 0); // duration already in minutes
  const totalCalories = allExercises.reduce((sum, ex) => {
    const met = getExerciseMET(ex);
    const durationMinutes = (ex.duration * ex.sets); // duration already in minutes, no need to divide by 60
    return sum + calculateCalories(met, profile.weight, durationMinutes);
  }, 0);

  // Gün başlığı oluştur - Günlük fokusa göre
  const dayTitle = `Gün ${dayNumber}: ${dailyFocus.title}`;

  // Yoğunluk bilgisi
  const intensityDesc = {
    'light': 'Hafif yoğunlukta',
    'moderate': 'Orta yoğunlukta',
    'high': 'Yoğun',
    'very_high': 'Çok yoğun'
  };

  const intensityText = intensityDesc[dailyFocus.intensity] || '';

  return {
    day: dayNumber,
    title: dayTitle,
    description: `${intensityText} ${Math.round(totalDuration)} dakikalık antrenman. Yaklaşık ${totalCalories} kalori yakacaksınız.`,
    isRest: false,
    exercises: allExercises,
    totalDuration,
    totalCalories,
    focus: dailyFocus.focus,
    intensity: dailyFocus.intensity
  };
};

/**
 * 30 günlük program oluştur - HİBRİT SİSTEM ile
 * Her gün için egzersiz kullanım geçmişi takip edilerek benzersiz program oluşturulur
 */
export const generate30DayProgram = (userProfile) => {
  const program = [];
  const totalDays = 30;

  // Egzersiz kullanım geçmişi (her egzersiz kaç kez kullanıldı)
  const usageHistory = {};

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

    // Günlük antrenmanı oluştur (kullanım geçmişi ile)
    const dayWorkout = generateDayWorkout(day, userProfile, usageHistory, isRestDay);
    program.push(dayWorkout);

    // Kullanım geçmişini güncelle
    if (!isRestDay && dayWorkout.exercises) {
      dayWorkout.exercises.forEach(exercise => {
        if (exercise && exercise.id) {
          usageHistory[exercise.id] = (usageHistory[exercise.id] || 0) + 1;
        }
      });
    }
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
