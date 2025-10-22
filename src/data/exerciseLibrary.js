/**
 * Kapsamlı Egzersiz Kütüphanesi
 * Kategoriler: Warmup, Cardio, Strength (Upper/Lower/Core), HIIT, Flexibility, Cooldown
 */

// Egzersiz kategorileri
export const EXERCISE_CATEGORIES = {
  WARMUP: 'warmup',
  CARDIO: 'cardio',
  STRENGTH_UPPER: 'strength_upper',
  STRENGTH_LOWER: 'strength_lower',
  STRENGTH_CORE: 'strength_core',
  HIIT: 'hiit',
  FLEXIBILITY: 'flexibility',
  COOLDOWN: 'cooldown'
};

// Zorluk seviyeleri
export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};

// Hedefler
export const FITNESS_GOALS = {
  WEIGHT_LOSS: 'weight_loss',        // Kilo verme
  MUSCLE_GAIN: 'muscle_gain',        // Kas yapma
  GENERAL_FITNESS: 'general_fitness', // Genel fitness
  HIIT_FOCUS: 'hiit_focus',          // HIIT odaklı
  BEGINNER_FRIENDLY: 'beginner'       // Başlangıç
};

// Cinsiyet tercihleri (araştırma bazlı)
export const GENDER_PREFERENCE = {
  MALE: 'male',           // Erkekler için daha uygun (üst vücut)
  FEMALE: 'female',       // Kadınlar için daha uygun (alt vücut, glutes, core)
  NEUTRAL: 'neutral'      // Her iki cinsiyet için eşit
};

// Yaş grupları
export const AGE_GROUPS = {
  YOUNG: 'young',         // 18-40: Yüksek intensity OK
  MIDDLE: 'middle',       // 40-65: Orta intensity
  SENIOR: 'senior'        // 65+: Düşük intensity, balance, eklem dostu
};

// BMI uygunluk seviyeleri
export const BMI_SUITABILITY = {
  NORMAL: 'normal',           // BMI < 25
  OVERWEIGHT: 'overweight',   // BMI 25-30
  OBESE: 'obese'              // BMI ≥ 30 (low-impact gerekir)
};

