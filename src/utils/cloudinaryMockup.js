// /src/utils/cloudinaryMockup.js
// Rotation-safe placement: WHEN rotated, position by CENTER; otherwise keep old top-left placement.

const ENV_CLOUD =
  process.env.NEXT_PUBLIC_CLD_CLOUD || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** Toggle the new "step-scaling" logic.
 * Set NEXT_PUBLIC_ENABLE_LOGO_STEP_SCALING=0 to disable.
 */
export const ENABLE_LOGO_STEP_SCALING = '1';

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
 * - placement  : { xPercent, yPercent, wPercent, hPercent, rotation/angle... }
 *                Coordinates are normalized (0..1) relative to the base image.
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
 * - NEW: Optional step-scaling heuristic (ENABLE_LOGO_STEP_SCALING) adjusts fitted size for logos
 *        that are not "very" horizontal/vertical, using thresholds at 80% / 60% / 40%.
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
  // --- Basic guards: we can't build anything without an overlay, a placement, or a canvas size.
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

  // --- Normalize logo dimensions (defensive: default to 0 if NaN/undefined).
  const lw = Number(logoW) || 0; // logo natural width in px
  const lh = Number(logoH) || 0; // logo natural height in px

  // --- Convert normalized placement (% of base) to absolute pixels on the render canvas.
  //     e.g. if xPercent=0.25 and naturalW=2000, x becomes 500 px.
  const x = Math.round(xPercent * naturalW); // placement left (px)
  const y = Math.round(yPercent * naturalH); // placement top  (px)
  const w = Math.round(wPercent * naturalW); // placement width (px)
  const h = Math.round(hPercent * naturalH); // placement height(px)

  // --- Determine orientations for both logo and box.
  //     getOrientation returns 'horizontal' | 'vertical' | 'square' using aspect thresholds.
  const logoOrientation = getOrientation(lw, lh);
  const boxOrientation = getOrientation(w, h);

  // --- Aspect ratios for fit decision: we "c_pad" the logo into the box.
  const logoAspect = lw / lh; // >1 means wider than tall
  const boxAspect = w / h; // >1 means wider than tall

  // --- Aspect-fit into the placement rectangle (no cropping).
  //     If logo is relatively "wider" than the box, we fit by width; otherwise by height.
  //     This reproduces Cloudinary c_pad behavior we want to reflect explicitly in size.
  let fitW, fitH;
  if (logoAspect >= boxAspect) {
    fitW = w; // take the full box width
    fitH = Math.round(w / logoAspect); // compute height to preserve logo aspect
  } else {
    fitH = h; // take the full box height
    fitW = Math.round(h * logoAspect); // compute width to preserve logo aspect
  }

  // --- Legacy "cross-orientation" scaling:
  //     If logo orientation mismatches the box orientation by a big margin,
  //     gently scale it up (SCALE_UP_FACTOR) to visually fill better.
  const doScaleUp = logoOrientation !== boxOrientation;
  const aspectDiff = Math.abs(logoAspect - boxAspect) / Math.max(logoAspect, boxAspect);
  if (doScaleUp && aspectDiff > ASPECT_DIFF_THRESHOLD) {
    fitW = Math.round(fitW * SCALE_UP_FACTOR);
    fitH = Math.round(fitH * SCALE_UP_FACTOR);
  }

  // ======================================================================
  // NEW: Step-scaling heuristic (gated by ENABLE_LOGO_STEP_SCALING)
  // ----------------------------------------------------------------------
  // Why: Some logos are only *slightly* wider (or taller) than they are high (or wide),
  // which can look undersized after a strict aspect-fit. We apply extra scaling for:
  // - Horizontal boxes: if the logo isn't *strongly* horizontal (W>H but not by much),
  //   reduce the scaling percentages by 20%, then step up size if the fitted width is
  //   less than 80%/60%/40% of the box width (scale_40/60/80).
  // - Vertical boxes: same idea but measured against height ratios.
  // Expectations:
  // - Logos that are clearly horizontal/vertical remain mostly unchanged.
  // - Logos near-square in a strong orientation box get a tasteful size boost.
  // - Disabled entirely when NEXT_PUBLIC_ENABLE_LOGO_STEP_SCALING=0.
  // ======================================================================
  if (ENABLE_LOGO_STEP_SCALING) {
    // Reduction multipliers: default 1.0 (no reduction); become 0.8 (reduce 20%) when triggered.
    let horizontalReduce = 1.0;
    let verticalReduce = 1.0;

    if (boxOrientation === 'horizontal') {
      // "width-to-height difference percentage of the logo"
      // We treat `percentDiff(lw, lh)` ~ (H/W) bounded to [0..1]. Smaller => more horizontal.
      if (lw > lh) {
        const diff = percentDiff(lw, lh);
        // If logo is wider than tall but not *very* wide (<= 80%), dampen step multipliers by 20%.
        if (diff <= 0.8) horizontalReduce = 0.8;
      }

      // Width-based step thresholds: compare fitted width vs box width.
      const widthRatio = fitW / w;

      // If fitted width < 80% of box width → scale_40 (multiply by 1.4, reduced by horizontalReduce).
      if (fitW < w && widthRatio < 0.8) {
        fitW = Math.round(fitW * (1.4 * horizontalReduce));
        fitH = Math.round(fitH * (1.4 * horizontalReduce));
      }
      // If still < 60% → scale_60 (upgrade from previous 1.4 to 1.6; we revert then reapply).
      if (fitW < w && widthRatio < 0.6) {
        fitW = Math.round((fitW / (1.4 * horizontalReduce)) * (1.6 * horizontalReduce));
        fitH = Math.round((fitH / (1.4 * horizontalReduce)) * (1.6 * horizontalReduce));
      }
      // If still < 40% → scale_80 (upgrade from previous 1.6 to 1.8; revert then reapply).
      if (fitW < w && widthRatio < 0.4) {
        fitW = Math.round((fitW / (1.6 * horizontalReduce)) * (1.8 * horizontalReduce));
        fitH = Math.round((fitH / (1.6 * horizontalReduce)) * (1.8 * horizontalReduce));
      }
    } else if (boxOrientation === 'vertical') {
      // "height-to-width difference percentage of the logo"
      // We treat `percentDiff(lh, lw)` ~ (W/H) bounded to [0..1]. Smaller => more vertical.
      if (lh > lw) {
        const diff = percentDiff(lh, lw);
        // If logo is taller than wide but not *very* tall (<= 80%), dampen step multipliers by 20%.
        if (diff <= 0.8) verticalReduce = 0.8;
      }

      // Height-based step thresholds: compare fitted height vs box height.
      const heightRatio = fitH / h;

      // If fitted height < 80% of box height → scale_40 (multiply by 1.4, reduced by verticalReduce).
      if (fitH < h && heightRatio < 0.8) {
        fitW = Math.round(fitW * (1.4 * verticalReduce));
        fitH = Math.round(fitH * (1.4 * verticalReduce));
      }
      // If still < 60% → scale_60 (upgrade from previous 1.4 to 1.6; we revert then reapply).
      if (fitH < h && heightRatio < 0.6) {
        fitW = Math.round((fitW / (1.4 * verticalReduce)) * (1.6 * verticalReduce));
        fitH = Math.round((fitH / (1.4 * verticalReduce)) * (1.6 * verticalReduce));
      }
      // If still < 40% → scale_80 (upgrade from previous 1.6 to 1.8; revert then reapply).
      if (fitH < h && heightRatio < 0.4) {
        fitW = Math.round((fitW / (1.6 * verticalReduce)) * (1.8 * verticalReduce));
        fitH = Math.round((fitH / (1.6 * verticalReduce)) * (1.8 * verticalReduce));
      }
    }
    // For 'square' boxes we intentionally do nothing: the base aspect-fit is visually acceptable.
  }

  // --- Rotation handling: we compute the angle (deg). 0 means "no rotation".
  const angleDeg = getAngleDeg(placement);

  // --- Relative flag: when true, we add "fl_relative," to both segments.
  const maybeRel = useRelative ? 'fl_relative,' : '';

  if (!angleDeg) {
    // =========================
    // NON-ROTATED PLACEMENT
    // -------------------------
    // We want the logo centered inside the placement rectangle (x,y,w,h).
    // Since Cloudinary `c_pad,g_center` fits the content inside the requested w/h,
    // we position the final fitted size by offsetting from the top-left corner:
    //   logoX = x + (w - fitW)/2
    //   logoY = y + (h - fitH)/2
    const logoX = x + Math.round((w - fitW) / 2);
    const logoY = y + Math.round((h - fitH) / 2);

    // Segment 1 (overlay): build the layer with size and pad fit.
    // - l_<overlayId> : select the overlay asset
    // - c_pad         : pad-fit (no crop), honoring the specified w_/h_
    // - g_center      : center within that box
    // - b_auto        : auto background for padding (invisible when composited)
    // - w_/h_         : target box for pad-fit (our computed fitW/fitH already aspect-safe)
    const overlay = `l_${overlayId},c_pad,${maybeRel}w_${fitW},h_${fitH},g_center,b_auto`;

    // Segment 2 (apply): place the already-prepared overlay onto the base image.
    // - fl_layer_apply : commit the overlay onto the base
    // - g_north_west   : interpret x/y from the top-left corner of the base image
    // - x_/y_          : offset in pixels (or relative units if fl_relative) from g_north_west
    const apply = `fl_layer_apply,${maybeRel}x_${logoX},y_${logoY},g_north_west`;

    return [overlay, apply];
  } else {
    // ======================
    // ROTATED PLACEMENT
    // ----------------------
    // When rotation is applied, using top-left (north_west) tends to "drift."
    // Instead, we:
    // 1) Prepare the fitted overlay with the angle.
    // 2) Apply it relative to the center of the base image (g_center).
    // 3) Translate by the delta from image center to the *center of the placement box*.
    //
    // Center of placement box in absolute px:
    const cx = x + Math.round(w / 2);
    const cy = y + Math.round(h / 2);

    // Offsets from the base image center:
    const offX = cx - Math.round(naturalW / 2);
    const offY = cy - Math.round(naturalH / 2);

    // Segment 1 (overlay): same pad-fit, but include rotation (a_<deg>).
    const overlay = `l_${overlayId},c_pad,${maybeRel}w_${fitW},h_${fitH},g_center,b_auto,a_${angleDeg}`;

    // Segment 2 (apply): place via image center to avoid drift.
    // - g_center : (0,0) now refers to the center of the base image.
    // - x_/y_    : signed offsets from the center to land the logo at the placement center.
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
}) => {
  // console.log('buildCloudinaryMockupUrl', {
  //   baseUrl,
  //   baseW,
  //   baseH,
  //   baseHex,
  //   placements,
  //   logos,
  //   productId,
  // });
  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  if (!baseW || !baseH) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const bgIsDark = isDarkHex(baseHex);
  const transforms = [];

  const naturalW = baseW;
  const naturalH = baseH;

  placements.forEach(p => {
    const parsedLogoObj = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
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
}) => {
  // console.log('buildRelativeMockupUrl', {
  //   baseUrl,
  //   placements,
  //   logos,
  //   baseHex,
  //   max,
  //   maxH,
  //   productId,
  // });
  if (!isCloudinaryUrl(baseUrl)) return baseUrl;
  if (!Array.isArray(placements) || placements.length === 0) return baseUrl;
  if (!validLogo(logos?.logo_darker)) return baseUrl;
  // if !max and baseW, baseH zero then return baseUrl but if max is set then continue, also if !max and baseW, baseH set then continue
  if (!max && (!baseW || !baseH)) return baseUrl;

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

  console.log(`=====${productId}=====`, naturalW,naturalH);

  placements.forEach(p => {
    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
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

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const idx = Number(opts?.colorIndex ?? 0);
    const clr = product.acf.color[idx] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseW = Number(clr?.thumbnail?.width) || baseW;
      baseH = Number(clr?.thumbnail?.height) || baseH;
      baseHex = clr?.color_hex_code || baseHex;
    }
  }

  const rawPlacements = resolvePlacements(product, opts);
  const allowBack = isBackAllowedForProduct(product?.id, opts);

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
  });
};

