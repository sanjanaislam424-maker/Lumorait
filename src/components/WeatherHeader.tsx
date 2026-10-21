import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Snowflake, CloudRain, Cloud, Sun, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClock, useWeather, greetingKey } from '@/lib/weather';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';

// ---- Static fallback content (used if edge function / DB fails) ----
const FALLBACK = {
  funny_bn: [
    'ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে!',
    'ভাইরাল হওয়ার আগে কনফিডেন্স লাগে — তোমার কনটেন্ট নাকি হিম্মত?',
    'ফ্রিল্যান্সিং মানে স্বাধীনতা? ক্লায়েন্ট না দিলে ঘুমানোর স্বাধীনতা!',
    'মাইক্রো-টাস্ক করে কোটিপতি হওয়া যায় না, কিন্তু চা-ও বানানো যায় না না করলে!',
  ],
  funny_en: [
    "Facebook's algorithm knows your ex better than you!",
    'Going viral takes confidence — your content or your courage?',
    'Freelancing means freedom? Freedom to sleep without clients!',
    "Micro-tasks won't make you rich, but without them no tea either!",
  ],
  tip_bn: [
    'ফেসবুক পেজ রিচ বাড়াতে প্রতিদিন সকাল ৯টা ও রাত ৮টায় পোস্ট করো!',
    'ইউটিউব শর্টস আপলোড করো বিকেল ৫টা থেকে রাত ৯টা — অ্যালগরিদম সবচেয়ে সক্রিয়!',
    'টাস্ক প্রমাণে ভালো স্ক্রিনশট দাও — অ্যাপ্রুভ পাওয়ার সম্ভাবনা ৩x বাড়ে!',
    'ভিডিওর প্রথম ৩ সেকেন্ডে হুক রাখো — নাহলে দর্শক স্ক্রল করে যাবে!',
  ],
  tip_en: [
    'Post on Facebook at 9 AM and 8 PM daily for peak reach!',
    'Upload YouTube Shorts 5-9 PM — the algorithm is most active!',
    'High-quality screenshots as task proof triple approval chances!',
    'Hook viewers in the first 3 seconds or they scroll away!',
  ],
};

type AIContent = { funny_bn: string; funny_en: string; tip_bn: string; tip_en: string };

function pickFallback(lang: 'bn' | 'en', type: 'funny' | 'tip'): string {
  const arr = lang === 'bn'
    ? (type === 'funny' ? FALLBACK.funny_bn : FALLBACK.tip_bn)
    : (type === 'funny' ? FALLBACK.funny_en : FALLBACK.tip_en);
  return arr[Math.floor(Math.random() * arr.length)];
}

