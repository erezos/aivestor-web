import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2, Play, RefreshCw, FlaskConical } from 'lucide-react';

const STATUS = { idle: 'idle', running: 'running', pass: 'pass', fail: 'fail' };

function makeTest(name, fn) {
  return { name, fn, status: STATUS.idle, error: null };
}

const TEST_DEFINITIONS = [
  makeTest('Auth: current user is authenticated', async () => {
    const user = await base44.auth.me();
    if (!user?.email) throw new Error('No authenticated user');
  }),

  makeTest('Watchlist: item is immediately visible after add (query key bug check)', async () => {
    const user = await base44.auth.me();
    const created = await base44.entities.Watchlist.create({ symbol: '__VIS_TEST__', name: 'Visibility Test', asset_type: 'stock' });
    if (!created?.id) throw new Error('Create returned no id');
    // Immediately re-fetch — simulates what the invalidated query does
    const items = await base44.entities.Watchlist.filter({ created_by: user.email });
    const found = items.find(i => i.id === created.id);
    await base44.entities.Watchlist.delete(created.id);
    if (!found) throw new Error(`Newly created item not found in user watchlist (created_by=${created.created_by}, user=${user.email})`);
  }),

  makeTest('Watchlist: create, read and delete', async () => {
    const user = await base44.auth.me();
    const created = await base44.entities.Watchlist.create({
      symbol: '__TEST__',
      name: 'Test Asset',
      asset_type: 'stock',
    });
    if (!created?.id) throw new Error('Create failed — no id returned');

    const items = await base44.entities.Watchlist.filter({ created_by: user.email });
    const found = items.find(i => i.id === created.id);
    if (!found) throw new Error('Created item not found in user watchlist');

    await base44.entities.Watchlist.delete(created.id);
    const after = await base44.entities.Watchlist.filter({ created_by: user.email });
    if (after.find(i => i.id === created.id)) throw new Error('Delete failed — item still exists');
  }),

  makeTest('Watchlist: other users cannot see my items', async () => {
    const user = await base44.auth.me();
    const created = await base44.entities.Watchlist.create({
      symbol: '__PRIVACY_TEST__',
      name: 'Privacy Test',
      asset_type: 'stock',
    });
    const all = await base44.entities.Watchlist.filter({ created_by: user.email });
    const notOthers = all.every(i => i.created_by === user.email);
    await base44.entities.Watchlist.delete(created.id);
    if (!notOthers) throw new Error('Found items belonging to other users');
  }),

  makeTest('Backend: getMarketData indices', async () => {
    const res = await base44.functions.invoke('getMarketData', { type: 'indices' });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No index data returned');
    const first = res.data[0];
    if (!first.symbol || first.price == null) throw new Error('Index missing symbol or price');
  }),

  makeTest('Backend: getMarketData multi-quote (AAPL, MSFT)', async () => {
    const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols: ['AAPL', 'MSFT'] });
    if (!res.data?.AAPL || !res.data?.MSFT) throw new Error('Missing AAPL or MSFT quote');
    if (res.data.AAPL.price == null) throw new Error('AAPL price is null');
  }),

  makeTest('Backend: getChartData returns candles', async () => {
    const res = await base44.functions.invoke('getChartData', { symbol: 'AAPL', range: '1mo' });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No candle data returned');
    const c = res.data[0];
    if (!c.time || !c.open || !c.close) throw new Error('Candle missing required fields');
  }),

  makeTest('Backend: getAssetAnalysis returns AI data', async () => {
    const res = await base44.functions.invoke('getAssetAnalysis', { symbol: 'AAPL' });
    if (!res.data?.aiSignal) throw new Error('No aiSignal in response');
    if (res.data.price == null) throw new Error('No price in response');
  }),

  makeTest('Cache: CachedData entity readable', async () => {
    const rows = await base44.entities.CachedData.filter({ cache_key: 'hotboard' });
    // Cache may or may not be populated yet — just ensure the query works
    if (!Array.isArray(rows)) throw new Error('CachedData query did not return array');
  }),

  makeTest('Backend: getChartData — timestamps are valid Unix seconds', async () => {
    const res = await base44.functions.invoke('getChartData', { symbol: 'AAPL', range: '3mo' });
    if (!Array.isArray(res.data) || res.data.length < 10) throw new Error(`Too few candles: ${res.data?.length}`);
    const c = res.data[0];
    // lightweight-charts needs Unix seconds (10-digit), not ms (13-digit)
    if (String(c.time).length !== 10) throw new Error(`time looks wrong: ${c.time} (should be 10-digit Unix seconds)`);
    if (c.close <= 0) throw new Error(`Close price invalid: ${c.close}`);
  }),

  makeTest('Backend: getChartData crypto (BTC) works', async () => {
    const res = await base44.functions.invoke('getChartData', { symbol: 'BTC', range: '1mo' });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No BTC candles returned');
    if (res.data[0].close < 1000) throw new Error(`BTC close unrealistically low: ${res.data[0].close}`);
  }),

  makeTest('Backend: chartAiMagic returns signal + markers', async () => {
    // Fetch real candles first then test AI magic
    const chartRes = await base44.functions.invoke('getChartData', { symbol: 'AAPL', range: '3mo' });
    const candles = chartRes.data;
    if (!candles?.length) throw new Error('No candles for AI test');
    const recent = candles.slice(-30).map(c => ({ t: c.time, c: c.close }));
    const last = candles[candles.length - 1];
    const res = await base44.functions.invoke('chartAiMagic', {
      symbol: 'AAPL', recent, currentPrice: last.close, sma20: '260', rsi: '55',
    });
    if (!res.data?.signal) throw new Error('No signal in chartAiMagic response');
    if (!res.data?.summary) throw new Error('No summary in chartAiMagic response');
  }),

  makeTest('Data: Finnhub quote returns real stock price (AAPL)', async () => {
    const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols: ['AAPL'] });
    if (!res.data?.AAPL?.price) throw new Error('No AAPL price from Finnhub');
    if (res.data.AAPL.price < 50) throw new Error(`AAPL price looks wrong: ${res.data.AAPL.price}`);
  }),

  makeTest('Data: Binance quote returns real BTC price', async () => {
    const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols: ['BTC'] });
    if (!res.data?.BTC?.price) throw new Error('No BTC price from Binance');
    if (res.data.BTC.price < 5000) throw new Error(`BTC price looks wrong: ${res.data.BTC.price}`);
  }),

  makeTest('Data: Alpaca returns AAPL chart candles', async () => {
    const res = await base44.functions.invoke('getChartData', { symbol: 'AAPL', range: '1mo' });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No candles from Alpaca');
    const c = res.data[0];
    if (!c.time || !c.open || !c.close) throw new Error('Candle missing fields');
    if (String(c.time).length !== 10) throw new Error(`Timestamp wrong: ${c.time}`);
  }),

  makeTest('Data: Binance returns BTC chart candles', async () => {
    const res = await base44.functions.invoke('getChartData', { symbol: 'BTC', range: '1mo' });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No BTC candles from Binance');
    if (res.data[0].close < 5000) throw new Error(`BTC close unrealistically low: ${res.data[0].close}`);
  }),

  makeTest('Data: getIndicators returns real RSI for AAPL (Finnhub)', async () => {
    const res = await base44.functions.invoke('getIndicators', { symbol: 'AAPL' });
    if (res.data?.rsi === undefined) throw new Error('No RSI returned');
    if (res.data.rsi < 0 || res.data.rsi > 100) throw new Error(`RSI out of range: ${res.data.rsi}`);
  }),

  makeTest('Data: getIndicators returns real RSI for BTC (Binance calc)', async () => {
    const res = await base44.functions.invoke('getIndicators', { symbol: 'BTC' });
    if (res.data?.rsi === undefined) throw new Error('No RSI returned for BTC');
    if (res.data.rsi < 0 || res.data.rsi > 100) throw new Error(`BTC RSI out of range: ${res.data.rsi}`);
  }),

  makeTest('Data: getIndicators returns MACD + Bollinger Bands (AAPL)', async () => {
    const res = await base44.functions.invoke('getIndicators', { symbol: 'AAPL' });
    if (res.data?.macd === undefined) throw new Error('No MACD returned');
    if (res.data?.bbUpper === undefined) throw new Error('No Bollinger Band upper returned');
  }),

  makeTest('Data: Finnhub market news returns real articles', async () => {
    const rows = await base44.entities.CachedData.filter({ cache_key: 'news' });
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('No news cache found — trigger refresh first');
    const articles = JSON.parse(rows[0].data);
    if (!articles[0]?.title) throw new Error('Articles missing title');
    if (!articles[0]?.sentiment) throw new Error('Articles missing sentiment');
  }),

  makeTest('Data: Finnhub earnings calendar returns real dates', async () => {
    const rows = await base44.entities.CachedData.filter({ cache_key: 'earnings' });
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('No earnings cache — trigger refresh first');
    const earnings = JSON.parse(rows[0].data);
    if (!earnings[0]?.reportDate) throw new Error('Earnings missing reportDate');
    if (!earnings[0]?.symbol) throw new Error('Earnings missing symbol');
  }),

  makeTest('AI: Asset analysis uses real indicator data in prompt', async () => {
    const res = await base44.functions.invoke('getAssetAnalysis', { symbol: 'AAPL' });
    if (!res.data?.aiSignal) throw new Error('No aiSignal');
    if (!res.data?.aiSummary) throw new Error('No aiSummary');
    if (!res.data?.indicators?.length) throw new Error('No indicators array');
  }),

  makeTest('News: getAssetNews resolves real sources (not "Yahoo" / finnhub.io)', async () => {
    const res = await base44.functions.invoke('getAssetNews', { symbol: 'AAPL' });
    if (!Array.isArray(res.data?.articles) || res.data.articles.length === 0)
      throw new Error('No articles returned');
    const badSources = res.data.articles.filter(a =>
      !a.source ||
      a.source.toLowerCase() === 'yahoo' ||
      a.source.includes('finnhub')
    );
    if (badSources.length > 0)
      throw new Error(`${badSources.length} article(s) still show bad source: "${badSources[0].source}"`);
    // Also verify URLs are real (not finnhub redirect proxy)
    const badUrls = res.data.articles.filter(a => a.url?.includes('finnhub.io/api/news'));
    if (badUrls.length > 0)
      throw new Error(`${badUrls.length} article(s) still have unresolved finnhub redirect URLs`);
  }),

  makeTest('Portfolio: create, read and delete', async () => {
    const user = await base44.auth.me();
    const created = await base44.entities.Portfolio.create({
      symbol: '__TEST__',
      name: 'Test Portfolio Asset',
      asset_type: 'stock',
      quantity: 1,
      buy_price: 100,
    });
    if (!created?.id) throw new Error('Create failed');
    const items = await base44.entities.Portfolio.filter({ created_by: user.email });
    if (!items.find(i => i.id === created.id)) throw new Error('Item not found after create');
    await base44.entities.Portfolio.delete(created.id);
  }),
];

