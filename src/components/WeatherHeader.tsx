import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Snowflake, CloudRain, Cloud, Sun, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClock, useWeather, greetingKey } from '@/lib/weather';
import { useApp } from '@/lib/AppContext';
import { useDailyAiContent } from '@/lib/useDailyAiContent';

// (Daily AI content is now handled by the useDailyAiContent hook)

export function WeatherHeader() {
  const { t, profile, lang } = useApp();
  const now = useClock();
  const weather = useWeather();
  const { content: aiContent } = useDailyAiContent();

  const [icon, setIcon] = useState(<Sun size={28} />);
  const [carouselTab, setCarouselTab] = useState<0 | 1>(0);
  const [dragStart, setDragStart] = useState<number | null>(null);

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

  const funnyText = lang === 'bn' ? aiContent.funny_bn : aiContent.funny_en;
  const tipText = lang === 'bn' ? aiContent.tip_bn : aiContent.tip_en;

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
