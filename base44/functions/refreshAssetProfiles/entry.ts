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
const BATCH_SIZE = 3;        // 3 LLM calls per run — safe within timeout and Groq rate limits
const LLM_DELAY_MS = 4000;  // 4s between LLM calls — Groq free tier safe burst window
const GROQ_KEY = Deno.env.get('GROQ_API_KEY');

async function invokeLLM(base44, prompt, schema) {
  // Try Base44 first
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
    if (result && typeof result === 'object') return result;
  } catch (e) {
    console.warn('Base44 LLM failed, falling back to Groq:', e.message);
  }
  // Groq free fallback
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set and Base44 LLM failed');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt + '\n\nRespond with a valid JSON object.' }], response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 2048 }),
  });
  if (res.status === 429) throw new Error('Rate limit exceeded');
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const results = { refreshed: 0, skipped: 0, errors: 0 };

    // Fetch cache entries in small batches to avoid hammering the DB with 100 parallel calls
    const cacheEntries = [];
    for (let i = 0; i < TOP_100.length; i += 20) {
      const batch = TOP_100.slice(i, i + 20);
      const batchResults = await Promise.all(
        batch.map(symbol =>
          base44.asServiceRole.entities.CachedData.filter({ cache_key: `asset_profile_${symbol}` })
            .then(rows => ({ symbol, rows }))
        )
      );
      cacheEntries.push(...batchResults);
    }

    // Determine which are stale
    const staleSymbols = [];
    for (const { symbol, rows } of cacheEntries) {
      if (rows.length > 0 && rows[0].data) {
        const cached = JSON.parse(rows[0].data);
        if (cached.next_refresh && new Date(cached.next_refresh) > now) {
          results.skipped++;
          continue;
        }
      }
      staleSymbols.push(symbol);
    }

    // Build a lookup for existing rows to avoid re-fetching
    const existingMap = {};
    for (const { symbol, rows } of cacheEntries) {
      if (rows.length > 0) existingMap[symbol] = rows[0];
    }

    // Only process up to BATCH_SIZE stale assets this run
    const toProcess = staleSymbols.slice(0, BATCH_SIZE);

    for (let i = 0; i < toProcess.length; i++) {
      const symbol = toProcess[i];
      try {
        if (i > 0) await new Promise(r => setTimeout(r, LLM_DELAY_MS));

        const isCrypto = CRYPTO_SET.has(symbol);
        const assetType = isCrypto ? 'cryptocurrency' : 'stock';

        const result = await invokeLLM(base44,
          `Investment profile for ${symbol} (${assetType}). Sections: overview (business model, scale), revenue_model (key metrics), moat (competitive advantages), risks (top 3 risks), catalysts (price drivers), who_should_invest (investor profile). Be specific and factual. Return a JSON object with plain string values only.`,
          {
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
        );

        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const profile = { symbol, ...result, generated_at: now.toISOString(), next_refresh: sevenDays };
        const key = `asset_profile_${symbol}`;
        const payload = { cache_key: key, data: JSON.stringify(profile), refreshed_at: now.toISOString() };

        const existing = existingMap[symbol];
        if (existing) {
          await base44.asServiceRole.entities.CachedData.update(existing.id, payload);
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