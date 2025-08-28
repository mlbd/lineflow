// /src/utils/cloudinaryMockup.js
// Rotation-safe placement: WHEN rotated, position by CENTER; otherwise keep old top-left placement.

const ENV_CLOUD =
  process.env.NEXT_PUBLIC_CLD_CLOUD || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** Optional gating for `back` logo usage.
 * When false (default): we do NOT check the per-product allow list;
 *                      a placement with `back:true` can use the back logo (unless user forces otherwise).
 * When true:           we require the product to be in the allow list (existing behavior).
 */
export const ENABLE_ALLOW_BACK_GATE = false;

/** Toggle the new "step-scaling" logic.
 * Set NEXT_PUBLIC_ENABLE_LOGO_STEP_SCALING=0 to disable.
 */
export const ENABLE_LOGO_STEP_SCALING = '1';

/* --------------------- shared helpers --------------------- */

// ------------------- transient, SCOPED in-memory overrides -------------------
// Map<scopeToken, Map<productId, Map<placementName, boolean>>>.
const FORCE_BACK_OVERRIDES = new Map();

function keyPID(pid) {
  return String(pid || '');
}
function keyName(n) {
  return String(n || '');
}
function keyScope(s) {
  return String(s || '');
}

export function setForceBackOverrides(productId, byName, { scope } = {}) {
  const pid = keyPID(productId);
  if (!pid) return;
  const sc = keyScope(scope || '__global__'); // if you truly want global, you can omit scope
  let scopeMap = FORCE_BACK_OVERRIDES.get(sc);
  if (!scopeMap) {
    scopeMap = new Map();
    FORCE_BACK_OVERRIDES.set(sc, scopeMap);
  }
  let prodMap = scopeMap.get(pid);
  if (!prodMap) {
    prodMap = new Map();
    scopeMap.set(pid, prodMap);
  }
  const assign = (name, val) => {
    if (val === 'Back') prodMap.set(keyName(name), true);
    else if (val === 'Default') prodMap.set(keyName(name), false);
    else if (typeof val === 'boolean') prodMap.set(keyName(name), val);
  };
  if (byName instanceof Map) {
    byName.forEach((val, name) => assign(name, val));
  } else if (byName && typeof byName === 'object') {
    Object.entries(byName).forEach(([name, val]) => assign(name, val));
  }
}

export function clearForceBackOverrides(productId, { scope } = {}) {
  const pid = keyPID(productId);
  const sc = keyScope(scope || '__global__');
  const scopeMap = FORCE_BACK_OVERRIDES.get(sc);
  if (!scopeMap) return;
  scopeMap.delete(pid);
  if (scopeMap.size === 0) FORCE_BACK_OVERRIDES.delete(sc);
}

export function clearForceBackScope(scope) {
  const sc = keyScope(scope || '__global__');
  FORCE_BACK_OVERRIDES.delete(sc);
}

function getOverrideFor(productId, name, scope) {
  const sc = keyScope(scope || '__global__');
  const scopeMap = FORCE_BACK_OVERRIDES.get(sc);
  if (!scopeMap) return undefined;
  const prodMap = scopeMap.get(keyPID(productId));
  if (!prodMap) return undefined;
  return prodMap.get(keyName(name));
}

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

// --- Helpers from logos.jsx ---
const ASPECT_DIFF_THRESHOLD = 0.3;
const SCALE_UP_FACTOR = 1.3;
const getOrientation = (w, h) => {
  const aspect = w / h;
  if (aspect >= 1.2) return 'horizontal';
  if (aspect <= 0.8) return 'vertical';
  return 'square';
};
function getAspectHeight(originalWidth, originalHeight, newWidth) {
  return (originalHeight / originalWidth) * newWidth;
}

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

// Normalize "Lighter"/"Darker" → "lighter"/"darker" or '' if invalid
const normalizeShade = s => {
  const v = String(s || '')
    .trim()
    .toLowerCase();
  if (v === 'lighter' || v === 'darker') return v;
  return '';
};