export function WeatherHeader() {
  const { t, profile, lang } = useApp();
  const now = useClock();
  const weather = useWeather();

  const [icon, setIcon] = useState(<Sun size={28} />);
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [carouselTab, setCarouselTab] = useState<0 | 1>(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const fetchedDateRef = useRef<string | null>(null);

  // ---- Fetch daily AI content (once per day) ----
  const fetchAIContent = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    if (fetchedDateRef.current === today && aiContent) return;
    fetchedDateRef.current = today;

    try {
      // Try DB first
      const { data: existing } = await supabase
        .from('daily_ai_content')
        .select('funny_bn, funny_en, tip_bn, tip_en')
        .eq('content_date', today)
        .maybeSingle();

      if (existing && (existing.funny_bn || existing.tip_bn)) {
        setAiContent(existing as AIContent);
        return;
      }

      // Trigger edge function to generate + cache
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-ai-content`;
      const res = await fetch(funcUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && (data.funny_bn || data.tip_bn)) {
          setAiContent(data as AIContent);
          return;
        }
      }
      // Fallback to static content
      setAiContent({
        funny_bn: pickFallback('bn', 'funny'),
        funny_en: pickFallback('en', 'funny'),
        tip_bn: pickFallback('bn', 'tip'),
        tip_en: pickFallback('en', 'tip'),
      });
    } catch {
      setAiContent({
        funny_bn: pickFallback('bn', 'funny'),
        funny_en: pickFallback('en', 'funny'),
        tip_bn: pickFallback('bn', 'tip'),
        tip_en: pickFallback('en', 'tip'),
      });
    }
  }, [aiContent]);

  useEffect(() => { fetchAIContent(); }, [fetchAIContent]);

  // ---- Weather icon ----
  useEffect(() => {
    const icons: Record<string, JSX.Element> = {
      sunny: <Sun size={28} className="text-amber-400" />,
      hot: <Flame size={28} className="text-orange-500" />,
      rainy: <CloudRain size={28} className="text-blue-400" />,
      cloudy: <Cloud size={28} className="text-gray-400" />,
      snowy: <Snowflake size={28} className="text-sky-200" />,
    };
    setIcon(icons[weather.condition] ?? <Sun size={28} />);
  }, [weather.condition]);

  // ---- Auto-rotate carousel every 6 seconds ----
  useEffect(() => {
    const iv = setInterval(() => {
      setCarouselTab((prev) => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  const gKey = greetingKey(now.getHours());
  const name = profile?.full_name || (lang === 'bn' ? 'বন্ধু' : 'buddy');

  const funnyText = lang === 'bn' ? aiContent?.funny_bn : aiContent?.funny_en;
  const tipText = lang === 'bn' ? aiContent?.tip_bn : aiContent?.tip_en;

  // ---- Swipe handlers ----
  const handleTouchStart = (e: React.TouchEvent) => setDragStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    const delta = e.changedTouches[0].clientX - dragStart;
    if (Math.abs(delta) > 50) {
      if (delta > 0) setCarouselTab(0);
      else setCarouselTab(1);
    }
    setDragStart(null);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl neon-card p-5 mb-6" style={{ perspective: '1000px' }}>
      {/* 3D atmospheric layer */}
      <Atmosphere3D condition={weather.condition} />

      <div className="relative z-10">
        {/* Time + weather row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm neon-muted">{t(gKey)}, {name}!</p>
            <p className="text-xs neon-muted mt-0.5">{t('feelLikeHome')}</p>
            <p className="text-2xl font-bold neon-glow-text mt-1 tabular-nums" style={{ color: 'var(--neon-text)' }}>
              {now.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2"
            style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', border: '1px solid var(--neon-border)' }}
          >
            {icon}
            <div className="text-right">
              <p className="text-lg font-bold neon-text">{weather.temp}°C</p>
              <p className="text-xs neon-muted">{t(weather.condition as any)}</p>
            </div>
          </div>
        </div>

        {/* ===== DUAL AI CAROUSEL ===== */}
        <div
          className="mt-4 relative rounded-xl overflow-hidden"
          style={{
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--neon-border)',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Tab indicators */}
          <div className="flex items-center gap-1 px-3 pt-2.5">
            <button
              onClick={() => setCarouselTab(0)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition"
              style={carouselTab === 0 ? {
                background: 'var(--neon-primary)',
                color: '#000',
              } : { color: 'var(--neon-muted)' }}
            >
              {lang === 'bn' ? '🎭 ফানি কৌতুক' : '🎭 Funny Quote'}
            </button>
            <button
              onClick={() => setCarouselTab(1)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition"
              style={carouselTab === 1 ? {
                background: 'var(--neon-primary)',
                color: '#000',
              } : { color: 'var(--neon-muted)' }}
            >
              {lang === 'bn' ? '🎯 গ্রোথ টিপস' : '🎯 Growth Tip'}
            </button>
          </div>

          {/* Content area */}
          <div className="px-3 pb-2 pt-2 min-h-[64px] flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselTab}
                initial={{ opacity: 0, x: carouselTab === 0 ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: carouselTab === 0 ? 30 : -30 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full"
              >
                <p className="text-sm leading-relaxed" style={{ color: 'var(--neon-text)' }}>
                  {carouselTab === 0 ? (funnyText || '...') : (tipText || '...')}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dot controls + arrows */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <button
              onClick={() => setCarouselTab(0)}
              className="p-1 rounded-lg transition hover:bg-white/10"
              style={{ color: 'var(--neon-muted)', opacity: carouselTab === 0 ? 0.3 : 0.8 }}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-2">
              {[0, 1].map((i) => (
                <button
                  key={i}
                  onClick={() => setCarouselTab(i as 0 | 1)}
                  className="rounded-full transition-all"
                  style={{
                    width: carouselTab === i ? 20 : 7,
                    height: 7,
                    background: carouselTab === i ? 'var(--neon-primary)' : 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setCarouselTab(1)}
              className="p-1 rounded-lg transition hover:bg-white/10"
              style={{ color: 'var(--neon-muted)', opacity: carouselTab === 1 ? 0.3 : 0.8 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 3D ATMOSPHERIC EFFECTS =====
function Atmosphere3D({ condition }: { condition: string }) {
  if (condition === 'snowy') return <SnowyAtmosphere />;
  if (condition === 'rainy') return <RainyAtmosphere />;
  if (condition === 'hot') return <HotAtmosphere />;
  if (condition === 'sunny') return <SunnyAtmosphere />;
  return <CloudyAtmosphere />;
}

// ---- Cloudy: volumetric 3D clouds with depth ----
function CloudyAtmosphere() {
  const clouds = [
    { x: '5%', y: '10px', size: 60, depth: 30, duration: 12, opacity: 0.08 },
    { x: '30%', y: '5px', size: 80, depth: 10, duration: 15, opacity: 0.06 },
    { x: '55%', y: '15px', size: 50, depth: 50, duration: 10, opacity: 0.1 },
    { x: '75%', y: '8px', size: 70, depth: 20, duration: 14, opacity: 0.07 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
      {clouds.map((c, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: c.x, top: c.y,
            transform: `translateZ(${c.depth}px)`,
            filter: `blur(${c.depth > 30 ? 2 : 4}px)`,
          }}
          animate={{ x: [0, 40, 0], y: [0, 6, 0] }}
          transition={{ duration: c.duration, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Cloud size={c.size} style={{ color: `rgba(255,255,255,${c.opacity})` }} />
        </motion.div>
      ))}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(100,116,139,0.06) 0%, transparent 40%, rgba(100,116,139,0.04) 100%)',
      }} />
    </div>
  );
}

// ---- Rainy: 3D raindrops + lightning + wet glass refraction ----
function RainyAtmosphere() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
    }, 4000 + Math.random() * 4000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Lightning flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-white"
          />
        )}
      </AnimatePresence>

      {/* Raindrops with depth */}
      {Array.from({ length: 25 }).map((_, i) => {
        const depth = (i * 37 % 100) / 100;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 4 + (i % 3)) % 100}%`,
              top: '-10px',
              width: 1.5 + depth * 1.5,
              height: 12 + depth * 8,
              background: `rgba(147,197,253,${0.3 + depth * 0.3})`,
              filter: `blur(${depth < 0.5 ? 0.5 : 0}px)`,
              transform: `translateZ(${depth * 40}px)`,
            }}
            animate={{ y: ['0vh', '120vh'] }}
            transition={{ duration: 1.2 + depth * 0.6, repeat: Infinity, delay: i * 0.1, ease: 'linear' }}
          />
        );
      })}

      {/* Wet glass refraction overlay */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, transparent 50%, rgba(59,130,246,0.03) 100%)',
        backdropFilter: 'blur(0.5px)',
      }} />
    </div>
  );
}

