import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, Profile } from './supabase';
import { Lang, t as translate, DictKey } from './i18n';

export type Theme = 'cyber' | 'matrix' | 'solar' | 'light' | 'dark';
export type ThemeMode = 'system' | Theme;

export type AiTone = 'buddy' | 'mentor' | 'coach';

export const aiToneKeys: AiTone[] = ['buddy', 'mentor', 'coach'];

export type ThemeConfig = {
  id: Theme;
  name: string;
  nameBn: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  bg: string;
  bgGradient: string;
  cardBg: string;
  border: string;
  text: string;
  muted: string;
};

export const themeKeys: Theme[] = ['cyber', 'matrix', 'solar', 'light', 'dark'];

function resolveTheme(raw: string | null): Theme {
  return raw && themeKeys.includes(raw as Theme) ? (raw as Theme) : 'cyber';
}

function resolveThemeMode(raw: string | null): ThemeMode {
  if (raw === 'system') return 'system';
  return resolveTheme(raw);
}

function resolveAiTone(raw: string | null): AiTone {
  return raw && aiToneKeys.includes(raw as AiTone) ? (raw as AiTone) : 'buddy';
}

export const themes: Record<Theme, ThemeConfig> = {
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk Neon',
    nameBn: 'সাইবারপাঙ্ক নিয়ন',
    primary: '#22d3ee',
    secondary: '#3b82f6',
    accent: '#06b6d4',
    glow: 'rgba(34, 211, 238, 0.4)',
    bg: '#030712',
    bgGradient: 'linear-gradient(180deg, #030712 0%, #0a0f1e 50%, #030712 100%)',
    cardBg: 'rgba(8, 16, 33, 0.6)',
    border: 'rgba(34, 211, 238, 0.2)',
    text: '#e0f2fe',
    muted: '#64748b',
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix Emerald',
    nameBn: 'ম্যাট্রিক্স সবুজ',
    primary: '#22c55e',
    secondary: '#16a34a',
    accent: '#4ade80',
    glow: 'rgba(34, 197, 94, 0.4)',
    bg: '#02140a',
    bgGradient: 'linear-gradient(180deg, #02140a 0%, #052016 50%, #02140a 100%)',
    cardBg: 'rgba(5, 25, 18, 0.6)',
    border: 'rgba(34, 197, 94, 0.2)',
    text: '#d1fae5',
    muted: '#4b6b54',
  },
  solar: {
    id: 'solar',
    name: 'Solar Flare',
    nameBn: 'সোলার ফ্লেয়ার',
    primary: '#fbbf24',
    secondary: '#f59e0b',
    accent: '#fb923c',
    glow: 'rgba(251, 191, 36, 0.4)',
    bg: '#0a0301',
    bgGradient: 'linear-gradient(180deg, #0a0301 0%, #1a0a02 50%, #0a0301 100%)',
    cardBg: 'rgba(20, 10, 3, 0.6)',
    border: 'rgba(251, 191, 36, 0.2)',
    text: '#fef3c7',
    muted: '#78716c',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    nameBn: 'ডার্ক',
    primary: '#38bdf8',
    secondary: '#2563eb',
    accent: '#22d3ee',
    glow: 'rgba(56, 189, 248, 0.32)',
    bg: '#020617',
    bgGradient: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
    cardBg: 'rgba(15, 23, 42, 0.72)',
    border: 'rgba(148, 163, 184, 0.22)',
    text: '#e2e8f0',
    muted: '#94a3b8',
  },
  light: {
    id: 'light',
    name: 'Light',
    nameBn: 'লাইট',
    primary: '#0369a1',
    secondary: '#2563eb',
    accent: '#0891b2',
    glow: 'rgba(3, 105, 161, 0.18)',
    bg: '#f8fafc',
    bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #e0f2fe 55%, #f8fafc 100%)',
    cardBg: 'rgba(255, 255, 255, 0.82)',
    border: 'rgba(3, 105, 161, 0.2)',
    text: '#0f172a',
    muted: '#475569',
  },
};

type AppState = {
  session: { user: { id: string } } | null;
  profile: Profile | null;
  loading: boolean;
  lang: Lang;
  theme: Theme;
  themeMode: ThemeMode;
  themeConfig: ThemeConfig;
  aiTone: AiTone;
  logoUrl: string | null;
  refreshLogo: () => Promise<void>;
  setLang: (l: Lang) => void;
  setThemeMode: (tm: ThemeMode) => void;
  setAiTone: (tone: AiTone) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: DictKey) => string;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppState['session']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('lumora_lang');
    return saved === 'en' || saved === 'bn' ? saved : 'bn';
  });
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => resolveThemeMode(localStorage.getItem('lumora_theme_mode')));
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(localStorage.getItem('lumora_theme')));
  const [aiTone, setAiToneState] = useState<AiTone>(() => resolveAiTone(localStorage.getItem('lumora_ai_tone')));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Resolve actual theme from mode + system preference
  useEffect(() => {
    if (themeMode !== 'system') {
      setThemeState(themeMode);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved: Theme = mq.matches ? 'light' : 'dark';
      setThemeState(resolved);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);

  // Apply theme CSS classes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-cyber', 'theme-matrix', 'theme-solar', 'theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
    root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    localStorage.setItem('lumora_theme', theme);
    localStorage.setItem('lumora_theme_mode', themeMode);
  }, [theme, themeMode]);

  useEffect(() => {
    localStorage.setItem('lumora_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('lumora_ai_tone', aiTone);
  }, [aiTone]);

  // Sync aiTone to database when profile is available
  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').update({ ai_tone: aiTone }).eq('id', session.user.id).then(() => {});
  }, [aiTone, session]);

  // Load aiTone from database on profile fetch
  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!data) {
      await supabase.from('profiles').insert({
        id: uid,
        lumora_coins: 200,
        referral_code: 'LUM' + uid.slice(0, 6).toUpperCase(),
        ai_tone: aiTone,
      });
      const { data: fresh } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile(fresh as Profile);
    } else {
      setProfile(data as Profile);
      const dbTone = (data as any).ai_tone as string | undefined;
      if (dbTone && (dbTone === 'buddy' || dbTone === 'mentor' || dbTone === 'coach') && dbTone !== aiTone) {
        setAiToneState(dbTone);
      }
    }
  }, [aiTone]);

  const setLang = (l: Lang) => setLangState(l);
  const setThemeMode = (tm: ThemeMode) => setThemeModeState(tm);
  const setAiTone = (tone: AiTone) => setAiToneState(tone);

  const fetchLogo = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('app_logo_url').eq('id', 1).maybeSingle();
    setLogoUrl(data?.app_logo_url ?? null);
  }, []);

  useEffect(() => { fetchLogo(); }, [fetchLogo]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({ user: { id: data.session.user.id } });
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        if (sess) {
          setSession({ user: { id: sess.user.id } });
          await fetchProfile(sess.user.id);
        } else {
          setSession(null);
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  // Realtime: auto-refresh profile when the user's row changes (e.g. admin refund)
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`profiles:${session.user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        () => { fetchProfile(session.user.id); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const tFn = useCallback((key: DictKey) => translate(lang, key), [lang]);

  return (
    <Ctx.Provider value={{ session, profile, loading, lang, theme, themeMode, themeConfig: themes[theme] ?? themes.cyber, aiTone, logoUrl, refreshLogo: fetchLogo, setLang, setThemeMode, setAiTone, refreshProfile, signOut, t: tFn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
