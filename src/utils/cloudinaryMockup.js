// /src/utils/cloudinaryMockup.js
// Generate Cloudinary mockup URLs by overlaying company logos onto product images.
// Adds a RELATIVE builder (for fast modal/cart) and keeps the FULL builder for legacy/full-res.

const ENV_CLOUD =
  process.env.NEXT_PUBLIC_CLD_CLOUD || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/* --------------------- shared helpers --------------------- */

export const isCloudinaryUrl = (url) =>
  !!url && typeof url === 'string' && url.includes('res.cloudinary.com');

export const parseCloudinaryIds = (url) => {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, '');
    const seg = path.split('/').filter(Boolean);
    const cloud = seg[0];

    let delivery = 'image/upload';
    let after = 3;
    if (seg[1] === 'images') {
      delivery = 'images';
      after = 2;
    } else if (seg[1] === 'video' && seg[2] === 'upload') {
      delivery = 'video/upload';
      after = 3;
    }

    let rest = seg.slice(after);
    while (rest[0] && (rest[0].includes(',') || /^v\d+$/i.test(rest[0]))) {
      rest.shift();
    }
    if (!rest.length) return { cloud, overlayId: '', baseAsset: '', delivery };

    const last = rest.pop();
    const fileId = last.replace(/\.[^.]+$/i, '');
    const ext = (last.match(/\.([^.]+)$/i) || [,''])[1];
    const folderParts = rest;
    const looksSeoShort =
      delivery === 'images' || (folderParts.length === 1 && folderParts[0] === fileId);

    const overlayId = looksSeoShort
      ? fileId
      : (folderParts.length ? `${folderParts.join(':')}:${fileId}` : fileId);

    const baseAsset = ext ? `${fileId}.${ext}` : fileId;

    return { cloud, overlayId, baseAsset, delivery };
  } catch {
    return { cloud: '', overlayId: '', baseAsset: '', delivery: '' };
  }
};

const brightnessFromHex = (hex) => {
  if (!hex || typeof hex !== 'string') return 128;
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return 128;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.round((r * 299 + g * 587 + b * 114) / 1000);
};
const isDarkHex = (hex) => brightnessFromHex(hex) < 128;

const validLogo = (obj) => !!obj?.url && isCloudinaryUrl(obj.url);

const pickLogoVariant = (logos, useBack, bgIsDark) => {
  const get = (k) => logos?.[k] || null;
  const want = useBack
    ? (bgIsDark ? get('back_lighter') : get('back_darker'))
    : (bgIsDark ? get('logo_lighter') : get('logo_darker'));

  if (validLogo(want)) return want;

  const alt = bgIsDark ? get('logo_lighter') : get('logo_darker');
  if (validLogo(alt)) return alt;

  return validLogo(get('logo_darker')) ? get('logo_darker') : null;
};

/* ------------------------ FULL builder (unchanged) ------------------------ */

