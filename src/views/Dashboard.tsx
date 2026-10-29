import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Flame, Gift, Trophy, Users, TrendingUp, ShieldCheck, Calendar, Sparkles, Calculator, Wallet as WalletIcon, Lightbulb } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { WeatherHeader } from '@/components/WeatherHeader';
import { Card, Button, CoinBadge, Modal } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { View } from '@/components/AppShell';
import { microcopy } from '@/lib/microcopy';

const checkinRewards = [20, 40, 60, 80, 100, 200, 300];

export function Dashboard({ setView }: { setView: (v: View) => void }) {
  const { t, profile, lang, refreshProfile } = useApp();
  const [todayChecked, setTodayChecked] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [referralStats, setReferralStats] = useState({ active: 0, total: 0 });
  const [calcOpen, setCalcOpen] = useState(false);

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

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { count: total } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', profile.id);
      const { count: active } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', profile.id).eq('referral_step2_paid', true);
      setReferralStats({ active: active ?? 0, total: total ?? 0 });
    })();
  }, [profile?.id]);

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

      {/* AI-generated witty alert */}
      {!banned && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl p-3 border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/5"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-200">{microcopy.dashboardAlert()}</p>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <motion.div whileTap={{ scale: 0.97 }} onClick={() => setCalcOpen(true)} className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/10 rounded-2xl p-4 cursor-pointer text-amber-300">
          <div className="flex items-center gap-2 mb-1 opacity-80"><Coins size={20} /><span className="text-xs text-slate-300">{t('lumoraCoin')}</span><Calculator size={12} className="ml-auto opacity-50" /></div>
          <p className="text-2xl font-bold text-white">{profile.lumora_coins.toLocaleString()}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] bg-green-500/10 rounded px-1.5 py-0.5 text-green-400">{t('withdrawableCoins')}: {(profile.withdrawable_coins || 0).toLocaleString()}</span>
          </div>
        </motion.div>
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

      {/* AI-generated daily tip */}
      <div className="mb-4 rounded-2xl p-4 border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Lightbulb size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-blue-400 font-bold mb-1">AI TIPPONY</p>
            <p className="text-sm text-blue-200 leading-relaxed">{microcopy.dailyTip()}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction icon={<Gift size={22} />} label={t('spin')} onClick={() => setView('spin')} />
        <QuickAction icon={<Trophy size={22} />} label={t('leaderboard')} onClick={() => setView('leaderboard')} />
        <QuickAction icon={<ShieldCheck size={22} />} label={t('verifyId')} onClick={() => setView('profile')} />
      </div>

      {/* Referral promotional banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.1) 50%, rgba(251,191,36,0.12) 100%)',
          border: '1px solid rgba(34,197,94,0.3)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-300">{t('referralTitle')}</p>
            <p className="text-xs text-amber-200 mt-1 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-400" /> {t('referralKycReward')}
            </p>
            <p className="text-xs text-green-200 mt-1 flex items-center gap-1">
              <Sparkles size={11} className="text-green-400" /> {t('referralLifetimeMsg')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Referral card with 2-step rewards */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
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
          <div className="text-right">
            <p className="text-xs text-slate-400">{t('referralActive')}</p>
            <p className="text-lg font-bold text-green-300">{referralStats.active}/{referralStats.total}</p>
          </div>
        </div>

        {/* 2-step reward breakdown */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-green-400 font-bold mb-1">{lang === 'bn' ? 'ধাপ ১' : 'Step 1'}</p>
            <p className="text-lg font-bold text-green-300">+500</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t('referralStep1')}</p>
          </div>
          <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 font-bold mb-1">{lang === 'bn' ? 'ধাপ ২' : 'Step 2'}</p>
            <p className="text-lg font-bold text-amber-300">+1500</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t('referralStep2')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-slate-400">{t('referralTotal')}</span>
          <CoinBadge amount={profile.referral_earned} />
        </div>
      </Card>

      <p className="text-center text-slate-500 text-xs mt-6">{t('letsEarn')}</p>

      <CoinCalcModal open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}

function CoinCalcModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, profile } = useApp();
  const [coins, setCoins] = useState(100);
  if (!profile) return null;
  return (
    <Modal open={open} onClose={onClose} title={t('coinCalculator')}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-semibold">{t('balanceBreakdown')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <p className="text-[10px] text-green-400">{t('withdrawableCoins')}</p>
              <p className="text-xl font-bold text-white">{(profile.withdrawable_coins || 0).toLocaleString()}</p>
            </div>
            <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3">
              <p className="text-[10px] text-pink-400">{t('bonusCoins')}</p>
              <p className="text-xl font-bold text-white">{(profile.bonus_coins || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-[10px] text-amber-400">{t('lumoraCoin')} (Total)</p>
            <p className="text-xl font-bold text-white">{profile.lumora_coins.toLocaleString()}</p>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('enterCoins')}</label>
          <input type="number" min={0} value={coins} onChange={(e) => setCoins(Math.max(0, +e.target.value))} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50" />
          <div className="mt-2 bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">{t('bdtEquivalent')}</span>
            <span className="text-lg font-bold text-amber-300">{(coins / 100).toFixed(2)} BDT</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">1 BDT = 100 LM Coins</p>
        </div>
      </div>
    </Modal>
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
