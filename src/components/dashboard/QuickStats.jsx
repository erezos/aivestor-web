import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock, Zap, Target } from 'lucide-react';

const stats = [
  { label: 'AI Signals Today', value: '24', icon: Zap, color: 'from-violet-500 to-fuchsia-500' },
  { label: 'Markets Open', value: '3/4', icon: Clock, color: 'from-emerald-500 to-teal-500' },
  { label: 'Accuracy 30D', value: '78%', icon: Target, color: 'from-amber-500 to-orange-500' },
  { label: 'Active Alerts', value: '12', icon: BarChart3, color: 'from-rose-500 to-pink-500' },
];

export default function QuickStats() {
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