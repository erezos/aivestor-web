import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Check } from 'lucide-react';

const POPULAR = [
  { symbol: 'AAPL', name: 'Apple Inc', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com', type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', type: 'stock' },
  { symbol: 'AMD', name: 'AMD Inc', type: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
  { symbol: 'XRP', name: 'Ripple', type: 'crypto' },
];

export default function AddAssetDialog({ open, onClose, existingSymbols }) {
  const [step, setStep] = useState('pick'); // 'pick' | 'details'
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Portfolio.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setStep('pick'); setSelected(null); setSearch(''); setQty(''); setBuyPrice('');
    onClose();
  };

  const handlePick = (asset) => {
    setSelected(asset);
    setStep('details');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addMutation.mutate({
      symbol: selected.symbol,
      name: selected.name,
      asset_type: selected.type,
      quantity: parseFloat(qty),
      buy_price: parseFloat(buyPrice),
    });
  };

  const filtered = POPULAR.filter(s =>
    !existingSymbols.includes(s.symbol) &&
    (s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#12121a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'pick' ? 'Add Position' : `Add ${selected?.symbol}`}</DialogTitle>
        </DialogHeader>

        {step === 'pick' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                placeholder="Search symbol or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filtered.map(s => (
                <button key={s.symbol} onClick={() => handlePick(s)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-violet-300">{s.symbol.slice(0,2)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{s.symbol}</div>
                      <div className="text-[11px] text-white/30">{s.name}</div>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-white/20" />
                </button>
              ))}
              {filtered.length === 0 && <p className="text-center text-sm text-white/25 py-8">No symbols found</p>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 p-3 glass rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-300">{selected?.symbol.slice(0,2)}</span>
              </div>
              <div>
                <div className="text-sm font-bold">{selected?.symbol}</div>
                <div className="text-[11px] text-white/30">{selected?.name}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Quantity / Units</label>
                <input
                  type="number" step="any" required value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Average Buy Price (USD)</label>
                <input
                  type="number" step="any" required value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
                  placeholder="e.g. 150.00"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('pick')}
                className="flex-1 py-2.5 rounded-xl glass text-white/50 text-sm font-medium hover:text-white/70 transition-all"
              >Back</button>
              <button type="submit" disabled={addMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {addMutation.isPending ? 'Adding…' : <><Check className="w-4 h-4" /> Add Position</>}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}