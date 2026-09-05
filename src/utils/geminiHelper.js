import { callGeminiForJSON, callGeminiForText } from './geminiClient';

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
    return callGeminiForText(prompt);
  } catch (error) {
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
    return callGeminiForJSON(prompt);
  } catch (error) {
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
    return callGeminiForJSON(prompt);
  } catch (error) {
    throw new Error('Tarif önerileri alınamadı.');
  }
};