// ---- Snowy: 3D snowflakes + icy frost edges ----
function SnowyAtmosphere() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 25 }).map((_, i) => {
        const depth = (i * 29 % 100) / 100;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${(i * 4 + (i % 3)) % 100}%`,
              top: '-10px',
              transform: `translateZ(${depth * 50}px)`,
              filter: `blur(${depth < 0.5 ? 0 : 1}px)`,
            }}
            animate={{
              y: ['0vh', '110vh'],
              x: [0, 15, -10, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 5 + depth * 4,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'linear',
            }}
          >
            <Snowflake size={8 + depth * 8} style={{ color: `rgba(186,230,253,${0.4 + depth * 0.3})` }} />
          </motion.div>
        );
      })}
      {/* Icy frost on edges */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: [
          'linear-gradient(180deg, rgba(186,230,253,0.15) 0%, transparent 15%)',
          'linear-gradient(0deg, rgba(186,230,253,0.12) 0%, transparent 12%)',
          'linear-gradient(90deg, rgba(186,230,253,0.1) 0%, transparent 10%)',
          'linear-gradient(270deg, rgba(186,230,253,0.1) 0%, transparent 10%)',
        ].join(', '),
        filter: 'blur(3px)',
      }} />
    </div>
  );
}

// ---- Hot: 3D sun + lens flare + heat shimmer + sunbeams ----
function HotAtmosphere() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* 3D Sun with lens flare */}
      <motion.div
        className="absolute"
        style={{ top: '-30px', right: '10%', transform: 'translateZ(40px)' }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="relative">
          {/* Core glow */}
          <div className="absolute inset-0 rounded-full" style={{
            width: 80, height: 80,
            background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(251,146,60,0.2) 40%, transparent 70%)',
            filter: 'blur(12px)',
          }} />
          {/* Sun body */}
          <div className="relative rounded-full" style={{
            width: 50, height: 50,
            background: 'radial-gradient(circle at 35% 35%, #fef3c7, #fbbf24 40%, #f59e0b 70%, #d97706)',
            boxShadow: '0 0 40px rgba(251,191,36,0.6), 0 0 80px rgba(251,146,60,0.3)',
          }} />
        </div>
      </motion.div>

      {/* Sunbeams */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: '-20px',
            right: '15%',
            width: 3,
            height: '120%',
            transformOrigin: 'top center',
            transform: `rotate(${i * 30}deg) translateZ(20px)`,
            background: 'linear-gradient(180deg, rgba(251,191,36,0.08), transparent)',
            filter: 'blur(2px)',
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
        />
      ))}

      {/* Heat shimmer */}
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={`heat-${i}`}
          className="absolute"
          style={{
            left: `${(i * 10) % 100}%`,
            bottom: '0px',
            width: 20,
            height: 60,
            background: 'linear-gradient(0deg, rgba(251,146,60,0.06), transparent)',
            filter: 'blur(8px)',
            transform: 'translateZ(5px)',
          }}
          animate={{ y: [0, -40], opacity: [0, 0.6, 0], scaleX: [1, 1.5, 1] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ---- Sunny (mild): warm ambient sunbeams ----
function SunnyAtmosphere() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Warm ambient glow */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 80% 0%, rgba(251,191,36,0.12) 0%, transparent 50%)',
      }} />
      {/* Gentle sunbeams */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: '-10px',
            right: `${10 + i * 15}%`,
            width: 2,
            height: '100%',
            transformOrigin: 'top center',
            transform: `rotate(${10 + i * 8}deg) translateZ(10px)`,
            background: 'linear-gradient(180deg, rgba(251,191,36,0.06), transparent)',
            filter: 'blur(3px)',
          }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Small sun */}
      <motion.div
        className="absolute rounded-full"
        style={{
          top: '-15px', right: '8%',
          width: 40, height: 40,
          transform: 'translateZ(30px)',
          background: 'radial-gradient(circle at 35% 35%, #fde68a, #fbbf24 50%, #f59e0b)',
          boxShadow: '0 0 30px rgba(251,191,36,0.4), 0 0 60px rgba(251,191,36,0.2)',
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
