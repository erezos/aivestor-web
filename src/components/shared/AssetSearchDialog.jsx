import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_BADGE = {
  stock:  { label: 'Stock',  cls: 'bg-blue-500/10 text-blue-400' },
  crypto: { label: 'Crypto', cls: 'bg-amber-500/10 text-amber-400' },
  etf:    { label: 'ETF',    cls: 'bg-violet-500/10 text-violet-400' },
};

export default function AssetSearchDialog({ open, onClose, onSelect, existingSymbols = [], title = 'Search Assets' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setLoading(true);
      // Load popular defaults immediately
      base44.functions.invoke('searchAssets', { query: '' })
        .then(res => setResults(res.data?.results || []))
        .finally(() => setLoading(false));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('searchAssets', { query });
        setResults(res.data?.results || []);
      } catch {}
      setLoading(false);
    }, query ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const filtered = results.filter(r => !existingSymbols.includes(r.symbol));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#12121a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              ref={inputRef}
              placeholder="Search stocks, crypto, ETFs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 animate-spin" />
            )}
          </div>

          {!query && (
            <p className="text-[10px] text-white/20 text-center">
              Popular assets · type to search US &amp; EU stocks, crypto &amp; ETFs
            </p>
          )}

          {/* Results list */}
          <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
            {filtered.map(asset => {
              const badge = TYPE_BADGE[asset.asset_type] || TYPE_BADGE.stock;
              return (
                <button
                  key={asset.symbol}
                  onClick={() => { onSelect(asset); onClose(); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-300">{asset.symbol.slice(0, 2)}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold group-hover:text-violet-300 transition-colors">{asset.symbol}</div>
                      <div className="text-[11px] text-white/30 truncate max-w-[220px]">{asset.name}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </button>
              );
            })}

            {!loading && filtered.length === 0 && query && (
              <div className="text-center py-8">
                <p className="text-sm text-white/25">No results for &quot;{query}&quot;</p>
                <p className="text-[11px] text-white/15 mt-1">Try a different ticker or name</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}