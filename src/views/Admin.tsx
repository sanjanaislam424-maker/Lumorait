import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, DollarSign, Gavel, Settings, Bell, BarChart3, Check, X, Ticket } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, Profile, TxRow } from '@/lib/supabase';
import { Card, Button, Modal, CoinBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';

type AdminTab = 'overview' | 'users' | 'verifications' | 'finance' | 'disputes' | 'settings' | 'broadcast' | 'promo';

export function Admin() {
  const { t, profile } = useApp();
  const [tab, setTab] = useState<AdminTab>('overview');

  if (profile?.role !== 'admin') {
    return <div className="text-center py-20 text-slate-400">{t('adminOnly')}</div>;
  }

  const tabs: { key: AdminTab; icon: React.ReactNode; label: string }[] = [
    { key: 'overview', icon: <BarChart3 size={16} />, label: 'Overview' },
    { key: 'users', icon: <Users size={16} />, label: t('users') },
    { key: 'verifications', icon: <ShieldCheck size={16} />, label: t('verifications') },
    { key: 'finance', icon: <DollarSign size={16} />, label: t('finance') },
    { key: 'disputes', icon: <Gavel size={16} />, label: t('disputes') },
    { key: 'settings', icon: <Settings size={16} />, label: t('settings') },
    { key: 'broadcast', icon: <Bell size={16} />, label: t('broadcast') },
    { key: 'promo', icon: <Ticket size={16} />, label: t('promoManager') },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ShieldCheck className="text-amber-400" size={24} /> {t('admin')}
      </h2>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${tab === tb.key ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'verifications' && <VerificationsTab />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'broadcast' && <BroadcastTab />}
      {tab === 'promo' && <PromoCodesTab />}
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

function UsersTab() {
  const { t, refreshProfile } = useApp();
  const { notify } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [newBalance, setNewBalance] = useState(0);

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    setUsers(data as Profile[] || []);
  };
  useEffect(() => { load(); }, []);

  const toggleBan = async (u: Profile) => {
    await supabase.from('profiles').update({ banned: !u.banned }).eq('id', u.id);
    notify(u.banned ? 'Unbanned' : 'Banned', 'success');
    load();
  };

  const setRole = async (u: Profile, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', u.id);
    notify('Role updated', 'success');
    load();
  };

  const saveBalance = async () => {
    if (!editUser) return;
    await supabase.from('profiles').update({ lumora_coins: newBalance }).eq('id', editUser.id);
    await supabase.from('transactions').insert({ user_id: editUser.id, type: 'admin_adjust', amount: newBalance - editUser.lumora_coins, status: 'completed', note: 'Admin balance adjustment' });
    notify(t('saved'), 'success');
    setEditUser(null);
    load();
    refreshProfile();
  };

  return (
    <div className="space-y-2">
      {users.length === 0 ? <EmptyState message={t('users')} /> : users.map((u) => (
        <div key={u.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{u.full_name || u.phone || 'User'}</p>
            <p className="text-xs text-slate-500">{u.role} • {u.lumora_coins} {t('lumoraCoins')} {u.banned && '• BANNED'}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => { setEditUser(u); setNewBalance(u.lumora_coins); }}>{t('adjustCoins')}</Button>
            <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}>{t('setRole')}</Button>
            <Button variant={u.banned ? 'ghost' : 'danger'} className="text-xs px-2 py-1" onClick={() => toggleBan(u)}>{u.banned ? 'Unban' : t('ban')}</Button>
          </div>
        </div>
      ))}

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={t('adjustCoins')}>
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Current: {editUser?.lumora_coins} {t('lumoraCoins')}</p>
          <input type="number" value={newBalance} onChange={(e) => setNewBalance(+e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          <Button className="w-full" onClick={saveBalance}>{t('save')}</Button>
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
    notify(status === 'approved' ? t('approved') : t('rejected'), 'success');
    load();
  };

  return (
    <div className="space-y-2">
      {reqs.length === 0 ? <EmptyState message={t('verifications')} /> : reqs.map((r) => (
        <div key={r.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-white">{r.profiles?.full_name || r.profiles?.phone || 'User'}</p>
              <p className="text-xs text-slate-500">{r.id_type}: {r.id_number}</p>
            </div>
            <div className="flex gap-1">
              <Button className="text-xs px-2 py-1" onClick={() => act(r.id, 'approved')}><Check size={14} /></Button>
              <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(r.id, 'rejected')}><X size={14} /></Button>
            </div>
          </div>
          {r.document_url && <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline">View document</a>}
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

  const act = async (tx: TxRow, status: string) => {
    await supabase.from('transactions').update({ status }).eq('id', tx.id);
    if (status === 'approved') {
      const delta = tx.type === 'withdrawal' ? tx.amount : tx.amount;
      const { data: prof } = await supabase.from('profiles').select('lumora_coins').eq('id', tx.user_id).maybeSingle();
      if (prof) {
        const newBal = tx.type === 'withdrawal' ? Math.max(0, prof.lumora_coins + tx.amount) : prof.lumora_coins + tx.amount;
        await supabase.from('profiles').update({ lumora_coins: newBal }).eq('id', tx.user_id);
      }
    }
    notify(status === 'approved' ? t('approved') : t('rejected'), 'success');
    load();
  };

  return (
    <div className="space-y-2">
      {txs.length === 0 ? <EmptyState message={t('finance')} /> : txs.map((tx) => (
        <div key={tx.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-white capitalize">{tx.type} • {tx.method}</p>
            <p className="text-xs text-slate-500">{tx.note}</p>
          </div>
          <div className="flex items-center gap-2">
            <CoinBadge amount={Math.abs(tx.amount)} />
            <Button className="text-xs px-2 py-1" onClick={() => act(tx, 'approved')}><Check size={14} /></Button>
            <Button variant="danger" className="text-xs px-2 py-1" onClick={() => act(tx, 'rejected')}><X size={14} /></Button>
          </div>
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
  const [form, setForm] = useState({ code: '', coin_value: 100, max_uses: 1 });

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
    });
    if (error) {
      notify(error.message.includes('duplicate') ? 'Code already exists' : error.message, 'error');
      return;
    }
    notify(t('saved'), 'success');
    setForm({ code: '', coin_value: 100, max_uses: 1 });
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
