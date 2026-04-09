/**
 * generateMarketWrap — Uses hot board + news cache to write a daily AI market wrap.
 * Stores in CachedData as market_wrap_YYYY-MM-DD.
 * Called by scheduled automation at 6:30 AM Israel time (04:30 UTC).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const GROQ_KEY = Deno.env.get('GROQ_API_KEY');

async function invokeLLM(base44, prompt, schema) {
  try {
    return await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
  } catch (_) {}
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt + '\n\nRespond with a valid JSON object.' }], response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 2048 }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];
    const key = `market_wrap_${today}`;

    // Fetch hot board + news from cache in parallel
    const [hotboardRows, newsRows] = await Promise.all([
      base44.asServiceRole.entities.CachedData.filter({ cache_key: 'hotboard' }),
      base44.asServiceRole.entities.CachedData.filter({ cache_key: 'news' }),
    ]);

    const hotboard = hotboardRows[0]?.data ? JSON.parse(hotboardRows[0].data) : [];
    const news = newsRows[0]?.data ? JSON.parse(newsRows[0].data) : [];

    const topGainers = hotboard.filter(a => a.positive).slice(0, 5);
    const topLosers  = hotboard.filter(a => !a.positive).slice(0, 3);
    const topMovers  = [...topGainers.slice(0, 3), ...topLosers.slice(0, 2)];

    const marketContext = hotboard.length > 0
      ? `Market data for ${today}:
Gainers: ${JSON.stringify(topGainers.map(a => ({ symbol: a.symbol, name: a.name, change: a.change, signal: a.signal })))}
Losers:  ${JSON.stringify(topLosers.map(a => ({ symbol: a.symbol, name: a.name, change: a.change })))}
Top news: ${JSON.stringify(news.slice(0, 8).map(n => ({ title: n.title, summary: n.summary, sentiment: n.sentiment })))}`
      : `Date: ${today}. No live data available — write based on general market context.`;

    const result = await invokeLLM(base44, `You are a senior financial journalist. Write a professional daily market wrap for ${today}.

${marketContext}

Write with these exact fields:
- headline: Punchy newspaper-style headline, max 12 words, capital case
- intro_paragraph: 2-3 sentences covering the most important thing that happened today. Lead with data.
- equities_section: 3-4 sentences on stock market. Mention specific movers and sectors.
- crypto_section: 2-3 sentences on crypto markets. Specific coins and price action.
- macro_outlook: 2-3 sentences on macro/Fed/rates/what to watch this week.
- ai_insight: One bold, specific AI-generated prediction or contrarian insight (1-2 sentences, quote style).

Tone: Bloomberg-level quality. Confident, specific, data-driven. No fluff.`, {
        type: 'object',
        properties: {
          headline:          { type: 'string' },
          intro_paragraph:   { type: 'string' },
          equities_section:  { type: 'string' },
          crypto_section:    { type: 'string' },
          macro_outlook:     { type: 'string' },
          ai_insight:        { type: 'string' },
        },
        required: ['headline', 'intro_paragraph']
      });

    // Flatten: guard against Groq returning nested objects instead of strings
    const str = (v) => typeof v === 'string' ? v : (typeof v === 'object' && v ? Object.values(v).join(' ') : String(v ?? ''));

    const wrap = {
      date: today,
      headline:         str(result.headline),
      intro_paragraph:  str(result.intro_paragraph),
      equities_section: str(result.equities_section),
      crypto_section:   str(result.crypto_section),
      macro_outlook:    str(result.macro_outlook),
      ai_insight:       str(result.ai_insight),
      top_movers: topMovers,
      generated_at: new Date().toISOString(),
    };

    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
    const payload  = { cache_key: key, data: JSON.stringify(wrap), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, date: today, headline: result.headline });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});