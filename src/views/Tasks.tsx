import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Facebook, Instagram, Youtube, Star, ShieldCheck, Flame, MessageSquare, LayoutGrid, ArrowLeft, Edit2, PlayCircle, Zap, ZapOff, Lock, Calendar, TrendingUp } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow, Profile } from '@/lib/supabase';
import { Card, Button, Modal, CoinBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { TaskTimerOverlay } from '@/components/TaskTimerOverlay';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { microcopy } from '@/lib/microcopy';

const platformIcons: Record<string, React.ReactNode> = {
  facebook: <Facebook size={16} className="text-blue-400" />,
  instagram: <Instagram size={16} className="text-pink-400" />,
  youtube: <Youtube size={16} className="text-red-400" />,
  app_review: <Star size={16} className="text-amber-400" />,
  tiktok: <Star size={16} className="text-white" />,
  other: <Star size={16} className="text-slate-400" />,
};

function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.includes('/embed/')) return url;
    }
    return url;
  } catch {
    return null;
  }
}

function isPromotionActive(task: TaskRow | null | undefined): boolean {
  if (!task || !task.is_promoted) return false;
  if (!task.promotion_expires_at) return true;
  return new Date(task.promotion_expires_at).getTime() > Date.now();
}

function isLongTermTier(tier: { duration_days: number } | null | undefined): boolean {
  if (!tier) return false;
  return tier.duration_days === 0 || tier.duration_days > 7;
}

function oneDayTierCost(tiers: { duration_days?: number; free_cost?: number; pro_cost?: number; vip_cost?: number; coin_cost?: number }[], ut: 'free' | 'pro' | 'vip'): number {
  const oneDay = tiers.find((t) => t.duration_days === 1);
  if (oneDay) return tierCost(oneDay, ut);
  return 0;
}

function isBoostLocked(task: TaskRow | null | undefined): boolean {
  if (!task || !task.promotion_locked_until) return false;
  return new Date(task.promotion_locked_until).getTime() > Date.now();
}

function userTier(profile: Profile | null): 'free' | 'pro' | 'vip' {
  const tier = profile?.membership_tier || 'free';
  if (tier === 'vip') return 'vip';
  if (tier === 'pro') return 'pro';
  return 'free';
}

function tierCost(tier: { free_cost?: number; pro_cost?: number; vip_cost?: number; coin_cost?: number }, ut: 'free' | 'pro' | 'vip'): number {
  if (ut === 'vip' && tier.vip_cost != null) return tier.vip_cost;
  if (ut === 'pro' && tier.pro_cost != null) return tier.pro_cost;
  if (tier.free_cost != null) return tier.free_cost;
  return tier.coin_cost || 0;
}

function tierBadgeClass(tier: string | null | undefined): string {
  if (tier === 'vip') return 'bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-200 border-amber-500/30';
  if (tier === 'pro') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30';
}

function tierLabel(t: (k: any) => string, tier: string | null | undefined): string {
  if (tier === 'vip') return t('tierVip');
  if (tier === 'pro') return t('tierPro');
  return t('tierFree');
}

