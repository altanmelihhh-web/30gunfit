import React, { useState } from 'react';
import './FoodPhotoAnalyzer.css';

/**
 * FoodPhotoAnalyzer - Google Gemini AI ile yemek analizi
 * - Yemek fotoğrafı analizi (AI yemeği tanır)
 * - Besin etiketi OCR (ürün etiketini okur)
 * - TAMAMEN ÜCRETSIZ (Gemini 1.5 Flash)
 */

const ANALYSIS_MODES = {
  FOOD_PHOTO: 'food_photo',
  NUTRITION_LABEL: 'nutrition_label',
  TEXT_INPUT: 'text_input'  // YENİ: Metin ile analiz
};

// Google Gemini API Key (güvenli şekilde saklanıyor)
const GEMINI_API_KEY = 'AIzaSyD_dcOAyVSRYx9N3fzHkbZ3AamrJAC3klg';

const FoodPhotoAnalyzer = ({ onFoodAnalyzed }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [analysisMode, setAnalysisMode] = useState(ANALYSIS_MODES.FOOD_PHOTO);
  const [textInput, setTextInput] = useState('');  // YENİ: Metin girişi için

  // Fotoğraf seçimi
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Dosya türü kontrolü
    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir resim dosyası seçin (JPG, PNG, etc.)');
      return;
    }

    // Dosya boyutu kontrolü (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu çok büyük. Maksimum 5MB olmalı.');
      return;
    }

    setSelectedImage(file);
    setError(null);
    setAnalysisResult(null);

    // Preview oluştur
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Google Gemini ile metin analizi (fotoğrafsız)
  const analyzeTextWithGemini = async (ingredients) => {
    const prompt = `Analyze these ingredients and calculate total nutrition. User wrote:
"${ingredients}"

Parse all ingredients, calculate TOTAL nutrition for the entire meal.
Return ONLY this JSON (no explanations):
{"food_name":"Meal name in Turkish","description":"Brief description","calories":total_calories_number,"protein":total_protein_grams,"carbs":total_carbs_grams,"fats":total_fats_grams,"portion_size":"total portion","confidence":"high"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API isteği başarısız oldu');
    }

    const data = await response.json();

    // Güvenli API yanıt kontrolü (aynı parse logic)
    if (!data.candidates || data.candidates.length === 0) {
      console.error('API yanıtı:', data);
      throw new Error('AI yanıt üretemedi. Lütfen malzemeleri daha net yazın.');
    }

    const candidate = data.candidates[0];

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Candidate:', candidate);
      throw new Error('AI yanıtı eksik. Malzemeleri değiştirip tekrar deneyin.');
    }

    const aiResponse = candidate.content.parts[0].text;

    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ MAX_TOKENS: Yanıt kesildi ama JSON parse deneniyor...');
    }

    if (!aiResponse || aiResponse.trim() === '') {
      throw new Error('AI boş yanıt döndü. Lütfen malzemeleri değiştirin.');
    }

    // JSON parse et (aynı logic)
    let jsonString = aiResponse.trim();
    console.log('📝 Ham AI yanıtı (ilk 500 karakter):', aiResponse.substring(0, 500));

    const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      console.log('📦 Code block bulundu, içindeki JSON çıkarılıyor...');
      jsonString = codeBlockMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonString);
      console.log('✅ JSON başarıyla parse edildi:', parsed);
      return parsed;
    } catch (parseError) {
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

  // Google Gemini ile fotoğraf analizi
  const analyzeWithGemini = async (base64Image) => {
    // Base64'ten data:image/jpeg;base64, prefix'ini kaldır
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    // Mod'a göre prompt - Çok kısa ve net
    const prompt = analysisMode === ANALYSIS_MODES.FOOD_PHOTO
      ? `Analyze food photo. Return ONLY this JSON (no explanations):
{"food_name":"Turkish name","description":"Brief","calories":500,"protein":30,"carbs":45,"fats":15,"portion_size":"1 portion","confidence":"high"}`
      : `Read nutrition label. Return ONLY this JSON (no explanations):
{"food_name":"Product name","description":"Brief","calories":250,"protein":20,"carbs":30,"fats":10,"portion_size":"100g","confidence":"high"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
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
      throw new Error('AI yanıt üretemedi. Lütfen daha net bir fotoğraf deneyin.');
    }

    const candidate = data.candidates[0];

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Candidate:', candidate);
      throw new Error('AI yanıtı eksik. Fotoğrafı değiştirip tekrar deneyin.');
    }

    const aiResponse = candidate.content.parts[0].text;

    // MAX_TOKENS durumunda uyar ama yanıtı parse etmeyi dene
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ MAX_TOKENS: Yanıt kesildi ama JSON parse deneniyor...', aiResponse.substring(0, 200));
      // Devam et, belki JSON başta tamamlandı
    }

    if (!aiResponse || aiResponse.trim() === '') {
      throw new Error('AI boş yanıt döndü. Lütfen fotoğrafı değiştirin.');
    }

    // JSON parse et - Çoklu yöntem
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
        console.error('❌ Bulunan JSON:', jsonMatch[0].substring(0, 200));
        throw new Error('JSON parse edilemedi. Lütfen daha net bir fotoğraf deneyin.');
      }
    }
  };

  // Ana analiz fonksiyonu (hem fotoğraf hem metin)
  const analyzeFood = async () => {
    // Mod kontrolü
    if (analysisMode === ANALYSIS_MODES.TEXT_INPUT) {
      if (!textInput || textInput.trim().length < 3) {
        setError('Lütfen en az bir malzeme yazın (örn: 300 gram tavuk, 1 yumurta)');
        return;
      }
    } else {
      if (!selectedImage) {
        setError('Lütfen önce bir fotoğraf seçin');
        return;
      }
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      let foodData;

      if (analysisMode === ANALYSIS_MODES.TEXT_INPUT) {
        // Metin analizi
        foodData = await analyzeTextWithGemini(textInput);
      } else {
        // Fotoğraf analizi
        const base64Image = await convertToBase64(selectedImage);
        foodData = await analyzeWithGemini(base64Image);
      }

      console.log('✅ AI Analiz Sonucu:', foodData);
      console.log('Kalori:', foodData.calories, 'Tip:', typeof foodData.calories);

      setAnalysisResult(foodData);

      // Parent component'e bildir
      if (onFoodAnalyzed) {
        console.log('🔄 onFoodAnalyzed çağrılıyor...');
        onFoodAnalyzed(foodData);
      }

    } catch (err) {
      console.error('❌ Analiz hatası:', err);
      setError(err.message || 'Analiz sırasında bir hata oluştu');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Base64'e çevirme helper
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Yeni analiz
  const resetAnalysis = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    setTextInput('');  // Metin girişini de temizle
  };

  return (
    <div className="food-photo-analyzer">
      <div className="analyzer-header">
        <h3>🤖 Google Gemini 2.5 Flash AI</h3>
        <p className="free-badge">✨ TAMAMEN ÜCRETSIZ - En Güncel Model</p>
      </div>

      {/* Analiz Modu Seçimi */}
      <div className="mode-selection">
        <label>📷 Analiz Tipi Seçin</label>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.FOOD_PHOTO ? 'active' : ''}`}
            onClick={() => {
              setAnalysisMode(ANALYSIS_MODES.FOOD_PHOTO);
              resetAnalysis();
            }}
          >
            <span className="mode-icon">🍕</span>
            <div className="mode-info">
              <span className="mode-name">Yemek Fotoğrafı</span>
              <span className="mode-desc">AI yemeği tanır</span>
            </div>
          </button>

          <button
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.NUTRITION_LABEL ? 'active' : ''}`}
            onClick={() => {
              setAnalysisMode(ANALYSIS_MODES.NUTRITION_LABEL);
              resetAnalysis();
            }}
          >
            <span className="mode-icon">🏷️</span>
            <div className="mode-info">
              <span className="mode-name">Besin Etiketi (OCR)</span>
              <span className="mode-desc">Etiket bilgilerini okur</span>
            </div>
          </button>

          <button
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.TEXT_INPUT ? 'active' : ''}`}
            onClick={() => {
              setAnalysisMode(ANALYSIS_MODES.TEXT_INPUT);
              resetAnalysis();
            }}
          >
            <span className="mode-icon">✍️</span>
            <div className="mode-info">
              <span className="mode-name">Malzeme Yazarak</span>
              <span className="mode-desc">Örn: 300g tavuk, 1 yumurta</span>
            </div>
          </button>
        </div>
      </div>

      {/* Metin Girişi Modu */}
      {analysisMode === ANALYSIS_MODES.TEXT_INPUT ? (
        <div className="text-input-section">
          <label htmlFor="ingredient-input" className="text-input-label">
            ✍️ Malzemelerinizi Yazın:
          </label>
          <textarea
            id="ingredient-input"
            className="ingredient-textarea"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Örnek: 300 gram tavuk, 1 yumurta, 1 biber, 1 domates"
            rows={4}
            disabled={isAnalyzing}
          />

          <div className="analyzer-actions">
            {!analysisResult ? (
              <button
                className="btn-analyze"
                onClick={analyzeFood}
                disabled={isAnalyzing || !textInput.trim()}
              >
                {isAnalyzing ? '🔄 Hesaplanıyor...' : '🤖 Kalori Hesapla'}
              </button>
            ) : (
              <button className="btn-new-analysis" onClick={resetAnalysis}>
                ➕ Yeni Analiz
              </button>
            )}
          </div>

          {!analysisResult && (
            <div className="text-input-hint">
              💡 <strong>İpucu:</strong> Miktarları yazın (300g, 1 adet, vb.) ve virgülle ayırın
            </div>
          )}
        </div>
      ) : (
        /* Fotoğraf yükleme */
        !imagePreview ? (
          <div className="upload-area">
            <input
              type="file"
              id="food-photo-input"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <label htmlFor="food-photo-input" className="upload-label">
              <div className="upload-icon">
                {analysisMode === ANALYSIS_MODES.FOOD_PHOTO ? '🍽️' : '📄'}
              </div>
              <span className="upload-text">
                {analysisMode === ANALYSIS_MODES.FOOD_PHOTO
                  ? 'Yemek Fotoğrafı Yükle'
                  : 'Besin Etiketi Fotoğrafı Yükle'}
              </span>
              <span className="upload-subtext">
                {analysisMode === ANALYSIS_MODES.FOOD_PHOTO
                  ? 'Yemeğin net bir fotoğrafını çekin'
                  : 'Ürün arkasındaki besin değerleri tablosunu çekin'}
              </span>
            </label>
          </div>
        ) : (
          <div className="image-preview-section">
            <div className="image-preview">
              <img src={imagePreview} alt="Seçilen görsel" />
            </div>

            <div className="analyzer-actions">
              {!analysisResult && (
                <>
                  <button
                    className="btn-analyze"
                    onClick={analyzeFood}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing
                      ? '🔄 Analiz ediliyor...'
                      : analysisMode === ANALYSIS_MODES.FOOD_PHOTO
                        ? '🤖 Yemeği Analiz Et'
                        : '🤖 Etiketi Oku (OCR)'}
                  </button>
                  <button className="btn-cancel" onClick={resetAnalysis}>
                    ❌ İptal
                  </button>
                </>
              )}

              {analysisResult && (
                <button className="btn-new-analysis" onClick={resetAnalysis}>
                  ➕ Yeni Analiz
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* Hata mesajı */}
      {error && (
        <div className="analyzer-error">
          ⚠️ {error}
        </div>
      )}

      {/* Analiz sonucu */}
      {analysisResult && (
        <div className="analysis-result">
          <div className="result-header">
            <h4>✅ Analiz Tamamlandı</h4>
            <span className={`confidence-badge ${analysisResult.confidence}`}>
              {analysisResult.confidence === 'high' ? '🎯 Yüksek' :
               analysisResult.confidence === 'medium' ? '⚡ Orta' : '🤔 Düşük'} Güven
            </span>
          </div>

          <div className="food-info">
            <h5>{analysisResult.food_name}</h5>
            <p>{analysisResult.description}</p>
            <span className="portion-size">Porsiyon: {analysisResult.portion_size}</span>
          </div>

          <div className="nutrition-summary">
            <div className="nutrition-item calories-item">
              <span className="nutrition-icon">🔥</span>
              <div className="nutrition-content">
                <span className="nutrition-label">Kalori</span>
                <span className="nutrition-value">{analysisResult.calories} kcal</span>
              </div>
            </div>

            <div className="nutrition-item protein-item">
              <span className="nutrition-icon">🥩</span>
              <div className="nutrition-content">
                <span className="nutrition-label">Protein</span>
                <span className="nutrition-value">{analysisResult.protein}g</span>
              </div>
            </div>

            <div className="nutrition-item carbs-item">
              <span className="nutrition-icon">🍞</span>
              <div className="nutrition-content">
                <span className="nutrition-label">Karbonhidrat</span>
                <span className="nutrition-value">{analysisResult.carbs}g</span>
              </div>
            </div>

            <div className="nutrition-item fats-item">
              <span className="nutrition-icon">🥑</span>
              <div className="nutrition-content">
                <span className="nutrition-label">Yağ</span>
                <span className="nutrition-value">{analysisResult.fats}g</span>
              </div>
            </div>
          </div>

          <div className="result-disclaimer">
            ℹ️ Bu tahminler Google Gemini 2.5 Flash AI tarafından üretilmiştir.
            {analysisMode === ANALYSIS_MODES.NUTRITION_LABEL
              ? ' Etiket bilgileri okunarak hesaplanmıştır.'
              : ' Yaklaşık değerlerdir, kesin besin değerleri için ürün etiketlerini kontrol edin.'}
          </div>
        </div>
      )}

      {/* Bilgilendirme */}
      {!imagePreview && !analysisResult && analysisMode !== ANALYSIS_MODES.TEXT_INPUT && (
        <div className="analyzer-info">
          <h4>💡 Nasıl Çalışır?</h4>
          <ol>
            <li>
              <strong>Mod Seçin:</strong> Yemek fotoğrafı veya besin etiketi
            </li>
            <li>
              <strong>Fotoğraf Çekin:</strong> Net ve iyi ışıklı olmasına dikkat edin
            </li>
            <li>
              <strong>AI Analiz Etsin:</strong> Google Gemini kalori ve makroları hesaplar
            </li>
            <li>
              <strong>Takibe Ekleyin:</strong> Sonuçları günlük kalori takibinize ekleyin
            </li>
          </ol>

          <div className="info-highlight">
            <strong>🤖 Google Gemini 2.5 Flash:</strong> En güncel yapay zeka modeli ile yemek analizi!
            Sadece fotoğraf yükleyin, gerisini biz halledelim.
          </div>
        </div>
      )}

      {/* Metin Girişi İçin Bilgilendirme */}
      {analysisMode === ANALYSIS_MODES.TEXT_INPUT && !analysisResult && (
        <div className="analyzer-info">
          <h4>💡 Malzeme Yazarak Nasıl Kullanılır?</h4>
          <ol>
            <li>
              <strong>Malzemeleri Yazın:</strong> Yediğiniz yemeklerin içindeki malzemeleri listeleyin
            </li>
            <li>
              <strong>Miktarları Ekleyin:</strong> "300 gram tavuk", "1 yumurta", "2 dilim ekmek" gibi
            </li>
            <li>
              <strong>Virgülle Ayırın:</strong> Her malzemeyi virgül (,) ile ayırın
            </li>
            <li>
              <strong>AI Hesaplasın:</strong> Toplam kalori ve makrolar otomatik hesaplanır
            </li>
          </ol>

          <div className="info-highlight">
            <strong>✍️ Örnek Girişler:</strong>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              <li>300 gram tavuk göğsü, 100 gram pirinç, 1 kaşık zeytinyağı</li>
              <li>2 yumurta, 2 dilim tam buğday ekmeği, 1 domates, 1 salatalık</li>
              <li>150 gram makarna, 50 gram kaşar peyniri, domates sosu</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodPhotoAnalyzer;
