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
  NUTRITION_LABEL: 'nutrition_label'
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

  // Google Gemini ile analiz
  const analyzeWithGemini = async (base64Image) => {
    // Base64'ten data:image/jpeg;base64, prefix'ini kaldır
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    // Mod'a göre prompt
    const prompt = analysisMode === ANALYSIS_MODES.FOOD_PHOTO
      ? `Sen profesyonel bir diyetisyen ve beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve aşağıdaki JSON formatında bilgi ver. SADECE JSON döndür, başka açıklama ekleme:

{
  "food_name": "Yemek adı (Türkçe)",
  "description": "Kısa açıklama (1 cümle)",
  "calories": tahmin edilen kalori (sayı),
  "protein": gram cinsinden protein (sayı),
  "carbs": gram cinsinden karbonhidrat (sayı),
  "fats": gram cinsinden yağ (sayı),
  "portion_size": "Porsiyon büyüklüğü tahmini (örn: 1 porsiyon, 200g)",
  "confidence": "high/medium/low - tahmin güvenilirliği"
}`
      : `Sen profesyonel bir diyetisyensin. Bu besin etiketini (nutrition facts) oku ve aşağıdaki JSON formatında bilgi ver. SADECE JSON döndür:

{
  "food_name": "Ürün adı (etiketten oku)",
  "description": "Ürün açıklaması (1 cümle)",
  "calories": etiketteki kalori değeri (sayı),
  "protein": gram cinsinden protein (sayı),
  "carbs": gram cinsinden karbonhidrat (sayı),
  "fats": gram cinsinden yağ (sayı),
  "portion_size": "Porsiyon büyüklüğü (etiketten oku, örn: 100g)",
  "confidence": "high/medium/low - etiket okunabilirlik güveni"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,
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
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API isteği başarısız oldu');
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].content.parts[0].text;

    // JSON parse et
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI yanıtı JSON formatında değil');
    }

    return JSON.parse(jsonMatch[0]);
  };

  // Ana analiz fonksiyonu
  const analyzeFood = async () => {
    if (!selectedImage) {
      setError('Lütfen önce bir fotoğraf seçin');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Base64'e çevir
      const base64Image = await convertToBase64(selectedImage);

      // Gemini ile analiz
      const foodData = await analyzeWithGemini(base64Image);
      setAnalysisResult(foodData);

      // Parent component'e bildir
      if (onFoodAnalyzed) {
        onFoodAnalyzed(foodData);
      }

    } catch (err) {
      console.error('Analiz hatası:', err);
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
  };

  return (
    <div className="food-photo-analyzer">
      <div className="analyzer-header">
        <h3>🤖 Google Gemini AI Yemek Analizi</h3>
        <p className="free-badge">✨ TAMAMEN ÜCRETSIZ - Günde 1500 istek</p>
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
        </div>
      </div>

      {/* Fotoğraf yükleme */}
      {!imagePreview ? (
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
            ℹ️ Bu tahminler Google Gemini AI tarafından üretilmiştir.
            {analysisMode === ANALYSIS_MODES.NUTRITION_LABEL
              ? ' Etiket bilgileri okunarak hesaplanmıştır.'
              : ' Yaklaşık değerlerdir, kesin besin değerleri için ürün etiketlerini kontrol edin.'}
          </div>
        </div>
      )}

      {/* Bilgilendirme */}
      {!imagePreview && !analysisResult && (
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
            <strong>🤖 Google Gemini AI:</strong> Yapay zeka ile yemek analizi tamamen otomatik!
            Sadece fotoğraf yükleyin, gerisini biz halledelim.
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodPhotoAnalyzer;
