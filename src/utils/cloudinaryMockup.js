// /src/utils/cloudinaryMockup.js
const ENV_CLOUD =
  process.env.NEXT_PUBLIC_CLD_CLOUD || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/* --------------------- shared helpers --------------------- */

export const isCloudinaryUrl = url =>
  !!url && typeof url === 'string' && url.includes('res.cloudinary.com');

export const parseCloudinaryIds = url => {
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
    const ext = (last.match(/\.([^.]+)$/i) || [, ''])[1];
    const folderParts = rest;
    const looksSeoShort =
      delivery === 'images' || (folderParts.length === 1 && folderParts[0] === fileId);

    const overlayId = looksSeoShort
      ? fileId
      : folderParts.length
        ? `${folderParts.join(':')}:${fileId}`
        : fileId;

    const baseAsset = ext ? `${fileId}.${ext}` : fileId;

    return { cloud, overlayId, baseAsset, delivery };
  } catch {
    return { cloud: '', overlayId: '', baseAsset: '', delivery: '' };
  }
};

const brightnessFromHex = hex => {
  if (!hex || typeof hex !== 'string') return 128;
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return 128;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.round((r * 299 + g * 587 + b * 114) / 1000);
};
const isDarkHex = hex => brightnessFromHex(hex) < 128;

const validLogo = obj => !!obj?.url && isCloudinaryUrl(obj.url);

const pickLogoVariant = (logos, useBack, bgIsDark) => {
  const get = k => logos?.[k] || null;
  const want = useBack
    ? bgIsDark
      ? get('back_lighter')
      : get('back_darker')
    : bgIsDark
      ? get('logo_lighter')
      : get('logo_darker');

  if (validLogo(want)) return want;

  const alt = bgIsDark ? get('logo_lighter') : get('logo_darker');
  if (validLogo(alt)) return alt;

  return validLogo(get('logo_darker')) ? get('logo_darker') : null;
};

/* --------------------- helpers --------------------- */
const resolvePlacements = (product, opts = {}) => {
  const pid = String(product?.id ?? '');
  const overrideMap = opts.pagePlacementMap || null;
  if (overrideMap && pid && Array.isArray(overrideMap[pid]) && overrideMap[pid].length) {
    return overrideMap[pid];
  }
  return Array.isArray(product?.placement_coordinates) ? product.placement_coordinates : [];
};

const isBackAllowedForProduct = (productId, opts = {}) => {
  const id = String(productId);
  const set = opts.customBackAllowedSet;
  const arr = opts.customBackAllowedIds;

  if (set && typeof set.has === 'function') return set.has(id);
  if (Array.isArray(set)) return set.map(String).includes(id);
  if (Array.isArray(arr)) return arr.map(String).includes(id);
  return false;
};

/* ------------------------ FULL builder ------------------------ */

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

  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  if (!baseW || !baseH) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  placements.forEach((p, idx) => {
    const parsedLogoObj = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
    if (!parsedLogoObj) return;

    const parsedLogo = parseCloudinaryIds(parsedLogoObj.url);
    if (!parsedLogo.overlayId) return;

    const x = Math.round((p.xPercent != null ? p.xPercent : p.x / baseW) * baseW);
    const y = Math.round((p.yPercent != null ? p.yPercent : p.y / baseH) * baseH);
    const w = Math.max(1, Math.round((p.wPercent != null ? p.wPercent : p.w / baseW) * baseW));
    const h = Math.max(1, Math.round((p.hPercent != null ? p.hPercent : p.h / baseH) * baseH));

    const lw = Number(parsedLogoObj.width) || 0;
    const lh = Number(parsedLogoObj.height) || 0;
    let logoW = w,
      logoH = h;
    if (lw > 0 && lh > 0) {
      const la = lw / lh,
        ba = w / h;
      if (la > ba) {
        logoW = w;
        logoH = Math.round(w / la);
      } else {
        logoH = h;
        logoW = Math.round(h * la);
      }
    }

    const finalX = x + Math.round((w - logoW) / 2);
    const finalY = y + Math.round((h - logoH) / 2);
    const angle = p.angle ? Math.round((p.angle * 180) / Math.PI) : 0;

    transforms.push(
      `l_${parsedLogo.overlayId},c_pad,w_${logoW},h_${logoH},g_center,b_auto${angle ? `,a_${angle}` : ''}/fl_layer_apply,x_${finalX},y_${finalY},g_north_west`
    );
  });

  if (!transforms.length) return baseUrl;

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};

