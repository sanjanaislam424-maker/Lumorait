import { Check, Globe2, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { Modal } from './ui';
import { useApp, type AiTone, type ThemeMode, themes } from '@/lib/AppContext';
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

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, themeMode, setThemeMode, aiTone, setAiTone, themeConfig } = useApp();

  const languageOptions: { id: Lang; label: string }[] = [
    { id: 'bn', label: 'বাংলা' },
    { id: 'en', label: 'English' },
  ];

  const modeOptions: { id: ThemeMode; label: string; description: string; icon: typeof Monitor }[] = [
    { id: 'system', label: t('settingsSystem'), description: t('settingsSystemDesc'), icon: Monitor },
    { id: 'light', label: t('settingsLight'), description: lang === 'bn' ? 'উজ্জ্বল, পরিষ্কার এবং চোখের আরামদায়ক।' : 'Bright, clean, and easy on the eyes.', icon: Sun },
    { id: 'dark', label: t('settingsDark'), description: lang === 'bn' ? 'গভীর কনট্রাস্ট, রাতের জন্য আরামদায়ক।' : 'Deep contrast, comfortable for night use.', icon: Moon },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('settingsTitle')}>
      <div className="space-y-6">
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
            <h4 className="font-semibold neon-text">{lang === 'bn' ? 'কাস্টম থিম' : 'Custom Themes'}</h4>
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
                  <span className="text-[11px] font-medium neon-text text-center">{lang === 'bn' ? customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].bn : customThemeLabels[id as 'cyber' | 'matrix' | 'solar'].en}</span>
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
      </div>
    </Modal>
  );
}
