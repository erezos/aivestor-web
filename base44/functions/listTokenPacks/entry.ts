import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_CONFIG = {
  configVersion: 'v2',
  packs: [
    { packId: 'starter_5_pack',  productId: 'starter_5_pack',  tokens: 5,   price: 0.99,  currency: 'USD', kind: 'starter',       oneTime: true,  label: 'Starter Edge Pack',  description: 'Perfect intro offer — 5 deep reports' },
    { packId: 'tokens_5_pack',   productId: 'tokens_5_pack',   tokens: 5,   price: 1.99,  currency: 'USD', kind: 'standard',      oneTime: false, label: 'Quick Pack',         description: '5 deep AI Edge Reports' },
    { packId: 'tokens_15_pack',  productId: 'tokens_15_pack',  tokens: 15,  price: 4.99,  currency: 'USD', kind: 'standard',      oneTime: false, label: 'Trader Pack',        description: '15 deep AI Edge Reports' },
    { packId: 'tokens_40_pack',  productId: 'tokens_40_pack',  tokens: 40,  price: 10.99, currency: 'USD', kind: 'standard',      oneTime: false, label: 'Growth Pack',        description: '40 deep AI Edge Reports' },
    { packId: 'second_25_pack',  productId: 'second_25_pack',  tokens: 25,  price: 5.99,  currency: 'USD', kind: 'second_chance', oneTime: true,  label: 'Second Chance Pack', description: 'Special one-time offer — 25 deep reports' },
    { packId: 'tokens_100_pack', productId: 'tokens_100_pack', tokens: 100, price: 23.99, currency: 'USD', kind: 'standard',      oneTime: false, label: 'Pro Pack',           description: '100 deep AI Edge Reports' },
    { packId: 'tokens_250_pack', productId: 'tokens_250_pack', tokens: 250, price: 49.99, currency: 'USD', kind: 'heavy',         oneTime: false, label: 'Whale Pack',         description: 'Best value — 250 deep AI Edge Reports' },
  ],
  eligibilityRules: {
    starter:       { maxPurchaseCount: 0, oneTime: true },
    second_chance: { minPurchaseCount: 1, oneTime: true },
  },
};

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 3600 }, source: 'config' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body          = await req.json().catch(() => ({}));
    const includeOffers = body.includeOffers !== false;
    const reqId         = body.requestId || crypto.randomUUID();

    const config = DEFAULT_CONFIG;
    const rules  = config.eligibilityRules;

    // Load offer state
    const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: user.id });
    const offer     = offerRows[0] || { free_tokens_used_total: 0, purchase_count: 0, starter_offer_claimed_at: null, heavy_offer_claimed_at: null };
    const purchaseCount = offer.purchase_count || 0;

    const packs = [];

    // Starter offer (one-time, new users only)
    const starterPack = config.packs.find(p => p.kind === 'starter');
    if (starterPack && includeOffers) {
      const eligible = purchaseCount <= rules.starter.maxPurchaseCount && !offer.starter_offer_claimed_at;
      if (eligible) packs.push({ ...starterPack, offerEligible: true });
    }

    // Standard packs — always shown
    config.packs.filter(p => p.kind === 'standard').forEach(p => packs.push(p));

    // Second Chance offer (one-time, for users who bought before)
    const secondPack = config.packs.find(p => p.kind === 'second_chance');
    if (secondPack && includeOffers) {
      const eligible = purchaseCount >= rules.second_chance.minPurchaseCount && !offer.heavy_offer_claimed_at;
      if (eligible) packs.push({ ...secondPack, offerEligible: true });
    }

    // Heavy pack — always shown
    const heavyPack = config.packs.find(p => p.kind === 'heavy');
    if (heavyPack) packs.push(heavyPack);

    return ok({ packs, configVersion: config.configVersion }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});