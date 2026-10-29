import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface DailyAiContent {
  funny_bn: string;
  funny_en: string;
  tip_bn: string;
  tip_en: string;
}

const STATIC_FALLBACK: DailyAiContent = {
  funny_bn: 'ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে!',
  funny_en: "Facebook's algorithm knows your ex better than you!",
  tip_bn: 'ফেসবুক পেজ রিচ বাড়াতে প্রতিদিন সকাল ৯টা ও রাত ৮টায় পোস্ট করো!',
  tip_en: 'Post on Facebook at 9 AM and 8 PM daily for peak reach!',
};

const LS_KEY = 'lumora_daily_ai_content';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

interface CacheEntry {
  date: string;
  ts: number;
  content: DailyAiContent;
}

function getLSCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.date !== todayStr()) return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setLSCache(content: DailyAiContent) {
  try {
    const entry: CacheEntry = { date: todayStr(), ts: Date.now(), content };
    localStorage.setItem(LS_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function useDailyAiContent(): { content: DailyAiContent; loading: boolean } {
  const [content, setContent] = useState<DailyAiContent>(() => {
    const cached = getLSCache();
    return cached?.content ?? STATIC_FALLBACK;
  });
  const [loading, setLoading] = useState(!getLSCache());
  const fetchedDateRef = useRef<string | null>(null);

  const fetchContent = useCallback(async (force = false) => {
    const today = todayStr();

    if (!force && fetchedDateRef.current === today) {
      const cached = getLSCache();
      if (cached) return;
    }

    fetchedDateRef.current = today;
    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from('daily_ai_content')
        .select('funny_bn, funny_en, tip_bn, tip_en')
        .eq('content_date', today)
        .maybeSingle();

      if (existing && (existing.funny_bn || existing.tip_bn)) {
        const c = existing as DailyAiContent;
        setContent(c);
        setLSCache(c);
        setLoading(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-ai-content`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && (data.funny_bn || data.tip_bn)) {
          const c = {
            funny_bn: data.funny_bn,
            funny_en: data.funny_en,
            tip_bn: data.tip_bn,
            tip_en: data.tip_en,
          } as DailyAiContent;
          setContent(c);
          setLSCache(c);
          setLoading(false);
          return;
        }
      }
      setContent(STATIC_FALLBACK);
      setLSCache(STATIC_FALLBACK);
    } catch {
      setContent(STATIC_FALLBACK);
      setLSCache(STATIC_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  // Midnight rollover checker: every 60s, check if date changed
  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      const cached = getLSCache();
      if (!cached || cached.date !== today) {
        fetchContent(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  return { content, loading };
}
