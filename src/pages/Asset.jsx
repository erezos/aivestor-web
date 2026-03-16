import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Star, Share2, Zap, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAssetData } from '../components/marketData';
import TechnicalChart from '../components/asset/TechnicalChart';



function getSignalColor(signal) {
  if (signal === 'Strong Buy' || signal === 'Buy') return 'text-emerald-400';
  if (signal === 'Neutral' || signal === 'Hold') return 'text-amber-400';
  if (signal === 'Caution') return 'text-orange-400';
  return 'text-rose-400';
}

function Skeleton({ className }) {
  return <div className={`bg-white/5 rounded animate-pulse ${className}`} />;
}

export default function Asset() {
  const urlParams = new URLSearchParams(window.location.search);
  const symbol = urlParams.get('symbol') || 'AAPL';
  const [timeRange, setTimeRange] = useState('1M');
  const queryClient = useQueryClient();

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', symbol],
    queryFn: () => fetchAssetData(symbol),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Watchlist state
  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date'),
  });
  const watchlistItem = watchlist.find(w => w.symbol === symbol);
  const isWatched = !!watchlistItem;

  const addToWatchlist = useMutation({
    mutationFn: () => base44.entities.Watchlist.create({ symbol, name: asset?.name || symbol, asset_type: symbol.includes('-') || ['BTC','ETH','SOL','XRP'].includes(symbol) ? 'crypto' : 'stock' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
  const removeFromWatchlist = useMutation({
    mutationFn: () => base44.entities.Watchlist.delete(watchlistItem.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const toggleWatchlist = () => {
    if (isWatched) removeFromWatchlist.mutate();
    else addToWatchlist.mutate();
  };

  const positive = asset ? asset.change >= 0 : true;
  const chartData = useMemo(() => generateChartData(timeRange, positive), [timeRange, positive]);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/Dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center">
              <span className="text-sm font-bold text-violet-300">{symbol.slice(0,2)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{symbol}</h1>
              {isLoading ? <Skeleton className="h-4 w-40 mt-1" /> : <p className="text-sm text-white/30">{asset?.name} • {asset?.sector}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {/* Star / Watchlist button */}
            <button
              onClick={toggleWatchlist}
              className={`p-2 rounded-lg glass transition-all ${isWatched ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20' : 'text-white/40 glass-hover'}`}
              title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400' : ''}`} />
            </button>
            <button className="p-2 rounded-lg glass glass-hover" title="Share">
              <Share2 className="w-4 h-4 text-white/40" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-5 w-24" />
            </div>
          ) : (
            <>
              <span className="text-4xl font-bold text-white">${asset?.price?.toLocaleString()}</span>
              <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${positive ? 'text-gain' : 'text-loss'}`}>
                {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {positive ? '+' : ''}{asset?.change?.toFixed(2)}%
              </div>
            </>
          )}
        </div>

        {/* Watchlist toast hint */}
        {isWatched && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-medium"
          >
            <Star className="w-3 h-3 fill-amber-400" /> Saved to Watchlist
          </motion.div>
        )}
      </motion.div>

      {/* Chart */}
      <div className="glass rounded-2xl p-5">
        <div className="flex gap-2 mb-4">
          {TIME_RANGES.map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeRange === r ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-white/30 hover:text-white/50'
              }`}
            >{r}</button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? '#10B981' : '#F43F5E'} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={positive ? '#10B981' : '#F43F5E'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="x" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                formatter={(val) => [`$${val.toFixed(2)}`, 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke={positive ? '#10B981' : '#F43F5E'} strokeWidth={2} fill="url(#chartGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Analysis */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white/80">AI Analysis</h3>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex gap-3"><Skeleton className="h-12 w-20 rounded-xl" /><Skeleton className="h-12 w-20 rounded-xl" /></div>
              <Skeleton className="h-16 w-full rounded-xl" />
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-7 w-full rounded" />)}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="glass rounded-xl px-4 py-2 text-center">
                  <div className={`text-lg font-bold ${getSignalColor(asset?.aiSignal)}`}>{asset?.aiSignal}</div>
                  <div className="text-[10px] text-white/30">Signal</div>
                </div>
                <div className="glass rounded-xl px-4 py-2 text-center">
                  <div className="text-lg font-bold text-violet-400">{asset?.aiConfidence}%</div>
                  <div className="text-[10px] text-white/30">Confidence</div>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-4">{asset?.aiSummary}</p>
              <div className="space-y-2">
                {(asset?.indicators || []).map(ind => (
                  <div key={ind.name} className="flex items-center justify-between py-1.5 border-b border-white/3">
                    <span className="text-xs text-white/40">{ind.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 font-medium">{ind.value}</span>
                      <span className={`text-[10px] font-semibold ${getSignalColor(ind.signal)}`}>{ind.signal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Key Stats */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white/80">Key Statistics</h3>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Market Cap', value: asset?.marketCap },
                { label: 'P/E Ratio', value: asset?.pe },
                { label: 'Volume', value: asset?.volume },
                { label: '52W High', value: asset?.high52 ? `$${Number(asset.high52).toLocaleString()}` : '—' },
                { label: '52W Low', value: asset?.low52 ? `$${Number(asset.low52).toLocaleString()}` : '—' },
                { label: 'Sector', value: asset?.sector },
              ].map(stat => (
                <div key={stat.label} className="glass rounded-xl p-3">
                  <div className="text-[10px] text-white/30 mb-1">{stat.label}</div>
                  <div className="text-sm font-semibold text-white">{stat.value || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-5 text-center border border-violet-500/10"
      >
        <p className="text-xs text-white/30 mb-3">Want to trade {symbol}?</p>
        <a href="https://www.zulutrade.com" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Trade on ZuluTrade <TrendingUp className="w-4 h-4" />
        </a>
      </motion.div>
    </div>
  );
}