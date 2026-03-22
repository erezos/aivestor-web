/**
 * generateAssetProfile — Lazy-generate an AI investment profile for any asset.
 * Returns cached data if fresh (< 7 days). Regenerates if stale.
 * No auth required — called from asset page for any visitor.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CRYPTO_SYMBOLS = new Set(['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','LINK','MATIC','LTC','ATOM','UNI','AAVE']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol, forceRefresh = false } = await req.json();

    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });
    const sym = symbol.toUpperCase();
    const key = `asset_profile_${sym}`;

    // Return cached if still fresh
    if (!forceRefresh) {
      const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
      if (existing.length > 0 && existing[0].data) {
        const cached = JSON.parse(existing[0].data);
        if (cached.next_refresh && new Date(cached.next_refresh) > new Date()) {
          return Response.json({ ...cached, fromCache: true });
        }
      }
    }

    const isCrypto = CRYPTO_SYMBOLS.has(sym);
    const assetType = isCrypto ? 'cryptocurrency/blockchain project' : 'publicly traded company (stock)';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Write a comprehensive investment profile for ${sym}, a ${assetType}.

Provide these 6 sections:
1. overview: What does it do? Core business model in 2-3 sentences. Include market cap or key scale metric if known.
2. revenue_model: How does it generate revenue/value? Key metrics (P/E, EPS growth, revenue CAGR for stocks; tokenomics, staking yield for crypto).
3. moat: Top 2-3 competitive advantages or unique value propositions that protect it from competition.
4. risks: Top 3 specific risks that could cause significant price decline.
5. catalysts: Recent events or upcoming catalysts (earnings, product launches, regulation, partnerships) that could move the price.
6. who_should_invest: Investor profile — risk tolerance, time horizon, portfolio fit.

Be analytical, specific, and factual. Use real numbers where you know them. Avoid generic statements.`,
      response_json_schema: {
        type: 'object',
        properties: {
          overview:          { type: 'string' },
          revenue_model:     { type: 'string' },
          moat:              { type: 'string' },
          risks:             { type: 'string' },
          catalysts:         { type: 'string' },
          who_should_invest: { type: 'string' },
        },
        required: ['overview', 'moat', 'risks']
      }
    });

    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const profile = {
      symbol: sym,
      ...result,
      generated_at: new Date().toISOString(),
      next_refresh: sevenDays,
    };

    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
    const payload  = { cache_key: key, data: JSON.stringify(profile), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(profile);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});