import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Flame, Gift, Trophy, Users, TrendingUp, ShieldCheck, Calendar } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { WeatherHeader } from '@/components/WeatherHeader';
import { Card, Button, CoinBadge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { View } from '@/components/AppShell';

const checkinRewards = [20, 40, 60, 80, 100, 200, 300];

export function Dashboard({ setView }: { setView: (v: View) => void }) {
  const { t, profile, lang, refreshProfile } = useApp();
  const [todayChecked, setTodayChecked] = useState(false);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (profile) {
      const today = new Date().toISOString().slice(0, 10);
      setTodayChecked(profile.last_check_in === today);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('lumora_coins', profile?.lumora_coins ?? 0);
      setRank((count ?? 0) + 1);
    })();
  }, [profile?.lumora_coins]);

  const doCheckin = async () => {
    if (!profile || todayChecked) return;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = profile.last_check_in === yesterday ? profile.streak_days + 1 : 1;
    const dayIdx = Math.min(newStreak - 1, 6);
    const reward = checkinRewards[dayIdx];

    await supabase.from('check_ins').insert({ user_id: profile.id, day_number: newStreak, reward, check_date: today });
    await supabase.from('profiles').update({ lumora_coins: profile.lumora_coins + reward, streak_days: newStreak, last_check_in: today }).eq('id', profile.id);
    await supabase.from('transactions').insert({ user_id: profile.id, type: 'checkin', amount: reward, status: 'completed', note: `Check-in day ${newStreak}` });
    await refreshProfile();
    setTodayChecked(true);
  };

  if (!profile) return null;
  const banned = profile.banned;

  return (
    <div>
      <WeatherHeader />

      {banned && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-sm text-center">
          {t('bannedMsg')}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={<Coins size={20} />} label={t('lumoraCoin')} value={profile.lumora_coins.toLocaleString()} color="from-amber-500/20 to-orange-500/20 text-amber-300" />
        <StatCard icon={<Flame size={20} />} label={t('streak')} value={`${profile.streak_days} ${t('day')}`} color="from-orange-500/20 to-red-500/20 text-orange-300" />
        <StatCard icon={<TrendingUp size={20} />} label={t('trustScore')} value={profile.trust_score.toFixed(1)} color="from-blue-500/20 to-cyan-500/20 text-blue-300" />
        <StatCard icon={<Trophy size={20} />} label={t('rank')} value={`#${rank ?? '-'}`} color="from-purple-500/20 to-pink-500/20 text-purple-300" />
      </div>

      {/* Check-in card */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-amber-400" />
            <h3 className="font-semibold text-white">{t('dailyCheckin')}</h3>
          </div>
          {todayChecked ? (
            <span className="text-xs text-green-400">{t('checkinDone')}</span>
          ) : (
            <Button onClick={doCheckin} className="text-sm py-1.5">{t('claimReward')}</Button>
          )}
        </div>
        <div className="flex gap-1.5">
          {checkinRewards.map((r, i) => {
            const day = i + 1;
            const done = profile.streak_days >= day;
            return (
              <div key={i} className={`flex-1 text-center rounded-lg py-2 ${done ? 'bg-amber-500/30 border border-amber-500/40' : 'bg-slate-700/40 border border-white/5'}`}>
                <p className="text-[10px] text-slate-400">{t('day')} {day}</p>
                <p className={`text-xs font-bold ${done ? 'text-amber-300' : 'text-slate-500'}`}>{r}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction icon={<Gift size={22} />} label={t('spin')} onClick={() => setView('spin')} />
        <QuickAction icon={<Trophy size={22} />} label={t('leaderboard')} onClick={() => setView('leaderboard')} />
        <QuickAction icon={<ShieldCheck size={22} />} label={t('verifyId')} onClick={() => setView('profile')} />
      </div>

      {/* Referral card */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Users size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-300">{t('inviteFriends')}</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-amber-300 font-mono text-sm">{profile.referral_code}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(profile.referral_code || ''); }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Copy
              </button>
            </div>
          </div>
          <CoinBadge amount={500} />
        </div>
      </Card>

      <p className="text-center text-slate-500 text-xs mt-6">{t('letsEarn')}</p>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} className={`bg-gradient-to-br ${color} border border-white/10 rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-1 opacity-80">{icon}<span className="text-xs text-slate-300">{label}</span></div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </motion.div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 bg-slate-800/50 border border-white/10 rounded-2xl py-4 text-slate-300 hover:bg-slate-800"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </motion.button>
  );
}
