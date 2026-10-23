import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Facebook, Instagram, Youtube, Star, ShieldCheck, Flame, MessageSquare } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow, SubmissionRow, Profile } from '@/lib/supabase';
import { Card, Button, Modal, CoinBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { TaskTimerOverlay } from '@/components/TaskTimerOverlay';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

const platformIcons: Record<string, React.ReactNode> = {
  facebook: <Facebook size={16} className="text-blue-400" />,
  instagram: <Instagram size={16} className="text-pink-400" />,
  youtube: <Youtube size={16} className="text-red-400" />,
  app_review: <Star size={16} className="text-amber-400" />,
  tiktok: <Star size={16} className="text-white" />,
  other: <Star size={16} className="text-slate-400" />,
};

export function Tasks() {
  const { t, profile, refreshProfile } = useApp();
  const { notify } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tab, setTab] = useState<'browse' | 'mine' | 'create'>('browse');
  const [createOpen, setCreateOpen] = useState(false);
  const [proofTask, setProofTask] = useState<TaskRow | null>(null);
  const [chatTask, setChatTask] = useState<TaskRow | null>(null);
  const [timer, setTimer] = useState<{ active: boolean; title: string }>({ active: false, title: '' });
  const [celebrate, setCelebrate] = useState(false);

  const loadTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(50);
    setTasks(data as TaskRow[] || []);
  };

  useEffect(() => { loadTasks(); }, []);

  const myCreated = tasks.filter((tk) => tk.creator_id === profile?.id);
  const browseable = tasks.filter((tk) => tk.creator_id !== profile?.id && tk.status === 'open' && tk.filled < tk.slots);

  const acceptTask = async (task: TaskRow) => {
    if (!profile) return;
    if (profile.lumora_coins < task.cost_coins && !task.is_admin_task) {
      notify(t('notEnoughCoins'), 'error');
      return;
    }
    if (task.is_admin_task) {
      await supabase.from('tasks').update({ status: 'in_progress', filled: task.filled + 1 }).eq('id', task.id);
    } else {
      await supabase.from('tasks').update({ status: 'in_progress', filled: task.filled + 1 }).eq('id', task.id);
    }
    setTimer({ active: true, title: task.title });
    notify(t('taskClaimed'), 'info');
    setProofTask(task);
    await loadTasks();
  };

  const submitProof = async (task: TaskRow, urls: string[], notes: string) => {
    if (urls.length === 0) { notify(t('noProofs'), 'error'); return; }
    await supabase.from('task_submissions').insert({
      task_id: task.id, doer_id: profile!.id, proof_urls: urls, notes, status: 'pending',
    });
    setProofTask(null);
    setTimer({ active: false, title: '' });
    setCelebrate(true);
    notify(t('celebrate'), 'success');
    await loadTasks();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 bg-slate-800/50 rounded-xl p-1">
        {(['browse', 'mine', 'create'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === tb ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>
            {tb === 'browse' ? t('browseTasks') : tb === 'mine' ? t('myTasks') : t('createTask')}
          </button>
        ))}
      </div>

      {tab === 'create' && <CreateTaskForm onDone={() => { setTab('mine'); loadTasks(); }} />}

      {tab === 'browse' && (
        <div className="space-y-3">
          {browseable.length === 0 ? <EmptyState message={t('noTasks')} icon={<Plus size={32} />} /> : browseable.map((task) => (
            <TaskCard key={task.id} task={task} onAccept={() => acceptTask(task)} onChat={() => setChatTask(task)} />
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <div className="space-y-3">
          {myCreated.length === 0 ? <EmptyState message={t('noTasks')} /> : myCreated.map((task) => (
            <TaskCard key={task.id} task={task} isOwner />
          ))}
        </div>
      )}

      {/* Proof modal */}
      <ProofModal task={proofTask} onClose={() => setProofTask(null)} onSubmit={submitProof} />

      {/* Chat modal */}
      <ChatModal task={chatTask} onClose={() => setChatTask(null)} />

      <TaskTimerOverlay active={timer.active} onExpire={() => {}} taskTitle={timer.title} />
      <CelebrationOverlay show={celebrate} onClose={() => setCelebrate(false)} title={t('celebrate')} />
    </div>
  );
}

function TaskCard({ task, onAccept, onChat, isOwner }: { task: TaskRow; onAccept?: () => void; onChat?: () => void; isOwner?: boolean }) {
  const { t } = useApp();
  const effectiveReward = task.is_admin_task ? task.reward_coins * 2 : task.reward_coins;
  return (
    <motion.div layout whileHover={{ y: -2 }} className="bg-slate-800/50 border border-white/10 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {platformIcons[task.platform]}
          <h3 className="font-semibold text-white text-sm">{task.title}</h3>
        </div>
        {task.is_admin_task && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
            <Flame size={10} /> {t('adminTask')}
          </span>
        )}
      </div>
      {task.description && <p className="text-slate-400 text-xs mb-3 line-clamp-2">{task.description}</p>}
      {task.target_url && <a href={task.target_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline mb-3 inline-block">{task.target_url}</a>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {task.is_admin_task ? (
            <>
              <CoinBadge amount={effectiveReward} />
              <span className="text-[10px] text-amber-300 font-bold">2x</span>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-400">{t('cost')}: <CoinBadge amount={task.cost_coins} /></span>
              <span className="text-xs text-slate-400">{t('reward')}: <CoinBadge amount={task.reward_coins} /></span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {onChat && <Button variant="ghost" className="text-sm py-1.5 px-2" onClick={onChat}><MessageSquare size={16} /></Button>}
          {onAccept && !isOwner && <Button className="text-sm py-1.5" onClick={onAccept}>{t('accept')}</Button>}
        </div>
      </div>
    </motion.div>
  );
}

function CreateTaskForm({ onDone }: { onDone: () => void }) {
  const { t, profile, refreshProfile } = useApp();
  const { notify } = useToast();
  const [form, setForm] = useState({ platform: 'facebook', title: '', description: '', target_url: '', reward: 25, slots: 1 });
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const [limits, setLimits] = useState({ min_task_reward: 10, max_task_reward: 10000 });

  useEffect(() => {
    (async () => {
      const [catRes, settingsRes] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('app_settings').select('min_task_reward, max_task_reward').eq('id', 1).maybeSingle(),
      ]);
      if (catRes.data && catRes.data.length > 0) setCategories(catRes.data);
      else setCategories([{ name: 'facebook', label: 'Facebook' }, { name: 'instagram', label: 'Instagram' }, { name: 'youtube', label: 'YouTube' }, { name: 'app_review', label: 'App Review' }, { name: 'tiktok', label: 'TikTok' }, { name: 'other', label: 'Other' }]);
      if (settingsRes.data) setLimits(settingsRes.data);
    })();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const cost = isAdmin ? 0 : form.reward;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (form.reward < limits.min_task_reward) { notify(t('rewardTooLow'), 'error'); return; }
    if (form.reward > limits.max_task_reward) { notify(t('rewardTooHigh'), 'error'); return; }
    if (!isAdmin && profile.lumora_coins < cost) { notify(t('notEnoughCoins'), 'error'); return; }
    setBusy(true);
    try {
      await supabase.from('tasks').insert({
        creator_id: profile.id, platform: form.platform, title: form.title, description: form.description,
        target_url: form.target_url || null, reward_coins: form.reward, cost_coins: cost,
        is_admin_task: isAdmin, slots: form.slots,
      });
      if (!isAdmin) {
        await supabase.from('profiles').update({ lumora_coins: profile.lumora_coins - cost }).eq('id', profile.id);
        await supabase.from('transactions').insert({ user_id: profile.id, type: 'task_spend', amount: -cost, status: 'completed', note: `Created: ${form.title}` });
        await refreshProfile();
      }
      notify(t('submitted'), 'success');
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('platform')}</label>
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            {categories.map((cat) => <option key={cat.name} value={cat.name}>{cat.label}</option>)}
          </select>
        </div>
        <Input label={t('title')} value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <Input label={t('description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Input label={t('targetUrl')} value={form.target_url} onChange={(v) => setForm({ ...form, target_url: v })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('reward')} ({limits.min_task_reward}–{limits.max_task_reward})</label>
            <input type="number" min={limits.min_task_reward} max={limits.max_task_reward} value={form.reward} onChange={(e) => setForm({ ...form, reward: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('slots')}</label>
            <input type="number" min={1} value={form.slots} onChange={(e) => setForm({ ...form, slots: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>
        {isAdmin && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-xs text-amber-300 flex items-center gap-2"><ShieldCheck size={14} /> {t('freeTask')} + {t('doubleReward')}</div>}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{t('cost')}: <CoinBadge amount={cost} /></span>
          <Button type="submit" disabled={busy}>{busy ? '...' : t('submit')}</Button>
        </div>
      </form>
    </Card>
  );
}

function ProofModal({ task, onClose, onSubmit }: { task: TaskRow | null; onClose: () => void; onSubmit: (task: TaskRow, urls: string[], notes: string) => void }) {
  const { t } = useApp();
  const [urls, setUrls] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');

  useEffect(() => { if (task) { setUrls(['']); setNotes(''); } }, [task]);

  return (
    <Modal open={!!task} onClose={onClose} title={t('submitProof')}>
      <div className="space-y-3">
        {urls.map((u, i) => (
          <Input key={i} label={`${t('screenshots')} ${i + 1}`} value={u} onChange={(v) => setUrls(urls.map((x, j) => j === i ? v : x))} />
        ))}
        <Button variant="ghost" className="text-sm" onClick={() => setUrls([...urls, ''])}>+ {t('addScreenshot')}</Button>
        <Input label={t('taskNotes')} value={notes} onChange={setNotes} />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
          <Button className="flex-1" onClick={() => task && onSubmit(task, urls.filter((u) => u.trim()), notes)}>{t('submit')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ChatModal({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const { t, profile } = useApp();
  const [msgs, setMsgs] = useState<{ id: string; sender_id: string; body: string; created_at: string }[]>([]);
  const [text, setText] = useState('');
  const [otherId, setOtherId] = useState<string | null>(null);

  useEffect(() => {
    if (!task || !profile) return;
    const oid = task.creator_id === profile.id ? null : task.creator_id;
    setOtherId(oid);
    const load = async () => {
      const { data } = await supabase.from('messages').select('*').eq('task_id', task.id).order('created_at', { ascending: true });
      setMsgs(data || []);
    };
    load();
    const ch = supabase.channel('chat_' + task.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${task.id}` }, (payload) => {
      setMsgs((prev) => [...prev, payload.new as any]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [task, profile]);

  const send = async () => {
    if (!text.trim() || !task || !profile || !otherId) return;
    await supabase.from('messages').insert({ task_id: task.id, sender_id: profile.id, receiver_id: otherId, body: text });
    setText('');
  };

  if (!task) return null;

  return (
    <Modal open={!!task} onClose={onClose} title={`${task.title}`}>
      <div className="h-64 overflow-y-auto space-y-2 mb-3 bg-slate-900/50 rounded-xl p-3">
        {msgs.length === 0 ? <EmptyState message={t('noMessages')} /> : msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.sender_id === profile?.id ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-200'}`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('typeMessage')} className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        <Button onClick={send}>{t('send')}</Button>
      </div>
    </Modal>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50" />
    </div>
  );
}
