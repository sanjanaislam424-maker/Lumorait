import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, DollarSign, Gavel, Settings, Bell, BarChart3, Check, X, Ticket, FileWarning, Search, Lock, UserCog, ListChecks, Pause, Play, Trash2, Edit2, Plus } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, Profile, TxRow } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';

type AdminTab = 'overview' | 'users' | 'staff' | 'verifications' | 'finance' | 'disputes' | 'settings' | 'broadcast' | 'promo' | 'appeals' | 'tasks';

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
  ];

  const visibleTabs = tabs.filter((tb) => hasPermission(profile, TAB_PERMISSIONS[tb.key]));

  const activeTab = visibleTabs.some((tb) => tb.key === tab) ? tab : 'overview';

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ShieldCheck className="text-amber-400" size={24} /> {t('adminPanel')}
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
  const { t } = useApp();
  const { notify } = useToast();
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
      setS(data);
    })();
  }, []);

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
  const [newCat, setNewCat] = useState({ name: '', label: '', icon: 'other', icon_url: '' });
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

  const addCategory = async () => {
    if (!newCat.name.trim() || !newCat.label.trim() || !profile) return;
    const { error } = await supabase.from('task_categories').insert({
      name: newCat.name.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newCat.label.trim(),
      icon: newCat.icon,
      icon_url: newCat.icon_url.trim() || null,
      sort_order: categories.length + 1,
      created_by: profile.id,
    });
    if (error) { notify(error.message, 'error'); return; }
    notify(t('saved'), 'success');
    setNewCat({ name: '', label: '', icon: 'other', icon_url: '' });
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
            <div key={cat.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {cat.icon_url ? (
                  <img src={cat.icon_url} alt={cat.label} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{cat.label}</p>
                  <p className="text-xs text-slate-500 truncate">{cat.name} {!cat.is_active && ' • INACTIVE'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => toggleCategory(cat)}>
                  {cat.is_active ? <Pause size={14} /> : <Play size={14} />}
                </Button>
                <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteCategory(cat.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
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
            <label className="text-xs text-slate-400 block mb-1">{t('categoryIconUrl')}</label>
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
