import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, History, Coins, Ticket, Calculator, Wallet as WalletIcon, Gift } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TxRow } from '@/lib/supabase';
import { Card, Button, Modal, CoinBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';

export function Wallet() {
  const { t, profile, refreshProfile } = useApp();
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

  return (
    <div>
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
            <p className="text-amber-100 text-xs mt-2">≈ {(profile.lumora_coins / 100).toFixed(2)} BDT</p>
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

      <div className="grid grid-cols-2 gap-3 mb-6">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setDepOpen(true)} className="flex flex-col items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl py-4 text-green-300">
          <ArrowDownToLine size={24} />
          <span className="text-sm font-medium">{t('deposit')}</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setWdOpen(true)} className="flex flex-col items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl py-4 text-blue-300">
          <ArrowUpFromLine size={24} />
          <span className="text-sm font-medium">{t('withdraw')}</span>
        </motion.button>
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
                {tx.amount >= 0 ? '+' : ''}{tx.amount}
              </span>
              <p className={`text-[10px] ${tx.status === 'completed' || tx.status === 'approved' ? 'text-green-400' : tx.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>{tx.status}</p>
            </div>
          </div>
        ))}
      </div>

      <DepositModal open={depOpen} onClose={() => setDepOpen(false)} onDone={() => { load(); refreshProfile(); }} />
      <WithdrawModal open={wdOpen} onClose={() => setWdOpen(false)} onDone={() => { load(); refreshProfile(); }} balance={profile.withdrawable_coins || 0} />
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

function DepositModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [bdt, setBdt] = useState(10);
  const [method, setMethod] = useState('bKash');

  const submit = async () => {
    if (bdt < 10) { notify(t('minPurchase'), 'error'); return; }
    const coins = bdt * 100;
    await supabase.from('transactions').insert({ user_id: profile!.id, type: 'deposit', amount: coins, status: 'pending', method, note: `${bdt} BDT via ${method}` });
    notify(t('depositPending'), 'info');
    onClose();
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('depositRequest')}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">BDT</label>
          <input type="number" min={10} value={bdt} onChange={(e) => setBdt(+e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          <p className="text-xs text-amber-300 mt-1">= {(bdt * 100).toLocaleString()} {t('lumoraCoins')}</p>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('method')}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Rocket">Rocket</option>
          </select>
        </div>
        <p className="text-xs text-slate-400">{t('minPurchase')}</p>
        <Button className="w-full" onClick={submit}>{t('submit')}</Button>
      </div>
    </Modal>
  );
}

function WithdrawModal({ open, onClose, onDone, balance }: { open: boolean; onClose: () => void; onDone: () => void; balance: number }) {
  const { t, profile } = useApp();
  const { notify } = useToast();
  const [coins, setCoins] = useState(1000);
  const [method, setMethod] = useState('bKash');

  const submit = async () => {
    if (coins > balance) { notify(t('notEnoughCoins'), 'error'); return; }
    if (coins < 1000) { notify(t('minPurchase'), 'error'); return; }
    await supabase.from('transactions').insert({ user_id: profile!.id, type: 'withdrawal', amount: -coins, status: 'pending', method, note: `${(coins / 100).toFixed(2)} BDT via ${method}` });
    notify(t('withdrawPending'), 'info');
    onClose();
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('withdrawRequest')}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('amount')} ({t('lumoraCoins')})</label>
          <input type="number" min={1000} value={coins} onChange={(e) => setCoins(+e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
          <p className="text-xs text-amber-300 mt-1">= {(coins / 100).toFixed(2)} BDT</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('withdrawableCoins')}: {balance.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('method')}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Bank">Bank Transfer</option>
          </select>
        </div>
        <Button className="w-full" onClick={submit}>{t('submit')}</Button>
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
