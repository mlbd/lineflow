export function applyPercentageIncrease(steps, percentage) {
  if (!Array.isArray(steps)) return steps;
  return steps.map(step => ({
    ...step,
    amount: Math.round(Number(step.amount) + Number(step.amount) * (Number(percentage) / 100)),
  }));
}

export function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) return '';
  return `${price.toFixed(2)}₪`;
}

export function calculateProductPriceRange(product) {
  const acf = product.acf || {};
  let { regular_price, bump_price } = product;

  let discount_steps = acf.discount_steps || [];
  let quantity_steps = acf.quantity_steps || [];
  const enable_custom_quantity = acf.enable_custom_quantity;
  regular_price = Number(regular_price);

  // Apply bump price if needed
  if (bump_price) {
    if (discount_steps) discount_steps = applyPercentageIncrease(discount_steps, bump_price);
    if (quantity_steps) quantity_steps = applyPercentageIncrease(quantity_steps, bump_price);
    if (regular_price)
      regular_price = Math.round(regular_price + regular_price * (Number(bump_price) / 100));
  }

  let priceArr = [];
  if (enable_custom_quantity && Array.isArray(quantity_steps) && quantity_steps.length > 0) {
    priceArr = quantity_steps
      .map(q => Number(q.amount))
      .filter(val => typeof val === 'number' && !isNaN(val) && val > 0);
  } else if (Array.isArray(discount_steps) && discount_steps.length > 0) {
    priceArr = discount_steps
      .map(d => Number(d.amount))
      .filter(val => typeof val === 'number' && !isNaN(val) && val > 0);
  }

  if (priceArr.length > 0) {
    const min = Math.min(...priceArr);
    const max = Math.max(...priceArr);
    // Always show min - max, even if min === max
    return `${formatPrice(min)} - ${formatPrice(max)}`;
  }

  // fallback
  if (regular_price && !isNaN(regular_price)) return formatPrice(regular_price);

  return '';
}
