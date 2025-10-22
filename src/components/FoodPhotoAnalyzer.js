import React, { useState } from 'react';
import './FoodPhotoAnalyzer.css';

/**
 * FoodPhotoAnalyzer - AI ile yemek fotoğrafı analizi
 * - OpenAI Vision API (GPT-4 Vision) kullanır
 * - Fotoğraftan yemek, kalori ve makro tahmini yapar
 * - Sonuçları günlük kalori takibine ekler
 */

const FoodPhotoAnalyzer = ({ onFoodAnalyzed }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');

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

    // Preview oluştur
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // OpenAI Vision API ile analiz
  const analyzeFood = async () => {
    if (!selectedImage) {
      setError('Lütfen önce bir fotoğraf seçin');
      return;
    }

    if (!apiKey) {
      setError('Lütfen OpenAI API anahtarınızı girin. https://platform.openai.com/api-keys adresinden alabilirsiniz.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Base64'e çevir
      const base64Image = await convertToBase64(selectedImage);

      // OpenAI Vision API isteği
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // GPT-4o-mini more cost-effective
          messages: [
            {
              role: 'system',
              content: `Sen profesyonel bir diyetisyen ve beslenme uzmanısın. Kullanıcıların yüklediği yemek fotoğraflarını analiz edip, yemek içeriğini, tahmini kalori ve makro besinleri hesaplıyorsun.

ÖNEMLI: Yanıtını SADECE aşağıdaki JSON formatında ver, başka açıklama ekleme:

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
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Bu fotoğraftaki yemeği analiz et ve JSON formatında bilgi ver.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image,
                    detail: 'low' // Cost optimization
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.3 // Lower temperature for more consistent results
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API isteği başarısız oldu');
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // JSON parse et
      let foodData;
      try {
        // JSON bloğunu bul (bazen ``` ile sarılı gelir)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          foodData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('JSON bulunamadı');
        }
      } catch (parseError) {
        console.error('JSON parse hatası:', parseError);
        throw new Error('AI yanıtı işlenemedi. Lütfen tekrar deneyin.');
      }

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

  // API anahtarını kaydet
  const saveApiKey = () => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
      alert('API anahtarı kaydedildi!');
    }
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
        <h3>📸 AI Yemek Analizi</h3>
        <p>Yemek fotoğrafı yükleyin, yapay zeka kalori ve makroları tahmin etsin</p>
      </div>

      {/* API Key input */}
      <div className="api-key-section">
        <label>
          🔑 OpenAI API Anahtarı
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            (Buradan alın)
          </a>
        </label>
        <div className="api-key-input-group">
          <input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button onClick={saveApiKey} className="btn-save-key">
            Kaydet
          </button>
        </div>
        <p className="api-key-note">
          ℹ️ API anahtarınız sadece tarayıcınızda saklanır, hiçbir yere gönderilmez.
        </p>
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
            <div className="upload-icon">📷</div>
            <span className="upload-text">Fotoğraf Yükle</span>
            <span className="upload-subtext">veya sürükle-bırak (max 5MB)</span>
          </label>
        </div>
      ) : (
        <div className="image-preview-section">
          <div className="image-preview">
            <img src={imagePreview} alt="Seçilen yemek" />
          </div>

          <div className="analyzer-actions">
            {!analysisResult && (
              <>
                <button
                  className="btn-analyze"
                  onClick={analyzeFood}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '🔄 Analiz ediliyor...' : '🤖 AI ile Analiz Et'}
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
            ℹ️ Bu tahminler yapay zeka tarafından üretilmiştir ve yaklaşık değerlerdir.
            Kesin besin değerleri için ürün etiketlerini kontrol edin.
          </div>
        </div>
      )}

      {/* Bilgilendirme */}
      {!imagePreview && !analysisResult && (
        <div className="analyzer-info">
          <h4>💡 Nasıl Çalışır?</h4>
          <ol>
            <li>OpenAI API anahtarınızı girin (ücretsiz deneme hesabı açabilirsiniz)</li>
            <li>Yemek fotoğrafı yükleyin</li>
            <li>AI, yemeği tanımlayıp kalori ve makroları tahmin eder</li>
            <li>Sonuçları günlük kalori takibinize ekleyebilirsiniz</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default FoodPhotoAnalyzer;
