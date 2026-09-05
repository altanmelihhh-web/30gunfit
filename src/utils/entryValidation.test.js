import {
  macroEnergy,
  validateMealNutrition,
  validateSleepDuration,
  suggestSleepHours,
  isBlocking
} from './entryValidation';

describe('macroEnergy', () => {
  test('P×4 + K×4 + Y×9 hesaplar', () => {
    expect(macroEnergy({ protein: 30, carbs: 45, fats: 15 })).toBe(30 * 4 + 45 * 4 + 15 * 9);
  });

  test('eksik makroları 0 sayar', () => {
    expect(macroEnergy({ protein: 10 })).toBe(40);
    expect(macroEnergy({})).toBe(0);
  });
});

describe('validateMealNutrition - tolerans', () => {
  test('etiket yuvarlaması kadar fark uyarı üretmez', () => {
    // 245 kcal makro, 250 kcal etiket -> 5 kcal fark
    expect(validateMealNutrition({ calories: 250, protein: 30, carbs: 20, fats: 5 }).level).toBe('ok');
  });

  test('20 kcal altındaki fark yüzde büyük olsa bile uyarı üretmez', () => {
    // 60 kcal etiket, 45 kcal makro -> %25 ama sadece 15 kcal
    expect(validateMealNutrition({ calories: 60, protein: 5, carbs: 5, fats: 0.5 }).level).toBe('ok');
  });

  test('sadece kalori girilmişse (makro yok) uyarı üretmez', () => {
    expect(validateMealNutrition({ calories: 300 }).level).toBe('ok');
  });

  test('0 kcal + 0 makro serbest (su, sade kahve)', () => {
    expect(validateMealNutrition({ calories: 0, protein: 0, carbs: 0, fats: 0 }).level).toBe('ok');
  });
});

describe('validateMealNutrition - uyarı', () => {
  test('fark %10 üzerindeyse uyarır', () => {
    const result = validateMealNutrition({ calories: 500, protein: 30, carbs: 45, fats: 15 });
    expect(result.level).toBe('warning');
    expect(result.macroEnergy).toBe(435);
    expect(result.message).toMatch(/doğrula/);
  });

  test('yüzde küçük olsa da 100 kcal üzeri fark uyarır', () => {
    // 2000 kcal etiket, 1880 kcal makro -> %6 ama 120 kcal
    const result = validateMealNutrition({ calories: 2000, protein: 100, carbs: 270, fats: 44.4 });
    expect(result.level).toBe('warning');
  });

  test('uyarı kaydı engellemez', () => {
    expect(isBlocking(validateMealNutrition({ calories: 500, protein: 30, carbs: 45, fats: 15 }))).toBe(false);
  });
});

describe('validateMealNutrition - hata', () => {
  test('1 kcal ama 64 g protein + 70 g yağ kesinlikle geçmez', () => {
    const result = validateMealNutrition({ name: 'Mangal', calories: 1, protein: 64, carbs: 0, fats: 70 });
    expect(result.level).toBe('error');
    expect(result.code).toBe('calories-vs-macros');
    expect(isBlocking(result)).toBe(true);
  });

  test('makrosuz 1 kcal öğün de geçmez', () => {
    const result = validateMealNutrition({ name: 'Mangal', calories: 1 });
    expect(result.level).toBe('error');
    expect(result.code).toBe('implausible-calories');
  });

  test('kalori girilmemişse hata', () => {
    expect(validateMealNutrition({ protein: 10 }).code).toBe('missing-calories');
  });

  test('negatif değer hata', () => {
    expect(validateMealNutrition({ calories: 100, protein: -5 }).code).toBe('negative');
  });

  test('%50 üzeri ve 100 kcal üzeri sapma hata', () => {
    // 200 kcal etiket, 600 kcal makro
    const result = validateMealNutrition({ calories: 200, protein: 50, carbs: 50, fats: 22.2 });
    expect(result.level).toBe('error');
    expect(result.code).toBe('macro-mismatch');
  });
});

describe('validateSleepDuration', () => {
  test('normal uyku geçer', () => {
    expect(validateSleepDuration(7.5).level).toBe('ok');
    expect(validateSleepDuration(6.49).level).toBe('ok');
  });

  test('649 saat hata verir ve 6.49 önerir', () => {
    const result = validateSleepDuration(649);
    expect(result.level).toBe('error');
    expect(result.code).toBe('out-of-range');
    expect(result.suggestion).toBe(6.49);
    expect(result.message).toMatch(/6.49/);
  });

  test('24 saat üstü her değer engellenir', () => {
    expect(validateSleepDuration(25).level).toBe('error');
    expect(validateSleepDuration(24).level).toBe('warning'); // sınırda ama alışılmadık
  });

  test('0 ve negatif engellenir', () => {
    expect(validateSleepDuration(0).code).toBe('non-positive');
    expect(validateSleepDuration(-3).code).toBe('non-positive');
  });

  test('çok kısa/çok uzun uyku uyarır ama engellemez', () => {
    expect(validateSleepDuration(1.5).level).toBe('warning');
    expect(validateSleepDuration(18).level).toBe('warning');
    expect(isBlocking(validateSleepDuration(18))).toBe(false);
  });
});

describe('suggestSleepHours', () => {
  test('ondalık atlanmış girişleri düzeltir', () => {
    expect(suggestSleepHours(649)).toBe(6.49);
    expect(suggestSleepHours(75)).toBe(7.5);
    expect(suggestSleepHours(730)).toBe(7.3);
  });

  test('geçerli değer için öneri yok', () => {
    expect(suggestSleepHours(7.5)).toBeNull();
  });
});

describe('mesaj biçimi', () => {
  // İkonu her ekran kendisi basıyor; mesaja da emoji koyarsak "⚠️ ⚠️ ..." çıkıyor.
  const messages = [
    validateMealNutrition({ calories: 500, protein: 30, carbs: 45, fats: 15 }).message,
    validateMealNutrition({ name: 'Mangal', calories: 1, protein: 64, fats: 70 }).message,
    validateMealNutrition({ name: 'Mangal', calories: 1 }).message,
    validateSleepDuration(649).message,
    validateSleepDuration(18).message,
    validateSleepDuration(1.5).message
  ];

  test('mesajlar emoji içermez', () => {
    messages.forEach((message) => {
      expect(message).toBeTruthy();
      expect(message).not.toMatch(/[⚠⛔✅❌]/);
    });
  });

  test('mesajlar kullanıcıya ne yapacağını söyler', () => {
    messages.forEach((message) => {
      expect(message.length).toBeGreaterThan(20);
    });
  });
});
