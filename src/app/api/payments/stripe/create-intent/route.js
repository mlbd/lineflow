// /src/app/api/payments/stripe/create-intent/route.js
export const runtime = 'nodejs';

/**
 * Stripe – Create PaymentIntent (server-authoritative)
 * Adds verbose logs + per-attempt idempotency using `attemptId`
 * so identical carts still create a new PI on each checkout click.
 *
 * Enable extra logs with STRIPE_DEBUG=1
 */

import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';

const DEBUG = process.env.STRIPE_DEBUG === '1';

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

/* ----------------------------- Validation ----------------------------- */
const Money = z.number().finite().nonnegative();
const Item = z.object({
  product_id: z.any(),
  quantity: z.coerce.number().int().min(1),
  price: z.coerce.number().nonnegative(),
  options: z.any().optional(),
  thumbnail: z.string().optional(),
  name: z.string().optional(),
});

const Body = z.object({
  items: z.array(Item).min(1, 'Cart is empty'),
  coupon: z.any().nullable(),
  shippingCost: Money.default(0),
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.object({
      country: z.string().optional(),
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
    }),
  }),
  note: z.string().optional(),
  slug: z.string().optional(),
  // [NEW] a unique per-click id from the client; forces a *new* PI each checkout attempt
  attemptId: z.string().optional(),
});

/* ------------------------------ Helpers ------------------------------ */
const toCents = (n) => Math.round(Number(n || 0) * 100);

function computeAmountCents(items = [], { coupon = null, shippingCost = 0 } = {}) {
  const subtotalCents = items.reduce(
    (c, it) => c + toCents(it.price) * (parseInt(it.quantity, 10) || 0),
    0
  );
  const shippingCents = toCents(shippingCost);

  let discountCents = 0;
  if (coupon && coupon.valid) {
    const type = String(coupon.type || coupon.discount_type || '').toLowerCase();
    const amount = Number(coupon.amount || 0);
    if (['percent', 'percentage', 'percent_cart'].includes(type)) {
      discountCents = Math.round((subtotalCents * amount) / 100);
    } else if (['fixed', 'fixed_cart'].includes(type)) {
      discountCents = Math.min(subtotalCents, toCents(amount));
    }
  }
  return Math.max(0, subtotalCents - discountCents + shippingCents);
}

// Stable stringify so the same logical payload → same hash
function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  } else if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  } else {
    return JSON.stringify(value);
  }
}

function maskEmail(email = '') {
  try {
    const [u, d] = String(email).split('@');
    if (!u || !d) return email;
    const head = u.slice(0, 2);
    const tail = u.length > 4 ? u.slice(-1) : '';
    return `${head}${'*'.repeat(Math.max(1, u.length - head.length - tail.length))}${tail}@${d}`;
  } catch {
    return email;
  }
}

function summarizeItems(items = []) {
  return items.map((i) => `${i.product_id}:${i.quantity}x@$${Number(i.price).toFixed(2)}`).join(', ');
}

