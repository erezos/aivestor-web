/**
 * nightlyCleanup — Phase 7. Scheduled nightly automation.
 * - Purges AskAiHistory older than 60 days
 * - Purges expired CachedData (older than 7 days, safety net)
 * Admin only (called by scheduled automation, no user context).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const HISTORY_RETENTION_DAYS = 60;
const CACHE_SAFETY_PURGE_DAYS = 7;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now        = Date.now();
    const historyTTL = HISTORY_RETENTION_DAYS * 86400000;
    const cacheTTL   = CACHE_SAFETY_PURGE_DAYS * 86400000;
    const results    = { historyDeleted: 0, cacheDeleted: 0, errors: 0 };

    // ── Purge old AskAiHistory ─────────────────────────────────────────────────
    try {
      const allHistory = await base44.asServiceRole.entities.AskAiHistory.list('-created_date', 500);
      const toDelete   = allHistory.filter(h => now - new Date(h.created_date).getTime() > historyTTL);
      for (const h of toDelete) {
        try {
          await base44.asServiceRole.entities.AskAiHistory.delete(h.id);
          results.historyDeleted++;
        } catch (_) { results.errors++; }
      }
    } catch (_) { results.errors++; }

    // ── Purge stale CachedData (safety net — removes abandoned entries) ─────────
    // Only purge quote_ and news_ keys older than the safety threshold
    // Never purge asset_profile_ (7-day TTL managed by refreshAssetProfiles)
    try {
      const allCache = await base44.asServiceRole.entities.CachedData.list('-updated_date', 500);
      const purgeable = allCache.filter(c => {
        if (!c.refreshed_at) return false;
        const age = now - new Date(c.refreshed_at).getTime();
        const key = c.cache_key || '';
        // Only auto-purge short-lived keys that are very stale
        return age > cacheTTL && (key.startsWith('quote_') || key.startsWith('news_') || key.startsWith('overview_'));
      });
      for (const c of purgeable) {
        try {
          await base44.asServiceRole.entities.CachedData.delete(c.id);
          results.cacheDeleted++;
        } catch (_) { results.errors++; }
      }
    } catch (_) { results.errors++; }

    return Response.json({ success: true, ...results, ranAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});