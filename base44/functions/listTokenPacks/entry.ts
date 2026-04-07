/**
 * listTokenPacks — Phase 5a. Returns available token packs + eligible offers.
 * Reads pricing from CachedData key 'token_pricing_config'. Falls back to hardcoded defaults.
 * Offer eligibility: starter (>= 5 free used, no purchase), heavy (purchase_count > 1).
 * Protected: requires Base44 auth.
 *
 * Request: { includeOffers?: bool, requestId?: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_CONFIG = {
  configVersion: 'v1',
  packs: [
    { packId: 'pack_5',      tokens: 5,   price: 1.99,  currency: 'USD', kind: 'standard' },
    { packId: 'pack_15',     tokens: 15,  price: 4.99,  currency: 'USD', kind: 'standard' },
    { packId: 'pack_50',     tokens: 50,  price: 13.99, currency: 'USD', kind: 'standard' },
    { packId: 'starter_4',   tokens: 4,   price: 0.99,  currency: 'USD', kind: 'starter', oneTime: true },
    { packId: 'heavy_150',   tokens: 150, price: 34.99, currency: 'USD', kind: 'heavy' },
  ],
  eligibilityRules: {
    starter: { minFreeUsed: 5, maxPurchaseCount: 0, oneTime: true },
    heavy:   { minPurchaseCount: 2, oneTime: false },
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

    const body         = await req.json().catch(() => ({}));
    const includeOffers = body.includeOffers !== false; // default true
    const reqId        = body.requestId || crypto.randomUUID();

    // Load pricing config from cache
    let config = DEFAULT_CONFIG;
    try {
      const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'token_pricing_config' });
      if (rows[0]?.data) {
        const parsed = JSON.parse(rows[0].data);
        if (parsed?.packs?.length) config = parsed;
      }
    } catch (_) { /* use defaults */ }

    // Standard packs only (no special offers by default)
    const standardPacks = config.packs.filter(p => p.kind === 'standard');
    let packs = [...standardPacks];

    if (includeOffers) {
      // Load offer state
      const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: user.id });
      const offer     = offerRows[0] || { free_tokens_used_total: 0, purchase_count: 0, starter_offer_claimed_at: null, heavy_offer_claimed_at: null };
      const rules     = config.eligibilityRules;

      // Starter offer eligibility
      const starterPack = config.packs.find(p => p.kind === 'starter');
      if (starterPack && rules.starter) {
        const eligible = (offer.free_tokens_used_total || 0) >= rules.starter.minFreeUsed
          && (offer.purchase_count || 0) <= rules.starter.maxPurchaseCount
          && !offer.starter_offer_claimed_at;
        if (eligible) packs.unshift({ ...starterPack, offerEligible: true });
      }

      // Heavy offer eligibility
      const heavyPack = config.packs.find(p => p.kind === 'heavy');
      if (heavyPack && rules.heavy) {
        const eligible = (offer.purchase_count || 0) >= rules.heavy.minPurchaseCount
          && !offer.heavy_offer_claimed_at;
        if (eligible) packs.push({ ...heavyPack, offerEligible: true });
      }
    }

    return ok({ packs, configVersion: config.configVersion }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});