// Kapsamlı egzersiz kütüphanesi
export const exerciseLibrary = [
  // ============ WARMUP (ISINMA) ============
  {
    id: 'warmup_1',
    name: 'Yerinde Yürüyüş',
    category: EXERCISE_CATEGORIES.WARMUP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 2,
    sets: 1,
    reps: null,
    targetMuscles: ['kalp', 'bacaklar'],
    equipment: 'none',
    met: 3.5,  // MET value (2024 Compendium)
    genderPreference: GENDER_PREFERENCE.NEUTRAL,
    ageGroups: [AGE_GROUPS.YOUNG, AGE_GROUPS.MIDDLE, AGE_GROUPS.SENIOR],
    bmiSuitability: [BMI_SUITABILITY.NORMAL, BMI_SUITABILITY.OVERWEIGHT, BMI_SUITABILITY.OBESE],
    hasLowImpactVersion: false,
    instructions: 'Yerinde rahat bir tempoda yürüyün. Kollarınızı sallamayı unutmayın.',
    videoUrl: 'https://www.youtube.com/embed/2g811Eo7K8U',
    gifUrl: null
  },
  {
    id: 'warmup_2',
    name: 'Kol Çevirme',
    category: EXERCISE_CATEGORIES.WARMUP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: 20,
    targetMuscles: ['omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Kollarınızı yana açın ve dairesel hareketlerle çevirin.',
    videoUrl: 'https://www.youtube.com/embed/JB2oyawG9KI',
    gifUrl: null
  },
  {
    id: 'warmup_3',
    name: 'Boyun Germe',
    category: EXERCISE_CATEGORIES.WARMUP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 1,
    reps: null,
    targetMuscles: ['boyun'],
    equipment: 'none',
    caloriesPerMinute: 1,
    instructions: 'Başınızı yavaşça sağa-sola, öne-arkaya eğin.',
    videoUrl: 'https://www.youtube.com/embed/6MebZx-4950',
    gifUrl: null
  },
  {
    id: 'warmup_4',
    name: 'Hafif Squat',
    category: EXERCISE_CATEGORIES.WARMUP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: 15,
    targetMuscles: ['bacaklar', 'kalça'],
    equipment: 'none',
    caloriesPerMinute: 4,
    instructions: 'Hafif tempo ile squat yapın, ısınma amaçlı.',
    videoUrl: 'https://www.youtube.com/embed/YaXPRqUwItQ',
    gifUrl: null
  },
  {
    id: 'warmup_5',
    name: 'Jumping Jacks (Hafif)',
    category: EXERCISE_CATEGORIES.WARMUP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 1,
    reps: 30,
    targetMuscles: ['tüm vücut'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Hafif tempoda jumping jacks yaparak vücudu ısıtın.',
    videoUrl: 'https://www.youtube.com/embed/2W4ZNSwoW_4',
    gifUrl: null
  },

  // ============ CARDIO ============
  {
    id: 'cardio_1',
    name: 'Yerinde Koşu',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 3,
    sets: 1,
    reps: null,
    targetMuscles: ['kalp', 'bacaklar'],
    equipment: 'none',
    caloriesPerMinute: 8,
    instructions: 'Yerinde hızlı tempo ile koşun. Dizlerinizi yukarı kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/g_tea8ZNk5A',
    gifUrl: null
  },
  {
    id: 'cardio_2',
    name: 'Jumping Jacks',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 2,
    sets: 3,
    reps: 30,
    targetMuscles: ['tüm vücut', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 8,
    instructions: 'Zıplayarak kollarınızı yukarı kaldırın ve bacaklarınızı açın.',
    videoUrl: 'https://www.youtube.com/embed/2W4ZNSwoW_4',
    gifUrl: null
  },
  {
    id: 'cardio_3',
    name: 'High Knees',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 40,
    targetMuscles: ['kalp', 'bacaklar', 'core'],
    equipment: 'none',
    caloriesPerMinute: 10,
    instructions: 'Yerinde koşarken dizlerinizi göğüs hizasına kadar kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/mmq5zZfmIws',
    gifUrl: null,
    alternatives: [
      {
        id: 'cardio_3_alt1',
        name: 'Yerinde Yürüyüş (Yavaş)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 2,
        sets: 3,
        reps: 60,
        targetMuscles: ['kalp', 'bacaklar'],
        equipment: 'none',
        caloriesPerMinute: 5,
        instructions: 'Yerinde yürüyün, dizleri hafifçe kaldırın. Düşük impact, eklemlere dost.',
        videoUrl: 'https://www.youtube.com/embed/2g811Eo7K8U'
      },
      {
        id: 'cardio_3_alt2',
        name: 'Step Touch (Yan Adım)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 40,
        targetMuscles: ['kalp', 'bacaklar'],
        equipment: 'none',
        caloriesPerMinute: 6,
        instructions: 'Sağa-sola adım atarak kardiyo yapın. Zıplama yok, düşük impact.',
        videoUrl: 'https://www.youtube.com/embed/DHD1-2P94DI'
      },
      {
        id: 'cardio_3_alt3',
        name: 'Low Knees (Alçak Dizler)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 50,
        targetMuscles: ['kalp', 'bacaklar'],
        equipment: 'none',
        caloriesPerMinute: 7,
        instructions: 'Dizleri bel hizasına kadar kaldırarak yerinde koşun. Orta intensity.',
        videoUrl: 'https://www.youtube.com/embed/2g811Eo7K8U'
      }
    ]
  },
  {
    id: 'cardio_4',
    name: 'Butt Kicks',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 40,
    targetMuscles: ['bacaklar', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 8,
    instructions: 'Yerinde koşarken topuklarınızı kalçanıza dokundurma hedefiyle hareket edin.',
    videoUrl: 'https://www.youtube.com/embed/C_VtOYc6j5c',
    gifUrl: null
  },
  {
    id: 'cardio_5',
    name: 'Mountain Climbers',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 30,
    targetMuscles: ['core', 'kalp', 'kollar'],
    equipment: 'none',
    caloriesPerMinute: 12,
    instructions: 'Plank pozisyonunda dizlerinizi göğsünüze doğru çekin.',
    videoUrl: 'https://www.youtube.com/embed/kLh-uczlPLg',
    gifUrl: null,
    alternatives: [
      {
        id: 'cardio_5_alt1',
        name: 'Slow Mountain Climbers',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 30,
        targetMuscles: ['core', 'kalp', 'kollar'],
        equipment: 'none',
        caloriesPerMinute: 8,
        instructions: 'Yavaş tempo ile kontrollü mountain climber yapın. Başlangıç seviyesi.',
        videoUrl: 'https://www.youtube.com/embed/kLh-uczlPLg'
      },
      {
        id: 'cardio_5_alt2',
        name: 'Plank Jacks',
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        duration: 1.5,
        sets: 3,
        reps: 30,
        targetMuscles: ['core', 'kalp', 'bacaklar'],
        equipment: 'none',
        caloriesPerMinute: 10,
        instructions: 'Plank pozisyonunda bacakları açıp kapayın. Core ve kardiyo.',
        videoUrl: 'https://www.youtube.com/embed/8PwoytUU06g'
      },
      {
        id: 'cardio_5_alt3',
        name: 'Plank Hold + Knee Tucks',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 20,
        targetMuscles: ['core', 'omuzlar'],
        equipment: 'none',
        caloriesPerMinute: 6,
        instructions: 'Plank pozisyonunda tutun, ara sıra tek diz göğse. Daha kolay versiyon.',
        videoUrl: 'https://www.youtube.com/embed/B296mZDhrP4'
      }
    ]
  },
  {
    id: 'cardio_6',
    name: 'Burpees',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 2,
    sets: 3,
    reps: 15,
    targetMuscles: ['tüm vücut', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 14,
    instructions: 'Squat pozisyonundan plank\'a geçin, şınav çekin ve zıplayarak ayağa kalkın.',
    videoUrl: 'https://www.youtube.com/embed/dZgVxmf6jkA',
    gifUrl: null,
    alternatives: [
      {
        id: 'cardio_6_alt1',
        name: 'Modified Burpees (Zıplamasız)',
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        duration: 2,
        sets: 3,
        reps: 15,
        targetMuscles: ['tüm vücut', 'kalp'],
        equipment: 'none',
        caloriesPerMinute: 10,
        instructions: 'Zıplama olmadan burpee yapın. Squat-plank-squat-ayağa kalk.',
        videoUrl: 'https://www.youtube.com/embed/dZgVxmf6jkA'
      },
      {
        id: 'cardio_6_alt2',
        name: 'Step-Out Burpees',
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        duration: 2,
        sets: 3,
        reps: 15,
        targetMuscles: ['tüm vücut', 'kalp'],
        equipment: 'none',
        caloriesPerMinute: 12,
        instructions: 'Plank pozisyonuna zıplamak yerine adım atarak geçin.',
        videoUrl: 'https://www.youtube.com/embed/dZgVxmf6jkA'
      },
      {
        id: 'cardio_6_alt3',
        name: 'Squat Thrusts',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 2,
        sets: 3,
        reps: 20,
        targetMuscles: ['bacaklar', 'kalp', 'core'],
        equipment: 'none',
        caloriesPerMinute: 8,
        instructions: 'Sadece squat ve plank arasında geçiş yapın, şınav ve zıplama yok.',
        videoUrl: 'https://www.youtube.com/embed/IT94xC35u6k'
      }
    ]
  },
  {
    id: 'cardio_7',
    name: 'Skater Hops',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['bacaklar', 'kalp', 'denge'],
    equipment: 'none',
    caloriesPerMinute: 9,
    instructions: 'Paten kayarcasına sağa-sola zıplayın.',
    videoUrl: 'https://www.youtube.com/embed/ioR5np1fmEc',
    gifUrl: null
  },
  {
    id: 'cardio_8',
    name: 'Box Steps (Alternatif)',
    category: EXERCISE_CATEGORIES.CARDIO,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 2,
    sets: 3,
    reps: 30,
    targetMuscles: ['bacaklar', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 7,
    instructions: 'Sanki merdiven çıkıyormuş gibi yerinde yüksek adımlar atın.',
    videoUrl: 'https://www.youtube.com/embed/v7AYKMP6rOE',
    gifUrl: null
  },

  // ============ STRENGTH UPPER BODY ============
  {
    id: 'strength_upper_1',
    name: 'Klasik Şınav',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['göğüs', 'triceps', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 7,
    instructions: 'Plank pozisyonunda vücudunuzu düz tutarak şınav çekin.',
    videoUrl: 'https://www.youtube.com/embed/_l3ySVKYVJ8',
    gifUrl: null,
    alternatives: [
      {
        id: 'strength_upper_1_alt1',
        name: 'Diz Üstü Şınav',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 15,
        targetMuscles: ['göğüs', 'triceps', 'omuzlar'],
        equipment: 'none',
        caloriesPerMinute: 5,
        instructions: 'Dizleriniz yerde olacak şekilde şınav çekin. Başlangıç seviyesi için ideal.',
        videoUrl: 'https://www.youtube.com/embed/ZWdBqFLNljc'
      },
      {
        id: 'strength_upper_1_alt2',
        name: 'Duvar Şınav',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 20,
        targetMuscles: ['göğüs', 'omuzlar'],
        equipment: 'wall',
        caloriesPerMinute: 3,
        instructions: 'Duvara yaslanarak ayakta şınav çekin. En kolay versiyon.',
        videoUrl: 'https://www.youtube.com/embed/kzSJvEbIKi4'
      },
      {
        id: 'strength_upper_1_alt3',
        name: 'Eğimli Şınav (Elevated)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 15,
        targetMuscles: ['göğüs', 'triceps', 'omuzlar'],
        equipment: 'chair',
        caloriesPerMinute: 6,
        instructions: 'Ellerinizi sandalye veya yüksek bir yüzeye koyarak şınav çekin.',
        videoUrl: 'https://www.youtube.com/embed/IODxDxX7oi4'
      }
    ]
  },
  {
    id: 'strength_upper_2',
    name: 'Diz Üstü Şınav',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 12,
    targetMuscles: ['göğüs', 'triceps', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Dizleriniz yerde olacak şekilde şınav çekin.',
    videoUrl: 'https://www.youtube.com/embed/ZWdBqFLNljc',
    gifUrl: null
  },
  {
    id: 'strength_upper_3',
    name: 'Diamond Push-ups',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 1.5,
    sets: 3,
    reps: 10,
    targetMuscles: ['triceps', 'göğüs'],
    equipment: 'none',
    caloriesPerMinute: 8,
    instructions: 'Ellerinizi yakın tutarak elmas şeklinde şınav çekin.',
    videoUrl: 'https://www.youtube.com/embed/kzSJvEbIKi4',
    gifUrl: null
  },
  {
    id: 'strength_upper_4',
    name: 'Triceps Dips (Sandalye)',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['triceps', 'omuzlar'],
    equipment: 'chair',
    caloriesPerMinute: 6,
    instructions: 'Sandalyeye tutunarak kollarınızı büküp açarak triceps çalıştırın.',
    videoUrl: 'https://www.youtube.com/embed/6kALZikXxLc',
    gifUrl: null
  },
  {
    id: 'strength_upper_5',
    name: 'Plank to Downward Dog',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 12,
    targetMuscles: ['omuzlar', 'core', 'kollar'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Plank pozisyonundan kalçanızı yukarı kaldırarak V şekline geçin.',
    videoUrl: 'https://www.youtube.com/embed/c_Dq_NCzj8M',
    gifUrl: null
  },
  {
    id: 'strength_upper_6',
    name: 'Pike Push-ups',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 1.5,
    sets: 3,
    reps: 12,
    targetMuscles: ['omuzlar', 'triceps'],
    equipment: 'none',
    caloriesPerMinute: 7,
    instructions: 'Kalçanızı yukarı kaldırarak V pozisyonunda şınav çekin.',
    videoUrl: 'https://www.youtube.com/embed/4Y2ZdHCOXok',
    gifUrl: null
  },
  {
    id: 'strength_upper_7',
    name: 'Arm Circles',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 3,
    reps: 30,
    targetMuscles: ['omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 4,
    instructions: 'Kollarınızı yana açıp dairesel hareketler yapın.',
    videoUrl: 'https://www.youtube.com/embed/M0uO8X3_tEA',
    gifUrl: null
  },
  {
    id: 'strength_upper_8',
    name: 'Plank Shoulder Taps',
    category: EXERCISE_CATEGORIES.STRENGTH_UPPER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['omuzlar', 'core', 'kollar'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Plank pozisyonunda karşı omzunuza dokunun.',
    videoUrl: 'https://www.youtube.com/embed/c_Dq_NCzj8M',
    gifUrl: null
  },

  // ============ STRENGTH LOWER BODY ============
  {
    id: 'strength_lower_1',
    name: 'Bodyweight Squat',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['bacaklar', 'kalça', 'core'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Ayaklarınızı omuz genişliğinde açarak derin squat yapın.',
    videoUrl: 'https://www.youtube.com/embed/YaXPRqUwItQ',
    gifUrl: null,
    alternatives: [
      {
        id: 'strength_lower_1_alt1',
        name: 'Wall Sit',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1,
        sets: 3,
        reps: null,
        targetMuscles: ['bacaklar', 'kalça'],
        equipment: 'wall',
        caloriesPerMinute: 4,
        instructions: 'Duvara yaslanıp 90 derece açıda oturun, hareketsiz bekleyin. İzometrik kuvvet çalışması.',
        videoUrl: 'https://www.youtube.com/embed/mGvzVjuY8SY'
      },
      {
        id: 'strength_lower_1_alt2',
        name: 'Sandalye Oturup Kalkma',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 15,
        targetMuscles: ['bacaklar', 'kalça'],
        equipment: 'chair',
        caloriesPerMinute: 5,
        instructions: 'Sandalyeye oturup kalkarak squat hareketi yapın. Başlangıç seviyesi için mükemmel.',
        videoUrl: 'https://www.youtube.com/embed/Azl5tkCzDcc'
      },
      {
        id: 'strength_lower_1_alt3',
        name: 'Sumo Squat',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 20,
        targetMuscles: ['bacaklar', 'kalça', 'iç bacak'],
        equipment: 'none',
        caloriesPerMinute: 6,
        instructions: 'Ayaklarınızı geniş açarak squat yapın. İç bacak ve kalçaya odaklanır.',
        videoUrl: 'https://www.youtube.com/embed/mGvzVjuY8SY'
      }
    ]
  },
  {
    id: 'strength_lower_2',
    name: 'Jump Squat',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['bacaklar', 'kalça', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 10,
    instructions: 'Squat pozisyonundan zıplayarak patlayıcı hareket yapın.',
    videoUrl: 'https://www.youtube.com/embed/Azl5tkCzDcc',
    gifUrl: null
  },
  {
    id: 'strength_lower_3',
    name: 'Lunges (İleri Hamle)',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['bacaklar', 'kalça', 'denge'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'İleri adım atarak diz bükerek lunge yapın.',
    videoUrl: 'https://www.youtube.com/embed/D7KaRcUTQeE',
    gifUrl: null,
    alternatives: [
      {
        id: 'strength_lower_3_alt1',
        name: 'Reverse Lunges (Geri Hamle)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 20,
        targetMuscles: ['bacaklar', 'kalça', 'denge'],
        equipment: 'none',
        caloriesPerMinute: 6,
        instructions: 'Geriye adım atarak lunge yapın. Dizlere daha az yük, denge daha kolay.',
        videoUrl: 'https://www.youtube.com/embed/wkD8rjkodUI'
      },
      {
        id: 'strength_lower_3_alt2',
        name: 'Static Lunges (Yerinde)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 30,
        targetMuscles: ['bacaklar', 'kalça'],
        equipment: 'none',
        caloriesPerMinute: 5,
        instructions: 'Yerinde durarak sadece yukarı aşağı hareket edin. Denge problemi yok.',
        videoUrl: 'https://www.youtube.com/embed/UpH7rm0cYbM'
      },
      {
        id: 'strength_lower_3_alt3',
        name: 'Step-Ups (Sandalye)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1.5,
        sets: 3,
        reps: 20,
        targetMuscles: ['bacaklar', 'kalça'],
        equipment: 'chair',
        instructions: 'Sandalyeye adım atarak çıkın. Tek bacak kuvvet çalışması, denge daha kolay.',
        videoUrl: 'https://www.youtube.com/embed/v7AYKMP6rOE'
      }
    ]
  },
  {
    id: 'strength_lower_4',
    name: 'Reverse Lunges',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['bacaklar', 'kalça'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Geriye adım atarak lunge yapın.',
    videoUrl: 'https://www.youtube.com/embed/wkD8rjkodUI',
    gifUrl: null
  },
  {
    id: 'strength_lower_5',
    name: 'Jump Lunges',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 1.5,
    sets: 3,
    reps: 16,
    targetMuscles: ['bacaklar', 'kalça', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 11,
    instructions: 'Lunge pozisyonunda zıplayarak bacakları değiştirin.',
    videoUrl: 'https://www.youtube.com/embed/UItWltVZZmE',
    gifUrl: null
  },
  {
    id: 'strength_lower_6',
    name: 'Glute Bridge',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['kalça', 'sırt', 'core'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Sırt üstü yatarak kalçanızı yukarı kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/wPM8icPu6H8',
    gifUrl: null
  },
  {
    id: 'strength_lower_7',
    name: 'Single-Leg Glute Bridge',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['kalça', 'denge'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Tek bacak üzerinde glute bridge yapın.',
    videoUrl: 'https://www.youtube.com/embed/eGo4IYlbE5g',
    gifUrl: null
  },
  {
    id: 'strength_lower_8',
    name: 'Wall Sit',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1,
    sets: 3,
    reps: null,
    targetMuscles: ['bacaklar', 'dayanıklılık'],
    equipment: 'wall',
    caloriesPerMinute: 5,
    instructions: 'Duvara yaslanarak sandalyede oturur gibi pozisyon alın ve tutun.',
    videoUrl: 'https://www.youtube.com/embed/mGvzVjuY8SY',
    gifUrl: null
  },
  {
    id: 'strength_lower_9',
    name: 'Calf Raises',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 25,
    targetMuscles: ['baldır'],
    equipment: 'none',
    caloriesPerMinute: 4,
    instructions: 'Ayak parmaklarınızın ucuna basarak baldırları çalıştırın.',
    videoUrl: 'https://www.youtube.com/embed/gwWv7aPcD88',
    gifUrl: null
  },
  {
    id: 'strength_lower_10',
    name: 'Side Leg Raises',
    category: EXERCISE_CATEGORIES.STRENGTH_LOWER,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['kalça', 'yan kaslar'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Yan yatarak bacağınızı yukarı kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/L_xrDAtykMI',
    gifUrl: null
  },

  // ============ STRENGTH CORE ============
  {
    id: 'strength_core_1',
    name: 'Plank',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 3,
    reps: null,
    targetMuscles: ['core', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Dirsekleriniz üzerinde vücudunuzu düz tutarak plank pozisyonunda kalın.',
    videoUrl: 'https://www.youtube.com/embed/B296mZDhrP4',
    gifUrl: null,
    alternatives: [
      {
        id: 'strength_core_1_alt1',
        name: 'Knee Plank (Diz Üstü Plank)',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1,
        sets: 3,
        reps: null,
        targetMuscles: ['core', 'omuzlar'],
        equipment: 'none',
        caloriesPerMinute: 3,
        instructions: 'Dizleriniz yerde olacak şekilde plank pozisyonunda tutun. Başlangıç seviyesi.',
        videoUrl: 'https://www.youtube.com/embed/c_Dq_NCzj8M'
      },
      {
        id: 'strength_core_1_alt2',
        name: 'Bird Dog',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1,
        sets: 3,
        reps: 20,
        targetMuscles: ['core', 'sırt', 'denge'],
        equipment: 'none',
        caloriesPerMinute: 4,
        instructions: 'Dört ayak üzerinde karşı kol ve bacağı uzatarak denge çalışın.',
        videoUrl: 'https://www.youtube.com/embed/8PwoytUU06g'
      },
      {
        id: 'strength_core_1_alt3',
        name: 'Dead Bug',
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        duration: 1,
        sets: 3,
        reps: 20,
        targetMuscles: ['core', 'koordinasyon'],
        equipment: 'none',
        caloriesPerMinute: 4,
        instructions: 'Sırtüstü yatarak karşı kol ve bacağı hareket ettirin. Sırt dostu core egzersizi.',
        videoUrl: 'https://www.youtube.com/embed/4XLEnwUr1d8'
      }
    ]
  },
  {
    id: 'strength_core_2',
    name: 'Side Plank (Yan Plank)',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 0.75,
    sets: 3,
    reps: null,
    targetMuscles: ['obliques', 'core', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Yan tarafta dirsek üzerinde vücudu düz tutun.',
    videoUrl: 'https://www.youtube.com/embed/wqzrb67Dwf8',
    gifUrl: null
  },
  {
    id: 'strength_core_3',
    name: 'Crunches',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 25,
    targetMuscles: ['karın kasları'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Sırt üstü yatarak üst gövdeyi kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/MKmrqcoCZ-M',
    gifUrl: null
  },
  {
    id: 'strength_core_4',
    name: 'Bicycle Crunches',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 30,
    targetMuscles: ['karın kasları', 'obliques'],
    equipment: 'none',
    caloriesPerMinute: 7,
    instructions: 'Karşılıklı dirsek-diz birleştirerek bisiklet hareketi yapın.',
    videoUrl: 'https://www.youtube.com/embed/Iwyvozckjak',
    gifUrl: null
  },
  {
    id: 'strength_core_5',
    name: 'Russian Twists',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 40,
    targetMuscles: ['obliques', 'core'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Oturur pozisyonda gövdeyi sağa-sola çevirin.',
    videoUrl: 'https://www.youtube.com/embed/wkD8rjkodUI',
    gifUrl: null
  },
  {
    id: 'strength_core_6',
    name: 'Leg Raises',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['alt karın'],
    equipment: 'none',
    caloriesPerMinute: 6,
    instructions: 'Sırt üstü yatarak bacakları düz şekilde yukarı kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/Wp4BlxcFTkE',
    gifUrl: null
  },
  {
    id: 'strength_core_7',
    name: 'Flutter Kicks',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 3,
    reps: null,
    targetMuscles: ['alt karın', 'core'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Sırt üstü yatarak bacakları yukarı-aşağı hızlı hareket ettirin.',
    videoUrl: 'https://www.youtube.com/embed/8PwoytUU06g',
    gifUrl: null
  },
  {
    id: 'strength_core_8',
    name: 'Dead Bug',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1.5,
    sets: 3,
    reps: 20,
    targetMuscles: ['core', 'denge'],
    equipment: 'none',
    caloriesPerMinute: 5,
    instructions: 'Sırt üstü yatarak karşılıklı kol-bacak hareketleri yapın.',
    videoUrl: 'https://www.youtube.com/embed/4XLEnwUr1d8',
    gifUrl: null
  },
  {
    id: 'strength_core_9',
    name: 'Mountain Climbers (Core fokus)',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 1.5,
    sets: 3,
    reps: 30,
    targetMuscles: ['core', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 10,
    instructions: 'Plank pozisyonunda dizleri göğse çekin.',
    videoUrl: 'https://www.youtube.com/embed/kLh-uczlPLg',
    gifUrl: null
  },
  {
    id: 'strength_core_10',
    name: 'V-Ups',
    category: EXERCISE_CATEGORIES.STRENGTH_CORE,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 1.5,
    sets: 3,
    reps: 15,
    targetMuscles: ['core', 'karın kasları'],
    equipment: 'none',
    caloriesPerMinute: 8,
    instructions: 'Sırt üstü yatarak kol ve bacakları aynı anda kaldırarak V şekli yapın.',
    videoUrl: 'https://www.youtube.com/embed/7UVgs18Y1P4',
    gifUrl: null
  },

  // ============ HIIT ============
  {
    id: 'hiit_1',
    name: 'Burpees (HIIT)',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 0.75,
    sets: 4,
    reps: 12,
    targetMuscles: ['tüm vücut'],
    equipment: 'none',
    caloriesPerMinute: 15,
    instructions: 'Maksimum hız ile burpee yapın.',
    videoUrl: 'https://www.youtube.com/embed/dZgVxmf6jkA',
    gifUrl: null
  },
  {
    id: 'hiit_2',
    name: 'High Knees (HIIT)',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 0.75,
    sets: 4,
    reps: null,
    targetMuscles: ['kalp', 'bacaklar'],
    equipment: 'none',
    caloriesPerMinute: 12,
    instructions: 'Maksimum hız ile dizleri yukarı kaldırın.',
    videoUrl: 'https://www.youtube.com/embed/mmq5zZfmIws',
    gifUrl: null
  },
  {
    id: 'hiit_3',
    name: 'Jump Squats (HIIT)',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 0.75,
    sets: 4,
    reps: 15,
    targetMuscles: ['bacaklar', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 13,
    instructions: 'Hızlı tempoda jump squat yapın.',
    videoUrl: 'https://www.youtube.com/embed/Azl5tkCzDcc',
    gifUrl: null
  },
  {
    id: 'hiit_4',
    name: 'Sprint (Yerinde)',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 0.5,
    sets: 5,
    reps: null,
    targetMuscles: ['kalp', 'bacaklar'],
    equipment: 'none',
    caloriesPerMinute: 14,
    instructions: 'Yerinde maksimum hızda koşun.',
    videoUrl: 'https://www.youtube.com/embed/2g811Eo7K8U',
    gifUrl: null
  },
  {
    id: 'hiit_5',
    name: 'Tuck Jumps',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    duration: 0.75,
    sets: 4,
    reps: 12,
    targetMuscles: ['bacaklar', 'core', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 14,
    instructions: 'Zıplayarak dizleri göğse çekin.',
    videoUrl: 'https://www.youtube.com/embed/Azl5tkCzDcc',
    gifUrl: null
  },
  {
    id: 'hiit_6',
    name: 'Plank Jacks',
    category: EXERCISE_CATEGORIES.HIIT,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    duration: 0.75,
    sets: 4,
    reps: 25,
    targetMuscles: ['core', 'omuzlar', 'kalp'],
    equipment: 'none',
    caloriesPerMinute: 11,
    instructions: 'Plank pozisyonunda bacakları açıp kapayın.',
    videoUrl: 'https://www.youtube.com/embed/8PwoytUU06g',
    gifUrl: null
  },

  // ============ FLEXIBILITY ============
  {
    id: 'flex_1',
    name: 'Hamstring Stretch',
    category: EXERCISE_CATEGORIES.FLEXIBILITY,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: null,
    targetMuscles: ['arka bacak kasları'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Oturarak bacağı uzatıp öne doğru eğilin.',
    videoUrl: 'https://www.youtube.com/embed/UItWltVZZmE',
    gifUrl: null
  },
  {
    id: 'flex_2',
    name: 'Quad Stretch',
    category: EXERCISE_CATEGORIES.FLEXIBILITY,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: null,
    targetMuscles: ['ön bacak kasları'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Ayakta bacağı geriye kaldırıp kalçaya dokundurarak gerin.',
    videoUrl: 'https://www.youtube.com/embed/eGo4IYlbE5g',
    gifUrl: null
  },
  {
    id: 'flex_3',
    name: 'Child\'s Pose',
    category: EXERCISE_CATEGORIES.FLEXIBILITY,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 1,
    reps: null,
    targetMuscles: ['sırt', 'omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 1,
    instructions: 'Dizler üzerinde öne uzanarak sırtı gerin.',
    videoUrl: 'https://www.youtube.com/embed/c_Dq_NCzj8M',
    gifUrl: null
  },
  {
    id: 'flex_4',
    name: 'Cat-Cow Stretch',
    category: EXERCISE_CATEGORIES.FLEXIBILITY,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: 15,
    targetMuscles: ['omurga', 'sırt'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Dört ayak üzerinde sırtı kambur-çukur yapın.',
    videoUrl: 'https://www.youtube.com/embed/g_tea8ZNk5A',
    gifUrl: null
  },
  {
    id: 'flex_5',
    name: 'Shoulder Stretch',
    category: EXERCISE_CATEGORIES.FLEXIBILITY,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 2,
    reps: null,
    targetMuscles: ['omuzlar'],
    equipment: 'none',
    caloriesPerMinute: 1,
    instructions: 'Kollarınızı karşı tarafa çekerek omuzları gerin.',
    videoUrl: 'https://www.youtube.com/embed/M0uO8X3_tEA',
    gifUrl: null
  },

  // ============ COOLDOWN ============
  {
    id: 'cooldown_1',
    name: 'Yavaş Yürüyüş',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 2,
    sets: 1,
    reps: null,
    targetMuscles: ['kalp'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Yavaş tempoda yerinde yürüyün.',
    videoUrl: 'https://www.youtube.com/embed/2g811Eo7K8U',
    gifUrl: null
  },
  {
    id: 'cooldown_2',
    name: 'Derin Nefes Egzersizi',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 1,
    sets: 1,
    reps: 10,
    targetMuscles: ['akciğerler'],
    equipment: 'none',
    caloriesPerMinute: 1,
    instructions: 'Derin nefes alıp verin, kalp atışınızı düzenleyin.',
    videoUrl: 'https://www.youtube.com/embed/DbDoBzGY3vo',
    gifUrl: null
  },
  {
    id: 'cooldown_3',
    name: 'Full Body Stretch',
    category: EXERCISE_CATEGORIES.COOLDOWN,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    duration: 2,
    sets: 1,
    reps: null,
    targetMuscles: ['tüm vücut'],
    equipment: 'none',
    caloriesPerMinute: 2,
    instructions: 'Tüm vücudu gererek soğuma yapın.',
    videoUrl: 'https://www.youtube.com/embed/qULTwquOuT4',
    gifUrl: null
  }
];

// Yardımcı fonksiyonlar
export const getExercisesByCategory = (category) => {
  return exerciseLibrary.filter(ex => ex.category === category);
};

export const getExercisesByDifficulty = (difficulty) => {
  return exerciseLibrary.filter(ex => ex.difficulty === difficulty);
};

export const getExercisesByGoal = (goal) => {
  // Hedefe göre uygun kategorileri seç
  const categoryMapping = {
    [FITNESS_GOALS.WEIGHT_LOSS]: [
      EXERCISE_CATEGORIES.WARMUP,
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.HIIT,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.COOLDOWN
    ],
    [FITNESS_GOALS.MUSCLE_GAIN]: [
      EXERCISE_CATEGORIES.WARMUP,
      EXERCISE_CATEGORIES.STRENGTH_UPPER,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE,
      EXERCISE_CATEGORIES.COOLDOWN
    ],
    [FITNESS_GOALS.GENERAL_FITNESS]: [
      EXERCISE_CATEGORIES.WARMUP,
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.STRENGTH_UPPER,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE,
      EXERCISE_CATEGORIES.FLEXIBILITY,
      EXERCISE_CATEGORIES.COOLDOWN
    ],
    [FITNESS_GOALS.HIIT_FOCUS]: [
      EXERCISE_CATEGORIES.WARMUP,
      EXERCISE_CATEGORIES.HIIT,
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.COOLDOWN
    ],
    [FITNESS_GOALS.BEGINNER_FRIENDLY]: [
      EXERCISE_CATEGORIES.WARMUP,
      EXERCISE_CATEGORIES.CARDIO,
      EXERCISE_CATEGORIES.STRENGTH_LOWER,
      EXERCISE_CATEGORIES.STRENGTH_CORE,
      EXERCISE_CATEGORIES.FLEXIBILITY,
      EXERCISE_CATEGORIES.COOLDOWN
    ]
  };

  const categories = categoryMapping[goal] || Object.values(EXERCISE_CATEGORIES);
  return exerciseLibrary.filter(ex => categories.includes(ex.category));
};

export default exerciseLibrary;
