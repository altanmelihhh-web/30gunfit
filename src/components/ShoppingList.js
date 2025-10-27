import React, { useState, useEffect } from 'react';
import { askGeminiAboutIngredients, suggestIngredientAlternatives } from '../utils/geminiHelper';
import './ShoppingList.css';

/**
 * ShoppingList - Manuel + AI Alışveriş Listesi
 * - Diyetisyen listesini gir
 * - Evdekileri işaretle
 * - Eksikleri gör
 * - AI ile alternatif/tarif öner
 */

const ShoppingList = () => {
  // State yönetimi
  const [dieticianList, setDieticianList] = useState([]); // Diyetisyenin listesi
  const [newIngredient, setNewIngredient] = useState(''); // Yeni malzeme girişi
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

  // AI state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Alternative suggestions state
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

  // File upload state
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // LocalStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('shoppingList');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDieticianList(parsed);
      } catch (error) {
        console.error('LocalStorage parse hatası:', error);
      }
    }
  }, []);

  // LocalStorage'a kaydet
  useEffect(() => {
    if (dieticianList.length > 0) {
      localStorage.setItem('shoppingList', JSON.stringify(dieticianList));
    }
  }, [dieticianList]);

  // Malzeme ekle
  const handleAddIngredient = () => {
    if (!newIngredient.trim()) return;

    const ingredient = {
      id: Date.now(),
      name: newIngredient.trim(),
      hasAtHome: false, // Başlangıçta evde yok
      addedAt: new Date().toISOString()
    };

    setDieticianList([...dieticianList, ingredient]);
    setNewIngredient('');
    setIsAddingIngredient(false);
  };

  // Malzeme sil
  const handleDeleteIngredient = (id) => {
    setDieticianList(dieticianList.filter(item => item.id !== id));
  };

  // Evde var/yok durumunu değiştir
  const toggleHasAtHome = (id) => {
    setDieticianList(
      dieticianList.map(item =>
        item.id === id ? { ...item, hasAtHome: !item.hasAtHome } : item
      )
    );
  };

  // Tümünü temizle
  const clearAllIngredients = () => {
    if (window.confirm('Tüm listeyi silmek istediğinize emin misiniz?')) {
      setDieticianList([]);
      localStorage.removeItem('shoppingList');
    }
  };

  // Eksik malzemeleri hesapla
  const missingIngredients = dieticianList.filter(item => !item.hasAtHome);
  const availableIngredients = dieticianList.filter(item => item.hasAtHome);

  // AI'ya soru sor
  const handleAskAI = async () => {
    if (!aiQuestion.trim()) {
      setAiError('Lütfen bir soru yazın');
      return;
    }

    setIsAskingAI(true);
    setAiError(null);
    setAiResponse(null);

    try {
      const response = await askGeminiAboutIngredients(
        aiQuestion,
        dieticianList
      );
      setAiResponse(response);
      setAiQuestion(''); // Soruyu temizle
    } catch (error) {
      console.error('AI soru hatası:', error);
      setAiError(error.message);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Malzeme alternatifi öner
  const handleSuggestAlternatives = async (ingredient) => {
    setSelectedIngredient(ingredient);
    setIsLoadingAlternatives(true);
    setAlternatives([]);

    try {
      const result = await suggestIngredientAlternatives(ingredient.name);
      setAlternatives(result.alternatives || []);
    } catch (error) {
      console.error('Alternatif önerisi hatası:', error);
      setAlternatives([]);
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  // Alternatifi listeye ekle
  const handleAddAlternative = (alternativeName) => {
    const ingredient = {
      id: Date.now(),
      name: alternativeName,
      hasAtHome: false,
      addedAt: new Date().toISOString()
    };

    setDieticianList([...dieticianList, ingredient]);
    setSelectedIngredient(null);
    setAlternatives([]);
  };

  // Dosyadan liste yükleme
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);

    // Dosya türü kontrolü
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'txt') {
      setUploadError('Sadece .txt dosyaları destekleniyor. Word dosyanızı .txt olarak kaydedin.');
      return;
    }

    // Dosya boyutu kontrolü (max 1MB)
    if (file.size > 1024 * 1024) {
      setUploadError('Dosya çok büyük. Maksimum 1MB olmalı.');
      return;
    }

    // Dosyayı oku
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');

        const newIngredients = [];
        let addedCount = 0;

        lines.forEach((line) => {
          const trimmed = line.trim();
          // Boş satırları ve çok kısa satırları atla
          if (trimmed.length > 2) {
            // Satırı temizle (sayı, tire, nokta gibi başlangıçları kaldır)
            let cleanedLine = trimmed
              .replace(/^[\d\.\-\*\•]+\s*/, '') // Başındaki numaralar, tire, yıldız vb. kaldır
              .replace(/^[\-\•]\s*/, '') // Tire işaretlerini kaldır
              .trim();

            if (cleanedLine.length > 2 && cleanedLine.length < 100) {
              newIngredients.push({
                id: Date.now() + addedCount,
                name: cleanedLine,
                hasAtHome: false,
                addedAt: new Date().toISOString()
              });
              addedCount++;
            }
          }
        });

        if (newIngredients.length === 0) {
          setUploadError('Dosyada geçerli malzeme bulunamadı.');
          return;
        }

        // Mevcut listeye ekle
        setDieticianList([...dieticianList, ...newIngredients]);
        setUploadSuccess(true);

        // Başarı mesajını 3 saniye sonra gizle
        setTimeout(() => setUploadSuccess(false), 3000);

        // Input'u temizle
        event.target.value = '';
      } catch (error) {
        console.error('Dosya okuma hatası:', error);
        setUploadError('Dosya okunurken bir hata oluştu.');
      }
    };

    reader.onerror = () => {
      setUploadError('Dosya okunamadı. Lütfen tekrar deneyin.');
    };

    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="shopping-list-container">
      {/* Header */}
      <div className="shopping-list-header">
        <h2>🛒 Alışveriş Listesi</h2>
        <p className="shopping-list-subtitle">
          Diyetisyenin haftalık listesini gir, evdekileri işaretle, eksikleri gör!
        </p>
      </div>

      {/* Malzeme Ekleme */}
      <div className="add-ingredient-section">
        {!isAddingIngredient ? (
          <div className="add-buttons-group">
            <button
              className="btn-add-ingredient"
              onClick={() => setIsAddingIngredient(true)}
            >
              ➕ Manuel Ekle
            </button>
            <label className="btn-upload-file">
              📄 Dosyadan Yükle
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        ) : (
          <div className="ingredient-input-group">
            <input
              type="text"
              className="ingredient-input"
              placeholder="Örn: 500g tavuk göğsü, 1 kg pirinç..."
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
              autoFocus
            />
            <button
              className="btn-save-ingredient"
              onClick={handleAddIngredient}
              disabled={!newIngredient.trim()}
            >
              ✓
            </button>
            <button
              className="btn-cancel-ingredient"
              onClick={() => {
                setIsAddingIngredient(false);
                setNewIngredient('');
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload mesajları */}
        {uploadSuccess && (
          <div className="upload-success">
            ✅ Dosya başarıyla yüklendi! Malzemeler listeye eklendi.
          </div>
        )}
        {uploadError && (
          <div className="upload-error">
            ⚠️ {uploadError}
          </div>
        )}
      </div>

      {/* İstatistikler */}
      {dieticianList.length > 0 && (
        <div className="shopping-stats">
          <div className="stat-item">
            <span className="stat-label">Toplam Malzeme</span>
            <span className="stat-value">{dieticianList.length}</span>
          </div>
          <div className="stat-item stat-available">
            <span className="stat-label">Evde Var</span>
            <span className="stat-value">{availableIngredients.length}</span>
          </div>
          <div className="stat-item stat-missing">
            <span className="stat-label">Eksik</span>
            <span className="stat-value">{missingIngredients.length}</span>
          </div>
        </div>
      )}

      {/* Malzeme Listesi */}
      {dieticianList.length > 0 ? (
        <>
          {/* Diyetisyen Haftalık Listesi - Tüm Malzemeler */}
          <div className="dietician-list-section">
            <div className="section-header">
              <h3>📋 Diyetisyen Haftalık Listesi</h3>
              <button
                className="btn-clear-list-small"
                onClick={clearAllIngredients}
              >
                🗑️ Tümünü Temizle
              </button>
            </div>
            <div className="dietician-ingredients">
              {dieticianList.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className={`dietician-ingredient-card ${ingredient.hasAtHome ? 'checked' : ''}`}
                >
                  <label className="dietician-checkbox-label">
                    <input
                      type="checkbox"
                      checked={ingredient.hasAtHome}
                      onChange={() => toggleHasAtHome(ingredient.id)}
                      className="dietician-checkbox"
                    />
                    <span className="dietician-ingredient-name">{ingredient.name}</span>
                  </label>

                  <button
                    className="btn-delete-small"
                    onClick={() => handleDeleteIngredient(ingredient.id)}
                    title="Sil"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* İki Kolonlu Görünüm: Evde Var / Alışverişe Çıkılacaklar */}
          <div className="two-column-lists">
            {/* Sol: Evde Bulunanlar */}
            <div className="list-column available-column">
              <div className="column-header">
                <h3>✅ Evde Bulunanlar</h3>
                <span className="column-count">{availableIngredients.length}</span>
              </div>
              <div className="column-content">
                {availableIngredients.length > 0 ? (
                  availableIngredients.map((ingredient) => (
                    <div key={ingredient.id} className="list-item available-item">
                      <span className="item-icon">✓</span>
                      <span className="item-name">{ingredient.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="column-empty">
                    <span className="empty-icon">📦</span>
                    <p>Henüz işaretlenmemiş</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sağ: Alışverişe Çıkılacaklar (Eksikler) */}
            <div className="list-column missing-column">
              <div className="column-header">
                <h3>🛒 Alışveriş Listesi</h3>
                <span className="column-count">{missingIngredients.length}</span>
              </div>
              <div className="column-content">
                {missingIngredients.length > 0 ? (
                  missingIngredients.map((ingredient) => (
                    <div key={ingredient.id} className="list-item missing-item">
                      <div className="missing-item-main">
                        <span className="item-icon">🛒</span>
                        <span className="item-name">{ingredient.name}</span>
                      </div>
                      <button
                        className="btn-suggest-alternative-small"
                        onClick={() => handleSuggestAlternatives(ingredient)}
                        disabled={isLoadingAlternatives}
                        title="AI Alternatif Öner"
                      >
                        🤖
                      </button>

                      {/* Alternatifler (bu malzeme seçiliyse) */}
                      {selectedIngredient?.id === ingredient.id && (
                        <div className="alternatives-panel">
                          {isLoadingAlternatives ? (
                            <div className="alternatives-loading">
                              <span className="loading-spinner">⏳</span>
                              <span>AI arıyor...</span>
                            </div>
                          ) : alternatives.length > 0 ? (
                            <>
                              <div className="alternatives-header">
                                💡 <strong>{ingredient.name}</strong> yerine:
                              </div>
                              <div className="alternatives-list">
                                {alternatives.map((alt, index) => (
                                  <div key={index} className="alternative-item">
                                    <div className="alternative-content">
                                      <span className="alternative-name">{alt.name}</span>
                                      <span className="alternative-reason">{alt.reason}</span>
                                    </div>
                                    <button
                                      className="btn-add-alternative"
                                      onClick={() => handleAddAlternative(alt.name)}
                                      title="Listeye Ekle"
                                    >
                                      ➕
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                className="btn-close-alternatives"
                                onClick={() => {
                                  setSelectedIngredient(null);
                                  setAlternatives([]);
                                }}
                              >
                                Kapat
                              </button>
                            </>
                          ) : (
                            <div className="alternatives-error">
                              Alternatif öneriler alınamadı.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="column-empty">
                    <span className="empty-icon">🎉</span>
                    <p>Hepsi evde var!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>Liste Boş</h3>
          <p>Diyetisyenin verdiği haftalık malzeme listesini buraya ekleyin</p>
          <div className="empty-state-buttons">
            <button
              className="btn-add-from-empty"
              onClick={() => setIsAddingIngredient(true)}
            >
              ➕ Manuel Ekle
            </button>
            <label className="btn-upload-from-empty">
              📄 Dosyadan Yükle
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* AI Asistan Bölümü */}
      <div className="ai-assistant-section">
        <div className="ai-header">
          <h3>🤖 AI Asistan</h3>
          <p>Malzemelerle ilgili sorularınızı sorun</p>
        </div>

        <div className="ai-input-group">
          <input
            type="text"
            className="ai-question-input"
            placeholder="Örn: Bu malzemelerle ne yapabilirim? / Daha ucuz alternatif var mı?"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
            disabled={isAskingAI}
          />
          <button
            className="btn-ask-ai"
            onClick={handleAskAI}
            disabled={isAskingAI || !aiQuestion.trim()}
          >
            {isAskingAI ? '⏳' : '🚀'}
          </button>
        </div>

        {/* AI Örnekleri */}
        {!aiResponse && !isAskingAI && (
          <div className="ai-examples">
            <span className="examples-label">Örnek Sorular:</span>
            <button
              className="example-btn"
              onClick={() => setAiQuestion('Bu malzemelerle ne yapabilirim?')}
            >
              Bu malzemelerle ne yapabilirim?
            </button>
            <button
              className="example-btn"
              onClick={() => setAiQuestion('Eksik malzemelere daha ucuz alternatif öner')}
            >
              Eksiklere ucuz alternatif öner
            </button>
          </div>
        )}

        {/* AI Yanıtı */}
        {isAskingAI && (
          <div className="ai-loading">
            <span className="loading-spinner">⏳</span>
            <span>AI düşünüyor...</span>
          </div>
        )}

        {aiResponse && (
          <div className="ai-response">
            <div className="ai-response-header">
              <span>✨ AI Yanıtı</span>
              <button
                className="btn-clear-response"
                onClick={() => setAiResponse(null)}
              >
                ✕
              </button>
            </div>
            <div className="ai-response-content">
              {aiResponse}
            </div>
          </div>
        )}

        {aiError && (
          <div className="ai-error">
            ⚠️ {aiError}
          </div>
        )}
      </div>

      {/* Bilgilendirme */}
      <div className="shopping-info">
        <h4>💡 Nasıl Kullanılır?</h4>
        <ol>
          <li>
            <strong>Malzeme Ekle:</strong> Diyetisyenin verdiği haftalık listeyi girin
          </li>
          <li>
            <strong>Evdekileri İşaretle:</strong> Varolan malzemeleri tikleyin
          </li>
          <li>
            <strong>Eksikleri Gör:</strong> Alışverişe çıkmadan önce eksikleri kontrol edin
          </li>
          <li>
            <strong>AI Yardım:</strong> Bulamadığınız malzemeler için alternatif öner, tarif sorun
          </li>
        </ol>

        <div className="info-highlight">
          <strong>🤖 Gemini AI Entegre:</strong> Malzeme bulamıyorsanız veya yiyemediğiniz bir şey varsa,
          AI size alternatifler önerir ve tarifler sunar!
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;
