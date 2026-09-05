const MAX_RETRIES = 3;
const FREE_TIER_RPM_LIMIT = 20;
const WINDOW_MS = 60 * 1000;
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  const trMatch = message?.match(/(\d+)\s*saniye/i);
  if (trMatch) {
    return parseInt(trMatch[1], 10) * 1000 + 500;
  }
  return 15000;
};

const toGeminiParts = ({ prompt, images = [] }) => {
  const parts = [{ text: prompt }];
  images.forEach((image) => {
    if (!image?.base64Data || !image?.mimeType) {
      throw new Error('Görsel verisi eksik.');
    }
    if (!String(image.mimeType).startsWith('image/')) {
      throw new Error('Sadece görsel dosyaları desteklenir.');
    }
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.base64Data
      }
    });
  });
  return parts;
};

const buildGeminiRequest = ({
  prompt,
  images = [],
  responseSchema = null,
  responseMimeType = null,
  temperature = 0.2,
  maxOutputTokens = 4096
}) => {
  const generationConfig = {
    temperature,
    maxOutputTokens
  };
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
  if (responseSchema) generationConfig.responseSchema = responseSchema;

  return {
    contents: [{ parts: toGeminiParts({ prompt, images }) }],
    generationConfig
  };
};

const normalizeGeminiResponse = (data) => {
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text || '').join('').trim();
  return {
    text,
    finishReason: candidate?.finishReason || null
  };
};

/**
 * Gemini'ye istek atar; ücretsiz plan dakikalık kota limitine (429) takılırsa
 * otomatik olarak bekleyip birkaç kez tekrar dener
 * @param {object} body - Gemini generateContent isteği gövdesi
 * @param {(attempt: number, waitMs: number) => void} onRetry - her tekrar denemede çağrılır (UI'da bildirmek için)
 */
const fetchGeminiWithRetry = async (body, onRetry) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API anahtarı eksik. .env dosyasına VITE_GEMINI_API_KEY ekleyin.');
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    trackRequest();
    try {
      // Anahtar query string'de değil başlıkta gidiyor: URL'ler proxy, CDN ve
      // tarayıcı geçmişi loglarına düz metin olarak düşebiliyor, başlıklar düşmüyor.
      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify(buildGeminiRequest(body))
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.error?.message || 'Gemini API isteği başarısız oldu';
        throw new Error(message);
      }

      return normalizeGeminiResponse(data);
    } catch (error) {
      const message = error.message || 'Gemini API isteği başarısız oldu';
      lastError = new Error(message);
      const isQuotaError = /quota|limit|429|saniye/i.test(message);

      if (isQuotaError && attempt < MAX_RETRIES && !/günlük kota/i.test(message)) {
        const waitMs = parseRetryDelayMs(message);
        if (onRetry) onRetry(attempt + 1, waitMs);
        await sleep(waitMs);
        continue;
      }

      if (isQuotaError) {
        throw new Error(message || 'AI istek limitine takıldı. Lütfen biraz bekleyip tekrar deneyin.');
      }
      throw lastError;
    }
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
  const data = await fetchGeminiWithRetry({
    prompt,
    images,
    responseSchema,
    responseMimeType: 'application/json',
    temperature: 0.2,
    maxOutputTokens: 8192
  }, onRetry);
  const aiResponse = data.text;

  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('AI boş yanıt döndü. Lütfen tekrar deneyin.');
  }

  try {
    return extractJson(aiResponse);
  } catch (e) {
    const truncated = data.finishReason === 'MAX_TOKENS' ? ' (yanıt çok uzundu ve kesildi, girdiyi kısaltıp tekrar deneyin)' : '';
    throw new Error('AI yanıtı işlenemedi' + truncated + ': ' + e.message);
  }
};

/**
 * Gemini'ye metin gönderip düz metin yanıt alır (yorum/analiz için)
 */
export const callGeminiForText = async (prompt, onRetry = null) => {
  const data = await fetchGeminiWithRetry({
    prompt,
    temperature: 0.4,
    maxOutputTokens: 2048
  }, onRetry);
  const aiResponse = data.text;

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
