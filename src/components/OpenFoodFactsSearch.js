import React, { useState } from 'react';
import './OpenFoodFactsSearch.css';
import { findProducts } from '../utils/openFoodFactsClient';
import { validateMealNutrition, isBlocking } from '../utils/entryValidation';

const MEAL_TYPES = {
  breakfast: 'Kahvaltı',
  lunch: 'Öğle',
  dinner: 'Akşam',
  snack: 'Atıştırmalık'
};

const OpenFoodFactsSearch = ({ onAddProduct, disabled }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quantityGrams, setQuantityGrams] = useState(100);
  const [mealType, setMealType] = useState('snack');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError('');
    setSelected(null);
    try {
      const results = await findProducts(query);
      setProducts(results);
      if (results.length === 0) {
        setError('Ürün bulunamadı. Daha genel bir isim veya barkod deneyin.');
      }
    } catch (err) {
      setProducts([]);
      setError(err.message || 'Ürün aranırken hata oluştu.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (product) => {
    setSelected(product);
    setQuantityGrams(product.defaultGrams || 100);
  };

  // OFF verisi topluluk katkısıyla dolduruluyor; tutarsız etiketler öğüne yazılmasın.
  const previewMeal = selected ? selected.toMeal(quantityGrams, mealType) : null;
  const previewCheck = previewMeal ? validateMealNutrition({ ...previewMeal, name: selected.name }) : null;

  const handleAdd = () => {
    if (!selected) return;
    if (previewCheck && isBlocking(previewCheck)) {
      setError(previewCheck.message);
      return;
    }
    onAddProduct(selected.toMeal(quantityGrams, mealType));
    setSelected(null);
    setProducts([]);
    setQuery('');
  };

  return (
    <div className="off-search">
      <div className="off-search-head">
        <div>
          <h4>Open Food Facts Ürün Arama</h4>
          <p>Ürün adı veya barkod girerek doğrulanabilir etiket verisini öğüne ekle.</p>
        </div>
        <span>OFF</span>
      </div>

      <div className="off-search-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="Barkod veya ürün adı: yoğurt, protein bar..."
          disabled={disabled || isSearching}
        />
        <button onClick={handleSearch} disabled={disabled || isSearching || query.trim().length < 2}>
          {isSearching ? 'Aranıyor...' : 'Ara'}
        </button>
      </div>

      {error && <div className="off-error">{error}</div>}

      {products.length > 0 && !selected && (
        <div className="off-results">
          {products.map((product) => (
            <button key={product.code || product.name} className="off-product" onClick={() => handleSelect(product)}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="off-product-placeholder">OFF</div>}
              <div>
                <strong>{product.name}</strong>
                <span>{[product.brand, product.quantity].filter(Boolean).join(' · ') || 'Marka bilgisi yok'}</span>
                <small>
                  {Math.round(product.nutrition.caloriesPer100g)} kcal · P {Math.round(product.nutrition.proteinPer100g)}g · C {Math.round(product.nutrition.carbsPer100g)}g · F {Math.round(product.nutrition.fatsPer100g)}g / 100g
                </small>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="off-selected">
          <div className="off-selected-title">
            <strong>{selected.name}</strong>
            <button onClick={() => setSelected(null)}>Değiştir</button>
          </div>
          <div className="off-selected-grid">
            <label>
              Gram
              <input
                type="number"
                min="1"
                value={quantityGrams}
                onChange={(e) => setQuantityGrams(e.target.value)}
              />
            </label>
            <label>
              Öğün
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {Object.entries(MEAL_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="off-selected-summary">
            {previewMeal
              ? `${previewMeal.calories} kcal · ${previewMeal.protein}g protein · ${previewMeal.carbs}g karbonhidrat · ${previewMeal.fats}g yağ`
              : ''}
          </div>
          {previewCheck && previewCheck.level !== 'ok' && (
            <div className={`off-validation ${previewCheck.level}`} role="alert">
              {previewCheck.level === 'error' ? '⛔' : '⚠️'} {previewCheck.message}
            </div>
          )}
          <button
            className="off-add-btn"
            onClick={handleAdd}
            disabled={disabled || (previewCheck ? isBlocking(previewCheck) : false)}
          >
            Öğüne Ekle
          </button>
        </div>
      )}
    </div>
  );
};

export default OpenFoodFactsSearch;
