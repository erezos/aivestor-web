import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Search, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import MiniChart from '../components/dashboard/MiniChart';

const DEMO_PRICES = {
  'AAPL': { price: '198.76', change: '+1.45%', positive: true },
  'NVDA': { price: '892.45', change: '+5.67%', positive: true },
  'TSLA': { price: '248.32', change: '+3.21%', positive: true },
  'MSFT': { price: '445.23', change: '+2.34%', positive: true },
  'BTC': { price: '97,432', change: '-2.14%', positive: false },
  'ETH': { price: '3,245.67', change: '-1.87%', positive: false },
  'AMZN': { price: '212.56', change: '+1.89%', positive: true },
  'META': { price: '567.89', change: '-0.89%', positive: false },
  'GOOGL': { price: '178.90', change: '+0.67%', positive: true },
  'SOL': { price: '187.34', change: '+4.23%', positive: true },
};

const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com', type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', type: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
];

export default function Watchlist() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date'),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Watchlist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Watchlist.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const filteredSymbols = POPULAR_SYMBOLS.filter(s =>
    !watchlist.some(w => w.symbol === s.symbol) &&
    (s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Watchlist</h1>
          </div>
          <p className="text-sm text-white/30">Track your favorite assets</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2">
              <Plus className="w-4 h-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#12121a] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Add to Watchlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  placeholder="Search symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredSymbols.map(s => (
                  <button
                    key={s.symbol}
                    onClick={() => addMutation.mutate({ symbol: s.symbol, name: s.name, asset_type: s.type })}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-violet-300">{s.symbol.slice(0,2)}</span>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">{s.symbol}</div>
                        <div className="text-[11px] text-white/30">{s.name}</div>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-white/30" />
                  </button>
                ))}
                {filteredSymbols.length === 0 && (
                  <p className="text-center text-white/30 text-sm py-6">No more symbols to add</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Watchlist Items */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
          <Star className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white/60 mb-1">No assets yet</h3>
          <p className="text-sm text-white/30 mb-4">Add stocks and crypto to track them here</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-violet-600 hover:bg-violet-700 rounded-xl gap-2">
            <Plus className="w-4 h-4" />
            Add Your First Asset
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {watchlist.map((item, i) => {
              const priceData = DEMO_PRICES[item.symbol] || { price: '0.00', change: '0.00%', positive: true };
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="glass rounded-2xl p-4 flex items-center gap-4 glass-hover transition-all group">
                    <Link to={`/Asset?symbol=${item.symbol}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-violet-300">{item.symbol.slice(0,2)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">{item.symbol}</div>
                        <div className="text-[11px] text-white/25">{item.name}</div>
                      </div>
                      <div className="hidden sm:block">
                        <MiniChart positive={priceData.positive} />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">${priceData.price}</div>
                        <div className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${priceData.positive ? 'text-gain' : 'text-loss'}`}>
                          {priceData.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {priceData.change}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}