import { useEffect, useState } from 'react';

export type Weather = {
  temp: number;
  condition: 'sunny' | 'rainy' | 'cloudy' | 'snowy' | 'hot';
  label: string;
};

function seasonCondition(): Weather['condition'] {
  const m = new Date().getMonth();
  if (m >= 5 && m <= 8) return Math.random() > 0.4 ? 'hot' : 'rainy';
  if (m === 11 || m === 0 || m === 1) return Math.random() > 0.5 ? 'snowy' : 'cloudy';
  if (m >= 2 && m <= 4) return Math.random() > 0.5 ? 'sunny' : 'cloudy';
  return 'cloudy';
}

function baseTemp(c: Weather['condition']): number {
  switch (c) {
    case 'hot': return 36;
    case 'sunny': return 28;
    case 'rainy': return 24;
    case 'cloudy': return 22;
    case 'snowy': return 4;
  }
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather>(() => {
    const c = seasonCondition();
    return { temp: baseTemp(c), condition: c, label: c };
  });

  useEffect(() => {
    const c = seasonCondition();
    setWeather({ temp: baseTemp(c) + Math.floor(Math.random() * 5 - 2), condition: c, label: c });
    const iv = setInterval(() => {
      setWeather((w) => ({ ...w, temp: w.temp + Math.floor(Math.random() * 3 - 1) }));
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  return weather;
}

export function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export function greetingKey(hour: number) {
  if (hour < 6) return 'goodNight' as const;
  if (hour < 12) return 'goodMorning' as const;
  if (hour < 17) return 'goodAfternoon' as const;
  if (hour < 21) return 'goodEvening' as const;
  return 'goodNight' as const;
}