export const buildCloudinaryMockupUrl = ({
  baseUrl,
  baseW,
  baseH,
  baseHex,
  placements = [],
  logos = {},
  productId = null,
  debugLabel = 'grid',
}) => {
  const pid = productId ? `[${productId}]` : '';

  if (!isCloudinaryUrl(baseUrl)) {
    console.debug(`[cld][skip]${pid} base_not_cloudinary`, { baseUrl });
    return baseUrl;
  }
  if (!Array.isArray(placements) || placements.length === 0) {
    console.debug(`[cld][skip]${pid} no_placements`);
    return baseUrl;
  }
  if (!validLogo(logos?.logo_darker)) {
    console.debug(`[cld][skip]${pid} logo_darker_invalid`, { logos });
    return baseUrl;
  }
  if (!baseW || !baseH) {
    console.debug(`[cld][skip]${pid} missing_base_dimensions`, { baseW, baseH });
    return baseUrl;
  }

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) {
    console.debug(`[cld][skip]${pid} cloud_or_base_missing`, parsedBase);
    return baseUrl;
  }

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  placements.forEach((p, idx) => {
    const chosen = pickLogoVariant(logos, !!p.back, bgIsDark);
    if (!chosen) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const x = Math.round((p.xPercent != null ? p.xPercent : p.x / baseW) * baseW);
    const y = Math.round((p.yPercent != null ? p.yPercent : p.y / baseH) * baseH);
    const w = Math.max(1, Math.round((p.wPercent != null ? p.wPercent : p.w / baseW) * baseW));
    const h = Math.max(1, Math.round((p.hPercent != null ? p.hPercent : p.h / baseH) * baseH));

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;
    let logoW = w, logoH = h;
    if (lw > 0 && lh > 0) {
      const la = lw / lh, ba = w / h;
      if (la > ba) { logoW = w; logoH = Math.round(w / la); }
      else { logoH = h; logoW = Math.round(h * la); }
    }

    const finalX = x + Math.round((w - logoW) / 2);
    const finalY = y + Math.round((h - logoH) / 2);
    const angle = p.angle ? Math.round((p.angle * 180) / Math.PI) : 0;

    transforms.push(
      `l_${parsedLogo.overlayId},c_pad,w_${logoW},h_${logoH},g_center,b_auto${angle ? `,a_${angle}` : ''}/fl_layer_apply,x_${finalX},y_${finalY},g_north_west`
    );
  });

  if (!transforms.length) return baseUrl;

  const final = `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
  return final;
};

/* ------------------------ RELATIVE builder (new) ------------------------ */
/** Builds a smaller mockup using fl_relative so overlays scale after resize. */
export const buildRelativeMockupUrl = ({
  baseUrl,
  placements = [],
  logos = {},
  baseHex = '#ffffff',
  max = 900,      // if falsy => caller should not use this builder
  maxH = null,    // optional
  productId = null,
  debugLabel = 'relative',
}) => {
  const pid = productId ? `[${productId}]` : '';

  if (!isCloudinaryUrl(baseUrl)) {
    console.debug(`[cld][skip]${pid} rel_base_not_cloudinary`, { baseUrl });
    return baseUrl;
  }
  if (!Array.isArray(placements) || placements.length === 0) {
    console.debug(`[cld][skip]${pid} rel_no_placements`);
    return baseUrl;
  }
  if (!validLogo(logos?.logo_darker)) {
    console.debug(`[cld][skip]${pid} rel_logo_darker_invalid`, { logos });
    return baseUrl;
  }
  if (!max) {
    // guard: if no max, let caller use full builder instead
    return baseUrl;
  }

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) {
    console.debug(`[cld][skip]${pid} rel_cloud_or_base_missing`, parsedBase);
    return baseUrl;
  }

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  // Step 1: resize base small (use smart formats/quality)
  transforms.push(`f_auto,q_auto,c_fit,w_${max}${maxH ? `,h_${maxH}` : ''}`);

  // Step 2: overlay each placement using relative percentages
  placements.forEach((p, idx) => {
    if (
      p.xPercent == null || p.yPercent == null ||
      p.wPercent == null || p.hPercent == null
    ) {
      console.debug(`[cld][skip]${pid} rel_placement_missing_percent idx=${idx}`, p);
      return;
    }

    const chosen = pickLogoVariant(logos, !!p.back, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) {
      console.debug(`[cld][skip]${pid} rel_no_logo idx=${idx}`);
      return;
    }

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) {
      console.debug(`[cld][skip]${pid} rel_bad_logo_public_id idx=${idx}`, { url: chosen.url, parsedLogo });
      return;
    }

    // Aspect-fit inside relative box
    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent;
    let relH = p.hPercent;
    if (lw > 0 && lh > 0) {
      const la = lw / lh;
      const ba = p.wPercent / p.hPercent;
      if (la > ba) {
        relW = p.wPercent;
        relH = p.wPercent / la;
      } else {
        relH = p.hPercent;
        relW = p.hPercent * la;
      }
    }

    const relX = p.xPercent + (p.wPercent - relW) / 2;
    const relY = p.yPercent + (p.hPercent - relH) / 2;
    const angle = p.angle ? Math.round((p.angle * 180) / Math.PI) : 0;

    transforms.push(
      `l_${parsedLogo.overlayId},c_pad,fl_relative,w_${relW.toFixed(6)},h_${relH.toFixed(6)},g_center,b_auto${angle ? `,a_${angle}` : ''}`,
      `fl_layer_apply,fl_relative,x_${relX.toFixed(6)},y_${relY.toFixed(6)},g_north_west`
    );
  });

  if (transforms.length <= 1) return baseUrl;

  const final = `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
  console.debug(`[cld][SUCCESS]${pid} [${debugLabel}]`, { final });
  return final;
};

/* ---------------------- Public generators ---------------------- */

/**
 * Generates a mockup for product cards & quick-view.
 * - If opts.max is provided: uses RELATIVE builder (fast, scaled).
 * - If opts.max is empty/undefined: uses FULL builder (original behavior).
 */
