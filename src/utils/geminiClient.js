const GEMINI_API_KEY = 'AIzaSyD_dcOAyVSRYx9N3fzHkbZ3AamrJAC3klg';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const FREE_TIER_RPM_LIMIT = 20;
const WINDOW_MS = 60 * 1000;

// Uygulama genelinde (tüm bileşenler ortak) son 1 dakikadaki istek zaman damgaları
let requestTimestamps = [];

const trackRequest = () => {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
  requestTimestamps.push(now);
};

/**
 * Son 1 dakikada yapılan istek sayısını ve limite göre durumu döndürür
 * (Google'ın kendisi kalan kota göstermediği için tarayıcı tarafında tahmini sayaç)
 */
export const getQuotaStatus = () => {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
  const used = requestTimestamps.length;
  const oldestInWindow = requestTimestamps[0];
  const resetInMs = oldestInWindow ? Math.max(0, WINDOW_MS - (now - oldestInWindow)) : 0;
  return { used, limit: FREE_TIER_RPM_LIMIT, resetInMs };
};

const extractJson = (text) => {
  let jsonString = text.trim();
  const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI yanıtı JSON formatında değil: ' + text.substring(0, 200));
    }
    return JSON.parse(jsonMatch[0]);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hata mesajından "Please retry in 17.47s" gibi bir bekleme süresi çıkarmayı dener
const parseRetryDelayMs = (message) => {
  const match = message?.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  }
  return 15000;
};

/**
 * Gemini'ye istek atar; ücretsiz plan dakikalık kota limitine (429) takılırsa
 * otomatik olarak bekleyip birkaç kez tekrar dener
 * @param {object} body - Gemini generateContent isteği gövdesi
 * @param {(attempt: number, waitMs: number) => void} onRetry - her tekrar denemede çağrılır (UI'da bildirmek için)
 */
const fetchGeminiWithRetry = async (body, onRetry) => {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    trackRequest();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (response.ok) {
      return response.json();
    }

    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || 'Gemini API isteği başarısız oldu';
    lastError = new Error(message);

    const isQuotaError = response.status === 429;
    // Google, günlük/aylık kota dolduğunda da 429 döner - bu durumda saniyeler içinde
    // tekrar denemenin hiçbir faydası yok (kota saatler sonra sıfırlanır), o yüzden
    // hata detaylarındaki quotaId'ye bakıp "PerDay" ise hemen açıklayıcı hata fırlat
    const violations = errorData.error?.details?.find((d) => d.violations)?.violations || [];
    const isDailyQuota = violations.some((v) => /perday/i.test(v.quotaId || ''));
    if (isDailyQuota) {
      throw new Error('Google ücretsiz Gemini planının günlük istek kotası doldu. Kota her gün sıfırlanır, birkaç saat sonra tekrar dene (veya Google AI Studio\'dan planı yükselt).');
    }

    if (isQuotaError && attempt < MAX_RETRIES) {
      const waitMs = parseRetryDelayMs(message);
      if (onRetry) onRetry(attempt + 1, waitMs);
      await sleep(waitMs);
      continue;
    }

    if (isQuotaError) {
      throw new Error('Google ücretsiz Gemini planının dakikalık istek limitine takıldı. Birkaç kez otomatik denendi ama olmadı — lütfen 1 dakika bekleyip tekrar dene.');
    }
    throw lastError;
  }
  throw lastError;
};

/**
 * Gemini'ye metin (+ opsiyonel görsel) gönderip yapılandırılmış JSON döndürür
 * responseMimeType: 'application/json' modu Gemini'yi her zaman geçerli JSON döndürmeye zorlar
 * (markdown code-fence veya bozuk sözdizimi riski ortadan kalkar)
 * @param {string} prompt - talimat metni
 * @param {{base64Data: string, mimeType: string}[]} images - opsiyonel görseller
 * @param {object|null} responseSchema - opsiyonel Gemini şema tanımı (yapıyı zorlar)
 * @param {(attempt: number, waitMs: number) => void} onRetry - kota limitinde tekrar deneme bildirimi
 */
export const callGeminiForJSON = async (prompt, images = [], responseSchema = null, onRetry = null) => {
  const parts = [{ text: prompt }];
  images.forEach((img) => {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64Data } });
  });

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json'
  };
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  const data = await fetchGeminiWithRetry({ contents: [{ parts }], generationConfig }, onRetry);
  const candidate = data.candidates?.[0];
  const aiResponse = candidate?.content?.parts?.[0]?.text;

  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('AI boş yanıt döndü. Lütfen tekrar deneyin.');
  }

  try {
    return extractJson(aiResponse);
  } catch (e) {
    const truncated = candidate?.finishReason === 'MAX_TOKENS' ? ' (yanıt çok uzundu ve kesildi, girdiyi kısaltıp tekrar deneyin)' : '';
    throw new Error('AI yanıtı işlenemedi' + truncated + ': ' + e.message);
  }
};

/**
 * Gemini'ye metin gönderip düz metin yanıt alır (yorum/analiz için)
 */
export const callGeminiForText = async (prompt, onRetry = null) => {
  const data = await fetchGeminiWithRetry({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
  }, onRetry);

  const candidate = data.candidates?.[0];
  const aiResponse = candidate?.content?.parts?.[0]?.text;

  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('AI boş yanıt döndü. Lütfen tekrar deneyin.');
  }

  return aiResponse.trim();
};

export const fileToBase64Image = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      resolve({
        base64Data: result.split(',')[1],
        mimeType: result.split(';')[0].split(':')[1]
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
