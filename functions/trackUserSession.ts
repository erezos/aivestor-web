/**
 * trackUserSession — Background analytics tracker.
 * Called fire-and-forget on every session start + session end.
 * Never blocks UI. Upserts a single record per user.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false });

    const body = await req.json();
    const { 
      device, geo, session_duration_seconds, 
      watchlist_size, watchlist_symbols,
      pages_visited, referrer, utm_source, utm_medium, utm_campaign
    } = body;

    // Find existing record for this user
    const existing = await base44.entities.UserAnalytics.filter({ user_email: user.email });
    const now = new Date().toISOString();

    if (existing.length === 0) {
      // First ever session — create record
      await base44.entities.UserAnalytics.create({
        user_email: user.email,
        ...geo,
        ...device,
        session_count: 1,
        first_seen: now,
        last_seen: now,
        last_session_duration_seconds: session_duration_seconds || 0,
        total_time_spent_seconds: session_duration_seconds || 0,
        watchlist_size: watchlist_size || 0,
        watchlist_symbols: watchlist_symbols || [],
        pages_visited: pages_visited || [],
        referrer: referrer || '',
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
      });
    } else {
      const rec = existing[0];
      // Merge pages_visited — unique union
      const mergedPages = [...new Set([...(rec.pages_visited || []), ...(pages_visited || [])])];
      await base44.entities.UserAnalytics.update(rec.id, {
        ...geo,
        ...device,
        session_count: (rec.session_count || 0) + 1,
        last_seen: now,
        last_session_duration_seconds: session_duration_seconds || 0,
        total_time_spent_seconds: (rec.total_time_spent_seconds || 0) + (session_duration_seconds || 0),
        watchlist_size: watchlist_size || 0,
        watchlist_symbols: watchlist_symbols || [],
        pages_visited: mergedPages,
        referrer: referrer || rec.referrer || '',
        utm_source: utm_source || rec.utm_source || '',
        utm_medium: utm_medium || rec.utm_medium || '',
        utm_campaign: utm_campaign || rec.utm_campaign || '',
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
});