// Pre-warms the asset analysis cache for popular symbols
// Runs on a schedule so users always hit a warm cache — never wait for cold AI calls
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TOP_ASSETS = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD',
  'JPM', 'SPY', 'QQQ', 'NFLX', 'PLTR', 'COIN',
  'BTC', 'ETH', 'SOL', 'XRP',
];
const CHART_RANGES = ['3mo', '1mo'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = [];

    // 1. Pre-warm AI analysis (batches of 3)
    for (let i = 0; i < TOP_ASSETS.length; i += 3) {
      const batch = TOP_ASSETS.slice(i, i + 3);
      await Promise.all(batch.map(async (symbol) => {
        try {
          await base44.functions.invoke('getAssetAnalysis', { symbol });
          results.push({ symbol, type: 'analysis', status: 'ok' });
        } catch (e) {
          results.push({ symbol, type: 'analysis', status: 'error', error: e.message });
        }
      }));
      if (i + 3 < TOP_ASSETS.length) await new Promise(r => setTimeout(r, 800));
    }

    // 2. Pre-warm charts for default ranges (batches of 5 — lighter calls)
    const chartJobs = TOP_ASSETS.flatMap(symbol => CHART_RANGES.map(range => ({ symbol, range })));
    for (let i = 0; i < chartJobs.length; i += 5) {
      const batch = chartJobs.slice(i, i + 5);
      await Promise.all(batch.map(async ({ symbol, range }) => {
        try {
          await base44.functions.invoke('getChartData', { symbol, range });
          results.push({ symbol, type: `chart_${range}`, status: 'ok' });
        } catch (e) {
          results.push({ symbol, type: `chart_${range}`, status: 'error', error: e.message });
        }
      }));
      if (i + 5 < chartJobs.length) await new Promise(r => setTimeout(r, 500));
    }

    return Response.json({ warmed: results.filter(r => r.status === 'ok').length, total: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});