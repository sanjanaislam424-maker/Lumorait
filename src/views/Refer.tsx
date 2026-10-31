import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Card, CoinBadge } from '@/components/ui';
import { ReferralActions } from '@/components/ReferralActions';
import { supabase } from '@/lib/supabase';

export function ReferView() {
  const { t, profile, lang } = useApp();
  const [referralStats, setReferralStats] = useState({ active: 0, total: 0 });

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { count: total } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', profile.id);
      const { count: active } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', profile.id).eq('referral_step2_paid', true);
      setReferralStats({ active: active ?? 0, total: total ?? 0 });
    })();
  }, [profile?.id]);

  if (!profile) return null;

  return (
    <div>
      {/* KYC-linked referral banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.1) 50%, rgba(251,191,36,0.12) 100%)',
          border: '1px solid rgba(34,197,94,0.3)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
            <Users size={24} className="text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-green-300">{t('referralTitle')}</p>
            <p className="text-xs text-amber-200 mt-2 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" />
              {t('referralKycReward')}
            </p>
            <p className="text-xs text-green-200 mt-1 flex items-center gap-1">
              <Sparkles size={12} className="text-green-400" />
              {t('referralLifetimeMsg')}
            </p>
          </div>
        </div>
      </motion.div>

      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Users size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-300">{t('inviteFriends')}</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-amber-300 font-mono text-lg font-bold">{profile.referral_code}</code>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{t('referralActive')}</p>
            <p className="text-lg font-bold text-green-300">{referralStats.active}/{referralStats.total}</p>
          </div>
        </div>

        <ReferralActions code={profile.referral_code ?? ''} />

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

      <p className="text-center text-slate-500 text-xs mt-6 flex items-center justify-center gap-1">
        <Sparkles size={12} className="text-amber-400" />
        {t('referralDepositBlast')}
      </p>
    </div>
  );
}
