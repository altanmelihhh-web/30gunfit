const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const MICRONUTRIENTS = [
  { key: 'fiber', label: 'Lif', unit: 'g', digits: 1 },
  { key: 'sugars', label: 'Şeker', unit: 'g', digits: 1 },
  { key: 'sodium', label: 'Sodyum', unit: 'g', digits: 2 },
  { key: 'saturatedFat', label: 'Doymuş yağ', unit: 'g', digits: 1 }
];

export const emptyMicronutrients = () =>
  MICRONUTRIENTS.reduce((acc, item) => ({ ...acc, [item.key]: 0 }), {});

export const mealHasMicronutrients = (meal) =>
  Boolean(meal?.micronutrients) &&
  MICRONUTRIENTS.some((item) => toNumber(meal.micronutrients[item.key]) > 0);

export const sumMicronutrients = (meals = []) => {
  const totals = emptyMicronutrients();
  let sourceMealCount = 0;
  meals.forEach((meal) => {
    if (!mealHasMicronutrients(meal)) return;
    sourceMealCount += 1;
    MICRONUTRIENTS.forEach((item) => {
      totals[item.key] += toNumber(meal.micronutrients[item.key]);
    });
  });
  return { ...totals, sourceMealCount };
};

export const averageMicronutrients = (dailyTotals = []) => {
  const daysWithMicros = dailyTotals.filter((day) => day.micros?.sourceMealCount > 0);
  const totals = emptyMicronutrients();
  daysWithMicros.forEach((day) => {
    MICRONUTRIENTS.forEach((item) => {
      totals[item.key] += toNumber(day.micros[item.key]);
    });
  });
  const divisor = daysWithMicros.length || 1;
  return {
    ...MICRONUTRIENTS.reduce((acc, item) => ({
      ...acc,
      [item.key]: totals[item.key] / divisor
    }), {}),
    loggedDays: daysWithMicros.length
  };
};

export const formatMicronutrient = (value, item) =>
  `${toNumber(value).toFixed(item.digits)}${item.unit}`;
