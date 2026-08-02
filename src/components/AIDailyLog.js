import React, { useState } from 'react';
import './AIDailyLog.css';
import { callGeminiForJSON, fileToBase64Image } from '../utils/geminiClient';
import { getWaterTracker, saveWaterTracker, saveDailyLog, getDailyLog } from '../firebase/dataService';
import { addMeals, getMealsSummary } from '../firebase/mealsService';
import { normalizeImageFile } from '../utils/imageUtils';
import { uploadMealPhotoToDrive } from '../utils/driveService';
import GeminiQuotaBadge from './GeminiQuotaBadge';

const EXTRACT_PROMPT = `Sen bir sağlık/fitness günlüğü asistanısın. Kullanıcının yazdığı metni ve varsa ekli görseli (yemek fotoğrafı, Apple Health uyku/aktivite ekranı, su takibi uygulaması ekranı, Hevy antrenman ekranı, takviye şişesi vb.) analiz et. Kullanıcı kendi metnini yazabileceği gibi, ChatGPT'den aldığı hazır bir günlük analiz özetini de yapıştırabilir - her iki durumda da aynı şekilde ayrıştır.

Sadece metinde veya görselde GERÇEKTEN bulunan bilgileri doldur. Emin olmadığın veya bulunmayan alanları boş bırak. Uyku/su/adım/set gibi sayısal verilerde tahmin uydurma.

ÇOK ÖNEMLİ - hazır besin değerleri: bir öğün için metinde zaten "Besin Değerleri" / "Kalori: X / Protein: Y / Karbonhidrat: Z / Yağ: W" gibi hazır hesaplanmış sayılar verilmişse, bu sayıları OLDUĞU GİBİ kullan - kendi tahminini yapıp üzerine yazma, malzemelerden yeniden hesaplama. Sadece hiç sayı verilmemiş, yalnızca malzeme/isim geçen bir öğün için tahmin yap ve "portion_size" alanına "tahmini" ekle. Malzemesi bile belirtilmemiş, sadece isim geçen bir yiyecek varsa (örn: "400 gram karpuz") onu da normal besin değerleriyle tahmin ederek ekle. Bir öğünü hiçbir zaman tamamen atlama.

Bir metinde "GÜNLÜK TOPLAM" gibi tüm gün için hazır bir toplam satırı varsa, onu ayrı bir öğün olarak EKLEME - bu sadece zaten yukarıda tek tek yazdığın öğünlerin toplamıdır, tekrar sayılırsa kalori iki katına çıkar. Aynı şekilde "TAKVİYELER" başlığı altında güne özel bir takviye özeti/toplamı varsa ve o takviyeler yukarıdaki öğün bölümlerinde zaten geçtiyse, aynı takviyeyi supplements dizisine ikinci kez ekleme - her takviye supplements içinde sadece bir kez bulunmalı.

meal_type alanı sadece breakfast/lunch/dinner/snack olabilir (sabit kategori, istatistik için kullanılıyor) - ama metindeki bölüm başlığını ("Spor Sonrası", "Gece Atıştırması", "Ara Öğün" gibi) OLDUĞU GİBİ meal_label alanına yaz, böylece örneğin hem antrenman sonrası shake hem öğleden sonraki atıştırmalık aynı "snack" kategorisine düşse bile taslakta birbirinden ayırt edilebilirler ve tekrar ediyormuş gibi görünmezler.

Kuvvet antrenmanı ve kardiyo/yürüyüş gibi farklı aktiviteler ayrı ayrı workouts girdileri olarak eklenmeli. Bir antrenman koçu değerlendirmesi (ChatGPT'den alınmış hareket bazlı ağırlık/tekrar/yıldız puanı/gelecek hafta hedefi içeren metin) yapıştırılırsa, her hareket için sets dizisinde ağırlık×tekrar bilgisini set set çıkar, varsa yıldız puanını rating'e, gelecek hafta önerisini coach_note'a yaz.

Kullanıcı girdisi:
"""`;

