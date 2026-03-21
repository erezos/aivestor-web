import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check } from 'lucide-react';

export default function AddAssetDialog({ open, onClose, asset, onAdd }) {
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');

  useEffect(() => {
    if (open) { setQty(''); setBuyPrice(''); }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ ...asset, quantity: parseFloat(qty), buy_price: parseFloat(buyPrice) });
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#12121a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add {asset.symbol}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-violet-300">{asset.symbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="text-sm font-bold">{asset.symbol}</div>
              <div className="text-[11px] text-white/30">{asset.name}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Quantity / Units</label>
              <input
                type="number" step="any" required value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="e.g. 10"
                autoFocus
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Average Buy Price (USD)</label>
              <input
                type="number" step="any" required value={buyPrice}
                onChange={e => setBuyPrice(e.target.value)}
                placeholder="e.g. 150.00"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:text-white/70 hover:bg-white/8 transition-all"
            >
              Back
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" /> Add Position
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}