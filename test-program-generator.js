/**
 * Program Generator Test Script
 * Farklı profiller ile programları test eder
 */

// Simulated imports (bu script standalone çalıştırılamaz, sadece test senaryoları)

// TEST PROFILE 1: Genç erkek, normal BMI, kas yapmak istiyor
const profile1 = {
  name: 'Ahmet',
  age: 25,
  weight: 75,
  height: 180,
  gender: 'male',
  goal: 'muscle_gain',
  difficulty: 'intermediate',
  dailyDuration: 45,
  weeklyDays: 5,
  bmi: 23.1
};

// Beklenen: Üst vücut ağırlıklı, strength_upper yüksek skorlu
// MET bazlı kalori: ~300-400 cal per workout

// TEST PROFILE 2: Orta yaşlı kadın, overweight BMI, kilo vermek istiyor
const profile2 = {
  name: 'Ayşe',
  age: 45,
  weight: 75,
  height: 160,
  gender: 'female',
  goal: 'weight_loss',
  difficulty: 'beginner',
  dailyDuration: 30,
  weeklyDays: 4,
  bmi: 29.3 // Overweight
};

// Beklenen: Alt vücut/core ağırlıklı, cardio/HIIT, low-impact egzersizler
// Yaş 45 → Orta intensity
// BMI 29.3 → Low-impact (stepping jack, modified burpee)
// MET bazlı kalori: ~200-250 cal per workout

// TEST PROFILE 3: Yaşlı erkek, obese BMI, başlangıç
const profile3 = {
  name: 'Mehmet',
  age: 68,
  weight: 95,
  height: 170,
  gender: 'male',
  goal: 'beginner',
  difficulty: 'beginner',
  dailyDuration: 20,
  weeklyDays: 3,
  bmi: 32.9 // Obese
};

// Beklenen: Çok düşük impact, balance training, flexibility
// Yaş 68 → SENIOR, jumping/burpee YOK
// BMI 32.9 → OBESE, sadece chair support, walking, stretching
// MET bazlı kalori: ~100-150 cal per workout

// TEST PROFILE 4: Genç kadın, HIIT focus, custom süre
const profile4 = {
  name: 'Zeynep',
  age: 28,
  weight: 60,
  height: 165,
  gender: 'female',
  goal: 'hiit_focus',
  difficulty: 'advanced',
  dailyDuration: 35, // CUSTOM SÜRE!
  weeklyDays: 6,
  bmi: 22.0
};

// Beklenen: HIIT ağırlıklı, yüksek intensity, kadın için alt vücut bonus
// Custom süre 35 dk → Dinamik hesaplama (warmup: 1-2, main: 6-7, cooldown: 1)
// MET bazlı kalori: ~250-300 cal per workout

console.log('Test Profilleri:');
console.log('1. Genç Erkek - Kas Yapmak - 45dk - BMI 23.1 (Normal)');
console.log('2. Orta Yaşlı Kadın - Kilo Vermek - 30dk - BMI 29.3 (Overweight)');
console.log('3. Yaşlı Erkek - Başlangıç - 20dk - BMI 32.9 (Obese)');
console.log('4. Genç Kadın - HIIT Focus - 35dk (CUSTOM) - BMI 22.0 (Normal)');

console.log('\nBeklenen Sonuçlar:');
console.log('Profile 1: Üst vücut ağırlıklı, 300-400 cal, ~9-11 egzersiz');
console.log('Profile 2: Low-impact cardio, 200-250 cal, ~6-8 egzersiz');
console.log('Profile 3: Chair support, walking, 100-150 cal, ~4-5 egzersiz');
console.log('Profile 4: HIIT+alt vücut, 250-300 cal, ~7-9 egzersiz (custom süre)');
