import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Clock, BarChart3, TrendingUp, Shield, Brain, Award, Lock, CheckCircle2 } from 'lucide-react';

const COURSES = [
  {
    id: 1,
    title: 'Technical Analysis Fundamentals',
    description: 'Master the basics of reading charts, understanding patterns, and making informed trading decisions.',
    icon: BarChart3,
    color: 'from-violet-500 to-fuchsia-500',
    lessons: 8,
    duration: '45 min',
    level: 'Beginner',
    free: true,
    topics: [
      { title: 'What is Technical Analysis?', duration: '5 min', completed: false },
      { title: 'Understanding Candlestick Charts', duration: '7 min', completed: false },
      { title: 'Support & Resistance Levels', duration: '6 min', completed: false },
      { title: 'Trend Lines & Channels', duration: '5 min', completed: false },
      { title: 'Volume Analysis Basics', duration: '5 min', completed: false },
      { title: 'Common Chart Patterns', duration: '7 min', completed: false },
      { title: 'Timeframe Selection', duration: '5 min', completed: false },
      { title: 'Building Your First Strategy', duration: '5 min', completed: false },
    ]
  },
  {
    id: 2,
    title: 'Key Trading Indicators',
    description: 'Deep dive into RSI, MACD, Bollinger Bands, and moving averages used by professionals.',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    lessons: 6,
    duration: '35 min',
    level: 'Intermediate',
    free: true,
    topics: [
      { title: 'RSI – Relative Strength Index', duration: '7 min', completed: false },
      { title: 'MACD – Moving Average Convergence', duration: '6 min', completed: false },
      { title: 'Bollinger Bands Deep Dive', duration: '6 min', completed: false },
      { title: 'SMA vs EMA Explained', duration: '5 min', completed: false },
      { title: 'Stochastic Oscillator', duration: '5 min', completed: false },
      { title: 'Combining Indicators', duration: '6 min', completed: false },
    ]
  },
  {
    id: 3,
    title: 'Risk Management Mastery',
    description: 'Learn how to protect your capital with proper position sizing, stop losses, and portfolio management.',
    icon: Shield,
    color: 'from-amber-500 to-orange-500',
    lessons: 5,
    duration: '30 min',
    level: 'All Levels',
    free: true,
    topics: [
      { title: 'Why Risk Management Matters', duration: '5 min', completed: false },
      { title: 'Position Sizing Strategies', duration: '7 min', completed: false },
      { title: 'Stop Loss Placement', duration: '6 min', completed: false },
      { title: 'Risk/Reward Ratios', duration: '6 min', completed: false },
      { title: 'Building a Trading Plan', duration: '6 min', completed: false },
    ]
  },
  {
    id: 4,
    title: 'Trading Psychology',
    description: 'Master your emotions and develop the mental discipline needed for consistent trading success.',
    icon: Brain,
    color: 'from-rose-500 to-pink-500',
    lessons: 5,
    duration: '28 min',
    level: 'All Levels',
    free: true,
    topics: [
      { title: 'Fear & Greed in Trading', duration: '6 min', completed: false },
      { title: 'Overcoming FOMO', duration: '5 min', completed: false },
      { title: 'Dealing with Losses', duration: '6 min', completed: false },
      { title: 'Developing Patience', duration: '5 min', completed: false },
      { title: 'Building a Winning Mindset', duration: '6 min', completed: false },
    ]
  },
];

const levelColors = {
  'Beginner': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'Intermediate': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'Advanced': 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  'All Levels': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
};

export default function Education() {
  const [expandedCourse, setExpandedCourse] = useState(null);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Learn Trading</h1>
        </div>
        <p className="text-sm text-white/30">Free courses to level up your trading skills</p>
      </motion.div>

      {/* Progress Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 flex items-center gap-4 border border-violet-500/10"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Start Your Learning Journey</h3>
          <p className="text-[11px] text-white/30 mt-0.5">Complete courses to earn XP and unlock advanced strategies</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-lg font-bold text-violet-400">0 XP</div>
          <div className="text-[10px] text-white/30">Earned</div>
        </div>
      </motion.div>

      {/* Courses */}
      <div className="space-y-4">
        {COURSES.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
              className="w-full p-5 flex items-center gap-4 text-left glass-hover transition-all"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center flex-shrink-0`}>
                <course.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{course.title}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${levelColors[course.level]}`}>
                    {course.level}
                  </span>
                </div>
                <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{course.description}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-white/20 flex items-center gap-1">
                    <BookOpen className="w-2.5 h-2.5" />
                    {course.lessons} lessons
                  </span>
                  <span className="text-[10px] text-white/20 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {course.duration}
                  </span>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-white/20 transition-transform ${expandedCourse === course.id ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {expandedCourse === course.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-1">
                    {course.topics.map((topic, ti) => (
                      <div
                        key={ti}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-all cursor-pointer group"
                      >
                        <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-violet-500/30">
                          <span className="text-[10px] text-white/30 group-hover:text-violet-400">{ti + 1}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{topic.title}</span>
                        </div>
                        <span className="text-[10px] text-white/20">{topic.duration}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Mobile App CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6 text-center border border-violet-500/10"
      >
        <BookOpen className="w-8 h-8 text-violet-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Learn on the Go</h3>
        <p className="text-xs text-white/30 mb-4 max-w-md mx-auto">
          Access all lessons plus AI-powered practice exercises on our mobile app.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="https://apps.apple.com/us/app/technical-analysis-ai/id6746874804"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            iOS App
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.ioa.TipSync"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl glass border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-all"
          >
            Android
          </a>
        </div>
      </motion.div>
    </div>
  );
}