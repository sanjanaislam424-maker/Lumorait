import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, User as UserIcon, MessageSquare, BadgeCheck, AlertCircle, Clock, XCircle, FileWarning, Award, Megaphone, Plus, TrendingUp, Flame, Coins, Crown, Footprints, Zap, Send } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ChatWidget } from '@/components/ChatWidget';

const badgeIcons: Record<string, React.ReactNode> = {
  Award: <Award size={16} />, Crown: <Crown size={16} />, Flame: <Flame size={16} />, Coins: <Coins size={16} />, TrendingUp: <TrendingUp size={16} />, Zap: <Zap size={16} />, Footprints: <Footprints size={16} />,
};
const tierColors: Record<string, string> = {
  bronze: 'from-amber-700/20 to-amber-600/20 text-amber-400 border-amber-700/30',
  silver: 'from-slate-400/20 to-slate-300/20 text-slate-300 border-slate-400/30',
  gold: 'from-yellow-500/20 to-amber-400/20 text-yellow-300 border-yellow-500/30',
  platinum: 'from-cyan-400/20 to-blue-400/20 text-cyan-300 border-cyan-400/30',
};

type KycStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'appeal_pending' | 'appeal_approved';

export function ProfileView() {
  const { t, profile, refreshProfile, signOut } = useApp();
  const { notify } = useToast();
  const [name, setName] = useState(profile?.full_name || '');
  const [kycOpen, setKycOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>('none');
  const [supportOpen, setSupportOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const { data } = await supabase
        .from('id_verifications')
        .select('status')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setKycStatus((data?.status as KycStatus) || 'none');
    })();
  }, [profile]);

  if (!profile) return null;

  const saveProfile = async () => {
    await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id);
    await refreshProfile();
    notify(t('profileUpdated'), 'success');
  };

  const deleteAccount = async () => {
    if (!confirm(t('confirmDelete'))) return;
    // Archive NID to deleted_account_nids before deleting
    const { data: verifs } = await supabase
      .from('id_verifications')
      .select('id_number')
      .eq('user_id', profile.id)
      .eq('id_type', 'nid')
      .not('id_number', 'is', null);
    if (verifs && verifs.length > 0) {
      for (const v of verifs) {
        if (v.id_number) {
          await supabase.from('deleted_account_nids').insert({ nid_number: v.id_number, original_user_id: profile.id });
        }
      }
    }
    await supabase.from('profiles').delete().eq('id', profile.id);
    await signOut();
  };

  const kycBadge = () => {
    if (profile.kyc_verified || kycStatus === 'approved') {
      return <BadgeInfo icon={<BadgeCheck size={14} />} text={t('kycVerified')} color="text-green-400 bg-green-500/15 border-green-500/30" />;
    }
    if (kycStatus === 'pending') {
      return <BadgeInfo icon={<Clock size={14} />} text={t('kycPending')} color="text-amber-400 bg-amber-500/15 border-amber-500/30" />;
    }
    if (kycStatus === 'rejected') {
      return <BadgeInfo icon={<XCircle size={14} />} text={t('kycRejected')} color="text-red-400 bg-red-500/15 border-red-500/30" />;
    }
    if (kycStatus === 'appeal_pending') {
      return <BadgeInfo icon={<Clock size={14} />} text={t('kycAppealPending')} color="text-blue-400 bg-blue-500/15 border-blue-500/30" />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <Card className="text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mx-auto flex items-center justify-center mb-3">
          <UserIcon size={36} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">{profile.full_name || 'User'}</h2>
        <p className="text-sm text-slate-400">{profile.phone || profile.id.slice(0, 8)}</p>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {profile.role === 'admin' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
              <ShieldCheck size={12} /> {t('admin')}
            </span>
          )}
          {kycBadge()}
        </div>
      </Card>

      {/* Edit profile */}
      <Card>
        <h3 className="font-semibold text-white mb-3">{t('profile')}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('fullName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
          </div>
          <Button className="w-full" onClick={saveProfile}>{t('save')}</Button>
        </div>
      </Card>

      {/* ID Verification */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-amber-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">{t('verifyId')}</h3>
              <p className="text-xs text-slate-500">{t('kycFeeDesc')}</p>
            </div>
          </div>
          {kycStatus !== 'approved' && !profile.kyc_verified && (
            <div className="flex gap-2">
              {kycStatus === 'rejected' && (
                <Button variant="ghost" className="text-xs" onClick={() => setAppealOpen(true)}>
                  <FileWarning size={14} className="inline mr-1" /> {t('appealTitle')}
                </Button>
              )}
              <Button variant="ghost" className="text-sm" onClick={() => setKycOpen(true)}>{t('verify')}</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Badges */}
      <BadgeDisplay userId={profile.id} />

      {/* Advertiser Panel */}
      <AdvertiserPanel userId={profile.id} />

      {/* Support */}
      <Card>
        <button onClick={() => setSupportOpen(true)} className="flex items-center gap-2 w-full text-left">
          <MessageSquare size={20} className="text-blue-400" />
          <div>
            <h3 className="font-semibold text-white text-sm">{t('liveChat')}</h3>
            <p className="text-xs text-slate-500">{t('availableSoon')}</p>
          </div>
        </button>
      </Card>

      {/* Delete account */}
      <button onClick={deleteAccount} className="flex items-center gap-2 w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-300 text-sm">
        <Trash2 size={18} /> {t('deleteAccount')}
      </button>

      <KycModal
        open={kycOpen}
        onClose={() => setKycOpen(false)}
        onDone={() => { setKycOpen(false); setKycStatus('pending'); notify(t('submitted'), 'success'); }}
        onNeedAppeal={() => { setKycOpen(false); setAppealOpen(true); }}
      />
      <AppealModal
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        onDone={() => { setAppealOpen(false); setKycStatus('appeal_pending'); notify(t('appealSubmitted'), 'success'); }}
      />
      <Modal open={supportOpen} onClose={() => setSupportOpen(false)} title={t('liveChat')}>
        <ChatWidget supportMode subject="Support Request" />
      </Modal>
    </div>
  );
}

function BadgeDisplay({ userId }: { userId: string }) {
  const { t } = useApp();
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [ub, ab] = await Promise.all([
        supabase.from('user_badges').select('*, badges(*)').eq('user_id', userId).order('awarded_at', { ascending: false }),
        supabase.from('badges').select('*').eq('is_active', true).order('threshold_tasks', { ascending: true }),
      ]);
      setUserBadges(ub.data || []);
      setAllBadges(ab.data || []);
    })();
  }, [userId]);

  const earnedIds = new Set(userBadges.map((ub) => ub.badge_id));

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Award size={18} className="text-amber-400" />
        <h3 className="font-semibold text-white text-sm">{t('streakMax')}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {allBadges.map((b) => {
          const earned = earnedIds.has(b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl p-3 border transition ${earned ? tierColors[b.tier] || tierColors.bronze : 'bg-slate-800/30 border-white/5 opacity-40'}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
                  {badgeIcons[b.icon] || <Award size={14} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: earned ? undefined : 'var(--neon-muted)' }}>{b.label}</p>
                  <p className="text-[10px] opacity-60 truncate">{b.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AdvertiserPanel({ userId }: { userId: string }) {
  const { t, lang } = useApp();
  const { notify } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', target_url: '', budget_coins: 100, reward_per_view: 1 });

  const load = async () => {
    const { data } = await supabase.from('ad_campaigns').select('*').eq('advertiser_id', userId).order('created_at', { ascending: false });
    setCampaigns(data || []);
  };
  useEffect(() => { load(); }, [userId]);

  const submit = async () => {
    if (!form.title.trim() || !form.target_url.trim()) {
      notify(lang === 'bn' ? 'টাইটেল এবং লিংক দাও' : 'Title and URL required', 'error');
      return;
    }
    await supabase.from('ad_campaigns').insert({
      advertiser_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      target_url: form.target_url.trim(),
      budget_coins: form.budget_coins,
      reward_per_view: form.reward_per_view,
      status: 'pending',
    });
    setForm({ title: '', description: '', target_url: '', budget_coins: 100, reward_per_view: 1 });
    setCreating(false);
    notify(lang === 'bn' ? 'ক্যাম্পেইন জমা হয়েছে! অ্যাডমিন অ্যাপ্রুভ করবে।' : 'Campaign submitted! Admin will approve.', 'success');
    load();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-500/20 text-slate-300',
    approved: 'bg-emerald-500/20 text-emerald-300',
    rejected: 'bg-red-500/20 text-red-300',
    paused: 'bg-amber-500/20 text-amber-300',
    completed: 'bg-blue-500/20 text-blue-300',
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-amber-400" />
          <h3 className="font-semibold text-white text-sm">{lang === 'bn' ? 'বিজ্ঞাপন প্যানেল' : 'Advertiser Panel'}</h3>
        </div>
        {!creating && (
          <Button variant="ghost" className="text-xs px-2 py-1 flex items-center gap-1" onClick={() => setCreating(true)}>
            <Plus size={12} /> {lang === 'bn' ? 'নতুন' : 'New'}
          </Button>
        )}
      </div>

      {creating && (
        <div className="space-y-2 mb-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={lang === 'bn' ? 'ক্যাম্পেইন টাইটেল' : 'Campaign title'} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={lang === 'bn' ? 'বিবরণ' : 'Description'} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
          <input value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} value={form.budget_coins} onChange={(e) => setForm({ ...form, budget_coins: +e.target.value })} placeholder={lang === 'bn' ? 'বাজেট (কয়েন)' : 'Budget (coins)'} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
            <input type="number" min={1} value={form.reward_per_view} onChange={(e) => setForm({ ...form, reward_per_view: +e.target.value })} placeholder={lang === 'bn' ? 'প্রতি ভিউ রিওয়ার্ড' : 'Reward/view'} className="bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 text-sm" onClick={submit}>{lang === 'bn' ? 'জমা দাও' : 'Submit'}</Button>
            <Button variant="ghost" className="text-sm" onClick={() => setCreating(false)}>{t('cancel')}</Button>
          </div>
        </div>
      )}

      {campaigns.length === 0 && !creating ? (
        <p className="text-xs text-slate-500 text-center py-4">{lang === 'bn' ? 'কোনো ক্যাম্পেইন নেই' : 'No campaigns yet'}</p>
      ) : campaigns.map((c) => (
        <div key={c.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 mb-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white font-medium truncate">{c.title}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[c.status] || statusColors.pending}`}>{c.status}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{c.spent_coins}/{c.budget_coins} coins | {c.reward_per_view}/view</p>
          {c.admin_note && <p className="text-[10px] text-amber-300 mt-1">{c.admin_note}</p>}
        </div>
      ))}
    </Card>
  );
}

function BadgeInfo({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {icon} {text}
    </span>
  );
}

export function KycModal({ open, onClose, onDone, onNeedAppeal }: { open: boolean; onClose: () => void; onDone: () => void; onNeedAppeal: () => void }) {
  const { t, profile, refreshProfile } = useApp();
  const { notify } = useToast();
  const [idNumber, setIdNumber] = useState('');
  const [nidFront, setNidFront] = useState('');
  const [nidBack, setNidBack] = useState('');
  const [videoSelfie, setVideoSelfie] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!profile) return;
    if (!idNumber.trim() || !nidFront.trim() || !nidBack.trim() || !videoSelfie.trim()) {
      notify(t('noProofs'), 'error');
      return;
    }

    if (profile.lumora_coins < 500) {
      notify(t('notEnoughKycFee'), 'error');
      return;
    }

    setBusy(true);
    try {
      // Check NID uniqueness against id_verifications
      const { data: existingNid } = await supabase
        .from('id_verifications')
        .select('id')
        .eq('id_number', idNumber.trim())
        .neq('user_id', profile.id)
        .limit(1)
        .maybeSingle();
      if (existingNid) {
        notify(t('nidDuplicate'), 'error');
        setBusy(false);
        return;
      }

      // Check NID against deleted_account_nids
      const { data: deletedNid } = await supabase
        .from('deleted_account_nids')
        .select('id')
        .eq('nid_number', idNumber.trim())
        .limit(1)
        .maybeSingle();
      if (deletedNid) {
        notify(t('nidDeleted'), 'error');
        setBusy(false);
        onNeedAppeal();
        return;
      }

      // Deduct 500 LM Coin KYC fee
      const newCoins = profile.lumora_coins - 500;
      const newBonus = Math.max(0, (profile.bonus_coins || 0) - 500);
      await supabase.from('profiles').update({
        lumora_coins: newCoins,
        bonus_coins: newBonus,
        kyc_fee_paid: true,
      }).eq('id', profile.id);

      await supabase.from('transactions').insert({
        user_id: profile.id, type: 'penalty', amount: -500, status: 'completed', note: 'KYC verification fee',
      });

      // Insert verification record
      await supabase.from('id_verifications').insert({
        user_id: profile.id,
        id_type: 'nid',
        id_number: idNumber.trim(),
        document_url: nidFront.trim(),
        nid_front_url: nidFront.trim(),
        nid_back_url: nidBack.trim(),
        video_selfie_url: videoSelfie.trim(),
        status: 'pending',
      });

      await refreshProfile();
      onDone();
    } catch {
      notify(t('redeemInvalid'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('verifyId')}>
      <div className="space-y-3">
        {/* KYC Fee notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-amber-300 font-semibold">{t('kycFee')}: 500 {t('lumoraCoins')}</p>
            <p className="text-[10px] text-slate-400">{t('kycFeeDesc')}</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('idNumber')} (NID)</label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="NID Number" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('nidFront')}</label>
          <input value={nidFront} onChange={(e) => setNidFront(e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('nidBack')}</label>
          <input value={nidBack} onChange={(e) => setNidBack(e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('videoSelfie')}</label>
          <input value={videoSelfie} onChange={(e) => setVideoSelfie(e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
          <p className="text-[10px] text-slate-500 mt-1">{t('videoSelfieHint')}</p>
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>{busy ? '...' : t('submit')}</Button>
      </div>
    </Modal>
  );
}

export function AppealModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [nidNumber, setNidNumber] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!profile || !nidNumber.trim() || !reason.trim()) return;
    setBusy(true);
    try {
      await supabase.from('kyc_appeals').insert({
        user_id: profile.id,
        nid_number: nidNumber.trim(),
        reason: reason.trim(),
        status: 'pending',
      });
      // Update verification status to appeal_pending if a record exists
      await supabase.from('id_verifications')
        .update({ status: 'appeal_pending' })
        .eq('user_id', profile.id)
        .eq('id_number', nidNumber.trim());
      onDone();
    } catch {
      notify(t('redeemInvalid'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('appealTitle')}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('idNumber')} (NID)</label>
          <input value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} placeholder="NID Number" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('appealReason')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none" />
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>{busy ? '...' : t('submit')}</Button>
      </div>
    </Modal>
  );
}