const pickLogoVariant = (logos, useBack, bgIsDark, baseShade = '') => {
  const shade = normalizeShade(baseShade);
  const get = k => logos?.[k] || null;

  // If baseShade is valid, force that variant and ignore bgIsDark
  if (shade) {
    const forcedKey = useBack
      ? shade === 'lighter'
        ? 'back_lighter'
        : 'back_darker'
      : shade === 'lighter'
        ? 'logo_lighter'
        : 'logo_darker';

    const forced = get(forcedKey);
    if (validLogo(forced)) return forced;

    // If the forced asset is missing, fall back sensibly within the same "side"
    const altKey = useBack
      ? shade === 'lighter'
        ? 'back_darker'
        : 'back_lighter'
      : shade === 'lighter'
        ? 'logo_darker'
        : 'logo_lighter';
    const alt = get(altKey);
    if (validLogo(alt)) return alt;

    // Last resorts (front side)
    if (validLogo(get('logo_darker'))) return get('logo_darker');
    if (validLogo(get('logo_lighter'))) return get('logo_lighter');
    return null;
  }

  // Original behavior (no override)
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

/* --------------------- angle helper --------------------- */
const getAngleDeg = p => {
  if (!p) return 0;
  if (typeof p.rotation === 'number' && !Number.isNaN(p.rotation)) return Math.round(p.rotation);
  if (typeof p.angle_deg === 'number' && !Number.isNaN(p.angle_deg)) return Math.round(p.angle_deg);
  if (typeof p.angle === 'number' && !Number.isNaN(p.angle))
    return Math.round((p.angle * 180) / Math.PI);
  return 0;
};

/* --------------------- small util for ratio-ish % --------------------- */
const percentDiff = (a, b) => {
  if (!a) return 1;
  return Math.min(1, Math.abs(b) / Math.abs(a));
};

/* --------------------- DRY helper for logo placement --------------------- */

/**
 * Build the two Cloudinary transform segments (overlay + apply) for a single placement.
 *
 * INPUTS
 * - overlayId  : Cloudinary public ID of the logo layer (already parsed, no file extension).
 * - logoW/H    : Natural (pixel) size of the chosen logo asset.
 * - placement  : { xPercent, yPercent, wPercent, hPercent, rotation/angle..., extent?: boolean }
 *                Coordinates are normalized (0..1) relative to the base image.
 *                When placement.extent === false (or placement.extend === false), we DO NOT upscale
 *                the fitted logo beyond the placement box (no step-scaling, no legacy bump).
 * - naturalW/H : The pixel size of the base render canvas the percentages map onto.
 * - useRelative: When true, we write "fl_relative" on both overlay and apply segments.
 *
 * OUTPUT
 * - Array of exactly two strings:
 *   [ "l_<overlayId>,...size/fit...", "fl_layer_apply,...position..." ]
 *   or [] if invalid inputs. You then push these into your transform pipeline.
 *
 * SEMANTICS
 * - We "aspect-fit" the logo into the placement box using Cloudinary `c_pad,g_center`.
 * - If the placement has rotation (angle != 0), we position via the image center to avoid drift:
 *     overlay: ... , a_<angle>
 *     apply  : fl_layer_apply, g_center, x_<offset-from-center>, y_<offset-from-center>
 * - If no rotation, we position by top-left (north_west) and center the fitted logo inside the box.
 * - Optional step-scaling heuristic (ENABLE_LOGO_STEP_SCALING) adjusts fitted size for logos
 *   that are not "very" horizontal/vertical — but this is DISABLED when extent === false.
 */
const buildLogoPlacementTransforms = ({
  overlayId,
  logoW,
  logoH,
  placement,
  naturalW,
  naturalH,
  useRelative = false,
}) => {
  // console.log('buildLogoPlacementTransforms:::placement', placement);
  // --- Basic guards
  if (!overlayId || !placement) return [];
  const { xPercent, yPercent, wPercent, hPercent } = placement;
  if (
    xPercent == null ||
    yPercent == null ||
    wPercent == null ||
    hPercent == null ||
    !naturalW ||
    !naturalH
  ) {
    return [];
  }

  // console.log('buildLogoPlacementTransforms::placement', placement);

  // Respect extent flag (also accept legacy 'extend' typo just in case)
  const preventExtent = placement?.extent === false || placement?.extend === false;

  // --- Normalize logo dimensions
  const lw = Number(logoW) || 0;
  const lh = Number(logoH) || 0;

  // --- Convert normalized placement to absolute pixels on the render canvas
  const x = Math.round(xPercent * naturalW);
  const y = Math.round(yPercent * naturalH);
  const w = Math.round(wPercent * naturalW);
  const h = Math.round(hPercent * naturalH);

  // --- Orientations
  const logoOrientation = getOrientation(lw, lh);
  const boxOrientation = getOrientation(w, h);

  // --- Aspect ratios
  const logoAspect = lw / lh;
  const boxAspect = w / h;

  // --- Aspect-fit (no crop): start always <= box
  let fitW, fitH;
  if (logoAspect >= boxAspect) {
    fitW = w;
    fitH = Math.round(w / logoAspect);
  } else {
    fitH = h;
    fitW = Math.round(h * logoAspect);
  }

  // --- Legacy scale-up for cross-orientation → ONLY if extent is allowed
  if (!preventExtent) {
    const doScaleUp = logoOrientation !== boxOrientation;
    const aspectDiff = Math.abs(logoAspect - boxAspect) / Math.max(logoAspect, boxAspect);
    if (doScaleUp && aspectDiff > ASPECT_DIFF_THRESHOLD) {
      fitW = Math.round(fitW * SCALE_UP_FACTOR);
      fitH = Math.round(fitH * SCALE_UP_FACTOR);
    }
  }

  // --- Step-scaling heuristic → ONLY if extent is allowed
  if (ENABLE_LOGO_STEP_SCALING && !preventExtent) {
    let horizontalReduce = 1.0;
    let verticalReduce = 1.0;

    if (boxOrientation === 'horizontal') {
      if (lw > lh) {
        const diff = percentDiff(lw, lh);
        if (diff <= 0.8) horizontalReduce = 0.8;
      }
      const widthRatio = fitW / w;
      if (fitW < w && widthRatio < 0.8) {
        fitW = Math.round(fitW * (1.4 * horizontalReduce));
        fitH = Math.round(fitH * (1.4 * horizontalReduce));
      }
      if (fitW < w && widthRatio < 0.6) {
        fitW = Math.round((fitW / (1.4 * horizontalReduce)) * (1.6 * horizontalReduce));
        fitH = Math.round((fitH / (1.4 * horizontalReduce)) * (1.6 * horizontalReduce));
      }
      if (fitW < w && widthRatio < 0.4) {
        fitW = Math.round((fitW / (1.6 * horizontalReduce)) * (1.8 * horizontalReduce));
        fitH = Math.round((fitH / (1.6 * horizontalReduce)) * (1.8 * horizontalReduce));
      }
    } else if (boxOrientation === 'vertical') {
      if (lh > lw) {
        const diff = percentDiff(lh, lw);
        if (diff <= 0.8) verticalReduce = 0.8;
      }
      const heightRatio = fitH / h;
      if (fitH < h && heightRatio < 0.8) {
        fitW = Math.round(fitW * (1.4 * verticalReduce));
        fitH = Math.round(fitH * (1.4 * verticalReduce));
      }
      if (fitH < h && heightRatio < 0.6) {
        fitW = Math.round((fitW / (1.4 * verticalReduce)) * (1.6 * verticalReduce));
        fitH = Math.round((fitH / (1.4 * verticalReduce)) * (1.6 * verticalReduce));
      }
      if (fitH < h && heightRatio < 0.4) {
        fitW = Math.round((fitW / (1.6 * verticalReduce)) * (1.8 * verticalReduce));
        fitH = Math.round((fitH / (1.6 * verticalReduce)) * (1.8 * verticalReduce));
      }
    }
  }

  // --- Final clamp: if extent is prevented, NEVER exceed the box
  if (preventExtent) {
    fitW = Math.min(fitW, w);
    fitH = Math.min(fitH, h);
  }

  // --- Rotation handling
  const angleDeg = getAngleDeg(placement);
  const maybeRel = useRelative ? 'fl_relative,' : '';

  if (!angleDeg) {
    // NON-ROTATED: top-left positioning, centered in (x,y,w,h)
    const logoX = x + Math.round((w - fitW) / 2);
    const logoY = y + Math.round((h - fitH) / 2);
    const overlay = `l_${overlayId},c_pad,${maybeRel}w_${fitW},h_${fitH},g_center,b_auto`;
    const apply = `fl_layer_apply,${maybeRel}x_${logoX},y_${logoY},g_north_west`;
    return [overlay, apply];
  } else {
    // ROTATED: center positioning to avoid drift
    const cx = x + Math.round(w / 2);
    const cy = y + Math.round(h / 2);
    const offX = cx - Math.round(naturalW / 2);
    const offY = cy - Math.round(naturalH / 2);
    const overlay = `l_${overlayId},c_pad,${maybeRel}w_${fitW},h_${fitH},g_center,b_auto,a_${angleDeg}`;
    const apply = `fl_layer_apply,${maybeRel}g_center,x_${offX},y_${offY}`;
    return [overlay, apply];
  }
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

/* ------------------------ FULL builder (absolute px) ------------------------ */

export const buildCloudinaryMockupUrl = ({
  baseUrl,
  baseW,
  baseH,
  baseHex,
  placements = [],
  logos = {},
  productId = null,
  baseShade = '',
}) => {
  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  if (!baseW || !baseH) return baseUrl;

  // console.log(`logos:${productId}`, logos);

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  const naturalW = baseW;
  const naturalH = baseH;

  placements.forEach(p => {
    const parsedLogoObj = pickLogoVariant(logos, !!p.__useBack, bgIsDark, baseShade);
    if (!parsedLogoObj) return;

    const parsedLogo = parseCloudinaryIds(parsedLogoObj.url);
    if (!parsedLogo.overlayId) return;

    const segs = buildLogoPlacementTransforms({
      overlayId: parsedLogo.overlayId,
      logoW: parsedLogoObj.width,
      logoH: parsedLogoObj.height,
      placement: p,
      naturalW,
      naturalH,
      useRelative: false, // absolute
    });
    if (segs.length) transforms.push(...segs);
  });

  if (!transforms.length) return baseUrl;

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};

/* ------------------------ RELATIVE builder (0..1) ------------------------ */
export const buildRelativeMockupUrl = ({
  baseUrl,
  placements = [],
  logos = {},
  baseHex = '#ffffff',
  max = 900,
  maxH = null,
  productId = null,
  baseW = 0,
  baseH = 0,
  baseShade = '',
}) => {
  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  // if !max and baseW, baseH zero then return baseUrl but if max is set then continue, also if !max and baseW, baseH set then continue
  if (!max && (!baseW || !baseH)) return baseUrl;

  // console.log(`logos:${productId}`, logos);

  // if max is not set then use baseW
  if (!max) {
    max = baseW;
    maxH = baseH;
  }

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  transforms.push(`f_auto,q_auto,c_fit,w_${max}${maxH ? `,h_${maxH}` : ''}`);

  const naturalW = max;
  const naturalH = getAspectHeight(baseW, baseH, max);

  placements.forEach(p => {
    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark, baseShade);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    if (p.xPercent == null || p.yPercent == null || p.wPercent == null || p.hPercent == null)
      return;

    const segs = buildLogoPlacementTransforms({
      overlayId: parsedLogo.overlayId,
      logoW: chosen.width,
      logoH: chosen.height,
      placement: p,
      naturalW,
      naturalH,
      useRelative: true, // keep original fl_relative here
    });
    if (segs.length) transforms.push(...segs);
  });

  if (transforms.length <= 1) return baseUrl;

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};

/* ---------------------- Public generators ---------------------- */

export const generateProductImageUrl = (product, logos, opts = {}) => {
  if (!product) return '';

  let baseUrl = product.thumbnail;
  let baseW = Number(product?.thumbnail_meta?.width) || 0;
  let baseH = Number(product?.thumbnail_meta?.height) || 0;
  let baseHex = product?.thumbnail_meta?.thumbnail_color || '#ffffff';
  let baseShade = ''; // <— NEW

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const idx = Number(opts?.colorIndex ?? 0);
    const clr = product.acf.color[idx] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseW = Number(clr?.thumbnail?.width) || baseW;
      baseH = Number(clr?.thumbnail?.height) || baseH;
      baseHex = clr?.color_hex_code || baseHex;
    }
    baseShade = normalizeShade(clr?.lightdark); // <— NEW ('' if invalid)
  }

  const rawPlacements = resolvePlacements(product, opts);
  // Gate can be disabled globally
  const allowBack = ENABLE_ALLOW_BACK_GATE ? isBackAllowedForProduct(product?.id, opts) : true;

  const activePlacements = rawPlacements.filter(p => p?.active === true);

  const placements = activePlacements.map(p => {
    const forced =
      typeof p.__forceBack === 'boolean'
        ? p.__forceBack
        : getOverrideFor(product?.id, p?.name, opts.overrideScope);
    const defaultBack = !!(p?.back && (ENABLE_ALLOW_BACK_GATE ? allowBack : true));
    const __useBack = typeof forced === 'boolean' ? forced : defaultBack;
    return { ...p, __useBack };
  });

  if (!opts?.max) {
    if (!baseW || !baseH) {
      return buildRelativeMockupUrl({
        baseUrl,
        placements,
        logos,
        baseHex,
        max: 900,
        productId: product?.id || null,
        baseShade, // <— NEW
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
      baseShade, // <— NEW
    });
  }

  return buildRelativeMockupUrl({
    baseUrl,
    placements,
    logos,
    baseHex,
    max: Number(opts.max) || 900,
    productId: product?.id || null,
    baseW,
    baseH,
    baseShade, // <— NEW
  });
};

