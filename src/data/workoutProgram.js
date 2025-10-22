// 30 Günlük Spor Programı - Başlangıç Seviyesi
// Profil: 28 yaş, 1.55 m, 56 kg, evden çalışan, günde 30 dakikaya kadar zaman ayırabilen kullanıcı
// Ekipman seçenekleri: Mat, pilates topu, 5 kg dumbbell, direnç lastiği, hulahop çemberi

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

// Video için helper function (sadece video URL'i)
const withMedia = (youtubeIdOrUrl, credit) => {
  const isFullUrl = typeof youtubeIdOrUrl === 'string' && (youtubeIdOrUrl.startsWith('http://') || youtubeIdOrUrl.startsWith('https://'));
  return {
    videoUrl: isFullUrl ? youtubeIdOrUrl : `https://www.youtube.com/embed/${youtubeIdOrUrl}`,
    videoCredit: credit
  };
};

// GIF eklemek için helper function (gerçek hareketli GIF URL'i)
// Kullanım: ...withGif('https://example.com/egzersiz.gif')
export const withGif = (gifUrl) => ({
  gifUrl: gifUrl
});

export const USER_PROFILE = {
  weightKg: 56,
  age: 28,
  heightCm: 155
};

const MET_LEVELS = {
  veryLow: 2.3,
  low: 2.8,
  moderate: 4.2,
  moderateHigh: 5.2,
  high: 6.2
};

const getMetValue = (exercise) => {
  if (exercise?.isWarmup || exercise?.isCooldown || exercise?.isOptional) {
    return MET_LEVELS.low;
  }

  const difficulty = (exercise?.difficulty || '').toLowerCase();
  if (difficulty.includes('zor')) {
    return MET_LEVELS.high;
  }
  if (difficulty.includes('orta')) {
    return MET_LEVELS.moderateHigh;
  }
  if (difficulty.includes('kolay')) {
    return MET_LEVELS.moderate;
  }
  return MET_LEVELS.moderate;
};