export function Tasks() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tab, setTab] = useState<'browse' | 'mine' | 'create'>('browse');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryData, setActiveCategoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofTask, setProofTask] = useState<TaskRow | null>(null);
  const [chatTask, setChatTask] = useState<TaskRow | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [timer, setTimer] = useState<{ active: boolean; title: string }>({ active: false, title: '' });
  const [celebrate, setCelebrate] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) { notify(microcopy.errorGeneric(), 'error'); return; }
      setTasks((data as TaskRow[]) || []);
    } finally { setLoading(false); }
  };

  const loadCategories = async () => {
    const { data } = await supabase.from('task_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    setCategories(data || []);
  };

  useEffect(() => { loadTasks(); loadCategories(); }, []);

  const myCreated = (tasks || []).filter((tk) => tk && tk.creator_id === profile?.id);
  const browseable = (tasks || []).filter((tk) => tk && tk.creator_id !== profile?.id && tk.status === 'open' && tk.filled < tk.slots);

  const categoryCounts = (catName: string) => browseable.filter((tk) => tk.platform === catName).length;

  const openCategory = (catName: string) => {
    setActiveCategory(catName);
    const catData = categories.find((c) => c.name === catName) || null;
    setActiveCategoryData(catData);
  };

  const closeCategory = () => {
    setActiveCategory(null);
    setActiveCategoryData(null);
  };

  const acceptTask = async (task: TaskRow) => {
    if (!profile) return;
    if (profile.lumora_coins < task.cost_coins && !task.is_admin_task) {
      notify(t('notEnoughCoins'), 'error');
      return;
    }
    await supabase.from('tasks').update({ status: 'in_progress', filled: task.filled + 1 }).eq('id', task.id);
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

  const saveEdit = async (updated: TaskRow) => {
    await supabase.from('tasks').update({
      title: updated.title,
      description: updated.description,
      target_url: updated.target_url,
      reward_coins: updated.reward_coins,
      slots: updated.slots,
    }).eq('id', updated.id);
    notify(microcopy.taskEditSuccess(), 'success');
    setEditTask(null);
    await loadTasks();
  };

  if (tab === 'browse' && activeCategory) {
    return (
      <>
        <CategoryPage
          categoryName={activeCategory}
          categoryData={activeCategoryData}
          tasks={tasks}
          profile={profile}
          loading={loading}
          onBack={closeCategory}
          onAccept={acceptTask}
          onChat={(task) => setChatTask(task)}
          onEdit={(task) => setEditTask(task)}
          t={t}
        />
        <ProofModal task={proofTask} onClose={() => setProofTask(null)} onSubmit={submitProof} />
        <ChatModal task={chatTask} onClose={() => setChatTask(null)} />
        <EditTaskModal task={editTask} onClose={() => setEditTask(null)} onSave={saveEdit} />
        <TaskTimerOverlay active={timer.active} onExpire={() => {}} taskTitle={timer.title} />
        <CelebrationOverlay show={celebrate} onClose={() => setCelebrate(false)} title={t('celebrate')} />
      </>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 bg-slate-800/50 rounded-xl p-1">
        {(['browse', 'mine', 'create'] as const).map((tb) => (
          <button key={tb} onClick={() => { setTab(tb); closeCategory(); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === tb ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>
            {tb === 'browse' ? t('browseTasks') : tb === 'mine' ? t('myTasks') : t('createTask')}
          </button>
        ))}
      </div>

      {tab === 'create' && <CreateTaskForm onDone={() => { setTab('mine'); loadTasks(); }} />}

      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-sm font-semibold text-amber-300">{microcopy.tasksHeader()}</p>
          </div>

          {loading && (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400 animate-pulse">{microcopy.loadingTasks()}</p>
            </div>
          )}

          {!loading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => { setActiveCategory(null); setActiveCategoryData(null); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition ${activeCategory === null ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-800/50 border-white/10'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <LayoutGrid size={24} className="text-amber-400" />
                  </div>
                  <p className="text-xs text-white font-medium">{t('allCategories')}</p>
                  <p className="text-[10px] text-slate-400">{browseable.length} {t('tasksCounter')}</p>
                </button>
                {categories.map((cat) => {
                  const count = categoryCounts(cat.name);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => openCategory(cat.name)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition ${activeCategory === cat.name ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-800/50 border-white/10'}`}
                    >
                      {cat.icon_url ? (
                        <img src={cat.icon_url} alt={cat.label} className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
                          {platformIcons[cat.icon] || platformIcons.other}
                        </div>
                      )}
                      <p className="text-xs text-white font-medium text-center truncate w-full">{cat.label}</p>
                      <p className="text-[10px] text-slate-400">{microcopy.tasksCounter(count)}</p>
                    </button>
                  );
                })}
              </div>

              {activeCategory === null && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-400 font-semibold">{microcopy.yourTasksFirst()}</p>
                  {browseable.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-400">{microcopy.categoryEmpty()}</p>
                    </div>
                  ) : browseable.map((task) => (
                    <TaskCard key={task.id} task={task} onAccept={() => acceptTask(task)} onChat={() => setChatTask(task)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="space-y-3">
          {myCreated.length === 0 ? <EmptyState message={t('noTasks')} /> : myCreated.map((task) => (
            <TaskCard key={task.id} task={task} isOwner onEdit={() => setEditTask(task)} />
          ))}
        </div>
      )}

      <ProofModal task={proofTask} onClose={() => setProofTask(null)} onSubmit={submitProof} />
      <ChatModal task={chatTask} onClose={() => setChatTask(null)} />
      <EditTaskModal task={editTask} onClose={() => setEditTask(null)} onSave={saveEdit} />
      <TaskTimerOverlay active={timer.active} onExpire={() => {}} taskTitle={timer.title} />
      <CelebrationOverlay show={celebrate} onClose={() => setCelebrate(false)} title={t('celebrate')} />
    </div>
  );
}

function CategoryPage({
  categoryName, categoryData, tasks, profile, loading, onBack, onAccept, onChat, onEdit, t,
}: {
  categoryName: string;
  categoryData: any;
  tasks: TaskRow[];
  profile: Profile | null;
  loading: boolean;
  onBack: () => void;
  onAccept: (task: TaskRow) => void;
  onChat: (task: TaskRow) => void;
  onEdit: (task: TaskRow) => void;
  t: (key: any) => string;
}) {
  const embedUrl = toEmbedUrl(categoryData?.video_tutorial_url || '');

  const categoryTasks = (tasks || []).filter((tk) => tk && tk.platform === categoryName && (tk.status === 'open' || tk.creator_id === profile?.id) && tk.filled < tk.slots);

  // 3-tier smart sorting:
  // Priority 1: User's own tasks
  // Priority 2: Actively promoted tasks (sorted by promotion weight, then reward)
  // Priority 3: Remaining regular tasks (sorted by highest reward)
  const myTasks = categoryTasks.filter((tk) => tk.creator_id === profile?.id);

  const othersAll = categoryTasks.filter((tk) => tk.creator_id !== profile?.id);
  const promotedTasks = othersAll
    .filter((tk) => isPromotionActive(tk))
    .sort((a, b) => (b.promotion_weight || 0) - (a.promotion_weight || 0) || b.reward_coins - a.reward_coins);
  const regularTasks = othersAll
    .filter((tk) => !isPromotionActive(tk))
    .sort((a, b) => b.reward_coins - a.reward_coins);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition">
        <ArrowLeft size={16} /> {t('backToList')}
      </button>

      <div className="flex items-center gap-3">
        {categoryData?.icon_url ? (
          <img src={categoryData.icon_url} alt={categoryData.label} className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
            {platformIcons[categoryName] || platformIcons.other}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-white">{categoryData?.label || categoryName}</h2>
          <p className="text-xs text-slate-400">{microcopy.tasksCounter(categoryTasks.length)}</p>
        </div>
      </div>

      {/* Video Tutorial Panel — always visible */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden border border-amber-500/20 bg-slate-800/50"
      >
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10">
          <PlayCircle size={18} className="text-amber-400" />
          <p className="text-sm font-semibold text-amber-300">{t('howToComplete')}</p>
        </div>

        {embedUrl ? (
          <>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                title="Video Tutorial"
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="px-4 py-2.5 bg-slate-900/30 border-t border-amber-500/10">
              <p className="text-sm font-medium text-amber-200 leading-relaxed">
                🎥 এই ভিডিও টিউটোরিয়াল দেখে কাজ কীভাবে করতে হয়, তা ভালোমতো বুঝে নাও তুমি! 😌
              </p>
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center text-center px-6 py-10 bg-slate-900/30 border-t border-amber-500/10"
            style={{ minHeight: '180px' }}
          >
            <PlayCircle size={40} className="text-amber-400/40 mb-3" />
            <p className="text-sm font-medium text-amber-200 leading-relaxed">
              🎬 আরে তুমি তো দেখি একদম আগে চলে এলে! — ভিডিওর মধ্যে বসো 😅, খুব শীঘ্রই এখানে টিউটোরিয়াল ভিডিও দেখতে পাবে!
            </p>
          </div>
        )}
      </motion.div>

      {loading && (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400 animate-pulse">{microcopy.loadingTasks()}</p>
        </div>
      )}

      {!loading && categoryTasks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">{microcopy.categoryEmpty()}</p>
        </div>
      )}

      {/* Priority 1: User's own tasks */}
      {!loading && myTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              {microcopy.yourTasksFirst()}
            </span>
          </div>
          {myTasks.map((task) => (
            <TaskCard key={task.id} task={task} isOwner onEdit={() => onEdit(task)} />
          ))}
        </div>
      )}

      {/* Priority 2: Promoted tasks */}
      {!loading && promotedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-fuchsia-400" />
            <span className="text-xs font-bold text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full px-3 py-1">
              {t('promotedTasks')}
            </span>
          </div>
          {promotedTasks.map((task) => (
            <TaskCard key={task.id} task={task} isPromoted onAccept={() => onAccept(task)} onChat={() => onChat(task)} />
          ))}
        </div>
      )}

      {/* Priority 3: Regular tasks */}
      {!loading && regularTasks.length > 0 && (
        <div className="space-y-3">
          {(myTasks.length > 0 || promotedTasks.length > 0) && (
            <p className="text-xs text-slate-500 font-medium pt-2">{t('otherTasks')}</p>
          )}
          {regularTasks.map((task) => (
            <TaskCard key={task.id} task={task} onAccept={() => onAccept(task)} onChat={() => onChat(task)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onAccept, onChat, isOwner, isPromoted, onEdit }: { task: TaskRow; onAccept?: () => void; onChat?: () => void; isOwner?: boolean; isPromoted?: boolean; onEdit?: () => void }) {
  const { t } = useApp();
  const effectiveReward = task.is_admin_task ? task.reward_coins * 2 : task.reward_coins;
  return (
    <motion.div layout whileHover={{ y: -2 }} className={`bg-slate-800/50 border rounded-2xl p-4 ${isOwner ? 'border-amber-500/40' : isPromoted ? 'border-fuchsia-500/40' : 'border-white/10'} ${isPromoted ? 'shadow-lg shadow-fuchsia-500/10' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {platformIcons[task.platform]}
          <h3 className="font-semibold text-white text-sm">{task.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.is_admin_task && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              <Flame size={10} /> {t('adminTask')}
            </span>
          )}
          {isPromoted && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${tierBadgeClass(task.promotion_tier)}`}>
              <Zap size={10} /> {t('boosted')} {tierLabel(t, task.promotion_tier)}
            </span>
          )}
          {isOwner && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              {t('yourTasksFirst')}
            </span>
          )}
        </div>
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
          {isOwner && onEdit && (
            <Button variant="ghost" className="text-sm py-1.5 px-2.5 flex items-center gap-1 text-amber-400 border border-amber-500/30" onClick={onEdit}>
              <Edit2 size={14} /> {t('editTaskInline')}
            </Button>
          )}
          {onChat && <Button variant="ghost" className="text-sm py-1.5 px-2" onClick={onChat}><MessageSquare size={16} /></Button>}
          {onAccept && !isOwner && <Button className="text-sm py-1.5" onClick={onAccept}>{t('accept')}</Button>}
        </div>
      </div>
    </motion.div>
  );
}

function EditTaskModal({ task, onClose, onSave }: { task: TaskRow | null; onClose: () => void; onSave: (task: TaskRow) => void }) {
  const { t, profile, refreshProfile } = useApp();
  const { notify } = useToast();
  const [form, setForm] = useState({ title: '', description: '', target_url: '', reward_coins: 10, slots: 1 });
  const [promotionTiers, setPromotionTiers] = useState<{ duration_days: number; label: string; free_cost?: number; pro_cost?: number; vip_cost?: number; coin_cost?: number; daily_rate?: number; daily_rate_after_lock?: number; daily_rate_after_lock_free?: number; daily_rate_after_lock_pro?: number; daily_rate_after_lock_vip?: number }[]>([]);
  const [selectedTier, setSelectedTier] = useState<number>(-1);
  const [promoEndDate, setPromoEndDate] = useState<string>('');
  const [promoBusy, setPromoBusy] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        target_url: task.target_url || '',
        reward_coins: task.reward_coins,
        slots: task.slots,
      });
      setSelectedTier(-1);
      setPromoEndDate('');
    }
  }, [task]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('promotion_tiers').eq('id', 1).maybeSingle();
      if (data?.promotion_tiers && Array.isArray(data.promotion_tiers)) {
        setPromotionTiers(data.promotion_tiers);
      }
    })();
  }, []);

  const ut = userTier(profile);
  const selectedTierObj = selectedTier >= 0 ? promotionTiers[selectedTier] : null;
  const longTerm = isLongTermTier(selectedTierObj);
  const promoCost = selectedTier >= 0 ? tierCost(promotionTiers[selectedTier] || {}, ut) : 0;
  const phase1Rate = oneDayTierCost(promotionTiers, ut);
  const phase2Rate = selectedTier >= 0 ? (ut === 'vip' ? (promotionTiers[selectedTier]?.daily_rate_after_lock_vip ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0) : ut === 'pro' ? (promotionTiers[selectedTier]?.daily_rate_after_lock_pro ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0) : (promotionTiers[selectedTier]?.daily_rate_after_lock_free ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0)) : 0;
  const currentlyPromoted = isPromotionActive(task);

  const handleSave = () => {
    if (!task) return;
    onSave({
      ...task,
      title: form.title,
      description: form.description,
      target_url: form.target_url || null,
      reward_coins: form.reward_coins,
      slots: form.slots,
    });
  };

  const applyPromotion = async () => {
    if (!task || !profile || selectedTier < 0) return;
    if (!longTerm && profile.lumora_coins < promoCost) {
      notify(microcopy.notEnoughPromoCoins(), 'error');
      return;
    }
    setPromoBusy(true);
    try {
      const tier = promotionTiers[selectedTier];
      const now = new Date();
      const lt = isLongTermTier(tier);
      const expiry = lt
        ? (promoEndDate ? new Date(promoEndDate).toISOString() : null)
        : (tier.duration_days === 0 ? null : new Date(now.getTime() + tier.duration_days * 86400000).toISOString());
      const lockedUntil = lt ? new Date(now.getTime() + 8 * 86400000).toISOString() : null;
      const phase1 = lt ? phase1Rate : 0;
      const upfrontCost = lt ? 0 : promoCost;
      const newWeight = (task.promotion_weight || 0) + (lt ? phase1 : promoCost);
      await supabase.from('tasks').update({
        is_promoted: true,
        promotion_coins: (task.promotion_coins || 0) + upfrontCost,
        promotion_expires_at: expiry,
        promotion_weight: newWeight,
        promotion_tier: ut,
        promotion_started_at: now.toISOString(),
        promotion_locked_until: lockedUntil,
        promotion_daily_rate: phase1 || null,
        promotion_end_at: expiry,
        promotion_last_charged_at: lt ? now.toISOString() : null,
      }).eq('id', task.id);
      if (!lt && upfrontCost > 0) {
        await supabase.from('profiles').update({ lumora_coins: profile.lumora_coins - upfrontCost }).eq('id', profile.id);
        await supabase.from('transactions').insert({ user_id: profile.id, type: 'task_spend', amount: -upfrontCost, status: 'completed', note: `Boosted: ${task.title}` });
        await refreshProfile();
      }
      notify(microcopy.promotionSuccess(), 'success');
      onSave({ ...task, is_promoted: true, promotion_coins: (task.promotion_coins || 0) + upfrontCost, promotion_expires_at: expiry, promotion_weight: newWeight, promotion_tier: ut, promotion_started_at: now.toISOString(), promotion_locked_until: lockedUntil, promotion_daily_rate: phase1 || null, promotion_end_at: expiry });
    } finally { setPromoBusy(false); }
  };

  const cancelBoost = async () => {
    if (!task) return;
    if (isBoostLocked(task)) {
      notify(t('boostLockedMsg'), 'error');
      return;
    }
    setPromoBusy(true);
    try {
      await supabase.from('tasks').update({
        is_promoted: false,
        promotion_expires_at: null,
        promotion_locked_until: null,
      }).eq('id', task.id);
      notify(t('boostLockPassed'), 'success');
      onSave({ ...task, is_promoted: false, promotion_expires_at: null, promotion_locked_until: null });
    } finally { setPromoBusy(false); }
  };

  return (
    <Modal open={!!task} onClose={onClose} title={t('editTaskInline')}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('title')}</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('description')}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('targetUrl')}</label>
          <input value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('reward')}</label>
            <input type="number" min={1} value={form.reward_coins} onChange={(e) => setForm({ ...form, reward_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('slots')}</label>
            <input type="number" min={1} value={form.slots} onChange={(e) => setForm({ ...form, slots: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          </div>
        </div>

        {/* In-line Promotion / Boost */}
        {promotionTiers.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-fuchsia-400" />
              <p className="text-sm font-semibold text-fuchsia-300">{t('extendPromotion')}</p>
            </div>
            <p className="text-xs text-slate-400 mb-1">{t('extendPromotionHint')}</p>
            {currentlyPromoted && (
              <p className="text-[10px] text-fuchsia-300 mb-2 flex items-center gap-1">
                <Zap size={10} /> {t('boosted')} {tierLabel(t, task?.promotion_tier)}
                {task?.promotion_expires_at && ` • ${new Date(task.promotion_expires_at).toLocaleDateString()}`}
              </p>
            )}
            {currentlyPromoted && isBoostLocked(task) && (
              <div className="flex items-center gap-1.5 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                <Lock size={11} className="text-amber-400 shrink-0" />
                <p className="text-[10px] text-amber-300 font-medium">{t('boostLockedMsg')}</p>
              </div>
            )}
            {currentlyPromoted && (
              <Button variant="ghost" className="w-full text-xs mb-2 flex items-center justify-center gap-1.5" disabled={promoBusy || isBoostLocked(task)} onClick={cancelBoost}>
                <ZapOff size={13} /> {t('cancelBoost')}
              </Button>
            )}
            <p className="text-[10px] text-slate-500 mb-2">{t('yourTier')}: <span className={`font-bold ${ut === 'vip' ? 'text-amber-300' : ut === 'pro' ? 'text-cyan-300' : 'text-slate-300'}`}>{tierLabel(t, ut)}</span></p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {promotionTiers.map((tier, i) => {
                const cost = tierCost(tier, ut);
                const longTerm = isLongTermTier(tier);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedTier(i)}
                    className={`p-3 rounded-xl border text-left transition ${selectedTier === i ? 'bg-fuchsia-500/15 border-fuchsia-500/50' : 'bg-slate-800/50 border-white/10'}`}
                  >
                    <p className="text-xs text-white font-medium flex items-center gap-1">
                      {longTerm && <Lock size={9} className="text-amber-400" />}
                      {tier.label}
                    </p>
                    <p className="text-[10px] text-fuchsia-300 mt-0.5">+{cost} {t('lumoraCoins')}</p>
                    {longTerm && <p className="text-[9px] text-amber-400/80 mt-0.5">{t('longTermBoostLock')}</p>}
                  </button>
                );
              })}
            </div>
            {selectedTier >= 0 && longTerm && (
              <div className="mb-2">
                <label className="text-[10px] text-slate-400 block mb-1">{t('boostEndDate')}</label>
                <p className="text-[9px] text-slate-500 mb-1">{t('boostEndDateHint')}</p>
                <input type="datetime-local" value={promoEndDate} onChange={(e) => setPromoEndDate(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-xs" />
              </div>
            )}
            {selectedTier >= 0 && longTerm && (
              <div className="flex items-center gap-1.5 mb-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg px-2.5 py-1.5">
                <Calendar size={11} className="text-fuchsia-400 shrink-0" />
                <p className="text-[10px] text-fuchsia-300 font-medium">{t('fixedDailyBudget')}: {phase1Rate} {t('lumoraCoins')} {t('perDay')} ({t('phase1Label')}) → {phase2Rate} {t('lumoraCoins')} {t('perDay')} ({t('phase2Label')})</p>
              </div>
            )}
            {selectedTier >= 0 && (
              <Button className="w-full text-sm flex items-center justify-center gap-1.5" disabled={promoBusy} onClick={applyPromotion}>
                <Zap size={14} /> {t('promoteBtn')} {longTerm ? `(${phase1Rate}${t('perDay')} → ${phase2Rate}${t('perDay')})` : `(+${promoCost})`}
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
          <Button className="flex-1" onClick={handleSave}>{t('save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateTaskForm({ onDone }: { onDone: () => void }) {
  const { t, profile, refreshProfile } = useApp();
  const { notify } = useToast();
  const [form, setForm] = useState({ platform: 'facebook', title: '', description: '', target_url: '', reward: 25, slots: 1, daily_slot_limit: '' });
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const [limits, setLimits] = useState({ min_task_reward: 10, max_task_reward: 10000 });
  const [promotionTiers, setPromotionTiers] = useState<{ duration_days: number; label: string; free_cost?: number; pro_cost?: number; vip_cost?: number; coin_cost?: number; daily_rate?: number; daily_rate_after_lock?: number; daily_rate_after_lock_free?: number; daily_rate_after_lock_pro?: number; daily_rate_after_lock_vip?: number }[]>([]);
  const [selectedTier, setSelectedTier] = useState<number>(-1);
  const [promoEndDate, setPromoEndDate] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [catRes, settingsRes] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('app_settings').select('min_task_reward, max_task_reward, promotion_tiers').eq('id', 1).maybeSingle(),
      ]);
      if (catRes.data && catRes.data.length > 0) setCategories(catRes.data);
      else setCategories([{ name: 'facebook', label: 'Facebook' }, { name: 'instagram', label: 'Instagram' }, { name: 'youtube', label: 'YouTube' }, { name: 'app_review', label: 'App Review' }, { name: 'tiktok', label: 'TikTok' }, { name: 'other', label: 'Other' }]);
      if (settingsRes.data) {
        setLimits(settingsRes.data);
        if (settingsRes.data.promotion_tiers && Array.isArray(settingsRes.data.promotion_tiers)) {
          setPromotionTiers(settingsRes.data.promotion_tiers);
        }
      }
    })();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const ut = userTier(profile);
  const taskCost = isAdmin ? 0 : form.reward;
  const selectedTierObj = selectedTier >= 0 ? promotionTiers[selectedTier] : null;
  const longTerm = isLongTermTier(selectedTierObj);
  const promoCost = selectedTier >= 0 ? tierCost(promotionTiers[selectedTier] || {}, ut) : 0;
  const phase1Rate = oneDayTierCost(promotionTiers, ut);
  const phase2Rate = selectedTier >= 0 ? (ut === 'vip' ? (promotionTiers[selectedTier]?.daily_rate_after_lock_vip ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0) : ut === 'pro' ? (promotionTiers[selectedTier]?.daily_rate_after_lock_pro ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0) : (promotionTiers[selectedTier]?.daily_rate_after_lock_free ?? promotionTiers[selectedTier]?.daily_rate_after_lock ?? 0)) : 0;
  const promoUpfront = longTerm ? 0 : promoCost;
  const totalCost = taskCost + promoUpfront;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (form.reward < limits.min_task_reward) { notify(t('rewardTooLow'), 'error'); return; }
    if (form.reward > limits.max_task_reward) { notify(t('rewardTooHigh'), 'error'); return; }
    if (!isAdmin && profile.lumora_coins < totalCost) {
      notify(selectedTier >= 0 ? microcopy.notEnoughPromoCoins() : t('notEnoughCoins'), 'error');
      return;
    }
    setBusy(true);
    try {
      const tier = selectedTier >= 0 ? promotionTiers[selectedTier] : null;
      const isPromoted = !!tier;
      const now = new Date();
      const lt = isLongTermTier(tier);
      const phase1 = lt ? phase1Rate : 0;
      const upfrontPromo = lt ? 0 : promoCost;
      const promotionExpiry = lt
        ? (promoEndDate ? new Date(promoEndDate).toISOString() : null)
        : (tier ? (tier.duration_days === 0 ? null : new Date(now.getTime() + tier.duration_days * 86400000).toISOString()) : null);
      const lockedUntil = (isPromoted && lt) ? new Date(now.getTime() + 8 * 86400000).toISOString() : null;

      await supabase.from('tasks').insert({
        creator_id: profile.id,
        platform: form.platform,
        title: form.title,
        description: form.description,
        target_url: form.target_url || null,
        reward_coins: form.reward,
        cost_coins: taskCost,
        is_admin_task: isAdmin,
        slots: form.slots,
        is_promoted: isPromoted,
        promotion_coins: upfrontPromo,
        promotion_expires_at: promotionExpiry,
        daily_slot_limit: form.daily_slot_limit ? +form.daily_slot_limit : null,
        promotion_weight: isPromoted ? (lt ? phase1 : promoCost) : 0,
        promotion_tier: isPromoted ? ut : null,
        promotion_started_at: isPromoted ? now.toISOString() : null,
        promotion_locked_until: lockedUntil,
        promotion_daily_rate: lt ? phase1 || null : null,
        promotion_end_at: lt ? promotionExpiry : null,
        promotion_last_charged_at: lt ? now.toISOString() : null,
      });
      if (!isAdmin && totalCost > 0) {
        await supabase.from('profiles').update({ lumora_coins: profile.lumora_coins - totalCost }).eq('id', profile.id);
        await supabase.from('transactions').insert({ user_id: profile.id, type: 'task_spend', amount: -totalCost, status: 'completed', note: `Created: ${form.title}${isPromoted ? ` + ${t('promoteTask')}` : ''}` });
        await refreshProfile();
      }
      notify(isPromoted ? microcopy.promotionSuccess() : t('submitted'), 'success');
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
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('dailySlotLimit')}</label>
          <p className="text-[10px] text-slate-500 mb-1">{t('dailySlotLimitHint')}</p>
          <input type="number" min={1} value={form.daily_slot_limit} onChange={(e) => setForm({ ...form, daily_slot_limit: e.target.value })} placeholder="∞" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
        </div>

        {/* Promotion / Boost Section */}
        {promotionTiers.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-fuchsia-400" />
              <p className="text-sm font-semibold text-fuchsia-300">{t('promoteTask')}</p>
            </div>
            <p className="text-xs text-slate-400 mb-1">{t('promoteTaskDesc')}</p>
            <p className="text-[10px] text-slate-500 mb-2">{t('yourTier')}: <span className={`font-bold ${ut === 'vip' ? 'text-amber-300' : ut === 'pro' ? 'text-cyan-300' : 'text-slate-300'}`}>{tierLabel(t, ut)}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedTier(-1)}
                className={`p-3 rounded-xl border text-left transition ${selectedTier === -1 ? 'bg-slate-700 border-slate-500' : 'bg-slate-800/50 border-white/10'}`}
              >
                <p className="text-xs text-white font-medium">{t('noPromotion')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">+0 {t('lumoraCoins')}</p>
              </button>
              {promotionTiers.map((tier, i) => {
                const cost = tierCost(tier, ut);
                const longTerm = isLongTermTier(tier);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedTier(i)}
                    className={`p-3 rounded-xl border text-left transition ${selectedTier === i ? 'bg-fuchsia-500/15 border-fuchsia-500/50' : 'bg-slate-800/50 border-white/10'}`}
                  >
                    <p className="text-xs text-white font-medium flex items-center gap-1">
                      {longTerm && <Lock size={9} className="text-amber-400" />}
                      {tier.label}
                    </p>
                    <p className="text-[10px] text-fuchsia-300 mt-0.5">+{cost} {t('lumoraCoins')}</p>
                    {longTerm && <p className="text-[9px] text-amber-400/80 mt-0.5">{t('longTermBoostLock')}</p>}
                  </button>
                );
              })}
            </div>
            {selectedTier >= 0 && longTerm && (
              <div className="mb-2">
                <label className="text-[10px] text-slate-400 block mb-1">{t('boostEndDate')}</label>
                <p className="text-[9px] text-slate-500 mb-1">{t('boostEndDateHint')}</p>
                <input type="datetime-local" value={promoEndDate} onChange={(e) => setPromoEndDate(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-xs" />
              </div>
            )}
            {selectedTier >= 0 && longTerm && (
              <div className="flex items-center gap-1.5 mb-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg px-2.5 py-1.5">
                <Calendar size={11} className="text-fuchsia-400 shrink-0" />
                <p className="text-[10px] text-fuchsia-300 font-medium">{t('fixedDailyBudget')}: {phase1Rate} {t('lumoraCoins')} {t('perDay')} ({t('phase1Label')}) → {phase2Rate} {t('lumoraCoins')} {t('perDay')} ({t('phase2Label')})</p>
              </div>
            )}
          </div>
        )}

        {isAdmin && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-xs text-amber-300 flex items-center gap-2"><ShieldCheck size={14} /> {t('freeTask')} + {t('doubleReward')}</div>}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {t('cost')}: <CoinBadge amount={totalCost} />
            {promoUpfront > 0 && <span className="text-[10px] text-fuchsia-400 ml-1">(+{promoUpfront} boost)</span>}
            {selectedTier >= 0 && longTerm && <span className="text-[10px] text-fuchsia-400 ml-1">({phase1Rate}{t('perDay')} → {phase2Rate}{t('perDay')})</span>}
          </span>
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
