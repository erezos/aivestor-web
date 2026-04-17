/**
 * getAskAiHistory — v2. Paginated AI analysis history for authenticated user.
 * Returns full v2 report shape including sections for Flutter to reopen reports.
 * 60-day retention enforced by nightly cleanup automation.
 * Cursor = offset index (opaque string).
 *
 * Request: { limit?, cursor?, requestId? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Mobile JWT verification ───────────────────────────────────────────────────
const MOBILE_JWT_SECRET = Deno.env.get('MOBILE_JWT_SECRET') || '';

async function verifyMobileJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(MOBILE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.sub, isMobile: true };
  } catch (_) { return null; }
}

async function resolveUser(req, base44) {
  try { const u = await base44.auth.me(); if (u) return u; } catch (_) {}
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) return await verifyMobileJwt(token);
  return null;
}

const DISCLAIMER = 'This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Always do your own research.';

const SECTION_DEFS = [
  { id: 'market_snapshot',      title: 'Market Snapshot'        },
  { id: 'ai_conclusion',        title: 'AI Conclusion'          },
  { id: 'technical_view',       title: 'Technical View'         },
  { id: 'sentiment_news_pulse', title: 'Sentiment & News Pulse' },
  { id: 'scenario_paths',       title: 'Scenario Paths'         },
  { id: 'risks_invalidations',  title: 'Risks & Invalidations'  },
  { id: 'action_playbook',      title: 'Action Playbook'        },
  { id: 'disclaimer',           title: 'Disclaimer'             },
];

function buildFallbackSections(asset) {
  return SECTION_DEFS.map(def => ({
    id: def.id,
    title: def.title,
    content: def.id === 'disclaimer' ? DISCLAIMER : `See summary for ${asset}.`,
    bullets: [],
  }));
}

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'db' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveUser(req, base44);
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body   = await req.json().catch(() => ({}));
    const limit  = Math.min(parseInt(body.limit) || 20, 50);
    const cursor = parseInt(body.cursor) || 0;
    const reqId  = body.requestId || crypto.randomUUID();

    // Fetch all for user, sorted newest first
    const all = await base44.asServiceRole.entities.AskAiHistory.filter({ user_id: user.id }, '-created_date', 200);

    const page       = all.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < all.length ? String(cursor + limit) : null;

    const items = page.map(h => {
      // Hydrate full v2 report if stored, else reconstruct minimal shape
      let report;
      if (h.report_json) {
        try { report = JSON.parse(h.report_json); } catch (_) { report = null; }
      }

      if (!report) {
        report = {
          reportVersion: 'v2',
          generatedAt: h.created_date,
          assetMeta: { symbol: h.asset, timeframe: h.timeframe || 'swing', locale: 'en', market: 'live' },
          sections: buildFallbackSections(h.asset),
          asset: h.asset,
          summary: h.summary || '',
          stance: h.stance || 'neutral',
          confidence: h.confidence || 0,
          thesis: h.thesis_json ? (() => { try { return JSON.parse(h.thesis_json); } catch (_) { return []; } })() : [],
          riskFactors: h.risk_factors_json ? (() => { try { return JSON.parse(h.risk_factors_json); } catch (_) { return []; } })() : [],
          disclaimer: DISCLAIMER,
        };
      }

      return {
        id: h.id,
        requestId: h.request_id,
        asset: h.asset,
        depth: h.depth || h.mode || 'standard',
        timeframe: h.timeframe || 'swing',
        summary: h.summary,
        stance: h.stance,
        confidence: h.confidence,
        createdAt: h.created_date,
        modelUsed: h.model_used || null,
        fallbackUsed: h.fallback_used || false,
        latencyMs: h.latency_ms || null,
        report,
      };
    });

    return ok({ items, nextCursor, total: all.length }, reqId);
  } catch (e) {
    return err('ASK_AI_ERROR', e.message, true, 500);
  }
});