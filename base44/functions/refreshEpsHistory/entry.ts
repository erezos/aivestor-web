// EPS beat/miss history fetcher — runs weekly (Sunday)
// Fetches last 8 quarters of EPS surprises for all notable symbols.
// Cached 90 days — only re-fetches what's stale or missing.
// Runs separately from refreshEarnings to avoid Finnhub rate limits.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

const NOTABLE = [
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN','HOOD','RBLX','LYFT',
];

async function upsert(base44, existingRow, key, data) {
  const payload = { cache_key: key, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  if (existingRow) {
    await base44.asServiceRole.entities.CachedData.update(existingRow.id, payload);
  } else {
    await base44.asServiceRole.entities.CachedData.create(payload);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    let fetched = 0;
    let skipped = 0;
    const NINETY_DAYS = 90 * 24 * 3600 * 1000;
    // Max 15 fetches per run: 15 × 1.3s delay + ~2s DB pre-load = ~22s, safely under timeout.
    // Weekly cadence covers all 55 symbols within 4 weeks. 90-day cache means this is fine.
    const MAX_FETCHES_PER_RUN = 15;

    // Pre-load all existing cache entries in parallel — avoids 55 sequential DB calls inside the loop
    const allKeys = NOTABLE.map(s => `eps_history_${s}`);
    const cacheRows = await Promise.all(
      allKeys.map(k => base44.asServiceRole.entities.CachedData.filter({ cache_key: k }).then(r => r[0] || null))
    );
    const cacheMap = {};
    NOTABLE.forEach((sym, idx) => { cacheMap[sym] = cacheRows[idx]; });

    for (let i = 0; i < NOTABLE.length; i++) {
      if (fetched >= MAX_FETCHES_PER_RUN) break;

      const sym = NOTABLE[i];
      const key = `eps_history_${sym}`;

      if (!force) {
        const cached = cacheMap[sym];
        if (cached?.refreshed_at) {
          const age = Date.now() - new Date(cached.refreshed_at).getTime();
          if (age < NINETY_DAYS) { skipped++; continue; }
        }
      }

      // Rate limit: delay only between actual Finnhub calls (not skips)
      if (fetched > 0) await new Promise(r => setTimeout(r, 1300));

      const res = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${sym}&limit=8&token=${FINNHUB_KEY}`);
      if (res.status === 429) {
        // Rate limited — stop gracefully, next run will resume remaining symbols
        console.warn(`Rate limited at symbol ${sym} (index ${i}/${NOTABLE.length}) after ${fetched} fetches`);
        break;
      }
      if (!res.ok) { console.warn(`Non-OK response for ${sym}: ${res.status}`); continue; }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const history = data.map(e => ({
        period:      e.period,
        quarter:     e.quarter,
        year:        e.year,
        actual:      e.actual,
        estimate:    e.estimate,
        surprise:    e.surprise,
        surprisePct: e.surprisePercent != null ? Math.round(e.surprisePercent * 10) / 10 : null,
      }));

      await upsert(base44, cacheMap[sym], key, history);
      fetched++;
    }

    return Response.json({ success: true, fetched, skipped, total: NOTABLE.length, cappedAt: MAX_FETCHES_PER_RUN });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});