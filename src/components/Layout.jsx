import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, TrendingUp, Star, BookOpen, 
  Newspaper, Menu, X, Smartphone, ChevronRight,
  PieChart, CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b3e95402fa8b08d1ec8a16/d6018ef39_generated_image.png';

const navItems = [
  { path: '/Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/HotBoard', label: 'Hot Board', icon: TrendingUp },
  { path: '/Watchlist', label: 'Watchlist', icon: Star },
  { path: '/Portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/Earnings', label: 'Earnings', icon: CalendarDays },
  { path: '/News', label: 'Market News', icon: Newspaper },
  { path: '/Education', label: 'Learn', icon: BookOpen },
];

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <style>{`
        :root {
          --accent: #7C3AED;
          --accent-light: #A78BFA;
          --gain: #10B981;
          --loss: #F43F5E;
          --surface: rgba(255,255,255,0.03);
          --surface-hover: rgba(255,255,255,0.06);
          --border: rgba(255,255,255,0.06);
        }
        body { background: #0a0a0f; }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); }
        .glass-hover:hover { background: rgba(255,255,255,0.06); }
        .glow-accent { box-shadow: 0 0 20px rgba(124,58,237,0.15); }
        .glow-gain { box-shadow: 0 0 12px rgba(16,185,129,0.2); }
        .glow-loss { box-shadow: 0 0 12px rgba(244,63,94,0.2); }
        .text-gain { color: #10B981; }
        .text-loss { color: #F43F5E; }
        .bg-gain { background: #10B981; }
        .bg-loss { background: #F43F5E; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes brand-pulse {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(168,85,247,0.6)); }
          50% { filter: drop-shadow(0 0 14px rgba(217,70,239,0.9)); }
        }
        .logo-glow { animation: brand-pulse 3s ease-in-out infinite; }
        @keyframes xp-tick {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-[1440px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/Dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden logo-glow flex-shrink-0 ring-1 ring-violet-500/30">
              <img src={LOGO_URL} alt="AIVestor" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-lg tracking-tight leading-none">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">AI</span>
              <span className="text-white">Vestor</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'text-white' 
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-violet-500/10 border border-violet-500/20 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {/* Mobile App CTA */}
            <a
              href="https://apps.apple.com/us/app/technical-analysis-ai/id6746874804"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity ring-1 ring-fuchsia-500/30"
            >
              <Smartphone className="w-3 h-3" />
              TA.AI App
            </a>
            
            <button 
              className="md:hidden p-2 rounded-lg hover:bg-white/5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed inset-x-0 top-14 z-40 glass border-b border-white/5 p-4"
          >
            <nav className="flex flex-col gap-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-30" />
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 pt-4 border-t border-white/5">
              <a
                href="https://apps.apple.com/us/app/technical-analysis-ai/id6746874804"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold"
              >
                <Smartphone className="w-4 h-4" />
                Download Mobile App
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-white/5">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${
                  isActive ? 'text-violet-400' : 'text-white/30'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}