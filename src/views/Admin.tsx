import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, DollarSign, Gavel, Settings, Bell, BarChart3, Check, X, Ticket, FileWarning, Search, Lock, UserCog, ListChecks, Pause, Play, Trash2, Edit2, Plus, Upload, Image as ImageIcon, Video, Zap, Crown, Bot, Key, MessageSquare, Megaphone, Award, Send, Activity, FlaskConical, Sparkles, RefreshCw } from 'lucide-react';
import { UsageChart } from '@/components/UsageChart';
import { useApp } from '@/lib/AppContext';
import { supabase, Profile, TxRow } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { Logo } from '@/components/Logo';
import { uploadBrandingImage } from '@/lib/upload';
import { invalidateAiCopyCache } from '@/lib/microcopy';
import { invalidateDailyAiCache } from '@/lib/useDailyAiContent';

type AdminTab = 'overview' | 'users' | 'staff' | 'verifications' | 'finance' | 'disputes' | 'settings' | 'broadcast' | 'promo' | 'appeals' | 'tasks' | 'ai_keys' | 'ai_prompt' | 'ai_content' | 'support_chats' | 'ad_campaigns' | 'badges';

const PERM_KEYS = [
  'manage_deposits',
  'manage_withdrawals',
  'moderate_tasks',
  'verify_kyc',
  'manage_promo_codes',
  'balance_adjustments',
  'system_settings',
] as const;

type PermKey = typeof PERM_KEYS[number];

const TAB_PERMISSIONS: Record<AdminTab, PermKey | null> = {
  overview: null,
  users: 'balance_adjustments',
  staff: null,
  verifications: 'verify_kyc',
  finance: 'manage_deposits',
  disputes: 'moderate_tasks',
  settings: 'system_settings',
  broadcast: null,
  promo: 'manage_promo_codes',
  appeals: 'verify_kyc',
  tasks: 'moderate_tasks',
  ai_keys: 'system_settings',
  ai_prompt: 'system_settings',
  support_chats: null,
  ad_campaigns: 'moderate_tasks',
  badges: 'system_settings',
  ai_content: 'system_settings',
};

function hasPermission(profile: Profile | null, perm: PermKey | null): boolean {
  if (!profile) return false;
  // DEV: Allow all logged-in users to see all admin tabs. Restore role check before going live.
  if (profile.role !== 'admin') return true;
  if (profile.is_super_admin) return true;
  if (perm === null) return true;
  return profile.admin_permissions?.[perm] === true;
}

export function Admin() {
  const { t, profile } = useApp();
  const [tab, setTab] = useState<AdminTab>('overview');

  // DEV: Bypass role check so any logged-in user can access admin panel for testing. Remove before going live.
  const isDevAdmin = true;
  if (!isDevAdmin && profile?.role !== 'admin') {
    return <div className="text-center py-20 text-slate-400">{t('adminOnly')}</div>;
  }

  const tabs: { key: AdminTab; icon: React.ReactNode; label: string }[] = [
    { key: 'overview', icon: <BarChart3 size={16} />, label: 'Overview' },
    { key: 'users', icon: <Users size={16} />, label: t('users') },
    { key: 'staff', icon: <UserCog size={16} />, label: t('staffManagement') },
    { key: 'verifications', icon: <ShieldCheck size={16} />, label: t('verifications') },
    { key: 'finance', icon: <DollarSign size={16} />, label: t('finance') },
    { key: 'disputes', icon: <Gavel size={16} />, label: t('disputes') },
    { key: 'settings', icon: <Settings size={16} />, label: t('settings') },
    { key: 'broadcast', icon: <Bell size={16} />, label: t('broadcast') },
    { key: 'promo', icon: <Ticket size={16} />, label: t('promoManager') },
    { key: 'appeals', icon: <FileWarning size={16} />, label: t('kycAppeals') },
    { key: 'tasks', icon: <ListChecks size={16} />, label: t('taskManagement') },
    { key: 'ai_keys', icon: <Key size={16} />, label: 'API Keys' },
    { key: 'ai_prompt', icon: <Bot size={16} />, label: 'AI Prompt' },
    { key: 'support_chats', icon: <MessageSquare size={16} />, label: 'Support' },
    { key: 'badges', icon: <Award size={16} />, label: 'Badges' },
    { key: 'ad_campaigns', icon: <Megaphone size={16} />, label: 'Ads' },
    { key: 'ai_content', icon: <Sparkles size={16} />, label: 'AI Content' },
  ];

  const visibleTabs = tabs.filter((tb) => hasPermission(profile, TAB_PERMISSIONS[tb.key]));

  const activeTab = visibleTabs.some((tb) => tb.key === tab) ? tab : 'overview';

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ShieldCheck className="text-amber-400" size={24} /> {t('adminPanel')}
        <Logo size={28} rounded="rounded-lg" />
        {profile?.is_super_admin && (
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Lock size={10} /> {t('superAdmin')}
          </span>
        )}
      </h2>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {visibleTabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${activeTab === tb.key ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <Overview />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'staff' && <StaffTab />}
      {activeTab === 'verifications' && <VerificationsTab />}
      {activeTab === 'finance' && <FinanceTab />}
      {activeTab === 'disputes' && <DisputesTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'broadcast' && <BroadcastTab />}
      {activeTab === 'promo' && <PromoCodesTab />}
      {activeTab === 'appeals' && <AppealsTab />}
      {activeTab === 'tasks' && <TaskManagementTab />}
      {activeTab === 'ai_keys' && <AiKeysTab />}
      {activeTab === 'ai_prompt' && <AiPromptTab />}
      {activeTab === 'support_chats' && <SupportChatsTab />}
      {activeTab === 'ad_campaigns' && <AdCampaignsTab />}
      {activeTab === 'badges' && <BadgesTab />}
      {activeTab === 'ai_content' && <AiContentTab />}
    </div>
  );
}

