/**
 * Gemini hata sınıflandırması - hangi hata tekrar denenmeli, ne kadar beklenmeli
 * ve kullanıcıya ne yazılmalı.
 *
 * geminiClient.js'ten ayrı duruyor çünkü orası import.meta.env kullanıyor ve
 * test ortamında yüklenemiyor; bu mantık ise saf ve test edilebilir olmalı.
 */

// 503/500 için sunucu bekleme süresi vermiyor, kısa sabit bir aralık kullanıyoruz.
export const OVERLOAD_RETRY_MS = 2500;
export const DEFAULT_QUOTA_RETRY_MS = 15000;

/** Hata mesajından "Please retry in 17.47s" gibi bir bekleme süresi çıkarmayı dener. */
export const parseRetryDelayMs = (message) => {
  const match = message?.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  }
  const trMatch = message?.match(/(\d+)\s*saniye/i);
  if (trMatch) {
    return parseInt(trMatch[1], 10) * 1000 + 500;
  }
  return DEFAULT_QUOTA_RETRY_MS;
};

/**
 * @param {{status?: number, message?: string}} error
 * @returns {{kind: 'quota'|'overload'|'fatal', retryable: boolean, waitMs: number, userMessage: string}}
 */
export const classifyGeminiError = ({ status, message } = {}) => {
  const text = message || 'Gemini API isteği başarısız oldu';
  // Türkçe "kota" da yakalanmalı: uygulamanın kendi ürettiği kota mesajları Türkçe.
  const isQuota = /quota|kota|limit|429|saniye/i.test(text);
  const isDailyQuota = /günlük kota/i.test(text);
  // Ücretsiz katmanda 503 "high demand" sık görülüyor ve tamamen geçici.
  const isOverload = status === 503 || status === 500
    || /high demand|overloaded|unavailable|try again later/i.test(text);

  if (isQuota) {
    return {
      kind: 'quota',
      retryable: !isDailyQuota,
      waitMs: parseRetryDelayMs(text),
      userMessage: text
    };
  }

  if (isOverload) {
    return {
      kind: 'overload',
      retryable: true,
      waitMs: OVERLOAD_RETRY_MS,
      userMessage: 'Google\'ın AI servisi şu an yoğun. Birkaç dakika sonra tekrar dene.'
    };
  }

  return { kind: 'fatal', retryable: false, waitMs: 0, userMessage: text };
};
