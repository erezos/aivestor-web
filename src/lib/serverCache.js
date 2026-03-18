/**
 * Client-side helper — reads pre-computed data from CachedData entity (DB).
 * Falls back to calling the refresh function if cache is empty.
 * All heavy AI + price work is done server-side by scheduled tasks.
 */
import { base44 } from '@/api/base44Client';

export async function getCachedData(key, refreshFn = null) {
  const rows = await base44.entities.CachedData.filter({ cache_key: key });
  if (rows.length > 0 && rows[0].data) {
    return JSON.parse(rows[0].data);
  }
  // First load ever — trigger a refresh on-demand then re-read
  if (refreshFn) {
    await base44.functions.invoke(refreshFn, {});
    const fresh = await base44.entities.CachedData.filter({ cache_key: key });
    if (fresh.length > 0) return JSON.parse(fresh[0].data);
  }
  return null;
}