import { classifyGeminiError, parseRetryDelayMs, OVERLOAD_RETRY_MS } from './geminiRetry';

describe('classifyGeminiError - geçici sunucu yoğunluğu', () => {
  // Canlı testte gerçekten karşılaşıldı: ücretsiz katmanda 503 sık geliyor.
  test('503 tekrar denenebilir sayılır', () => {
    const r = classifyGeminiError({
      status: 503,
      message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.'
    });
    expect(r.kind).toBe('overload');
    expect(r.retryable).toBe(true);
    expect(r.waitMs).toBe(OVERLOAD_RETRY_MS);
  });

  test('500 de tekrar denenebilir', () => {
    expect(classifyGeminiError({ status: 500, message: 'Internal error' }).retryable).toBe(true);
  });

  test('status gelmese de mesajdan yakalanır', () => {
    expect(classifyGeminiError({ message: 'The model is overloaded. Please try again later.' }).kind).toBe('overload');
  });

  test('kullanıcıya Türkçe ve eyleme dönük mesaj verilir', () => {
    const r = classifyGeminiError({ status: 503, message: 'high demand' });
    expect(r.userMessage).toMatch(/yoğun/);
    expect(r.userMessage).not.toMatch(/high demand/);
  });
});

describe('classifyGeminiError - kota', () => {
  test('429 tekrar denenir ve sunucunun verdiği süre kullanılır', () => {
    const r = classifyGeminiError({ status: 429, message: 'Quota exceeded. Please retry in 17.47s' });
    expect(r.kind).toBe('quota');
    expect(r.retryable).toBe(true);
    expect(r.waitMs).toBe(17970);
  });

  test('günlük kota bittiyse tekrar denenmez', () => {
    const r = classifyGeminiError({ status: 429, message: 'günlük kota doldu' });
    expect(r.kind).toBe('quota');
    expect(r.retryable).toBe(false);
  });
});

describe('classifyGeminiError - kalıcı hatalar', () => {
  test('geçersiz anahtar tekrar denenmez ve mesaj korunur', () => {
    const r = classifyGeminiError({ status: 400, message: 'API key not valid. Please pass a valid API key.' });
    expect(r.kind).toBe('fatal');
    expect(r.retryable).toBe(false);
    expect(r.userMessage).toMatch(/API key not valid/);
  });

  test('referrer kısıtı engeli tekrar denenmez', () => {
    const r = classifyGeminiError({ status: 403, message: 'Requests from referer https://x.com are blocked.' });
    expect(r.retryable).toBe(false);
  });

  test('boş hata güvenli varsayılana düşer', () => {
    const r = classifyGeminiError();
    expect(r.kind).toBe('fatal');
    expect(r.userMessage).toBeTruthy();
  });
});

describe('parseRetryDelayMs', () => {
  test('İngilizce "retry in Xs" okunur', () => {
    expect(parseRetryDelayMs('Please retry in 5s')).toBe(5500);
  });

  test('Türkçe "X saniye" okunur', () => {
    expect(parseRetryDelayMs('30 saniye sonra tekrar deneyin')).toBe(30500);
  });

  test('süre yoksa varsayılan döner', () => {
    expect(parseRetryDelayMs('bilinmeyen hata')).toBe(15000);
  });
});
