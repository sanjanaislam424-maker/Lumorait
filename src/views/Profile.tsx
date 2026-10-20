import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, User as UserIcon, Star, MessageSquare, Send } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/Toast';

export function ProfileView() {
  const { t, profile, refreshProfile, signOut } = useApp();
  const { notify } = useToast();
  const [name, setName] = useState(profile?.full_name || '');
  const [idOpen, setIdOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [verifStatus, setVerifStatus] = useState<string>('none');
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const { data } = await supabase.from('id_verifications').select('status').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setVerifStatus(data?.status || 'none');
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
    await supabase.from('profiles').delete().eq('id', profile.id);
    await signOut();
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
        {profile.role === 'admin' && (
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
            <ShieldCheck size={12} /> {t('admin')}
          </span>
        )}
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
              <p className="text-xs text-slate-500">Status: {verifStatus === 'none' ? '—' : t(verifStatus as any)}</p>
            </div>
          </div>
          {verifStatus !== 'approved' && <Button variant="ghost" className="text-sm" onClick={() => setIdOpen(true)}>{t('verify')}</Button>}
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

      <IdVerifyModal open={idOpen} onClose={() => setIdOpen(false)} onDone={() => { setIdOpen(false); setVerifStatus('pending'); notify(t('submitted'), 'success'); }} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}

function IdVerifyModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, profile } = useApp();
  const [idType, setIdType] = useState('nid');
  const [idNumber, setIdNumber] = useState('');
  const [docUrl, setDocUrl] = useState('');

  const submit = async () => {
    await supabase.from('id_verifications').insert({ user_id: profile!.id, id_type: idType, id_number: idNumber, document_url: docUrl, status: 'pending' });
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('verifyId')}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('idType')}</label>
          <select value={idType} onChange={(e) => setIdType(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="nid">NID</option>
            <option value="passport">Passport</option>
            <option value="driving">Driving License</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('idNumber')}</label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('uploadDoc')}</label>
          <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
        </div>
        <Button className="w-full" onClick={submit}>{t('submit')}</Button>
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
