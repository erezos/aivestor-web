/**
 * useSessionTracker — Silent background analytics.
 * Call once at app root. Collects device/geo/session data and ships to DB.
 * Completely non-blocking and fire-and-forget.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return {
    device_type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    os,
    browser,
    language: navigator.language || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    screen_width: window.screen.width,
    screen_height: window.screen.height,
  };
}

function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get('utm_source') || '',
    utm_medium: p.get('utm_medium') || '',
    utm_campaign: p.get('utm_campaign') || '',
  };
}

async function getGeoInfo() {
  try {
    const res = await fetch('https://ipapi.co/json/?fields=country_code,country_name,city,region,org');
    if (!res.ok) return {};
    const d = await res.json();
    return {
      country_code: d.country_code || '',
      country_name: d.country_name || '',
      city: d.city || '',
      region: d.region || '',
      isp: d.org || '',
    };
  } catch {
    return {};
  }
}

function getWatchlistInfo() {
  try {
    const raw = localStorage.getItem('aivestor_watchlist');
    const list = raw ? JSON.parse(raw) : [];
    return {
      watchlist_size: list.length,
      watchlist_symbols: list.map(i => i.symbol),
    };
  } catch {
    return { watchlist_size: 0, watchlist_symbols: [] };
  }
}

function getVisitedPages() {
  try {
    const raw = sessionStorage.getItem('aivestor_pages');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function trackPageView(page) {
  try {
    const existing = getVisitedPages();
    if (!existing.includes(page)) {
      sessionStorage.setItem('aivestor_pages', JSON.stringify([...existing, page]));
    }
  } catch {}
}

export function useSessionTracker() {
  const sessionStartRef = useRef(Date.now());

  useEffect(() => {
    const sessionStart = sessionStartRef.current;

    async function track(sessionDuration = 0) {
      try {
        const user = await base44.auth.me();
        if (!user) return; // anonymous — skip

        const [geo, device] = await Promise.all([getGeoInfo(), Promise.resolve(getDeviceInfo())]);
        const { watchlist_size, watchlist_symbols } = getWatchlistInfo();
        const pages_visited = getVisitedPages();
        const utmParams = getUtmParams();

        base44.functions.invoke('trackUserSession', {
          device,
          geo,
          session_duration_seconds: sessionDuration,
          watchlist_size,
          watchlist_symbols,
          pages_visited,
          referrer: document.referrer || '',
          ...utmParams,
        }).catch(() => {});
      } catch {}
    }

    // Fire on session start (duration = 0 for now)
    track(0);

    // Fire on tab close / navigation away with real session duration
    const handleUnload = () => {
      const duration = Math.round((Date.now() - sessionStart) / 1000);
      track(duration);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);
}