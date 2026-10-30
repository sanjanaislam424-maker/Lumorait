import { Check, Globe2, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { Modal } from './ui';
import { useApp, type AiTone, type ThemeMode } from '@/lib/AppContext';
import type { Lang } from '@/lib/i18n';

const toneOptions: { id: AiTone; title: 'toneBuddy' | 'toneMentor' | 'toneCoach'; description: 'toneBuddyDesc' | 'toneMentorDesc' | 'toneCoachDesc'; icon: typeof Sparkles }[] = [
  { id: 'buddy', title: 'toneBuddy', description: 'toneBuddyDesc', icon: Sparkles },
  { id: 'mentor', title: 'toneMentor', description: 'toneMentorDesc', icon: Monitor },
  { id: 'coach', title: 'toneCoach', description: 'toneCoachDesc', icon: Sun },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, themeMode, setThemeMode, aiTone, setAiTone, themeConfig } = useApp();

  const languageOptions: { id: Lang; label: string }[] = [
    { id: 'bn', label: 'বাংলা' },
    { id: 'en', label: 'English' },
  ];

  const themeOptions: { id: ThemeMode; label: string; description: string; icon: typeof Monitor }[] = [
    { id: 'system', label: t('settingsSystem'), description: t('settingsSystemDesc'), icon: Monitor },
    { id: 'light', label: t('settingsLight'), description: 'Bright, clean, and easy on the eyes.', icon: Sun },
    { id: 'dark', label: t('settingsDark'), description: 'Deep contrast with a focused night mode.', icon: Moon },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('settingsTitle')}>
      <div className="space-y-6">
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

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sun size={17} style={{ color: themeConfig.primary }} />
            <h4 className="font-semibold neon-text">{t('settingsTheme')}</h4>
          </div>
          <div className="space-y-2">
            {themeOptions.map((option) => {
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
          <p className="text-[11px] neon-muted mt-2">{lang === 'bn' ? 'সিস্টেম ডিফল্ট বেছে নিলে ডিভাইসের পছন্দ নিজে থেকেই অনুসরণ হবে।' : 'System Default follows your device preference automatically.'}</p>
        </section>

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
      </div>
    </Modal>
  );
}
