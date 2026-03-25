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

async function upsert(base44, key, data) {
  const payload = { cache_key: key, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
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

    for (let i = 0; i < NOTABLE.length; i++) {
      const sym = NOTABLE[i];
      const key = `eps_history_${sym}`;

      if (!force) {
        // Check cache age
        const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
        if (rows.length > 0 && rows[0].refreshed_at) {
          const age = Date.now() - new Date(rows[0].refreshed_at).getTime();
          if (age < NINETY_DAYS) { skipped++; continue; }
        }
      }

      // Rate limit: 1 call per 1.2s (Finnhub free = ~50 calls/min)
      if (i > 0) await new Promise(r => setTimeout(r, 1200));

      const res = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${sym}&limit=8&token=${FINNHUB_KEY}`);
      if (res.status === 429) {
        // Rate limited — stop gracefully, next run will resume remaining symbols
        console.warn(`Rate limited at symbol ${sym} (${i}/${NOTABLE.length}), will resume next run`);
        break;
      }
      if (!res.ok) continue;
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

      await upsert(base44, key, history);
      fetched++;
    }

    return Response.json({ success: true, fetched, skipped, total: NOTABLE.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});