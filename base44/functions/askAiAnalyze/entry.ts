/**
 * askAiAnalyze — v2.1 Enhanced Report Engine.
 * Improvements over v2:
 *   - RSI, MACD, Bollinger Bands, SMA20/50, Stochastic, Volume trend (Alpaca)
 *   - Earnings calendar context (next report date, EPS estimate, EPS beat history)
 *   - Analyst consensus (Finnhub recommendation trends)
 *   - CFA-style expert system prompt + 2 few-shot reasoning examples
 *
 * Fixed 8-section report. Idempotent by requestId.
 * Two-tier model routing: deep → claude_sonnet_4_6 (fallback: gpt_5)
 *                         standard/quick → gpt_5_mini (fallback: gpt_5_mini)
 * Token cost: quick=1, standard=2, deep=3
 * Feature flag: ASK_AI_SINGLE_INPUT_ENABLED (default true)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY  = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC  = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR  = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

const FEATURE_ENABLED = Deno.env.get('ASK_AI_SINGLE_INPUT_ENABLED') !== 'false';
const TOKEN_COST = { quick: 1, standard: 1, deep: 1 };
const MODEL_PRIMARY  = { deep: 'claude_sonnet_4_6', standard: 'gpt_5_mini', quick: 'gpt_5_mini' };
const MODEL_FALLBACK = { deep: 'gpt_5',             standard: 'gpt_5_mini', quick: 'gpt_5_mini' };

const DISCLAIMER = 'This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Always do your own research.';
const UNSAFE_WORDS = /\b(guaranteed|guarantee|risk-free|risk free|certain|certainty|will definitely|no risk|100% sure|cannot lose)\b/gi;

// ── Envelope helpers ──────────────────────────────────────────────────────────
function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId, asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'llm' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

// ── Safe fetch helpers ────────────────────────────────────────────────────────
async function fhGet(path) {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return null; }
  } catch (_) { return null; }
}

async function alpacaGet(url) {
  try {
    const res = await fetch(url, { headers: ALPACA_HDR });
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return null; }
  } catch (_) { return null; }
}

// ── Technical indicator calculations ─────────────────────────────────────────
function calcRSI(closes, period = 14) {
  if (closes.length < period + 2) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2);
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  let ema = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes) {
  if (closes.length < 35) return null;
  const buf = closes.slice(-55);
  const macdLine = [];
  for (let i = 25; i < buf.length; i++) {
    const sl = buf.slice(0, i + 1);
    macdLine.push(calcEMA(sl, 12) - calcEMA(sl, 26));
  }
  if (macdLine.length < 9) return null;
  const sigVal  = calcEMA(macdLine, 9);
  const macdVal = macdLine[macdLine.length - 1];
  return { macd: +macdVal.toFixed(4), signal: +sigVal.toFixed(4), hist: +(macdVal - sigVal).toFixed(4) };
}

function calcBB(closes, period = 20) {
  if (closes.length < period) return null;
  const sl   = closes.slice(-period);
  const mean = sl.reduce((a, b) => a + b, 0) / period;
  const std  = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { upper: +(mean + 2 * std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - 2 * std).toFixed(2) };
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  return +(closes.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(2);
}

function calcStoch(highs, lows, closes, k = 14) {
  if (closes.length < k) return null;
  const hs = highs.slice(-k), ls = lows.slice(-k);
  const hh = Math.max(...hs), ll = Math.min(...ls);
  if (hh === ll) return null;
  return +((closes[closes.length - 1] - ll) / (hh - ll) * 100).toFixed(2);
}

// ── Fetch raw OHLCV bars from Finnhub (fallback when Alpaca lacks coverage) ───
async function fetchFinnhubBars(symbol, isCrypto) {
  try {
    const now   = Math.floor(Date.now() / 1000);
    const from  = now - 150 * 86400;  // 150 days back
    const fhSym = isCrypto ? `BINANCE:${symbol}USDT` : symbol;
    const json  = await fhGet(`/stock/candle?symbol=${encodeURIComponent(fhSym)}&resolution=D&from=${from}&to=${now}`);
    if (json?.s !== 'ok' || !json?.c?.length || json.c.length < 20) return null;
    // Normalise to same shape as Alpaca bars
    return json.c.map((c, i) => ({ c, h: json.h[i], l: json.l[i], o: json.o[i], v: json.v?.[i] || 0 }));
  } catch (_) { return null; }
}

// ── Fetch technicals from Alpaca (with Finnhub candle fallback) ───────────────
async function fetchTechnicals(symbol, isCrypto) {
  try {
    const start = new Date(Date.now() - 150 * 86400000).toISOString();
    let bars = [];

    if (isCrypto) {
      const alpacaSym = `${symbol}/USD`;
      const json = await alpacaGet(`https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(alpacaSym)}&timeframe=1Day&start=${start}&limit=200&sort=asc`);
      bars = json?.bars?.[alpacaSym] || [];
    } else {
      const json = await alpacaGet(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start}&limit=200&sort=asc`);
      bars = json?.bars || [];
    }

    // ── Fallback: Finnhub candles (covers stocks Alpaca free tier misses) ─────
    if (bars.length < 20) {
      const fhBars = await fetchFinnhubBars(symbol, isCrypto);
      if (fhBars && fhBars.length >= 20) bars = fhBars;
    }

    if (bars.length < 20) return null;

    const closes  = bars.map(b => b.c);
    const highs   = bars.map(b => b.h);
    const lows    = bars.map(b => b.l);
    const volumes = bars.map(b => b.v);

    const rsi  = calcRSI(closes);
    const macd = calcMACD(closes);
    const bb   = calcBB(closes);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const stoch = calcStoch(highs, lows, closes);
    const currentPrice = closes[closes.length - 1];

    // Volume trend: 5-day avg vs 20-day avg
    const avg5  = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volumeTrend = avg20 > 0 ? +(avg5 / avg20).toFixed(2) : null;

    // RSI interpretation
    const rsiLabel = rsi == null ? null : rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';
    // MACD interpretation
    const macdSignal = macd == null ? null : macd.hist > 0 ? 'bullish_crossover' : 'bearish_crossover';
    // Price vs SMAs
    const priceVsSMA20 = sma20 ? (currentPrice > sma20 ? 'above' : 'below') : null;
    const priceVsSMA50 = sma50 ? (currentPrice > sma50 ? 'above' : 'below') : null;

    return {
      rsi, rsiLabel,
      macd: macd?.macd, macdSignal: macd?.signal, macdHist: macd?.hist, macdInterpretation: macdSignal,
      bbUpper: bb?.upper, bbMiddle: bb?.middle, bbLower: bb?.lower,
      sma20, sma50,
      stoch,
      volumeTrend,
      priceVsSMA20, priceVsSMA50,
      currentPrice,
    };
  } catch (_) { return null; }
}

// ── Fetch options sentiment from Finnhub ─────────────────────────────────────
async function fetchOptionsSentiment(symbol, isCrypto) {
  if (isCrypto) return null;
  try {
    const data = await fhGet(`/stock/option-chain?symbol=${symbol}`);
    if (!data?.data?.length) return null;
    let totalCallOI = 0, totalPutOI = 0, totalCallVol = 0, totalPutVol = 0;
    for (const exp of data.data) {
      for (const opt of (exp.options?.CALL || [])) {
        totalCallOI  += opt.openInterest || 0;
        totalCallVol += opt.volume || 0;
      }
      for (const opt of (exp.options?.PUT || [])) {
        totalPutOI  += opt.openInterest || 0;
        totalPutVol += opt.volume || 0;
      }
    }
    const pcRatioOI  = totalCallOI  > 0 ? +(totalPutOI  / totalCallOI).toFixed(2)  : null;
    const pcRatioVol = totalCallVol > 0 ? +(totalPutVol / totalCallVol).toFixed(2) : null;
    const sentiment  = pcRatioVol == null ? null : pcRatioVol > 1.2 ? 'bearish_skew' : pcRatioVol < 0.7 ? 'bullish_skew' : 'neutral';
    return { totalCallOI, totalPutOI, totalCallVol, totalPutVol, pcRatioOI, pcRatioVol, sentiment };
  } catch (_) { return null; }
}

// ── Fetch short interest from Finnhub ────────────────────────────────────────
async function fetchShortInterest(symbol, isCrypto) {
  if (isCrypto) return null;
  try {
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const data = await fhGet(`/stock/short-interest?symbol=${symbol}&from=${from}&to=${to}`);
    if (!data?.data?.length) return null;
    // Most recent entry
    const latest = data.data[data.data.length - 1];
    const prev   = data.data.length > 1 ? data.data[data.data.length - 2] : null;
    const shortPct = latest.shortInterestPercentage ?? null;
    const trend = prev && prev.shortInterestPercentage != null && shortPct != null
      ? (shortPct > prev.shortInterestPercentage ? 'increasing' : shortPct < prev.shortInterestPercentage ? 'decreasing' : 'stable')
      : null;
    const squeeze = shortPct != null && shortPct > 20 ? true : false;
    return { shortPct: shortPct ? +shortPct.toFixed(2) : null, date: latest.date, trend, highShortSqueezeRisk: squeeze };
  } catch (_) { return null; }
}

// ── Fetch insider transactions from Finnhub ──────────────────────────────────
async function fetchInsiderActivity(symbol, isCrypto) {
  if (isCrypto) return null;
  try {
    const data = await fhGet(`/stock/insider-transactions?symbol=${symbol}`);
    if (!data?.data?.length) return null;
    // Last 90 days
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const recent = data.data.filter(t => t.transactionDate >= cutoff).slice(0, 20);
    if (!recent.length) return null;
    let buyShares = 0, sellShares = 0, buyCount = 0, sellCount = 0;
    for (const t of recent) {
      const shares = Math.abs(t.share || 0);
      if (t.transactionCode === 'P') { buyShares += shares; buyCount++; }
      else if (t.transactionCode === 'S') { sellShares += shares; sellCount++; }
    }
    const netBias = buyShares > sellShares * 1.5 ? 'insider_buying' : sellShares > buyShares * 1.5 ? 'insider_selling' : 'mixed';
    return { buyCount, sellCount, buyShares, sellShares, netBias, periodDays: 90 };
  } catch (_) { return null; }
}

// ── Fetch macro/sector context (SPY, QQQ, VIX) ───────────────────────────────
async function fetchMacroContext() {
  try {
    const [spy, qqq, vixA, vixB] = await Promise.all([
      fhGet('/quote?symbol=SPY'),
      fhGet('/quote?symbol=QQQ'),
      fhGet('/quote?symbol=^VIX'),          // Finnhub sometimes accepts ^VIX
      fhGet('/quote?symbol=CBOE:VIX'),       // alternate
    ]);
    // Pick first valid VIX reading
    const vixRaw = [vixA, vixB].find(v => v?.c && v.c > 5 && v.c < 100);
    const vixLevel = vixRaw?.c || null;
    const vixRegime = vixLevel == null ? null : vixLevel > 30 ? 'high_fear' : vixLevel > 20 ? 'elevated' : 'calm';
    return {
      spy:  spy?.c  ? { price: spy.c,  changePct: spy.dp  || 0 } : null,
      qqq:  qqq?.c  ? { price: qqq.c,  changePct: qqq.dp  || 0 } : null,
      vix:  vixLevel ? { level: vixLevel, regime: vixRegime }     : null,
      marketBias: spy?.dp != null
        ? (spy.dp > 0.5 ? 'risk_on' : spy.dp < -0.5 ? 'risk_off' : 'neutral')
        : null,
    };
  } catch (_) { return null; }
}

// ── Fetch analyst recommendations from Finnhub ────────────────────────────────
async function fetchAnalystSentiment(symbol, isCrypto) {
  if (isCrypto) return null;
  try {
    const data = await fhGet(`/stock/recommendation?symbol=${symbol}`);
    if (!data?.length) return null;
    const latest = data[0]; // most recent month
    const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0, period } = latest;
    const total = strongBuy + buy + hold + sell + strongSell;
    if (total === 0) return null;
    const bullPct = Math.round((strongBuy + buy) / total * 100);
    const bearPct = Math.round((sell + strongSell) / total * 100);
    const consensus = bullPct >= 60 ? 'BUY' : bearPct >= 40 ? 'SELL' : 'HOLD';
    return { period, strongBuy, buy, hold, sell, strongSell, total, bullPct, bearPct, consensus };
  } catch (_) { return null; }
}

// ── Fetch upcoming earnings context ──────────────────────────────────────────
async function fetchEarningsContext(symbol, isCrypto, base44) {
  if (isCrypto) return null;
  try {
    // Look for the next earnings date in the next 8 weeks of cached data
    const today = new Date();
    for (let w = 0; w < 8; w++) {
      const d = new Date(today);
      d.setDate(d.getDate() + w * 7);
      // Check each day of the week
      for (let day = 0; day < 7; day++) {
        const dateStr = new Date(d.getTime() + day * 86400000).toISOString().slice(0, 10);
        if (dateStr < today.toISOString().slice(0, 10)) continue;
        const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: `earnings_${dateStr}` });
        if (!rows.length || !rows[0].data) continue;
        const dayEntries = JSON.parse(rows[0].data);
        const entry = dayEntries.find(e => e.s === symbol);
        if (entry) {
          // Also try to get EPS history
          let epsHistory = null;
          try {
            const epsRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: `eps_${symbol}` });
            if (epsRows.length && epsRows[0].data) {
              const history = JSON.parse(epsRows[0].data);
              const recent = (history || []).slice(-4); // last 4 quarters
              epsHistory = recent.map(q => ({
                period: q.period,
                estimate: q.estimate,
                actual: q.actual,
                beat: q.actual != null && q.estimate != null ? (q.actual > q.estimate ? 'beat' : q.actual < q.estimate ? 'miss' : 'met') : null,
              }));
            }
          } catch (_) {}

          return {
            nextEarningsDate: dateStr,
            timing: entry.t, // BMO / AMC / DMH
            epsEstimate: entry.ep,
            revenueEstimate: entry.re,
            epsHistory,
            daysUntilEarnings: Math.round((new Date(dateStr) - today) / 86400000),
          };
        }
      }
    }
    return null;
  } catch (_) { return null; }
}

// ── Wallet helpers ────────────────────────────────────────────────────────────
async function getWallet(base44, userId) {
  const rows = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
  return rows[0] || null;
}

async function ensureWallet(base44, userId) {
  let w = await getWallet(base44, userId);
  if (!w) w = await base44.asServiceRole.entities.Wallet.create({ user_id: userId, free_balance: 0, paid_balance: 0, last_free_accrual_date: null, version: 1 });
  return w;
}

// ── Guardrails ────────────────────────────────────────────────────────────────
function sanitize(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(UNSAFE_WORDS, (m) => `[not ${m.toLowerCase()}]`);
}

function clampConfidence(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function normalizeStance(s) {
  if (!s) return 'neutral';
  const lower = s.toLowerCase();
  if (lower.includes('bull')) return 'bullish';
  if (lower.includes('bear')) return 'bearish';
  return 'neutral';
}

// ── Section scaffold (always 8 sections) ─────────────────────────────────────
const SECTION_DEFS = [
  { id: 'market_snapshot',      title: 'Market Snapshot'       },
  { id: 'ai_conclusion',        title: 'AI Conclusion'         },
  { id: 'technical_view',       title: 'Technical View'        },
  { id: 'sentiment_news_pulse', title: 'Sentiment & News Pulse'},
  { id: 'scenario_paths',       title: 'Scenario Paths'        },
  { id: 'risks_invalidations',  title: 'Risks & Invalidations' },
  { id: 'action_playbook',      title: 'Action Playbook'       },
  { id: 'disclaimer',           title: 'Disclaimer'            },
];

function buildSections(raw, asset) {
  return SECTION_DEFS.map(def => {
    if (def.id === 'disclaimer') {
      return { id: def.id, title: def.title, content: DISCLAIMER, bullets: [] };
    }
    const src = raw?.sections?.find(s => s.id === def.id) || {};
    const rawContent = src.content;
    const content = typeof rawContent === 'string'
      ? rawContent
      : rawContent && typeof rawContent === 'object'
        ? flattenToString(rawContent)
        : `Analysis unavailable for ${def.title}.`;
    return {
      id: def.id,
      title: def.title,
      content: sanitize(content || `Analysis unavailable for ${def.title}.`),
      bullets: (src.bullets || []).map(b => sanitize(typeof b === 'string' ? b : flattenToString(b))),
    };
  });
}

// ── Groq direct API call (free fallback) ─────────────────────────────────────
const GROQ_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Groq has a ~6k token context limit for practical use — extract only the
// essential market data lines from the full user prompt to stay under limit.
function condenseForGroq(userPrompt) {
  // Keep only the lines that contain actual market numbers/data, skip giant text blocks
  const lines = userPrompt.split('\n');
  const keep = lines.filter(l => {
    const t = l.trim();
    if (!t) return false;
    // Keep data lines (numbers, JSON snippets, key labels) but skip long prose paragraphs
    if (t.startsWith('CRITICAL') || t.startsWith('REASONING') || t.startsWith('ANALYTICAL') || t.startsWith('FEW-SHOT') || t.startsWith('EXAMPLE') || t.startsWith('PROFESSIONAL')) return false;
    if (t.length > 300) return false; // skip huge single lines
    return true;
  });
  return keep.join('\n').slice(0, 8000); // hard cap
}

async function callGroq(systemPrompt, userPrompt, schema) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set');

  const condensedUser = condenseForGroq(userPrompt);
  const groqSystem = `You are a senior financial analyst (CFA). Analyze the given market data and return a complete JSON report. MANDATORY: every single section must have real, substantive content — NEVER leave content empty or say "unavailable".

Required JSON fields:
- summary: string (3-4 sentence executive overview with stance, key catalyst, key risk)
- stance: EXACTLY one of "bullish", "bearish", or "neutral"
- confidence: number 0.0-1.0
- thesis: array of 3 string bullet points (strongest bull arguments or reasons for stance)
- riskFactors: array of 3 string risk bullets (concrete risks with price level conditions)
- sections: array of 7 objects, each with: id (string), title (string), content (string, min 100 chars), bullets (array of 2-4 strings)

Section ids MUST be EXACTLY these 7 (in order):
1. market_snapshot — macro context, price action, SPY/QQQ/VIX if available
2. ai_conclusion — YOUR synthesis verdict, strongest signal, what changes your mind, clear recommendation
3. technical_view — RSI/MACD/BB/SMA analysis OR price-action-based inference if indicators unavailable
4. sentiment_news_pulse — news headlines, analyst consensus, options/short interest if available
5. scenario_paths — 3 scenarios (bull/base/bear) with price targets and probabilities
6. risks_invalidations — 4-5 risks with specific price levels or conditions that invalidate the thesis
7. action_playbook — MANDATORY trading plan: entry price, stop-loss level, target 1, target 2, position sizing

CRITICAL: Every field must be a plain string. No nested objects. action_playbook and ai_conclusion MUST have real content. Return valid JSON only.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: groqSystem },
        { role: 'user',   content: condensedUser + '\n\nReturn a valid JSON object with the required fields.' },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error: ${res.status} — ${errText}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty content');
  return JSON.parse(text);
}

// ── Flatten any nested object/array into a plain string ──────────────────────
function flattenToString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    // Try common keys first, then join all string values
    const keys = ['content', 'text', 'value', 'comment', 'summary', 'description'];
    for (const k of keys) {
      if (typeof v[k] === 'string' && v[k].trim()) return v[k];
    }
    return Object.values(v).filter(x => typeof x === 'string').join(' ').trim();
  }
  return String(v);
}

// ── AI call with Base44 primary + Groq free fallback ─────────────────────────
// dataDesert = true when no provider had data → use Gemini with web search
async function invokeWithFallback(base44, systemPrompt, userPrompt, schema, depth, dataDesert = false) {
  const primaryModel  = MODEL_PRIMARY[depth];
  const fallbackModel = MODEL_FALLBACK[depth];

  const callBase44 = async (model) => {
    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\n---\n\n${userPrompt}`,
      model,
      response_json_schema: schema,
    });
    // Unwrap Base44's envelope if it wraps under "response"
    return r?.response && typeof r.response === 'object' ? r.response : r;
  };

  // Data desert: use Gemini web-grounded first, then Groq as free fallback
  if (dataDesert) {
    try {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n---\n\n${userPrompt}`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: schema,
      });
      const result = r?.response && typeof r.response === 'object' ? r.response : r;
      return { result, modelUsed: 'gemini_3_flash_web', fallbackUsed: false };
    } catch (_) {}

    // Try Base44 fallback model
    try {
      const r = await callBase44(fallbackModel);
      const result = r?.response && typeof r.response === 'object' ? r.response : r;
      return { result, modelUsed: fallbackModel, fallbackUsed: true };
    } catch (_) {}

    // Last resort: Groq
    const result = await callGroq(systemPrompt, userPrompt, schema);
    return { result, modelUsed: `groq_${GROQ_MODEL}`, fallbackUsed: true };
  }

  // Normal path: Base44 primary → Base44 fallback → Groq free fallback
  try {
    const result = await callBase44(primaryModel);
    return { result, modelUsed: primaryModel, fallbackUsed: false };
  } catch (_) {}

  try {
    const result = await callBase44(fallbackModel);
    return { result, modelUsed: fallbackModel, fallbackUsed: true };
  } catch (_) {}

  // Groq free fallback — fires when Base44 credits are exhausted
  const result = await callGroq(systemPrompt, userPrompt, schema);
  return { result, modelUsed: `groq_${GROQ_MODEL}`, fallbackUsed: true };
}

// ── CFA-style system prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior financial analyst with CFA designation and 20 years of experience across equity research, technical analysis, and macro strategy. You reason like a professional:

ANALYTICAL FRAMEWORK:
1. Technical Analysis: Always interpret RSI, MACD, Bollinger Bands, and SMAs together — never in isolation. A single oversold RSI is not a buy signal without momentum confirmation from MACD. Price location relative to SMA20/SMA50 defines the trend regime.
2. Fundamental Analysis: Use P/E relative to sector norms. Earnings beats/misses create lasting price memory. Upcoming earnings are the single largest known volatility catalyst — always flag them.
3. Analyst Consensus: Wall Street consensus shifts are leading indicators. A stock moving from HOLD to BUY consensus is a structural tailwind.
4. Sentiment Integration: News sentiment and price action must be cross-validated. Bullish news in a downtrend = distribution. Bearish news in an uptrend = accumulation opportunity.
5. Options Flow: Put/Call ratio is a real-time sentiment gauge. A PC ratio >1.2 (volume) = institutions hedging downside. <0.7 = speculative call buying. Always cross-check with price action.
6. Short Interest: High short float (>20%) = binary outcome risk — either short squeeze catalyst or sustained distribution. Rising short interest in a downtrend = strong bearish conviction.
7. Insider Transactions: Corporate insiders have the best information advantage. Net insider buying in the last 90 days is one of the strongest contrarian bullish signals. Net selling is a yellow flag, not always bearish (diversification).
8. Macro Context: VIX above 25 compresses risk asset multiples — even fundamentally strong stocks struggle. SPY/QQQ daily trend defines the market regime; trading against it requires a high-conviction catalyst.
9. Risk Management: Every thesis has an invalidation level. Specific price levels are more useful than qualitative descriptions.

REASONING APPROACH:
- Start with the macro trend (SMA50 regime), then layer shorter-term signals (SMA20, MACD), then momentum (RSI, Stochastic), then catalysts (earnings, news, analyst changes).
- For swing trades: focus on MACD crossover timing, RSI momentum, and next earnings date as a hard deadline.
- For scalps: focus on Bollinger Band position, volume trend, and intraday momentum.
- For long-term: focus on fundamental value (P/E, analyst consensus), earnings trajectory, and macro regime.

PROFESSIONAL STANDARDS:
- Cite specific price levels (support/resistance from SMA20/50, BB bands).
- State the primary catalyst and its probability clearly.
- Acknowledge conflicting signals — do not paper over them.
- Never use phrases like "guaranteed", "risk-free", or "certain".
- Confidence score reflects the convergence of signals: 0.8+ = strong multi-signal alignment, 0.5-0.7 = mixed signals, <0.5 = unclear/contradictory.

FEW-SHOT EXAMPLES OF PROFESSIONAL REASONING:

EXAMPLE 1 — BULLISH SETUP (NVDA-like):
Context: RSI=62 (momentum, not overbought), MACD hist=+0.45 (bullish crossover), price above SMA20 ($820) and SMA50 ($790), BB middle=$815, analyst consensus=BUY (78% bulls), earnings in 18 days with 4 consecutive beats.
Reasoning: "NVDA is in a confirmed uptrend (price above both SMAs). MACD histogram expansion confirms bullish momentum. RSI at 62 has room to run before overbought territory. The 78% buy consensus provides a structural tailwind. The upcoming earnings in 18 days represent a binary event — 4 consecutive EPS beats argue for a positive surprise probability above base rate. Key support at SMA20 $820. Bull case invalidated below SMA50 $790."
Stance: bullish. Confidence: 0.76.

EXAMPLE 2 — BEARISH/NEUTRAL SETUP (META-like correction):
Context: RSI=38 (approaching oversold but not there), MACD hist=-0.82 (bearish, widening), price below SMA20 ($485) but above SMA50 ($460), BB lower=$472, analyst consensus=HOLD (44% bulls), earnings in 3 days, last quarter missed revenue by 2%.
Reasoning: "META is in a short-term downtrend (below SMA20) but long-term uptrend (above SMA50). The widening MACD histogram indicates accelerating selling pressure. RSI approaching oversold but not yet at reversal territory. With earnings in 3 days after a recent revenue miss, downside risk is elevated. Holding SMA50 at $460 is critical — a breach would shift this from short-term correction to trend reversal. The HOLD consensus offers no institutional buying support. Tactically bearish, structurally neutral."
Stance: bearish. Confidence: 0.63.`;

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    if (!FEATURE_ENABLED) {
      return err('ASK_AI_SINGLE_INPUT_DISABLED', 'Ask AI single-input engine is currently disabled.', false, 503);
    }

    const body = await req.json().catch(() => null);
    if (!body?.requestId) return err('INVALID_INPUT', 'requestId is required');
    if (!body?.asset)     return err('INVALID_INPUT', 'asset is required');

    const reqId     = body.requestId;
    const asset     = body.asset.toUpperCase().trim();
    const timeframe = body.timeframe || 'swing';
    const locale    = body.locale    || 'en';
    const depth     = ['quick','standard','deep'].includes(body.depth) ? body.depth : 'deep';
    const cost      = TOKEN_COST[depth];
    const userId    = user.id;
    const isCrypto  = CRYPTO_SET.has(asset);

    // ── Idempotency ────────────────────────────────────────────────────────────
    const existing = await base44.asServiceRole.entities.AskAiHistory.filter({ request_id: reqId });
    if (existing.length > 0) {
      const h = existing[0];
      const wallet = await getWallet(base44, userId);
      const report = h.report_json ? JSON.parse(h.report_json) : {
        reportVersion: 'v2',
        generatedAt: h.created_date,
        assetMeta: { symbol: h.asset, timeframe: h.timeframe || timeframe, locale, market: 'live' },
        sections: buildSections(null, h.asset),
        asset: h.asset, summary: h.summary, stance: h.stance, confidence: h.confidence,
        thesis: h.thesis_json ? JSON.parse(h.thesis_json) : [],
        riskFactors: h.risk_factors_json ? JSON.parse(h.risk_factors_json) : [],
        disclaimer: DISCLAIMER,
      };
      return ok({
        requestId: reqId, status: 'completed', report,
        wallet: { userId, balanceFree: wallet?.free_balance || 0, balancePurchased: wallet?.paid_balance || 0 },
        usage: { inputTokens: h.input_tokens || 0, outputTokens: h.output_tokens || 0, costEstimateUsd: 0 },
        fallbackUsed: h.fallback_used || false,
        latencyMs: h.latency_ms || 0,
      }, reqId);
    }

    // ── Balance check ──────────────────────────────────────────────────────────
    const wallet = await ensureWallet(base44, userId);
    const total  = (wallet.free_balance || 0) + (wallet.paid_balance || 0);
    if (total < cost) return err('INSUFFICIENT_TOKENS', `This analysis costs ${cost} token(s). You have ${total}.`, false, 402);

    // ── Reserve tokens ─────────────────────────────────────────────────────────
    const freeDebit = Math.min(wallet.free_balance || 0, cost);
    const paidDebit = cost - freeDebit;
    const bucket    = freeDebit > 0 && paidDebit > 0 ? 'mixed' : freeDebit > 0 ? 'free' : 'paid';

    await base44.asServiceRole.entities.Wallet.update(wallet.id, {
      free_balance: (wallet.free_balance || 0) - freeDebit,
      paid_balance: (wallet.paid_balance || 0) - paidDebit,
      version: (wallet.version || 1) + 1,
    });

    const reserveEntry = await base44.asServiceRole.entities.TokenLedger.create({
      user_id: userId, request_id: reqId, type: 'reserve', amount: cost,
      bucket, source: 'ask_ai', status: 'pending', note: `${depth} analysis for ${asset}`,
    });

    // ── Fetch all market context in parallel ───────────────────────────────────
    const [quote, metrics, newsRaw, technicals, analystSentiment, earningsCtx, optionsSentiment, shortInterest, insiderActivity, macroCtx] = await Promise.all([
      isCrypto
        ? fhGet(`/quote?symbol=BINANCE:${asset}USDT`).then(r => r?.c ? r : fhGet(`/quote?symbol=COINBASE:${asset}USD`))
        : fhGet(`/quote?symbol=${asset}`),
      isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${asset}&metric=all`),
      (async () => {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const articles = await fhGet(`/company-news?symbol=${asset}&from=${from}&to=${to}`);
        return (articles || []).slice(0, 8).map(a => a.headline?.slice(0, 120)).filter(Boolean);
      })(),
      fetchTechnicals(asset, isCrypto),
      fetchAnalystSentiment(asset, isCrypto),
      fetchEarningsContext(asset, isCrypto, base44),
      fetchOptionsSentiment(asset, isCrypto),
      fetchShortInterest(asset, isCrypto),
      fetchInsiderActivity(asset, isCrypto),
      fetchMacroContext(),
    ]);

    // ── Detect data desert (local/foreign asset with no provider coverage) ────
    const hasProviderData = !!(quote?.c || technicals);
    const dataDesert = !hasProviderData;

    // ── Build context object for prompt ───────────────────────────────────────
    const marketContext = {
      symbol: asset,
      assetType: isCrypto ? 'crypto' : 'equity',
      timeframe,
      price: quote?.c || null,
      changePct: quote?.dp || null,
      high: quote?.h || null,
      low: quote?.l || null,
      prevClose: quote?.pc || null,
      pe: metrics?.metric?.peBasicExclExtraTTM || null,
      week52High: metrics?.metric?.['52WeekHigh'] || null,
      week52Low:  metrics?.metric?.['52WeekLow']  || null,
      avgVolume: metrics?.metric?.['10DayAverageTradingVolume'] || null,
      recentHeadlines: newsRaw || [],
    };

    // ── Build prompt sections ─────────────────────────────────────────────────
    const techSection = technicals ? `
TECHNICAL INDICATORS (calculated from last 120 days of daily OHLCV — Alpaca):
- RSI(14): ${technicals.rsi ?? 'N/A'} → ${technicals.rsiLabel ?? 'N/A'}
- MACD: ${technicals.macd ?? 'N/A'} | Signal: ${technicals.macdSignal ?? 'N/A'} | Histogram: ${technicals.macdHist ?? 'N/A'} → ${technicals.macdInterpretation ?? 'N/A'}
- Bollinger Bands(20,2): Upper=${technicals.bbUpper ?? 'N/A'} | Middle=${technicals.bbMiddle ?? 'N/A'} | Lower=${technicals.bbLower ?? 'N/A'}
- SMA20: ${technicals.sma20 ?? 'N/A'} (price is ${technicals.priceVsSMA20 ?? 'N/A'} SMA20)
- SMA50: ${technicals.sma50 ?? 'N/A'} (price is ${technicals.priceVsSMA50 ?? 'N/A'} SMA50)
- Stochastic %K(14): ${technicals.stoch ?? 'N/A'}
- Volume Trend (5d/20d avg): ${technicals.volumeTrend ?? 'N/A'}x (${technicals.volumeTrend > 1.2 ? 'above average — increasing interest' : technicals.volumeTrend < 0.8 ? 'below average — waning interest' : 'in line with average'})
` : `\nTECHNICAL INDICATORS: Not available for this asset.\n`;

    const analystSection = analystSentiment ? `
ANALYST CONSENSUS (Finnhub, most recent month: ${analystSentiment.period}):
- Strong Buy: ${analystSentiment.strongBuy} | Buy: ${analystSentiment.buy} | Hold: ${analystSentiment.hold} | Sell: ${analystSentiment.sell} | Strong Sell: ${analystSentiment.strongSell}
- Total analysts: ${analystSentiment.total} | Bull%: ${analystSentiment.bullPct}% | Bear%: ${analystSentiment.bearPct}%
- Wall Street Consensus: ${analystSentiment.consensus}
` : `\nANALYST CONSENSUS: Not available (crypto or no coverage).\n`;

    const earningsSection = earningsCtx ? `
UPCOMING EARNINGS:
- Next report date: ${earningsCtx.nextEarningsDate} (${earningsCtx.daysUntilEarnings} days away, ${earningsCtx.timing})
- EPS Estimate: ${earningsCtx.epsEstimate ?? 'N/A'} | Revenue Estimate: ${earningsCtx.revenueEstimate ?? 'N/A'}
${earningsCtx.epsHistory?.length ? `- Last 4 quarters EPS history: ${earningsCtx.epsHistory.map(q => `${q.period}: est=${q.estimate} actual=${q.actual} (${q.beat})`).join(' | ')}` : '- EPS history: not available'}
` : `\nUPCOMING EARNINGS: No earnings report found in the next 8 weeks (or crypto asset).\n`;

    const optionsSection = optionsSentiment ? `
OPTIONS FLOW (Finnhub):
- Total Call OI: ${optionsSentiment.totalCallOI.toLocaleString()} | Total Put OI: ${optionsSentiment.totalPutOI.toLocaleString()}
- Call Volume: ${optionsSentiment.totalCallVol.toLocaleString()} | Put Volume: ${optionsSentiment.totalPutVol.toLocaleString()}
- Put/Call Ratio (OI): ${optionsSentiment.pcRatioOI ?? 'N/A'} | Put/Call Ratio (Volume): ${optionsSentiment.pcRatioVol ?? 'N/A'}
- Options Sentiment: ${optionsSentiment.sentiment ?? 'N/A'} (>1.2 = bearish skew, <0.7 = bullish skew)
` : `\nOPTIONS FLOW: Not available (crypto or no options coverage).\n`;

    const shortSection = shortInterest ? `
SHORT INTEREST (Finnhub, as of ${shortInterest.date}):
- Short % of Float: ${shortInterest.shortPct ?? 'N/A'}% | Trend: ${shortInterest.trend ?? 'N/A'}
- Short Squeeze Risk: ${shortInterest.highShortSqueezeRisk ? 'ELEVATED (>20% short float)' : 'Normal'}
` : `\nSHORT INTEREST: Not available.\n`;

    const insiderSection = insiderActivity ? `
INSIDER TRANSACTIONS (last 90 days, Finnhub):
- Buy transactions: ${insiderActivity.buyCount} (${insiderActivity.buyShares.toLocaleString()} shares)
- Sell transactions: ${insiderActivity.sellCount} (${insiderActivity.sellShares.toLocaleString()} shares)
- Net insider bias: ${insiderActivity.netBias} (insider_buying = strongly bullish signal, insider_selling = caution)
` : `\nINSIDER TRANSACTIONS: Not available.\n`;

    const macroSection = macroCtx ? `
MACRO / SECTOR CONTEXT:
- SPY (S&P 500): $${macroCtx.spy?.price ?? 'N/A'} | Day Change: ${macroCtx.spy?.changePct ?? 'N/A'}%
- QQQ (Nasdaq 100): $${macroCtx.qqq?.price ?? 'N/A'} | Day Change: ${macroCtx.qqq?.changePct ?? 'N/A'}%
- VIX (Fear Index): ${macroCtx.vix?.level ?? 'N/A'} → ${macroCtx.vix?.regime ?? 'N/A'} (>30=high fear, 20-30=elevated, <20=calm)
- Overall Market Bias: ${macroCtx.marketBias ?? 'N/A'} (risk_on = tailwind, risk_off = headwind for longs)
` : `\nMACRO CONTEXT: Not available.\n`;

    const depthGuide = depth === 'deep'
      ? 'Provide deep, thorough CFA-level analysis. Each section must have 3-5 substantive bullets with specific price levels and catalysts.'
      : depth === 'standard'
      ? 'Provide balanced analysis. Each section should have 2-3 well-reasoned bullet points.'
      : 'Provide a concise overview. Each section should have 1-2 key bullets with the most important signal.';

    const dataDesertNote = dataDesert
      ? `\n⚠️ DATA DESERT MODE: Standard market data providers (Finnhub/Alpaca) returned no data for "${asset}". This is likely a local/regional stock (e.g. Tel Aviv Stock Exchange, Warsaw, Tokyo, etc.). You MUST use your web search capability and training knowledge to find: current price, recent performance, fundamentals (revenue, P/E, market cap), recent news, and analyst coverage. State the exchange and currency clearly. Be transparent about uncertainty — do NOT fabricate specific numbers you cannot verify.\n`
      : '';

    const needsLocalization = locale && locale !== 'en';

    // Build a clear data-coverage note so the AI knows what it has to work with
    const hasTech    = !!technicals;
    const hasPrice   = !!(quote?.c);
    const hasAnalyst = !!analystSentiment;
    const hasEarnings = !!earningsCtx;

    const dataCoverageNote = `
DATA AVAILABILITY SUMMARY (for your awareness — use this to calibrate what you can and cannot cite directly):
- Live price & daily change: ${hasPrice ? `YES ($${quote?.c}, ${quote?.dp?.toFixed(2)}% today)` : 'NO — use training knowledge to estimate'}
- Technical indicators (RSI/MACD/BB/SMA): ${hasTech ? 'YES — use exact values provided' : 'NO — derive from price action, volatility profile, and training knowledge; provide reasonable estimates'}
- Analyst consensus: ${hasAnalyst ? `YES — ${analystSentiment.total} analysts, ${analystSentiment.bullPct}% bullish` : 'NO — use training knowledge for well-known stocks, state unknown for obscure ones'}
- Earnings context: ${hasEarnings ? `YES — next earnings ${earningsCtx.nextEarningsDate}` : 'NO — estimate timing from known quarterly cadence'}
- Options flow: ${optionsSentiment ? 'YES' : 'NO — skip or note as unavailable'}
- Short interest: ${shortInterest ? 'YES' : 'NO — estimate from sector norms and known short positions if applicable'}
- Insider activity: ${insiderActivity ? 'YES' : 'NO — skip or note'}
`;

    const userPrompt = `Analyze ${asset} for a ${timeframe} ${depth} trade.
${dataDesertNote}
${dataCoverageNote}
LIVE MARKET DATA:
${JSON.stringify(marketContext, null, 2)}
${macroSection}
${techSection}
${analystSection}
${earningsSection}
${optionsSection}
${shortSection}
${insiderSection}

DEPTH REQUIREMENT: ${depthGuide}

═══════════════════════════════════════════════════
MANDATORY OUTPUT RULES — NON-NEGOTIABLE:
═══════════════════════════════════════════════════
You MUST output ALL 7 sections. No section may have empty content or say "Analysis unavailable". 
If you lack data for a section, SYNTHESIZE using: (a) other available data, (b) price action inference, (c) sector/peer comparisons, (d) your training knowledge. You are a senior analyst — you always form a view.

SECTION-SPECIFIC MANDATORY CONTENT:

1. market_snapshot: Describe macro context (SPY/QQQ/VIX if available, otherwise note market regime from your knowledge). Always state the current price and day's move.

2. ai_conclusion: THIS IS YOUR SYNTHESIS SECTION — it must ALWAYS be fully generated. State your overall verdict, the single strongest signal driving your stance, and what would change your mind. Never leave this empty. Format: 2-3 paragraph professional conclusion with a clear buy/hold/sell recommendation and reasoning.

3. technical_view: If indicators are provided, analyze them precisely. If NOT available, you MUST still provide technical analysis by: estimating trend direction from price vs. 52-week range, inferring momentum from day's price action, and noting what a trader should look for on a chart. Never say "all data unavailable" — always provide value.

4. sentiment_news_pulse: Synthesize news headlines, analyst consensus, and market sentiment. If some data is missing, state what is known and what requires independent verification.

5. scenario_paths: ALWAYS provide 3 scenarios (bull/base/bear) with specific price targets derived from available data or reasonable estimates. Include probabilities summing to ~100%.

6. risks_invalidations: List 4-5 concrete risks with specific price levels or conditions that would invalidate the thesis. Always provide value even with limited data.

7. action_playbook: MANDATORY — must ALWAYS contain a clear, actionable trading plan with: entry strategy, position sizing guidance, stop-loss reference level, and take-profit targets. Use current price as anchor. This section MUST NEVER be empty.

ADDITIONAL RULES:
- ${dataDesert ? 'DATA DESERT: Use your training knowledge and any web context. Be transparent about confidence levels.' : 'Use exact numeric data from above. Do NOT fabricate specific numbers not in the data.'}
- stance: exactly bullish, bearish, or neutral.
- confidence: 0.0–1.0 (0.8+ = strong alignment, 0.5–0.7 = mixed signals, <0.5 = high uncertainty).
- Each section MUST have at least 2 bullet points (minimum — more for deep analysis).
- summary: 3-4 sentence executive overview covering stance, key catalyst, and key risk.
${needsLocalization ? `- LOCALIZATION: Output a "localizedSummary" field — 3-5 sentence summary written in ${locale}. Full report remains in English. Only this field is in ${locale}.` : ''}`;

    const reportSchema = {
      type: 'object',
      properties: {
        summary:    { type: 'string' },
        stance:     { type: 'string' },
        confidence: { type: 'number' },
        thesis:     { type: 'array', items: { type: 'string' } },
        riskFactors:{ type: 'array', items: { type: 'string' } },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:      { type: 'string' },
              title:   { type: 'string' },
              content: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'title', 'content', 'bullets'],
          },
        },
        ...(needsLocalization ? {
          localizedSummary: { type: 'string', description: `A concise 3-5 sentence summary of the entire report written in the locale language (${locale}). This is the only localized field — all other fields remain in English.` },
        } : {}),
      },
      required: ['summary', 'stance', 'confidence', 'thesis', 'riskFactors', 'sections'],
    };

    // ── Call AI with fallback ──────────────────────────────────────────────────
    let aiRaw = null, modelUsed = null, fallbackUsed = false, aiError = null;
    let inputTokens = 0, outputTokens = 0;

    try {
      const { result, modelUsed: m, fallbackUsed: f } = await invokeWithFallback(base44, SYSTEM_PROMPT, userPrompt, reportSchema, depth, dataDesert);
      // Base44 InvokeLLM sometimes wraps the JSON under a top-level "response" key
      aiRaw = result?.response && typeof result.response === 'object' ? result.response : result;
      modelUsed = m;
      fallbackUsed = f;
      inputTokens  = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4);
      outputTokens = Math.ceil(JSON.stringify(aiRaw).length / 4);
    } catch (e) {
      aiError = e.message;
    }

    const latencyMs = Date.now() - t0;

    if (!aiRaw && aiError?.includes('timeout')) {
      const cw = await getWallet(base44, userId);
      await base44.asServiceRole.entities.Wallet.update(cw.id, {
        free_balance: (cw.free_balance || 0) + freeDebit,
        paid_balance: (cw.paid_balance || 0) + paidDebit,
        version: (cw.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'released', type: 'release', note: `Timeout: ${aiError}` });
      return err('ASK_AI_TIMEOUT', 'Analysis timed out. Tokens have been refunded.', true, 503);
    }

    if (aiRaw) {
      // Flatten any nested objects Groq may return for string fields
      if (aiRaw.summary && typeof aiRaw.summary !== 'string') aiRaw.summary = flattenToString(aiRaw.summary);
      if (aiRaw.stance  && typeof aiRaw.stance  !== 'string') aiRaw.stance  = flattenToString(aiRaw.stance);
      if (Array.isArray(aiRaw.sections)) {
        aiRaw.sections = aiRaw.sections.map(s => ({
          ...s,
          content: typeof s.content === 'string' ? s.content : flattenToString(s.content),
          bullets: Array.isArray(s.bullets) ? s.bullets.map(b => typeof b === 'string' ? b : flattenToString(b)) : [],
        }));
      }
      if (Array.isArray(aiRaw.thesis))      aiRaw.thesis      = aiRaw.thesis.map(t => typeof t === 'string' ? t : flattenToString(t));
      if (Array.isArray(aiRaw.riskFactors)) aiRaw.riskFactors = aiRaw.riskFactors.map(r => typeof r === 'string' ? r : flattenToString(r));

      // ── Post-processing safety net: fill any empty/missing critical sections ─
      // These sections should NEVER be empty — synthesize from available data
      const stanceWord  = normalizeStance(aiRaw.stance || 'neutral');
      const priceStr    = quote?.c ? `$${quote.c.toFixed(2)}` : 'current price';
      const changeStr   = quote?.dp != null ? `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%` : 'flat';
      const analystStr  = analystSentiment ? `${analystSentiment.bullPct}% of ${analystSentiment.total} analysts rate it a Buy` : null;
      const rsiStr      = technicals?.rsi ? `RSI(14) at ${technicals.rsi} (${technicals.rsiLabel})` : null;
      const macdStr     = technicals?.macdInterpretation ? `MACD shows ${technicals.macdInterpretation}` : null;
      const smaStr      = technicals?.sma50 ? `price ${technicals.priceVsSMA50} the 50-day SMA ($${technicals.sma50})` : null;
      const vixStr      = macroCtx?.vix ? `VIX at ${macroCtx.vix.level} (${macroCtx.vix.regime})` : null;
      const spyStr      = macroCtx?.spy ? `SPY ${macroCtx.spy.changePct > 0 ? '+' : ''}${macroCtx.spy.changePct.toFixed(2)}%` : null;

      aiRaw.sections = aiRaw.sections || [];

      // Helper: check if a section has real content
      const isSectionEmpty = (id) => {
        const sec = aiRaw.sections.find(s => s.id === id);
        if (!sec) return true;
        const c = sec.content || '';
        return c.trim() === '' || c.toLowerCase().includes('analysis unavailable') || c.trim().length < 30;
      };

      // Synthesize ai_conclusion if missing/empty
      if (isSectionEmpty('ai_conclusion')) {
        const topSignals = [analystStr, rsiStr, macdStr, smaStr].filter(Boolean).slice(0, 2).join('; ') || 'price action and market context';
        const bullets = [
          `Verdict: ${stanceWord.toUpperCase()} — driven by ${topSignals}.`,
          `Key catalyst: ${earningsCtx ? `upcoming earnings ${earningsCtx.nextEarningsDate}` : analystStr ? 'analyst consensus' : 'macro trend'}.`,
          `Confidence ${Math.round((aiRaw.confidence || 0.5) * 100)}%: ${(aiRaw.confidence || 0.5) > 0.7 ? 'strong signal alignment' : 'mixed signals — use smaller position size'}.`,
        ];
        const content = `${asset} verdict: ${stanceWord.toUpperCase()} at ${priceStr} (${changeStr} today). ${topSignals ? `Key signals: ${topSignals}. ` : ''}${stanceWord === 'bullish' ? 'Risk/reward favors long exposure with defined stop-loss.' : stanceWord === 'bearish' ? 'Caution warranted — reduce exposure or hedge.' : 'Wait for catalyst-driven breakout before committing capital.'}`;
        const idx = aiRaw.sections.findIndex(s => s.id === 'ai_conclusion');
        if (idx >= 0) { aiRaw.sections[idx].content = content; aiRaw.sections[idx].bullets = bullets; }
        else aiRaw.sections.push({ id: 'ai_conclusion', title: 'AI Conclusion', content, bullets });
      }

      // Synthesize action_playbook if missing/empty
      if (isSectionEmpty('action_playbook')) {
        const p = quote?.c || 0;
        const stopPct    = timeframe === 'scalp' ? 0.02 : timeframe === 'swing' ? 0.06 : 0.12;
        const t1Pct      = timeframe === 'scalp' ? 0.015 : timeframe === 'swing' ? 0.08 : 0.20;
        const t2Pct      = timeframe === 'scalp' ? 0.03  : timeframe === 'swing' ? 0.15 : 0.35;
        const stopPrice  = p > 0 ? `$${(p * (1 - stopPct)).toFixed(2)}` : 'prior swing low';
        const t1Price    = p > 0 ? `$${(p * (1 + t1Pct)).toFixed(2)}` : 'first resistance';
        const t2Price    = p > 0 ? `$${(p * (1 + t2Pct)).toFixed(2)}` : 'extended target';
        const content = `${asset} ${timeframe} ${stanceWord} playbook: Entry near ${priceStr}. Stop-loss ${stopPrice} (${Math.round(stopPct*100)}% risk). Target 1: ${t1Price}, Target 2: ${t2Price}. Risk max 1-2% of portfolio. ${(aiRaw.confidence || 0.5) < 0.6 ? 'Lower confidence — use half-size position.' : ''}`;
        const bullets = [
          `Entry: ${stanceWord !== 'bearish' ? `Accumulate near ${priceStr}` : `Reduce long exposure at ${priceStr}`}. Staged entry preferred.`,
          `Stop-loss: ${stopPrice} — exit if breached on daily close.`,
          `Target 1: ${t1Price} — take 40% profit. Trail stop to breakeven.`,
          `Target 2: ${t2Price} — hold remainder for full ${timeframe} move.`,
        ];
        const idx = aiRaw.sections.findIndex(s => s.id === 'action_playbook');
        if (idx >= 0) { aiRaw.sections[idx].content = content; aiRaw.sections[idx].bullets = bullets; }
        else aiRaw.sections.push({ id: 'action_playbook', title: 'Action Playbook', content, bullets });
      }

      // Synthesize technical_view if missing/empty and we have price data
      if (isSectionEmpty('technical_view') && hasPrice) {
        const p = quote.c;
        const w52h = marketContext.week52High, w52l = marketContext.week52Low;
        const rangePos = (w52h && w52l) ? Math.round((p - w52l) / (w52h - w52l) * 100) : null;
        const content = `Technical indicators unavailable via providers for ${asset}. Price action: ${priceStr} (${changeStr}). ${rangePos != null ? `At ${rangePos}% of 52-week range ($${w52l}–$${w52h}) — ${rangePos > 70 ? 'upper range/momentum' : rangePos < 30 ? 'near lows/value zone' : 'mid-range'}.` : ''} Verify RSI/MACD/SMA on TradingView before entry.`;
        const bullets = [
          rangePos != null ? `52-week range: ${rangePos}% from low (${rangePos > 70 ? 'momentum zone' : rangePos < 30 ? 'value zone' : 'neutral'}).` : `Confirm trend via SMA20/50 on chart.`,
          `Intraday: High $${quote.h?.toFixed(2)}, Low $${quote.l?.toFixed(2)}, Prior close $${quote.pc?.toFixed(2)}.`,
          `Action: ${Math.abs(quote.dp || 0) > 3 ? 'Significant move — verify volume confirms on chart.' : 'Normal volatility — wait for breakout confirmation.'}`,
        ];
        const idx = aiRaw.sections.findIndex(s => s.id === 'technical_view');
        if (idx >= 0) { aiRaw.sections[idx].content = content; aiRaw.sections[idx].bullets = bullets; }
        else aiRaw.sections.push({ id: 'technical_view', title: 'Technical View', content, bullets });
      }

      const normalizedStance     = normalizeStance(aiRaw.stance);
      const normalizedConfidence = clampConfidence(aiRaw.confidence);

      // ── Trim to prevent DB field-size overflow ────────────────────────────────
      // Target: report_json < 60KB. Trim aggressively at the section level.
      if (Array.isArray(aiRaw.sections)) {
        aiRaw.sections = aiRaw.sections.map(s => ({
          ...s,
          content: typeof s.content === 'string' ? s.content.slice(0, 1800) : s.content,
          bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 5).map(b => typeof b === 'string' ? b.slice(0, 280) : b) : [],
        }));
      }
      if (Array.isArray(aiRaw.thesis))      aiRaw.thesis      = aiRaw.thesis.slice(0, 5).map(t => typeof t === 'string' ? t.slice(0, 280) : t);
      if (Array.isArray(aiRaw.riskFactors)) aiRaw.riskFactors = aiRaw.riskFactors.slice(0, 5).map(r => typeof r === 'string' ? r.slice(0, 280) : r);
      if (typeof aiRaw.summary === 'string') aiRaw.summary = aiRaw.summary.slice(0, 600);

      const sections             = buildSections(aiRaw, asset);
      const thesis               = (aiRaw.thesis || []).map(sanitize);
      const riskFactors          = (aiRaw.riskFactors || []).map(sanitize);
      const summary              = sanitize(aiRaw.summary || '');

      const localizedSummary = needsLocalization && aiRaw.localizedSummary
        ? sanitize(aiRaw.localizedSummary)
        : null;

      const report = {
        reportVersion: 'v2',
        generatedAt: new Date().toISOString(),
        assetMeta: { symbol: asset, timeframe, locale, market: 'live', dataSource: dataDesert ? 'web_search' : 'providers' },
        sections,
        asset, summary,
        ...(localizedSummary ? { localizedSummary } : {}),
        stance: normalizedStance,
        confidence: normalizedConfidence,
        thesis,
        riskFactors,
        disclaimer: DISCLAIMER,
      };

      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'completed', type: 'commit' });

      await base44.asServiceRole.entities.AskAiHistory.create({
        user_id: userId, request_id: reqId, asset,
        mode: depth, depth, timeframe,
        summary, stance: normalizedStance, confidence: normalizedConfidence,
        thesis_json: JSON.stringify(thesis),
        risk_factors_json: JSON.stringify(riskFactors),
        disclaimer: DISCLAIMER,
        report_json: JSON.stringify(report),
        model_used: modelUsed,
        fallback_used: fallbackUsed,
        latency_ms: latencyMs,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });

      const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: userId });
      if (offerRows.length > 0) {
        await base44.asServiceRole.entities.OfferState.update(offerRows[0].id, {
          free_tokens_used_total: (offerRows[0].free_tokens_used_total || 0) + (freeDebit > 0 ? freeDebit : 0),
        });
      } else {
        await base44.asServiceRole.entities.OfferState.create({ user_id: userId, free_tokens_used_total: freeDebit > 0 ? freeDebit : 0, purchase_count: 0, config_version: 'v1' });
      }

      const updatedWallet = await getWallet(base44, userId);
      const costEstimateUsd = depth === 'deep'
        ? (inputTokens * 0.000003 + outputTokens * 0.000015)
        : (inputTokens + outputTokens) * 0.0000006;

      return ok({
        requestId: reqId, status: 'completed', report,
        wallet: {
          userId,
          balanceFree: updatedWallet?.free_balance || 0,
          balancePurchased: updatedWallet?.paid_balance || 0,
        },
        usage: { inputTokens, outputTokens, costEstimateUsd: +costEstimateUsd.toFixed(6) },
        fallbackUsed,
        latencyMs,
      }, reqId);

    } else {
      const cw = await getWallet(base44, userId);
      await base44.asServiceRole.entities.Wallet.update(cw.id, {
        free_balance: (cw.free_balance || 0) + freeDebit,
        paid_balance: (cw.paid_balance || 0) + paidDebit,
        version: (cw.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'released', type: 'release', note: `AI error: ${aiError}` });
      return err('ASK_AI_ERROR', 'AI analysis failed. Tokens have been refunded.', true, 503);
    }

  } catch (e) {
    return err('ASK_AI_ERROR', e.message, true, 500);
  }
});