/* ---------------------- Cart / Hover thumbs (relative) ---------------------- */

// Normalize line/group type (handles "Quantity", "Quanity", "qty", etc.)
const normalizeLineType = raw => {
  const t = String(raw || '')
    .trim()
    .toLowerCase();
  if (!t) return '';
  if (t === 'group' || t.startsWith('grp')) return 'group';
  // treat anything that looks like "quan..." or "qty" as quantity
  if (t.startsWith('quan') || t === 'qty' || t === 'quantity' || t === 'quanity') return 'quantity';
  return t;
};

/** Resolve base url/hex and intrinsic dimensions for cart rows.
 *  - Group: prefer the selected color's thumbnail (and its W/H from ACF).
 *  - Quantity (and everything that looks like "quan"/"qty"): use product thumbnail meta.
 */
const resolveCartBaseFromItem = item => {
  // Defaults from the line item
  let url = item?.thumbnail || '';
  let hex = item?.thumbnail_meta?.thumbnail_color || '#ffffff';
  let width = Number(item?.thumbnail_meta?.width) || 0;
  let height = Number(item?.thumbnail_meta?.height) || 0;
  let baseShade = ''; // <— NEW

  // Look for a type in several places and normalize ("Quantity" vs "Quanity" etc.)
  const rawType =
    item?.options?.group_type ??
    item?.options?.line_type ??
    item?.pricing?.type ?? // <-- important for Quantity rows
    item?.product?.acf?.group_type ??
    '';
  const type = normalizeLineType(rawType);

  if (type === 'group') {
    // Try the explicitly chosen color first
    const directUrl = item?.options?.color_thumbnail_url || '';
    const colorTitle = item?.options?.color || '';
    const colorLightdarkOpt = item?.options?.color_lightdark || item?.options?.lightdark || ''; // optional fallback

    if (directUrl) {
      url = directUrl;
      hex = item?.options?.color_hex_code || hex;
      baseShade = normalizeShade(colorLightdarkOpt); // may still be ''
    }

    // Pull W/H from ACF color row if possible
    const colors = item?.product?.acf?.color;
    if (Array.isArray(colors)) {
      let match = null;
      if (directUrl) match = colors.find(c => c?.thumbnail?.url === directUrl) || null;
      if (!match && colorTitle) {
        const lc = s => (s || '').toLowerCase();
        match = colors.find(c => lc(c?.title) === lc(colorTitle)) || null;
      }
      if (match?.thumbnail?.url) {
        url = match.thumbnail.url;
        width = Number(match?.thumbnail?.width) || width;
        height = Number(match?.thumbnail?.height) || height;
        hex = match?.color_hex_code || hex;
        // Prefer ACF lightdark if present
        baseShade = normalizeShade(match?.lightdark) || baseShade;
      }
    }
  }

  // For QUANTITY or if dims still unknown → use product-level meta
  if (!width || !height || !isCloudinaryUrl(url) || type === 'quantity') {
    if (!url && item?.product?.thumbnail) url = item.product.thumbnail;
    width = Number(item?.product?.thumbnail_meta?.width) || width;
    height = Number(item?.product?.thumbnail_meta?.height) || height;
    if (!hex) hex = item?.product?.thumbnail_meta?.thumbnail_color || hex;
  }

  return { url, hex, width, height, type, baseShade };
};

