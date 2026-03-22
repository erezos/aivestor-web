// Earnings AI enrichment worker — runs every 5 min
// Reads the cursor from earnings_meta, processes ONE date at a time (up to 30 companies),
// AI-enriches them, saves enriched data, advances cursor, repeats on next tick.
// Automatically marks completed when all dates are enriched.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const NOTABLE = new Set([
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN',
]);

async function upsert(base44, key, data) {
  const payload = { cache_key: key, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
  } else {
    await base44.asServiceRole.entities.CachedData.create(payload);
  }
}

async function aiEnrichBatch(base44, companies) {
  const compact = companies.map(e => ({
    sym:    e.s,
    date:   e.d,
    epsEst: e.ep ?? null,
  }));

  try {
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `For these upcoming earnings reports: ${JSON.stringify(compact)}
Provide a brief analysis for each. Keep volatilityReason to 6 words max.
Return JSON only: {"analysis":[{"sym":"...","volatilityForecast":"Low|Medium|High","volatilityReason":"...","sentimentBias":"bullish|bearish|neutral"}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          analysis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sym:                { type: 'string' },
                volatilityForecast: { type: 'string' },
                volatilityReason:   { type: 'string' },
                sentimentBias:      { type: 'string' },
              },
              required: ['sym', 'volatilityForecast', 'volatilityReason', 'sentimentBias'],
            }
          }
        }
      }
    });
    const map = {};
    (aiResult?.analysis || []).forEach(a => { map[a.sym] = a; });
    return map;
  } catch (_) {
    return {};
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Load meta
    const metaRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'earnings_meta' });
    if (!metaRows.length) {
      return Response.json({ skipped: true, reason: 'No earnings_meta found. Run refreshEarnings first.' });
    }

    const meta = JSON.parse(metaRows[0].data);

    if (meta.completed) {
      return Response.json({ skipped: true, reason: 'All dates already enriched.' });
    }

    const { dates, cursor, enriched_dates = [] } = meta;
    if (cursor >= dates.length) {
      // Mark complete
      meta.completed = true;
      await upsert(base44, 'earnings_meta', meta);
      return Response.json({ done: true, total_dates: dates.length });
    }

    const dateToProcess = dates[cursor];

    // Load raw companies for this date
    const rawRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: `earnings_raw_${dateToProcess}` });
    if (!rawRows.length) {
      // Skip missing date
      meta.cursor = cursor + 1;
      await upsert(base44, 'earnings_meta', meta);
      return Response.json({ skipped_date: dateToProcess, cursor: meta.cursor });
    }

    const companies = JSON.parse(rawRows[0].data);

    // Process in batches of 30 within this date
    let aiMap = {};
    const BATCH = 30;
    for (let i = 0; i < companies.length; i += BATCH) {
      const batch = companies.slice(i, i + BATCH);
      const batchMap = await aiEnrichBatch(base44, batch);
      Object.assign(aiMap, batchMap);
    }

    // Merge AI data into companies
    const enriched = companies.map(e => {
      const ai = aiMap[e.s] || { volatilityForecast: 'Medium', volatilityReason: 'Earnings report due', sentimentBias: 'neutral' };
      return {
        s:  e.s,
        d:  e.d,
        t:  e.t,
        ep: e.ep,
        re: e.re,
        n:  NOTABLE.has(e.s) ? 1 : 0,
        vf: ai.volatilityForecast,
        vr: (ai.volatilityReason || '').slice(0, 40),
        sb: ai.sentimentBias,
      };
    });

    // Save enriched data for this date
    await upsert(base44, `earnings_${dateToProcess}`, enriched);

    // Advance cursor
    meta.cursor = cursor + 1;
    meta.enriched_dates = [...enriched_dates, dateToProcess];
    if (meta.cursor >= dates.length) meta.completed = true;
    await upsert(base44, 'earnings_meta', meta);

    return Response.json({
      processed_date: dateToProcess,
      companies: enriched.length,
      cursor: meta.cursor,
      remaining: dates.length - meta.cursor,
      completed: meta.completed,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});