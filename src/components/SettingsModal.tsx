import { useEffect, useState } from 'react';
import { Check, Globe2, Monitor, Moon, Palette, ShieldCheck, Sparkles, Sun, Trash2, User as UserIcon, BadgeCheck, Clock, XCircle, FileWarning, AlertCircle } from 'lucide-react';
import { Modal } from './ui';
import { useApp, type AiTone, type ThemeMode, themes } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { KycModal, AppealModal } from '@/views/Profile';
import type { Lang } from '@/lib/i18n';

const toneOptions: { id: AiTone; title: 'toneBuddy' | 'toneMentor' | 'toneCoach'; description: 'toneBuddyDesc' | 'toneMentorDesc' | 'toneCoachDesc'; icon: typeof Sparkles }[] = [
  { id: 'buddy', title: 'toneBuddy', description: 'toneBuddyDesc', icon: Sparkles },
  { id: 'mentor', title: 'toneMentor', description: 'toneMentorDesc', icon: Monitor },
  { id: 'coach', title: 'toneCoach', description: 'toneCoachDesc', icon: Sun },
];

const customThemeIds: ThemeMode[] = ['cyber', 'matrix', 'solar'];

const customThemeLabels: Record<'cyber' | 'matrix' | 'solar', { bn: string; en: string }> = {
  cyber: { bn: 'সাইবারপাঙ্ক', en: 'Cyberpunk' },
  matrix: { bn: 'ম্যাট্রিক্স', en: 'Matrix' },
  solar: { bn: 'সোলার ফ্লেয়ার', en: 'Solar Flare' },
};

type KycStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'appeal_pending' | 'appeal_approved';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, themeMode, setThemeMode, aiTone, setAiTone, themeConfig, profile, refreshProfile, signOut } = useApp();
  const { notify } = useToast();

  const [name, setName] = useState(profile?.full_name || '');
  const [kycOpen, setKycOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>('none');

  useEffect(() => { setName(profile?.full_name || ''); }, [profile]);

  useEffect(() => {
    if (!open || !profile) return;
    (async () => {
      const { data } = await supabase
        .from('id_verifications')
        .select('status')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setKycStatus((data?.status as KycStatus) || 'none');
    })();
  }, [open, profile]);

  if (!profile) return null;

  const languageOptions: { id: Lang; label: string }[] = [
    { id: 'bn', label: 'বাংলা' },
    { id: 'en', label: 'English' },
  ];

  const modeOptions: { id: ThemeMode; label: string; description: string; icon: typeof Monitor }[] = [
    { id: 'system', label: t('settingsSystem'), description: t('settingsSystemDesc'), icon: Monitor },
    { id: 'light', label: t('settingsLight'), description: lang === 'bn' ? 'উজ্জ্বল, পরিষ্কার এবং চোখের আরামদায়ক।' : 'Bright, clean, and easy on the eyes.', icon: Sun },
    { id: 'dark', label: t('settingsDark'), description: lang === 'bn' ? 'গভীর কনট্রাস্ট, রাতের জন্য আরামদায়ক।' : 'Deep contrast, comfortable for night use.', icon: Moon },
  ];

  const saveProfile = async () => {
    await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id);
    await refreshProfile();
    notify(t('profileUpdated'), 'success');
  };

  const deleteAccount = async () => {
    if (!confirm(t('confirmDelete'))) return;
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

  const kycVerified = profile.kyc_verified || kycStatus === 'approved';

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('settingsTitle')}>
        <div className="space-y-6">
          {/* Profile & Account */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserIcon size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsProfile')}</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                  <UserIcon size={26} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium neon-text truncate">{profile.full_name || (lang === 'bn' ? 'ব্যবহারকারী' : 'User')}</p>
                  <p className="text-xs neon-muted truncate">{profile.phone || profile.id.slice(0, 8)}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {profile.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        <ShieldCheck size={10} /> {t('admin')}
                      </span>
                    )}
                    {kycVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-bold border border-green-500/30">
                        <BadgeCheck size={10} /> {t('kycVerified')}
                      </span>
                    )}
                    {kycStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                        <Clock size={10} /> {t('kycPending')}
                      </span>
                    )}
                    {kycStatus === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold border border-red-500/30">
                        <XCircle size={10} /> {t('kycRejected')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs neon-muted block mb-1">{t('fullName')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50"
                />
              </div>
              <button
                onClick={saveProfile}
                className="w-full px-4 py-2.5 rounded-xl font-medium transition neon-btn-primary text-sm"
              >
                {t('save')}
              </button>
            </div>
          </section>

          {/* KYC Verification */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsKyc')}</h4>
            </div>
            <div className="neon-card rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">{t('kycFee')}: 500 {t('lumoraCoins')}</p>
                  <p className="text-[10px] neon-muted">{t('kycFeeDesc')}</p>
                </div>
              </div>
              {!kycVerified && kycStatus !== 'pending' && kycStatus !== 'appeal_pending' && (
                <div className="flex gap-2">
                  {kycStatus === 'rejected' && (
                    <button
                      onClick={() => setAppealOpen(true)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs transition neon-btn-ghost"
                    >
                      <FileWarning size={14} className="inline mr-1" /> {t('appealTitle')}
                    </button>
                  )}
                  <button
                    onClick={() => setKycOpen(true)}
                    className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition neon-btn-primary"
                  >
                    {t('verify')}
                  </button>
                </div>
              )}
              {kycVerified && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <BadgeCheck size={14} /> {t('kycVerified')}
                </p>
              )}
            </div>
          </section>

          {/* Language */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe2 size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsLanguage')}</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {languageOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setLang(option.id)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm transition neon-btn-ghost"
                  style={lang === option.id ? { borderColor: themeConfig.primary, color: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}
                >
                  <span>{option.label}</span>
                  {lang === option.id && <Check size={16} />}
                </button>
              ))}
            </div>
          </section>

          {/* Theme Modes: System / Light / Dark */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Moon size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsTheme')}</h4>
            </div>
            <div className="space-y-2">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const active = themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setThemeMode(option.id)}
                    className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition neon-btn-ghost"
                    style={active ? { borderColor: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}
                  >
                    <Icon size={18} style={{ color: active ? themeConfig.primary : themeConfig.muted }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium neon-text">{option.label}</span>
                      <span className="block text-xs neon-muted mt-0.5">{option.description}</span>
                    </span>
                    {active && <Check size={16} style={{ color: themeConfig.primary }} />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Custom Accent Themes */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsCustomThemes')}</h4>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {customThemeIds.map((id) => {
                const tc = themes[id as keyof typeof themes];
                const active = themeMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => setThemeMode(id)}
                    className="flex flex-col items-center gap-2 rounded-xl p-3 transition neon-btn-ghost"
                    style={active ? { borderColor: tc.primary, boxShadow: `0 0 14px ${tc.glow}` } : undefined}
                  >
                    <div className="flex gap-1">
                      {[tc.primary, tc.secondary, tc.accent].map((c) => (
                        <div key={c} className="w-5 h-5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium neon-text text-center">
                      {lang === 'bn' ? customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].bn : customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].en}
                    </span>
                    {active && <Check size={14} style={{ color: tc.primary }} />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI Tone & Persona */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={17} style={{ color: themeConfig.primary }} />
              <h4 className="font-semibold neon-text">{t('settingsAiTone')}</h4>
            </div>
            <div className="space-y-2">
              {toneOptions.map((option) => {
                const Icon = option.icon;
                const active = aiTone === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setAiTone(option.id)}
                    className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition neon-btn-ghost"
                    style={active ? { borderColor: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}
                  >
                    <Icon size={18} style={{ color: active ? themeConfig.primary : themeConfig.muted }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium neon-text">{t(option.title)}</span>
                      <span className="block text-xs neon-muted mt-0.5">{t(option.description)}</span>
                    </span>
                    {active && <Check size={16} style={{ color: themeConfig.primary }} />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Account — Delete */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={17} className="text-red-400" />
              <h4 className="font-semibold neon-text">{t('settingsAccount')}</h4>
            </div>
            <button
              onClick={deleteAccount}
              className="w-full flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm transition hover:bg-red-500/15"
            >
              <Trash2 size={18} /> {t('deleteAccount')}
            </button>
          </section>
        </div>
      </Modal>

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
    </>
  );
}
