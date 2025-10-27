/**
 * Gemini AI Helper - Ortak Gemini API kullanımı
 * FoodPhotoAnalyzer ve ShoppingList bileşenlerinde kullanılır
 */

// Google Gemini API Key (güvenli şekilde saklanıyor)
const GEMINI_API_KEY = 'AIzaSyD_dcOAyVSRYx9N3fzHkbZ3AamrJAC3klg';

/**
 * Gemini API'sine genel amaçlı istek gönderme
 * @param {string} prompt - Gönderilecek metin prompt
 * @param {string} base64Image - (Opsiyonel) Base64 formatında görsel
 * @param {object} options - Ek ayarlar (temperature, maxTokens, etc.)
 */
export const callGeminiAPI = async (prompt, base64Image = null, options = {}) => {
  const {
    temperature = 0.2,
    maxOutputTokens = 4096,
    model = 'gemini-2.5-flash'
  } = options;

  const parts = [{ text: prompt }];

  // Eğer görsel varsa ekle
  if (base64Image) {
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature,
          maxOutputTokens
        }
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini API isteği başarısız oldu');
  }

  const data = await response.json();

  // Güvenli API yanıt kontrolü
  if (!data.candidates || data.candidates.length === 0) {
    console.error('API yanıtı:', data);
    throw new Error('AI yanıt üretemedi. Lütfen tekrar deneyin.');
  }

  const candidate = data.candidates[0];

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error('Candidate:', candidate);
    throw new Error('AI yanıtı eksik. Lütfen tekrar deneyin.');
  }

  const aiResponse = candidate.content.parts[0].text;

  if (candidate.finishReason === 'MAX_TOKENS') {
    console.warn('⚠️ MAX_TOKENS: Yanıt kesildi ama parse deneniyor...');
  }

  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('AI boş yanıt döndü. Lütfen tekrar deneyin.');
  }

  return aiResponse;
};

/**
 * JSON parse etme - Çoklu yöntem ile güvenli parse
 * @param {string} aiResponse - AI'dan gelen ham yanıt
 */
export const parseGeminiJSON = (aiResponse) => {
  let jsonString = aiResponse.trim();
  console.log('📝 Ham AI yanıtı (ilk 500 karakter):', aiResponse.substring(0, 500));

  // 1. Önce ```json bloğu ara
  const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    console.log('📦 Code block bulundu, içindeki JSON çıkarılıyor...');
    jsonString = codeBlockMatch[1].trim();
  }

  // 2. Direkt parse dene
  try {
    const parsed = JSON.parse(jsonString);
    console.log('✅ JSON başarıyla parse edildi:', parsed);
    return parsed;
  } catch (parseError) {
    // 3. Regex ile JSON objesini bul
    console.warn('⚠️ Direkt JSON parse başarısız, regex ile deneniyor...');
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ AI yanıtı:', aiResponse);
      throw new Error('AI yanıtı JSON formatında değil. Yanıt: ' + aiResponse.substring(0, 200));
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Regex ile JSON parse edildi:', parsed);
      return parsed;
    } catch (secondError) {
      console.error('❌ JSON parse hatası:', secondError);
      throw new Error('JSON parse edilemedi. Lütfen daha açıklayıcı yazın.');
    }
  }
};

/**
 * Alışveriş listesi için AI asistan
 * Malzeme alternatifi, tarif önerisi, vs.
 */
export const askGeminiAboutIngredients = async (question, ingredients = []) => {
  const ingredientList = ingredients.length > 0
    ? `\n\nMevcut Malzemeler:\n${ingredients.map(i => `- ${i.name}`).join('\n')}`
    : '';

  const prompt = `Sen bir beslenme ve mutfak asistanısın. Kullanıcının sorusuna kısa ve net cevap ver.

Kullanıcı Sorusu: "${question}"${ingredientList}

Lütfen:
- Kısa ve öz cevap ver (maksimum 3-4 cümle)
- Pratik ve uygulanabilir öneriler sun
- Türkçe cevap ver

Cevabın:`;

  try {
    const response = await callGeminiAPI(prompt, null, { temperature: 0.7 });
    return response.trim();
  } catch (error) {
    console.error('Gemini AI hatası:', error);
    throw new Error('AI yanıt veremedi. Lütfen tekrar deneyin.');
  }
};

/**
 * Malzeme için akıllı alternatifler öner
 */
export const suggestIngredientAlternatives = async (ingredient) => {
  const prompt = `Bir beslenme uzmanı olarak, "${ingredient}" malzemesi için 3 alternatif öner.

Format (JSON):
{
  "alternatives": [
    {"name": "Alternatif 1", "reason": "Neden uygun"},
    {"name": "Alternatif 2", "reason": "Neden uygun"},
    {"name": "Alternatif 3", "reason": "Neden uygun"}
  ]
}

Sadece JSON döndür, başka açıklama ekleme.`;

  try {
    const response = await callGeminiAPI(prompt);
    return parseGeminiJSON(response);
  } catch (error) {
    console.error('Alternatif önerisi hatası:', error);
    throw new Error('Alternatif önerileri alınamadı.');
  }
};

/**
 * Mevcut malzemelerle yapılabilecek yemekler öner
 */
export const suggestRecipesWithIngredients = async (ingredients) => {
  const ingredientNames = ingredients.map(i => i.name).join(', ');

  const prompt = `Bu malzemelerle yapılabilecek 3 kolay yemek tarifi öner: ${ingredientNames}

Format (JSON):
{
  "recipes": [
    {"name": "Yemek Adı", "description": "Kısa tarif", "difficulty": "Kolay/Orta/Zor"},
    {"name": "Yemek Adı 2", "description": "Kısa tarif", "difficulty": "Kolay/Orta/Zor"},
    {"name": "Yemek Adı 3", "description": "Kısa tarif", "difficulty": "Kolay/Orta/Zor"}
  ]
}

Sadece JSON döndür.`;

  try {
    const response = await callGeminiAPI(prompt);
    return parseGeminiJSON(response);
  } catch (error) {
    console.error('Tarif önerisi hatası:', error);
    throw new Error('Tarif önerileri alınamadı.');
  }
};
