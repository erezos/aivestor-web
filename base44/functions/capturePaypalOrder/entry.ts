import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PAYPAL_BASE = 'https://api-m.paypal.com';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, packId, tokens } = await req.json();
    if (!orderId || !packId || !tokens) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Idempotency: check if already processed
    const existing = await base44.asServiceRole.entities.PurchaseReceipt.filter({ transaction_id: orderId });
    if (existing.length > 0 && existing[0].status === 'completed') {
      return Response.json({ ok: true, alreadyCredited: true, tokens });
    }

    const accessToken = await getAccessToken();

    // Capture the order
    const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const captureJson = await capture.json();

    if (captureJson.status !== 'COMPLETED') {
      throw new Error('PayPal capture failed: ' + captureJson.status);
    }

    const userId = user.id;
    const tokenCount = parseInt(tokens);

    // Record receipt
    const receipt = await base44.asServiceRole.entities.PurchaseReceipt.create({
      user_id: userId,
      intent_id: orderId,
      transaction_id: orderId,
      platform: 'web',
      product_id: packId,
      raw_receipt_json: JSON.stringify(captureJson),
      status: 'completed',
      tokens_credited: tokenCount,
    });

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

    // Ledger entry
    await base44.asServiceRole.entities.TokenLedger.create({
      user_id: userId,
      request_id: orderId,
      type: 'credit',
      amount: tokenCount,
      bucket: 'paid',
      source: 'purchase',
      status: 'completed',
      note: `PayPal purchase: ${packId}`,
    });

    // Update offer state + mark one-time packs claimed
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

    return Response.json({ ok: true, tokens: tokenCount, alreadyCredited: false });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});