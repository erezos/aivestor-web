/**
 * paypalWebhook — handles PAYMENT.CAPTURE.COMPLETED events from PayPal.
 * This is the safety net for users who paid but never returned to the app.
 *
 * Setup in PayPal dashboard:
 *   Webhook URL: https://YOUR_APP_URL/api/functions/paypalWebhook
 *   Event: PAYMENT.CAPTURE.COMPLETED
 *
 * Security: verified via PAYPAL_WEBHOOK_ID secret + PayPal's signature verification API.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PAYPAL_BASE = 'https://api-m.paypal.com';
const WEBHOOK_ID  = Deno.env.get('PAYPAL_WEBHOOK_ID'); // set this after creating webhook in PayPal dashboard

async function getAccessToken() {
  const creds = btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET')}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('PayPal auth failed');
  return json.access_token;
}

async function verifyWebhookSignature(accessToken, headers, rawBody) {
  const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo:         headers.get('paypal-auth-algo'),
      cert_url:          headers.get('paypal-cert-url'),
      transmission_id:   headers.get('paypal-transmission-id'),
      transmission_sig:  headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id:        WEBHOOK_ID,
      webhook_event:     JSON.parse(rawBody),
    }),
  });
  const result = await verifyRes.json();
  return result.verification_status === 'SUCCESS';
}

Deno.serve(async (req) => {
  try {
    // Must be POST
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const rawBody = await req.text();
    const event   = JSON.parse(rawBody);

    // Only handle payment capture completions
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return Response.json({ ok: true, skipped: true });
    }

    // Verify signature if WEBHOOK_ID is configured
    if (WEBHOOK_ID) {
      const accessToken = await getAccessToken();
      const valid = await verifyWebhookSignature(accessToken, req.headers, rawBody);
      if (!valid) {
        console.error('PayPal webhook signature verification failed');
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      console.warn('PAYPAL_WEBHOOK_ID not set — skipping signature verification (set it in secrets)');
    }

    // Extract data from the event
    // custom_id format: "userId|packId|tokens" (set in createPaypalOrder)
    const capture    = event.resource;
    const orderId    = capture.supplementary_data?.related_ids?.order_id || capture.id;
    const customId   = capture.custom_id || capture.purchase_units?.[0]?.custom_id || '';
    const [userId, packId, tokensStr] = customId.split('|');
    const tokenCount = parseInt(tokensStr);

    if (!userId || !packId || !tokenCount) {
      console.error('Missing custom_id data in PayPal webhook:', customId);
      return Response.json({ ok: false, error: 'Missing custom_id data' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Idempotency: check if already credited (via return-URL flow)
    const existing = await base44.asServiceRole.entities.PurchaseReceipt.filter({ transaction_id: orderId });
    if (existing.length > 0 && existing[0].status === 'completed') {
      console.log(`Webhook: order ${orderId} already credited — skipping`);
      return Response.json({ ok: true, alreadyCredited: true });
    }

    // Credit wallet
    const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
    if (wallets.length > 0) {
      const w = wallets[0];
      await base44.asServiceRole.entities.Wallet.update(w.id, {
        paid_balance: (w.paid_balance || 0) + tokenCount,
        version: (w.version || 1) + 1,
      });
    } else {
      await base44.asServiceRole.entities.Wallet.create({
        user_id: userId, free_balance: 0, paid_balance: tokenCount, version: 1,
      });
    }

    // Record receipt
    await base44.asServiceRole.entities.PurchaseReceipt.create({
      user_id: userId,
      intent_id: orderId,
      transaction_id: orderId,
      platform: 'web',
      product_id: packId,
      raw_receipt_json: JSON.stringify(capture),
      status: 'completed',
      tokens_credited: tokenCount,
    });

    // Ledger entry
    await base44.asServiceRole.entities.TokenLedger.create({
      user_id: userId,
      request_id: orderId,
      type: 'credit',
      amount: tokenCount,
      bucket: 'paid',
      source: 'purchase',
      status: 'completed',
      note: `PayPal webhook fallback: ${packId}`,
    });

    // Update offer state
    const ONE_TIME_PACKS = { 'starter_5_pack': 'starter_offer_claimed_at', 'second_25_pack': 'heavy_offer_claimed_at' };
    const claimedField = ONE_TIME_PACKS[packId] || null;
    const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: userId });
    const now = new Date().toISOString();
    if (offerRows.length > 0) {
      const update = { purchase_count: (offerRows[0].purchase_count || 0) + 1 };
      if (claimedField) update[claimedField] = now;
      await base44.asServiceRole.entities.OfferState.update(offerRows[0].id, update);
    } else {
      const create = { user_id: userId, purchase_count: 1, free_tokens_used_total: 0, config_version: 'v1' };
      if (claimedField) create[claimedField] = now;
      await base44.asServiceRole.entities.OfferState.create(create);
    }

    console.log(`Webhook: credited ${tokenCount} tokens to user ${userId} for order ${orderId}`);
    return Response.json({ ok: true, tokens: tokenCount });

  } catch (e) {
    console.error('PayPal webhook error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});