// /src/app/api/payments/stripe/finalize/route.js
export const runtime = 'nodejs';

import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { wpApiFetch } from '@/lib/wpApi'; // uses WP_SITE_URL, WP_API_USER, WP_API_PASS

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Accept the new shape: { intentId, snapshot: { customer, items, note, shipping, coupon, page_slug } }
const Snapshot = z.object({
  customer: z.object({}).passthrough(),
  items: z.array(z.any()).min(1),
  note: z.string().optional().default(''),
  shipping: z.any().nullable(),
  coupon: z.any().nullable(),
  page_slug: z.string().nullable().optional(),
});

const Body = z.object({
  intentId: z.string().min(1),
  snapshot: Snapshot,
});

export async function POST(req) {
  try {
    const json = await req.json();
    const { intentId, snapshot } = Body.parse(json);

    // 1) Verify with Stripe (server-to-Stripe)
    const intent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ['charges.data.balance_transaction'],
    });
    if (intent.status !== 'succeeded') {
      return new NextResponse(
        JSON.stringify({ error: `Payment not succeeded (${intent.status})` }),
        { status: 400 }
      );
    }

    // 2) Post to WP => order/create with the required keys (snapshot shape)
    const payload = {
      provider: 'stripe',
      payment_intent_id: intent.id,
      amount_received: intent.amount_received,
      currency: intent.currency,
      // ⬇️ important: keep these keys exactly as requested
      customer: snapshot.customer,
      items: snapshot.items,
      note: snapshot.note || '',
      shipping: snapshot.shipping || null,
      coupon: snapshot.coupon || null,
      page_slug: snapshot.page_slug || null,
    };

    console.log('[stripe:finalize] payload', payload);

    const wpRes = await wpApiFetch('order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!wpRes.ok) {
      const text = await wpRes.text();
      console.error('[stripe:finalize] WP order/create failed', text);
      return new NextResponse(
        JSON.stringify({ error: 'WP order create failed', details: text }),
        { status: 502 }
      );
    }

    const order = await wpRes.json();
    return NextResponse.json({ ok: true, order }, { status: 200 });
  } catch (err) {
    console.error('[stripe:finalize] error', err);
    return new NextResponse(
      JSON.stringify({ error: err?.message || 'Finalize failed' }),
      { status: 400 }
    );
  }
}
