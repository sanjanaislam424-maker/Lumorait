import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Snowflake, CloudRain, Cloud, Sun, Flame } from 'lucide-react';
import { useClock, useWeather, greetingKey } from '@/lib/weather';
import { useApp } from '@/lib/AppContext';

export function WeatherHeader() {
  const { t, profile, lang } = useApp();
  const now = useClock();
  const weather = useWeather();
  const [icon, setIcon] = useState(<Sun size={28} />);

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

  const gKey = greetingKey(now.getHours());
  const name = profile?.full_name || (lang === 'bn' ? 'বন্ধু' : 'buddy');

  return (
    <div className="relative overflow-hidden rounded-2xl neon-card p-5 mb-6">
      <WeatherParticles condition={weather.condition} />
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm neon-muted">{t(gKey)}, {name}!</p>
          <p className="text-xs neon-muted mt-0.5">{t('feelLikeHome')}</p>
          <p className="text-2xl font-bold neon-glow-text mt-1 tabular-nums" style={{ color: 'var(--neon-text)' }}>
            {now.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-2" style={{ background: 'var(--neon-card-bg)', border: '1px solid var(--neon-border)' }}>
          {icon}
          <div className="text-right">
            <p className="text-lg font-bold neon-text">{weather.temp}°C</p>
            <p className="text-xs neon-muted">{t(weather.condition as any)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherParticles({ condition }: { condition: string }) {
  if (condition === 'snowy') {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-sky-200/60"
            style={{ left: `${(i * 3.3) % 100}%`, top: '-10px' }}
            animate={{ y: ['0vh', '110vh'], opacity: [0, 1, 0] }}
            transition={{ duration: 5 + (i % 3), repeat: Infinity, delay: i * 0.2, ease: 'linear' }}
          >
            <Snowflake size={12 + (i % 3) * 4} />
          </motion.div>
        ))}
      </div>
    );
  }
  if (condition === 'hot') {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${(i * 8) % 100}%`, bottom: '0px' }}
            animate={{ y: ['0px', '-60px'], opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 2 + (i % 2), repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
          >
            <Flame size={16 + (i % 3) * 6} className="text-orange-500/40" />
          </motion.div>
        ))}
      </div>
    );
  }
  if (condition === 'rainy') {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-4 bg-blue-400/40 rounded"
            style={{ left: `${(i * 5) % 100}%`, top: '-10px' }}
            animate={{ y: ['0vh', '110vh'] }}
            transition={{ duration: 1.5 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.15, ease: 'linear' }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${10 + i * 25}%`, top: `${5 + (i % 2) * 8}px` }}
          animate={{ x: [0, 30, 0] }}
          transition={{ duration: 8 + i, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Cloud size={28} className="text-white/10" />
        </motion.div>
      ))}
    </div>
  );
}
