/**
 * refreshAssetProfiles — Nightly batch refresh for top 100 assets.
 * Processes BATCH_SIZE assets per run to avoid timeouts.
 * Skips assets that are still fresh (< 7 days old).
 * Scheduled automation: 2 AM Israel time (00:00 UTC) daily.
 * 
 * With BATCH_SIZE=10 and ~14 assets expiring per day, one run per night is sufficient.
 * If more assets are stale, the automation will catch up over subsequent nights.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
const BATCH_SIZE = 10; // Process max 10 per run to stay well within timeout

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const results = { refreshed: 0, skipped: 0, errors: 0 };

    // Find stale assets first (avoids processing all 100 DB lookups sequentially)
    const staleSymbols = [];
    for (const symbol of TOP_100) {
      const key = `asset_profile_${symbol}`;
      const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
      if (existing.length > 0 && existing[0].data) {
        const cached = JSON.parse(existing[0].data);
        if (cached.next_refresh && new Date(cached.next_refresh) > now) {
          results.skipped++;
          continue;
        }
      }
      staleSymbols.push(symbol);
    }

    // Only process up to BATCH_SIZE stale assets this run
    const toProcess = staleSymbols.slice(0, BATCH_SIZE);

    for (const symbol of toProcess) {
      try {
        const key = `asset_profile_${symbol}`;
        const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
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
        const payload = { cache_key: key, data: JSON.stringify(profile), refreshed_at: now.toISOString() };

        if (existing.length > 0) {
          await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
        } else {
          await base44.asServiceRole.entities.CachedData.create(payload);
        }
        results.refreshed++;
      } catch {
        results.errors++;
      }
    }

    return Response.json({
      success: true,
      ...results,
      total: TOP_100.length,
      stale_found: staleSymbols.length,
      remaining_stale: Math.max(0, staleSymbols.length - BATCH_SIZE),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});