export const generateProductImageUrl = (product, logos, opts = {}) => {
  if (!product) return '';

  // Resolve base by color (for Group)
  let baseUrl = product.thumbnail;
  let baseW = Number(product?.thumbnail_meta?.width) || 0;
  let baseH = Number(product?.thumbnail_meta?.height) || 0;
  let baseHex = product?.thumbnail_meta?.thumbnail_color || '#ffffff';
  let debugLabel = 'grid';

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const idx = Number(opts?.colorIndex ?? 0);
    const clr = product.acf.color[idx] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseW = Number(clr?.thumbnail?.width) || baseW;
      baseH = Number(clr?.thumbnail?.height) || baseH;
      baseHex = clr?.color_hex_code || baseHex;
      debugLabel = 'slider';
    }
  }

  const placements = product?.placement_coordinates || [];

  // If no max provided -> keep legacy FULL builder (absolute px)
  if (!opts?.max) {
    if (!baseW || !baseH) return baseUrl;
    return buildCloudinaryMockupUrl({
      baseUrl,
      baseW,
      baseH,
      baseHex,
      placements,
      logos,
      productId: product?.id || null,
      debugLabel,
    });
  }

  // With max -> RELATIVE builder (fast & accurate after resize)
  return buildRelativeMockupUrl({
    baseUrl,
    placements,
    logos,
    baseHex,
    max: Number(opts.max) || 900,
    productId: product?.id || null,
    debugLabel: `${debugLabel}_rel`,
  });
};

/* ---------------------- Cart thumbs (relative) ---------------------- */

/** Resolve the best base image for a cart item (handles Group color) */
const resolveCartBaseFromItem = (item) => {
  if (item?.options?.group_type === 'Group') {
    if (item?.options?.color_thumbnail_url) {
      return {
        url: item.options.color_thumbnail_url,
        hex: item?.options?.color_hex_code || item?.thumbnail_meta?.thumbnail_color || '#ffffff',
      };
    }
    const colorTitle = item?.options?.color;
    const colors = item?.product?.acf?.color;
    if (colorTitle && Array.isArray(colors)) {
      const match = colors.find(c => (c?.title || '').toLowerCase() === (colorTitle || '').toLowerCase());
      if (match?.thumbnail?.url) {
        return { url: match.thumbnail.url, hex: match.color_hex_code || '#ffffff' };
      }
    }
  }
  return { url: item?.thumbnail || '', hex: item?.thumbnail_meta?.thumbnail_color || '#ffffff' };
};

/** Small cart thumbnail with relative overlays */
export const generateCartThumbUrlFromItem = (item, logos, { max = 200 } = {}) => {
  if (!item) return '';

  const pid = item.product_id ? `[${item.product_id}]` : '';
  const base = resolveCartBaseFromItem(item);

  if (!isCloudinaryUrl(base.url)) return base.url || item.thumbnail || '';

  const placements = Array.isArray(item?.placement_coordinates)
    ? item.placement_coordinates
    : (Array.isArray(item?.product?.placement_coordinates) ? item.product.placement_coordinates : []);

  if (!Array.isArray(placements) || placements.length === 0) return base.url;
  if (!logos?.logo_darker?.url || !isCloudinaryUrl(logos.logo_darker.url)) return base.url;

  const parsedBase = parseCloudinaryIds(base.url);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return base.url;

  const bgIsDark = isDarkHex(base.hex);

  const transforms = [`f_auto,q_auto,c_fit,w_${max},h_${max}`];

  placements.forEach((p, idx) => {
    if (
      p.xPercent == null || p.yPercent == null ||
      p.wPercent == null || p.hPercent == null
    ) return;

    const chosen = pickLogoVariant(logos, !!p.back, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent;
    let relH = p.hPercent;
    if (lw > 0 && lh > 0) {
      const la = lw / lh;
      const ba = p.wPercent / p.hPercent;
      if (la > ba) { relW = p.wPercent; relH = p.wPercent / la; }
      else { relH = p.hPercent; relW = p.hPercent * la; }
    }

    const relX = p.xPercent + (p.wPercent - relW) / 2;
    const relY = p.yPercent + (p.hPercent - relH) / 2;
    const angle = p.angle ? Math.round((p.angle * 180) / Math.PI) : 0;

    transforms.push(
      `l_${parsedLogo.overlayId},c_pad,fl_relative,w_${relW.toFixed(6)},h_${relH.toFixed(6)},g_center,b_auto${angle ? `,a_${angle}` : ''}`,
      `fl_layer_apply,fl_relative,x_${relX.toFixed(6)},y_${relY.toFixed(6)},g_north_west`
    );
  });

  if (transforms.length <= 1) return base.url;

  const final = `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
  console.debug(`[cld][SUCCESS]${pid} [cart_thumb]`, { final });
  return final;
};

export const generateHoverThumbUrlFromItem = (item, logos, { max = 400 } = {}) => {
  return generateCartThumbUrlFromItem(item, logos, { max });
};