/* ---------------------- Cart / Hover thumbs (relative) ---------------------- */

// Normalize line/group type (handles "Quantity", "Quanity", "qty", etc.)
const normalizeLineType = raw => {
  const t = String(raw || '').trim().toLowerCase();
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
  let width  = Number(item?.thumbnail_meta?.width)  || 0;
  let height = Number(item?.thumbnail_meta?.height) || 0;

  // Look for a type in several places and normalize ("Quantity" vs "Quanity" etc.)
  const rawType =
    item?.options?.group_type ??
    item?.options?.line_type ??
    item?.pricing?.type ??                 // <-- important for Quantity rows
    item?.product?.acf?.group_type ?? '';
  const type = normalizeLineType(rawType);

  if (type === 'group') {
    // Try the explicitly chosen color first
    const directUrl  = item?.options?.color_thumbnail_url || '';
    const colorTitle = item?.options?.color || '';

    if (directUrl) {
      url = directUrl;
      hex = item?.options?.color_hex_code || hex;
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
        url    = match.thumbnail.url;
        width  = Number(match?.thumbnail?.width)  || width;
        height = Number(match?.thumbnail?.height) || height;
        hex    = match?.color_hex_code || hex;
      }
    }
  }

  // For QUANTITY or if dims still unknown → use product-level meta
  if (!width || !height || !isCloudinaryUrl(url) || type === 'quantity') {
    if (!url && item?.product?.thumbnail) url = item.product.thumbnail;
    width  = Number(item?.product?.thumbnail_meta?.width)  || width;
    height = Number(item?.product?.thumbnail_meta?.height) || height;
    if (!hex) hex = item?.product?.thumbnail_meta?.thumbnail_color || hex;
  }

  return { url, hex, width, height, type };
};


