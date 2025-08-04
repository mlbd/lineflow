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

export function calculateProductPriceRange(product, bumpPrice = null) {
  // console.log('bumpPrice', bumpPrice);
  const productId = product?.id || 'unknown';
  const acf = product.acf || {};
  let { regular_price, bump_price } = product;

  let discount_steps = acf.discount_steps || [];
  let quantity_steps = acf.quantity_steps || [];
  const enable_custom_quantity = acf.enable_custom_quantity;
  regular_price = Number(regular_price);

  // console.log(`[Product ${productId}] Initial regular_price:`, regular_price);
  // console.log(`[Product ${productId}] Bump price:`, bump_price);

  // Apply bump price if needed
  if (bump_price) {
    if (discount_steps) discount_steps = applyPercentageIncrease(discount_steps, bump_price);
    if (quantity_steps) quantity_steps = applyPercentageIncrease(quantity_steps, bump_price);
    if (regular_price)
      regular_price = Math.round(regular_price + regular_price * (Number(bump_price) / 100));
    // console.log(`[Product ${productId}] Regular price after bump:`, regular_price);
  }

  let priceArr = [];
  if (enable_custom_quantity && Array.isArray(quantity_steps) && quantity_steps.length > 0) {
    priceArr = quantity_steps
      .map(q => Number(q.amount))
      .filter(val => typeof val === 'number' && !isNaN(val) && val > 0);
    // console.log(`[Product ${productId}] Using quantity_steps:`, priceArr);
  } else if (Array.isArray(discount_steps) && discount_steps.length > 0) {
    priceArr = discount_steps
      .map(d => Number(d.amount))
      .filter(val => typeof val === 'number' && !isNaN(val) && val > 0);
    // console.log(`[Product ${productId}] Using discount_steps:`, priceArr);
  }

  if (priceArr.length > 0) {
    const min = Math.min(...priceArr);
    let max = Math.max(...priceArr);
    // console.log(`[Product ${productId}] Raw min: ${min}, max: ${max}`);

    if (!max || max < regular_price) {
      // console.log(`[Product ${productId}] Adjusting max from ${max} to regular_price: ${regular_price}`);
      max = regular_price;
    }

    const result = `${formatPrice(min)} - ${formatPrice(max)}`;
    // console.log(`[Product ${productId}] Final price range:`, result);
    return result;
  }

  if (regular_price && !isNaN(regular_price)) {
    const fallback = formatPrice(regular_price);
    // console.log(`[Product ${productId}] Fallback to regular_price:`, fallback);
    return fallback;
  }

  // console.log(`[Product ${productId}] No valid price data`);
  return '';
}