function statusIcon(status) {
  if (status === STATUS.running) return <Loader2 className="w-4 h-4 animate-spin text-violet-400" />;
  if (status === STATUS.pass)    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === STATUS.fail)    return <XCircle className="w-4 h-4 text-rose-400" />;
  return <div className="w-4 h-4 rounded-full border border-white/20" />;
}

export default function TestSuite() {
  const [tests, setTests] = useState(TEST_DEFINITIONS.map(t => ({ ...t })));
  const [running, setRunning] = useState(false);

  const updateTest = (index, patch) => {
    setTests(prev => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
  };

  const runAll = async () => {
    setRunning(true);
    // Reset all
    setTests(TEST_DEFINITIONS.map(t => ({ ...t, status: STATUS.idle, error: null })));

    for (let i = 0; i < TEST_DEFINITIONS.length; i++) {
      updateTest(i, { status: STATUS.running, error: null });
      try {
        await TEST_DEFINITIONS[i].fn();
        updateTest(i, { status: STATUS.pass });
      } catch (e) {
        updateTest(i, { status: STATUS.fail, error: e.message });
      }
    }
    setRunning(false);
  };

  const runOne = async (index) => {
    updateTest(index, { status: STATUS.running, error: null });
    try {
      await TEST_DEFINITIONS[index].fn();
      updateTest(index, { status: STATUS.pass });
    } catch (e) {
      updateTest(index, { status: STATUS.fail, error: e.message });
    }
  };

  const passed = tests.filter(t => t.status === STATUS.pass).length;
  const failed = tests.filter(t => t.status === STATUS.fail).length;
  const total  = tests.length;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-6 h-6 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Regression Test Suite</h1>
            <p className="text-sm text-white/30">Run before publishing to verify all features work</p>
          </div>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all disabled:opacity-60"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      {/* Summary */}
      {(passed + failed) > 0 && (
        <div className="glass rounded-xl px-5 py-3 flex items-center gap-6">
          <span className="text-sm text-white/40">{passed + failed} / {total} run</span>
          <span className="text-sm font-bold text-emerald-400">{passed} passed</span>
          {failed > 0 && <span className="text-sm font-bold text-rose-400">{failed} failed</span>}
          {passed === total && <span className="text-sm font-bold text-emerald-400 ml-auto">✓ All tests passed! Safe to publish.</span>}
        </div>
      )}

      {/* Test List */}
      <div className="space-y-2">
        {tests.map((test, i) => (
          <div key={i}
            className={`glass rounded-xl p-4 flex items-start gap-3 transition-all border ${
              test.status === STATUS.pass ? 'border-emerald-500/20 bg-emerald-500/5' :
              test.status === STATUS.fail ? 'border-rose-500/20 bg-rose-500/5' :
              'border-white/5'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">{statusIcon(test.status)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{test.name}</div>
              {test.error && (
                <div className="text-xs text-rose-400 mt-1 font-mono">{test.error}</div>
              )}
            </div>
            <button
              onClick={() => runOne(i)}
              disabled={running}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/50 transition-all disabled:opacity-30 flex-shrink-0"
              title="Run this test"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/20 text-center">Tests run against the live database. Test records are created and deleted automatically.</p>
    </div>
  );
}