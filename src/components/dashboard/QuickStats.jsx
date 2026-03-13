import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock, Zap, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotBoard } from '../marketData';

function getMarketsOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const timeNum = hour * 100 + minute;

  // US market: Mon-Fri 13:30-20:00 UTC
  const usOpen = day >= 1 && day <= 5 && timeNum >= 1330 && timeNum < 2000;
  // EU market: Mon-Fri 07:00-15:30 UTC
  const euOpen = day >= 1 && day <= 5 && timeNum >= 700 && timeNum < 1530;
  // Asia market: Mon-Fri 00:00-06:00 UTC
  const asiaOpen = day >= 1 && day <= 5 && (timeNum >= 0 && timeNum < 600);
  // Crypto: always open
  const count = [usOpen, euOpen, asiaOpen].filter(Boolean).length + 1;
  return `${count}/4`;
}

export default function QuickStats() {
  const { data: hotBoard, isLoading } = useQuery({
    queryKey: ['hotBoard'],
    queryFn: fetchHotBoard,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const signalsToday = hotBoard ? hotBoard.filter(t => t.signal === 'Strong Buy' || t.signal === 'Buy' || t.signal === 'Sell' || t.signal === 'Strong Sell').length : null;
  const strongBuys = hotBoard ? hotBoard.filter(t => t.signal === 'Strong Buy').length : null;

  const stats = [
    { label: 'AI Signals Today', value: isLoading ? '…' : String(signalsToday ?? '—'), icon: Zap, color: 'from-violet-500 to-fuchsia-500' },
    { label: 'Markets Open', value: getMarketsOpen(), icon: Clock, color: 'from-emerald-500 to-teal-500' },
    { label: 'Strong Buys', value: isLoading ? '…' : String(strongBuys ?? '—'), icon: Target, color: 'from-amber-500 to-orange-500' },
    { label: 'Assets Tracked', value: isLoading ? '…' : String(hotBoard?.length ?? '—'), icon: BarChart3, color: 'from-rose-500 to-pink-500' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="glass rounded-2xl p-4 relative overflow-hidden group cursor-pointer glass-hover transition-all"
        >
          <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-5 rounded-full -translate-y-6 translate-x-6 group-hover:opacity-10 transition-opacity`} />
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
            <stat.icon className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{stat.value}</div>
          <div className="text-[11px] text-white/40 font-medium mt-0.5">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}