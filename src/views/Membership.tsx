import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, Coins, Wallet as WalletIcon } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';

type PlanRow = {
  id: string;
  tier: string;
  name: string;
  price_bdt: number;
  task_bonus_pct: number;
  box_blasts_daily: number;
  service_charge_pct: number;
  task_fee_pct: number;
  priority_support: boolean;
  badge_label: string;
};

const featureKeys = ['boxBlasts', 'taskBonus', 'serviceChargeRate', 'taskFee', 'prioritySupport'] as const;

export function Membership() {
  const { t, profile, lang, refreshProfile } = useApp();
  const { notify } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('membership_plans').select('*').order('price_bdt', { ascending: true });
      setPlans((data as PlanRow[]) || []);
    })();
  }, []);

  if (!profile) return null;

  const currentTier = profile.membership_tier || 'free';

  const subscribe = async (plan: PlanRow) => {
    if (busy) return;
    if (plan.tier === currentTier) return;
    setBusy(plan.id);
    try {
      // Pay from cash_balance if enough, else from LM coins
      const priceCoins = plan.price_bdt * 100;
      const useCash = (profile.cash_balance || 0) >= plan.price_bdt;

      if (!useCash && profile.lumora_coins < priceCoins) {
        notify(t('subscribeFail'), 'error');
        return;
      }

      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);

      const updates: Record<string, unknown> = {
        membership_tier: plan.tier,
        membership_expires: expires.toISOString(),
      };

      if (useCash) {
        updates.cash_balance = (profile.cash_balance || 0) - plan.price_bdt;
      } else {
        updates.lumora_coins = profile.lumora_coins - priceCoins;
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) throw error;

      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'membership',
        amount: useCash ? -plan.price_bdt : -priceCoins,
        status: 'completed',
        note: `${plan.name} subscription`,
      });

      await refreshProfile();
      notify(t('subscribeSuccess'), 'success');
    } catch {
      notify(t('subscribeFail'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const tierGradient = (tier: string) => {
    if (tier === 'vip') return 'from-amber-500/20 to-yellow-600/10 border-amber-500/30';
    if (tier === 'pro') return 'from-blue-500/20 to-cyan-600/10 border-blue-500/30';
    return 'from-slate-700/30 to-slate-800/20 border-white/10';
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Crown size={24} className="text-amber-400" />
        <h2 className="text-xl font-bold text-white">{t('membershipPlans')}</h2>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isVip = plan.tier === 'vip';
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-5 border bg-gradient-to-br ${tierGradient(plan.tier)} ${isVip ? 'relative overflow-hidden' : ''}`}
            >
              {isVip && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-amber-400/5"
                />
              )}
              <div className="flex items-center justify-between mb-3 relative">
                <div className="flex items-center gap-2">
                  {isVip ? <Crown size={22} className="text-amber-400" /> : plan.tier === 'pro' ? <Sparkles size={22} className="text-blue-400" /> : <WalletIcon size={22} className="text-slate-400" />}
                  <h3 className="text-lg font-bold text-white">
                    {plan.tier === 'free' ? t('planFree') : plan.tier === 'pro' ? t('planPro') : t('planVip')}
                  </h3>
                </div>
                {isCurrent && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                    {t('currentPlan')}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-3 relative">
                <span className="text-3xl font-bold text-white">{plan.price_bdt}</span>
                <span className="text-sm text-slate-400">BDT {t('planPerMonth')}</span>
              </div>

              <p className="text-sm text-slate-300 mb-4">
                {plan.tier === 'free' ? t('planFreeDesc') : plan.tier === 'pro' ? t('planProDesc') : t('planVipDesc')}
              </p>

              <div className="space-y-2 mb-4">
                <FeatureRow label={t('boxBlasts')} value={`${plan.box_blasts_daily}/day`} highlight={plan.box_blasts_daily > 1} />
                <FeatureRow label={t('taskBonus')} value={`+${plan.task_bonus_pct}%`} highlight={plan.task_bonus_pct > 0} />
                <FeatureRow label={t('serviceChargeRate')} value={`${plan.service_charge_pct}%`} highlight={plan.service_charge_pct === 0} />
                <FeatureRow label={t('taskFee')} value={`${plan.task_fee_pct}%`} highlight={plan.task_fee_pct === 0} />
                {plan.priority_support && <FeatureRow label={t('prioritySupport')} value="✓" highlight />}
              </div>

              {!isCurrent && (
                <Button
                  className="w-full"
                  disabled={busy === plan.id}
                  onClick={() => subscribe(plan)}
                  style={isVip ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' } : undefined}
                >
                  {busy === plan.id ? '...' : t('subscribeNow')}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-slate-500 text-xs mt-6">
        {lang === 'bn' ? 'ক্যাশ ব্যালেন্স বা এলএম কয়েন থেকে সাবস্ক্রিপশন ফি কাটা হবে।' : 'Subscription fee is deducted from your Cash Balance or LM Coins.'}
      </p>
    </div>
  );
}

function FeatureRow({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400 flex items-center gap-1.5">
        <Check size={14} className={highlight ? 'text-green-400' : 'text-slate-500'} />
        {label}
      </span>
      <span className={`font-semibold ${highlight ? 'text-green-400' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}