/* ------------------------ RELATIVE builder ------------------------ */
export const buildRelativeMockupUrl = ({
  baseUrl,
  placements = [],
  logos = {},
  baseHex = '#ffffff',
  max = 900,
  maxH = null,
  productId = null,
  debugLabel = 'relative',
}) => {
  const pid = productId ? `[${productId}]` : '';

  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  if (!max) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  transforms.push(`f_auto,q_auto,c_fit,w_${max}${maxH ? `,h_${maxH}` : ''}`);

  placements.forEach((p, idx) => {
    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    if (p.xPercent == null || p.yPercent == null || p.wPercent == null || p.hPercent == null)
      return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent,
      relH = p.hPercent;
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
  return final;
};

/* ---------------------- Public generators ---------------------- */

export const generateProductImageUrl = (product, logos, opts = {}) => {
  if (!product) return '';

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

  console.log("📸 Generating mockup for product:", product);
  const rawPlacements = resolvePlacements(product, opts);
  const allowBack = isBackAllowedForProduct(product?.id, opts);

  // 🔹 active filter
  const activePlacements = rawPlacements.filter(p => p?.active === true);

  const placements = activePlacements.map(p => ({
    ...p,
    __useBack: !!(p?.back && allowBack),
  }));

  if (!opts?.max) {
    if (!baseW || !baseH) {
      return buildRelativeMockupUrl({
        baseUrl,
        placements,
        logos,
        baseHex,
        max: 900,
        productId: product?.id || null,
        debugLabel: `${debugLabel}_autoRel`,
      });
    }
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

const resolveCartBaseFromItem = item => {
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
      const match = colors.find(
        c => (c?.title || '').toLowerCase() === (colorTitle || '').toLowerCase()
      );
      if (match?.thumbnail?.url) {
        return { url: match.thumbnail.url, hex: match.color_hex_code || '#ffffff' };
      }
    }
  }
  return { url: item?.thumbnail || '', hex: item?.thumbnail_meta?.thumbnail_color || '#ffffff' };
};

export const generateCartThumbUrlFromItem = (
  item,
  logos,
  { max = 200, pagePlacementMap, customBackAllowedSet } = {}
) => {
  if (!item) return '';

  const pidStr = String(item?.product_id ?? '');
  const base = resolveCartBaseFromItem(item);
  if (!isCloudinaryUrl(base.url)) return base.url || item.thumbnail || '';

  let rawPlacements = [];
  if (pagePlacementMap && pidStr && Array.isArray(pagePlacementMap[pidStr])) {
    rawPlacements = pagePlacementMap[pidStr];
  } else if (Array.isArray(item?.placement_coordinates)) {
    rawPlacements = item.placement_coordinates;
  } else if (Array.isArray(item?.product?.placement_coordinates)) {
    rawPlacements = item.product.placement_coordinates;
  }

  // 🔹 active filter
  rawPlacements = rawPlacements.filter(p => p?.active === true);

  if (!rawPlacements.length) return base.url;
  if (!logos?.logo_darker?.url || !isCloudinaryUrl(logos.logo_darker.url)) return base.url;

  const parsedBase = parseCloudinaryIds(base.url);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return base.url;

  const bgIsDark = isDarkHex(base.hex);
  const allowBack = Array.isArray(customBackAllowedSet)
    ? customBackAllowedSet.map(String).includes(pidStr)
    : !!(
        customBackAllowedSet &&
        typeof customBackAllowedSet.has === 'function' &&
        customBackAllowedSet.has(pidStr)
      );

  const placements = rawPlacements.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));
  const transforms = [`f_auto,q_auto,c_fit,w_${max},h_${max}`];

  placements.forEach(p => {
    if (p.xPercent == null || p.yPercent == null || p.wPercent == null || p.hPercent == null)
      return;

    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent,
      relH = p.hPercent;
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

  if (transforms.length <= 1) return base.url;

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};

export const generateHoverThumbUrlFromItem = (
  item,
  logos,
  { max = 400, pagePlacementMap, customBackAllowedSet } = {}
) => generateCartThumbUrlFromItem(item, logos, { max, pagePlacementMap, customBackAllowedSet });

export const generateProductImageUrlWithOverlay = (
  product,
  logos,
  {
    max = 1400,
    colorIndex = 0,
    overlayHex = '#000000',
    overlayOpacity = 20,
    pagePlacementMap,
    customBackAllowedSet,
  } = {}
) => {
  if (!product) return '';

  let baseUrl = product.thumbnail;
  let baseHex = product?.thumbnail_meta?.thumbnail_color || '#ffffff';

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const clr = product.acf.color[Number(colorIndex) || 0] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseHex = clr?.color_hex_code || baseHex;
    }
  }

  const rawPlacements = resolvePlacements(product, { pagePlacementMap });

  // 🔹 active filter
  const activePlacements = rawPlacements.filter(p => p?.active === true);

  const allowBack = isBackAllowedForProduct(product?.id, { customBackAllowedSet });
  const placements = activePlacements.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));

  if (!placements.length) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const transforms = [`f_auto,q_auto,c_fit,w_${Number(max) || 900}`];

  const hex = (overlayHex || '#000000').replace('#', '');
  const op = Math.max(0, Math.min(overlayOpacity, 100));

  placements.forEach(p => {
    const { xPercent, yPercent, wPercent, hPercent } = p || {};
    if (xPercent == null || yPercent == null || wPercent == null || hPercent == null) return;

    transforms.push(
      `l_one_pixel_s4c3vt,fl_relative,w_${wPercent.toFixed(6)},h_${hPercent.toFixed(6)}`,
      `co_rgb:${hex},e_colorize:100,o_${op},fl_layer_apply,fl_relative,x_${xPercent.toFixed(6)},y_${yPercent.toFixed(6)},g_north_west`
    );
  });

  const bgIsDark = isDarkHex(baseHex);

  placements.forEach(p => {
    const choose = (logosObj, useBack, dark) => {
      const get = k => logosObj?.[k] || null;
      const want = useBack
        ? dark
          ? get('back_lighter')
          : get('back_darker')
        : dark
          ? get('logo_lighter')
          : get('logo_darker');
      const ok = v => !!v?.url && isCloudinaryUrl(v.url);
      if (ok(want)) return want;
      if (ok(get('logo_darker'))) return get('logo_darker');
      if (ok(get('logo_lighter'))) return get('logo_lighter');
      return null;
    };

    const chosen = choose(logos, !!p.__useBack, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent,
      relH = p.hPercent;
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

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};
