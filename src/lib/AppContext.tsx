import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, Profile } from './supabase';
import { Lang, t as translate, DictKey } from './i18n';

export type Theme = 'cyber' | 'matrix' | 'solar';

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

export const themeKeys: Theme[] = ['cyber', 'matrix', 'solar'];

function resolveTheme(raw: string | null): Theme {
  return raw && themeKeys.includes(raw as Theme) ? (raw as Theme) : 'cyber';
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
};

type AppState = {
  session: { user: { id: string } } | null;
  profile: Profile | null;
  loading: boolean;
  lang: Lang;
  theme: Theme;
  themeConfig: ThemeConfig;
  setLang: (l: Lang) => void;
  setTheme: (th: Theme) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: DictKey) => string;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppState['session']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>('bn');
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(localStorage.getItem('lumora_theme')));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-cyber', 'theme-matrix', 'theme-solar');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('lumora_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lumora_lang', lang);
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const setTheme = (th: Theme) => setThemeState(th);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!data) {
      await supabase.from('profiles').insert({
        id: uid,
        lumora_coins: 200,
        referral_code: 'LUM' + uid.slice(0, 6).toUpperCase(),
      });
      const { data: fresh } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile(fresh as Profile);
    } else {
      setProfile(data as Profile);
    }
  }, []);

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
    <Ctx.Provider value={{ session, profile, loading, lang, theme, themeConfig: themes[theme] ?? themes.cyber, setLang, setTheme, refreshProfile, signOut, t: tFn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
