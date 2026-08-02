/**
 * muscleMap - hareket adından kas bölgesi tahmini (Türkçe + Hevy/İngilizce isimler).
 * Rapordaki "bölge analizi" için kullanılır.
 */

const REGION_KEYWORDS = [
  ['gogus', ['göğüs', 'gogus', 'chest', 'bench', 'chest press', 'chest fly', 'fly', 'push up', 'şınav', 'sinav', 'dips', 'pec']],
  ['sirt', ['sırt', 'sirt', 'row', 'lat', 'pulldown', 'pull up', 'pull-up', 'barfiks', 'deadlift', 'çekiş', 'cekis', 'back']],
  ['bacak', ['bacak', 'leg', 'squat', 'çömelme', 'comelme', 'lunge', 'hamstring', 'quad', 'calf', 'baldır', 'baldir', 'hip', 'kalça', 'kalca', 'glute', 'leg press', 'leg curl', 'leg extension', 'abduction', 'adduction']],
  ['omuz', ['omuz', 'shoulder', 'deltoid', 'lateral raise', 'yan kaldırma', 'front raise', 'overhead', 'ohp', 'arnold']],
  ['kol', ['kol', 'biceps', 'triceps', 'curl', 'pushdown', 'kickback', 'preacher', 'hammer', 'arm']],
  ['karin', ['karın', 'karin', 'abs', 'plank', 'crunch', 'mekik', 'core', 'sit up', 'sit-up', 'leg raise']],
  ['kardiyo', ['kardiyo', 'cardio', 'koşu', 'kosu', 'run', 'treadmill', 'koşu bandı', 'kosu bandi', 'yürü', 'yuru', 'walk', 'bisiklet', 'bike', 'cycle', 'yüzme', 'yuzme', 'swim', 'eliptik', 'rowing machine', 'jog']]
];

export const REGION_LABELS = {
  gogus: 'Göğüs',
  sirt: 'Sırt',
  bacak: 'Bacak',
  omuz: 'Omuz',
  kol: 'Kol',
  karin: 'Karın',
  kardiyo: 'Kardiyo',
  diger: 'Diğer'
};

export const classifyExercise = (name) => {
  const n = (name || '').toLocaleLowerCase('tr');
  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return region;
  }
  return 'diger';
};

/**
 * Bir antrenman listesinden kas bölgesi başına set sayısı ve hacim döndürür.
 * @param workouts - dailyLogs.workouts[] dizisi (exercises[].sets[])
 * @returns { [region]: { sets, volume, exercises: Set } }
 */
export const analyzeRegions = (workouts) => {
  const regions = {};
  (workouts || []).forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      const region = classifyExercise(ex.name);
      if (!regions[region]) regions[region] = { sets: 0, volume: 0, exercises: new Set() };
      regions[region].exercises.add(ex.name);
      (ex.sets || []).forEach((s) => {
        regions[region].sets += 1;
        if (s.weight_kg && s.reps) regions[region].volume += s.weight_kg * s.reps;
      });
      // Setsiz hareket (kardiyo vb.) en az 1 sayılsın ki bölgede görünsün
      if (!ex.sets || ex.sets.length === 0) {
        // set eklemeyiz ama exercises'e eklendi
      }
    });
  });
  return regions;
};
