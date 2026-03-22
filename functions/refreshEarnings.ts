// Earnings calendar ORCHESTRATOR — runs weekly (Sunday)
// Fetches ALL Finnhub data for next 8 weeks, saves raw per-date chunks,
// then the enrichEarningsBatch function (every 5 min) progressively AI-enriches them.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

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

    const today    = new Date().toISOString().slice(0, 10);
    const in8weeks = new Date(Date.now() + 56 * 86400000).toISOString().slice(0, 10);

    // Fetch full earnings calendar from Finnhub
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${in8weeks}&token=${FINNHUB_KEY}`
    );
    const json = res.ok ? await res.json() : null;
    const calendar = json?.earningsCalendar || [];

    const NOTABLE = new Set([
      'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
      'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
      'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
      'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
      'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN',
    ]);

    // Keep all analyst-covered companies (epsEstimate != null) — full NASDAQ/S&P coverage
    const allEntries = calendar.filter(e => e.symbol && e.date && e.epsEstimate != null);

    // Group by date, sort notable first, cap at 80 per day to stay under size limits
    const byDate = {};
    for (const e of allEntries) {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push({
        s:  e.symbol,
        d:  e.date,
        t:  e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : 'DMH',
        ep: e.epsEstimate  ?? null,
        re: e.revenueEstimate ? `${(e.revenueEstimate / 1e9).toFixed(1)}B` : null,
        n:  NOTABLE.has(e.symbol) ? 1 : 0,
      });
    }

    const dates = Object.keys(byDate).sort();

    // Cap each day at 80 companies — notable first, then alphabetical
    for (const date of dates) {
      byDate[date].sort((a, b) => b.n - a.n || a.s.localeCompare(b.s));
      byDate[date] = byDate[date].slice(0, 80);
    }

    // Save raw data per-date (small chunks, no size limit issues)
    for (const date of dates) {
      await upsert(base44, `earnings_raw_${date}`, byDate[date]);
    }

    // Save/reset meta — enrichEarningsBatch reads this to know what to process
    await upsert(base44, 'earnings_meta', {
      dates,
      total: filtered.length,
      cursor: 0,
      enriched_dates: [],
      completed: false,
      raw_refreshed_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      dates: dates.length,
      total: filtered.length,
      message: 'Raw data saved. enrichEarningsBatch will AI-enrich progressively every 5 min.',
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});