export const generateCartThumbUrlFromItem = (
  item,
  logos,
  { max = 200, pagePlacementMap, customBackAllowedSet, overrideScope } = {}
) => {
  if (!item) return '';

  const pid = item?.product_id || item?.product?.id || null;
  const pidStr = String(pid ?? '');
  const base = resolveCartBaseFromItem(item);
  if (!isCloudinaryUrl(base.url)) return base.url || item?.thumbnail || '';

  // Decide placements strategy:
  // - Quantity: mimic ProductList thumbnails exactly => use page overrides > product placements (ignore line snapshot)
  // - Group (default): keep existing snapshot-first behavior to avoid regressions users liked
  const isQuantity = normalizeLineType(base.type) === 'quantity';

  let rawPlacements = [];
  if (isQuantity) {
    // same as generateProductImageUrl
    if (
      pagePlacementMap &&
      pidStr &&
      Array.isArray(pagePlacementMap[pidStr]) &&
      pagePlacementMap[pidStr].length
    ) {
      rawPlacements = pagePlacementMap[pidStr];
    } else if (Array.isArray(item?.product?.placement_coordinates)) {
      rawPlacements = item.product.placement_coordinates;
    }
  } else {
    // existing cart behavior
    if (pagePlacementMap && pidStr && Array.isArray(pagePlacementMap[pidStr])) {
      rawPlacements = pagePlacementMap[pidStr];
    } else if (Array.isArray(item?.placement_coordinates)) {
      rawPlacements = item.placement_coordinates;
    } else if (Array.isArray(item?.product?.placement_coordinates)) {
      rawPlacements = item.product.placement_coordinates;
    }
  }

  rawPlacements = rawPlacements.filter(p => p?.active === true);
  if (!rawPlacements.length) return base.url;

  // console.log(`generateCartThumbUrlFromItem::rawPlacements::${item?.product?.id}`, rawPlacements);

  // If we have intrinsic base dims, run the exact relative builder like the grid
  if (base.width > 0 && base.height > 0) {
    const allowBack = ENABLE_ALLOW_BACK_GATE
      ? isBackAllowedForProduct(pid, { customBackAllowedSet })
      : true;
    const placements = rawPlacements.map(p => {
      const forced =
        typeof p.__forceBack === 'boolean'
          ? p.__forceBack
          : getOverrideFor(pid, p?.name, overrideScope);
      const defaultBack = !!(p?.back && (ENABLE_ALLOW_BACK_GATE ? allowBack : true));
      const __useBack = typeof forced === 'boolean' ? forced : defaultBack;
      // console.log(`generateCartThumbUrlFromItem::::${item?.product?.id}`, p, `forced:${forced}`, `defaultBack:${defaultBack}`, `__useBack:${__useBack}`);
      return { ...p, __useBack };
    });

    // console.log(`generateCartThumbUrlFromItem::placements::${item?.product?.id}`, placements);

    return buildRelativeMockupUrl({
      baseUrl: base.url,
      placements,
      logos,
      baseHex: base.hex,
      max: Number(max) || 200,
      productId: pid,
      baseW: base.width,
      baseH: base.height,
      baseShade: base.baseShade,
    });
  }

  // Fallback: legacy square relative math (only if dims unknown)
  const parsedBase = parseCloudinaryIds(base.url);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return base.url;

  if (!logos?.logo_darker?.url || !isCloudinaryUrl(logos.logo_darker.url)) return base.url;
  const bgIsDark = isDarkHex(base.hex);

  const allowBackRaw = Array.isArray(customBackAllowedSet)
    ? customBackAllowedSet.map(String).includes(pidStr)
    : !!(
        customBackAllowedSet &&
        typeof customBackAllowedSet.has === 'function' &&
        customBackAllowedSet.has(pidStr)
      );

  const allowBack = ENABLE_ALLOW_BACK_GATE ? allowBackRaw : true;
  const placements = rawPlacements.map(p => {
    const forced = typeof p.__forceBack === 'boolean' ? p.__forceBack : undefined;
    const defaultBack = !!(p?.back && allowBack);
    const __useBack = typeof forced === 'boolean' ? forced : defaultBack;
    return { ...p, __useBack };
  });

  const transforms = [`f_auto,q_auto,c_fit,w_${max},h_${max}`];

  placements.forEach(p => {
    if (p.xPercent == null || p.yPercent == null || p.wPercent == null || p.hPercent == null)
      return;

    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark, base.baseShade);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    // This legacy path already strictly aspect-fits and never upsizes beyond the box,
    // so extent=false is naturally respected here.
    let relW = p.wPercent,
      relH = p.hPercent;
    if (lw > 0 && lh > 0) {
      const la = lw / lh,
        ba = p.wPercent / p.hPercent;
      if (la > ba) {
        relW = p.wPercent;
        relH = p.wPercent / la;
      } else {
        relH = p.hPercent;
        relW = p.hPercent * la;
      }
    }

    const angleDeg = getAngleDeg(p);
    if (!angleDeg) {
      const relX = p.xPercent + (p.wPercent - relW) / 2;
      const relY = p.yPercent + (p.hPercent - relH) / 2;
      transforms.push(
        `l_${parsedLogo.overlayId},c_pad,fl_relative,w_${relW.toFixed(6)},h_${relH.toFixed(6)},g_center,b_auto`,
        `fl_layer_apply,fl_relative,x_${relX.toFixed(6)},y_${relY.toFixed(6)},g_north_west`
      );
    } else {
      const cRelX = p.xPercent + p.wPercent / 2;
      const cRelY = p.yPercent + p.hPercent / 2;
      const offRelX = (cRelX - 0.5).toFixed(6);
      const offRelY = (cRelY - 0.5).toFixed(6);
      transforms.push(
        `l_${parsedLogo.overlayId},c_pad,fl_relative,w_${relW.toFixed(6)},h_${relH.toFixed(6)},g_center,b_auto,a_${angleDeg}`,
        `fl_layer_apply,fl_relative,g_center,x_${offRelX},y_${offRelY}`
      );
    }
  });

  if (transforms.length <= 1) return base.url;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};

