import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Coins, Banknote, Crown, AlertTriangle, Zap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';

export function BuyConvert() {
  const { t, profile, lang, refreshProfile } = useApp();
  const { notify } = useToast();
  const [tab, setTab] = useState<'cashToCoins' | 'coinsToCash'>('cashToCoins');
  const [cashAmt, setCashAmt] = useState(100);
  const [coinAmt, setCoinAmt] = useState(10000);
  const [serviceChargePct, setServiceChargePct] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('service_charge_pct, vip_service_charge_pct').eq('id', 1).maybeSingle();
      if (data) {
        setServiceChargePct(data.service_charge_pct ?? 3);
      }
    })();
  }, []);

  if (!profile) return null;

  const isVip = profile.membership_tier === 'vip' || profile.membership_tier === 'pro';
  const chargePct = isVip ? 0 : serviceChargePct;

  const cashBalance = Math.max(0, profile.cash_balance || 0);
  const withdrawableCoins = Math.max(0, profile.withdrawable_coins || 0);

  // Cash to Coins
  const cashInput = Math.max(0, cashAmt);
  const chargeCash = (cashInput * chargePct) / 100;
  const netCash = cashInput - chargeCash;
  const coinsFromCash = Math.max(0, Math.round(netCash * 100));
  const cashExceeds = cashInput > cashBalance;
  const cashExcess = cashExceeds ? cashInput - cashBalance : 0;
  const cashCanConvert = cashInput >= 1 && !cashExceeds;

  // Coins to Cash
  const coinInput = Math.max(0, coinAmt);
  const chargeCoins = (coinInput * chargePct) / 100;
  const netCoins = Math.max(0, coinInput - chargeCoins);
  const cashFromCoins = Math.max(0, netCoins / 100);
  const coinsExceed = coinInput > withdrawableCoins;
  const coinsExcess = coinsExceed ? coinInput - withdrawableCoins : 0;
  const coinsCanConvert = coinInput >= 100 && !coinsExceed;

  const convertCashToCoins = async () => {
    if (busy || !cashCanConvert) return;
    setBusy(true);
    try {
      const newCashBalance = Math.max(0, cashBalance - cashInput);
      const newCoins = profile.lumora_coins + coinsFromCash;
      const { error } = await supabase.from('profiles').update({
        cash_balance: newCashBalance,
        lumora_coins: newCoins,
      }).eq('id', profile.id);
      if (error) throw error;
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'cash_to_coins',
        amount: coinsFromCash,
        status: 'completed',
        note: `Converted ${cashInput} BDT → ${coinsFromCash} LM Coins (charge ${chargePct}%)`,
      });
      await refreshProfile();
      notify(t('convertSuccess'), 'success');
      setCashAmt(0);
    } catch {
      notify(t('insufficientCash'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const convertCoinsToCash = async () => {
    if (busy || !coinsCanConvert) return;
    setBusy(true);
    try {
      const newWithdrawable = Math.max(0, withdrawableCoins - coinInput);
      const newTotalCoins = Math.max(0, profile.lumora_coins - coinInput);
      const newCashBalance = cashBalance + cashFromCoins;
      const { error } = await supabase.from('profiles').update({
        withdrawable_coins: newWithdrawable,
        lumora_coins: newTotalCoins,
        cash_balance: newCashBalance,
      }).eq('id', profile.id);
      if (error) throw error;
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'coins_to_cash',
        amount: -coinInput,
        status: 'completed',
        note: `Converted ${coinInput} LM Coins → ${cashFromCoins.toFixed(2)} BDT (charge ${chargePct}%)`,
      });
      await refreshProfile();
      notify(t('convertSuccess'), 'success');
      setCoinAmt(0);
    } catch {
      notify(t('insufficientCoins'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <ArrowLeftRight size={24} className="text-amber-400" />
        <h2 className="text-xl font-bold text-white">{t('buyConvert')}</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 rounded-xl p-1 bg-slate-800/50 border border-white/10">
        {([['cashToCoins', t('cashToCoins'), <Coins size={16} key="c" />], ['coinsToCash', t('coinsToCash'), <Banknote size={16} key="b" />]] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'cashToCoins' | 'coinsToCash')}
            className="relative flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            style={{
              background: tab === key ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'transparent',
              color: tab === key ? '#0a0301' : '#94a3b8',
              boxShadow: tab === key ? '0 4px 15px rgba(251,191,36,0.3)' : 'none',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* VIP exemption banner */}
      {isVip && (
        <div className="mb-4 rounded-xl p-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30">
          <Crown size={18} className="text-amber-400" />
          <p className="text-sm text-amber-300 font-medium">{t('vipExempt')}</p>
        </div>
      )}

      <Card className="mb-4">
        <p className="text-sm text-slate-400 mb-4">
          {tab === 'cashToCoins' ? t('cashToCoinsDesc') : t('coinsToCashDesc')}
        </p>

        {/* Balance info */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20">
            <p className="text-[10px] text-green-400">{t('cashBalance')}</p>
            <p className="text-xl font-bold text-white">{cashBalance.toLocaleString()} BDT</p>
          </div>
          <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-400">{t('lumoraCoin')}</p>
            <p className="text-xl font-bold text-white">{profile.lumora_coins.toLocaleString()}</p>
          </div>
        </div>

        {tab === 'cashToCoins' ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">{t('cashAmount')}</label>
                <button
                  onClick={() => setCashAmt(cashBalance)}
                  className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 hover:bg-amber-500/20 transition active:scale-95"
                >
                  <Zap size={12} /> {t('maxButton')}
                </button>
              </div>
              <input
                type="number"
                min={0}
                value={cashAmt || ''}
                onChange={(e) => setCashAmt(+e.target.value)}
                className={`w-full bg-slate-700 border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition ${
                  cashExceeds ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-amber-500/50'
                }`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {t('maxAvailable')}: {cashBalance.toLocaleString()} BDT
              </p>
            </div>

            {/* Warning for insufficient balance */}
            {cashExceeds && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
              >
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <div className="text-xs">
                  <p className="text-red-400 font-bold">{t('insufficientBalance')}</p>
                  <p className="text-red-300/70">{t('excessAmount')}: {cashExcess.toLocaleString()} BDT</p>
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5 text-sm">
              <Row label={t('platformCharge')} value={`${chargePct}% (${chargeCash.toFixed(2)} BDT)`} muted />
              <Row label={t('convertedAmount')} value={`${coinsFromCash.toLocaleString()} LM Coins`} highlight />
            </div>
            <Button className="w-full" disabled={busy || !cashCanConvert} onClick={convertCashToCoins}>
              {busy ? '...' : t('convertCashToCoins')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">{t('coinAmount')}</label>
                <button
                  onClick={() => setCoinAmt(withdrawableCoins)}
                  className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 hover:bg-amber-500/20 transition active:scale-95"
                >
                  <Zap size={12} /> {t('maxButton')}
                </button>
              </div>
              <input
                type="number"
                min={0}
                step={100}
                value={coinAmt || ''}
                onChange={(e) => setCoinAmt(+e.target.value)}
                className={`w-full bg-slate-700 border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition ${
                  coinsExceed ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-amber-500/50'
                }`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {t('maxAvailable')}: {withdrawableCoins.toLocaleString()} {t('lumoraCoins')}
              </p>
            </div>

            {/* Warning for insufficient balance */}
            {coinsExceed && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
              >
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <div className="text-xs">
                  <p className="text-red-400 font-bold">{t('insufficientBalance')}</p>
                  <p className="text-red-300/70">{t('excessAmount')}: {coinsExcess.toLocaleString()} {t('lumoraCoins')}</p>
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5 text-sm">
              <Row label={t('platformCharge')} value={`${chargePct}% (${chargeCoins.toFixed(0)} coins)`} muted />
              <Row label={t('convertedAmount')} value={`${cashFromCoins.toFixed(2)} BDT`} highlight />
            </div>
            <Button className="w-full" disabled={busy || !coinsCanConvert} onClick={convertCoinsToCash}>
              {busy ? '...' : t('convertCoinsToCash')}
            </Button>
          </div>
        )}
      </Card>

      <p className="text-center text-slate-500 text-xs">
        {lang === 'bn' ? '১ টাকা = ১০০ এলএম কয়েন' : '1 BDT = 100 LM Coins'}
      </p>
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl p-3" style={{ background: highlight ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)' }}>
      <span className={muted ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
      <span className={`font-bold ${highlight ? 'text-amber-300' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}
