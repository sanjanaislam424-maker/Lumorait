import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Coins, Banknote, Crown, AlertTriangle, Zap, Lock, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';

const FUNNY_WARNINGS = [
  'পকেটে নাই চানাচুর, গ্যাং গ্যাং করো ফাইভ স্টার! এত ব্যালেন্স কই পাইলা ভাই? 😂',
  'ভাইরে ভাই! একাউন্টে তো এত টাহা/কয়েন নাই! আগে টাস্ক কমপ্লিট করো, তারপর ফ্লেক্স করো! 💸',
  'এত টাকা চাইলে গগলে সার্চ দাও "কিভাবে বড়লোক হই" 😜 পকেটে তো নাই!',
  'ভাই, এয়ার ব্যালেন্স দিয়া কনভার্ট হয় না! আগে রিয়েল কয়েন/টাকা লাগবে! 🤣',
  'তুমি কি মাইক্রোসফটের মালিক? এত ব্যালেন্স কই থাকে? 😆 আগে টাস্ক মারো!',
];

const FUNNY_OK = [
  'সাবাশ ওস্তাদ! ঝটপট মারো কনভার্ট! 🚀',
  'এই তো ভাই! সঠিক এমাউন্ট, এখন কনভার্ট মারো দিদি! 💪',
  'পারফেক্ট! ব্যালেন্স আছে, ফিলিং আছে, শুধু কনভার্ট বাটনে চাপ দাও! 🔥',
  'হ্যাঁ ভাই, এটা তো হইবো! গো গো গো! ⚡',
];

function pickRandom(arr: string[], seed: number): string {
  return arr[seed % arr.length];
}

export function BuyConvert() {
  const { t, profile, lang, refreshProfile } = useApp();
  const { notify } = useToast();
  const [tab, setTab] = useState<'cashToCoins' | 'coinsToCash'>('cashToCoins');
  const [cashAmt, setCashAmt] = useState(100);
  const [coinAmt, setCoinAmt] = useState(10000);
  const [serviceChargePct, setServiceChargePct] = useState(3);
  const [busy, setBusy] = useState(false);
  const [warningSeed, setWarningSeed] = useState(0);
  const [okSeed, setOkSeed] = useState(0);
  const wasExceeds = useRef({ cash: false, coins: false });

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
  const bonusCoins = Math.max(0, profile.bonus_coins || 0);

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

  // Pick new funny message each time warning appears
  useEffect(() => {
    if (cashExceeds && !wasExceeds.current.cash) {
      setWarningSeed((s) => s + 1);
      wasExceeds.current.cash = true;
    } else if (!cashExceeds) {
      wasExceeds.current.cash = false;
    }
  }, [cashExceeds]);

  useEffect(() => {
    if (coinsExceed && !wasExceeds.current.coins) {
      setWarningSeed((s) => s + 1);
      wasExceeds.current.coins = true;
    } else if (!coinsExceed) {
      wasExceeds.current.coins = false;
    }
  }, [coinsExceed]);

  // Pick encouraging message when amount becomes valid
  useEffect(() => {
    if (tab === 'cashToCoins' && cashCanConvert && cashInput >= 1) {
      setOkSeed((s) => s + 1);
    }
  }, [tab, cashCanConvert, cashInput]);

  useEffect(() => {
    if (tab === 'coinsToCash' && coinsCanConvert && coinInput >= 100) {
      setOkSeed((s) => s + 1);
    }
  }, [tab, coinsCanConvert, coinInput]);

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

  const funnyWarning = pickRandom(FUNNY_WARNINGS, warningSeed);
  const funnyOk = pickRandom(FUNNY_OK, okSeed);

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

      {/* Dual coin balance cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="rounded-2xl p-4 bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border border-cyan-500/25 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full -mr-8 -mt-8" />
          <div className="flex items-center gap-1.5 mb-1">
            <Coins size={14} className="text-cyan-400" />
            <p className="text-[10px] text-cyan-400 font-semibold">
              {lang === 'bn' ? 'উইথড্রযোগ্য কয়েন' : 'Withdrawable Coins'}
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{withdrawableCoins.toLocaleString()}</p>
          <p className="text-[10px] text-cyan-300/60 mt-1">
            {lang === 'bn' ? 'ক্যাশে কনভার্ট করা যায়' : 'Convertible to cash'}
          </p>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.97 }}
          className="rounded-2xl p-4 bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-purple-500/25 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full -mr-8 -mt-8" />
          <div className="flex items-center gap-1.5 mb-1">
            <Lock size={14} className="text-purple-400" />
            <p className="text-[10px] text-purple-400 font-semibold">
              {lang === 'bn' ? 'বোনাস কয়েন' : 'Bonus Coins'}
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{bonusCoins.toLocaleString()}</p>
          <p className="text-[10px] text-purple-300/60 mt-1">
            {lang === 'bn' ? 'টাস্কেই খরচ হয়, ক্যাশে নয়' : 'Spend on tasks only'}
          </p>
        </motion.div>
      </div>

      <Card className="mb-4">
        <p className="text-sm text-slate-400 mb-4">
          {tab === 'cashToCoins' ? t('cashToCoinsDesc') : t('coinsToCashDesc')}
        </p>

        {/* Cash balance (shown in both tabs for reference) */}
        <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20 mb-4">
          <p className="text-[10px] text-green-400">{t('cashBalance')}</p>
          <p className="text-xl font-bold text-white">{cashBalance.toLocaleString()} BDT</p>
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

            {/* Funny warning for insufficient balance */}
            {cashExceeds ? (
              <motion.div
                key={`warn-cash-${warningSeed}`}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex items-start gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
              >
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-red-400 font-bold mb-0.5">{t('insufficientBalance')}</p>
                  <p className="text-red-300/80 leading-relaxed">{funnyWarning}</p>
                  <p className="text-red-400/50 mt-1">{t('excessAmount')}: {cashExcess.toLocaleString()} BDT</p>
                </div>
              </motion.div>
            ) : cashInput >= 1 ? (
              <motion.div
                key={`ok-cash-${okSeed}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl p-3 bg-green-500/10 border border-green-500/25"
              >
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <p className="text-xs text-green-300 leading-relaxed">{funnyOk}</p>
              </motion.div>
            ) : null}

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

            {/* Funny warning for insufficient balance */}
            {coinsExceed ? (
              <motion.div
                key={`warn-coins-${warningSeed}`}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex items-start gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
              >
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-red-400 font-bold mb-0.5">{t('insufficientBalance')}</p>
                  <p className="text-red-300/80 leading-relaxed">{funnyWarning}</p>
                  <p className="text-red-400/50 mt-1">{t('excessAmount')}: {coinsExcess.toLocaleString()} {t('lumoraCoins')}</p>
                </div>
              </motion.div>
            ) : coinInput >= 100 ? (
              <motion.div
                key={`ok-coins-${okSeed}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl p-3 bg-green-500/10 border border-green-500/25"
              >
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <p className="text-xs text-green-300 leading-relaxed">{funnyOk}</p>
              </motion.div>
            ) : null}

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
