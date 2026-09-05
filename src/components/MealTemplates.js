import React, { useEffect, useMemo, useState } from 'react';
import './MealTemplates.css';
import { deleteMealTemplate, getMealTemplates, getRecentMeals, replaceMealTemplates, saveMealTemplate } from '../firebase/mealsService';
import { getScopedJson, setScopedJson } from '../utils/userScopedStorage';
import { FOOD_CATEGORIES, FOOD_LIBRARY, calculateFoodItem, calculateFoodItemsTotal, describeFoodItems, getFoodById } from '../data/foodLibrary';

const EMINE_EMAIL = 'emineay12@gmail.com';
const EMPTY_TEMPLATE = {
  name: '',
  mealType: 'breakfast',
  mealLabel: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  portion: '',
  items: []
};

const EMPTY_ITEM = { foodId: 'chicken-breast-raw', amount: 180 };

const MEAL_TYPES = [
  { key: 'all', label: 'Tümü' },
  { key: 'breakfast', label: 'Kahvaltı' },
  { key: 'lunch', label: 'Öğle' },
  { key: 'dinner', label: 'Akşam' },
  { key: 'snack', label: 'Ara' }
];

const EMINE_INITIAL_TEMPLATES = [
  {
    id: 'emine-kahvalti-quark-yulaf',
    name: 'Quark + Yulaf',
    mealType: 'breakfast',
    mealLabel: 'Kahvaltı',
    calories: 320,
    protein: 35,
    carbs: 28,
    fats: 8,
    portion: '200 g quark + 25 g yulaf + tarçın + 5-10 g ceviz',
    items: [
      { foodId: 'quark', amount: 200 },
      { foodId: 'oats', amount: 25 },
      { foodId: 'walnut', amount: 8 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-kahvalti-yogurt-whey',
    name: 'Yoğurt + Whey',
    mealType: 'breakfast',
    mealLabel: 'Kahvaltı',
    calories: 300,
    protein: 32,
    carbs: 22,
    fats: 7,
    portion: '200 g yoğurt + 1/2 ölçek whey + 1 küçük meyve',
    items: [
      { foodId: 'yogurt-plain', amount: 200 },
      { foodId: 'whey', amount: 15 },
      { foodId: 'apple-small', amount: 130 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-ara-meyve',
    name: 'Meyve Ara Öğün',
    mealType: 'snack',
    mealLabel: 'Ara Öğün',
    calories: 80,
    protein: 1,
    carbs: 18,
    fats: 0,
    portion: '1 küçük elma/şeftali veya 3 kayısı veya 10-15 kiraz',
    items: [
      { foodId: 'apple-small', amount: 130 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-ara-protein',
    name: 'Protein Desteği',
    mealType: 'snack',
    mealLabel: 'Ara Öğün',
    calories: 110,
    protein: 17,
    carbs: 7,
    fats: 1,
    portion: '150 g yoğurt veya 1/2 ölçek whey',
    items: [
      { foodId: 'yogurt-plain', amount: 150 },
      { foodId: 'whey', amount: 15 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-aksam-tavuk-basmati',
    name: 'Tavuk + Basmati',
    mealType: 'dinner',
    mealLabel: 'Akşam',
    calories: 620,
    protein: 58,
    carbs: 38,
    fats: 20,
    portion: '180 g çiğ tavuk + 30 g çiğ basmati + 250 g salata + 150 g sebze + 1 tk zeytinyağı',
    items: [
      { foodId: 'chicken-breast-raw', amount: 180 },
      { foodId: 'basmati-rice-raw', amount: 30 },
      { foodId: 'mixed-salad', amount: 250 },
      { foodId: 'zucchini', amount: 150 },
      { foodId: 'olive-oil', amount: 5 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-aksam-kofte-patates',
    name: 'Köfte + Patates',
    mealType: 'dinner',
    mealLabel: 'Akşam',
    calories: 640,
    protein: 55,
    carbs: 34,
    fats: 24,
    portion: '170-180 g çiğ yağsız dana köfte + 100 g patates + 250 g salata + 150 g sebze',
    items: [
      { foodId: 'lean-beef-mince-raw', amount: 180 },
      { foodId: 'potato', amount: 100 },
      { foodId: 'mixed-salad', amount: 250 },
      { foodId: 'eggplant', amount: 150 }
    ],
    source: 'Plan Şablonu'
  },
  {
    id: 'emine-aksam-somon-sebze',
    name: 'Somon + Sebze',
    mealType: 'dinner',
    mealLabel: 'Akşam',
    calories: 650,
    protein: 46,
    carbs: 28,
    fats: 34,
    portion: '160-170 g somon + 80-100 g tatlı patates + 250 g salata + 150 g brokoli',
    items: [
      { foodId: 'salmon-raw', amount: 165 },
      { foodId: 'sweet-potato', amount: 100 },
      { foodId: 'mixed-salad', amount: 250 },
      { foodId: 'broccoli', amount: 150 }
    ],
    source: 'Plan Şablonu'
  }
];

const sanitizeItems = (items = []) => items
  .filter((item) => getFoodById(item.foodId) && parseFloat(item.amount) > 0)
  .map((item) => ({ foodId: item.foodId, amount: parseFloat(item.amount) }));

const toTemplatePayload = (form) => {
  const items = sanitizeItems(form.items);
  const totals = items.length > 0 ? calculateFoodItemsTotal(items) : null;
  const portion = form.portion || (items.length > 0 ? describeFoodItems(items) : '');
  return {
    ...form,
    items: items.length > 0 ? items : null,
    calories: totals ? totals.calories : parseFloat(form.calories) || 0,
    protein: totals ? totals.protein : parseFloat(form.protein) || 0,
    carbs: totals ? totals.carbs : parseFloat(form.carbs) || 0,
    fats: totals ? totals.fats : parseFloat(form.fats) || 0,
    micronutrients: totals ? { fiber: totals.fiber } : form.micronutrients || null,
    portion,
    mealLabel: form.mealLabel || MEAL_TYPES.find((type) => type.key === form.mealType)?.label || '',
    source: items.length > 0 ? 'Besin Kütüphanesi' : 'Şablon'
  };
};

const mergeLibraryItemsIntoInitialTemplates = (templates) => {
  const initialById = new Map(EMINE_INITIAL_TEMPLATES.map((template) => [template.id, template]));
  return templates.map((template) => {
    const initial = initialById.get(template.id);
    if (!initial || (Array.isArray(template.items) && template.items.length > 0)) return template;
    const totals = calculateFoodItemsTotal(initial.items || []);
    return {
      ...template,
      items: initial.items || null,
      calories: totals.calories || template.calories,
      protein: totals.protein || template.protein,
      carbs: totals.carbs || template.carbs,
      fats: totals.fats || template.fats,
      micronutrients: totals.fiber ? { ...(template.micronutrients || {}), fiber: totals.fiber } : template.micronutrients,
      source: 'Besin Kütüphanesi',
      updatedAt: new Date().toISOString()
    };
  });
};

const MealTemplates = ({ user, meals = [], onUseTemplate, disabled }) => {
  const [templates, setTemplates] = useState([]);
  const [recentMeals, setRecentMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMealId, setSaveMealId] = useState('');
  const [saveMealSearch, setSaveMealSearch] = useState('');
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);

  const isEmine = (user?.email || '').toLowerCase() === EMINE_EMAIL;

  const loadTemplates = async () => {
    setIsLoading(true);
    setError('');
    try {
      let data = await getMealTemplates(user?.uid);
      const seeded = getScopedJson('meal_templates_seeded_v2', user?.uid, false);
      if (isEmine && !seeded && data.length === 0) {
        data = await replaceMealTemplates(user?.uid, EMINE_INITIAL_TEMPLATES);
      }
      if (isEmine && !seeded) {
        setScopedJson('meal_templates_seeded_v2', user?.uid, true);
      }
      const librarySeeded = getScopedJson('meal_templates_library_seeded_v1', user?.uid, false);
      if (isEmine && !librarySeeded && data.length > 0) {
        const upgraded = mergeLibraryItemsIntoInitialTemplates(data);
        const changed = JSON.stringify(upgraded) !== JSON.stringify(data);
        if (changed) {
          data = await replaceMealTemplates(user?.uid, upgraded);
        }
        setScopedJson('meal_templates_library_seeded_v1', user?.uid, true);
      }
      setTemplates(data);
      setRecentMeals(await getRecentMeals(user?.uid, 7, 40));
    } catch (err) {
      setError(err.message || 'Şablonlar yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const visibleTemplates = useMemo(() => (
    activeFilter === 'all' ? templates : templates.filter((template) => template.mealType === activeFilter)
  ), [activeFilter, templates]);

  const formTotals = useMemo(() => calculateFoodItemsTotal(sanitizeItems(form.items)), [form.items]);
  const formUsesLibrary = sanitizeItems(form.items).length > 0;
  const saveMealOptions = useMemo(() => {
    const byKey = new Map();
    [...meals, ...recentMeals].forEach((meal) => {
      if (!meal?.name) return;
      const key = meal.name.trim().toLocaleLowerCase('tr');
      if (!byKey.has(key)) byKey.set(key, meal);
    });
    const query = saveMealSearch.trim().toLocaleLowerCase('tr');
    return [...byKey.values()]
      .filter((meal) => !query || (meal.name || '').toLocaleLowerCase('tr').includes(query))
      .slice(0, 20);
  }, [meals, recentMeals, saveMealSearch]);

  const resetTemplateForm = () => {
    setForm(EMPTY_TEMPLATE);
    setEditingTemplateId(null);
    setIsFormOpen(false);
  };

  const handleSaveTemplateForm = async () => {
    if (!form.name || (!form.calories && !formUsesLibrary)) {
      setError('Şablon için en az ad ve kalori girilmeli.');
      return;
    }
    try {
      const result = await saveMealTemplate(user?.uid, {
        ...toTemplatePayload(form),
        id: editingTemplateId || undefined
      });
      setTemplates(result.templates);
      resetTemplateForm();
      setError('');
    } catch (err) {
      setError(err.message || 'Şablon kaydedilemedi.');
    }
  };

  const handleEdit = (template) => {
    setForm({
      name: template.name || '',
      mealType: template.mealType || 'snack',
      mealLabel: template.mealLabel || '',
      calories: template.calories || '',
      protein: template.protein || '',
      carbs: template.carbs || '',
      fats: template.fats || '',
      portion: template.portion || '',
      items: Array.isArray(template.items) ? template.items : []
    });
    setEditingTemplateId(template.id);
    setIsFormOpen(true);
  };

  const updateFormItem = (index, changes) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...changes };
        if (changes.foodId) {
          const food = getFoodById(changes.foodId);
          next.amount = food?.defaultAmount || next.amount;
        }
        return next;
      })
    }));
  };

  const addFormItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, EMPTY_ITEM] }));
  };

  const removeFormItem = (index) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleSaveCurrentMeal = async () => {
    const meal = saveMealOptions.find((m) => String(m.id || m.name) === String(saveMealId));
    if (!meal) return;
    try {
      const result = await saveMealTemplate(user?.uid, {
        ...meal,
        id: undefined,
        source: 'Şablon'
      });
      setTemplates(result.templates);
      setSaveMealId('');
      setSaveMealSearch('');
    } catch (err) {
      setError(err.message || 'Şablon kaydedilemedi.');
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Bu öğün şablonunu silmek istediğinize emin misiniz?')) return;
    try {
      const next = await deleteMealTemplate(user?.uid, templateId);
      setTemplates(next);
      if (editingTemplateId === templateId) resetTemplateForm();
    } catch (err) {
      setError(err.message || 'Şablon silinemedi.');
    }
  };

  return (
    <div className="meal-templates-panel">
      <div className="meal-templates-head">
        <div>
          <h4>Öğün Şablonları</h4>
          <p>Kendi öğün kalıplarını oluştur, düzenle ve seçili güne tek dokunuşla ekle.</p>
        </div>
        <span>{templates.length}/30</span>
      </div>

      {error && <div className="meal-template-error">{error}</div>}

      <div className="template-manager-bar">
        <div className="template-filter-tabs">
          {MEAL_TYPES.map((filter) => (
            <button
              key={filter.key}
              className={activeFilter === filter.key ? 'active' : ''}
              onClick={() => setActiveFilter(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <button
          className="template-new-btn"
          onClick={() => {
            setForm(EMPTY_TEMPLATE);
            setEditingTemplateId(null);
            setIsFormOpen((prev) => !prev);
          }}
          type="button"
        >
          {isFormOpen && !editingTemplateId ? 'Formu Kapat' : 'Yeni Şablon'}
        </button>
      </div>

      {isFormOpen && (
        <div className="template-edit-form">
          <div className="template-form-grid">
            <label>Ad<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Öğün
              <select value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value })}>
                {MEAL_TYPES.filter((type) => type.key !== 'all').map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
            </label>
            <label>Etiket<input value={form.mealLabel} placeholder="Opsiyonel" onChange={(e) => setForm({ ...form, mealLabel: e.target.value })} /></label>
            <label>Kalori<input type="number" value={formUsesLibrary ? formTotals.calories : form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} disabled={formUsesLibrary} /></label>
            <label>Protein<input type="number" value={formUsesLibrary ? formTotals.protein : form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} disabled={formUsesLibrary} /></label>
            <label>Karbonhidrat<input type="number" value={formUsesLibrary ? formTotals.carbs : form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} disabled={formUsesLibrary} /></label>
            <label>Yağ<input type="number" value={formUsesLibrary ? formTotals.fats : form.fats} onChange={(e) => setForm({ ...form, fats: e.target.value })} disabled={formUsesLibrary} /></label>
            <label className="template-form-wide">Gram / Porsiyon<input value={form.portion} onChange={(e) => setForm({ ...form, portion: e.target.value })} /></label>
          </div>

          <div className="template-builder">
            <div className="template-builder-head">
              <div>
                <strong>Besin Kütüphanesi</strong>
                <span>Gram değiştikçe kalori ve makrolar otomatik hesaplanır.</span>
              </div>
              <button type="button" onClick={addFormItem}>Besin Ekle</button>
            </div>
            {form.items.length === 0 ? (
              <p className="template-builder-empty">İstersen manuel makro girebilir veya kütüphaneden besin ekleyebilirsin.</p>
            ) : (
              <div className="template-item-list">
                {form.items.map((item, index) => {
                  const food = getFoodById(item.foodId);
                  const values = calculateFoodItem(item);
                  return (
                    <div className="template-item-row" key={`${item.foodId}-${index}`}>
                      <label>Besin
                        <select value={item.foodId} onChange={(e) => updateFormItem(index, { foodId: e.target.value })}>
                          {FOOD_CATEGORIES.map((category) => (
                            <optgroup key={category.key} label={category.label}>
                              {FOOD_LIBRARY.filter((foodItem) => foodItem.category === category.key).map((foodItem) => (
                                <option key={foodItem.id} value={foodItem.id}>{foodItem.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label>Miktar
                        <input type="number" value={item.amount} onChange={(e) => updateFormItem(index, { amount: e.target.value })} />
                      </label>
                      <span>{food?.unit || 'g'}</span>
                      <small>{values.calories} kcal · P {values.protein}g · C {values.carbs}g · F {values.fats}g</small>
                      <button type="button" className="template-item-remove" onClick={() => removeFormItem(index)}>Sil</button>
                    </div>
                  );
                })}
              </div>
            )}
            {formUsesLibrary && (
              <div className="template-total-preview">
                Toplam: {formTotals.calories} kcal · P {formTotals.protein}g · C {formTotals.carbs}g · F {formTotals.fats}g · Lif {formTotals.fiber}g
              </div>
            )}
          </div>

          <div className="template-form-actions">
            <button onClick={handleSaveTemplateForm} disabled={disabled}>{editingTemplateId ? 'Güncelle' : 'Kaydet'}</button>
            <button className="secondary" onClick={resetTemplateForm} type="button">İptal</button>
          </div>
        </div>
      )}

      {(meals.length > 0 || recentMeals.length > 0) && (
        <div className="meal-template-save-panel">
          <div className="meal-template-save-head">
            <strong>Öğünden Şablon Yap</strong>
            <span>Bugün ve son 7 gün</span>
          </div>
          <div className="meal-template-save-row">
            <input
              value={saveMealSearch}
              onChange={(e) => setSaveMealSearch(e.target.value)}
              placeholder="Öğün ara..."
              disabled={disabled}
            />
            <select value={saveMealId} onChange={(e) => setSaveMealId(e.target.value)} disabled={disabled}>
              <option value="">Şablon yapılacak öğünü seç</option>
              {saveMealOptions.map((meal) => (
                <option key={meal.id || meal.name} value={meal.id || meal.name}>
                  {meal.name} ({Math.round(meal.calories)} kcal)
                </option>
              ))}
            </select>
            <button onClick={handleSaveCurrentMeal} disabled={disabled || !saveMealId}>
              Şablon Yap
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="meal-template-empty">Yükleniyor...</div>
      ) : templates.length === 0 ? (
        <div className="meal-template-empty">Henüz şablon yok.</div>
      ) : visibleTemplates.length === 0 ? (
        <div className="meal-template-empty">Bu kategoride şablon yok.</div>
      ) : (
        <div className="meal-template-grid">
          {visibleTemplates.map((template) => (
            <div key={template.id} className="meal-template-card">
              <div>
                <strong>{template.name}</strong>
                <span>{Math.round(template.calories)} kcal · P {Math.round(template.protein)}g · C {Math.round(template.carbs)}g · F {Math.round(template.fats)}g</span>
                {template.portion && <small>{template.portion}</small>}
                {Array.isArray(template.items) && template.items.length > 0 && (
                  <div className="meal-template-items">
                    {template.items.slice(0, 4).map((item, index) => {
                      const food = getFoodById(item.foodId);
                      return food ? <em key={`${item.foodId}-${index}`}>{item.amount} {food.unit} {food.name}</em> : null;
                    })}
                    {template.items.length > 4 && <em>+{template.items.length - 4} besin daha</em>}
                  </div>
                )}
              </div>
              <div className="meal-template-actions">
                <button onClick={() => onUseTemplate(template)} disabled={disabled}>Ekle</button>
                <button className="secondary" onClick={() => handleEdit(template)} disabled={disabled}>Düzenle</button>
                <button className="danger" onClick={() => handleDelete(template.id)} disabled={disabled}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MealTemplates;
