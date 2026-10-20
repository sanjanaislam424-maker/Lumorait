import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, Profile } from '@/lib/supabase';
import { Card, EmptyState } from '@/components/ui';

export function Leaderboard() {
  const { t, profile } = useApp();
  const [top, setTop] = useState<Profile[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').order('lumora_coins', { ascending: false }).limit(50);
      setTop(data as Profile[] || []);
    })();
  }, []);

  const rankIcons = [
    <Crown key={0} size={20} className="text-amber-400" />,
    <Medal key={1} size={20} className="text-slate-300" />,
    <Medal key={2} size={20} className="text-orange-400" />,
  ];

  return (
    <div>
      <Card className="mb-4 text-center">
        <Trophy className="text-amber-400 mx-auto mb-1" size={28} />
        <h2 className="text-lg font-bold text-white">{t('leaderboard')}</h2>
        <p className="text-xs text-slate-400 mt-1">Top 50 • Monthly</p>
      </Card>

      {top.length === 0 ? <EmptyState message={t('leaderboard')} /> : (
        <div className="space-y-2">
          {top.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-3 rounded-xl p-3 border ${p.id === profile?.id ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/50 border-white/10'}`}
            >
              <div className="w-8 text-center font-bold text-slate-300">
                {i < 3 ? rankIcons[i] : <span className="text-sm">#{i + 1}</span>}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium truncate">{p.full_name || p.phone || 'User'}</p>
                <p className="text-xs text-slate-500">{t('streak')}: {p.streak_days} {t('day')}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500" />
                {p.lumora_coins.toLocaleString()} {t('lumoraCoins')}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