export const generateCartThumbUrlFromItem = (
  item,
  logos,
  { max = 200, pagePlacementMap, customBackAllowedSet } = {}
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
    if (pagePlacementMap && pidStr && Array.isArray(pagePlacementMap[pidStr]) && pagePlacementMap[pidStr].length) {
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

  const ItemProductID = pid;
  console.log('ItemProductID==before', ItemProductID);
  console.log('pid==before', pid);
  console.log('pid==base', base);

  // If we have intrinsic base dims, run the *exact* relative builder like the grid (prevents "smaller logo" effect)
  if (base.width > 0 && base.height > 0) {
    const allowBack = isBackAllowedForProduct(pid, { customBackAllowedSet });
    const placements = rawPlacements.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));

    console.log('ItemProductID==after', ItemProductID);
    console.log('pid==after', pid);

    return buildRelativeMockupUrl({
      baseUrl: base.url,
      placements,
      logos,
      baseHex: base.hex,
      max: Number(max) || 200,
      productId: pid,
      baseW: base.width,
      baseH: base.height,
    });
  }

  // Fallback: legacy square relative math (only if dims unknown)
  const parsedBase = parseCloudinaryIds(base.url);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return base.url;

  if (!logos?.logo_darker?.url || !isCloudinaryUrl(logos.logo_darker.url)) return base.url;
  const bgIsDark = isDarkHex(base.hex);

  const allowBack =
    Array.isArray(customBackAllowedSet)
      ? customBackAllowedSet.map(String).includes(pidStr)
      : !!(customBackAllowedSet && typeof customBackAllowedSet.has === 'function' && customBackAllowedSet.has(pidStr));

  const placements = rawPlacements.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));
  const transforms = [`f_auto,q_auto,c_fit,w_${max},h_${max}`];

  placements.forEach(p => {
    if (p.xPercent == null || p.yPercent == null || p.wPercent == null || p.hPercent == null) return;

    const chosen = pickLogoVariant(logos, !!p.__useBack, bgIsDark);
    if (!chosen || !isCloudinaryUrl(chosen.url)) return;

    const parsedLogo = parseCloudinaryIds(chosen.url);
    if (!parsedLogo.overlayId) return;

    const lw = Number(chosen.width) || 0;
    const lh = Number(chosen.height) || 0;

    let relW = p.wPercent, relH = p.hPercent;
    if (lw > 0 && lh > 0) {
      const la = lw / lh, ba = p.wPercent / p.hPercent;
      if (la > ba) { relW = p.wPercent; relH = p.wPercent / la; }
      else { relH = p.hPercent; relW = p.hPercent * la; }
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
) =>
  generateCartThumbUrlFromItem(item, logos, { max, pagePlacementMap, customBackAllowedSet });



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

  // base image
  let baseUrl = product.thumbnail;
  let baseHex = product?.thumbnail_meta?.thumbnail_color || '#ffffff';
  let baseW = Number(product?.thumbnail_meta?.width) || 0;
  let baseH = Number(product?.thumbnail_meta?.height) || 0;

  if (product?.acf?.group_type === 'Group' && Array.isArray(product?.acf?.color)) {
    const clr = product.acf.color[Number(colorIndex) || 0] || product.acf.color[0];
    if (clr?.thumbnail?.url) {
      baseUrl = clr.thumbnail.url;
      baseHex = clr?.color_hex_code || baseHex;
    }
  }

  const rawPlacements = resolvePlacements(product, { pagePlacementMap });

  // Only active placements
  const placementsActive = rawPlacements.filter(p => p?.active === true);

  const allowBack = isBackAllowedForProduct(product?.id, { customBackAllowedSet });
  const placements = placementsActive.map(p => ({ ...p, __useBack: !!(p?.back && allowBack) }));

  if (!placements.length) return baseUrl;

  const parsedBase = parseCloudinaryIds(baseUrl);
  const cloud = ENV_CLOUD || parsedBase.cloud;
  if (!cloud || !parsedBase.baseAsset) return baseUrl;

  const transforms = [`f_auto,q_auto,c_fit,w_${Number(max) || 900}`];

  const hex = (overlayHex || '#000000').replace('#', '');
  const op = Math.max(0, Math.min(overlayOpacity, 100));

  // --- Colorized rectangle: with rotation support ---
  placements.forEach(p => {
    const { xPercent, yPercent, wPercent, hPercent } = p || {};
    if (xPercent == null || yPercent == null || wPercent == null || hPercent == null) return;

    const angleDeg = getAngleDeg(p);

    if (!angleDeg) {
      // No rotation: use original top-left positioning
      transforms.push(
        `l_one_pixel_s4c3vt,fl_relative,w_${wPercent.toFixed(6)},h_${hPercent.toFixed(6)}`,
        `co_rgb:${hex},e_colorize:100,o_${op},fl_layer_apply,fl_relative,x_${xPercent.toFixed(6)},y_${yPercent.toFixed(6)},g_north_west`
      );
    } else {
      // With rotation: use center positioning to avoid drift (same logic as logo)
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

  // --- Logo overlays: conditional placement (no-rotation: old; rotation: center) ---
  const bgIsDark = isDarkHex(baseHex);

  const naturalW = max;
  const naturalH = getAspectHeight(baseW, baseH, naturalW);

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

    const segs = buildLogoPlacementTransforms({
      overlayId: parsedLogo.overlayId,
      logoW: chosen.width,
      logoH: chosen.height,
      placement: p,
      naturalW,
      naturalH,
      useRelative: false, // keep original (no fl_relative) here
    });
    if (segs.length) transforms.push(...segs);
  });

  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join('/')}/${parsedBase.baseAsset}`;
};