export const generateHoverThumbUrlFromItem = (
  item,
  logos,
  { max = 400, pagePlacementMap, customBackAllowedSet } = {}
) => generateCartThumbUrlFromItem(item, logos, { max, pagePlacementMap, customBackAllowedSet });

/* ---------------------- Overlay preview (color bbox fixed; logos conditional) ---------------------- */

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
  let baseW = Number(product?.thumbnail_meta?.width) || 0;
  let baseH = Number(product?.thumbnail_meta?.height) || 0;
  let baseShade = ''; // <— NEW

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const clr = product.acf.color[Number(colorIndex) || 0] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseHex = clr?.color_hex_code || baseHex;
    }
    baseShade = normalizeShade(clr?.lightdark); // <— NEW
  }

  const rawPlacements = resolvePlacements(product, { pagePlacementMap });
  const placementsActive = rawPlacements.filter(p => p?.active === true);
  // const allowBack = ENABLE_ALLOW_BACK_GATE
  //   ? isBackAllowedForProduct(product?.id, { customBackAllowedSet })
  //   : true;
  // const placements = placementsActive.map(p => {
  //   const forced = typeof p.__forceBack === 'boolean' ? p.__forceBack : undefined;
  //   const defaultBack = !!(p?.back && allowBack);
  //   const __useBack = typeof forced === 'boolean' ? forced : defaultBack;
  //   return { ...p, __useBack };
  // });

  const allowBack = isBackAllowedForProduct(product?.id, { customBackAllowedSet });
  const placements = placementsActive.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));

  if (!placements.length) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const transforms = [`f_auto,q_auto,c_fit,w_${Number(max) || 900}`];

  const hex = (overlayHex || '#000000').replace('#', '');
  const op = Math.max(0, Math.min(overlayOpacity, 100));

  // Colorized bbox (unchanged)...
  placements.forEach(p => {
    const { xPercent, yPercent, wPercent, hPercent } = p || {};
    if (xPercent == null || yPercent == null || wPercent == null || hPercent == null) return;
    const angleDeg = getAngleDeg(p);

    if (!angleDeg) {
      transforms.push(
        `l_one_pixel_s4c3vt,fl_relative,w_${wPercent.toFixed(6)},h_${hPercent.toFixed(6)}`,
        `co_rgb:${hex},e_colorize:100,o_${op},fl_layer_apply,fl_relative,x_${xPercent.toFixed(6)},y_${yPercent.toFixed(6)},g_north_west`
      );
    } else {
      const cRelX = xPercent + wPercent / 2;
      const cRelY = yPercent + hPercent / 2;
      const offRelX = (cRelX - 0.5).toFixed(6);
      const offRelY = (cRelY - 0.5).toFixed(6);
      transforms.push(
        `l_one_pixel_s4c3vt,fl_relative,w_${wPercent.toFixed(6)},h_${hPercent.toFixed(6)},a_${angleDeg}`,
        `co_rgb:${hex},e_colorize:100,o_${op},fl_layer_apply,fl_relative,g_center,x_${offRelX},y_${offRelY}`
      );
    }
  });

  // Logos with override-aware pick
  const bgIsDark = isDarkHex(baseHex);
  const naturalW = max;
  const naturalH = getAspectHeight(baseW, baseH, naturalW);

  placements.forEach(p => {
    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark, baseShade); // <— NEW
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const segs = buildLogoPlacementTransforms({
      overlayId: parsedLogo.overlayId,
      logoW: chosen.width,
      logoH: chosen.height,
      placement: p,
      naturalW,
      naturalH,
      useRelative: false,
    });
    if (segs.length) transforms.push(...segs);
  });

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};
