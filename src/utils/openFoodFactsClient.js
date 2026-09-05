const API_BASE = 'https://world.openfoodfacts.org';
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_tr',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'image_front_small_url',
  'nutriments',
  'nutrition_data_per',
  'nutriscore_grade'
].join(',');

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const firstNonEmpty = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() || '';

const getNutriment = (nutriments = {}, key, basis = '100g') =>
  toNumber(nutriments[`${key}_${basis}`]) ??
  toNumber(nutriments[key]) ??
  0;

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((toNumber(value) || 0) * factor) / factor;
};

const scaleNutrition = (nutrition, grams) => {
  const factor = grams / 100;
  return {
    calories: Math.round(nutrition.caloriesPer100g * factor),
    protein: round(nutrition.proteinPer100g * factor),
    carbs: round(nutrition.carbsPer100g * factor),
    fats: round(nutrition.fatsPer100g * factor),
    fiber: round(nutrition.fiberPer100g * factor),
    sugars: round(nutrition.sugarsPer100g * factor),
    sodium: round(nutrition.sodiumPer100g * factor, 3),
    saturatedFat: round(nutrition.saturatedFatPer100g * factor)
  };
};

export const normalizeOpenFoodFactsProduct = (product) => {
  const nutriments = product?.nutriments || {};
  const name = firstNonEmpty(product?.product_name_tr, product?.product_name, product?.product_name_en, product?.generic_name);
  const servingGrams = toNumber(product?.serving_quantity);
  const nutrition = {
    caloriesPer100g: getNutriment(nutriments, 'energy-kcal'),
    proteinPer100g: getNutriment(nutriments, 'proteins'),
    carbsPer100g: getNutriment(nutriments, 'carbohydrates'),
    fatsPer100g: getNutriment(nutriments, 'fat'),
    fiberPer100g: getNutriment(nutriments, 'fiber'),
    sugarsPer100g: getNutriment(nutriments, 'sugars'),
    sodiumPer100g: getNutriment(nutriments, 'sodium'),
    saturatedFatPer100g: getNutriment(nutriments, 'saturated-fat')
  };

  return {
    code: product?.code || '',
    name: name || 'İsimsiz ürün',
    brand: firstNonEmpty(product?.brands),
    quantity: firstNonEmpty(product?.quantity),
    servingSize: firstNonEmpty(product?.serving_size),
    servingGrams,
    imageUrl: product?.image_front_small_url || '',
    nutriscore: product?.nutriscore_grade || '',
    nutrition,
    defaultGrams: servingGrams || 100,
    toMeal(quantityGrams = servingGrams || 100, mealType = 'snack') {
      const grams = Math.max(1, toNumber(quantityGrams) || servingGrams || 100);
      const scaled = scaleNutrition(nutrition, grams);
      return {
        name: this.brand ? `${this.name} - ${this.brand}` : this.name,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fats: scaled.fats,
        portion: `${grams} g`,
        mealType,
        source: 'Open Food Facts',
        sourceDetails: {
          provider: 'openfoodfacts',
          code: this.code,
          per100g: nutrition,
          quantity: this.quantity,
          servingSize: this.servingSize,
          nutriscore: this.nutriscore
        },
        micronutrients: {
          fiber: scaled.fiber,
          sugars: scaled.sugars,
          sodium: scaled.sodium,
          saturatedFat: scaled.saturatedFat
        }
      };
    }
  };
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Open Food Facts isteği başarısız oldu.');
  }
  return response.json();
};

export const getProductByBarcode = async (barcode) => {
  const code = String(barcode || '').replace(/\D/g, '');
  if (code.length < 6) {
    throw new Error('Barkod en az 6 rakam olmalı.');
  }

  const params = new URLSearchParams({ fields: PRODUCT_FIELDS });
  const data = await fetchJson(`${API_BASE}/api/v3/product/${code}?${params.toString()}`);
  const product = data.product || data.products?.[0];
  if (!product) {
    throw new Error('Bu barkod Open Food Facts içinde bulunamadı.');
  }
  return normalizeOpenFoodFactsProduct(product);
};

export const searchProducts = async (query, { pageSize = 8 } = {}) => {
  const term = String(query || '').trim();
  if (term.length < 2) {
    throw new Error('Arama için en az 2 karakter yazın.');
  }

  const params = new URLSearchParams({
    search_terms: term,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    fields: PRODUCT_FIELDS
  });
  const data = await fetchJson(`${API_BASE}/cgi/search.pl?${params.toString()}`);
  return (data.products || [])
    .map(normalizeOpenFoodFactsProduct)
    .filter((product) => product.name && product.nutrition.caloriesPer100g > 0);
};

export const findProducts = async (input) => {
  const value = String(input || '').trim();
  if (/^\d{6,}$/.test(value)) {
    return [await getProductByBarcode(value)];
  }
  return searchProducts(value);
};
