import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, History, Coins, Ticket, Calculator, Wallet as WalletIcon, Gift, Banknote, Crown, Copy, Check, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

function fmtBDT(n: number): string {
  return (Math.max(0, n)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
import { useApp } from '@/lib/AppContext';
import { supabase, TxRow } from '@/lib/supabase';
import { Card, Button, Modal, CoinBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';

const ADMIN_NUMBER_KEYS: Record<string, string> = {
  bKash: 'admin_bkash_number',
  Nagad: 'admin_nagad_number',
  Rocket: 'admin_rocket_number',
};

async function fetchAdminNumber(method: string): Promise<string | null> {
  const col = ADMIN_NUMBER_KEYS[method];
  if (!col) return null;
  const { data } = await supabase.from('app_settings').select(col).eq('id', 1).maybeSingle();
  return data ? (data[col] as string) : null;
}

export function Wallet() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    setTxs(data as TxRow[] || []);
  };

  useEffect(() => { load(); }, [profile]);

  if (!profile) return null;

  const isVip = profile.membership_tier === 'vip' || profile.membership_tier === 'pro';

  return (
    <div>
      {/* Card A: Cash Balance (BDT) */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 mb-4 relative overflow-hidden"
      >
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-green-100 text-sm flex items-center gap-1.5"><Banknote size={14} /> {t('cashBalance')}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl font-bold text-white">{fmtBDT(profile.cash_balance || 0)}</span>
              <span className="text-lg text-green-200">BDT</span>
            </div>
            <p className="text-green-100 text-xs mt-2">{lang === 'bn' ? 'মোবাইল ব্যাংকিং বা কয়েন কনভার্ট থেকে' : 'From mobile banking or coin conversion'}</p>
          </div>
        </div>
      </motion.div>

      {/* Tappable balance card with breakdown */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => setCalcOpen(true)}
        className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 mb-4 relative overflow-hidden cursor-pointer"
      >
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-amber-100 text-sm">{t('lumoraCoin')}</p>
            <div className="flex items-center gap-2 mt-1">
              <Coins size={28} className="text-white" />
              <span className="text-4xl font-bold text-white">{profile.lumora_coins.toLocaleString()}</span>
            </div>
            <p className="text-amber-100 text-xs mt-2">≈ {fmtBDT(profile.lumora_coins / 100)} BDT</p>
          </div>
          <Calculator size={24} className="text-white/70" />
        </div>
        {/* Balance breakdown */}
        <div className="grid grid-cols-2 gap-2 mt-4 relative">
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5">
              <WalletIcon size={12} className="text-green-200" />
              <p className="text-[10px] text-amber-100">{t('withdrawableCoins')}</p>
            </div>
            <p className="text-lg font-bold text-white">{(profile.withdrawable_coins || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5">
              <Gift size={12} className="text-pink-200" />
              <p className="text-[10px] text-amber-100">{t('bonusCoins')}</p>
            </div>
            <p className="text-lg font-bold text-white">{(profile.bonus_coins || 0).toLocaleString()}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setDepOpen(true)} className="flex flex-col items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl py-4 text-green-300">
          <ArrowDownToLine size={24} />
          <span className="text-sm font-medium">{t('deposit')}</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setWdOpen(true)} className="flex flex-col items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl py-4 text-blue-300">
          <ArrowUpFromLine size={24} />
          <span className="text-sm font-medium">{t('withdraw')}</span>
        </motion.button>
      </div>

      {/* VIP service charge notice */}
      <div className={`mb-6 rounded-xl p-3 flex items-center gap-2 border ${isVip ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-700/30 border-white/10'}`}>
        <Crown size={16} className={isVip ? 'text-amber-400' : 'text-slate-500'} />
        <p className={`text-xs ${isVip ? 'text-amber-300' : 'text-slate-400'}`}>
          {isVip ? t('vipExempt') : `${t('platformCharge')}: ${lang === 'bn' ? 'ডিপোজিট ও উইথড্রয়ে প্রযোজ্য' : 'applies on deposits & withdrawals'}`}
        </p>
      </div>

      {/* Promo code redeem */}
      <RedeemCodeBox onRedeemed={() => { load(); refreshProfile(); }} />

      {/* History */}
      <div className="flex items-center gap-2 mb-3">
        <History size={18} className="text-slate-400" />
        <h3 className="font-semibold text-white">{t('history')}</h3>
      </div>
      <div className="space-y-2">
        {txs.length === 0 ? <EmptyState message={t('history')} /> : txs.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between bg-slate-800/50 border border-white/10 rounded-xl p-3">
            <div>
              <p className="text-sm text-white capitalize">{tx.type.replace('_', ' ')}</p>
              <p className="text-xs text-slate-500">{tx.note || tx.method} • {new Date(tx.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tx.amount >= 0 ? '+' : ''}{(tx.type === 'deposit' || tx.type === 'withdrawal') ? `${Math.abs(tx.amount).toFixed(2)} BDT` : tx.amount}
              </span>
              <p className={`text-[10px] ${tx.status === 'completed' || tx.status === 'approved' ? 'text-green-400' : tx.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>{tx.status}</p>
            </div>
          </div>
        ))}
      </div>

      <DepositModal open={depOpen} onClose={() => setDepOpen(false)} onDone={() => { load(); refreshProfile(); }} />
      <WithdrawModal open={wdOpen} onClose={() => setWdOpen(false)} onDone={() => { load(); refreshProfile(); }} balance={profile.withdrawable_balance || 0} />
      <CoinCalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}

function CoinCalculatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, profile } = useApp();
  const [coins, setCoins] = useState(100);

  if (!profile) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('coinCalculator')}>
      <div className="space-y-4">
        {/* Balance breakdown */}
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

        {/* Converter */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('enterCoins')}</label>
          <input
            type="number"
            min={0}
            value={coins}
            onChange={(e) => setCoins(Math.max(0, +e.target.value))}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
          />
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

const MIN_DEPOSIT_BDT = 100;
const MIN_WITHDRAW_BDT = 100;

const DEPOSIT_FUNNY_LOW = 'আরে মামা! কমপক্ষে ১০০ টাকা ডিপোজিট মারো! ১০০ টাকার নিচে তো চা-বিস্কুটের দোকানদারও বাকি দেয় না! ☕💸';
const WITHDRAW_FUNNY_LOW = 'কমপক্ষে ১০০ টাকা জমতে দাও ওস্তাদ! ১০০ টাকার কম উইথড্র দিলে বিকাশ/নগদের লোকেরাও হাসবে! 🤣';
const WITHDRAW_FUNNY_HIGH = 'পকেটে নাই চানাচুর, গ্যাং গ্যাং করো ফাইভ স্টার! এত টাকা কই পাইলা? একাউন্টে তো এত ব্যালেন্স নাই মামা! 💸';
const FUNNY_OK = 'সাবাশ ওস্তাদ! ঝটপট মারো সাবমিট! 🚀';

function DepositModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, profile, lang } = useApp();
  const { notify } = useToast();
  const [bdt, setBdt] = useState(100);
  const [method, setMethod] = useState('bKash');
  const [senderPhone, setSenderPhone] = useState('');
  const [trxId, setTrxId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [adminNumber, setAdminNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isVip = profile?.membership_tier === 'vip' || profile?.membership_tier === 'pro';
  const chargePct = isVip ? 0 : 3;
  const coinsAfterCharge = Math.round(bdt * 100 * (1 - chargePct / 100));
  const depositTooLow = bdt < MIN_DEPOSIT_BDT;
  const canDeposit = bdt >= MIN_DEPOSIT_BDT;

  useEffect(() => {
    if (!open) return;
    fetchAdminNumber(method).then(setAdminNumber);
  }, [open, method]);

  const copyNumber = async () => {
    if (!adminNumber) return;
    try {
      await navigator.clipboard.writeText(adminNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify(t('copyNumber'), 'error');
    }
  };

  const submit = async () => {
    if (!profile || !canDeposit) return;
    if (!senderPhone.trim()) { notify(t('enterSenderPhone'), 'error'); return; }
    if (!trxId.trim()) { notify(t('enterTrxId'), 'error'); return; }

    const insertData: Record<string, unknown> = {
      user_id: profile.id,
      type: 'deposit',
      amount: bdt,
      status: 'pending',
      method,
      sender_number: senderPhone.trim(),
      trx_id: trxId.trim(),
      personal_admin_number: adminNumber,
      note: `${bdt} BDT via ${method} | Sender: ${senderPhone.trim()} | TrxID: ${trxId.trim()}`,
    };
    if (promoCode.trim()) {
      insertData.deposit_promo_code = promoCode.trim().toUpperCase();
    }

    const { error } = await supabase.from('transactions').insert(insertData);
    if (error) { notify(error.message, 'error'); return; }

    notify(t('depositPending'), 'info');
    setSenderPhone('');
    setTrxId('');
    setPromoCode('');
    onClose();
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('depositRequest')}>
      <div className="space-y-3">
        {/* Method selector */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('method')}</label>
          <div className="grid grid-cols-3 gap-2">
            {['bKash', 'Nagad', 'Rocket'].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-2.5 rounded-xl text-sm font-medium transition ${method === m ? 'bg-pink-500 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Admin number display with copy */}
        {adminNumber && (
          <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-2xl p-4">
            <p className="text-xs text-pink-300 mb-1">{t('sendMoneyTo')}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl font-bold text-white tracking-wide font-mono">{adminNumber}</span>
              <button
                onClick={copyNumber}
                className="flex items-center gap-1 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 rounded-xl px-3 py-2 text-xs text-pink-200 transition"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('copied') : t('copyNumber')}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{t('depositInstructions')}</p>
          </div>
        )}

        {/* Deposit amount */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('depositAmount')}</label>
          <input
            type="number"
            min={MIN_DEPOSIT_BDT}
            value={bdt || ''}
            onChange={(e) => setBdt(+e.target.value)}
            className={`w-full bg-slate-700 border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition ${
              depositTooLow ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-pink-500/50'
            }`}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-amber-300">= {Math.max(0, bdt * 100).toLocaleString()} {t('lumoraCoins')}</p>
            {!isVip && <p className="text-[10px] text-slate-500">{t('platformCharge')}: {chargePct}% → {coinsAfterCharge.toLocaleString()} {t('lumoraCoins')}</p>}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'bn' ? `সর্বনিম্ন ডিপোজিট: ৳${MIN_DEPOSIT_BDT}` : `Min deposit: ৳${MIN_DEPOSIT_BDT}`}</p>
        </div>

        {/* Funny warning or OK message */}
        {depositTooLow ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
          >
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300/80 leading-relaxed">{DEPOSIT_FUNNY_LOW}</p>
          </motion.div>
        ) : bdt >= MIN_DEPOSIT_BDT ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl p-3 bg-green-500/10 border border-green-500/25"
          >
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <p className="text-xs text-green-300 leading-relaxed">{FUNNY_OK}</p>
          </motion.div>
        ) : null}

        {/* Sender phone */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('senderPhone')}</label>
          <input
            type="tel"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder={t('enterSenderPhone')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-pink-500/50"
          />
        </div>

        {/* TrxID */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('trxId')}</label>
          <input
            type="text"
            value={trxId}
            onChange={(e) => setTrxId(e.target.value)}
            placeholder={t('enterTrxId')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-pink-500/50 uppercase"
          />
        </div>

        {/* Promo code */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'ডিপোজিট প্রোমো / রেফারেল কোড (ঐচ্ছিক)' : t('depositPromoCode')}</label>
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder={t('depositPromoCode')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50 uppercase"
          />
        </div>

        {canDeposit && <Button className="w-full" onClick={submit}>{t('submit')}</Button>}
      </div>
    </Modal>
  );
}

function WithdrawModal({ open, onClose, onDone, balance }: { open: boolean; onClose: () => void; onDone: () => void; balance: number }) {
  const { t, profile, lang } = useApp();
  const { notify } = useToast();
  const [bdt, setBdt] = useState(100);
  const [method, setMethod] = useState('bKash');
  const [receiverNumber, setReceiverNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const isVip = profile?.membership_tier === 'vip' || profile?.membership_tier === 'pro';
  const chargePct = isVip ? 0 : 3;

  // balance is now withdrawable_balance in BDT (not coins)
  const withdrawableBDT = Math.max(0, balance);
  const chargeBDT = (Math.max(0, bdt) * chargePct) / 100;
  const totalDeductBDT = Math.max(0, bdt) + chargeBDT;
  const youReceiveBDT = Math.max(0, bdt);

  // MAX: compute net amount after fee so submitting never exceeds balance
  // balance = netPayout + fee, fee = netPayout * pct/100
  // balance = netPayout * (1 + pct/100)
  // netPayout = balance / (1 + pct/100)
  const maxNetBDT = chargePct > 0
    ? +(withdrawableBDT / (1 + chargePct / 100)).toFixed(2)
    : +withdrawableBDT.toFixed(2);

  const withdrawTooLow = bdt < MIN_WITHDRAW_BDT;
  const withdrawExceeds = totalDeductBDT > withdrawableBDT;
  const balanceTooLow = withdrawableBDT < MIN_WITHDRAW_BDT;
  const canWithdraw = bdt >= MIN_WITHDRAW_BDT && !withdrawExceeds && !balanceTooLow;

  let warningMsg: string | null = null;
  if (balanceTooLow) {
    warningMsg = WITHDRAW_FUNNY_LOW;
  } else if (withdrawTooLow) {
    warningMsg = WITHDRAW_FUNNY_LOW;
  } else if (withdrawExceeds) {
    warningMsg = WITHDRAW_FUNNY_HIGH;
  }

  const submit = async () => {
    if (!profile || !canWithdraw) return;
    if (!receiverNumber.trim()) { notify(t('enterReceiverWallet'), 'error'); return; }

    const insertData: Record<string, unknown> = {
      user_id: profile.id,
      type: 'withdrawal',
      amount: -+totalDeductBDT.toFixed(2),
      status: 'pending',
      method,
      receiver_number: receiverNumber.trim(),
      note: `${bdt} BDT via ${method} | Receiver: ${receiverNumber.trim()} | Charge: ${chargeBDT.toFixed(2)} BDT`,
    };
    if (promoCode.trim()) {
      insertData.withdraw_promo_code = promoCode.trim().toUpperCase();
    }

    const { error } = await supabase.from('transactions').insert(insertData);
    if (error) { notify(error.message, 'error'); return; }

    // Instantly deduct the exact amount from cash_balance and withdrawable_balance
    const newCash = Math.max(0, (profile.cash_balance || 0) - totalDeductBDT);
    const newWithdrawable = Math.max(0, (profile.withdrawable_balance || 0) - totalDeductBDT);
    await supabase.from('profiles').update({
      cash_balance: +newCash.toFixed(2),
      withdrawable_balance: +newWithdrawable.toFixed(2),
    }).eq('id', profile.id);

    notify(t('withdrawPending'), 'info');
    setReceiverNumber('');
    setPromoCode('');
    onClose();
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('withdrawRequest')}>
      <div className="space-y-3">
        {/* Method selector */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('method')}</label>
          <div className="grid grid-cols-3 gap-2">
            {['bKash', 'Nagad', 'Rocket'].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-2.5 rounded-xl text-sm font-medium transition ${method === m ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Withdraw amount in BDT with MAX button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">{t('withdrawAmount')}</label>
            <button
              onClick={() => setBdt(maxNetBDT)}
              disabled={balanceTooLow}
              className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap size={12} /> {t('maxButton')}
            </button>
          </div>
          <input
            type="number"
            min={MIN_WITHDRAW_BDT}
            value={bdt || ''}
            onChange={(e) => setBdt(+e.target.value)}
            className={`w-full bg-slate-700 border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition ${
              warningMsg ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-blue-500/50'
            }`}
          />
          {/* Live fee breakdown */}
          <div className="mt-2 rounded-xl bg-slate-800/60 border border-white/5 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{lang === 'bn' ? 'মোট ব্যালেন্স' : 'Total Balance'}</span>
              <span className="text-slate-300 font-medium">৳{fmtBDT(withdrawableBDT)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('platformCharge')} ({chargePct}%)</span>
              <span className="text-red-400 font-medium">-৳{chargeBDT.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-xs">
              <span className="text-amber-300 font-semibold">{lang === 'bn' ? 'তুমি পাবে' : 'You Receive'}</span>
              <span className="text-amber-300 font-bold text-sm">৳{fmtBDT(youReceiveBDT)}</span>
            </div>
          </div>
        </div>

        {/* Funny warning or OK message */}
        {warningMsg ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl p-3 bg-red-500/10 border border-red-500/30"
          >
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300/80 leading-relaxed">{warningMsg}</p>
          </motion.div>
        ) : canWithdraw ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl p-3 bg-green-500/10 border border-green-500/25"
          >
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <p className="text-xs text-green-300 leading-relaxed">{FUNNY_OK}</p>
          </motion.div>
        ) : null}

        {/* Receiver wallet number */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'তোমার বিকাশ/নগদ/রকেট নম্বর দাও' : t('receiverWallet')}</label>
          <input
            type="tel"
            value={receiverNumber}
            onChange={(e) => setReceiverNumber(e.target.value)}
            placeholder={t('enterReceiverWallet')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Withdrawal promo code */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'উইথড্র প্রোমো / ডিসকাউন্ট কোড (ঐচ্ছিক)' : t('withdrawPromoCode')}</label>
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder={t('withdrawPromoCode')}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50 uppercase"
          />
        </div>

        {canWithdraw && <Button className="w-full" onClick={submit}>{t('submit')}</Button>}
      </div>
    </Modal>
  );
}

function RedeemCodeBox({ onRedeemed }: { onRedeemed: () => void }) {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    if (!profile || !code.trim()) return;
    setBusy(true);
    try {
      const trimmed = code.trim().toUpperCase();
      const { data: promo, error } = await supabase.from('promo_codes').select('*').eq('code', trimmed).maybeSingle();
      if (error || !promo) { notify(t('redeemInvalid'), 'error'); return; }
      if (!promo.is_active) { notify(t('redeemInvalid'), 'error'); return; }
      if (promo.uses_count >= promo.max_uses) { notify(t('redeemLimit'), 'error'); return; }

      const { data: existing } = await supabase.from('promo_redemptions').select('id').eq('promo_code_id', promo.id).eq('user_id', profile.id).maybeSingle();
      if (existing) { notify(t('redeemUsed'), 'error'); return; }

      await supabase.from('promo_redemptions').insert({ promo_code_id: promo.id, user_id: profile.id, coins_awarded: promo.coin_value });
      await supabase.from('promo_codes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id);

      // Promo coins go to bonus_coins, not withdrawable
      const { data: prof } = await supabase.from('profiles').select('lumora_coins, bonus_coins').eq('id', profile.id).maybeSingle();
      if (prof) {
        await supabase.from('profiles').update({
          lumora_coins: prof.lumora_coins + promo.coin_value,
          bonus_coins: (prof.bonus_coins || 0) + promo.coin_value,
        }).eq('id', profile.id);
      }
      await supabase.from('transactions').insert({ user_id: profile.id, type: 'promo', amount: promo.coin_value, status: 'completed', note: `Promo code: ${trimmed}` });

      notify(`${t('redeemSuccess')} +${promo.coin_value} ${t('lumoraCoins')}!`, 'success');
      setCode('');
      onRedeemed();
    } catch {
      notify(t('redeemInvalid'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Ticket size={20} className="text-amber-400" />
        <h3 className="font-semibold text-white">{t('redeemCode')}</h3>
      </div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('redeemPlaceholder')}
          className="flex-1 bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50 uppercase"
        />
        <Button onClick={redeem} disabled={busy || !code.trim()} className="shrink-0">{busy ? '...' : t('redeemBtn')}</Button>
      </div>
    </Card>
  );
}