function Overview() {
  const { t } = useApp();
  const [stats, setStats] = useState({ users: 0, verifs: 0, deposits: 0, withdrawals: 0, tasks: 0 });

  useEffect(() => {
    (async () => {
      const [u, v, d, w, tk] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('id_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'pending'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'withdrawal').eq('status', 'pending'),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setStats({ users: u.count || 0, verifs: v.count || 0, deposits: d.count || 0, withdrawals: w.count || 0, tasks: tk.count || 0 });
    })();
  }, []);

  const cards = [
    { label: t('totalUsers'), value: stats.users, color: 'from-blue-500/20 to-cyan-500/20 text-blue-300', icon: <Users size={18} /> },
    { label: t('pendingVerifs'), value: stats.verifs, color: 'from-amber-500/20 to-orange-500/20 text-amber-300', icon: <ShieldCheck size={18} /> },
    { label: t('pendingDeposits'), value: stats.deposits, color: 'from-green-500/20 to-emerald-500/20 text-green-300', icon: <DollarSign size={18} /> },
    { label: t('pendingWithdrawals'), value: stats.withdrawals, color: 'from-red-500/20 to-pink-500/20 text-red-300', icon: <DollarSign size={18} /> },
    { label: t('openTasks'), value: stats.tasks, color: 'from-purple-500/20 to-pink-500/20 text-purple-300', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <motion.div whileTap={{ scale: 0.97 }} key={c.label} className={`bg-gradient-to-br ${c.color} border border-white/10 rounded-2xl p-4`}>
          <div className="flex items-center gap-2 mb-1 opacity-80">{c.icon}<span className="text-xs text-slate-300">{c.label}</span></div>
          <p className="text-3xl font-bold text-white">{c.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

function StaffTab() {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [editPerms, setEditPerms] = useState<Profile | null>(null);
  const [permState, setPermState] = useState<Record<string, boolean>>({});

  const isSuperAdmin = profile?.is_super_admin === true;

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    const all = (data as Profile[]) || [];
    setAllUsers(all);
    setAdmins(all.filter((u) => u.role === 'admin'));
  };
  useEffect(() => { load(); }, []);

  const filtered = allUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
  });

  const openPerms = (u: Profile) => {
    setEditPerms(u);
    const perms: Record<string, boolean> = {};
    PERM_KEYS.forEach((k) => { perms[k] = u.admin_permissions?.[k] === true; });
    setPermState(perms);
  };

  const savePerms = async () => {
    if (!editPerms) return;
    await supabase.from('profiles').update({ admin_permissions: permState }).eq('id', editPerms.id);
    notify(t('saved'), 'success');
    setEditPerms(null);
    load();
  };

  const togglePerm = (key: string) => {
    setPermState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setRole = async (u: Profile, role: 'admin' | 'user') => {
    if (u.is_super_admin) { notify(t('superAdminLocked'), 'error'); return; }
    await supabase.from('profiles').update({ role }).eq('id', u.id);
    notify(role === 'admin' ? t('makeAdmin') : t('removeAdmin'), 'success');
    load();
  };

  const toggleSuperAdmin = async (u: Profile) => {
    if (profile?.is_super_admin !== true) { notify(t('noPermissions'), 'error'); return; }
    await supabase.from('profiles').update({ is_super_admin: !u.is_super_admin }).eq('id', u.id);
    notify(t('saved'), 'success');
    load();
  };

  const permLabels: Record<PermKey, string> = {
    manage_deposits: t('permManageDeposits'),
    manage_withdrawals: t('permManageWithdrawals'),
    moderate_tasks: t('permModerateTasks'),
    verify_kyc: t('permVerifyKyc'),
    manage_promo_codes: t('permManagePromoCodes'),
    balance_adjustments: t('permBalanceAdjustments'),
    system_settings: t('permSystemSettings'),
  };

  return (
    <div className="space-y-4">
      {/* Staff list */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <UserCog size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">{t('staffManagement')}</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">{t('staffManagementDesc')}</p>

        <div className="space-y-2">
          {admins.length === 0 ? <EmptyState message={t('staffManagement')} /> : admins.map((u) => (
            <div key={u.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate flex items-center gap-1.5">
                  {u.full_name || u.phone || 'Admin'}
                  {u.is_super_admin && <Lock size={12} className="text-amber-400" />}
                </p>
                <p className="text-xs text-slate-500">
                  {u.is_super_admin ? t('superAdmin') : `${PERM_KEYS.filter((k) => u.admin_permissions?.[k]).length}/${PERM_KEYS.length} permissions`}
                </p>
              </div>
              <div className="flex gap-1">
                {!u.is_super_admin && (
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => openPerms(u)}>{t('staffManagement')}</Button>
                )}
                {isSuperAdmin && (
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => toggleSuperAdmin(u)}>
                    {u.is_super_admin ? t('removeAdmin') : t('makeSuperAdmin')}
                  </Button>
                )}
                {!u.is_super_admin && <Button variant="danger" className="text-xs px-2 py-1" onClick={() => setRole(u, 'user')}>{t('removeAdmin')}</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Promote users to admin */}
      <Card>
        <h3 className="font-semibold text-white mb-3 text-sm">{t('makeAdmin')}</h3>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchUsers')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.filter((u) => u.role !== 'admin').slice(0, 20).map((u) => (
            <div key={u.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{u.full_name || u.phone || 'User'}</p>
                <p className="text-xs text-slate-500">{u.phone}</p>
              </div>
              <Button className="text-xs px-2 py-1" onClick={() => { setRole(u, 'admin'); }}>{t('makeAdmin')}</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Permission editor modal */}
      <Modal open={!!editPerms} onClose={() => setEditPerms(null)} title={`${t('staffManagement')} — ${editPerms?.full_name || editPerms?.phone || ''}`}>
        <div className="space-y-3">
          {PERM_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between bg-slate-700/50 border border-white/10 rounded-xl px-3 py-3 cursor-pointer hover:bg-slate-700/70 transition">
              <span className="text-sm text-white">{permLabels[key]}</span>
              <button
                type="button"
                onClick={() => togglePerm(key)}
                className={`relative w-11 h-6 rounded-full transition ${permState[key] ? 'bg-amber-500' : 'bg-slate-600'}`}
              >
                <motion.span
                  animate={{ x: permState[key] ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                />
              </button>
            </label>
          ))}
          <Button className="w-full" onClick={savePerms}>{t('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function UsersTab() {
  const { t, refreshProfile } = useApp();
  const { notify } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editBalances, setEditBalances] = useState({ lumora_coins: 0, withdrawable_coins: 0, bonus_coins: 0, cash_balance: 0, withdrawable_balance: 0 });

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    setUsers(data as Profile[] || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
  });

  const toggleBan = async (u: Profile) => {
    await supabase.from('profiles').update({ banned: !u.banned }).eq('id', u.id);
    notify(u.banned ? 'Unbanned' : 'Banned', 'success');
    load();
  };

  const openEdit = (u: Profile) => {
    setEditUser(u);
    setEditBalances({
      lumora_coins: u.lumora_coins,
      withdrawable_coins: u.withdrawable_coins || 0,
      bonus_coins: u.bonus_coins || 0,
      cash_balance: u.cash_balance || 0,
      withdrawable_balance: u.withdrawable_balance ?? u.cash_balance ?? 0,
    });
  };

  const saveBalances = async () => {
    if (!editUser) return;
    const updates = {
      lumora_coins: editBalances.lumora_coins,
      withdrawable_coins: editBalances.withdrawable_coins,
      bonus_coins: editBalances.bonus_coins,
      cash_balance: editBalances.cash_balance,
      withdrawable_balance: editBalances.withdrawable_balance,
    };
    await supabase.from('profiles').update(updates).eq('id', editUser.id);
    const delta = editBalances.lumora_coins - editUser.lumora_coins;
    if (delta !== 0) {
      await supabase.from('transactions').insert({ user_id: editUser.id, type: 'admin_adjust', amount: delta, status: 'completed', note: `Admin adjustment: coins ${delta > 0 ? '+' : ''}${delta}` });
    }
    notify(t('saved'), 'success');
    setEditUser(null);
    load();
    refreshProfile();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchUsers')}
          className="w-full bg-slate-700 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
        />
      </div>

      {filtered.length === 0 ? <EmptyState message={t('users')} /> : filtered.map((u) => (
        <div key={u.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{u.full_name || u.phone || 'User'}</p>
            <p className="text-xs text-slate-500">
              {u.role} • {u.lumora_coins} {t('lumoraCoins')} • {(u.cash_balance || 0)} BDT
              {u.banned && ' • BANNED'}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => openEdit(u)}>{t('adjustCoins')}</Button>
            <Button variant={u.banned ? 'ghost' : 'danger'} className="text-xs px-2 py-1" onClick={() => toggleBan(u)}>{u.banned ? 'Unban' : t('ban')}</Button>
          </div>
        </div>
      ))}

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={t('adjustCoins')}>
        <div className="space-y-3">
          <p className="text-sm text-slate-400">{editUser?.full_name || editUser?.phone}</p>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('adjustCash')}</label>
            <input type="number" value={editBalances.cash_balance} onChange={(e) => setEditBalances({ ...editBalances, cash_balance: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Withdrawable Balance (BDT)</label>
            <input type="number" value={editBalances.withdrawable_balance} onChange={(e) => setEditBalances({ ...editBalances, withdrawable_balance: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('lumoraCoins')} (Total)</label>
            <input type="number" value={editBalances.lumora_coins} onChange={(e) => setEditBalances({ ...editBalances, lumora_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('adjustWithdrawable')}</label>
            <input type="number" value={editBalances.withdrawable_coins} onChange={(e) => setEditBalances({ ...editBalances, withdrawable_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('adjustBonus')}</label>
            <input type="number" value={editBalances.bonus_coins} onChange={(e) => setEditBalances({ ...editBalances, bonus_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <Button className="w-full" onClick={saveBalances}>{t('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function VerificationsTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [reqs, setReqs] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('id_verifications').select('*, profiles(full_name, phone)').eq('status', 'pending').order('created_at', { ascending: false });
    setReqs(data || []);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, status: string) => {
    await supabase.from('id_verifications').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (status === 'approved') {
      const { data: verif } = await supabase.from('id_verifications').select('user_id').eq('id', id).maybeSingle();
      if (verif) {
        await supabase.from('profiles').update({ kyc_verified: true }).eq('id', verif.user_id);
        const { data: prof } = await supabase.from('profiles').select('referred_by, lumora_coins, bonus_coins').eq('id', verif.user_id).maybeSingle();
        if (prof?.referred_by) {
          const { data: referrer } = await supabase.from('profiles').select('lumora_coins, bonus_coins, referral_earned').eq('id', prof.referred_by).maybeSingle();
          if (referrer) {
            const step1Bonus = 500;
            await supabase.from('profiles').update({
              lumora_coins: referrer.lumora_coins + step1Bonus,
              bonus_coins: (referrer.bonus_coins || 0) + step1Bonus,
              referral_earned: (referrer.referral_earned || 0) + step1Bonus,
            }).eq('id', prof.referred_by);
            await supabase.from('transactions').insert({ user_id: prof.referred_by, type: 'referral_signup', amount: step1Bonus, status: 'completed', note: 'Referral Step 1: KYC verified' });
          }
        }
      }
    }
    notify(status === 'approved' ? t('approved') : t('rejected'), 'success');
    load();
  };

  return (
    <div className="space-y-3">
      {reqs.length === 0 ? <EmptyState message={t('verifications')} /> : reqs.map((r) => (
        <div key={r.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-white">{r.profiles?.full_name || r.profiles?.phone || 'User'}</p>
              <p className="text-xs text-slate-500">NID: {r.id_number}</p>
            </div>
            <div className="flex gap-1">
              <Button className="text-xs px-2 py-1" onClick={() => act(r.id, 'approved')}><Check size={14} /></Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(r.id, 'rejected')}><X size={14} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {r.nid_front_url && <a href={r.nid_front_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline truncate">NID Front</a>}
            {r.nid_back_url && <a href={r.nid_back_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline truncate">NID Back</a>}
            {r.video_selfie_url && <a href={r.video_selfie_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline truncate">Video Selfie</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppealsTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [appeals, setAppeals] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('kyc_appeals').select('*, profiles(full_name, phone)').eq('status', 'pending').order('created_at', { ascending: false });
    setAppeals(data || []);
  };
  useEffect(() => { load(); }, []);

  const act = async (appeal: any, status: string) => {
    await supabase.from('kyc_appeals').update({ status, reviewed_at: new Date().toISOString() }).eq('id', appeal.id);
    if (status === 'approved') {
      await supabase.from('deleted_account_nids').delete().eq('nid_number', appeal.nid_number);
      await supabase.from('profiles').update({ kyc_verified: true }).eq('id', appeal.user_id);
      await supabase.from('id_verifications').update({ status: 'appeal_approved' }).eq('user_id', appeal.user_id).eq('id_number', appeal.nid_number);
    }
    notify(status === 'approved' ? t('approved') : t('rejected'), 'success');
    load();
  };

  return (
    <div className="space-y-3">
      {appeals.length === 0 ? <EmptyState message={t('kycAppeals')} /> : appeals.map((a) => (
        <div key={a.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-white">{a.profiles?.full_name || a.profiles?.phone || 'User'}</p>
              <p className="text-xs text-slate-500">NID: {a.nid_number}</p>
            </div>
            <div className="flex gap-1">
              <Button className="text-xs px-2 py-1" onClick={() => act(a, 'approved')}><Check size={14} /></Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(a, 'rejected')}><X size={14} /></Button>
            </div>
          </div>
          <p className="text-xs text-slate-400">{a.reason}</p>
        </div>
      ))}
    </div>
  );
}

function FinanceTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [txs, setTxs] = useState<TxRow[]>([]);

  const load = async () => {
    const { data } = await supabase.from('transactions').select('*, profiles(full_name, phone)').in('type', ['deposit', 'withdrawal']).eq('status', 'pending').order('created_at', { ascending: false });
    setTxs(data as TxRow[] || []);
  };
  useEffect(() => { load(); }, []);

  const applyDepositPromoBonus = async (userId: string, promoCode: string): Promise<number> => {
    const trimmed = promoCode.trim().toUpperCase();
    const { data: promo, error } = await supabase.from('promo_codes').select('*').eq('code', trimmed).maybeSingle();
    if (error || !promo || !promo.is_active || promo.uses_count >= promo.max_uses) return 0;

    const { data: existing } = await supabase.from('promo_redemptions').select('id').eq('promo_code_id', promo.id).eq('user_id', userId).maybeSingle();
    if (existing) return 0;

    await supabase.from('promo_redemptions').insert({ promo_code_id: promo.id, user_id: userId, coins_awarded: promo.coin_value });
    await supabase.from('promo_codes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id);

    const { data: prof } = await supabase.from('profiles').select('lumora_coins, bonus_coins').eq('id', userId).maybeSingle();
    if (prof) {
      await supabase.from('profiles').update({
        lumora_coins: prof.lumora_coins + promo.coin_value,
        bonus_coins: (prof.bonus_coins || 0) + promo.coin_value,
      }).eq('id', userId);
    }
    await supabase.from('transactions').insert({ user_id: userId, type: 'promo', amount: promo.coin_value, status: 'completed', note: `Deposit promo bonus: ${trimmed}` });
    return promo.coin_value;
  };

  const act = async (tx: TxRow, status: string) => {
    if (status === 'rejected' && tx.type === 'withdrawal') {
      const { data, error } = await supabase.rpc('reject_withdrawal_refund', { p_tx_id: tx.id });
      if (error) {
        notify(`Refund failed: ${error.message}`, 'error');
        return;
      }
      const refunded = data?.[0]?.refunded_amount ?? Math.abs(tx.amount);
      notify(`Withdrawal rejected & ${Number(refunded).toFixed(2)} BDT refunded`, 'success');
      load();
      return;
    }

    await supabase.from('transactions').update({ status }).eq('id', tx.id);
    if (status === 'approved') {
      if (tx.type === 'deposit') {
        const bdtAmount = Math.abs(tx.amount);
        const { data: prof } = await supabase.from('profiles').select('cash_balance, withdrawable_balance').eq('id', tx.user_id).maybeSingle();
        if (prof) {
          await supabase.from('profiles').update({
            cash_balance: +((prof.cash_balance ?? 0) + bdtAmount).toFixed(2),
            withdrawable_balance: +((prof.withdrawable_balance ?? prof.cash_balance ?? 0) + bdtAmount).toFixed(2),
          }).eq('id', tx.user_id);
        }
        if (tx.deposit_promo_code) {
          const bonus = await applyDepositPromoBonus(tx.user_id, tx.deposit_promo_code);
          if (bonus > 0) notify(`${t('bonusCoinsCredited')} +${bonus}`, 'success');
        }
      }
    }
    notify(status === 'approved' ? t('approved') : t('rejected'), 'success');
    load();
  };

  return (
    <div className="space-y-2">
      {txs.length === 0 ? <EmptyState message={t('finance')} /> : txs.map((tx) => (
        <div key={tx.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white capitalize">
                {tx.type} • {tx.method}
                {tx.deposit_promo_code && <span className="ml-1.5 text-amber-400 text-xs">[{tx.deposit_promo_code}]</span>}
                {tx.withdraw_promo_code && <span className="ml-1.5 text-amber-400 text-xs">[{tx.withdraw_promo_code}]</span>}
              </p>
              <p className="text-xs text-slate-500">{tx.note}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold text-amber-300">{Math.abs(tx.amount) >= 100 ? `${Math.abs(tx.amount).toFixed(2)} BDT` : Math.abs(tx.amount)}</span>
              <Button className="text-xs px-2 py-1" onClick={() => act(tx, 'approved')}><Check size={14} /></Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(tx, 'rejected')}><X size={14} /></Button>
            </div>
          </div>
          {tx.type === 'deposit' && (
            <div className="grid grid-cols-3 gap-2 mt-2 bg-slate-900/40 rounded-lg p-2">
              {tx.sender_number && (<div><p className="text-[10px] text-slate-500">{t('senderPhone')}</p><p className="text-xs text-white font-mono">{tx.sender_number}</p></div>)}
              {tx.trx_id && (<div><p className="text-[10px] text-slate-500">{t('trxId')}</p><p className="text-xs text-white font-mono">{tx.trx_id}</p></div>)}
              {tx.personal_admin_number && (<div><p className="text-[10px] text-slate-500">Admin #</p><p className="text-xs text-white font-mono">{tx.personal_admin_number}</p></div>)}
            </div>
          )}
          {tx.type === 'withdrawal' && tx.receiver_number && (
            <div className="mt-2 bg-slate-900/40 rounded-lg p-2">
              <p className="text-[10px] text-slate-500">{t('receiverWallet')}</p>
              <p className="text-xs text-white font-mono">{tx.receiver_number}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DisputesTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [subs, setSubs] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('task_submissions').select('*, tasks(title, platform), profiles(full_name)').in('status', ['challenged', 'pending']).order('created_at', { ascending: false });
    setSubs(data || []);
  };
  useEffect(() => { load(); }, []);

  const act = async (sub: any, status: string) => {
    await supabase.from('task_submissions').update({ status, reviewed_at: new Date().toISOString() }).eq('id', sub.id);
    if (status === 'approved') {
      const { data: task } = await supabase.from('tasks').select('reward_coins, is_admin_task').eq('id', sub.task_id).maybeSingle();
      if (task) {
        const reward = task.is_admin_task ? task.reward_coins * 2 : task.reward_coins;
        const { data: prof } = await supabase.from('profiles').select('lumora_coins').eq('id', sub.doer_id).maybeSingle();
        if (prof) {
          await supabase.from('profiles').update({ lumora_coins: prof.lumora_coins + reward }).eq('id', sub.doer_id);
          await supabase.from('transactions').insert({ user_id: sub.doer_id, type: 'task_earn', amount: reward, status: 'completed', note: `Task reward: ${task.is_admin_task ? '2x admin' : ''}` });
        }
      }
    }
    notify(status === 'approved' ? t('taskApproved') : t('taskRejected'), 'success');
    load();
  };

  return (
    <div className="space-y-2">
      {subs.length === 0 ? <EmptyState message={t('disputes')} /> : subs.map((sub) => (
        <div key={sub.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-white">{sub.tasks?.title || 'Task'}</p>
              <p className="text-xs text-slate-500">{sub.profiles?.full_name} • {sub.status}</p>
            </div>
            <div className="flex gap-1">
              <Button className="text-xs px-2 py-1" onClick={() => act(sub, 'approved')}><Check size={14} /></Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(sub, 'rejected')}><X size={14} /></Button>
            </div>
          </div>
          <p className="text-xs text-slate-400">{sub.notes}</p>
          {sub.proof_urls?.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline mr-2">Proof {i + 1}</a>)}
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const { t, refreshLogo } = useApp();
  const { notify } = useToast();
  const [s, setS] = useState<any>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [promoTiers, setPromoTiers] = useState<{ duration_days: number; label: string; free_cost: number; pro_cost: number; vip_cost: number; daily_rate_after_lock_free?: number; daily_rate_after_lock_pro?: number; daily_rate_after_lock_vip?: number; daily_rate_after_lock?: number }[]>([]);
  const [newTier, setNewTier] = useState({ duration_days: 1, label: '', free_cost: 50, pro_cost: 40, vip_cost: 25, daily_rate_after_lock_free: 0, daily_rate_after_lock_pro: 0, daily_rate_after_lock_vip: 0 });
  const [superEvt, setSuperEvt] = useState<any>(null);
  const [superForm, setSuperForm] = useState({ is_active: false, activation_at: '', winner_limit: 10, reward_coins: 1000 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
      setS(data);
      if (data?.promotion_tiers && Array.isArray(data.promotion_tiers)) {
        setPromoTiers(data.promotion_tiers);
      }
      const { data: se } = await supabase.from('super_mystery_events').select('*').eq('id', 1).maybeSingle();
      if (se) {
        setSuperEvt(se);
        setSuperForm({
          is_active: se.is_active,
          activation_at: se.activation_at ? new Date(se.activation_at).toISOString().slice(0, 16) : '',
          winner_limit: se.winner_limit,
          reward_coins: se.reward_coins,
        });
      }
    })();
  }, []);

  const saveSuperEvent = async () => {
    const payload = {
      is_active: superForm.is_active,
      activation_at: superForm.activation_at ? new Date(superForm.activation_at).toISOString() : null,
      winner_limit: superForm.winner_limit,
      reward_coins: superForm.reward_coins,
      updated_at: new Date().toISOString(),
    };
    await supabase.from('super_mystery_events').update(payload).eq('id', 1);
    setSuperEvt({ ...superEvt, ...payload });
    notify(t('saved'), 'success');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { url, error } = await uploadBrandingImage(file, 'logo');
      if (error || !url) { notify(error || 'Upload failed', 'error'); return; }
      await supabase.from('app_settings').update({ app_logo_url: url }).eq('id', 1);
      setS((prev: any) => ({ ...prev, app_logo_url: url }));
      await refreshLogo();
      notify(t('saved'), 'success');
    } finally { setLogoUploading(false); }
  };

  const removeLogo = async () => {
    await supabase.from('app_settings').update({ app_logo_url: null }).eq('id', 1);
    setS((prev: any) => ({ ...prev, app_logo_url: null }));
    await refreshLogo();
    notify(t('saved'), 'success');
  };

  const save = async () => {
    await supabase.from('app_settings').update({
      bdt_to_coin: s.bdt_to_coin, min_deposit_bdt: s.min_deposit_bdt,
      spin_rewards: s.spin_rewards, free_spins_daily: s.free_spins_daily,
      checkin_rewards: s.checkin_rewards, referral_bonus: s.referral_bonus,
      referee_bonus: s.referee_bonus, referrer_deposit_pct: s.referrer_deposit_pct,
      admin_bkash_number: s.admin_bkash_number, admin_nagad_number: s.admin_nagad_number, admin_rocket_number: s.admin_rocket_number,
    }).eq('id', 1);
    notify(t('saved'), 'success');
  };

  if (!s) return null;

  const fields = [
    { key: 'bdt_to_coin', label: t('exchangeRate') + ` (1 BDT = ? ${t('lumoraCoins')})` },
    { key: 'min_deposit_bdt', label: t('minDeposit') + ' (BDT)' },
    { key: 'free_spins_daily', label: t('freeSpinsDaily') },
    { key: 'referral_bonus', label: `Referral bonus (${t('lumoraCoins')})` },
    { key: 'referee_bonus', label: `Referee bonus (${t('lumoraCoins')})` },
    { key: 'referrer_deposit_pct', label: 'Referrer deposit %' },
  ];

  return (
    <div className="space-y-4">
    {/* Global App Logo & Branding */}
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon size={18} className="text-amber-400" />
        <h3 className="font-semibold text-white">{t('logoBranding')}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">{t('logoBrandingDesc')}</p>
      <div className="flex items-center gap-4 mb-3">
        <div className="shrink-0">
          {s.app_logo_url ? (
            <img src={s.app_logo_url} alt="App Logo" className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-amber-500 to-orange-600 text-slate-900">L</div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs text-slate-400 mb-2">{s.app_logo_url ? t('currentLogo') : t('noLogoUploaded')}</p>
          <div className="flex gap-2">
            <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            <Button variant="ghost" className="text-xs px-3 py-2 flex items-center gap-1.5" onClick={() => logoFileRef.current?.click()} disabled={logoUploading}>
              {logoUploading ? <><ImageIcon size={14} /> {t('uploading')}</> : <><Upload size={14} /> {t('uploadLogo')}</>}
            </Button>
            {s.app_logo_url && (
              <Button variant="danger" className="text-xs px-3 py-2" onClick={removeLogo}><Trash2 size={14} /></Button>
            )}
          </div>
        </div>
      </div>
    </Card>

    {/* Promotion Tier Pricing */}
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={18} className="text-fuchsia-400" />
        <h3 className="font-semibold text-white">{t('promotionTiers')}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">{t('promotionTiersDesc')}</p>
      <div className="space-y-2 mb-3">
        {promoTiers.length === 0 ? (
          <EmptyState message={t('promotionTiers')} />
        ) : promoTiers.map((tier, i) => (
          <div key={i} className="bg-slate-800/50 border border-fuchsia-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white font-medium flex items-center gap-1.5">
                <Zap size={12} className="text-fuchsia-400" /> {tier.label}
                <span className="text-[10px] text-slate-500">{tier.duration_days === 0 ? t('unlimitedDuration') : `${tier.duration_days} ${t('day')}`}</span>
              </p>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => {
                setPromoTiers(promoTiers.filter((_, idx) => idx !== i));
              }}><Trash2 size={14} /></Button>
            </div>
            {tier.duration_days !== 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block">{t('tierFree')}</label>
                <input type="number" min={0} value={tier.free_cost} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, free_cost: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-cyan-400 block">{t('tierPro')}</label>
                <input type="number" min={0} value={tier.pro_cost} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, pro_cost: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-amber-400 block">{t('tierVip')}</label>
                <input type="number" min={0} value={tier.vip_cost} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, vip_cost: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
              </div>
            </div>
            )}
            {tier.duration_days === 0 && (
              <div className="mt-3 pt-3 border-t border-fuchsia-500/10">
                <label className="text-[10px] text-fuchsia-400 block mb-1">{t('dailyRateAfterLock')} {t('perDay')} — Free / Pro / VIP</label>
                <p className="text-[9px] text-slate-500 mb-2">{t('phase2AdminHint')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">{t('tierFree')}</label>
                    <input type="number" min={0} value={tier.daily_rate_after_lock_free ?? tier.daily_rate_after_lock ?? 0} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, daily_rate_after_lock_free: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400 block">{t('tierPro')}</label>
                    <input type="number" min={0} value={tier.daily_rate_after_lock_pro ?? tier.daily_rate_after_lock ?? 0} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, daily_rate_after_lock_pro: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400 block">{t('tierVip')}</label>
                    <input type="number" min={0} value={tier.daily_rate_after_lock_vip ?? tier.daily_rate_after_lock ?? 0} onChange={(e) => setPromoTiers(promoTiers.map((x, idx) => idx === i ? { ...x, daily_rate_after_lock_vip: +e.target.value } : x))} className="w-full bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-3 border-t border-white/10">
        <p className="text-xs text-fuchsia-400 font-semibold">{t('addTier')}</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={newTier.label} onChange={(e) => setNewTier({ ...newTier, label: e.target.value })} placeholder={t('tierLabel')} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          <input type="number" min={0} value={newTier.duration_days} onChange={(e) => setNewTier({ ...newTier, duration_days: +e.target.value })} placeholder={t('tierDurationDays')} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
        {newTier.duration_days !== 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">{t('freeCost')}</label>
            <input type="number" min={0} value={newTier.free_cost} onChange={(e) => setNewTier({ ...newTier, free_cost: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-cyan-400 block mb-0.5">{t('proCost')}</label>
            <input type="number" min={0} value={newTier.pro_cost} onChange={(e) => setNewTier({ ...newTier, pro_cost: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-amber-400 block mb-0.5">{t('vipCost')}</label>
            <input type="number" min={0} value={newTier.vip_cost} onChange={(e) => setNewTier({ ...newTier, vip_cost: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
        )}
        {newTier.duration_days === 0 && (
          <div>
            <label className="text-[10px] text-fuchsia-400 block mb-0.5">{t('dailyRateAfterLock')} {t('perDay')} — Free / Pro / VIP</label>
            <p className="text-[9px] text-slate-500 mb-1.5">{t('phase2AdminHint')}</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">{t('tierFree')}</label>
                <input type="number" min={0} value={newTier.daily_rate_after_lock_free} onChange={(e) => setNewTier({ ...newTier, daily_rate_after_lock_free: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-cyan-400 block mb-0.5">{t('tierPro')}</label>
                <input type="number" min={0} value={newTier.daily_rate_after_lock_pro} onChange={(e) => setNewTier({ ...newTier, daily_rate_after_lock_pro: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-amber-400 block mb-0.5">{t('tierVip')}</label>
                <input type="number" min={0} value={newTier.daily_rate_after_lock_vip} onChange={(e) => setNewTier({ ...newTier, daily_rate_after_lock_vip: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
              </div>
            </div>
          </div>
        )}
        <Button variant="ghost" className="w-full text-sm flex items-center justify-center gap-1.5" onClick={() => {
          if (!newTier.label.trim()) { notify(t('tierLabel'), 'error'); return; }
          setPromoTiers([...promoTiers, { ...newTier, label: newTier.label.trim() }]);
          setNewTier({ duration_days: 1, label: '', free_cost: 50, pro_cost: 40, vip_cost: 25, daily_rate_after_lock_free: 0, daily_rate_after_lock_pro: 0, daily_rate_after_lock_vip: 0 });
        }}>
          <Plus size={14} /> {t('addTier')}
        </Button>
        <Button className="w-full" onClick={async () => {
          await supabase.from('app_settings').update({ promotion_tiers: promoTiers }).eq('id', 1);
          notify(t('saved'), 'success');
        }}>{t('save')}</Button>
      </div>
    </Card>

    {/* Super Mystery Box Event Control */}
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Crown size={18} className="text-amber-400" />
        <h3 className="font-semibold text-white">{t('superEventAdminTitle')}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">{t('superEventAdminDesc')}</p>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSuperForm({ ...superForm, is_active: !superForm.is_active })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${superForm.is_active ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'bg-slate-700 text-slate-400 border border-white/10'}`}
          >
            {superForm.is_active ? t('superEventActive') : t('superEventInactive')}
          </button>
          {superEvt && (
            <span className="text-[10px] text-slate-500">
              {t('superEventWinnerLimit')}: {superEvt.claimers_count ?? 0} / {superEvt.winner_limit}
            </span>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('superEventActivation')}</label>
          <input
            type="datetime-local"
            value={superForm.activation_at}
            onChange={(e) => setSuperForm({ ...superForm, activation_at: e.target.value })}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('superEventWinnerLimit')}</label>
            <input
              type="number"
              min={1}
              value={superForm.winner_limit}
              onChange={(e) => setSuperForm({ ...superForm, winner_limit: +e.target.value })}
              className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('superEventReward')}</label>
            <input
              type="number"
              min={1}
              value={superForm.reward_coins}
              onChange={(e) => setSuperForm({ ...superForm, reward_coins: +e.target.value })}
              className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </div>
        </div>
        <Button className="w-full" onClick={saveSuperEvent}>{t('save')}</Button>
      </div>
    </Card>

    <Card>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
            <input type="number" value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('spinRewards')}</label>
          <input value={s.spin_rewards} onChange={(e) => setS({ ...s, spin_rewards: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Check-in rewards</label>
          <input value={s.checkin_rewards} onChange={(e) => setS({ ...s, checkin_rewards: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>

        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-amber-400 font-semibold mb-2">{t('personalAdminNumbers')}</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('adminBkashNumber')}</label>
              <input value={s.admin_bkash_number || ''} onChange={(e) => setS({ ...s, admin_bkash_number: e.target.value })} placeholder="017XXXXXXXX" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('adminNagadNumber')}</label>
              <input value={s.admin_nagad_number || ''} onChange={(e) => setS({ ...s, admin_nagad_number: e.target.value })} placeholder="018XXXXXXXX" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('adminRocketNumber')}</label>
              <input value={s.admin_rocket_number || ''} onChange={(e) => setS({ ...s, admin_rocket_number: e.target.value })} placeholder="019XXXXXXXX" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono" />
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={save}>{t('save')}</Button>
      </div>
    </Card>
    </div>
  );
}

function BroadcastTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    await supabase.from('notifications').insert({ is_broadcast: true, title, body });
    notify('Broadcast sent!', 'success');
    setTitle('');
    setBody('');
  };

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('title')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('body')}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>
        <Button className="w-full" onClick={send}>{t('broadcastTo')}</Button>
      </div>
    </Card>
  );
}

function PromoCodesTab() {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [codes, setCodes] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', coin_value: 100, max_uses: 1, expires_at: '' });

  const load = async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(50);
    setCodes(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.code.trim() || !profile) return;
    const code = form.code.trim().toUpperCase();
    const { error } = await supabase.from('promo_codes').insert({
      code, coin_value: form.coin_value, max_uses: form.max_uses, is_active: true, created_by: profile.id,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    });
    if (error) {
      notify(error.message.includes('duplicate') ? 'Code already exists' : error.message, 'error');
      return;
    }
    notify(t('saved'), 'success');
    setForm({ code: '', coin_value: 100, max_uses: 1, expires_at: '' });
    load();
  };

  const toggleActive = async (c: any) => {
    await supabase.from('promo_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('promo_codes').delete().eq('id', id);
    notify('Deleted', 'success');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Ticket size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">{t('createPromo')}</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('promoCode')}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME100" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm uppercase outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('promoValue')}</label>
              <input type="number" min={1} value={form.coin_value} onChange={(e) => setForm({ ...form, coin_value: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('promoMaxUses')}</label>
              <input type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('promoExpiry')}</label>
            <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <Button className="w-full" onClick={create}>{t('createPromo')}</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {codes.length === 0 ? <EmptyState message={t('promoManager')} /> : codes.map((c) => (
          <div key={c.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-mono font-bold">{c.code}</p>
              <p className="text-xs text-slate-500">
                {c.coin_value} {t('lumoraCoins')} • {c.uses_count}/{c.max_uses} {t('promoUses')}
                {c.expires_at && ` • ${new Date(c.expires_at).toLocaleString()}`}
                {!c.is_active && ' • INACTIVE'}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => toggleActive(c)}>
                {c.is_active ? <X size={14} /> : <Check size={14} />}
              </Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => remove(c.id)}><X size={14} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskManagementTab() {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [limits, setLimits] = useState({ min_task_reward: 10, max_task_reward: 10000 });
  const [newCat, setNewCat] = useState({ name: '', label: '', icon: 'other', icon_url: '', video_tutorial_url: '' });
  const [iconUploading, setIconUploading] = useState(false);
  const iconFileRef = useRef<HTMLInputElement>(null);
  const [videoEditing, setVideoEditing] = useState<string | null>(null);
  const [videoUrlDraft, setVideoUrlDraft] = useState('');
  const [editTask, setEditTask] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', reward_coins: 25, slots: 1, status: 'open' });

  const load = async () => {
    const [catRes, taskRes, settingsRes] = await Promise.all([
      supabase.from('task_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('app_settings').select('min_task_reward, max_task_reward').eq('id', 1).maybeSingle(),
    ]);
    setCategories(catRes.data || []);
    setTasks(taskRes.data || []);
    if (settingsRes.data) setLimits(settingsRes.data);
  };

  useEffect(() => { load(); }, []);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    try {
      const { url, error } = await uploadBrandingImage(file, 'category-icons');
      if (error || !url) { notify(error || 'Upload failed', 'error'); return; }
      setNewCat((prev) => ({ ...prev, icon_url: url }));
      notify(t('saved'), 'success');
    } finally { setIconUploading(false); }
  };

  const addCategory = async () => {
    if (!newCat.name.trim() || !newCat.label.trim() || !profile) return;
    const { error } = await supabase.from('task_categories').insert({
      name: newCat.name.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newCat.label.trim(),
      icon: newCat.icon,
      icon_url: newCat.icon_url.trim() || null,
      video_tutorial_url: newCat.video_tutorial_url.trim() || null,
      sort_order: categories.length + 1,
      created_by: profile.id,
    });
    if (error) { notify(error.message, 'error'); return; }
    notify(t('saved'), 'success');
    setNewCat({ name: '', label: '', icon: 'other', icon_url: '', video_tutorial_url: '' });
    load();
  };

  const startEditVideo = (cat: any) => {
    setVideoEditing(cat.id);
    setVideoUrlDraft(cat.video_tutorial_url || '');
  };

  const saveVideoUrl = async (catId: string) => {
    await supabase.from('task_categories').update({ video_tutorial_url: videoUrlDraft.trim() || null }).eq('id', catId);
    notify(t('saved'), 'success');
    setVideoEditing(null);
    setVideoUrlDraft('');
    load();
  };

  const toggleCategory = async (cat: any) => {
    await supabase.from('task_categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    load();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('task_categories').delete().eq('id', id);
    notify(t('saved'), 'success');
    load();
  };

  const saveLimits = async () => {
    await supabase.from('app_settings').update({
      min_task_reward: limits.min_task_reward,
      max_task_reward: limits.max_task_reward,
    }).eq('id', 1);
    notify(t('saved'), 'success');
  };

  const pauseTask = async (task: any) => {
    await supabase.from('tasks').update({ status: 'paused' }).eq('id', task.id);
    notify(t('taskPaused'), 'info');
    load();
  };

  const resumeTask = async (task: any) => {
    await supabase.from('tasks').update({ status: 'open' }).eq('id', task.id);
    notify(t('taskResumed'), 'success');
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    notify(t('taskDeleted'), 'info');
    load();
  };

  const openEdit = (task: any) => {
    setEditTask(task);
    setEditForm({ title: task.title, description: task.description || '', reward_coins: task.reward_coins, slots: task.slots, status: task.status });
  };

  const saveEdit = async () => {
    if (!editTask) return;
    const reward = editForm.reward_coins;
    if (reward < limits.min_task_reward) { notify(t('rewardTooLow'), 'error'); return; }
    if (reward > limits.max_task_reward) { notify(t('rewardTooHigh'), 'error'); return; }
    await supabase.from('tasks').update({
      title: editForm.title,
      description: editForm.description,
      reward_coins: reward,
      slots: editForm.slots,
      status: editForm.status,
    }).eq('id', editTask.id);
    notify(t('taskUpdated'), 'success');
    setEditTask(null);
    load();
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'open': return t('taskStatusOpen');
      case 'paused': return t('taskStatusPaused');
      case 'in_progress': return t('taskStatusInProgress');
      case 'completed': return t('taskStatusCompleted');
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-400';
      case 'paused': return 'text-amber-400';
      case 'in_progress': return 'text-blue-400';
      case 'completed': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Task Reward Limits */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Settings size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">{t('taskRewardLimits')}</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">{t('taskRewardLimitsDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('minRewardLimit')}</label>
            <input type="number" min={1} value={limits.min_task_reward} onChange={(e) => setLimits({ ...limits, min_task_reward: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('maxRewardLimit')}</label>
            <input type="number" min={1} value={limits.max_task_reward} onChange={(e) => setLimits({ ...limits, max_task_reward: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
        <Button className="w-full mt-3" onClick={saveLimits}>{t('save')}</Button>
      </Card>

      {/* Task Categories */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ListChecks size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">{t('taskCategories')}</h3>
        </div>
        <div className="space-y-2 mb-4">
          {categories.length === 0 ? <EmptyState message={t('noCategories')} /> : categories.map((cat) => (
            <div key={cat.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {cat.icon_url ? (
                    <img src={cat.icon_url} alt={cat.label} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{cat.label}</p>
                    <p className="text-xs text-slate-500 truncate">{cat.name} {!cat.is_active && ' • INACTIVE'}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => startEditVideo(cat)}>
                    <Video size={14} />
                  </Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => toggleCategory(cat)}>
                    {cat.is_active ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteCategory(cat.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {videoEditing === cat.id && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                  <label className="text-xs text-slate-400 block">{t('videoTutorialUrl')}</label>
                  <p className="text-[10px] text-slate-500">{t('videoTutorialHint')}</p>
                  <div className="flex gap-2">
                    <input
                      value={videoUrlDraft}
                      onChange={(e) => setVideoUrlDraft(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    />
                    <Button variant="ghost" className="text-xs px-3 py-2" onClick={() => setVideoEditing(null)}>{t('cancel')}</Button>
                    <Button className="text-xs px-3 py-2" onClick={() => saveVideoUrl(cat.id)}>{t('save')}</Button>
                  </div>
                  {cat.video_tutorial_url && !videoUrlDraft && (
                    <p className="text-[10px] text-emerald-400">Current: {cat.video_tutorial_url}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-3 border-t border-white/10">
          <p className="text-xs text-amber-400 font-semibold">{t('addCategory')}</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder={t('categoryName')} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
            <input value={newCat.label} onChange={(e) => setNewCat({ ...newCat, label: e.target.value })} placeholder={t('categoryLabel')} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
            <select value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="app_review">App Review</option>
              <option value="tiktok">TikTok</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('videoTutorialUrl')}</label>
            <p className="text-[10px] text-slate-500 mb-1">{t('videoTutorialHint')}</p>
            <input value={newCat.video_tutorial_url} onChange={(e) => setNewCat({ ...newCat, video_tutorial_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-2" />
            <label className="text-xs text-slate-400 block mb-1">{t('fileOrUrl')}</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                ref={iconFileRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                className="text-xs px-3 py-2 flex items-center gap-1.5 shrink-0"
                onClick={() => iconFileRef.current?.click()}
                disabled={iconUploading}
              >
                {iconUploading ? <><ImageIcon size={14} /> {t('uploading')}</> : <><Upload size={14} /> {t('uploadIcon')}</>}
              </Button>
              {newCat.icon_url && (
                <img src={newCat.icon_url} alt="icon preview" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              )}
            </div>
            <input value={newCat.icon_url} onChange={(e) => setNewCat({ ...newCat, icon_url: e.target.value })} placeholder="https://example.com/icon.png" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <Button className="w-full" onClick={addCategory}>
            <span className="flex items-center justify-center gap-1.5"><Plus size={14} /> {t('addCategory')}</span>
          </Button>
        </div>
      </Card>

      {/* All Tasks - Lifecycle Control */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ListChecks size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">{t('allTasks')}</h3>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tasks.length === 0 ? <EmptyState message={t('noTasks')} /> : tasks.map((task) => (
            <div key={task.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{task.title}</p>
                <p className="text-xs text-slate-500">
                  {task.reward_coins} {t('lumoraCoins')} • {task.filled}/{task.slots} {t('slots')} •
                  <span className={`ml-1 ${statusColor(task.status)}`}>{statusLabel(task.status)}</span>
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => openEdit(task)}>
                  <Edit2 size={14} />
                </Button>
                {task.status === 'open' ? (
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => pauseTask(task)}>
                    <Pause size={14} />
                  </Button>
                ) : task.status === 'paused' ? (
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => resumeTask(task)}>
                    <Play size={14} />
                  </Button>
                ) : null}
                <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteTask(task.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit Task Modal */}
      <Modal open={!!editTask} onClose={() => setEditTask(null)} title={t('editTask')}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('title')}</label>
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('description')}</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('reward')} ({t('lumoraCoins')})</label>
              <input type="number" min={limits.min_task_reward} max={limits.max_task_reward} value={editForm.reward_coins} onChange={(e) => setEditForm({ ...editForm, reward_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
              <p className="text-[10px] text-slate-500 mt-0.5">{limits.min_task_reward} – {limits.max_task_reward}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('slots')}</label>
              <input type="number" min={1} value={editForm.slots} onChange={(e) => setEditForm({ ...editForm, slots: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('settings')}</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
              <option value="open">{t('taskStatusOpen')}</option>
              <option value="paused">{t('taskStatusPaused')}</option>
              <option value="in_progress">{t('taskStatusInProgress')}</option>
              <option value="completed">{t('taskStatusCompleted')}</option>
            </select>
          </div>
          <Button className="w-full" onClick={saveEdit}>{t('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function AiKeysTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [keys, setKeys] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newKey, setNewKey] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [usage, setUsage] = useState<Record<string, { request_count: number; prompt_tokens: number; output_tokens: number; last_used_at: string | null }>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status: string; message: string }>>({});

  const load = async () => {
    const [{ data: settings }, { data: emailRows }, { data: usageRows }] = await Promise.all([
      supabase.from('app_settings').select('gemini_api_keys, ai_active_key_index').eq('id', 1).maybeSingle(),
      supabase.from('gemini_key_emails').select('key_value, email'),
      supabase.from('gemini_key_usage').select('key_value, request_count, prompt_tokens, output_tokens, last_used_at'),
    ]);
    setKeys(Array.isArray(settings?.gemini_api_keys) ? settings.gemini_api_keys : []);
    setActiveIndex(settings?.ai_active_key_index ?? 0);
    setEmails(Object.fromEntries((emailRows ?? []).map((row) => [row.key_value, row.email])));
    setUsage(Object.fromEntries((usageRows ?? []).map((row) => [row.key_value, row])));
  };
  useEffect(() => { load(); }, []);

  const addKey = async () => {
    const key = newKey.trim();
    const email = newEmail.trim();
    if (!key) return;
    const updated = [...keys, key];
    const { error } = await supabase.from('app_settings').update({ gemini_api_keys: updated }).eq('id', 1);
    if (error) { notify(error.message, 'error'); return; }
    if (email) {
      const { error: emailError } = await supabase.from('gemini_key_emails').upsert({ key_value: key, email });
      if (emailError) { notify(emailError.message, 'error'); }
    }
    setNewKey('');
    setNewEmail('');
    notify(t('saved'), 'success');
    load();
  };

  const removeKey = async (idx: number) => {
    const removed = keys[idx];
    const updated = keys.filter((_, i) => i !== idx);
    const newActive = Math.min(activeIndex, updated.length - 1);
    const { error } = await supabase.from('app_settings').update({ gemini_api_keys: updated, ai_active_key_index: Math.max(0, newActive) }).eq('id', 1);
    if (error) { notify(error.message, 'error'); return; }
    await supabase.from('gemini_key_emails').delete().eq('key_value', removed);
    notify('Key removed', 'success');
    load();
  };

  const setActive = async (idx: number) => {
    await supabase.from('app_settings').update({ ai_active_key_index: idx }).eq('id', 1);
    setActiveIndex(idx);
    notify(t('saved'), 'success');
  };

  const openEmailEditor = (key: string) => {
    setEditingKey(key);
    setEditEmail(emails[key] || '');
  };

  const saveEmail = async () => {
    if (!editingKey) return;
    const email = editEmail.trim();
    const { error } = email
      ? await supabase.from('gemini_key_emails').upsert({ key_value: editingKey, email })
      : await supabase.from('gemini_key_emails').delete().eq('key_value', editingKey);
    if (error) { notify(error.message, 'error'); return; }
    notify(t('saved'), 'success');
    setEditingKey(null);
    load();
  };

  const testKey = async (key: string, silent = false): Promise<{ ok: boolean; status: string; message: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-test-key', {
        body: { apiKey: key, messages: [{ role: 'user', content: 'Say hello in one short sentence.' }] },
      });
      if (error || !data) {
        const result = { ok: false, status: 'error', message: 'Connection error' };
        setTestResults((prev) => ({ ...prev, [key]: result }));
        if (!silent) notify(result.message, 'error');
        return result;
      }
      const d = data as any;
      const result = d.ok
        ? { ok: true, status: d.status || 'valid', message: d.message || 'Valid' }
        : { ok: false, status: d.status || 'unknown', message: d.message || 'Failed' };
      setTestResults((prev) => ({ ...prev, [key]: result }));
      if (!silent) {
        notify(result.ok ? 'Key is valid and working' : result.message, result.ok ? 'success' : 'error');
      }
      return result;
    } catch {
      const result = { ok: false, status: 'error', message: 'Connection error' };
      setTestResults((prev) => ({ ...prev, [key]: result }));
      if (!silent) notify(result.message, 'error');
      return result;
    }
  };

  const testSingleKey = async (key: string) => {
    setTestingKey(key);
    setTestResults((prev) => ({ ...prev, [key]: { ok: false, status: 'testing', message: 'Testing...' } }));
    try {
      await testKey(key);
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false, status: 'error', message: 'Connection error' } }));
      notify('Key test connection error', 'error');
    } finally {
      setTestingKey(null);
    }
  };

  const testAllKeys = async () => {
    setTestingAll(true);
    let valid = 0;
    let failed = 0;
    for (const k of keys) {
      setTestResults((prev) => ({ ...prev, [k]: { ok: false, status: 'testing', message: 'Testing...' } }));
      try {
        const result = await testKey(k, true);
        if (result.ok) valid++;
        else failed++;
      } catch {
        setTestResults((prev) => ({ ...prev, [k]: { ok: false, status: 'error', message: 'Connection error' } }));
        failed++;
      }
    }
    setTestingAll(false);
    notify(`${valid} valid, ${failed} failed`, valid > 0 ? 'info' : 'error');
  };

  return (
    <div className="space-y-4">
      <UsageChart />
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Key size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">Gemini API Keys ({keys.length})</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Add multiple Gemini API keys for automatic rotation. When one key hits rate limits, the system switches to the next key instantly.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="AIza..."
            className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
            onKeyDown={(e) => { if (e.key === 'Enter') addKey(); }}
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address for this key"
            className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
            onKeyDown={(e) => { if (e.key === 'Enter') addKey(); }}
          />
          <Button className="flex items-center justify-center gap-1" onClick={addKey}><Plus size={16} /> Add</Button>
        </div>
        {keys.length > 0 && (
          <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-xl border border-white/10">
            <div className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">Auto-rotation:</span> {keys.length} key{keys.length > 1 ? 's' : ''} configured. When the active key fails, the system tries the next one.
            </div>
            <Button
              className="flex items-center gap-1.5 shrink-0 text-xs"
              onClick={testAllKeys}
              disabled={testingAll || testingKey !== null}
            >
              <FlaskConical size={14} /> {testingAll ? 'Testing...' : 'Test All Keys'}
            </Button>
          </div>
        )}
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {keys.length === 0 ? (
            <EmptyState message="No API keys added yet" icon={<Key size={24} />} />
          ) : keys.map((k, i) => {
            const u = usage[k];
            const tr = testResults[k];
            return (
              <div key={i} className={`bg-slate-800/50 border rounded-xl p-3 ${i === activeIndex ? 'border-emerald-500/40' : 'border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-mono truncate">{k.slice(0, 12)}...{k.slice(-4)}</p>
                    <p className="text-xs text-slate-400 truncate">{emails[k] || 'No email set'}</p>
                    {i === activeIndex && <span className="text-[10px] text-emerald-400 font-bold">ACTIVE</span>}
                  </div>
                  {i !== activeIndex && <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => setActive(i)}>Set Active</Button>}
                  <Button variant="ghost" className="text-xs px-2 py-1" aria-label="Test key" disabled={testingKey === k || testingAll} onClick={() => testSingleKey(k)}><FlaskConical size={12} /></Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" aria-label="Edit email" onClick={() => openEmailEditor(k)}><Edit2 size={12} /></Button>
                  <Button variant="danger" className="text-xs px-2 py-1" onClick={() => removeKey(i)}><Trash2 size={12} /></Button>
                </div>
                {tr && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${tr.status === 'testing' ? 'bg-amber-400 animate-pulse' : tr.ok ? 'bg-emerald-400' : tr.status === 'quota_exceeded' || tr.status === 'invalid_key' ? 'bg-red-500' : tr.status === 'rate_limited' ? 'bg-orange-400' : tr.status === 'timeout' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                    <p className={`text-[11px] ${tr.ok ? 'text-emerald-400' : tr.status === 'quota_exceeded' || tr.status === 'invalid_key' ? 'text-red-400' : tr.status === 'rate_limited' || tr.status === 'timeout' ? 'text-orange-400' : 'text-amber-400'}`}>{tr.message}</p>
                  </div>
                )}
                {u && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Activity size={10} /> {u.request_count} requests</span>
                    <span>{(u.prompt_tokens + u.output_tokens).toLocaleString()} tokens</span>
                    <span className="hidden sm:inline">in: {u.prompt_tokens.toLocaleString()}</span>
                    <span className="hidden sm:inline">out: {u.output_tokens.toLocaleString()}</span>
                    {u.last_used_at && <span className="ml-auto">{new Date(u.last_used_at).toLocaleDateString()}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Modal open={editingKey !== null} onClose={() => setEditingKey(null)} title="Key email address">
        <div className="space-y-4">
          <p className="text-xs text-slate-400 font-mono truncate">{editingKey ? `${editingKey.slice(0, 12)}...${editingKey.slice(-4)}` : ''}</p>
          <input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address for this key"
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
            onKeyDown={(e) => { if (e.key === 'Enter') saveEmail(); }}
          />
          <p className="text-[11px] text-slate-500">Leave empty to remove the saved email for this key.</p>
          <Button className="w-full" onClick={saveEmail}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}

function AiPromptTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('app_settings').select('ai_system_prompt').eq('id', 1).maybeSingle();
    setPrompt(data?.ai_system_prompt || '');
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from('app_settings').update({ ai_system_prompt: prompt }).eq('id', 1);
      notify(t('saved'), 'success');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Bot size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">AI System Prompt</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          This instruction controls how the AI chatbot behaves. Edit it to set the persona, rules, and guidelines the bot follows when talking to users.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-amber-500/50 resize-y"
          placeholder="You are Lumora AI..."
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-500">{prompt.length} characters</p>
          <Button className="flex items-center gap-1" onClick={save} disabled={saving}>
            <Send size={14} /> {saving ? 'Saving...' : t('save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SupportChatsTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*, profiles!chat_sessions_user_id_fkey(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(50);
    setSessions(data || []);
  };
  useEffect(() => { load(); }, []);

  const loadMessages = async (sid: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMsgs(false);
    if (sessions.find((s) => s.id === sid)?.status === 'pending_human') {
      await supabase.from('chat_sessions').update({ status: 'resolved' }).eq('id', sid);
      load();
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedSession) return;
    await supabase.from('chat_messages').insert({
      session_id: selectedSession,
      role: 'admin',
      content: reply.trim(),
    });
    setReply('');
    loadMessages(selectedSession);
    notify(t('saved'), 'success');
  };

  useEffect(() => {
    if (!selectedSession) return;
    const channel = supabase
      .channel(`admin_chat:${selectedSession}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${selectedSession}` },
        () => loadMessages(selectedSession)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">Support Chats</h3>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
          {sessions.length === 0 ? <EmptyState message="No support chats yet" /> : sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedSession(s.id); loadMessages(s.id); }}
              className={`w-full text-left bg-slate-800/50 border rounded-xl p-3 transition ${selectedSession === s.id ? 'border-amber-500/50' : 'border-white/10'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-medium truncate">
                  {s.profiles?.full_name || s.profiles?.phone || 'User'}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'pending_human' ? 'bg-amber-500/20 text-amber-300' : s.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">{s.subject || s.title}</p>
            </button>
          ))}
        </div>

        {selectedSession && (
          <div className="border-t border-white/10 pt-4">
            <h4 className="text-sm font-semibold text-white mb-2">Conversation</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {loadingMsgs ? <p className="text-xs text-slate-400 text-center py-4">Loading...</p> : messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-500/20 text-blue-200' : m.role === 'admin' ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-700 text-slate-200'}`}>
                    {m.role !== 'user' && <p className="text-[10px] font-bold mb-1 opacity-70">{m.role}</p>}
                    <p>{m.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type admin reply..."
                className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
              />
              <Button className="flex items-center gap-1" onClick={sendReply}><Send size={14} /> Send</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function AdCampaignsTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('ad_campaigns')
      .select('*, profiles!ad_campaigns_advertiser_id_fkey(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(50);
    setCampaigns(data || []);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await supabase.from('ad_campaigns').update({ status: 'approved' }).eq('id', id);
    notify('Campaign approved', 'success');
    load();
  };

  const reject = async (id: string) => {
    await supabase.from('ad_campaigns').update({ status: 'rejected', admin_note: 'Not compliant' }).eq('id', id);
    notify('Campaign rejected', 'success');
    load();
  };

  const pauseCampaign = async (id: string) => {
    await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', id);
    notify('Campaign paused', 'success');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">Ad Campaigns</h3>
        </div>
        <div className="space-y-3">
          {campaigns.length === 0 ? <EmptyState message="No ad campaigns submitted yet" icon={<Megaphone size={24} />} /> : campaigns.map((c) => (
            <div key={c.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-semibold">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.profiles?.full_name || c.profiles?.phone || 'Advertiser'} | Budget: {c.budget_coins} coins</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  c.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                  c.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                  c.status === 'paused' ? 'bg-amber-500/20 text-amber-300' :
                  c.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-slate-500/20 text-slate-400'
                }`}>{c.status}</span>
              </div>
              {c.description && <p className="text-xs text-slate-400 mb-2">{c.description}</p>}
              {c.target_url && <a href={c.target_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline mb-2 inline-block">{c.target_url}</a>}
              <div className="text-xs text-slate-500 mb-2">Spent: {c.spent_coins}/{c.budget_coins} | Reward/view: {c.reward_per_view}</div>
              {c.status === 'pending' && (
                <div className="flex gap-2">
                  <Button className="text-xs flex items-center gap-1" onClick={() => approve(c.id)}><Check size={12} /> Approve</Button>
                  <Button variant="danger" className="text-xs flex items-center gap-1" onClick={() => reject(c.id)}><X size={12} /> Reject</Button>
                </div>
              )}
              {c.status === 'approved' && (
                <Button variant="ghost" className="text-xs" onClick={() => pauseCampaign(c.id)}>Pause</Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BadgesTab() {
  const { t } = useApp();
  const { notify } = useToast();
  const [badges, setBadges] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('badges').select('*').order('threshold_tasks', { ascending: true });
    setBadges(data || []);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (b: any) => {
    await supabase.from('badges').update({ is_active: !b.is_active }).eq('id', b.id);
    notify(t('saved'), 'success');
    load();
  };

  const deleteBadge = async (id: string) => {
    await supabase.from('badges').delete().eq('id', id);
    notify('Badge deleted', 'success');
    load();
  };

  const tierColors: Record<string, string> = {
    bronze: 'from-amber-700/20 to-amber-600/20 text-amber-400 border-amber-700/30',
    silver: 'from-slate-400/20 to-slate-300/20 text-slate-300 border-slate-400/30',
    gold: 'from-yellow-500/20 to-amber-400/20 text-yellow-300 border-yellow-500/30',
    platinum: 'from-cyan-400/20 to-blue-400/20 text-cyan-300 border-cyan-400/30',
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Award size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white">Badges ({badges.length})</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Badges are awarded automatically based on task completion and coin thresholds. 7 badges are pre-seeded.
        </p>
        <div className="space-y-2">
          {badges.map((b) => (
            <div key={b.id} className={`bg-gradient-to-br border rounded-xl p-3 ${tierColors[b.tier] || tierColors.bronze}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                    <Award size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{b.label}</p>
                    <p className="text-xs opacity-70">{b.description}</p>
                    <p className="text-[10px] opacity-50 mt-1">
                      {b.threshold_tasks > 0 && `${b.threshold_tasks} tasks`}
                      {b.threshold_tasks > 0 && b.threshold_coins > 0 && ' | '}
                      {b.threshold_coins > 0 && `${b.threshold_coins} coins`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => toggleActive(b)}>
                    {b.is_active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteBadge(b.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AiContentTab() {
  const { notify } = useToast();
  const [contentRow, setContentRow] = useState<Record<string, string> | null>(null);
  const [uiCopyRow, setUiCopyRow] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [langView, setLangView] = useState<'bn' | 'en'>('bn');

  const CONTENT_FIELDS: { key: string; labelBn: string; labelEn: string }[] = [
    { key: 'funny_bn', labelBn: 'ফানি কৌতুক (বাংলা)', labelEn: 'Funny Quote (Bangla)' },
    { key: 'funny_en', labelBn: 'ফানি কৌতুক (English)', labelEn: 'Funny Quote (English)' },
    { key: 'tip_bn', labelBn: 'গ্রোথ টিপস (বাংলা)', labelEn: 'Growth Tip (Bangla)' },
    { key: 'tip_en', labelBn: 'গ্রোথ টিপস (English)', labelEn: 'Growth Tip (English)' },
  ];

  const UI_COPY_FIELDS: { key: string; labelBn: string; labelEn: string }[] = [
    { key: 'tasks_header', labelBn: 'টাস্ক হেডার', labelEn: 'Tasks Header' },
    { key: 'loading_tasks', labelBn: 'লোডিং মেসেজ', labelEn: 'Loading Tasks' },
    { key: 'category_empty', labelBn: 'ক্যাটাগরি খালি', labelEn: 'Category Empty' },
    { key: 'your_tasks_first', labelBn: 'আপনার কাজ প্রথমে', labelEn: 'Your Tasks First' },
    { key: 'video_tutorial_header', labelBn: 'ভিডিও টিউটোরিয়াল হেডার', labelEn: 'Video Tutorial Header' },
    { key: 'video_panel_subtitle', labelBn: 'ভিডিও প্যানেল সাবটাইটেল', labelEn: 'Video Panel Subtitle' },
    { key: 'daily_tip', labelBn: 'দৈনিক টিপস', labelEn: 'Daily Tip' },
    { key: 'dashboard_alert', labelBn: 'ড্যাশবোর্ড অ্যালার্ট', labelEn: 'Dashboard Alert' },
    { key: 'task_available', labelBn: 'নতুন কাজ উপলব্ধ', labelEn: 'Task Available' },
    { key: 'watch_tutorial', labelBn: 'টিউটোরিয়াল দেখুন', labelEn: 'Watch Tutorial' },
  ];

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [contentRes, uiCopyRes] = await Promise.all([
      supabase.from('daily_ai_content').select('*').eq('content_date', today).maybeSingle(),
      supabase.from('daily_ai_ui_copy').select('*').eq('content_date', today).maybeSingle(),
    ]);
    if (contentRes.data) setContentRow(contentRes.data as Record<string, string>);
    if (uiCopyRes.data) setUiCopyRow(uiCopyRes.data as Record<string, string>);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const regenerate = async (table: string, field: string) => {
    const key = `${table}.${field}`;
    setRegenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke('ai-regenerate', {
        body: { table, field },
      });
      if (error) {
        console.error('regenerate: invoke error', error);
      }
      const d = data as any;
      if (d?.error) {
        console.error('regenerate: edge function returned error', d.error);
      }
      // Immediately update local state with the returned value for instant UI
      if (d?.newValue) {
        if (table === 'daily_ai_content') {
          setContentRow((prev) => prev ? { ...prev, [field]: d.newValue } : { content_date: new Date().toISOString().split('T')[0], [field]: d.newValue });
        } else {
          setUiCopyRow((prev) => prev ? { ...prev, [field]: d.newValue } : { content_date: new Date().toISOString().split('T')[0], [field]: d.newValue });
        }
      }
      if (d?.fallback) {
        notify(d.warning || 'AI unavailable — saved fallback content', 'warning');
      } else if (d?.newValue) {
        notify('Regenerated successfully', 'success');
      } else {
        notify('Content refreshed', 'success');
      }
      // Invalidate all caches so the rest of the app picks up the new text
      invalidateDailyAiCache();
      invalidateAiCopyCache();
      // Re-read from DB to confirm and sync the actual state
      await load();
    } catch (err) {
      console.error('regenerate: unexpected error', err);
      invalidateDailyAiCache();
      invalidateAiCopyCache();
      await load();
      notify('Content refreshed', 'success');
    } finally {
      setRegenerating(null);
    }
  };

  const regenerateAll = async () => {
    setRegeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-regenerate-all', {
        body: {},
      });
      if (error) {
        console.error('regenerateAll: invoke error', error);
      }
      const d = data as any;
      if (d?.error) {
        console.error('regenerateAll: edge function returned error', d.error);
      }
      // Optimistically update local state with returned values
      if (d?.content) {
        setContentRow((prev) => prev ? { ...prev, ...d.content } : { content_date: new Date().toISOString().split('T')[0], ...d.content });
      }
      if (d?.uiCopy) {
        setUiCopyRow((prev) => prev ? { ...prev, ...d.uiCopy } : { content_date: new Date().toISOString().split('T')[0], ...d.uiCopy });
      }
      if (d?.fallback) {
        notify(d.warning || 'Some content used fallback — AI may be rate limited', 'warning');
      } else if (d?.success) {
        notify('All content regenerated successfully!', 'success');
      } else {
        notify('Content refreshed', 'success');
      }
      // Force a fresh DB re-read to sync the actual state
      await load();
      invalidateDailyAiCache();
      invalidateAiCopyCache();
    } catch (err) {
      console.error('regenerateAll: unexpected error', err);
      await load();
      invalidateDailyAiCache();
      invalidateAiCopyCache();
      notify('Content refreshed', 'success');
    } finally {
      setRegeneratingAll(false);
    }
  };

  const isFieldForLang = (field: string, lang: 'bn' | 'en'): boolean => {
    if (lang === 'bn') return field.endsWith('_bn');
    return field.endsWith('_en');
  };

  const filterFields = (fields: { key: string; labelBn: string; labelEn: string }[], lang: 'bn' | 'en') => {
    return fields.filter((f) => {
      if (f.key.endsWith('_bn') || f.key.endsWith('_en')) {
        return isFieldForLang(f.key, lang);
      }
      return true;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            <h3 className="font-semibold text-white">AI Generated Content Management</h3>
          </div>
          <Button
            className="text-xs px-3 py-2 flex items-center gap-2 shrink-0"
            disabled={regeneratingAll || loading}
            onClick={regenerateAll}
          >
            {regeneratingAll ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {regeneratingAll ? 'Regenerating All...' : 'Regenerate All Contents'}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          View and regenerate today's AI-generated content. Click "Regenerate" on any item for a single refresh, or use "Regenerate All Contents" to refresh everything at once.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setLangView('bn')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${langView === 'bn' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400'}`}
          >
            বাংলা
          </button>
          <button
            onClick={() => setLangView('en')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${langView === 'en' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400'}`}
          >
            English
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading today's content...</p>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-amber-400" />
                <h4 className="text-sm font-semibold text-amber-300">Funny Quote & Growth Tip</h4>
              </div>
              <div className="space-y-2">
                {filterFields(CONTENT_FIELDS, langView).map((f) => {
                  const value = contentRow?.[f.key] || '—';
                  const regenKey = `daily_ai_content.${f.key}`;
                  const isRegenerating = regenerating === regenKey;
                  return (
                    <div key={f.key} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{langView === 'bn' ? f.labelBn : f.labelEn}</p>
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 shrink-0 flex items-center gap-1"
                          disabled={isRegenerating}
                          onClick={() => regenerate('daily_ai_content', f.key)}
                        >
                          {isRegenerating ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                        </Button>
                      </div>
                      <p className="text-sm text-white leading-relaxed">{value}</p>
                    </div>
                  );
                })}
                {!contentRow && (
                  <p className="text-xs text-slate-500 italic">No content generated for today yet. It will auto-generate on first visit.</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-cyan-400" />
                <h4 className="text-sm font-semibold text-cyan-300">Task Alerts &amp; Tutorial Prompts (Bilingual)</h4>
              </div>
              <div className="space-y-2">
                {UI_COPY_FIELDS.map((f) => {
                  const fieldKey = `${f.key}_${langView}`;
                  const value = uiCopyRow?.[fieldKey] || '—';
                  const regenKey = `daily_ai_ui_copy.${fieldKey}`;
                  const isRegenerating = regenerating === regenKey;
                  return (
                    <div key={f.key} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{langView === 'bn' ? f.labelBn : f.labelEn}</p>
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 shrink-0 flex items-center gap-1"
                          disabled={isRegenerating}
                          onClick={() => regenerate('daily_ai_ui_copy', fieldKey)}
                        >
                          {isRegenerating ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                        </Button>
                      </div>
                      <p className="text-sm text-white leading-relaxed">{value}</p>
                    </div>
                  );
                })}
                {!uiCopyRow && (
                  <p className="text-xs text-slate-500 italic">No UI copy generated for today yet. It will auto-generate on first visit.</p>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
