// Anahtar kelime -> kategori eşlemesi. AI'ya hiç gitmez, saf metin ayrıştırma.
const num = (s) => parseFloat(String(s).replace(',', '.'));

const parseWater = (rest) => {
  const m = rest.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return { error: 'Bir miktar (ml) yazmalısın. Örn: su: 500' };
  const amount = num(m[1]);
  return { category: 'water', data: { water_ml: amount }, preview: `💧 ${amount} ml su` };
};

const parseWeight = (rest) => {
  const m = rest.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return { error: 'Bir kilo değeri yazmalısın. Örn: kilo: 78.5' };
  const weight = num(m[1]);
  return { category: 'weight', data: { weight_kg: weight }, preview: `⚖️ ${weight} kg` };
};

const parseSleep = (rest) => {
  const hourMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|sa\b|h\b)/i);
  const minMatch = rest.match(/(\d+)\s*(?:dakika|dk\b|m\b)/i);
  const scoreMatch = rest.match(/skor\s*(\d+)/i);
  const bedtimeMatch = rest.match(/(\d{1,2}[:.]\d{2})/);

  if (!hourMatch && !minMatch) {
    return { error: 'Uyku süresi bulunamadı. Örn: uyku: 7 saat 30 dakika skor 90' };
  }
  const hours = (hourMatch ? num(hourMatch[1]) : 0) + (minMatch ? parseInt(minMatch[1], 10) / 60 : 0);
  const sleep = { duration_hours: Math.round(hours * 100) / 100 };
  if (scoreMatch) sleep.score = parseInt(scoreMatch[1], 10);
  if (bedtimeMatch) sleep.bedtime = bedtimeMatch[1].replace('.', ':');

  return {
    category: 'sleep',
    data: { sleep },
    preview: `😴 ${sleep.duration_hours} saat${sleep.score ? `, skor ${sleep.score}` : ''}${sleep.bedtime ? `, yatış ${sleep.bedtime}` : ''}`
  };
};

const parseSupplement = (rest) => {
  if (!rest.trim()) return { error: 'Takviye adı yazmalısın. Örn: takviye: kreatin 5g' };
  const doseMatch = rest.match(/(\d+(?:[.,]\d+)?\s*(?:g|mg|ml|adet|tablet|kapsül))\b/i);
  let name = rest.trim();
  let dose = null;
  if (doseMatch) {
    dose = doseMatch[1].trim();
    name = rest.replace(doseMatch[0], '').trim();
  }
  if (!name) return { error: 'Takviye adı bulunamadı.' };
  return {
    category: 'supplement',
    data: { name, dose },
    preview: `💊 ${name}${dose ? ` (${dose})` : ''}`
  };
};

const isCardioName = (name) => /kardiyo|yürüyüş|yuruyus|koşu|kosu|bisiklet|yüzme|yuzme|treadmill/i.test(name);

const parseWorkout = (rest) => {
  const durationMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|dakika)\b/i);
  const withoutDuration = durationMatch ? rest.replace(durationMatch[0], '').trim() : rest;
  const duration_min = durationMatch ? num(durationMatch[1]) : null;

  const parts = withoutDuration.split(':');
  if (parts.length < 2) {
    // Set bilgisi yoksa sadece hareket adı olarak kaydet
    const name = withoutDuration.trim().replace(/^[-–]\s*/, '');
    if (!name) return { error: 'Hareket adı yazmalısın. Örn: antrenman: bench press: 20x12, 25x10' };
    const type = isCardioName(name) ? 'cardio' : 'strength';
    return {
      category: 'workout',
      data: { type, duration_min, exercises: [{ name, sets: [] }] },
      preview: `🏋️ ${name}${duration_min ? ` — ${duration_min} dk` : ''} (set bilgisi yok)`
    };
  }
  const name = parts[0].trim();
  const setsPart = parts.slice(1).join(':');
  const setMatches = [...setsPart.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*x\s*(\d+)/gi)];
  if (setMatches.length === 0) {
    return { error: 'Set formatı tanınmadı. Örn: antrenman: bench press: 20x12, 25x10' };
  }
  const sets = setMatches.map((m) => ({ weight_kg: num(m[1]), reps: parseInt(m[2], 10) }));
  return {
    category: 'workout',
    data: { type: isCardioName(name) ? 'cardio' : 'strength', duration_min, exercises: [{ name, sets }] },
    preview: `🏋️ ${name}: ${sets.map((s) => `${s.weight_kg}×${s.reps}`).join(', ')}`
  };
};

