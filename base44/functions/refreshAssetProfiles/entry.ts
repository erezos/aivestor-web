/**
 * refreshAssetProfiles — Nightly batch refresh for top 100 assets.
 * Skips assets that are still fresh (next_refresh > now).
 * On first run: ~100 LLM credits. Subsequent nights: ~14 credits (1/7th expire per day).
 * Scheduled automation: 2 AM Israel time (00:00 UTC) daily.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TOP_100 = [
  // Large-cap US stocks
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','JNJ','V',
  'UNH','XOM','PG','MA','HD','CVX','MRK','LLY','ABBV','PEP',
  'KO','AVGO','COST','MCD','TMO','WMT','CSCO','ACN','ABT','NFLX',
  'NKE','TXN','ADBE','NEE','QCOM','AMD','GS','MS','AMGN','INTU',
  'SBUX','IBM','AXP','SPGI','BLK','GILD','MDT','ADP','BKNG','ISRG',
  'REGN','TJX','VRTX','DE','NOW','SYK','ZTS','CI','CB','EOG',
  'BSX','LRCX','KLAC','PANW','MU','CME','ITW','ADI','ETN','HCA',
  'MAR','NOC','SNPS','FDX','ORCL','CRM','SHOP','UBER','LYFT','SNAP',
  'ROKU','PLTR','COIN','SQ','HOOD','RBLX','U','DKNG','ABNB','DASH',
  // Crypto
  'BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','LINK',
];

const CRYPTO_SET = new Set(['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','LINK']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const results = { refreshed: 0, skipped: 0, errors: 0 };

    for (const symbol of TOP_100) {
      try {
        const key = `asset_profile_${symbol}`;

        // Check staleness — skip if fresh
        const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
        if (existing.length > 0 && existing[0].data) {
          const cached = JSON.parse(existing[0].data);
          if (cached.next_refresh && new Date(cached.next_refresh) > now) {
            results.skipped++;
            continue;
          }
        }

        const isCrypto = CRYPTO_SET.has(symbol);
        const assetType = isCrypto ? 'cryptocurrency' : 'stock';

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Investment profile for ${symbol} (${assetType}). Sections: overview (business model, scale), revenue_model (key metrics), moat (competitive advantages), risks (top 3 risks), catalysts (price drivers), who_should_invest (investor profile). Be specific and factual.`,
          response_json_schema: {
            type: 'object',
            properties: {
              overview:          { type: 'string' },
              revenue_model:     { type: 'string' },
              moat:              { type: 'string' },
              risks:             { type: 'string' },
              catalysts:         { type: 'string' },
              who_should_invest: { type: 'string' },
            }
          }
        });

        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const profile = { symbol, ...result, generated_at: now.toISOString(), next_refresh: sevenDays };
        const payload  = { cache_key: key, data: JSON.stringify(profile), refreshed_at: now.toISOString() };

        if (existing.length > 0) {
          await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
        } else {
          await base44.asServiceRole.entities.CachedData.create(payload);
        }
        results.refreshed++;

        // Brief pause to avoid hammering the LLM endpoint
        await new Promise(r => setTimeout(r, 300));
      } catch {
        results.errors++;
      }
    }

    return Response.json({ success: true, ...results, total: TOP_100.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});