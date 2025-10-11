// /src/app/api/payments/stripe/webhook/route.js
export const runtime = 'nodejs';

import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { wpApiFetch } from '@/lib/wpApi'; // adjust path if your alias differs

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export async function POST(req) {
  try {
    // Sanity hint if env looks wrong
    if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith?.('whsec_')) {
      console.warn('[stripe:webhook] STRIPE_WEBHOOK_SECRET does not look like a whsec_… value.');
    }

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return new NextResponse(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
    }

    // Use raw body for signature verification
    const rawBody = Buffer.from(await req.arrayBuffer());

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (e) {
      console.error('[stripe:webhook] signature verification failed', e);
      return new NextResponse(
        JSON.stringify({ error: 'Signature verification failed', details: e.message }),
        { status: 400 }
      );
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;

        // Build payload for WP (idempotent on WP side by intent id)
        const payload = {
          provider: 'stripe',
          webhook_event_id: event.id,
          webhook_only: true,
          payment_intent_id: intent.id,
          amount_received: intent.amount_received,
          currency: intent.currency,
          receipt_email:
            intent.receipt_email ||
            intent.charges?.data?.[0]?.billing_details?.email ||
            null,
          payment_meta: {
            charge_id:
              intent.latest_charge || intent.charges?.data?.[0]?.id || null,
          },
        };

        const wpRes = await wpApiFetch('order/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!wpRes.ok) {
          const text = await wpRes.text();
          console.error('[stripe:webhook] WP order/create failed', text);
          // 5xx so Stripe retries (useful while wiring up)
          return new NextResponse(
            JSON.stringify({ error: 'WP order create failed', details: text }),
            { status: 502 }
          );
        }

        return NextResponse.json({ received: true });
      }

      case 'payment_intent.payment_failed': {
        // Optional: inform WP about failure (no-op if not needed)
        // await wpApiFetch('order/create', { method: 'POST', body: JSON.stringify({ provider:'stripe', webhook_event_id:event.id, status:'failed', webhook_only:true }) });
        return NextResponse.json({ received: true });
      }

      default:
        // Acknowledge unhandled events
        return NextResponse.json({ received: true });
    }
  } catch (err) {
    console.error('[stripe:webhook] error', err);
    return new NextResponse(
      JSON.stringify({ error: err?.message || 'Webhook error' }),
      { status: 400 }
    );
  }
}
