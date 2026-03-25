// Earnings calendar ORCHESTRATOR — runs twice weekly (Mon + Thu)
// Strategy:
//   - Fetches week-by-week (8 separate calls) to avoid the 1,500-record Finnhub cap
//   - Skips dates already enriched (unless within next 7 days — dates can still shift)
//   - Fetches EPS beat/miss history for notable symbols (cached indefinitely, only updates after new report)
//   - Saves raw per-date chunks for enrichEarningsBatch to progressively AI-enrich

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

const NOTABLE = new Set([
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN','HOOD','RBLX','LYFT',
]);

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function upsert(base44, key, data) {
  const payload = { cache_key: key, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
  } else {
    await base44.asServiceRole.entities.CachedData.create(payload);
  }
}

async function getExisting(base44, key) {
  const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  return null;
}

// Fetch one week's earnings from Finnhub
async function fetchWeek(from, to) {
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.earningsCalendar || [];
}


Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const force = body.force === true; // force re-fetch all dates

    const today = new Date();
    const in7days = toDateStr(addDays(today, 7));

    // Load existing meta to know which dates are already enriched
    const existingMeta = await getExisting(base44, 'earnings_meta');
    const alreadyEnriched = new Set(existingMeta?.enriched_dates || []);

    // Fetch 8 weeks, one week at a time to avoid the 1,500-record cap
    // Add 500ms delay between calls to stay within Finnhub's rate limits
    const allByDate = {};
    for (let w = 0; w < 8; w++) {
      if (w > 0) await new Promise(r => setTimeout(r, 1200));
      const weekStart = toDateStr(addDays(today, w * 7));
      const weekEnd   = toDateStr(addDays(today, w * 7 + 6));
      const entries   = await fetchWeek(weekStart, weekEnd);

      for (const e of entries) {
        if (!e.symbol || !e.date) continue;
        if (!allByDate[e.date]) allByDate[e.date] = [];
        allByDate[e.date].push(e);
      }
    }

    const dates = Object.keys(allByDate).sort();
    let newDates = 0;
    let skippedDates = 0;

    // Process each date
    for (const date of dates) {
      const isNearTerm = date <= in7days; // within 7 days — re-save even if enriched (dates can shift)
      const isEnriched = alreadyEnriched.has(date);

      // Skip if already enriched AND not near-term AND not forced
      if (isEnriched && !isNearTerm && !force) {
        skippedDates++;
        continue;
      }

      const dayEntries = allByDate[date];

      // Sort: notable first, then by revenue size, then alpha
      dayEntries.sort((a, b) => {
        const an = NOTABLE.has(a.symbol) ? 1 : 0;
        const bn = NOTABLE.has(b.symbol) ? 1 : 0;
        return bn - an || (b.revenueEstimate || 0) - (a.revenueEstimate || 0) || a.symbol.localeCompare(b.symbol);
      });

      // Include ALL notable stocks regardless of cap, then fill up to 60 with others
      const notableEntries = dayEntries.filter(e => NOTABLE.has(e.symbol));
      const otherEntries   = dayEntries.filter(e => !NOTABLE.has(e.symbol));
      const combined = [...notableEntries, ...otherEntries].slice(0, Math.max(notableEntries.length, 60));

      const raw = combined.map(e => ({
        s:  e.symbol,
        t:  e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : 'DMH',
        ep: e.epsEstimate != null ? Math.round(e.epsEstimate * 100) / 100 : null,
        re: e.revenueEstimate ? `${(e.revenueEstimate / 1e9).toFixed(1)}B` : null,
        n:  NOTABLE.has(e.symbol) ? 1 : 0,
        // Include actual results if already reported
        ea: e.epsActual != null ? Math.round(e.epsActual * 100) / 100 : null,
        ra: e.revenueActual != null ? `${(e.revenueActual / 1e9).toFixed(1)}B` : null,
      }));

      await upsert(base44, `earnings_raw_${date}`, raw);
      newDates++;
    }

    // EPS history is fetched separately by refreshEpsHistory (weekly, Sunday)
    // to avoid competing with Finnhub rate limits here

    // Rebuild meta — mark only dates no longer in allByDate as stale
    // Keep enriched_dates for dates we skipped (they're still good)
    const newEnrichedDates = (existingMeta?.enriched_dates || []).filter(d => dates.includes(d));

    await upsert(base44, 'earnings_meta', {
      dates,
      total: dates.reduce((sum, d) => {
        // approximate — we skipped processing some
        return sum + (allByDate[d]?.length || 0);
      }, 0),
      cursor: newEnrichedDates.length, // resume from where we left off
      enriched_dates: newEnrichedDates,
      completed: newEnrichedDates.length >= dates.length,
      raw_refreshed_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      dates_total: dates.length,
      dates_new_or_updated: newDates,
      dates_skipped_already_enriched: skippedDates,
      message: 'Done. enrichEarningsBatch will AI-enrich new/unenriched dates. EPS history fetched separately by refreshEpsHistory.',
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});