/* ------------------------------ Handler ------------------------------ */
export async function POST(req) {
  const reqId = crypto.randomBytes(4).toString('hex');
  const startedAt = Date.now();

  if (!stripeSecret.startsWith('sk_')) {
    console.error(`[stripe:create-intent][${reqId}] ❌ STRIPE_SECRET_KEY missing or invalid`);
    return new NextResponse(JSON.stringify({ error: 'Stripe secret key not configured.' }), { status: 500 });
  }

  const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

  try {
    let raw;
    try {
      raw = await req.json();
    } catch (e) {
      console.error(`[stripe:create-intent][${reqId}] ❌ Invalid JSON body`, e?.message || e);
      return new NextResponse(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }

    const input = Body.parse(raw);
    const itemSummary = summarizeItems(input.items);
    const amount = computeAmountCents(input.items, {
      coupon: input.coupon,
      shippingCost: input.shippingCost,
    });

    // --- Per-attempt id – if client didn't send, generate one now ---
    const attemptId =
      input.attemptId ||
      req.headers.get('x-attempt-id') ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // ---- Verbose request log (safe) ----
    console.log(
      `[stripe:create-intent][${reqId}] ▶️ incoming`,
      JSON.stringify({
        currency,
        amount_cents: amount,
        items_count: input.items.length,
        items: itemSummary,
        shippingCost: input.shippingCost,
        coupon: input.coupon
          ? {
              code: input.coupon.code || input.coupon.id || null,
              amount: Number(input.coupon.amount || 0),
              type: String(input.coupon.type || input.coupon.discount_type || '').toLowerCase(),
              valid: !!input.coupon.valid,
            }
          : null,
        email_masked: maskEmail(input.customer.email),
        slug: input.slug || '',
        attemptId,
        key_prefix: stripeSecret.slice(0, 10),
      })
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn(`[stripe:create-intent][${reqId}] ⚠️ Computed amount <= 0 (rejecting)`, amount);
      return new NextResponse(JSON.stringify({ error: 'Cart total is zero or invalid.' }), { status: 400 });
    }
    if (amount < 50) {
      console.warn(`[stripe:create-intent][${reqId}] ⚠️ Amount below Stripe minimum (50 cents):`, amount);
      return new NextResponse(JSON.stringify({ error: 'Amount too low (must be at least $0.50).' }), { status: 400 });
    }

    if (DEBUG) {
      try {
        const acct = await stripe.accounts.retrieve();
        console.log(
          `[stripe:create-intent][${reqId}] ℹ️ stripe account`,
          JSON.stringify({ id: acct.id, livemode: acct.livemode })
        );
      } catch (e) {
        console.warn(`[stripe:create-intent][${reqId}] ⚠️ unable to retrieve account`, e?.message || e);
      }
    }

    // 🔐 Idempotency key – now includes attemptId to ensure a NEW PI per click
    const itemsKey = input.items.map((i) => ({
      id: i.product_id,
      q: Number(i.quantity || 0),
      p: Number(i.price || 0),
    }));
    const couponKey = input.coupon
      ? {
          code: input.coupon.code || input.coupon.id || null,
          amount: Number(input.coupon.amount || 0),
          type: String(input.coupon.type || input.coupon.discount_type || '').toLowerCase(),
          valid: !!input.coupon.valid,
        }
      : null;

    const keyPayload = {
      amount,
      currency,
      items: itemsKey,
      shippingCost: Number(input.shippingCost || 0),
      coupon: couponKey,
      email: input.customer.email,
      slug: input.slug || '',
      attemptId, // <— the difference-maker
    };

    const idemKey = crypto.createHash('sha256').update(stableStringify(keyPayload)).digest('hex');

    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        payment_method_types: ['card'], // split Elements
        description: `Mini-site order ${input.slug || ''}`.trim(),
        receipt_email: input.customer.email,
        metadata: { slug: input.slug || '', attemptId },
      },
      { idempotencyKey: idemKey }
    );

    // Detect suspicious reuse: a "create" that returns a non-initial status
    const suspiciousReuse =
      intent.status !== 'requires_payment_method' &&
      intent.status !== 'requires_confirmation';

    console.log(
      `[stripe:create-intent][${reqId}] ✅ created`,
      JSON.stringify({
        pi: intent.id,
        status_on_create: intent.status,
        client_secret_preview: intent.client_secret ? intent.client_secret.slice(0, 12) + '…' : null,
        amount_cents: amount,
        currency,
        livemode: intent.livemode,
        idem_key_prefix: idemKey.slice(0, 10),
        attemptId,
        duration_ms: Date.now() - startedAt,
        ...(suspiciousReuse ? { note: 'idempotency_reuse_suspected' } : null),
      })
    );

    return NextResponse.json(
      { clientSecret: intent.client_secret, intentId: intent.id, amount, attemptId },
      { status: 200 }
    );
  } catch (err) {
    const code = err?.raw?.code || err?.code || null;
    const type = err?.raw?.type || err?.type || null;
    const param = err?.raw?.param || null;
    const requestId = err?.raw?.requestId || err?.requestId || null;
    const message = err?.raw?.message || err?.message || 'Unable to create PaymentIntent.';

    console.error(
      `[stripe:create-intent][${reqId}] ❌ error`,
      JSON.stringify({
        code,
        type,
        param,
        requestId,
        message,
        duration_ms: Date.now() - startedAt,
      })
    );

    if (err?.rawType === 'idempotency_error') {
      return new NextResponse(
        JSON.stringify({
          error:
            'Idempotency key collision. Please retry — a new key will be generated automatically.',
          code: 'idempotency_error',
        }),
        { status: 409 }
      );
    }

    return new NextResponse(JSON.stringify({ error: message, code }), { status: 400 });
  }
}

/* ------------------------------- GET 405 ------------------------------ */
export async function GET() {
  return new NextResponse(null, { status: 405 });
}
