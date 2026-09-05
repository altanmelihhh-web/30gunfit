export const scopedKey = (baseKey, userId) => (userId ? `${baseKey}:${userId}` : baseKey);

export const getScopedJson = (baseKey, userId, fallback = null) => {
  try {
    const raw = localStorage.getItem(scopedKey(baseKey, userId));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const setScopedJson = (baseKey, userId, value) => {
  try {
    localStorage.setItem(scopedKey(baseKey, userId), JSON.stringify(value));
  } catch {
    // localStorage dolu veya kapalıysa bulut kaydı yine devam eder.
  }
};
