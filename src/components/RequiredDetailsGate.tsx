import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useApp } from '@/lib/AppContext';
import { supabase, Profile } from '@/lib/supabase';
import {
  RequiredDetailsForm,
  formFromProfile,
  validateRequiredDetails,
} from '@/lib/requiredDetails';

const INPUT_CLASS = 'w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50';
const LABEL_CLASS = 'text-xs text-slate-400 block mb-1';

type PrivacyField = 'show_phone' | 'show_email' | 'share_contact_info';

const PRIVACY_OPTIONS: { key: PrivacyField; label: string }[] = [
  { key: 'show_phone', label: 'Show mobile number on my public profile' },
  { key: 'show_email', label: 'Show email on my public profile' },
  { key: 'share_contact_info', label: 'Show address on my public profile' },
];

export function RequiredDetailsGate({ profile }: { profile: Profile }) {
  const { refreshProfile } = useApp();
  const [form, setForm] = useState<RequiredDetailsForm>(() => formFromProfile(profile));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof RequiredDetailsForm>(key: K, value: RequiredDetailsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    const validationError = validateRequiredDetails(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim(),
        address: form.address.trim(),
        show_phone: form.show_phone,
        show_email: form.show_email,
        share_contact_info: form.share_contact_info,
      })
      .eq('id', profile.id);
    if (updateError) {
      console.error('Saving required profile details failed', updateError);
      setError('We could not save your details. Please try again.');
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--neon-bg)' }}>
      <Card className="w-full max-w-lg p-6 space-y-5">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-xl font-semibold text-white">Complete your profile</h1>
          <p className="text-sm text-slate-400">
            Your name, mobile number, email and address are required to use Lumora IT. You choose whether each contact detail appears on your public profile.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Full name</label>
            <input className={INPUT_CLASS} value={form.full_name} maxLength={80} onChange={(e) => update('full_name', e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Mobile number</label>
            <input className={INPUT_CLASS} type="tel" value={form.contact_phone} maxLength={20} onChange={(e) => update('contact_phone', e.target.value)} />
            <PrivacyToggle checked={form.show_phone} onChange={(v) => update('show_phone', v)} label={PRIVACY_OPTIONS[0].label} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Email</label>
            <input className={INPUT_CLASS} type="email" value={form.contact_email} maxLength={120} onChange={(e) => update('contact_email', e.target.value)} />
            <PrivacyToggle checked={form.show_email} onChange={(v) => update('show_email', v)} label={PRIVACY_OPTIONS[1].label} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Address</label>
            <textarea className={`${INPUT_CLASS} min-h-[72px]`} value={form.address} maxLength={300} onChange={(e) => update('address', e.target.value)} />
            <PrivacyToggle checked={form.share_contact_info} onChange={(v) => update('share_contact_info', v)} label={PRIVACY_OPTIONS[2].label} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save and continue'}
        </Button>
      </Card>
    </div>
  );
}

function PrivacyToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-500 w-4 h-4 shrink-0" />
    </label>
  );
}