const DAILY_LOG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          meal_type: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          meal_label: { type: 'STRING', nullable: true },
          food_name: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fats: { type: 'NUMBER' },
          portion_size: { type: 'STRING' }
        },
        required: ['food_name', 'calories']
      }
    },
    water_ml: { type: 'NUMBER', nullable: true },
    sleep: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        duration_hours: { type: 'NUMBER' },
        score: { type: 'NUMBER', nullable: true },
        bedtime: { type: 'STRING', nullable: true },
        night_wakes: { type: 'NUMBER', nullable: true }
      }
    },
    supplements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          dose: { type: 'STRING', nullable: true },
          time_of_day: { type: 'STRING', nullable: true }
        },
        required: ['name']
      }
    },
    workouts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['strength', 'cardio', 'walk', 'other'] },
          duration_min: { type: 'NUMBER', nullable: true },
          calories: { type: 'NUMBER', nullable: true },
          distance_km: { type: 'NUMBER', nullable: true },
          exercises: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                sets: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      weight_kg: { type: 'NUMBER', nullable: true },
                      reps: { type: 'NUMBER', nullable: true }
                    }
                  }
                },
                rating: { type: 'NUMBER', nullable: true },
                coach_note: { type: 'STRING', nullable: true }
              },
              required: ['name']
            }
          }
        },
        required: ['type']
      }
    },
    vitals: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        steps: { type: 'NUMBER', nullable: true },
        active_calories: { type: 'NUMBER', nullable: true },
        exercise_minutes: { type: 'NUMBER', nullable: true },
        stand_hours: { type: 'NUMBER', nullable: true },
        distance_km: { type: 'NUMBER', nullable: true }
      }
    },
    notes: { type: 'STRING', nullable: true }
  }
};

const buildRefinePrompt = (originalText, currentDraft, correctionNote) => `Az önce aşağıdaki kullanıcı girdisinden bir günlük sağlık/fitness taslağı (JSON) çıkardın. Kullanıcı şimdi bu taslakla ilgili bir düzeltme yazdı. Düzeltmeyi uygula ve GÜNCEL TAM JSON'u aynı şema ile tekrar döndür — kullanıcının bahsetmediği alanları olduğu gibi koru, sadece belirtilen kısmı değiştir.

Orijinal kullanıcı girdisi:
"""${originalText}"""

Mevcut taslak (JSON):
${JSON.stringify(currentDraft)}

Kullanıcının düzeltme isteği:
"""${correctionNote}"""`;

const MEAL_TYPE_LABELS = {
  breakfast: '🌅 Kahvaltı',
  lunch: '☀️ Öğle',
  dinner: '🌙 Akşam',
  snack: '🍎 Ara Öğün'
};

