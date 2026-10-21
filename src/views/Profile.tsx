import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, User as UserIcon, MessageSquare, Send, BadgeCheck, AlertCircle, Clock, XCircle, FileWarning } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/Toast';

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
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}

function BadgeInfo({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {icon} {text}
    </span>
  );
}

function KycModal({ open, onClose, onDone, onNeedAppeal }: { open: boolean; onClose: () => void; onDone: () => void; onNeedAppeal: () => void }) {
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

function AppealModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
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

function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const [msgs, setMsgs] = useState<{ id: number; from: string; text: string }[]>([
    { id: 1, from: 'support', text: 'Hey! Lumora support this side. How can I help, buddy?' },
  ]);
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    setMsgs((prev) => [...prev, { id: Date.now(), from: 'me', text }]);
    setText('');
    setTimeout(() => {
      setMsgs((prev) => [...prev, { id: Date.now() + 1, from: 'support', text: 'Got it! We will look into that right away.' }]);
    }, 1500);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('liveChat')}>
      <div className="h-64 overflow-y-auto space-y-2 mb-3 bg-slate-900/50 rounded-xl p-3">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.from === 'me' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-200'}`}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('typeMessage')} className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        <Button onClick={send}><Send size={16} /></Button>
      </div>
    </Modal>
  );
}
