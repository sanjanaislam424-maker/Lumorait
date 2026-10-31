import { useEffect, useState } from 'react';
import { Mail, MapPin } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';

export function PublicContactCard() {
  const { lang, profile, themeConfig, refreshProfile } = useApp();
  const { notify } = useToast();
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.contact_email || '');
    setAddress(profile.address || '');
    setShare(!!profile.share_contact_info);
  }, [profile?.id, profile?.contact_email, profile?.address, profile?.share_contact_info]);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      contact_email: email.trim() || null,
      address: address.trim() || null,
      share_contact_info: share,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      notify(lang === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save contact details', 'error');
      return;
    }
    await refreshProfile();
    notify(lang === 'bn' ? 'যোগাযোগের তথ্য সংরক্ষিত হয়েছে' : 'Contact details saved', 'success');
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Mail size={18} style={{ color: themeConfig.primary }} />
        <h3 className="font-semibold neon-text text-sm">{lang === 'bn' ? 'পাবলিক যোগাযোগ' : 'Public contact details'}</h3>
      </div>
      <p className="text-xs neon-muted mb-3">
        {lang === 'bn'
          ? 'আপনার প্রোফাইল দেখলে অন্যরা এগুলো দেখতে পারবে, শুধু যদি আপনি শেয়ার চালু করেন।'
          : 'Other users see these only when you turn sharing on.'}
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs neon-muted block mb-1">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs neon-muted block mb-1 flex items-center gap-1"><MapPin size={12} /> {lang === 'bn' ? 'ঠিকানা' : 'Address'}</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none resize-none focus:border-amber-500/50" />
        </div>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm neon-text">{lang === 'bn' ? 'আমার যোগাযোগের তথ্য পাবলিক প্রোফাইলে দেখান' : 'Show my contact details on my public profile'}</span>
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="w-5 h-5 accent-amber-500" />
        </label>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save contact details')}
        </Button>
      </div>
    </Card>
  );
}
