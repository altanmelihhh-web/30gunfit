/**
 * hevyParser - Hevy paylaşım metnini veya ChatGPT antrenman özetini ayrıştırır.
 *
 * Örnek Hevy metni:
 *   Tüm Vücut 1
 *   Cuma, Tem 31, 2026, 7:26am
 *   Koşu Bandı
 *   Chest Press (Makine)
 *   Set 1: 4.5 kg x 12 [Isınma]
 *   Set 2: 9 kg x 12
 *   ...
 *   @hevyapp
 *   https://hevy.com/workout/...
 *
 * Çıktı: { title, exercises: [{ name, sets: [{ weight_kg, reps, isWarmup }] }] }
 */

const num = (s) => parseFloat(String(s).replace(',', '.'));

// "Set 1: 4.5 kg x 12 [Isınma]" veya "20kg x 10" / "20 x 10" gibi bir set satırı mı?
const parseSetLine = (line) => {
  // "Set N:" öneki opsiyonel
  const body = line.replace(/^set\s*\d+\s*[:.)]?\s*/i, '');
  // ağırlık x tekrar: "4.5 kg x 12", "80 kg x 8", "12 x 10" (ağırlıksız), "x12"
  const m = body.match(/(?:(\d+(?:[.,]\d+)?)\s*kg\s*)?[x×]\s*(\d+)/i)
    || body.match(/(\d+(?:[.,]\d+)?)\s*kg\s*[x×]\s*(\d+)/i);
  if (!m) return null;
  const isWarmup = /\[?\s*(is[ıi]nma|warm\s*-?up)\s*\]?/i.test(line);
  // m[1] ağırlık (olmayabilir, vücut ağırlığı), m[2] tekrar
  return {
    weight_kg: m[1] != null ? num(m[1]) : null,
    reps: parseInt(m[2], 10),
    isWarmup
  };
};

const isIgnorableLine = (line) => {
  const l = line.trim();
  if (!l) return true;
  if (/^@/.test(l)) return true; // @hevyapp
  if (/^https?:\/\//i.test(l)) return true; // url
  // tarih satırı: "Cuma, Tem 31, 2026, 7:26am" gibi (gün adı + ay + saat)
  if (/\d{1,2}:\d{2}\s*(am|pm)?/i.test(l) && /\b(20\d{2})\b/.test(l)) return true;
  return false;
};

const startsWithSet = (line) => /^\s*set\s*\d+\s*[:.)]/i.test(line);

export const parseHevyWorkout = (text) => {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return { title: '', exercises: [] };

  let title = '';
  const exercises = [];
  let current = null;

  rawLines.forEach((line, idx) => {
    if (isIgnorableLine(line)) return;

    // İlk anlamlı satır ve henüz hareket yoksa: başlık
    if (idx === 0 && !startsWithSet(line) && !parseSetLine(line)) {
      title = line;
      return;
    }

    if (startsWithSet(line)) {
      // Bir sete ait - mevcut harekete ekle (yoksa isimsiz hareket aç)
      const set = parseSetLine(line);
      if (!current) {
        current = { name: 'Hareket', sets: [] };
        exercises.push(current);
      }
      if (set) current.sets.push(set);
      return;
    }

    // "Set" ile başlamayan ama set kalıbı içeren tek satır (ör. "Bench 20kg x 10")?
    const inlineSet = parseSetLine(line);
    const looksLikeInlineSet = inlineSet && /[x×]/i.test(line) && /\d/.test(line) && line.length < 40 && !/[a-zçğıöşü]{4,}.*[a-zçğıöşü]{4,}/i.test(line.replace(/kg|x|set/gi, ''));

    if (looksLikeInlineSet) {
      if (!current) { current = { name: 'Hareket', sets: [] }; exercises.push(current); }
      current.sets.push(inlineSet);
      return;
    }

    // Aksi halde yeni bir hareket adı (Koşu Bandı, Chest Press (Makine), Yürüme...)
    current = { name: line, sets: [] };
    exercises.push(current);
  });

  // Başlık bulunamadıysa ve ilk öğe aslında başlıksa düzelt
  if (!title && exercises.length === 0) title = rawLines[0];

  return { title, exercises };
};

// Bir antrenmanın toplam set ve hacim (kg) özetini hesapla
export const workoutStats = (workout) => {
  let totalSets = 0;
  let volume = 0;
  (workout.exercises || []).forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      totalSets += 1;
      if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps;
    });
  });
  return { exerciseCount: (workout.exercises || []).length, totalSets, volume: Math.round(volume) };
};
