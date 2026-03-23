/**
 * trackBotVisit — No auth required. Logs AI crawler / bot visits.
 * Called fire-and-forget from frontend when a known bot UA is detected.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const BOT_PATTERNS = [
  { pattern: /GPTBot/i, name: 'GPTBot (OpenAI)' },
  { pattern: /ChatGPT-User/i, name: 'ChatGPT Browser' },
  { pattern: /OAI-SearchBot/i, name: 'OpenAI SearchBot' },
  { pattern: /ClaudeBot/i, name: 'ClaudeBot (Anthropic)' },
  { pattern: /Claude-Web/i, name: 'Claude Web (Anthropic)' },
  { pattern: /Googlebot/i, name: 'Googlebot' },
  { pattern: /Google-Extended/i, name: 'Google-Extended (Gemini)' },
  { pattern: /Bingbot/i, name: 'Bingbot (Microsoft)' },
  { pattern: /PerplexityBot/i, name: 'PerplexityBot' },
  { pattern: /YouBot/i, name: 'YouBot (You.com)' },
  { pattern: /FacebookBot/i, name: 'FacebookBot' },
  { pattern: /Twitterbot/i, name: 'Twitterbot' },
  { pattern: /LinkedInBot/i, name: 'LinkedInBot' },
  { pattern: /Applebot/i, name: 'Applebot' },
  { pattern: /DuckDuckBot/i, name: 'DuckDuckBot' },
  { pattern: /Bytespider/i, name: 'Bytespider (TikTok)' },
  { pattern: /PetalBot/i, name: 'PetalBot (Huawei)' },
  { pattern: /SemrushBot/i, name: 'SemrushBot' },
  { pattern: /AhrefsBot/i, name: 'AhrefsBot' },
];

export function identifyBot(ua) {
  for (const { pattern, name } of BOT_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  // Generic bot fallback
  if (/bot|crawler|spider|scraper/i.test(ua)) return 'Unknown Bot';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_agent, page, referrer } = await req.json();

    const bot_name = identifyBot(user_agent);
    if (!bot_name) return Response.json({ ok: false, reason: 'not a known bot' });

    // Best-effort geo from Cloudflare header (free, no API call needed)
    const ip_country = req.headers.get('cf-ipcountry') || '';

    await base44.asServiceRole.entities.BotVisit.create({
      bot_name,
      user_agent: user_agent.slice(0, 500), // cap length
      page: page || '/',
      referrer: referrer || '',
      ip_country,
    });

    return Response.json({ ok: true, bot_name });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
});