const parseVitals = (rest) => {
  const stepsMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*adı?m/i);
  const activeCalMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:aktif\s*kalori|kcal)/i);
  const exerciseMinMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|dakika)\s*egzersiz/i);
  const standMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*saat\s*duru/i);
  const distanceMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*km/i);

  if (!stepsMatch && !activeCalMatch && !exerciseMinMatch && !standMatch && !distanceMatch) {
    return { error: 'Hiçbir aktivite verisi bulunamadı. Örn: aktivite: 9617 adım 1105 aktif kalori 96 dk egzersiz 13 saat duruş 6.56 km' };
  }

  const vitals = {};
  if (stepsMatch) vitals.steps = num(stepsMatch[1]);
  if (activeCalMatch) vitals.active_calories = num(activeCalMatch[1]);
  if (exerciseMinMatch) vitals.exercise_minutes = num(exerciseMinMatch[1]);
  if (standMatch) vitals.stand_hours = num(standMatch[1]);
  if (distanceMatch) vitals.distance_km = num(distanceMatch[1]);

  const preview = [
    vitals.steps && `${vitals.steps} adım`,
    vitals.active_calories && `${vitals.active_calories} kcal`,
    vitals.exercise_minutes && `${vitals.exercise_minutes} dk egzersiz`,
    vitals.stand_hours && `${vitals.stand_hours} saat duruş`,
    vitals.distance_km && `${vitals.distance_km} km`
  ].filter(Boolean).join(', ');

  return { category: 'vitals', data: { vitals }, preview: `⌚ ${preview}` };
};

const parseMeal = (rest) => {
  const kcalMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  if (!kcalMatch) {
    return { error: 'Kalori belirtmelisin. En basit hali: yemek: tavuk göğsü 300kcal (protein/karbonhidrat/yağ tamamen opsiyonel, istersen eklemezsin)' };
  }
  const calories = num(kcalMatch[1]);
  // Protein/karb/yağ tamamen opsiyonel - hem kısa (p/c/f) hem tam kelime (protein/karb/yağ) kabul edilir
  const proteinMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:p\b|protein)/i);
  const carbsMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:c\b|karb\w*)/i);
  const fatMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:f\b|y\b|yağ|yag)/i);

  let name = rest
    .replace(kcalMatch[0], '')
    .replace(proteinMatch?.[0] || '', '')
    .replace(carbsMatch?.[0] || '', '')
    .replace(fatMatch?.[0] || '', '')
    .replace(/,/g, ' ')
    .trim();
  if (!name) name = 'Öğün';

  const meal = {
    food_name: name,
    calories,
    protein: proteinMatch ? num(proteinMatch[1]) : 0,
    carbs: carbsMatch ? num(carbsMatch[1]) : 0,
    fats: fatMatch ? num(fatMatch[1]) : 0
  };

  return {
    category: 'meal',
    data: meal,
    preview: `🍽️ ${name} — ${calories} kcal${meal.protein ? `, P:${meal.protein}g` : ''}${meal.carbs ? `, C:${meal.carbs}g` : ''}${meal.fats ? `, F:${meal.fats}g` : ''}`
  };
};

const KEYWORD_PARSERS = {
  su: parseWater,
  water: parseWater,
  kilo: parseWeight,
  weight: parseWeight,
  uyku: parseSleep,
  sleep: parseSleep,
  takviye: parseSupplement,
  supplement: parseSupplement,
  antrenman: parseWorkout,
  set: parseWorkout,
  workout: parseWorkout,
  yemek: parseMeal,
  kalori: parseMeal,
  meal: parseMeal,
  aktivite: parseVitals,
  vitals: parseVitals
};

export const AVAILABLE_KEYWORDS = ['su', 'kilo', 'uyku', 'takviye', 'antrenman', 'yemek', 'aktivite'];

/**
 * "anahtar: içerik" formatındaki TEK SATIRLIK metni ayrıştırır
 * @returns {{category:string, data:object, preview:string}|{error:string}}
 */
export const parseManualEntry = (text) => {
  const match = text.match(/^\s*([a-zçğıöşü]+)\s*:\s*(.+)$/is);
  if (!match) {
    return { error: `Bir anahtar kelimeyle başlamalısın: ${AVAILABLE_KEYWORDS.join(', ')}. Örn: su: 500` };
  }
  const [, keyword, rest] = match;
  const parser = KEYWORD_PARSERS[keyword.toLowerCase()];
  if (!parser) {
    return { error: `Bilinmeyen anahtar kelime "${keyword}". Kullanabileceklerin: ${AVAILABLE_KEYWORDS.join(', ')}` };
  }
  return parser(rest.trim());
};

/**
 * Birden fazla satırı, her satırı bağımsız bir "anahtar: içerik" girdisi olarak ayrıştırır
 * (tüm günü tek seferde yapıştırmak için - AI'ya hiç gitmez)
 * @returns {{items: Array<{category:string, data:object, preview:string, line:number, raw:string}>, errors: Array<{line:number, raw:string, error:string}>}}
 */
export const parseManualEntryBatch = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  const errors = [];
  lines.forEach((raw, i) => {
    const result = parseManualEntry(raw);
    if (result.error) {
      errors.push({ line: i + 1, raw, error: result.error });
    } else {
      items.push({ ...result, line: i + 1, raw });
    }
  });
  return { items, errors };
};
