import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HotBoard from './pages/HotBoard';
import Watchlist from './pages/Watchlist';
import Asset from './pages/Asset';
import News from './pages/News';
import Education from './pages/Education';
import Earnings from './pages/Earnings';
import TestSuite from './pages/TestSuite';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
          <span className="text-sm text-white/30 font-medium">Loading AIVestor...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/Dashboard" replace />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/HotBoard" element={<HotBoard />} />
        <Route path="/Watchlist" element={<Watchlist />} />
        <Route path="/Asset" element={<Asset />} />
        <Route path="/News" element={<News />} />
        <Route path="/Education" element={<Education />} />
        <Route path="/Earnings" element={<Earnings />} />
        <Route path="/TestSuite" element={<TestSuite />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App