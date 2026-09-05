export const FOOD_CATEGORIES = [
  { key: 'protein', label: 'Protein' },
  { key: 'carb', label: 'Karbonhidrat' },
  { key: 'vegetable', label: 'Sebze' },
  { key: 'fruit', label: 'Meyve' },
  { key: 'fat', label: 'Yağ' },
  { key: 'restaurant', label: 'Dışarıda' },
  { key: 'other', label: 'Diğer' }
];

export const FOOD_LIBRARY = [
  { id: 'chicken-breast-raw', name: 'Tavuk göğüs çiğ', category: 'protein', unit: 'g', defaultAmount: 180, calories: 120, protein: 23, carbs: 0, fats: 2.6, fiber: 0 },
  { id: 'turkey-breast-raw', name: 'Hindi göğüs çiğ', category: 'protein', unit: 'g', defaultAmount: 180, calories: 115, protein: 24, carbs: 0, fats: 1.5, fiber: 0 },
  { id: 'turkey-smoked', name: 'Hindi füme', category: 'protein', unit: 'g', defaultAmount: 60, calories: 105, protein: 18, carbs: 2, fats: 2, fiber: 0 },
  { id: 'beef-mince-raw', name: 'Dana kıyma çiğ', category: 'protein', unit: 'g', defaultAmount: 150, calories: 250, protein: 17.2, carbs: 0, fats: 20, fiber: 0 },
  { id: 'lean-beef-mince-raw', name: 'Yağsız dana köfte çiğ', category: 'protein', unit: 'g', defaultAmount: 180, calories: 170, protein: 21, carbs: 0, fats: 9, fiber: 0 },
  { id: 'meatball-cooked', name: 'Köfte pişmiş', category: 'protein', unit: 'g', defaultAmount: 120, calories: 260, protein: 18, carbs: 5, fats: 18, fiber: 0 },
  { id: 'beef-steak-raw', name: 'Dana et / biftek çiğ', category: 'protein', unit: 'g', defaultAmount: 180, calories: 180, protein: 20, carbs: 0, fats: 10, fiber: 0 },
  { id: 'salmon-raw', name: 'Somon çiğ', category: 'protein', unit: 'g', defaultAmount: 165, calories: 208, protein: 20, carbs: 0, fats: 13, fiber: 0 },
  { id: 'sea-bass-raw', name: 'Levrek çiğ', category: 'protein', unit: 'g', defaultAmount: 200, calories: 124, protein: 23.6, carbs: 0, fats: 2.6, fiber: 0 },
  { id: 'chicken-schnitzel', name: 'Tavuk şinitzel', category: 'protein', unit: 'g', defaultAmount: 150, calories: 270, protein: 16, carbs: 18, fats: 15, fiber: 1 },
  { id: 'egg', name: 'Yumurta', category: 'protein', unit: 'g', defaultAmount: 50, calories: 143, protein: 12.6, carbs: 0.7, fats: 9.5, fiber: 0 },
  { id: 'egg-white', name: 'Yumurta beyazı', category: 'protein', unit: 'g', defaultAmount: 100, calories: 52, protein: 10.9, carbs: 0.7, fats: 0.2, fiber: 0 },
  { id: 'white-cheese', name: 'Beyaz peynir', category: 'protein', unit: 'g', defaultAmount: 40, calories: 265, protein: 14, carbs: 4, fats: 21, fiber: 0 },
  { id: 'curd-cheese', name: 'Lor peyniri', category: 'protein', unit: 'g', defaultAmount: 100, calories: 98, protein: 11, carbs: 3.4, fats: 4.3, fiber: 0 },
  { id: 'cottage-cheese', name: 'Süzme / cottage peynir', category: 'protein', unit: 'g', defaultAmount: 100, calories: 98, protein: 11.1, carbs: 3.4, fats: 4.3, fiber: 0 },
  { id: 'yogurt-plain', name: 'Yoğurt sade', category: 'protein', unit: 'g', defaultAmount: 200, calories: 61, protein: 3.5, carbs: 4.7, fats: 3.3, fiber: 0 },
  { id: 'strained-yogurt', name: 'Süzme yoğurt', category: 'protein', unit: 'g', defaultAmount: 150, calories: 95, protein: 7.5, carbs: 4, fats: 5, fiber: 0 },
  { id: 'quark', name: 'Quark', category: 'protein', unit: 'g', defaultAmount: 200, calories: 67, protein: 12, carbs: 4, fats: 0.3, fiber: 0 },
  { id: 'whey', name: 'Whey protein', category: 'protein', unit: 'g', defaultAmount: 15, calories: 400, protein: 80, carbs: 8, fats: 6, fiber: 0 },

  { id: 'basmati-rice-raw', name: 'Basmati pirinci çiğ', category: 'carb', unit: 'g', defaultAmount: 30, calories: 360, protein: 7, carbs: 78, fats: 0.7, fiber: 1.3 },
  { id: 'potato', name: 'Patates', category: 'carb', unit: 'g', defaultAmount: 100, calories: 77, protein: 2, carbs: 17, fats: 0.1, fiber: 2.2 },
  { id: 'sweet-potato', name: 'Tatlı patates', category: 'carb', unit: 'g', defaultAmount: 100, calories: 86, protein: 1.6, carbs: 20, fats: 0.1, fiber: 3 },
  { id: 'oats', name: 'Yulaf', category: 'carb', unit: 'g', defaultAmount: 30, calories: 389, protein: 16.9, carbs: 66.3, fats: 6.9, fiber: 10.6 },
  { id: 'whole-wheat-bread', name: 'Tam buğday ekmeği', category: 'carb', unit: 'g', defaultAmount: 30, calories: 247, protein: 13, carbs: 41, fats: 4.2, fiber: 7 },
  { id: 'lavash', name: 'Lavaş', category: 'carb', unit: 'g', defaultAmount: 60, calories: 275, protein: 8.5, carbs: 52, fats: 3.5, fiber: 2.5 },
  { id: 'bulgur-raw', name: 'Bulgur çiğ', category: 'carb', unit: 'g', defaultAmount: 40, calories: 342, protein: 12.3, carbs: 75.9, fats: 1.3, fiber: 12.5 },
  { id: 'chickpeas-cooked', name: 'Nohut pişmiş', category: 'carb', unit: 'g', defaultAmount: 150, calories: 164, protein: 8.9, carbs: 27.4, fats: 2.6, fiber: 7.6 },
  { id: 'white-beans-cooked', name: 'Kuru fasulye pişmiş', category: 'carb', unit: 'g', defaultAmount: 150, calories: 140, protein: 8.2, carbs: 25, fats: 0.6, fiber: 6.3 },
  { id: 'lentils-cooked', name: 'Mercimek pişmiş', category: 'carb', unit: 'g', defaultAmount: 150, calories: 116, protein: 9, carbs: 20.1, fats: 0.4, fiber: 7.9 },
  { id: 'green-peas-cooked', name: 'Bezelye pişmiş', category: 'carb', unit: 'g', defaultAmount: 150, calories: 84, protein: 5.4, carbs: 15.6, fats: 0.4, fiber: 5.5 },

  { id: 'mixed-salad', name: 'Salata karışık', category: 'vegetable', unit: 'g', defaultAmount: 250, calories: 20, protein: 1.2, carbs: 3.5, fats: 0.2, fiber: 1.8 },
  { id: 'tomato', name: 'Domates', category: 'vegetable', unit: 'g', defaultAmount: 100, calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, fiber: 1.2 },
  { id: 'cucumber', name: 'Salatalık', category: 'vegetable', unit: 'g', defaultAmount: 100, calories: 15, protein: 0.7, carbs: 3.6, fats: 0.1, fiber: 0.5 },
  { id: 'lettuce', name: 'Marul', category: 'vegetable', unit: 'g', defaultAmount: 80, calories: 15, protein: 1.4, carbs: 2.9, fats: 0.2, fiber: 1.3 },
  { id: 'red-pepper', name: 'Kırmızı biber', category: 'vegetable', unit: 'g', defaultAmount: 80, calories: 31, protein: 1, carbs: 6, fats: 0.3, fiber: 2.1 },
  { id: 'green-pepper', name: 'Yeşil biber', category: 'vegetable', unit: 'g', defaultAmount: 60, calories: 20, protein: 0.9, carbs: 4.6, fats: 0.2, fiber: 1.7 },
  { id: 'onion', name: 'Soğan', category: 'vegetable', unit: 'g', defaultAmount: 50, calories: 40, protein: 1.1, carbs: 9.3, fats: 0.1, fiber: 1.7 },
  { id: 'garlic', name: 'Sarımsak', category: 'vegetable', unit: 'g', defaultAmount: 5, calories: 149, protein: 6.4, carbs: 33.1, fats: 0.5, fiber: 2.1 },
  { id: 'parsley', name: 'Maydanoz', category: 'vegetable', unit: 'g', defaultAmount: 10, calories: 36, protein: 3, carbs: 6.3, fats: 0.8, fiber: 3.3 },
  { id: 'dill', name: 'Dereotu', category: 'vegetable', unit: 'g', defaultAmount: 10, calories: 43, protein: 3.5, carbs: 7, fats: 1.1, fiber: 2.1 },
  { id: 'red-cabbage', name: 'Mor lahana', category: 'vegetable', unit: 'g', defaultAmount: 80, calories: 31, protein: 1.4, carbs: 7.4, fats: 0.2, fiber: 2.1 },
  { id: 'zucchini', name: 'Kabak', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 17, protein: 1.2, carbs: 3.1, fats: 0.3, fiber: 1 },
  { id: 'eggplant', name: 'Patlıcan', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 25, protein: 1, carbs: 5.9, fats: 0.2, fiber: 3 },
  { id: 'broccoli', name: 'Brokoli', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 34, protein: 2.8, carbs: 6.6, fats: 0.4, fiber: 2.6 },
  { id: 'carrot', name: 'Havuç', category: 'vegetable', unit: 'g', defaultAmount: 100, calories: 41, protein: 0.9, carbs: 9.6, fats: 0.2, fiber: 2.8 },
  { id: 'mushroom', name: 'Mantar', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, fiber: 1 },
  { id: 'spinach', name: 'Ispanak', category: 'vegetable', unit: 'g', defaultAmount: 100, calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2 },
  { id: 'okra', name: 'Bamya', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 33, protein: 1.9, carbs: 7.5, fats: 0.2, fiber: 3.2 },
  { id: 'green-beans', name: 'Taze fasulye', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 31, protein: 1.8, carbs: 7, fats: 0.2, fiber: 3.4 },
  { id: 'cauliflower', name: 'Karnabahar', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 25, protein: 1.9, carbs: 5, fats: 0.3, fiber: 2 },
  { id: 'leek', name: 'Pırasa', category: 'vegetable', unit: 'g', defaultAmount: 150, calories: 61, protein: 1.5, carbs: 14.2, fats: 0.3, fiber: 1.8 },

  { id: 'apricot', name: 'Kayısı', category: 'fruit', unit: 'g', defaultAmount: 105, calories: 48, protein: 1.4, carbs: 11, fats: 0.4, fiber: 2 },
  { id: 'cherry', name: 'Kiraz', category: 'fruit', unit: 'g', defaultAmount: 100, calories: 63, protein: 1.1, carbs: 16, fats: 0.2, fiber: 2.1 },
  { id: 'watermelon', name: 'Karpuz', category: 'fruit', unit: 'g', defaultAmount: 250, calories: 30, protein: 0.6, carbs: 7.6, fats: 0.2, fiber: 0.4 },
  { id: 'apple-small', name: 'Elma küçük', category: 'fruit', unit: 'g', defaultAmount: 130, calories: 52, protein: 0.3, carbs: 14, fats: 0.2, fiber: 2.4 },
  { id: 'peach-small', name: 'Şeftali küçük', category: 'fruit', unit: 'g', defaultAmount: 130, calories: 39, protein: 0.9, carbs: 9.5, fats: 0.3, fiber: 1.5 },
  { id: 'banana', name: 'Muz', category: 'fruit', unit: 'g', defaultAmount: 120, calories: 89, protein: 1.1, carbs: 22.8, fats: 0.3, fiber: 2.6 },
  { id: 'strawberry-frozen', name: 'Çilek dondurulmuş', category: 'fruit', unit: 'g', defaultAmount: 100, calories: 35, protein: 0.4, carbs: 9, fats: 0.1, fiber: 2 },
  { id: 'berry-mix-frozen', name: 'Orman meyvesi dondurulmuş', category: 'fruit', unit: 'g', defaultAmount: 100, calories: 50, protein: 0.8, carbs: 12, fats: 0.3, fiber: 4 },

  { id: 'olive-oil', name: 'Zeytinyağı', category: 'fat', unit: 'g', defaultAmount: 5, calories: 884, protein: 0, carbs: 0, fats: 100, fiber: 0 },
  { id: 'olive', name: 'Zeytin', category: 'fat', unit: 'g', defaultAmount: 30, calories: 145, protein: 1, carbs: 3.8, fats: 15.3, fiber: 3.3 },
  { id: 'tahini', name: 'Tahin', category: 'fat', unit: 'g', defaultAmount: 15, calories: 595, protein: 17, carbs: 21, fats: 54, fiber: 9.3 },
  { id: 'avocado', name: 'Avokado', category: 'fat', unit: 'g', defaultAmount: 70, calories: 160, protein: 2, carbs: 8.5, fats: 14.7, fiber: 6.7 },
  { id: 'walnut', name: 'Ceviz', category: 'fat', unit: 'g', defaultAmount: 10, calories: 654, protein: 15.2, carbs: 13.7, fats: 65.2, fiber: 6.7 },
  { id: 'hazelnut', name: 'Fındık', category: 'fat', unit: 'g', defaultAmount: 15, calories: 628, protein: 15, carbs: 17, fats: 61, fiber: 9.7 },
  { id: 'peanut-butter', name: 'Fındık/fıstık ezmesi', category: 'fat', unit: 'g', defaultAmount: 15, calories: 588, protein: 25, carbs: 20, fats: 50, fiber: 6 },

  { id: 'td-baharatlim', name: 'Tavuk Dünyası Baharatlım', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 770.8, protein: 59.6, carbs: 57.6, fats: 20.7, fiber: 7.5, source: 'Tavuk Dünyası' },
  { id: 'td-barbekus', name: 'Tavuk Dünyası Barbeküs', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 802.3, protein: 52.3, carbs: 63.3, fats: 22.4, fiber: 7.3, source: 'Tavuk Dünyası' },
  { id: 'td-cafe-de-paris', name: 'Tavuk Dünyası Cafe de Paris Soslu Tavuk', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 845.2, protein: 58.3, carbs: 58.8, fats: 27, fiber: 6.8, source: 'Tavuk Dünyası' },
  { id: 'td-fulful', name: 'Tavuk Dünyası Fülfül', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 838, protein: 55.8, carbs: 54.8, fats: 28.6, fiber: 5.5, source: 'Tavuk Dünyası' },
  { id: 'td-tavuk-teriyaki', name: 'Tavuk Dünyası Tavuk Teriyaki', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 842.5, protein: 61.1, carbs: 55.7, fats: 32.1, fiber: 9.2, source: 'Tavuk Dünyası' },
  { id: 'td-kendini-begenmis', name: 'Tavuk Dünyası Kendini Beğenmiş Tavuk', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 993.7, protein: 61.5, carbs: 59.4, fats: 38.1, fiber: 7.1, source: 'Tavuk Dünyası' },
  { id: 'td-alinazik-tavuk', name: 'Tavuk Dünyası Alinazik Tavuk', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 795.7, protein: 50.2, carbs: 58.4, fats: 24.6, fiber: 8.3, source: 'Tavuk Dünyası' },
  { id: 'td-truflu-tavuk', name: 'Tavuk Dünyası Trüflü Tavuk', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 872.6, protein: 59.7, carbs: 77.1, fats: 26.6, fiber: 8.7, source: 'Tavuk Dünyası' },
  { id: 'td-kozluce', name: 'Tavuk Dünyası Közlüce', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 781.4, protein: 57.7, carbs: 54.9, fats: 24, fiber: 8.6, source: 'Tavuk Dünyası' },
  { id: 'td-mangal-kofte', name: 'Tavuk Dünyası Mangal Köfte', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 808.2, protein: 25.2, carbs: 66.9, fats: 28.6, fiber: 6.4, source: 'Tavuk Dünyası' },
  { id: 'td-sefin-salatasi', name: 'Tavuk Dünyası Şefin Salatası', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 423.9, protein: 33.4, carbs: 11.7, fats: 20.1, fiber: 5, source: 'Tavuk Dünyası' },
  { id: 'td-citir-tavuklum-salata', name: 'Tavuk Dünyası Çıtır Tavuklum Salata', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 485.7, protein: 37.7, carbs: 25, fats: 17.7, fiber: 4.7, source: 'Tavuk Dünyası' },
  { id: 'td-humuslu-falafel-salata', name: 'Tavuk Dünyası Humuslu Falafel Salata', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 804.1, protein: 24.4, carbs: 62.1, fats: 46.7, fiber: 18.1, source: 'Tavuk Dünyası' },

  { id: 'bk-whopper', name: 'Burger King Whopper', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 764.66, protein: 30.38, carbs: 58.1, fats: 65.7, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-hamburger', name: 'Burger King Hamburger', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 245.61, protein: 10.61, carbs: 28.88, fats: 14.93, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-cheeseburger', name: 'Burger King Cheeseburger', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 292.04, protein: 13.1, carbs: 29.96, fats: 20.81, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-kofteburger', name: 'Burger King Köfteburger', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 357.7, protein: 12, carbs: 29, fats: 21.7, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-tavukburger', name: 'Burger King Tavukburger', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 436.18, protein: 15.63, carbs: 34.39, fats: 30.27, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-king-chicken', name: 'Burger King King Chicken', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 490.53, protein: 18.97, carbs: 39.97, fats: 32.98, fiber: 0, source: 'Burger King Türkiye' },
  { id: 'bk-orta-patates', name: 'Burger King Orta Boy Patates', category: 'restaurant', unit: 'porsiyon', defaultAmount: 1, servingBased: true, calories: 334.81, protein: 3.78, carbs: 46.85, fats: 14.7, fiber: 0, source: 'Burger King Türkiye' }
];

const roundMacro = (value) => Math.round((value || 0) * 10) / 10;

export const getFoodById = (foodId) => FOOD_LIBRARY.find((food) => food.id === foodId) || null;

export const calculateFoodItem = (item) => {
  const food = getFoodById(item.foodId);
  const amount = parseFloat(item.amount) || 0;
  if (!food || amount <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
  }
  const factor = food.servingBased ? amount : amount / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: roundMacro(food.protein * factor),
    carbs: roundMacro(food.carbs * factor),
    fats: roundMacro(food.fats * factor),
    fiber: roundMacro((food.fiber || 0) * factor)
  };
};

export const calculateFoodItemsTotal = (items = []) =>
  items.reduce((total, item) => {
    const values = calculateFoodItem(item);
    return {
      calories: total.calories + values.calories,
      protein: roundMacro(total.protein + values.protein),
      carbs: roundMacro(total.carbs + values.carbs),
      fats: roundMacro(total.fats + values.fats),
      fiber: roundMacro(total.fiber + values.fiber)
    };
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

export const describeFoodItems = (items = []) =>
  items
    .map((item) => {
      const food = getFoodById(item.foodId);
      if (!food) return null;
      return `${item.amount || food.defaultAmount} ${food.unit} ${food.name}`;
    })
    .filter(Boolean)
    .join(' + ');