const AIDailyLog = ({ user, onSaved, driveAccessToken, onRequestDriveAccess }) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [lastAnalyzedContext, setLastAnalyzedContext] = useState(null);
  const [refineNote, setRefineNote] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name || '')) {
      setError('Lütfen geçerli bir resim dosyası seçin');
      return;
    }
    setError(null);
    try {
      const normalized = await normalizeImageFile(file);
      setSelectedImage(normalized);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(normalized);
    } catch (err) {
      setError('Fotoğraf işlenemedi: ' + err.message);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !selectedImage) {
      setError('Lütfen bir şeyler yazın veya ekran resmi ekleyin');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setDraft(null);
    setRetryStatus(null);

    try {
      const images = [];
      if (selectedImage) {
        images.push(await fileToBase64Image(selectedImage));
      }
      const analyzedText = inputText.trim() || '(sadece görsel)';
      const prompt = EXTRACT_PROMPT + analyzedText + '"""';
      const result = await callGeminiForJSON(prompt, images, DAILY_LOG_SCHEMA, (attempt, waitMs) => {
        setRetryStatus({ attempt, waitMs });
      });
      setRetryStatus(null);
      setDraft(result);
      setLastAnalyzedContext({ text: analyzedText, images });
    } catch (err) {
      setError(err.message || 'Analiz sırasında hata oluştu');
    } finally {
      setIsAnalyzing(false);
      setRetryStatus(null);
    }
  };

  const handleRefine = async () => {
    if (!refineNote.trim() || !draft || !lastAnalyzedContext) return;
    setIsRefining(true);
    setError(null);
    setRetryStatus(null);

    try {
      const prompt = buildRefinePrompt(lastAnalyzedContext.text, draft, refineNote.trim());
      const result = await callGeminiForJSON(prompt, lastAnalyzedContext.images, DAILY_LOG_SCHEMA, (attempt, waitMs) => {
        setRetryStatus({ attempt, waitMs });
      });
      setRetryStatus(null);
      setDraft(result);
      setRefineNote('');
    } catch (err) {
      setError(err.message || 'Düzeltme sırasında hata oluştu');
    } finally {
      setIsRefining(false);
      setRetryStatus(null);
    }
  };

  const removeDraftMeal = (index) => {
    setDraft({ ...draft, meals: draft.meals.filter((_, i) => i !== index) });
  };

  const removeDraftSupplement = (index) => {
    setDraft({ ...draft, supplements: draft.supplements.filter((_, i) => i !== index) });
  };

  const removeDraftWorkout = (index) => {
    setDraft({ ...draft, workouts: draft.workouts.filter((_, i) => i !== index) });
  };

  const clearDraftSection = (key) => {
    setDraft({ ...draft, [key]: null });
  };

  const handleSave = async () => {
    if (!user || !draft) return;

    // Mükerrer kayıt uyarısı - bu tarihte zaten öğün varsa kullanıcıya sor
    if (draft.meals && draft.meals.length > 0) {
      const summary = await getMealsSummary(user.uid, selectedDate);
      if (summary.count > 0) {
        const confirmed = window.confirm(
          `${selectedDate} için zaten ${summary.count} öğün kayıtlı (toplam ${summary.totalCalories} kcal). ` +
          `Bu ${draft.meals.length} yeni öğünü yine de eklemek istiyor musunuz? (Aynı günü daha önce zaten kaydettiyseniz "İptal"e basıp mevcut kayıtları kontrol edin.)`
        );
        if (!confirmed) return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Öğünler - mealsService üzerinden GÜNCEL listeye ekle (bayat state üzerine yazmaz)
      if (draft.meals && draft.meals.length > 0) {
        // Fotoğraf eklenmişse Drive'a yükle, meal(lar)a bağla - başarısız olursa öğün kaydı yine de devam etsin
        let driveFileId = null;
        if (selectedImage && driveAccessToken) {
          try {
            driveFileId = await uploadMealPhotoToDrive(
              driveAccessToken,
              selectedImage,
              `${selectedDate}_${Date.now()}.jpg`
            );
          } catch (photoErr) {
            console.error('Drive fotoğraf yükleme hatası:', photoErr);
          }
        }

        const newMeals = draft.meals.map((m) => ({
          name: m.food_name,
          calories: m.calories || 0,
          protein: m.protein || 0,
          carbs: m.carbs || 0,
          fats: m.fats || 0,
          portion: m.portion_size || '',
          mealType: m.meal_type || 'snack',
          mealLabel: m.meal_label || '',
          source: 'AI Günlük Giriş',
          ...(driveFileId ? { photoDriveId: driveFileId } : {})
        }));
        await addMeals(user.uid, selectedDate, newMeals);
      }

      // Su - mevcut su kayıtlarına ekle
      if (draft.water_ml) {
        const existing = await getWaterTracker(user.uid);
        const currentEntries = existing.success ? (existing.data.entries || []) : [];
        const currentGoal = existing.success ? (existing.data.dailyGoal || 2500) : 2500;
        const newEntry = {
          id: Date.now(),
          amount: parseInt(draft.water_ml, 10),
          date: selectedDate,
          timestamp: new Date().toISOString()
        };
        await saveWaterTracker(user.uid, [...currentEntries, newEntry], currentGoal);
      }

      // Uyku / takviye / antrenman / vitals / not - günlük log dokümanına yaz.
      // Diziler (supplements/workouts) MEVCUT kayıtla birleştirilir - Firestore merge:true
      // dizi alanlarını deep-merge etmediği için, birleştirmeyi burada elle yapıyoruz.
      const existingLog = (draft.sleep || draft.supplements?.length || draft.workouts?.length || draft.vitals || draft.notes)
        ? (await getDailyLog(user.uid, selectedDate)).data || {}
        : {};

      const logFields = {};
      if (draft.sleep) logFields.sleep = draft.sleep;
      if (draft.supplements && draft.supplements.length > 0) {
        logFields.supplements = [...(existingLog.supplements || []), ...draft.supplements];
      }
      if (draft.workouts && draft.workouts.length > 0) {
        logFields.workouts = [...(existingLog.workouts || []), ...draft.workouts];
      }
      if (draft.vitals) logFields.vitals = draft.vitals;
      if (draft.notes) logFields.notes = draft.notes;

      if (Object.keys(logFields).length > 0) {
        await saveDailyLog(user.uid, selectedDate, logFields);
      }

      setSavedMessage(true);
      setDraft(null);
      setInputText('');
      clearImage();
      if (onSaved) onSaved();
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (err) {
      setError(err.message || 'Kaydetme sırasında hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyDraftData = draft && (
    (draft.meals && draft.meals.length > 0) ||
    draft.water_ml ||
    draft.sleep ||
    (draft.supplements && draft.supplements.length > 0) ||
    (draft.workouts && draft.workouts.length > 0) ||
    draft.vitals ||
    draft.notes
  );

  const WORKOUT_TYPE_LABELS = {
    strength: '🏋️ Kuvvet Antrenmanı',
    cardio: '🏃 Kardiyo',
    walk: '🚶 Yürüyüş',
    other: '🤸 Aktivite'
  };

  if (!user) {
    return (
      <div className="ai-daily-log">
        <div className="ai-log-login-warning">
          ⚠️ AI Günlük Giriş için giriş yapmanız gerekiyor.
        </div>
      </div>
    );
  }

  return (
    <div className="ai-daily-log">
      <div className="ai-log-header">
        <h3>🤖 AI Günlük Giriş</h3>
        <p>Yaz veya ekran resmi at — yemek, su, uyku, takviye, antrenman... AI ayırıp kategorilere kaydeder.</p>
      </div>

      <GeminiQuotaBadge retryStatus={retryStatus} />

      <div className="ai-log-date">
        <label>Tarih</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <textarea
        className="ai-log-textarea"
        placeholder="Örn: Sabah D vitamini K2 Omega3 aldım, kahvaltıda 2 yumurta 2 dilim ekmek yedim. Ya da bir ekran resmi ekle (uyku, su, Hevy antrenman)."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={4}
        disabled={isAnalyzing}
      />

      <div className="ai-log-image-section">
        {!imagePreview ? (
          <label className="ai-log-image-upload">
            <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            📷 Ekran Resmi / Fotoğraf Ekle
          </label>
        ) : (
          <div className="ai-log-image-preview">
            <img src={imagePreview} alt="Seçilen" />
            <button type="button" onClick={clearImage}>❌ Kaldır</button>
            {!driveAccessToken && (
              <div className="ai-log-drive-hint">
                📷 Bu fotoğraf yemek galerisine kaydedilecek ama Drive bağlantın yok/süresi dolmuş.{' '}
                <button type="button" className="ai-log-drive-connect-btn" onClick={onRequestDriveAccess}>
                  Drive'a bağlan
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="ai-log-error">⚠️ {error}</div>}
      {savedMessage && <div className="ai-log-success">✅ Kaydedildi!</div>}

      <button
        className="ai-log-analyze-btn"
        onClick={handleAnalyze}
        disabled={isAnalyzing || (!inputText.trim() && !selectedImage)}
      >
        {isAnalyzing ? '🔄 Analiz ediliyor...' : '🤖 Analiz Et'}
      </button>

      {draft && (
        <div className="ai-log-draft">
          <h4>📋 Taslak — Kontrol Et ve Onayla</h4>

          {draft.meals && draft.meals.length > 0 && (
            <div className="draft-section">
              <h5>🍽️ Öğünler</h5>
              {draft.meals.map((m, i) => (
                <div key={i} className="draft-item">
                  <span>
                    {m.meal_label || MEAL_TYPE_LABELS[m.meal_type] || m.meal_type} — {m.food_name} ({Math.round(m.calories)} kcal
                    {m.protein ? `, P:${Math.round(m.protein)}g` : ''}
                    {m.carbs ? `, K:${Math.round(m.carbs)}g` : ''}
                    {m.fats ? `, Y:${Math.round(m.fats)}g` : ''})
                  </span>
                  <button onClick={() => removeDraftMeal(i)}>🗑️</button>
                </div>
              ))}
              <div className="draft-item draft-item-total">
                <strong>
                  Toplam: {Math.round(draft.meals.reduce((sum, m) => sum + (m.calories || 0), 0))} kcal
                  , P:{Math.round(draft.meals.reduce((sum, m) => sum + (m.protein || 0), 0))}g
                  , K:{Math.round(draft.meals.reduce((sum, m) => sum + (m.carbs || 0), 0))}g
                  , Y:{Math.round(draft.meals.reduce((sum, m) => sum + (m.fats || 0), 0))}g
                </strong>
              </div>
            </div>
          )}

          {draft.water_ml && (
            <div className="draft-section">
              <h5>💧 Su</h5>
              <div className="draft-item">
                <span>{draft.water_ml} ml</span>
                <button onClick={() => clearDraftSection('water_ml')}>🗑️</button>
              </div>
            </div>
          )}

          {draft.sleep && (
            <div className="draft-section">
              <h5>😴 Uyku</h5>
              <div className="draft-item">
                <span>
                  {draft.sleep.duration_hours} saat
                  {draft.sleep.score ? ` — Skor: ${draft.sleep.score}` : ''}
                  {draft.sleep.bedtime ? ` — Yatış: ${draft.sleep.bedtime}` : ''}
                  {draft.sleep.night_wakes ? ` — ${draft.sleep.night_wakes}x uyanma` : ''}
                </span>
                <button onClick={() => clearDraftSection('sleep')}>🗑️</button>
              </div>
            </div>
          )}

          {draft.supplements && draft.supplements.length > 0 && (
            <div className="draft-section">
              <h5>💊 Takviyeler</h5>
              {draft.supplements.map((s, i) => (
                <div key={i} className="draft-item">
                  <span>{s.name} {s.dose ? `(${s.dose})` : ''}</span>
                  <button onClick={() => removeDraftSupplement(i)}>🗑️</button>
                </div>
              ))}
            </div>
          )}

          {draft.workouts && draft.workouts.length > 0 && (
            <div className="draft-section">
              <h5>🏋️ Antrenman / Aktivite</h5>
              {draft.workouts.map((w, i) => (
                <div key={i} className="draft-item draft-item-workout">
                  <div className="draft-workout-summary">
                    <span>
                      {WORKOUT_TYPE_LABELS[w.type] || w.type}
                      {w.duration_min ? ` — ${w.duration_min} dk` : ''}
                      {w.distance_km ? ` — ${w.distance_km} km` : ''}
                      {w.calories ? ` — ${w.calories} kcal` : ''}
                    </span>
                    <button onClick={() => removeDraftWorkout(i)}>🗑️</button>
                  </div>
                  {w.exercises?.length > 0 && (
                    <ul className="draft-exercise-list">
                      {w.exercises.map((ex, j) => (
                        <li key={j}>
                          <strong>{ex.name}</strong>
                          {ex.sets?.length > 0 && ': ' + ex.sets.map((s) => `${s.weight_kg ?? '?'}×${s.reps ?? '?'}`).join(', ')}
                          {ex.rating ? ` ${'⭐'.repeat(Math.round(ex.rating))}` : ''}
                          {ex.coach_note ? <div className="draft-coach-note">💬 {ex.coach_note}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {draft.vitals && (
            <div className="draft-section">
              <h5>⌚ Apple Watch</h5>
              <div className="draft-item">
                <span>
                  {draft.vitals.steps ? `${draft.vitals.steps} adım` : ''}
                  {draft.vitals.active_calories ? ` — ${draft.vitals.active_calories} kcal` : ''}
                  {draft.vitals.exercise_minutes ? ` — ${draft.vitals.exercise_minutes} dk egzersiz` : ''}
                  {draft.vitals.stand_hours ? ` — ${draft.vitals.stand_hours} saat duruş` : ''}
                  {draft.vitals.distance_km ? ` — ${draft.vitals.distance_km} km` : ''}
                </span>
                <button onClick={() => clearDraftSection('vitals')}>🗑️</button>
              </div>
            </div>
          )}

          {draft.notes && (
            <div className="draft-section">
              <h5>📝 Not</h5>
              <div className="draft-item">
                <span>{draft.notes}</span>
                <button onClick={() => clearDraftSection('notes')}>🗑️</button>
              </div>
            </div>
          )}

          {!hasAnyDraftData && (
            <p className="ai-log-empty-draft">AI hiçbir kategori bulamadı. Daha açık yazmayı deneyin.</p>
          )}

          <div className="ai-log-refine">
            <label>✏️ Taslakta yanlış/eksik bir şey mi var?</label>
            <textarea
              className="ai-log-refine-textarea"
              placeholder="Örn: Spor sonrası öğün ayrı bir kategoriydi, ara öğünle karıştırma. Whey 3 porsiyon olacak, kreatin 5g eksik kalmış."
              value={refineNote}
              onChange={(e) => setRefineNote(e.target.value)}
              rows={2}
              disabled={isRefining}
            />
            <button
              type="button"
              className="ai-log-refine-btn"
              onClick={handleRefine}
              disabled={isRefining || !refineNote.trim()}
            >
              {isRefining ? '🔄 Düzeltiliyor...' : '✏️ Taslağı Düzelt'}
            </button>
          </div>

          {hasAnyDraftData && (
            <button className="ai-log-save-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? '💾 Kaydediliyor...' : '✅ Onayla ve Kaydet'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDailyLog;
