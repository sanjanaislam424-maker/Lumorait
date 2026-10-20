import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from '@/lib/AppContext';
import { ToastProvider } from '@/components/Toast';
import { AuthScreen } from '@/components/AuthScreen';
import { AppShell, View } from '@/components/AppShell';
import { Dashboard } from '@/views/Dashboard';
import { Tasks } from '@/views/Tasks';
import { Wallet } from '@/views/Wallet';
import { Spin } from '@/views/Spin';
import { Leaderboard } from '@/views/Leaderboard';
import { ProfileView } from '@/views/Profile';
import { Admin } from '@/views/Admin';

function Main() {
  const { session, profile, loading } = useApp();
  const [view, setView] = useState<View>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--neon-bg)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'var(--neon-primary)', borderTopColor: 'transparent', boxShadow: '0 0 15px var(--neon-glow)' }}
        />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  if (profile.banned && view !== 'profile') {
    setView('profile');
  }

  return (
    <AppShell view={view} setView={setView}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'dashboard' && <Dashboard setView={setView} />}
          {view === 'tasks' && <Tasks />}
          {view === 'wallet' && <Wallet />}
          {view === 'spin' && <Spin />}
          {view === 'leaderboard' && <Leaderboard />}
          {view === 'profile' && <ProfileView />}
          {view === 'admin' && <Admin />}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Main />
      </ToastProvider>
    </AppProvider>
  );
}