const getDuration = (exercise) => {
  if (!exercise) return 0;
  if (exercise.duration) return exercise.duration;
  const match = typeof exercise.reps === 'string' && exercise.reps.match(/(\d+)\s*dakika/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
};

const roundToSingleDecimal = (value) => Math.round(value * 10) / 10;

export const calculateExerciseCalories = (exercise, weightKg = USER_PROFILE.weightKg) => {
  const duration = getDuration(exercise);
  if (!duration) return 0;
  const met = getMetValue(exercise);
  const calories = (met * weightKg * duration) / 60;
  return roundToSingleDecimal(calories);
};

const exerciseLibrary = {
  warmupWalk: {
    name: "Isınma - Hafif Yürüyüş",
    duration: 4,
    reps: "4 dakika",
    description: "Yerinde veya odada hafif tempo yürüyüş. Dizleri fazla yükseltmeden ritmi yakala.",
    videoGuide: "Omuzlar düşük, nefesini düzenle. Isınma boyunca konuşabilecek rahatlıkta ol.",
    difficulty: "Kolay",
    targetMuscles: ["Kalp", "Bacaklar"],
    requiresEquipment: false,
    isWarmup: true,
    ...withMedia('NNf8AlyqjQo', 'YouTube - Emily Daugherty'),
    alternatives: [
      {
        name: "Yerinde Hafif Adımlar",
        duration: 4,
        reps: "4 dakika",
        description: "Dizleri öne kaldır, kolları serbestçe sallayarak ritmi koru.",
        difficulty: "Kolay",
        targetMuscles: ["Kalp"],
        requiresEquipment: false,
        ...withMedia('QilgMPG7OaA', 'YouTube - HASfit')
      }
    ]
  },
  armWarmup: {
    name: "Isınma - Kol ve Omuz Mobilitesi",
    duration: 3,
    reps: "3 dakika",
    description: "Kolları öne-arkaya, dairesel ve çapraz sallayarak üst vücudu hazırla.",
    videoGuide: "Dirsekleri kilitleme. Büyük daireler çiz, omuzları rahat bırak.",
    difficulty: "Kolay",
    targetMuscles: ["Omuzlar", "Sırt"],
    requiresEquipment: false,
    isWarmup: true,
    ...withMedia('2L2lnxIcNmo', 'YouTube - MadFit'),
    alternatives: [
      {
        name: "Direnç Lastiği ile Kol Açma",
        duration: 3,
        reps: "3 dakika",
        description: "Lastiği hafif gerginlikte tutarak kolları yana aç-kapat.",
        difficulty: "Kolay",
        targetMuscles: ["Omuzlar"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('3VcKaXpzqRo', 'YouTube - ScottHermanFitness')
      }
    ]
  },
  dynamicWarmup: {
    name: "Isınma - Dinamik Bacak Açma",
    duration: 3,
    reps: "3 dakika",
    description: "Öne-arkaya bacak savuruşları, kalça daireleri, hafif squat geçişleri yap.",
    videoGuide: "Hareketleri kontrollü tut, kalça ve dizleri ısıt.",
    difficulty: "Kolay",
    targetMuscles: ["Bacaklar", "Kalça"],
    requiresEquipment: false,
    isWarmup: true,
    ...withMedia('2L2lnxIcNmo', 'YouTube - MadFit'),
    alternatives: [
      {
        name: "Hulahop ile Isınma",
        duration: 3,
        reps: "3 dakika",
        description: "Hulahop çevirerek bele dolaşım gönder.",
        difficulty: "Kolay",
        targetMuscles: ["Kalça", "Karın"],
        requiresEquipment: true,
        equipment: ["Hulahop"],
        ...withMedia('GE3DIpkCsPk', 'YouTube - hoopsmiles')
      }
    ]
  },
  marchWarmup: {
    name: "Isınma - Yerinde Yürüyüş",
    duration: 3,
    reps: "3 dakika",
    description: "Dizleri hafif kaldırarak yerinde yürü, kolları ritmik hareket ettir.",
    videoGuide: "Topukları yumuşak bas, nefesi düzenle.",
    difficulty: "Kolay",
    targetMuscles: ["Kalp"],
    requiresEquipment: false,
    isWarmup: true,
    ...withMedia('QilgMPG7OaA', 'YouTube - HASfit')
  },
  stepTouchWarmup: {
    name: "Isınma - Step Touch",
    duration: 3,
    reps: "3 dakika",
    description: "Sağa-sola adım at, kollarla hafif çapraz hareket ekle.",
    videoGuide: "Ayak parmaklarını yerde kaydır, dizleri kilitleme.",
    difficulty: "Kolay",
    targetMuscles: ["Kalp", "Kalça"],
    requiresEquipment: false,
    isWarmup: true,
    ...withMedia('8oTjg7ZXJok', 'YouTube - Health WHYS')
  },
  cooldownStretch: {
    name: "Soğutma - Esneme",
    duration: 4,
    reps: "4 dakika",
    description: "Tüm vücut için temel esnetmeler (bacak, göğüs, omuz).",
    videoGuide: "Her esnemeyi 20-30 saniye tut, nefesi derin al.",
    difficulty: "Kolay",
    targetMuscles: ["Tüm Vücut"],
    requiresEquipment: false,
    isCooldown: true,
    ...withMedia('92JXisa5rbk', 'YouTube - Fit by Lys')
  },
  yogaStretch: {
    name: "Soğutma - Yoga Akışı",
    duration: 6,
    reps: "6 dakika",
    description: "Hafif yoga pozları ile nefes ve esneme kombinasyonu.",
    videoGuide: "Pozlarda yavaşça ilerle, sırtı uzun tut.",
    difficulty: "Kolay",
    targetMuscles: ["Kalça", "Sırt", "Omuz"],
    requiresEquipment: false,
    isCooldown: true,
    ...withMedia('v7AYKMP6rOE', 'YouTube - Yoga With Adriene')
  },
  hipMobility: {
    name: "Kalça Mobilizasyonu",
    duration: 4,
    reps: "4 dakika",
    description: "Kalça daireleri, diz çekme ve yana açmalar ile eklemleri rahatlat.",
    videoGuide: "Kontrollü hareket et, belini sıkıştırma.",
    difficulty: "Kolay",
    targetMuscles: ["Kalça", "Bel"],
    requiresEquipment: false,
    ...withMedia('AlXL68m2mx4', 'YouTube - Caroline Jordan'),
    alternatives: [
      {
        name: "Hulahop Akışı",
        duration: 4,
        reps: "4 dakika",
        description: "Hulahop ile kalça çevirmesi yap.",
        difficulty: "Kolay",
        targetMuscles: ["Kalça", "Karın"],
        requiresEquipment: true,
        equipment: ["Hulahop"],
        ...withMedia('GE3DIpkCsPk', 'YouTube - hoopsmiles')
      }
    ]
  },
  squat: {
    name: "Boş Squat",
    duration: 3,
    reps: "3 set x 10 tekrar",
    description: "Ayaklar omuz genişliğinde, kalçayı geriye göndererek çömel.",
    videoGuide: "Dizler tırnaklarını geçmesin, göğüs dik kalsın.",
    difficulty: "Kolay",
    targetMuscles: ["Bacaklar", "Glutler"],
    requiresEquipment: false,
    ...withMedia('aclHkVaku9U', 'YouTube - Mind Pump TV'),
    alternatives: [
      {
        name: "Step Up (Sandalye)",
        duration: 3,
        reps: "3 set x 10 tekrar (her bacak)",
        description: "Sandalye ya da sağlam bir kutuya adım at, topukla it.",
        difficulty: "Kolay",
        targetMuscles: ["Bacaklar", "Glutler"],
        requiresEquipment: true,
        equipment: ["Sandalye"],
        ...withMedia('dQqApCGd5Ss', 'YouTube - HASfit')
      },
      {
        name: "Goblet Squat",
        duration: 3,
        reps: "3 set x 8 tekrar",
        description: "Göğüs seviyesinde dumbbell tutarak daha kontrollü squat yap.",
        difficulty: "Orta",
        targetMuscles: ["Bacaklar", "Glutler"],
        requiresEquipment: true,
        equipment: ["5 kg Dumbbell"],
        ...withMedia('fCrlwlr759o', 'YouTube - Healthy Living Basics')
      }
    ]
  },
  pushupKnees: {
    name: "Dizler Üzerinde Push-up",
    duration: 3,
    reps: "3 set x 8 tekrar",
    description: "Dizler yerde, eller omuz genişliğinde. Gövdeyi düz çizgide tut.",
    videoGuide: "Dirsekleri 45° açı ile bük, göğsü yere yaklaştır.",
    difficulty: "Kolay",
    targetMuscles: ["Göğüs", "Triseps", "Omuz"],
    requiresEquipment: false,
    ...withMedia('IODxDxX7oi4', 'YouTube - ScottHermanFitness'),
    alternatives: [
      {
        name: "Duvar Push-up",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Eller duvarda, vücudu eğerek kontrollü şınav.",
        difficulty: "Kolay",
        targetMuscles: ["Göğüs", "Omuz"],
        requiresEquipment: false,
        ...withMedia('IODxDxX7oi4', 'YouTube - ScottHermanFitness')
      },
      {
        name: "Dumbbell Bench Press",
        duration: 3,
        reps: "3 set x 10 tekrar",
        description: "Sırt üstü uzan, dumbbell'ları göğüs hizasından yukarı it.",
        difficulty: "Orta",
        targetMuscles: ["Göğüs", "Triseps"],
        requiresEquipment: true,
        equipment: ["5 kg Dumbbell"],
        ...withMedia('VmB1G1K7v94', 'YouTube - ScottHermanFitness')
      }
    ]
  },
  lunge: {
    name: "Lunge",
    duration: 3,
    reps: "2 set x 10 tekrar (her bacak)",
    description: "Öne büyük adım at, arka diz yere yaklaşırken önde 90° açı oluştur.",
    videoGuide: "Öndeki diz parmak ucunu geçmesin, gövde dik kalsın.",
    difficulty: "Orta",
    targetMuscles: ["Bacaklar", "Glutler"],
    requiresEquipment: false,
    ...withMedia('QOVaHwm-Q6U', 'YouTube - Bowflex'),
    alternatives: [
      {
        name: "Reverse Lunge",
        duration: 3,
        reps: "2 set x 10 tekrar (her bacak)",
        description: "Arkaya adım atarak dizleri koru.",
        difficulty: "Kolay",
        targetMuscles: ["Bacaklar"],
        requiresEquipment: false,
        ...withMedia('Z2n58m2i4jg', 'YouTube - JessicaSmithTV')
      },
      {
        name: "Walking Lunge",
        duration: 3,
        reps: "2 set x 12 adım",
        description: "Lungeleri yürüyerek ardışık uygula.",
        difficulty: "Orta",
        targetMuscles: ["Bacaklar", "Kalça"],
        requiresEquipment: false,
        ...withMedia('wrwwXE_x-pQ', 'YouTube - Howcast')
      }
    ]
  },
  gluteBridge: {
    name: "Glute Bridge",
    duration: 3,
    reps: "3 set x 12 tekrar",
    description: "Sırt üstü uzan, topukları yere bastırıp kalçayı yukarı kaldır.",
    videoGuide: "Üst noktada kalçayı sık, belini aşırı kavis yapma.",
    difficulty: "Kolay",
    targetMuscles: ["Glutler", "Hamstring"],
    requiresEquipment: false,
    ...withMedia('8bbE64NuDTU', 'YouTube - FitnessBlender'),
    alternatives: [
      {
        name: "Tek Bacak Glute Bridge",
        duration: 3,
        reps: "2 set x 10 tekrar (her bacak)",
        description: "Bir bacak havada, diğer bacak ile köprü yap.",
        difficulty: "Orta",
        targetMuscles: ["Glutler", "Kalça"],
        requiresEquipment: false,
        ...withMedia('8bbE64NuDTU', 'YouTube - FitnessBlender')
      },
      {
        name: "Eşek Tekmesi (Donkey Kick)",
        duration: 3,
        reps: "2 set x 12 tekrar (her bacak)",
        description: "Dizleri yere koy, ayağı tavana iterken kalçayı sık.",
        difficulty: "Orta",
        targetMuscles: ["Glutler"],
        requiresEquipment: false,
        ...withMedia('YoOlLusFMYU', 'YouTube - Hinge Health')
      }
    ]
  },
  plank: {
    name: "Plank",
    duration: 2,
    reps: "2 set x 25 saniye",
    description: "Dirsekler omuz altında, vücut düz çizgide.",
    videoGuide: "Karın kasını sık, belini düşürme.",
    difficulty: "Orta",
    targetMuscles: ["Karın", "Omuz"],
    requiresEquipment: false,
    ...withMedia('ASdvN_XEl_c', 'YouTube - Bowflex'),
    alternatives: [
      {
        name: "Bird Dog",
        duration: 2,
        reps: "2 set x 12 tekrar (karşı kol/bacak)",
        description: "Dört ayak üzerinde karşı kol ve bacağı uzat.",
        difficulty: "Kolay",
        targetMuscles: ["Karın", "Sırt"],
        requiresEquipment: false,
        ...withMedia('IlfOCLq3ubs', 'YouTube - DAILY ATHLETE')
      },
      {
        name: "Dead Bug",
        duration: 2,
        reps: "2 set x 12 tekrar",
        description: "Sırt üstü yat, karşı kol ve bacakları uzatırken belini sabit tut.",
        difficulty: "Kolay",
        targetMuscles: ["Karın"],
        requiresEquipment: false,
        ...withMedia('4XLEnwUr1d8', 'YouTube - Bodybuilding.com')
      }
    ]
  },
  sideLegRaise: {
    name: "Yan Bacak Kaldırma",
    duration: 2,
    reps: "2 set x 12 tekrar (her taraf)",
    description: "Yan yatıp üstteki bacağı kontrollü kaldır-indir.",
    videoGuide: "Kalçayı sabit tut, hareketi yavaş yap.",
    difficulty: "Kolay",
    targetMuscles: ["Kalça", "Glutler"],
    requiresEquipment: false,
    ...withMedia('jgh6sGwtTwk', 'YouTube - 3v'),
    alternatives: [
      {
        name: "Ayakta Yan Bacak Kaldır",
        duration: 2,
        reps: "2 set x 12 tekrar (her taraf)",
        description: "Denge için duvara dokunabilir, bacağı yana aç.",
        difficulty: "Kolay",
        targetMuscles: ["Kalça"],
        requiresEquipment: false,
        ...withMedia('l_U2uoePtS4', 'YouTube - Penn State Health')
      },
      {
        name: "Lastikle Yan Adım",
        duration: 2,
        reps: "2 set x 15 adım",
        description: "Diz üstüne lastik bağla, yana küçük adımlar at.",
        difficulty: "Orta",
        targetMuscles: ["Kalça", "Glutler"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('8oTjg7ZXJok', 'YouTube - Health WHYS')
      }
    ]
  },
  gluteKickback: {
    name: "Eşek Tekmesi (Donkey Kick)",
    duration: 2,
    reps: "2 set x 12 tekrar (her bacak)",
    description: "Dört ayak üzerinde bir bacağı yukarı iterken kalçayı sık.",
    videoGuide: "Bel düzgün, bacağı çok yukarı savurma.",
    difficulty: "Kolay",
    targetMuscles: ["Glutler"],
    requiresEquipment: false,
    ...withMedia('YoOlLusFMYU', 'YouTube - Hinge Health'),
    alternatives: [
      {
        name: "Lastikle Kickback",
        duration: 2,
        reps: "2 set x 12 tekrar (her bacak)",
        description: "Direnç lastiğini ayağına takıp geriye it.",
        difficulty: "Orta",
        targetMuscles: ["Glutler"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('O4r7C5CxMw8', 'YouTube - Live Lean TV Daily Exercises')
      }
    ]
  },
  birdDog: {
    name: "Bird Dog",
    duration: 2,
    reps: "2 set x 12 tekrar",
    description: "Karşı kol ve bacağı uzatıp merkeze topla.",
    videoGuide: "Kalçayı sabit tut, karını sık.",
    difficulty: "Kolay",
    targetMuscles: ["Karın", "Alt Sırt"],
    requiresEquipment: false,
    ...withMedia('IlfOCLq3ubs', 'YouTube - DAILY ATHLETE'),
    alternatives: [
      {
        name: "Dead Bug",
        duration: 2,
        reps: "2 set x 12 tekrar",
        description: "Sırt üstü karşı kol/bacak uzat.",
        difficulty: "Kolay",
        targetMuscles: ["Karın"],
        requiresEquipment: false,
        ...withMedia('4XLEnwUr1d8', 'YouTube - Bodybuilding.com')
      }
    ]
  },
  deadBug: {
    name: "Dead Bug",
    duration: 2,
    reps: "2 set x 12 tekrar",
    description: "Belini sabit tutarak karşı kol ve bacağı uzat.",
    videoGuide: "Bel boşluk yapmasın, nefesle hareketi senkronla.",
    difficulty: "Kolay",
    targetMuscles: ["Karın"],
    requiresEquipment: false,
    ...withMedia('4XLEnwUr1d8', 'YouTube - Bodybuilding.com'),
    alternatives: [
      {
        name: "Standing Abs",
        duration: 2,
        reps: "2 set x 12 tekrar",
        description: "Ayakta karşı diz-dirsek birleştir.",
        difficulty: "Kolay",
        targetMuscles: ["Karın", "Kalça"],
        requiresEquipment: false,
        ...withMedia('jisp2xBP8pY', 'YouTube - Amanda Nix')
      }
    ]
  },
  superman: {
    name: "Superman",
    duration: 2,
    reps: "2 set x 12 tekrar",
    description: "Yüzüstü uzan, kollar ve bacakları aynı anda kaldır.",
    videoGuide: "Boynu nötr tut, belde sıkışma hissetme.",
    difficulty: "Kolay",
    targetMuscles: ["Sırt", "Glutler"],
    requiresEquipment: false,
    ...withMedia('z6PJMT2y8GQ', 'YouTube - Bowflex')
  },
  crunch: {
    name: "Crunch",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Karın kasını kullanarak omuzları yerden hafifçe kaldır.",
    videoGuide: "Çeneni göğse yapıştırma, karını sık.",
    difficulty: "Kolay",
    targetMuscles: ["Karın"],
    requiresEquipment: false,
    ...withMedia('Xyd_fa5zoEU', 'YouTube - ScottHermanFitness'),
    alternatives: [
      {
        name: "Standing Abs",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Ayakta diz-dirsek birleştirerek karını aktive et.",
        difficulty: "Kolay",
        targetMuscles: ["Karın", "Kalça"],
        requiresEquipment: false,
        ...withMedia('jisp2xBP8pY', 'YouTube - Amanda Nix')
      },
      {
        name: "Pilates Topu Crunch",
        duration: 2,
        reps: "3 set x 10 tekrar",
        description: "Pilates topu üzerinde sırtını destekleyerek crunch yap.",
        difficulty: "Orta",
        targetMuscles: ["Karın"],
        requiresEquipment: true,
        equipment: ["Pilates Topu"],
        ...withMedia('8NGXHJ2bEzE', 'YouTube - Human Kinetics')
      }
    ]
  },
  highKnees: {
    name: "Yüksek Diz (Low Impact)",
    duration: 2,
    reps: "3 tur x 30 saniye",
    description: "Dizleri göğüse çekerek ritmik tempoda çalış.",
    videoGuide: "Ayak parmak ucunda hafifçe yüksel, belini dik tut.",
    difficulty: "Orta",
    targetMuscles: ["Kalp", "Bacak"],
    requiresEquipment: false,
    ...withMedia('tU7T3ug8Q0E', 'YouTube - Exercise Library (Joanna Soh)'),
    alternatives: [
      {
        name: "Yerinde Yürüyüş (Low Impact)",
        duration: 2,
        reps: "3 tur x 30 saniye",
        description: "Dizleri daha az kaldırarak tempoyu düşür.",
        difficulty: "Kolay",
        targetMuscles: ["Kalp"],
        requiresEquipment: false,
        ...withMedia('QilgMPG7OaA', 'YouTube - HASfit')
      },
      {
        name: "Step Touch Kardiyo",
        duration: 2,
        reps: "3 tur x 30 saniye",
        description: "Sağa-sola adım ile tempo yükselt.",
        difficulty: "Kolay",
        targetMuscles: ["Kalp", "Kalça"],
        requiresEquipment: false,
        ...withMedia('8oTjg7ZXJok', 'YouTube - Health WHYS')
      }
    ]
  },
  marchLowImpact: {
    name: "Yerinde Yürüyüş",
    duration: 2,
    reps: "3 tur x 40 saniye",
    description: "Dizleri ritmik kaldır, kollarla eşlik et.",
    videoGuide: "Topukları yumuşak bas, nefesi kontrol et.",
    difficulty: "Kolay",
    targetMuscles: ["Kalp"],
    requiresEquipment: false,
    ...withMedia('QilgMPG7OaA', 'YouTube - HASfit')
  },
  lateralRaise: {
    name: "Lateral Raise",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Kolları yana omuz hizasına kadar kaldır.",
    videoGuide: "Dirsekleri hafif bük, hareketi kontrollü tamamla.",
    difficulty: "Kolay",
    targetMuscles: ["Omuz"],
    requiresEquipment: false,
    ...withMedia('3VcKaXpzqRo', 'YouTube - ScottHermanFitness'),
    alternatives: [
      {
        name: "Dumbbell Lateral Raise",
        duration: 2,
        reps: "3 set x 10 tekrar",
        description: "Hafif dumbbell ile aynı hareket.",
        difficulty: "Orta",
        targetMuscles: ["Omuz"],
        requiresEquipment: true,
        equipment: ["5 kg Dumbbell"],
        ...withMedia('3VcKaXpzqRo', 'YouTube - ScottHermanFitness')
      },
      {
        name: "Lastik ile Yana Açış",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Direnç lastiğini ayağın altında sabitleyip yana aç.",
        difficulty: "Kolay",
        targetMuscles: ["Omuz"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('3VcKaXpzqRo', 'YouTube - ScottHermanFitness')
      }
    ]
  },
  tricepDip: {
    name: "Sandalye Dips",
    duration: 3,
    reps: "3 set x 8 tekrar",
    description: "Sandalye kenarında ellerle destek al, dirsekleri bükerek aşağı in.",
    videoGuide: "Dirsekleri geriye bakacak şekilde tut.",
    difficulty: "Orta",
    targetMuscles: ["Triseps", "Omuz"],
    requiresEquipment: true,
    equipment: ["Sandalye"],
    ...withMedia('0326dy_-CzM', 'YouTube - FitnessBlender'),
    alternatives: [
      {
        name: "Masa Kenarı Triseps Germe",
        duration: 3,
        reps: "3 set x 10 tekrar",
        description: "Masa kenarında hafif destekle aşağı-yukarı hareket.",
        difficulty: "Kolay",
        targetMuscles: ["Triseps"],
        requiresEquipment: true,
        equipment: ["Sandalye"],
        ...withMedia('0326dy_-CzM', 'YouTube - FitnessBlender')
      },
      {
        name: "Direnç Lastiği Triseps Press",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Lastiği üstten tutup aşağıya doğru it.",
        difficulty: "Kolay",
        targetMuscles: ["Triseps"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('qJAMnjzlA2o', 'YouTube - ProZound Wellness')
      }
    ]
  },
  resistanceBandRow: {
    name: "Direnç Lastiği Row",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Lastiği ayaklarına sar, kolları gövdeye çek.",
    videoGuide: "Omuzları aşağıda tut, kürek kemiklerini sık.",
    difficulty: "Kolay",
    targetMuscles: ["Sırt", "Biseps"],
    requiresEquipment: true,
    equipment: ["Lastik"],
    ...withMedia('LSkyinhmA8k', 'YouTube - Get Healthy U'),
    alternatives: [
      {
        name: "Havluyla Row",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Kalın bir havluyu kapıya sıkıştırıp kendine çek.",
        difficulty: "Kolay",
        targetMuscles: ["Sırt"],
        requiresEquipment: true,
        equipment: ["Havlu"],
        ...withMedia('FVxT8QuAU-0', 'YouTube - Peter Edwards PT')
      },
      {
        name: "Superman Çekiş",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Yüzüstü uzanıp kolları önden yana çek.",
        difficulty: "Kolay",
        targetMuscles: ["Sırt"],
        requiresEquipment: false,
        ...withMedia('z6PJMT2y8GQ', 'YouTube - Bowflex')
      }
    ]
  },
  bicepCurl: {
    name: "Biseps Curl",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Dumbbell ya da lastikle kolları bük.",
    videoGuide: "Dirsekleri gövdeye yakın tut.",
    difficulty: "Kolay",
    targetMuscles: ["Biseps"],
    requiresEquipment: true,
    equipment: ["5 kg Dumbbell"],
    ...withMedia('sAq_ocpRh_I', 'YouTube - ScottHermanFitness'),
    alternatives: [
      {
        name: "Direnç Lastiği Curl",
        duration: 2,
        reps: "3 set x 15 tekrar",
        description: "Lastiği ayaklarının altında sabitle, kolları bük.",
        difficulty: "Kolay",
        targetMuscles: ["Biseps"],
        requiresEquipment: true,
        equipment: ["Lastik"],
        ...withMedia('20xtfGZ37nw', 'YouTube - LGN Lyfestile')
      }
    ]
  },
  dumbbellBenchPress: {
    name: "Dumbbell Bench Press",
    duration: 3,
    reps: "3 set x 10 tekrar",
    description: "Sırt üstü uzan, dumbbell'ları kontrollü indir-kaldır.",
    videoGuide: "Dirsekleri 45° açı ile aç, nefes kontrolünü koru.",
    difficulty: "Orta",
    targetMuscles: ["Göğüs", "Triseps"],
    requiresEquipment: true,
    equipment: ["5 kg Dumbbell"],
    ...withMedia('VmB1G1K7v94', 'YouTube - ScottHermanFitness'),
    alternatives: [
      {
        name: "Push-up",
        duration: 3,
        reps: "3 set x 10 tekrar",
        description: "Klasik şınav ile aynı kasları çalıştır.",
        difficulty: "Orta",
        targetMuscles: ["Göğüs", "Triseps"],
        requiresEquipment: false,
        ...withMedia('IODxDxX7oi4', 'YouTube - ScottHermanFitness')
      }
    ]
  },
  gobletSquat: {
    name: "Goblet Squat",
    duration: 3,
    reps: "3 set x 10 tekrar",
    description: "Dumbbell'ı göğüs hizasında tutarak squat yap.",
    videoGuide: "Dizleri dışa doğru it, göğsü dik tut.",
    difficulty: "Orta",
    targetMuscles: ["Bacak", "Glutler"],
    requiresEquipment: true,
    equipment: ["5 kg Dumbbell"],
    ...withMedia('fCrlwlr759o', 'YouTube - Healthy Living Basics'),
    alternatives: [
      {
        name: "Boş Squat",
        duration: 3,
        reps: "3 set x 12 tekrar",
        description: "Ekipmansız versiyon.",
        difficulty: "Kolay",
        targetMuscles: ["Bacaklar", "Glutler"],
        requiresEquipment: false,
        ...withMedia('aclHkVaku9U', 'YouTube - Mind Pump TV')
      }
    ]
  },
  pilatesBallCrunch: {
    name: "Pilates Topu Crunch",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Top üzerinde denge kurarak karın kaslarını çalıştır.",
    videoGuide: "Belini destekle, hareketi kontrollü yap.",
    difficulty: "Orta",
    targetMuscles: ["Karın"],
    requiresEquipment: true,
    equipment: ["Pilates Topu"],
    ...withMedia('8NGXHJ2bEzE', 'YouTube - Human Kinetics'),
    alternatives: [
      {
        name: "Crunch",
        duration: 2,
        reps: "3 set x 12 tekrar",
        description: "Mat üzerinde klasik crunch.",
        difficulty: "Kolay",
        targetMuscles: ["Karın"],
        requiresEquipment: false,
        ...withMedia('Xyd_fa5zoEU', 'YouTube - ScottHermanFitness')
      }
    ]
  },
  stepTouchCardio: {
    name: "Step Touch Kardiyo",
    duration: 3,
    reps: "3 tur x 45 saniye",
    description: "Sağa sola adım atarak düşük etkili kardiyo yap.",
    videoGuide: "Kollarla çapraz hareket ekle, nefes kontrolü sağla.",
    difficulty: "Kolay",
    targetMuscles: ["Kalp", "Kalça"],
    requiresEquipment: false,
    ...withMedia('8oTjg7ZXJok', 'YouTube - Health WHYS')
  },
  standingAbs: {
    name: "Ayakta Karın Akışı",
    duration: 2,
    reps: "3 set x 12 tekrar",
    description: "Karşı diz ve dirseği birleştirerek merkez kaslarını çalıştır.",
    videoGuide: "Belden dön, karın kasını sık.",
    difficulty: "Kolay",
    targetMuscles: ["Karın", "Kalça"],
    requiresEquipment: false,
    ...withMedia('jisp2xBP8pY', 'YouTube - Amanda Nix'),
    alternatives: [
      {
        name: "Hulahop Akışı",
        duration: 3,
        reps: "3 dakika",
        description: "Hulahop çemberi ile bel çevresinde kontrollü hareket.",
        difficulty: "Kolay",
        targetMuscles: ["Karın", "Kalça"],
        requiresEquipment: true,
        equipment: ["Hulahop"],
        ...withMedia('GE3DIpkCsPk', 'YouTube - hoopsmiles')
      },
      {
        name: "Mat Üstü Dead Bug",
        duration: 2,
        reps: "2 set x 12 tekrar",
        description: "Sırt üstü karşı kol-bacak uzat.",
        difficulty: "Kolay",
        targetMuscles: ["Karın"],
        requiresEquipment: false,
        ...withMedia('4XLEnwUr1d8', 'YouTube - Bodybuilding.com')
      }
    ]
  },
  hulaHoopFlow: {
    name: "Hulahop Akışı",
    duration: 5,
    reps: "5 dakika",
    description: "Çemberi bel hizasında çevir, ritmi nefes ile eşle.",
    videoGuide: "Dizler hafif bükülü, karın kası aktif.",
    difficulty: "Kolay",
    targetMuscles: ["Karın", "Kalça"],
    requiresEquipment: true,
    equipment: ["Hulahop"],
    ...withMedia('GE3DIpkCsPk', 'YouTube - hoopsmiles'),
    alternatives: [
      {
        name: "Ayakta Karın Akışı",
        duration: 4,
        reps: "4 dakika",
        description: "Hulahopsuz olarak aynı hareket kalıbını uygula.",
        difficulty: "Kolay",
        targetMuscles: ["Karın"],
        requiresEquipment: false,
        ...withMedia('jisp2xBP8pY', 'YouTube - Amanda Nix')
      }
    ]
  }
};

const scaleLastNumber = (text, factor) => {
  if (!text || factor <= 1) {
    return text;
  }
  const matches = text.match(/\d+/g);
  if (!matches) {
    return text;
  }
  const updated = matches.map((value, index) => {
    if (index === matches.length - 1) {
      return String(Math.max(1, Math.round(Number(value) * factor)));
    }
    return value;
  });
  let result = text;
  matches.forEach((value, index) => {
    result = result.replace(value, updated[index]);
  });
  return result;
};

let nextExerciseId = 1;

const instantiateExercise = (item, week) => {
  const baseSource = typeof item.key === 'string' ? exerciseLibrary[item.key] : item.key;
  const baseExercise = deepCopy(baseSource || {});
  const overrides = item.overrides ? deepCopy(item.overrides) : {};
  const overrideAlternatives = overrides.alternatives ? overrides.alternatives.map(deepCopy) : undefined;
  const exercise = { ...baseExercise, ...overrides };
  exercise.id = nextExerciseId++;
  const baseAlternatives = overrideAlternatives || (baseExercise.alternatives ? baseExercise.alternatives.map(deepCopy) : []);
  exercise.requiresEquipment = exercise.requiresEquipment === true;
  exercise.equipment = exercise.equipment || [];
  exercise.targetMuscles = exercise.targetMuscles || [];

  const isProgressive = Boolean(item.progressive) && !exercise.isWarmup && !exercise.isCooldown;
  if (isProgressive) {
    const factor = 1 + Math.min(Math.max(week - 1, 0), 4) * 0.1;
    if (exercise.reps) {
      exercise.reps = scaleLastNumber(exercise.reps, factor);
    }
    if (exercise.duration) {
      const scaledDuration = Math.max(exercise.duration, Math.round(exercise.duration * factor));
      exercise.duration = scaledDuration;
    }
    if (exercise.difficulty === 'Kolay' && week >= 3) {
      exercise.difficulty = 'Orta';
    }
    if (exercise.difficulty === 'Orta' && week >= 4) {
      exercise.difficulty = 'Orta/Zor';
    }
  }

  exercise.duration = getDuration(exercise);
  exercise.estimatedCalories = calculateExerciseCalories(exercise);
  exercise.alternatives = baseAlternatives.map((alt, idx) => {
    const alternative = { ...alt };
    alternative.duration = getDuration(alternative) || exercise.duration;
    alternative.requiresEquipment = alternative.requiresEquipment === true;
    alternative.equipment = alternative.equipment || [];
    alternative.targetMuscles = alternative.targetMuscles || [];
    alternative.id = `${exercise.id}-alt-${idx + 1}`;
    alternative.estimatedCalories = calculateExerciseCalories(alternative);
    return alternative;
  });

  return exercise;
};

const weekTemplates = [
  {
    templateDay: 1,
    title: "Tüm Vücut - Temel",
    description: "Isınma + temel kuvvet hareketleri ile form kazanma.",
    focus: "Tüm Vücut",
    baseTargetDuration: 25,
    targetIncrement: 2,
    blueprint: [
      { key: 'warmupWalk' },
      { key: 'squat', overrides: { reps: "3 set x 10 tekrar" }, progressive: true },
      { key: 'pushupKnees', overrides: { reps: "2 set x 10 tekrar" }, progressive: true },
      { key: 'lunge', progressive: true },
      { key: 'plank', progressive: true },
      { key: 'cooldownStretch' }
    ]
  },
  {
    templateDay: 2,
    title: "Üst Vücut ve Çekiş",
    description: "Göğüs, sırt ve omuz odaklı kuvvet çalışması.",
    focus: "Üst Vücut",
    baseTargetDuration: 25,
    targetIncrement: 2,
    blueprint: [
      { key: 'armWarmup' },
      { key: 'pushupKnees', overrides: { reps: "3 set x 8 tekrar" }, progressive: true },
      { key: 'tricepDip', progressive: true },
      { key: 'lateralRaise', progressive: true },
      { key: 'resistanceBandRow', progressive: true },
      { key: 'plank', overrides: { reps: "2 set x 30 saniye" }, progressive: true },
      { key: 'cooldownStretch' }
    ]
  },
  {
    templateDay: 3,
    title: "Alt Vücut ve Kalça",
    description: "Bacak ve kalça güçlendirme, denge çalışmaları.",
    focus: "Alt Vücut",
    baseTargetDuration: 26,
    targetIncrement: 2,
    blueprint: [
      { key: 'dynamicWarmup' },
      { key: 'squat', overrides: { reps: "3 set x 12 tekrar" }, progressive: true },
      { key: 'gluteBridge', progressive: true },
      { key: 'sideLegRaise', progressive: true },
      { key: 'gluteKickback', progressive: true },
      { key: 'yogaStretch' }
    ]
  },
  {
    templateDay: 4,
    title: "Core & Denge",
    description: "Merkez kasları ve denge kontrolü.",
    focus: "Core",
    baseTargetDuration: 24,
    targetIncrement: 2,
    blueprint: [
      { key: 'marchWarmup' },
      { key: 'birdDog', progressive: true },
      { key: 'deadBug', progressive: true },
      { key: 'standingAbs', progressive: true },
      { key: 'superman', progressive: true },
      { key: 'cooldownStretch' }
    ]
  },
  {
    templateDay: 5,
    title: "Düşük Etkili Kardiyo + Güç",
    description: "Kalp atışını yükseltirken eklemlere yük bindirmeden çalış.",
    focus: "Kardiyo",
    baseTargetDuration: 25,
    targetIncrement: 2,
    blueprint: [
      { key: 'stepTouchWarmup' },
      { key: 'highKnees', progressive: true },
      { key: 'marchLowImpact', progressive: true },
      { key: 'squat', overrides: { reps: "2 set x 15 tekrar" }, progressive: true },
      { key: 'plank', overrides: { reps: "2 set x 30 saniye" }, progressive: true },
      { key: 'cooldownStretch' }
    ]
  },
  {
    templateDay: 6,
    title: "Ekipmanlı Güç (Opsiyonel)",
    description: "Dumbbell, lastik veya ekipmansız seçeneklerle kuvvet.",
    focus: "Güç",
    baseTargetDuration: 27,
    targetIncrement: 2,
    blueprint: [
      { key: 'dynamicWarmup' },
      { key: 'gobletSquat', progressive: true },
      { key: 'dumbbellBenchPress', progressive: true },
      { key: 'bicepCurl', progressive: true },
      { key: 'resistanceBandRow', progressive: true },
      { key: 'plank', overrides: { reps: "2 set x 35 saniye" }, progressive: true },
      { key: 'hipMobility' }
    ]
  },
  {
    templateDay: 7,
    title: "Aktif Dinlenme",
    description: "Hafif yürüyüş, mobilite ve esneme odaklı gün.",
    focus: "Dinlenme",
    baseTargetDuration: 18,
    targetIncrement: 0,
    isRest: true,
    blueprint: [
      { key: 'warmupWalk', overrides: { duration: 5, reps: "5 dakika", isOptional: true } },
      { key: 'hipMobility' },
      { key: 'yogaStretch' }
    ]
  }
];

const bonusTemplates = [
  {
    title: "Pilates Topu & Core Odak",
    description: "30 günün son haftasında core ve mobiliteyi bir araya getir.",
    focus: "Core",
    baseTargetDuration: 24,
    targetIncrement: 0,
    week: 5,
    blueprint: [
      { key: 'warmupWalk' },
      { key: 'pilatesBallCrunch', progressive: true },
      { key: 'gluteBridge', overrides: { reps: "3 set x 14 tekrar" }, progressive: true },
      { key: 'plank', overrides: { reps: "3 set x 35 saniye" }, progressive: true },
      { key: 'yogaStretch' }
    ]
  },
  {
    title: "Değerlendirme & Akış",
    description: "Hafif yoğunlukta genel tarama ve nefes odaklı kapanış.",
    focus: "Aktif Dinlenme",
    baseTargetDuration: 20,
    targetIncrement: 0,
    week: 5,
    blueprint: [
      { key: 'marchWarmup', overrides: { reps: "4 dakika" } },
      { key: 'standingAbs', overrides: { reps: "3 set x 15 tekrar" }, progressive: true },
      { key: 'hipMobility' },
      { key: 'cooldownStretch' }
    ]
  }
];

const createWorkoutFromTemplate = (template, week, day) => {
  const workout = {
    day,
    week,
    title: template.title,
    description: template.description,
    focus: template.focus,
    isRest: Boolean(template.isRest)
  };

  const exercises = template.blueprint.map((item) => instantiateExercise(item, week));
  workout.exercises = exercises;
  workout.estimatedDuration = exercises.reduce((total, exercise) => total + (exercise.duration || 0), 0);
  workout.estimatedCalories = roundToSingleDecimal(
    exercises.reduce((total, exercise) => total + (exercise.estimatedCalories || 0), 0)
  );

  const increment = template.targetIncrement ?? 2;
  const targetBoost = template.isRest ? 0 : (week - 1) * increment;
  workout.targetDuration = Math.max(
    template.baseTargetDuration + targetBoost,
    Math.round(workout.estimatedDuration)
  );

  return workout;
};

const createProgram = () => {
  const workouts = [];

  for (let week = 1; week <= 4; week += 1) {
    weekTemplates.forEach((template) => {
      const dayNumber = (week - 1) * 7 + template.templateDay;
      workouts.push(createWorkoutFromTemplate(template, week, dayNumber));
    });
  }

  bonusTemplates.forEach((template, index) => {
    const dayNumber = 28 + index + 1;
    const weekValue = template.week || 5;
    workouts.push(createWorkoutFromTemplate(template, weekValue, dayNumber));
  });

  return workouts;
};

export const allWorkouts = createProgram();

export const getWorkoutByDay = (day) => allWorkouts.find((workout) => workout.day === day);

export const getWorkoutsByWeek = (week) => allWorkouts.filter((workout) => workout.week === week);

export const getWorkoutProgress = (workout, completedExercises = {}) => {
  if (!workout) {
    return {
      completedCount: 0,
      totalCount: 0,
      percent: 0,
      completedMinutes: 0,
      completedCalories: 0
    };
  }

  const exercises = workout.exercises || [];
  const totalCount = exercises.length;
  const completedCount = exercises.filter((exercise) => completedExercises[`${workout.day}-${exercise.id}`]).length;

  const completedMinutes = exercises.reduce((total, exercise) => {
    const key = `${workout.day}-${exercise.id}`;
    if (completedExercises[key]) {
      return total + (exercise.duration || 0);
    }
    return total;
  }, 0);

  const completedCalories = exercises.reduce((total, exercise) => {
    const key = `${workout.day}-${exercise.id}`;
    if (completedExercises[key]) {
      return total + (exercise.estimatedCalories || calculateExerciseCalories(exercise));
    }
    return total;
  }, 0);

  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    percent,
    completedMinutes: roundToSingleDecimal(completedMinutes),
    completedCalories: roundToSingleDecimal(completedCalories)
  };
};

export const calculateProgramSummary = (workouts, completedDays = [], completedExercises = {}, weightKg = USER_PROFILE.weightKg) => {
  const totalTargetMinutes = workouts.reduce((sum, workout) => sum + (workout.targetDuration || 0), 0);
  const totalEstimatedCalories = workouts.reduce((sum, workout) => sum + (workout.estimatedCalories || 0), 0);

  let completedMinutes = 0;
  let completedCalories = 0;

  workouts.forEach((workout) => {
    const progress = getWorkoutProgress(workout, completedExercises);
    completedMinutes += progress.completedMinutes;
    completedCalories += progress.completedCalories;
  });

  const overallPercent = totalTargetMinutes === 0 ? 0 : Math.round((completedMinutes / totalTargetMinutes) * 100);

  return {
    completedDays: completedDays.length,
    totalDays: workouts.length,
    completedMinutes: roundToSingleDecimal(completedMinutes),
    totalTargetMinutes: roundToSingleDecimal(totalTargetMinutes),
    completedCalories: roundToSingleDecimal(completedCalories),
    totalEstimatedCalories: roundToSingleDecimal(totalEstimatedCalories),
    overallPercent,
    remainingMinutes: roundToSingleDecimal(Math.max(totalTargetMinutes - completedMinutes, 0)),
    remainingCalories: roundToSingleDecimal(Math.max(totalEstimatedCalories - completedCalories, 0))
  };
};
