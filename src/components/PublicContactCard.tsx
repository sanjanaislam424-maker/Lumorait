import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Eye, EyeOff } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';

type PrivacyKey = 'show_phone' | 'show_email' | 'share_contact_info';

export function PublicContactCard() {
  const { lang, profile, themeConfig, refreshProfile } = useApp();
  const { notify } = useToast();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>({ show_phone: false, show_email: false, share_contact_info: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setPhone(profile.contact_phone || '');
    setEmail(profile.contact_email || '');
    setAddress(profile.address || '');
    setPrivacy({
      show_phone: !!profile.show_phone,
      show_email: !!profile.show_email,
      share_contact_info: !!profile.share_contact_info,
    });
  }, [profile?.id, profile?.contact_phone, profile?.contact_email, profile?.address, profile?.show_phone, profile?.show_email, profile?.share_contact_info]);

  if (!profile) return null;

  const isBn = lang === 'bn';
  const trimmedEmail = email.trim();
  const emailValid = !trimmedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const phoneValid = !phone.trim() || /^\+?[0-9 ()-]{6,20}$/.test(phone.trim());

  const save = async () => {
    if (!emailValid || !phoneValid) {
      notify(isBn ? 'সঠিক ইমেইল বা মোবাইল নম্বর দিন' : 'Please enter a valid email or mobile number', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      contact_phone: phone.trim() || null,
      contact_email: trimmedEmail || null,
      address: address.trim() || null,
      show_phone: privacy.show_phone,
      show_email: privacy.show_email,
      share_contact_info: privacy.share_contact_info,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      notify(isBn ? 'সংরক্ষণ করা যায়নি' : 'Could not save contact details', 'error');
      return;
    }
    await refreshProfile();
    notify(isBn ? 'যোগাযোগের তথ্য সংরক্ষিত হয়েছে' : 'Contact details saved', 'success');
  };

  const toggles: { key: PrivacyKey; label: string; hint: string }[] = [
    { key: 'show_phone', label: isBn ? 'মোবাইল নম্বর দেখান' : 'Show mobile number', hint: isBn ? 'পাবলিক প্রোফাইলে' : 'On your public profile' },
    { key: 'show_email', label: isBn ? 'ইমেইল দেখান' : 'Show email', hint: isBn ? 'পাবলিক প্রোফাইলে' : 'On your public profile' },
    { key: 'share_contact_info', label: isBn ? 'ঠিকানা দেখান' : 'Show address', hint: isBn ? 'পাবলিক প্রোফাইলে' : 'On your public profile' },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Phone size={18} style={{ color: themeConfig.primary }} />
        <h3 className="font-semibold neon-text text-sm">{isBn ? 'যোগাযোগ ও গোপনীয়তা' : 'Contact & privacy'}</h3>
      </div>
      <p className="text-xs neon-muted mb-3">
        {isBn
          ? 'এগুলো শুধু তখনই অন্যরা দেখবে যখন আপনি সুইচ চালু করবেন। লগইন নম্বর কখনও দেখানো হয় না।'
          : 'Other users see each detail only when its switch is on. Your sign-in number is never shown.'}
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs neon-muted block mb-1 flex items-center gap-1"><Phone size={12} /> {isBn ? 'মোবাইল নম্বর' : 'Mobile number'}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs neon-muted block mb-1 flex items-center gap-1"><Mail size={12} /> {isBn ? 'ইমেইল' : 'Email'}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="text-xs neon-muted block mb-1 flex items-center gap-1"><MapPin size={12} /> {isBn ? 'ঠিকানা' : 'Address'}</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none resize-none focus:border-amber-500/50" />
        </div>

        <div className="rounded-xl border border-white/10 divide-y divide-white/5">
          {toggles.map((toggle) => {
            const on = privacy[toggle.key];
            return (
              <label key={toggle.key} className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                <span className="flex items-center gap-2 min-w-0">
                  {on ? <Eye size={14} className="text-emerald-400 shrink-0" /> : <EyeOff size={14} className="text-slate-500 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block text-sm neon-text">{toggle.label}</span>
                    <span className="block text-[11px] neon-muted">{toggle.hint}</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setPrivacy((prev) => ({ ...prev, [toggle.key]: e.target.checked }))}
                  className="w-5 h-5 accent-amber-500 shrink-0"
                />
              </label>
            );
          })}
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সংরক্ষণ করুন' : 'Save contact details')}
        </Button>
      </div>
    </Card>
  );
}
