import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ListChecks, Wallet, Gift, Trophy, User as UserIcon,
  Shield, LogOut, Languages, Bell, RefreshCw, Palette, Menu, X,
  ArrowLeftRight, Sparkles, Crown, Bot, Settings as SettingsIcon,
} from 'lucide-react';
import { useApp, Theme } from '@/lib/AppContext';
import { Modal, Button, NeonParticles } from './ui';
import { supabase } from '@/lib/supabase';

export type View =
  | 'dashboard' | 'tasks' | 'wallet' | 'spin' | 'leaderboard'
  | 'profile' | 'admin' | 'buyconvert' | 'membership' | 'refer';

export function AppShell({ view, setView, children }: { view: View; setView: (v: View) => void; children: ReactNode }) {
  const { t, profile, lang, theme, themeConfig, setLang, setTheme, signOut } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string }[]>([]);
  const [themeOpen, setThemeOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: { key: View; icon: ReactNode; label: string }[] = [
    { key: 'dashboard', icon: <LayoutDashboard size={20} />, label: t('navDashboard') },
    { key: 'wallet', icon: <Wallet size={20} />, label: t('navWallet') },
    { key: 'buyconvert', icon: <ArrowLeftRight size={20} />, label: t('navBuyConvert') },
    { key: 'tasks', icon: <ListChecks size={20} />, label: t('navTasks') },
    { key: 'spin', icon: <Gift size={20} />, label: t('navMysteryBox') },
    { key: 'refer', icon: <Sparkles size={20} />, label: t('navReferEarn') },
    { key: 'profile', icon: <Shield size={20} />, label: t('navKyc') },
    { key: 'membership', icon: <Crown size={20} />, label: t('navMembership') },
    { key: 'leaderboard', icon: <Trophy size={20} />, label: t('leaderboard') },
    { key: 'profile', icon: <UserIcon size={20} />, label: t('navSettings') },
  ];

  // De-duplicate by label so Settings and KYC don't both show the same route label
  const drawerItems: { key: View; icon: ReactNode; label: string }[] = [
    { key: 'dashboard', icon: <LayoutDashboard size={20} />, label: t('navDashboard') },
    { key: 'wallet', icon: <Wallet size={20} />, label: t('navWallet') },
    { key: 'buyconvert', icon: <ArrowLeftRight size={20} />, label: t('navBuyConvert') },
    { key: 'tasks', icon: <ListChecks size={20} />, label: t('navTasks') },
    { key: 'spin', icon: <Gift size={20} />, label: t('navMysteryBox') },
    { key: 'refer', icon: <Sparkles size={20} />, label: t('navReferEarn') },
    { key: 'profile', icon: <Shield size={20} />, label: t('navKyc') },
    { key: 'membership', icon: <Crown size={20} />, label: t('navMembership') },
    { key: 'leaderboard', icon: <Trophy size={20} />, label: t('leaderboard') },
    { key: 'profile', icon: <SettingsIcon size={20} />, label: t('navSettings') },
  ];

  if (profile?.role === 'admin') {
    drawerItems.push({ key: 'admin', icon: <Shield size={20} />, label: t('adminPanel') });
  }

  const openNotifs = async () => {
    const { data } = await supabase.from('notifications').select('id,title,body').or('is_broadcast.eq.true').order('created_at', { ascending: false }).limit(10);
    setNotifs(data || []);
    setNotifOpen(true);
  };

  const quickReload = () => window.location.reload();

  const themeOptions: { id: Theme; label: string; colors: string[] }[] = [
    { id: 'cyber', label: lang === 'bn' ? 'সাইবারপাঙ্ক' : 'Cyberpunk', colors: ['#22d3ee', '#3b82f6', '#06b6d4'] },
    { id: 'matrix', label: lang === 'bn' ? 'ম্যাট্রিক্স' : 'Matrix', colors: ['#22c55e', '#16a34a', '#4ade80'] },
    { id: 'solar', label: lang === 'bn' ? 'সোলার ফ্লেয়ার' : 'Solar Flare', colors: ['#fbbf24', '#f59e0b', '#fb923c'] },
  ];

  const handleNav = (v: View) => {
    setView(v);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen relative" style={{ background: themeConfig.bgGradient, color: themeConfig.text }}>
      <NeonParticles />

      {/* Top bar */}
      <header className="sticky top-0 z-50 neon-card rounded-none border-x-0 border-t-0 backdrop-blur-xl" style={{ borderBottom: `1px solid ${themeConfig.border}` }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 3-line hamburger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition relative"
              style={{ color: themeConfig.primary }}
              title={t('navDashboard')}
            >
              <Menu size={22} />
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${themeConfig.primary}, ${themeConfig.secondary})`, boxShadow: `0 0 12px ${themeConfig.glow}` }}>
              L
            </div>
            <span className="font-bold neon-glow-text hidden sm:block" style={{ color: themeConfig.text }}>Lumora IT</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={quickReload} className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: themeConfig.muted }} title={t('quickReload')}><RefreshCw size={18} /></button>
            <button onClick={openNotifs} className="p-2 rounded-lg hover:bg-white/10 transition relative" style={{ color: themeConfig.muted }}><Bell size={18} /></button>
            <button onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: themeConfig.muted }}><Languages size={18} /></button>
            <button onClick={() => setThemeOpen(true)} className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: themeConfig.muted }} title={t('themeSwitch')}>
              <Palette size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Glassmorphic drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="fixed top-0 left-0 bottom-0 z-[61] w-72 overflow-y-auto"
              style={{
                background: 'rgba(10,14,28,0.85)',
                backdropFilter: 'blur(24px) saturate(140%)',
                WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                borderRight: `1px solid ${themeConfig.border}`,
                boxShadow: `4px 0 40px rgba(0,0,0,0.5)`,
              }}
            >
              <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${themeConfig.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
                    style={{ background: `linear-gradient(135deg, ${themeConfig.primary}, ${themeConfig.secondary})`, boxShadow: `0 0 14px ${themeConfig.glow}` }}>
                    L
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: themeConfig.text }}>Lumora IT</p>
                    <p className="text-[10px]" style={{ color: themeConfig.muted }}>{profile?.phone || profile?.full_name || ''}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition" style={{ color: themeConfig.muted }}>
                  <X size={20} />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {drawerItems.map((item, i) => {
                  const active = view === item.key && (
                    // For the two 'profile' entries, only highlight the one that matches the label being shown
                    (item.label !== t('navSettings') || view === 'profile')
                  );
                  return (
                    <button
                      key={`${item.key}-${i}`}
                      onClick={() => handleNav(item.key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition group"
                      style={{
                        background: active ? `linear-gradient(135deg, ${themeConfig.primary}22, ${themeConfig.secondary}11)` : 'transparent',
                        color: active ? themeConfig.primary : themeConfig.muted,
                        border: active ? `1px solid ${themeConfig.border}` : '1px solid transparent',
                      }}
                    >
                      <span style={{ color: active ? themeConfig.primary : themeConfig.muted, filter: active ? `drop-shadow(0 0 4px ${themeConfig.glow})` : 'none' }}>
                        {item.icon}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}

                {/* Logout */}
                <button
                  onClick={() => { setDrawerOpen(false); signOut(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition mt-2"
                  style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                >
                  <LogOut size={20} />
                  <span className="text-sm font-medium">{t('navLogout')}</span>
                </button>
              </nav>

              {/* AI Assistant entry at bottom */}
              <div className="p-3 mt-auto" style={{ borderTop: `1px solid ${themeConfig.border}` }}>
                <button
                  onClick={() => { setView('tasks'); setDrawerOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition"
                  style={{ background: `linear-gradient(135deg, ${themeConfig.primary}15, ${themeConfig.secondary}08)`, color: themeConfig.primary, border: `1px solid ${themeConfig.border}` }}
                >
                  <Bot size={20} />
                  <span className="text-sm font-medium">{t('navAIAssistant')}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 py-6 pb-24 relative z-10">
        {children}
      </div>

      {/* Bottom nav (compact) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 neon-card rounded-none border-x-0 border-b-0 backdrop-blur-xl" style={{ borderTop: `1px solid ${themeConfig.border}` }}>
        <div className="max-w-6xl mx-auto flex justify-around items-center h-16">
          {navItems.filter((_, i) => [0, 1, 3, 4, 6].includes(i)).map((item) => (
            <button
              key={item.label}
              onClick={() => setView(item.key)}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition"
              style={{ color: view === item.key ? themeConfig.primary : themeConfig.muted }}
            >
              {view === item.key && <motion.div layoutId="navdot" className="absolute -top-0.5 w-1 h-1 rounded-full" style={{ background: themeConfig.primary, boxShadow: `0 0 6px ${themeConfig.glow}` }} />}
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Theme picker modal */}
      <Modal open={themeOpen} onClose={() => setThemeOpen(false)} title={t('themeSwitch')}>
        <div className="space-y-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setTheme(opt.id); setThemeOpen(false); }}
              className="w-full flex items-center justify-between p-4 rounded-xl transition neon-btn-ghost"
              style={theme === opt.id ? { borderColor: themeConfig.primary, boxShadow: `0 0 15px ${themeConfig.glow}` } : {}}
            >
              <span className="font-medium neon-text">{opt.label}</span>
              <div className="flex gap-1.5">
                {opt.colors.map((c) => (
                  <div key={c} className="w-6 h-6 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Notifications modal */}
      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title={t('notifications')}>
        {notifs.length === 0 ? (
          <p className="neon-muted text-sm text-center py-6">{lang === 'bn' ? 'কোনো নোটিফিকেশন নেই' : 'No notifications'}</p>
        ) : (
          <div className="space-y-3">
            {notifs.map((n) => (
              <div key={n.id} className="rounded-xl p-3" style={{ background: themeConfig.cardBg, border: `1px solid ${themeConfig.border}` }}>
                <p className="font-medium text-sm neon-text">{n.title}</p>
                <p className="text-xs neon-muted mt-1">{n.body}</p>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" className="w-full mt-4" onClick={() => setNotifOpen(false)}>{t('close')}</Button>
      </Modal>

      <AnimatePresence />
    </div>
  );
}
