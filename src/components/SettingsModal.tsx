import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, Globe2, Lock, Monitor, Moon, Palette, Shield, Sparkles, Sun, Trash2 } from 'lucide-react';
import { Modal } from './ui';
import { useApp, type AiTone, type ThemeMode, themes } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import type { Lang } from '@/lib/i18n';

type SettingsTab = 'menu' | 'language' | 'theme' | 'aiTone' | 'security' | 'notifications' | 'account';

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

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, themeMode, setThemeMode, aiTone, setAiTone, themeConfig, profile, refreshProfile, signOut } = useApp();
  const { notify } = useToast();

  const [tab, setTab] = useState<SettingsTab>('menu');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [notif, setNotif] = useState({ tasks: true, payments: true, promo: true });

  useEffect(() => { if (open) setTab('menu'); }, [open]);

  useEffect(() => {
    if (profile) {
      setNotif({
        tasks: profile.notify_tasks,
        payments: profile.notify_payments,
        promo: profile.notify_promo,
      });
    }
  }, [profile]);

  if (!profile) return null;

  const menuItems: { id: SettingsTab; icon: typeof Globe2; label: string; sublabel: string }[] = [
    { id: 'language', icon: Globe2, label: t('settingsLanguage'), sublabel: lang === 'bn' ? 'বাংলা' : 'English' },
    { id: 'theme', icon: Palette, label: t('settingsTheme'), sublabel: lang === 'bn' ? '৬টি থিম' : '6 themes' },
    { id: 'aiTone', icon: Sparkles, label: t('settingsAiTone'), sublabel: aiTone === 'buddy' ? t('toneBuddy') : aiTone === 'mentor' ? t('toneMentor') : t('toneCoach') },
    { id: 'security', icon: Lock, label: t('settingsSecurity'), sublabel: t('settingsSecurityDesc') },
    { id: 'notifications', icon: Bell, label: t('settingsNotifications'), sublabel: t('settingsNotificationsDesc') },
    { id: 'account', icon: Trash2, label: t('settingsAccount'), sublabel: t('deleteAccount') },
  ];

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

  const changePassword = async () => {
    if (newPwd !== confirmPwd) { notify(t('passwordMismatch'), 'error'); return; }
    if (newPwd.length < 6) { notify(t('pwdWeakToast'), 'error'); return; }
    setPwdBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdBusy(false);
    if (error) { notify(t('passwordWrong'), 'error'); return; }
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    notify(t('passwordChanged'), 'success');
  };

  const saveNotifs = async (updated: typeof notif) => {
    setNotif(updated);
    await supabase.from('profiles').update({
      notify_tasks: updated.tasks,
      notify_payments: updated.payments,
      notify_promo: updated.promo,
    }).eq('id', profile.id);
    await refreshProfile();
    notify(t('notifSaved'), 'success');
  };

  const modeOptions: { id: ThemeMode; label: string; description: string; icon: typeof Monitor }[] = [
    { id: 'system', label: t('settingsSystem'), description: t('settingsSystemDesc'), icon: Monitor },
    { id: 'light', label: t('settingsLight'), description: lang === 'bn' ? 'উজ্জ্বল, পরিষ্কার এবং চোখের আরামদায়ক।' : 'Bright, clean, and easy on the eyes.', icon: Sun },
    { id: 'dark', label: t('settingsDark'), description: lang === 'bn' ? 'গভীর কনট্রাস্ট, রাতের জন্য আরামদায়ক।' : 'Deep contrast, comfortable for night use.', icon: Moon },
  ];

  const languageOptions: { id: Lang; label: string }[] = [
    { id: 'bn', label: 'বাংলা' },
    { id: 'en', label: 'English' },
  ];

  const notifOptions: { key: keyof typeof notif; label: string; desc: string }[] = [
    { key: 'tasks', label: t('notifTasks'), desc: t('notifTasksDesc') },
    { key: 'payments', label: t('notifPayments'), desc: t('notifPaymentsDesc') },
    { key: 'promo', label: t('notifPromo'), desc: t('notifPromoDesc') },
  ];

  const headerTitle = tab === 'menu' ? t('settingsTitle') : menuItems.find((m) => m.id === tab)?.label || t('settingsTitle');

  return (
    <Modal open={open} onClose={onClose} title={headerTitle}>
      <div className="min-h-[300px]">
        {/* ===== MENU ===== */}
        {tab === 'menu' && (
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setTab(item.id)} className="w-full flex items-center gap-3 rounded-xl p-4 text-left transition neon-btn-ghost">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${themeConfig.primary}15`, border: `1px solid ${themeConfig.border}` }}>
                    <Icon size={20} style={{ color: themeConfig.primary }} />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold neon-text">{item.label}</span>
                    <span className="block text-xs neon-muted mt-0.5 truncate">{item.sublabel}</span>
                  </span>
                  <ArrowLeft size={16} className="neon-muted rotate-180 shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* ===== LANGUAGE ===== */}
        {tab === 'language' && (
          <div className="space-y-4">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsLanguage')} themeConfig={themeConfig} />
            <div className="grid grid-cols-2 gap-2">
              {languageOptions.map((option) => (
                <button key={option.id} onClick={() => setLang(option.id)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm transition neon-btn-ghost" style={lang === option.id ? { borderColor: themeConfig.primary, color: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}>
                  <span>{option.label}</span>
                  {lang === option.id && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== THEME ===== */}
        {tab === 'theme' && (
          <div className="space-y-5">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsTheme')} themeConfig={themeConfig} />
            <div className="space-y-2">
              <p className="text-xs font-semibold neon-muted uppercase tracking-wide">{lang === 'bn' ? 'মোড' : 'Modes'}</p>
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const active = themeMode === option.id;
                return (
                  <button key={option.id} onClick={() => setThemeMode(option.id)} className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition neon-btn-ghost" style={active ? { borderColor: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}>
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
            <div className="space-y-2">
              <p className="text-xs font-semibold neon-muted uppercase tracking-wide">{t('settingsCustomThemes')}</p>
              <div className="grid grid-cols-3 gap-2">
                {customThemeIds.map((id) => {
                  const tc = themes[id as keyof typeof themes];
                  const active = themeMode === id;
                  return (
                    <button key={id} onClick={() => setThemeMode(id)} className="flex flex-col items-center gap-2 rounded-xl p-3 transition neon-btn-ghost" style={active ? { borderColor: tc.primary, boxShadow: `0 0 14px ${tc.glow}` } : undefined}>
                      <div className="flex gap-1">
                        {[tc.primary, tc.secondary, tc.accent].map((c) => (
                          <div key={c} className="w-5 h-5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium neon-text text-center">{lang === 'bn' ? customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].bn : customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].en}</span>
                      {active && <Check size={14} style={{ color: tc.primary }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== AI TONE ===== */}
        {tab === 'aiTone' && (
          <div className="space-y-4">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsAiTone')} themeConfig={themeConfig} />
            <div className="space-y-2">
              {toneOptions.map((option) => {
                const Icon = option.icon;
                const active = aiTone === option.id;
                return (
                  <button key={option.id} onClick={() => setAiTone(option.id)} className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition neon-btn-ghost" style={active ? { borderColor: themeConfig.primary, boxShadow: `0 0 14px ${themeConfig.glow}` } : undefined}>
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
          </div>
        )}

        {/* ===== SECURITY & PASSWORD ===== */}
        {tab === 'security' && (
          <div className="space-y-4">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsSecurity')} themeConfig={themeConfig} />
            <div className="flex items-center gap-3 mb-2">
              <Shield size={20} style={{ color: themeConfig.primary }} />
              <p className="text-sm neon-muted">{t('settingsSecurityDesc')}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs neon-muted block mb-1">{t('newPassword')}</label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs neon-muted block mb-1">{t('confirmPassword')}</label>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="••••••••" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
              </div>
              <button onClick={changePassword} disabled={pwdBusy} className="w-full px-4 py-2.5 rounded-xl font-medium transition neon-btn-primary text-sm disabled:opacity-50">
                {pwdBusy ? '...' : t('changePassword')}
              </button>
            </div>
          </div>
        )}

        {/* ===== NOTIFICATIONS ===== */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsNotifications')} themeConfig={themeConfig} />
            <div className="flex items-center gap-3 mb-2">
              <Bell size={20} style={{ color: themeConfig.primary }} />
              <p className="text-sm neon-muted">{t('settingsNotificationsDesc')}</p>
            </div>
            <div className="space-y-2">
              {notifOptions.map((option) => {
                const active = notif[option.key];
                return (
                  <button key={option.key} onClick={() => saveNotifs({ ...notif, [option.key]: !active })} className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition neon-btn-ghost">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: active ? `${themeConfig.primary}20` : 'rgba(100,116,139,0.1)' }}>
                      <Bell size={18} style={{ color: active ? themeConfig.primary : themeConfig.muted }} />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium neon-text">{option.label}</span>
                      <span className="block text-xs neon-muted mt-0.5">{option.desc}</span>
                    </span>
                    <div className="w-11 h-6 rounded-full p-0.5 transition shrink-0" style={{ background: active ? themeConfig.primary : 'rgba(100,116,139,0.3)' }}>
                      <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: active ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== ACCOUNT ===== */}
        {tab === 'account' && (
          <div className="space-y-4">
            <SectionBack onBack={() => setTab('menu')} label={t('settingsAccount')} themeConfig={themeConfig} />
            <button onClick={deleteAccount} className="w-full flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm transition hover:bg-red-500/15">
              <Trash2 size={18} /> {t('deleteAccount')}
            </button>
            <p className="text-xs neon-muted text-center">{t('confirmDelete')}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SectionBack({ onBack, label, themeConfig }: { onBack: () => void; label: string; themeConfig: { primary: string; muted: string } }) {
  return (
    <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium transition mb-1" style={{ color: themeConfig.primary }}>
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
