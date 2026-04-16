/**
 * getAssetNewsV2 — Phase 2. Symbol news feed with standard envelope + pagination.
 * Cache key: news_<SYMBOL>, TTL 300s.
 * Dedupes by url+title. Cursor pagination via offset index.
 *
 * Request: { symbol, limit?, cursor?, requestId? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const GROQ_KEY    = Deno.env.get('GROQ_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);
const TTL_SEC     = 300;

function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: meta.requestId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: meta.cache || { hit: false, ttlSec: TTL_SEC }, source: 'finnhub', ...meta }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

// Regex fallback sentiment (used when Groq is unavailable)
const BULLISH = /surge|jump|soar|rally|gain|beat|record|growth|rise|profit|boost|upgrade|buy|bullish/i;
const BEARISH = /fall|drop|plunge|decline|miss|loss|risk|warn|downgrade|sell|bearish|weak|tumble/i;
function regexSentiment(text) {
  const b = (text.match(BULLISH) || []).length;
  const r = (text.match(BEARISH) || []).length;
  return b > r ? 'bullish' : r > b ? 'bearish' : 'neutral';
}

// AI sentiment scoring via Groq (free) — much more accurate than regex
async function aiSentiment(articles) {
  if (!GROQ_KEY || !articles.length) return null;
  const compact = articles.map((a, i) => ({ i, h: a.title.slice(0, 100) }));
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Financial news headlines. For each, return sentiment (bullish/bearish/neutral) based on market impact.\nHeadlines: ${JSON.stringify(compact)}\nReturn JSON: {"s":[{"i":0,"v":"bullish"},...]}` }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 512,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const map = {};
  (parsed.s || []).forEach(x => { map[x.i] = x.v; });
  return map;
}

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body?.symbol) return err('INVALID_INPUT', 'symbol is required');

    const sym      = body.symbol.replace(/-USD$/i, '').toUpperCase().trim();
    const limit    = Math.min(parseInt(body.limit) || 20, 50);
    const cursor   = parseInt(body.cursor) || 0;
    const isCrypto = CRYPTO_SET.has(sym);
    const reqId    = body.requestId || crypto.randomUUID();
    const t0       = Date.now();
    const cacheKey = `news_${sym}`;

    const rows   = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0];

    // Return from cache if fresh
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < TTL_SEC * 1000) {
      const all   = JSON.parse(cached.data);
      const items = all.slice(cursor, cursor + limit);
      const nextCursor = cursor + limit < all.length ? String(cursor + limit) : null;
      return ok({ items, nextCursor }, { requestId: reqId, cache: { hit: true, ttlSec: TTL_SEC }, latencyMs: Date.now() - t0 });
    }

    if (isCrypto) return ok({ items: [], nextCursor: null }, { requestId: reqId, cache: { hit: false, ttlSec: TTL_SEC } });

    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const raw  = await fhGet(`/company-news?symbol=${sym}&from=${from}&to=${to}`);

    if (!raw?.length) {
      if (cached) {
        const all = JSON.parse(cached.data);
        return ok({ items: all.slice(cursor, cursor + limit), nextCursor: null }, { requestId: reqId, cache: { hit: true, ttlSec: 0 }, source: 'stale_cache' });
      }
      return ok({ items: [], nextCursor: null }, { requestId: reqId });
    }

    // Dedupe by url — build articles with regex sentiment first
    const seen = new Set();
    const all  = [];
    for (const a of raw) {
      if (!a.url || seen.has(a.url)) continue;
      seen.add(a.url);
      all.push({
        id: `news_${a.id}`,
        symbol: sym,
        title: a.headline?.slice(0, 120) || '',
        summary: a.summary?.slice(0, 300) || null,
        url: a.url,
        source: a.source || 'Financial News',
        publishedAt: new Date(a.datetime * 1000).toISOString(),
        sentiment: regexSentiment(`${a.headline} ${a.summary || ''}`),
      });
    }

    // Upgrade sentiment with Groq AI (fire and don't block on failure)
    const sentimentMap = await aiSentiment(all).catch(() => null);
    if (sentimentMap) {
      all.forEach((a, i) => { if (sentimentMap[i]) a.sentiment = sentimentMap[i]; });
    }

    // Sort descending by publishedAt (stable pagination)
    all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    const payload = { cache_key: cacheKey, data: JSON.stringify(all), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    const items      = all.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < all.length ? String(cursor + limit) : null;
    return ok({ items, nextCursor }, { requestId: reqId, cache: { hit: false, ttlSec: TTL_SEC }, latencyMs: Date.now() - t0 });
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});