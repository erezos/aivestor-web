// Pre-warms the asset analysis cache for popular symbols
// Runs on a schedule so users always hit a warm cache — never wait for cold AI calls
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TOP_ASSETS = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD',
  'JPM', 'SPY', 'QQQ', 'NFLX', 'PLTR', 'COIN',
  'BTC', 'ETH', 'SOL', 'XRP',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Note: scheduled automations have no user session — use asServiceRole only
    const results = [];

    // Pre-warm AI analysis in batches of 3, fire-and-forget per batch
    for (let i = 0; i < TOP_ASSETS.length; i += 3) {
      const batch = TOP_ASSETS.slice(i, i + 3);
      await Promise.all(batch.map(async (symbol) => {
        try {
          await base44.asServiceRole.functions.invoke('getAssetAnalysis', { symbol });
          results.push({ symbol, status: 'ok' });
        } catch (e) {
          results.push({ symbol, status: 'error', error: e.message });
        }
      }));
      // Small pause between batches to avoid overloading downstream APIs
      if (i + 3 < TOP_ASSETS.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return Response.json({
      warmed: results.filter(r => r.status === 'ok').length,
      total: results.length,
      results,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});