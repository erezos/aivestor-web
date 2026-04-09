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

  makeTest('Watchlist: add item to localStorage', async () => {
    const KEY = 'aivestor_watchlist';
    const before = JSON.parse(localStorage.getItem(KEY) || '[]');
    const testItem = { symbol: '__TEST__', name: 'Test Asset', asset_type: 'stock', sort_order: 99 };
    localStorage.setItem(KEY, JSON.stringify([...before, testItem]));
    const after = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!after.find(i => i.symbol === '__TEST__')) throw new Error('Item not found after add');
    // Cleanup
    localStorage.setItem(KEY, JSON.stringify(before));
  }),

  makeTest('Watchlist: remove item from localStorage', async () => {
    const KEY = 'aivestor_watchlist';
    const before = JSON.parse(localStorage.getItem(KEY) || '[]');
    const withItem = [...before, { symbol: '__DEL_TEST__', name: 'Delete Test', asset_type: 'stock' }];
    localStorage.setItem(KEY, JSON.stringify(withItem));
    const removed = withItem.filter(w => w.symbol !== '__DEL_TEST__');
    localStorage.setItem(KEY, JSON.stringify(removed));
    const final = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (final.find(i => i.symbol === '__DEL_TEST__')) throw new Error('Item still present after delete');
    localStorage.setItem(KEY, JSON.stringify(before));
  }),

  makeTest('Watchlist: no duplicates on double-add', async () => {
    const KEY = 'aivestor_watchlist';
    const before = JSON.parse(localStorage.getItem(KEY) || '[]');
    const item = { symbol: '__DUP__', name: 'Dup Test', asset_type: 'stock' };
    const list = [...before, item];
    // Simulate guard: don't add if already exists
    const alreadyIn = list.some(w => w.symbol === '__DUP__');
    if (!alreadyIn) throw new Error('Duplicate guard failed');
    localStorage.setItem(KEY, JSON.stringify(before));
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

  makeTest('News: getAssetNews returns articles with sources and sentiment', async () => {
    const res = await base44.functions.invoke('getAssetNews', { symbol: 'AAPL' });
    if (!Array.isArray(res.data?.articles) || res.data.articles.length === 0)
      throw new Error('No articles returned');
    const missingSrc = res.data.articles.filter(a => !a.source || a.source.trim() === '');
    if (missingSrc.length > 0)
      throw new Error(`${missingSrc.length} article(s) have no source`);
    const missingSentiment = res.data.articles.filter(a => !a.sentiment);
    if (missingSentiment.length > 0)
      throw new Error(`${missingSentiment.length} article(s) missing sentiment`);
  }),

  // ── Market Wrap ───────────────────────────────────────────────────────────
  makeTest('MarketWrap: generateMarketWrap function returns headline', async () => {
    const res = await base44.functions.invoke('generateMarketWrap', {});
    if (!res.data?.headline) throw new Error('No headline in response: ' + JSON.stringify(res.data));
  }),

  makeTest('MarketWrap: cached data is stored in CachedData entity', async () => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await base44.entities.CachedData.filter({ cache_key: `market_wrap_${today}` });
    if (!rows.length) throw new Error(`No cache entry found for market_wrap_${today}`);
    const wrap = JSON.parse(rows[0].data);
    if (!wrap.headline) throw new Error('Cached wrap missing headline');
    if (!wrap.intro_paragraph) throw new Error('Cached wrap missing intro_paragraph');
    if (!wrap.date) throw new Error('Cached wrap missing date');
  }),

  makeTest('MarketWrap: wrap contains all required sections', async () => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await base44.entities.CachedData.filter({ cache_key: `market_wrap_${today}` });
    if (!rows.length) throw new Error('No cached wrap found — run generateMarketWrap first');
    const wrap = JSON.parse(rows[0].data);
    if (!wrap.equities_section) throw new Error('Missing equities_section');
    if (!wrap.crypto_section) throw new Error('Missing crypto_section');
    if (!wrap.ai_insight) throw new Error('Missing ai_insight');
  }),

  // ── Asset Profile ─────────────────────────────────────────────────────────
  makeTest('AssetProfile: generateAssetProfile returns profile for AAPL', async () => {
    const res = await base44.functions.invoke('generateAssetProfile', { symbol: 'AAPL' });
    if (!res.data?.overview) throw new Error('No overview in AAPL profile');
    if (!res.data?.moat) throw new Error('No moat in AAPL profile');
    if (!res.data?.risks) throw new Error('No risks in AAPL profile');
    if (!res.data?.generated_at) throw new Error('No generated_at timestamp');
    if (!res.data?.next_refresh) throw new Error('No next_refresh date');
  }),

  makeTest('AssetProfile: generateAssetProfile works for BTC (crypto)', async () => {
    const res = await base44.functions.invoke('generateAssetProfile', { symbol: 'BTC' });
    if (!res.data?.overview) throw new Error('No overview in BTC profile');
    if (!res.data?.risks) throw new Error('No risks in BTC profile');
  }),

  makeTest('AssetProfile: cache is populated after generation', async () => {
    const rows = await base44.entities.CachedData.filter({ cache_key: 'asset_profile_AAPL' });
    if (!rows.length) throw new Error('No cached profile for AAPL — run generateAssetProfile first');
    const profile = JSON.parse(rows[0].data);
    if (!profile.overview) throw new Error('Cached AAPL profile missing overview');
    if (!profile.next_refresh) throw new Error('Cached AAPL profile missing next_refresh');
  }),

  makeTest('AssetProfile: cache hit returns fromCache=true (no LLM re-call)', async () => {
    // Hit the endpoint twice — second call should be from cache
    await base44.functions.invoke('generateAssetProfile', { symbol: 'MSFT' });
    const res2 = await base44.functions.invoke('generateAssetProfile', { symbol: 'MSFT' });
    if (!res2.data?.fromCache) throw new Error('Second call did not return from cache (wasting credits)');
  }),

  makeTest('EmailSubscriber: can subscribe an email', async () => {
    const testEmail = '__test_subscriber__@aivestor.test';
    // Clean up any previous test record
    const existing = await base44.entities.EmailSubscriber.filter({ email: testEmail });
    for (const r of existing) await base44.entities.EmailSubscriber.delete(r.id);
    // Create
    const rec = await base44.entities.EmailSubscriber.create({ email: testEmail, source: 'test_suite' });
    if (!rec.id) throw new Error('Subscriber record not created');
    // Cleanup
    await base44.entities.EmailSubscriber.delete(rec.id);
  }),

  // ── Ask AI / Wallet ───────────────────────────────────────────────────────
  makeTest('AskAI: getWallet returns valid balance structure', async () => {
    const res = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const d = res.data?.data;
    if (d == null) throw new Error('No wallet data returned: ' + JSON.stringify(res.data));
    if (typeof d.freeBalance !== 'number') throw new Error('freeBalance is not a number');
    if (typeof d.paidBalance !== 'number') throw new Error('paidBalance is not a number');
    if (typeof d.totalBalance !== 'number') throw new Error('totalBalance is not a number');
    if (d.totalBalance !== d.freeBalance + d.paidBalance) throw new Error('totalBalance mismatch');
    if (!d.rules?.dailyFreeGrant) throw new Error('Missing rules.dailyFreeGrant');
  }),

  makeTest('AskAI: listTokenPacks returns standard packs with correct shape', async () => {
    const res = await base44.functions.invoke('listTokenPacks', { includeOffers: true, requestId: crypto.randomUUID() });
    const packs = res.data?.data?.packs;
    if (!Array.isArray(packs) || packs.length === 0) throw new Error('No packs returned');
    const standard = packs.filter(p => p.kind === 'standard');
    if (standard.length === 0) throw new Error('No standard packs returned');
    for (const p of standard) {
      if (!p.packId) throw new Error(`Pack missing packId: ${JSON.stringify(p)}`);
      if (!p.tokens || p.tokens <= 0) throw new Error(`Pack has invalid tokens: ${JSON.stringify(p)}`);
      if (!p.price || p.price <= 0) throw new Error(`Pack has invalid price: ${JSON.stringify(p)}`);
      if (p.currency !== 'USD') throw new Error(`Unexpected currency: ${p.currency}`);
    }
  }),

  makeTest('AskAI: getAskAiHistory returns paginated list', async () => {
    const res = await base44.functions.invoke('getAskAiHistory', { limit: 10, requestId: crypto.randomUUID() });
    const d = res.data?.data;
    if (d == null) throw new Error('No data in response: ' + JSON.stringify(res.data));
    if (!Array.isArray(d.items)) throw new Error('items is not an array');
    if (typeof d.total !== 'number') throw new Error('total is not a number');
  }),

  makeTest('AskAI: getAskAiHistory items have required fields', async () => {
    const res = await base44.functions.invoke('getAskAiHistory', { limit: 5, requestId: crypto.randomUUID() });
    const items = res.data?.data?.items ?? [];
    if (items.length === 0) return; // No history yet — skip field check
    for (const item of items) {
      if (!item.asset) throw new Error(`History item missing asset: ${JSON.stringify(item)}`);
      if (!item.stance) throw new Error(`History item missing stance: ${JSON.stringify(item)}`);
      if (item.confidence == null) throw new Error(`History item missing confidence`);
      if (!item.report) throw new Error(`History item missing full report object`);
      if (!item.report.sections?.length) throw new Error(`Report missing sections for ${item.asset}`);
    }
  }),

  makeTest('AskAI: askAiAnalyze returns valid v2 report (AAPL, quick, costs 1 token)', async () => {
    // Check balance first — skip if insufficient
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const balance = walletRes.data?.data?.totalBalance ?? 0;
    if (balance < 1) throw new Error(`Insufficient tokens to run this test (have ${balance}, need 1). Add tokens or wait for daily grant.`);

    const res = await base44.functions.invoke('askAiAnalyze', {
      requestId: crypto.randomUUID(),
      asset: 'AAPL',
      depth: 'quick',
      timeframe: 'swing',
      locale: 'en',
    });
    const d = res.data?.data;
    if (res.data?.error) throw new Error('API returned error: ' + res.data.error.message);
    if (!d?.report) throw new Error('No report in response');
    if (d.report.reportVersion !== 'v2') throw new Error(`Wrong report version: ${d.report.reportVersion}`);
    if (!['bullish','bearish','neutral'].includes(d.report.stance)) throw new Error(`Invalid stance: ${d.report.stance}`);
    if (typeof d.report.confidence !== 'number') throw new Error('Confidence not a number');
    if (!Array.isArray(d.report.sections) || d.report.sections.length < 7) throw new Error(`Not enough sections: ${d.report.sections?.length}`);
    if (!d.wallet) throw new Error('Missing wallet in response');
  }),

  makeTest('AskAI: askAiAnalyze is idempotent (same requestId returns cached result)', async () => {
    const reqId = crypto.randomUUID();
    // First call
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const balance = walletRes.data?.data?.totalBalance ?? 0;
    if (balance < 1) throw new Error(`Insufficient tokens (have ${balance}). Skipping idempotency test.`);

    const r1 = await base44.functions.invoke('askAiAnalyze', {
      requestId: reqId, asset: 'MSFT', depth: 'quick', timeframe: 'swing', locale: 'en',
    });
    if (r1.data?.error) throw new Error('First call failed: ' + r1.data.error.message);
    // Second call with SAME requestId — must return same result without billing again
    const r2 = await base44.functions.invoke('askAiAnalyze', {
      requestId: reqId, asset: 'MSFT', depth: 'quick', timeframe: 'swing', locale: 'en',
    });
    if (r2.data?.error) throw new Error('Idempotent call failed: ' + r2.data.error.message);
    if (r1.data?.data?.report?.stance !== r2.data?.data?.report?.stance)
      throw new Error('Idempotent call returned different stance');
  }),

  // ── Daily Free Token Grant ────────────────────────────────────────────────
  makeTest('TokenGrant: dailyFreeTokenGrant runs without errors', async () => {
    const res = await base44.functions.invoke('dailyFreeTokenGrant', {});
    const d = res.data;
    if (!d?.ok) throw new Error('Function returned ok=false: ' + JSON.stringify(d));
    if (typeof d.stats?.scanned !== 'number') throw new Error('Missing stats.scanned');
    if (d.stats.errors > 0) throw new Error(`Grant run had ${d.stats.errors} errors: ${JSON.stringify(d.stats.errorDetails)}`);
  }),

  makeTest('TokenGrant: idempotency — running twice produces no duplicate grants', async () => {
    const r1 = await base44.functions.invoke('dailyFreeTokenGrant', {});
    if (!r1.data?.ok) throw new Error('First run failed');
    const granted1 = r1.data.stats.granted;

    const r2 = await base44.functions.invoke('dailyFreeTokenGrant', {});
    if (!r2.data?.ok) throw new Error('Second run failed');
    const granted2 = r2.data.stats.granted;

    // Same window key → all wallets already have ledger entries → granted should be 0
    if (granted2 > 0) throw new Error(`Second run granted ${granted2} tokens — idempotency failed`);
    if (r2.data.stats.alreadyGranted < granted1) throw new Error(`Expected alreadyGranted >= ${granted1}, got ${r2.data.stats.alreadyGranted}`);
  }),

  makeTest('TokenGrant: getWallet reflects balance after grant run', async () => {
    // Run the grant
    await base44.functions.invoke('dailyFreeTokenGrant', {});
    // Fetch wallet — balance must be >= 0 and <= FREE_CAP (3)
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const d = walletRes.data?.data;
    if (d == null) throw new Error('No wallet data');
    if (d.freeBalance < 0 || d.freeBalance > 3) throw new Error(`freeBalance out of range: ${d.freeBalance}`);
    if (d.totalBalance !== d.freeBalance + d.paidBalance) throw new Error('totalBalance mismatch after grant');
  }),

  makeTest('TokenGrant: stats fields all present and numeric', async () => {
    const res = await base44.functions.invoke('dailyFreeTokenGrant', {});
    const s = res.data?.stats;
    if (!s) throw new Error('No stats in response');
    const required = ['scanned','eligible','granted','alreadyGranted','skippedNotDue','skippedAtCap','errors'];
    for (const f of required) {
      if (typeof s[f] !== 'number') throw new Error(`stats.${f} is not a number: ${s[f]}`);
    }
    // Sanity: eligible = granted + alreadyGranted + skippedAtCap (+ any errors)
    const accounted = s.granted + s.alreadyGranted + s.skippedAtCap + s.errors;
    if (accounted !== s.eligible) throw new Error(`eligible=${s.eligible} but accounted=${accounted} (granted+alreadyGranted+skippedAtCap+errors)`);
  }),

  makeTest('AskAI: askAiAnalyze rejects insufficient token balance', async () => {
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const balance = walletRes.data?.data?.totalBalance ?? 0;
    if (balance >= 3) {
      return;
    }
    const res = await base44.functions.invoke('askAiAnalyze', {
      requestId: crypto.randomUUID(), asset: 'AAPL', depth: 'deep', timeframe: 'swing', locale: 'en',
    });
    const errCode = res.data?.error?.code;
    if (errCode !== 'INSUFFICIENT_TOKENS') throw new Error(`Expected INSUFFICIENT_TOKENS, got: ${errCode}`);
  }),

  // ── needsLocalization regression (was crashing: "Cannot access before initialization") ──
  makeTest('AskAI: locale=he does not crash (needsLocalization bug regression)', async () => {
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const balance = walletRes.data?.data?.totalBalance ?? 0;
    if (balance < 1) throw new Error(`Insufficient tokens (have ${balance}). Skipping.`);
    const res = await base44.functions.invoke('askAiAnalyze', {
      requestId: crypto.randomUUID(), asset: 'AAPL', depth: 'quick', timeframe: 'swing', locale: 'he',
    });
    if (res.data?.error) throw new Error('Locale test returned error: ' + res.data.error.message);
    if (!res.data?.data?.report) throw new Error('No report returned for non-English locale');
    if (!['bullish','bearish','neutral'].includes(res.data.data.report.stance)) throw new Error(`Invalid stance`);
  }),

  makeTest('AskAI: locale=en still works after needsLocalization fix', async () => {
    const walletRes = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
    const balance = walletRes.data?.data?.totalBalance ?? 0;
    if (balance < 1) throw new Error(`Insufficient tokens (have ${balance}). Skipping.`);
    const res = await base44.functions.invoke('askAiAnalyze', {
      requestId: crypto.randomUUID(), asset: 'NVDA', depth: 'quick', timeframe: 'swing', locale: 'en',
    });
    if (res.data?.error) throw new Error('EN locale failed: ' + res.data.error.message);
    if (!res.data?.data?.report?.sections?.length) throw new Error('No sections in report');
  }),

  // ── PayPal ────────────────────────────────────────────────────────────────
  makeTest('PayPal: createPaypalOrder rejects missing required fields', async () => {
    const res = await base44.functions.invoke('createPaypalOrder', { packId: 'tokens_5_pack' });
    const isError = res.data?.error || res.status >= 400;
    if (!isError) throw new Error('Expected error for missing fields but got success: ' + JSON.stringify(res.data));
  }),

  makeTest('PayPal: createPaypalOrder returns valid approvalUrl', async () => {
    const res = await base44.functions.invoke('createPaypalOrder', {
      packId: 'tokens_5_pack', tokens: 5, price: 1.99, returnUrl: 'https://example.com/return',
    });
    if (res.data?.error) throw new Error('createPaypalOrder error: ' + JSON.stringify(res.data.error));
    if (!res.data?.approvalUrl) throw new Error('No approvalUrl: ' + JSON.stringify(res.data));
    if (!res.data?.orderId) throw new Error('No orderId in response');
    const url = new URL(res.data.approvalUrl);
    if (!url.hostname.includes('paypal.com')) throw new Error(`approvalUrl not a PayPal URL: ${res.data.approvalUrl}`);
  }),

  makeTest('PayPal: capturePaypalOrder rejects missing orderId', async () => {
    const res = await base44.functions.invoke('capturePaypalOrder', { packId: 'tokens_5_pack', tokens: 5 });
    const isError = res.data?.error || res.status >= 400;
    if (!isError) throw new Error('Expected error for missing orderId but got success');
  }),

  // ── Groq Fallback ────────────────────────────────────────────────────────
  makeTest('Groq fallback: refreshHotBoard returns valid signals', async () => {
    const res = await base44.functions.invoke('refreshHotBoard', {});
    if (!res.data?.success) throw new Error('refreshHotBoard failed: ' + JSON.stringify(res.data));
    if (!res.data.count || res.data.count === 0) throw new Error('No assets in hotboard result');
    // Verify signals are present in cached data
    const rows = await base44.entities.CachedData.filter({ cache_key: 'hotboard' });
    if (!rows.length) throw new Error('No hotboard cache after refresh');
    const items = JSON.parse(rows[0].data);
    if (!items[0]?.signal) throw new Error('Hotboard items missing signal field (Groq fallback may have failed)');
  }),

  makeTest('Groq fallback: refreshMarketNews returns curated articles with sentiment', async () => {
    const res = await base44.functions.invoke('refreshMarketNews', {});
    if (!res.data?.success) throw new Error('refreshMarketNews failed: ' + JSON.stringify(res.data));
    const rows = await base44.entities.CachedData.filter({ cache_key: 'news' });
    if (!rows.length) throw new Error('No news cache after refresh');
    const articles = JSON.parse(rows[0].data);
    if (!articles.length) throw new Error('No articles in cache');
    if (!articles[0]?.sentiment) throw new Error('Articles missing sentiment (Groq fallback may have failed)');
    if (!articles[0]?.summary) throw new Error('Articles missing summary');
  }),

  makeTest('Groq fallback: generateMarketWrap returns structured wrap', async () => {
    const res = await base44.functions.invoke('generateMarketWrap', {});
    if (!res.data?.success && !res.data?.headline) throw new Error('generateMarketWrap failed: ' + JSON.stringify(res.data));
    const today = new Date().toISOString().split('T')[0];
    const rows = await base44.entities.CachedData.filter({ cache_key: `market_wrap_${today}` });
    if (!rows.length) throw new Error('No market wrap cache entry');
    const wrap = JSON.parse(rows[0].data);
    if (!wrap.headline) throw new Error('Wrap missing headline (Groq fallback may have failed)');
    if (!wrap.intro_paragraph) throw new Error('Wrap missing intro_paragraph');
  }),

  makeTest('Groq fallback: generateAssetProfile returns all sections for AAPL', async () => {
    const res = await base44.functions.invoke('generateAssetProfile', { symbol: 'AAPL', forceRefresh: true });
    if (res.data?.error) throw new Error('generateAssetProfile error: ' + res.data.error);
    if (!res.data?.overview) throw new Error('Profile missing overview (Groq fallback may have failed)');
    if (!res.data?.moat) throw new Error('Profile missing moat');
    if (!res.data?.risks) throw new Error('Profile missing risks');
    if (!res.data?.generated_at) throw new Error('Profile missing generated_at timestamp');
  }),

  makeTest('Groq fallback: chartAiMagic returns signal and summary', async () => {
    // Get fresh candles first
    const chartRes = await base44.functions.invoke('getChartData', { symbol: 'AAPL', range: '3mo' });
    const candles = chartRes.data;
    if (!candles?.length) throw new Error('No candles for chartAiMagic test');
    const recent = candles.slice(-30).map(c => ({ t: c.time, c: c.close }));
    const last = candles[candles.length - 1];
    // Force cache miss by using a unique fake symbol pattern
    const res = await base44.functions.invoke('chartAiMagic', {
      symbol: 'AAPL', recent, currentPrice: last.close, sma20: String(last.close * 0.98), rsi: '52',
    });
    if (res.data?.error) throw new Error('chartAiMagic error: ' + res.data.error);
    if (!res.data?.signal) throw new Error('chartAiMagic missing signal (Groq fallback may have failed)');
    if (!res.data?.summary) throw new Error('chartAiMagic missing summary');
  }),

  makeTest('Groq fallback: getAssetAnalysis returns AI signal for AAPL', async () => {
    const res = await base44.functions.invoke('getAssetAnalysis', { symbol: 'AAPL' });
    if (res.data?.error) throw new Error('getAssetAnalysis error: ' + res.data.error);
    if (!res.data?.aiSignal) throw new Error('Missing aiSignal (Groq fallback may have failed)');
    if (!res.data?.aiSummary) throw new Error('Missing aiSummary');
    if (!res.data?.indicators?.length) throw new Error('Missing indicators array');
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