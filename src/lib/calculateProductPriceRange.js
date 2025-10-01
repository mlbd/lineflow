// src/lib/calculateProductPriceRange.js
export function applyPercentageIncrease(steps, percentage) {
  if (!Array.isArray(steps)) return steps;
  return steps.map(step => ({
    ...step,
    amount: Math.round(Number(step.amount) + Number(step.amount) * (Number(percentage) / 100)),
  }));
}

export function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) return '';
  return `$${price.toFixed(2)}`;
}

export function calculateProductPriceRange(product, bumpPrice = null, priceMode = 'range') {
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

  console.log(`[Product ${productId}] Price mode:`, priceMode);

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

    if (priceMode === 'min') {
      // console.log(`[Product ${productId}] Using min price: ${min}`);
      return formatPrice(min);
    } else if (priceMode === 'max') {
      // console.log(`[Product ${productId}] Using max price: ${max}`);
      return formatPrice(max);
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

/**
 * Return order item quantities from either quantity_steps (preferred when enabled)
 * or discount_steps, depending on ACF settings — mirroring the logic of price range.
 *
 * @param {Object} product - Woo/ACF product object
 * @param {'min'|'max'|'range'} itemsMode - which value to return
 * @returns {string|number} "min - max" when itemsMode='range', or a number for 'min'/'max';
 *                          empty string when not enough data.
 */
export function calculateProductOrderItems(product, itemsMode = 'range') {
  const productId = product?.id || 'unknown';
  const acf = product?.acf || {};
  const enable_custom_quantity = acf.enable_custom_quantity;

  let discount_steps = Array.isArray(acf.discount_steps) ? acf.discount_steps : [];
  let quantity_steps = Array.isArray(acf.quantity_steps) ? acf.quantity_steps : [];

  // Prefer quantity_steps when custom quantity is enabled & available, else discount_steps.
  let source =
    enable_custom_quantity && quantity_steps.length > 0 ? quantity_steps : discount_steps;

  // Be defensive about the field name used for "quantity" in ACF repeater rows.
  // Common keys we've seen: quantity, qty, min_qty, min_quantity.
  const candidateQuantityKeys = ['quantity', 'qty', 'min_qty', 'min_quantity', 'q'];

  const quantities = (source || [])
    .map(row => {
      // extract first numeric value found among candidate keys
      for (const key of candidateQuantityKeys) {
        const v = Number(row?.[key]);
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
      }
      // sometimes the shape could be { amount: X, quantity: Y }; if no quantity, try amount as fallback
      const fallback = Number(row?.amount);
      if (typeof fallback === 'number' && !Number.isNaN(fallback)) return fallback;
      return null;
    })
    .filter(v => typeof v === 'number' && !Number.isNaN(v) && v > 0);

  if (quantities.length === 0) {
    // No usable data
    return '';
  }

  const min = Math.min(...quantities);
  const max = Math.max(...quantities);

  if (itemsMode === 'min') return min;
  if (itemsMode === 'max') return max;

  // default: range
  return `${min} - ${max}`;
}
