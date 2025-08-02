// src/utils/price.js
export function applyBumpPrice(steps = [], bump) {
  const percent = parseFloat(bump || 0);
  if (!percent) return steps;
  return steps.map((step) => ({
    ...step,
    amount: step.amount && !isNaN(step.amount)
      ? Math.round(parseFloat(step.amount) + (parseFloat(step.amount) * percent / 100))
      : step.amount,
  }));
}

export function applyBumpToRegular(price, bump) {
  const base = parseFloat(price || 0);
  const percent = parseFloat(bump || 0);
  if (!base || !percent) return price;
  return Math.round(base + (base * percent / 100));
}
