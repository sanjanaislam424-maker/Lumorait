import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, ListChecks, Sparkles, Volume2, VolumeX, Star } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

// ---- Wheel configuration: 8 slices ----
const SEGMENT_VALUES = [0, 20, 50, 100, 200, -1, 300, 500] as const;
const SEGMENT_LABELS = ['0', '20', '50', '100', '200', 'Mystery', '300', '500'];
const SEGMENT_COLORS = [
  '#0f172a', '#f59e0b', '#10b981', '#2563eb',
  '#d97706', '#ec4899', '#7c3aed', '#dc2626',
];
const SEGMENT_TEXT = [
  '#94a3b8', '#fffbeb', '#d1fae5', '#dbeafe',
  '#fef3c7', '#fce7f3', '#ede9fe', '#fee2e2',
];
const WEIGHTED_ODDS = [14, 10, 8, 5, 3, 2, 1, 1];
const MYSTERY_REWARDS = [15, 30, 75, 150, 200, 10, 50, 5];
const SEG_COUNT = SEGMENT_VALUES.length;
const SEG_ANGLE = 360 / SEG_COUNT;

function pickWeightedIndex(): number {
  const total = WEIGHTED_ODDS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTED_ODDS.length; i++) {
    r -= WEIGHTED_ODDS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ---- Audio helpers ----
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtx;
  } catch { return null; }
}
function playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08) {
  const ctx = getAudioCtx(); if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}
function playTick() { playTone(880, 0.05, 'square', 0.04); }
function playFanfare() {
  playTone(523, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 120);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.1), 240);
}
function playLose() { playTone(220, 0.3, 'sawtooth', 0.06); }

// ---- Firework spark type ----
type Spark = { id: number; angle: number; dist: number; color: string; size: number; delay: number };
const SPARK_COLORS = ['#fbbf24', '#22d3ee', '#ec4899', '#22c55e', '#a855f7', '#f59e0b', '#3b82f6', '#fde68a'];

export function Spin() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();

  // ---- STRICT local spin counter: starts at 1, only decrements on spin ----
  const [spinsLeft, setSpinsLeft] = useState(1);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [result, setResult] = useState<{ amount: number; label: string; isMystery: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [winBurst, setWinBurst] = useState(false);

  // Extra-spin action states
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sparkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sparkId = useRef(0);

  const clearTick = useCallback(() => {
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
  }, []);

  const startFireworks = useCallback(() => {
    if (sparkTimer.current) clearInterval(sparkTimer.current);
    sparkTimer.current = setInterval(() => {
      const batch: Spark[] = Array.from({ length: 6 }, () => ({
        id: sparkId.current++,
        angle: Math.random() * 360,
        dist: 120 + Math.random() * 100,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size: 3 + Math.random() * 5,
        delay: Math.random() * 0.3,
      }));
      setSparks((prev) => [...prev.slice(-60), ...batch]);
    }, 200);
  }, []);

  const stopFireworks = useCallback(() => {
    if (sparkTimer.current) { clearInterval(sparkTimer.current); sparkTimer.current = null; }
    setTimeout(() => setSparks([]), 800);
  }, []);

  useEffect(() => () => { clearTick(); stopFireworks(); }, [clearTick, stopFireworks]);

  // ---- CORE SPIN: strictly decrements spinsLeft ----
  const doSpin = async () => {
    if (spinning || spinsLeft <= 0 || !profile) return;

    // STRICT DECREMENT — never increments
    setSpinsLeft((prev) => Math.max(0, prev - 1));

    setSpinning(true);
    setResult(null);
    setWinBurst(false);
    clearTick();
    startFireworks();

    if (soundOn) {
      let elapsed = 0;
      tickTimer.current = setInterval(() => {
        if (soundOn) playTick();
        elapsed += 180;
        if (elapsed > 4200) clearTick();
      }, 180);
    }

    const winIdx = pickWeightedIndex();
    const segVal = SEGMENT_VALUES[winIdx];
    const isMystery = segVal === -1;

    // Land winning segment center under the top pointer
    const segCenter = winIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const targetAngle = 360 * 6 + (360 - segCenter);
    setRotation((prev) => {
      const prevMod = prev % 360;
      return prev + (targetAngle - prevMod);
    });

    setTimeout(async () => {
      setSpinning(false);
      clearTick();
      stopFireworks();

      let actualReward: number;
      let label: string;

      if (isMystery) {
        actualReward = MYSTERY_REWARDS[Math.floor(Math.random() * MYSTERY_REWARDS.length)];
        label = `${t('mysteryBox')} (${actualReward})`;
      } else if (segVal === 0) {
        actualReward = 0;
        label = t('betterLuck');
      } else {
        actualReward = segVal;
        label = `${segVal} ${t('lumoraCoins')}`;
      }

      // Persist reward + spin history to Supabase
      if (profile) {
        const { data: fresh } = await supabase
          .from('profiles')
          .select('lumora_coins')
          .eq('id', profile.id)
          .maybeSingle();
        await supabase.from('profiles').update({
          lumora_coins: (fresh?.lumora_coins ?? profile.lumora_coins) + actualReward,
        }).eq('id', profile.id);
        await supabase.from('spin_history').insert({ user_id: profile.id, reward: actualReward, label });
        if (actualReward > 0) {
          await supabase.from('transactions').insert({
            user_id: profile.id, type: 'spin', amount: actualReward, status: 'completed', note: `Lucky spin: ${label}`,
          });
        }
        await refreshProfile();
      }

      const funnyMsg = isMystery ? t('spinMysteryFunny')
        : actualReward === 0 ? t('spinZeroFunny')
        : actualReward >= 50 ? t('spinBigFunny')
        : t('spinSmallFunny');

      setResult({ amount: actualReward, label, isMystery });

      if (actualReward > 0) {
        setCelebrate(true);
        setWinBurst(true);
        setTimeout(() => setWinBurst(false), 2000);
        if (soundOn) playFanfare();
        notify(`${t('spinReward')} ${actualReward} ${t('lumoraCoins')}! ${funnyMsg}`, 'success');
      } else {
        if (soundOn) playLose();
        notify(funnyMsg, 'info');
      }
    }, 4200);
  };

  // ---- EXTRA SPIN: Watch ad (15s) -> +1 spinsLeft ----
  const watchAd = () => {
    if (adWatching || !profile) return;
    setAdWatching(true);
    setAdCountdown(15);
    const countdown = setInterval(() => {
      setAdCountdown((p) => { if (p <= 1) { clearInterval(countdown); return 0; } return p - 1; });
    }, 1000);
    setTimeout(() => {
      clearInterval(countdown);
      setAdWatching(false);
      setSpinsLeft((prev) => prev + 1); // +1 extra spin
      if (soundOn) playFanfare();
      notify(t('adDone'), 'success');
    }, 15000);
  };

  // ---- EXTRA SPIN: Complete task -> +1 spinsLeft ----
  const openTaskPicker = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .eq('is_admin_task', true)
      .order('created_at', { ascending: false })
      .limit(10);
    setTasks((data as TaskRow[]) || []);
    setShowTaskPicker(true);
  };

  const completeTaskForSpin = async (task: TaskRow) => {
    if (!profile) return;
    await supabase.from('task_submissions').insert({
      task_id: task.id, doer_id: profile.id, proof_urls: ['[]'],
      notes: 'Completed for extra spin', status: 'approved',
    });
    setShowTaskPicker(false);
    setSpinsLeft((prev) => prev + 1); // +1 extra spin
    if (soundOn) playFanfare();
    notify(t('extraSpinEarned'), 'success');
  };

  if (!profile) return null;

  const btnLabelTask = lang === 'bn' ? 'টাস্ক করে স্পিন নাও' : t('taskForSpinBtn');
  const btnLabelAd = lang === 'bn' ? 'অ্যাড দেখে স্পিন নাও' : t('adWatchBtn');

  return (
    <div>
      {/* Header + spin counter */}
      <Card className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Gift className="text-amber-400" size={20} />
          <h2 className="text-lg font-bold text-white">{t('spin')}</h2>
          <button
            onClick={() => setSoundOn((v) => !v)}
            className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition"
            style={{ color: soundOn ? 'var(--neon-primary)' : '#64748b' }}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
        <p className="text-sm text-slate-400">
          {t('freeSpinsLeft')}: <span className="text-amber-300 font-bold text-base">{spinsLeft}</span>
        </p>
      </Card>

      {/* ===== 3D WHEEL WITH FIREWORKS BEHIND ===== */}
      <div className="flex justify-center mb-6 relative" style={{ perspective: '1000px' }}>
        {/* Fireworks layer */}
        <div className="absolute pointer-events-none" style={{ top: '-40px', bottom: '-40px', left: '-60px', right: '-60px', zIndex: 0 }}>
          <AnimatePresence>
            {(spinning || winBurst) && sparks.map((s) => (
              <motion.div
                key={s.id}
                className="absolute rounded-full"
                style={{
                  left: '50%', top: '50%', width: s.size, height: s.size,
                  background: s.color, boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((s.angle * Math.PI) / 180) * s.dist,
                  y: Math.sin((s.angle * Math.PI) / 180) * s.dist,
                  opacity: 0, scale: 0.2, rotate: Math.random() * 360,
                }}
                transition={{ duration: 0.8 + Math.random() * 0.6, ease: 'easeOut', delay: s.delay }}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="relative" style={{ width: 300, height: 300, zIndex: 1 }}>
          {/* Glow halo */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, var(--neon-glow) 0%, transparent 70%)',
              filter: 'blur(24px)', transform: 'translateZ(-60px)',
              opacity: spinning ? 1 : 0.4, transition: 'opacity 0.4s',
            }}
          />

          {/* Pointer */}
          <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-30" style={{ filter: 'drop-shadow(0 2px 8px rgba(251,191,36,0.8))' }}>
            <div className="w-0 h-0" style={{ borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '30px solid #fbbf24' }} />
          </div>

          {/* 3D tilted wheel container */}
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(12deg)' }}>
            {/* Metallic outer ring */}
            <div className="absolute inset-0 rounded-full" style={{
              background: 'conic-gradient(from 0deg, #475569, #94a3b8, #334155, #cbd5e1, #475569)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.5)',
              transform: 'translateZ(-2px)',
            }} />
            {/* Inner neon ring */}
            <div className="absolute rounded-full" style={{
              inset: '6px', background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              boxShadow: '0 0 20px var(--neon-glow), inset 0 0 12px rgba(0,0,0,0.8)',
              border: '2px solid var(--neon-primary)', transform: 'translateZ(2px)',
            }} />

            {/* ===== ROTATING WHEEL FACE (clean SVG) ===== */}
            <motion.div
              animate={{ rotate: rotation }}
              transition={{ duration: 4.2, ease: [0.17, 0.67, 0.3, 0.99] }}
              className="absolute rounded-full overflow-hidden"
              style={{ inset: '12px', transform: 'translateZ(8px)' }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <defs>
                  <radialGradient id="wheelSheen" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                    <stop offset="55%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                  </radialGradient>
                  {SEGMENT_COLORS.map((c, i) => (
                    <radialGradient key={`sg${i}`} id={`slice${i}`} cx="0.5" cy="0.5" r="0.7">
                      <stop offset="0%" stopColor={c} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={c} stopOpacity="0.65" />
                    </radialGradient>
                  ))}
                  <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {SEGMENT_VALUES.map((val, i) => {
                  const a0 = (i * SEG_ANGLE - 90) * (Math.PI / 180);
                  const a1 = ((i + 1) * SEG_ANGLE - 90) * (Math.PI / 180);
                  const x1 = 100 + 88 * Math.cos(a0);
                  const y1 = 100 + 88 * Math.sin(a0);
                  const x2 = 100 + 88 * Math.cos(a1);
                  const y2 = 100 + 88 * Math.sin(a1);
                  const midA = (i * SEG_ANGLE + SEG_ANGLE / 2 - 90) * (Math.PI / 180);
                  const tx = 100 + 56 * Math.cos(midA);
                  const ty = 100 + 56 * Math.sin(midA);
                  const isZero = val === 0;
                  const isMystery = val === -1;
                  const fontSize = isMystery ? 13 : (val >= 100 ? 15 : 17);
                  return (
                    <g key={i}>
                      {/* Slice fill */}
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 88 88 0 0 1 ${x2} ${y2} Z`}
                        fill={`url(#slice${i})`}
                        stroke="rgba(0,0,0,0.6)"
                        strokeWidth={1.2}
                      />
                      {/* Neon edge glow on non-zero */}
                      {!isZero && (
                        <path
                          d={`M 100 100 L ${x1} ${y1} A 88 88 0 0 1 ${x2} ${y2} Z`}
                          fill="none" stroke={SEGMENT_COLORS[i]} strokeWidth={2}
                          opacity={0.5} style={{ filter: 'blur(2px)' }}
                        />
                      )}
                      {/* High-contrast label: dark stroke behind, bright fill on top */}
                      <text
                        x={tx} y={ty}
                        fill={SEGMENT_TEXT[i]}
                        stroke="#0a0a0a"
                        strokeWidth={isZero ? 0 : 3.5}
                        paintOrder="stroke"
                        fontSize={fontSize}
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        filter="url(#textGlow)"
                        fontFamily="system-ui, sans-serif"
                      >
                        {SEGMENT_LABELS[i]}
                      </text>
                    </g>
                  );
                })}
                <rect x="0" y="0" width="200" height="200" fill="url(#wheelSheen)" />
              </svg>
            </motion.div>

            {/* Center hub */}
            <div className="absolute left-1/2 top-1/2 rounded-full flex items-center justify-center z-20" style={{
              width: 48, height: 48, transform: 'translate(-50%,-50%) translateZ(18px)',
              background: 'radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 60%, #92400e)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 -3px 6px rgba(0,0,0,0.3)',
              border: '2px solid #fbbf24',
            }}>
              <Gift size={20} className="text-amber-950" />
            </div>
          </div>
        </div>
      </div>

      {/* Spin button */}
      <div className="flex justify-center mb-6">
        <Button onClick={doSpin} disabled={spinning || spinsLeft <= 0} className="px-8 py-3 text-lg">
          {spinning ? (lang === 'bn' ? 'ঘুরছে...' : 'Spinning...') : t('spinNow')}
        </Button>
      </div>

      {/* ===== RESULT POPUP ===== */}
      {result !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <div style={{ boxShadow: result.amount > 0 ? '0 0 30px rgba(251,191,36,0.25)' : 'none', borderRadius: 16 }}>
            <Card className="text-center mb-4">
              <p className="text-slate-400 text-sm font-medium">{t('spinReward')}</p>
              <p className="text-4xl font-extrabold mt-2">
                {result.isMystery ? (
                  <span className="text-pink-400" style={{ filter: 'drop-shadow(0 0 10px rgba(236,72,153,0.5))' }}>
                    {t('mysteryReward')} <span className="text-amber-300">{result.amount}</span> {t('lumoraCoins')}!
                  </span>
                ) : result.amount === 0 ? (
                  <span className="text-slate-400">{t('betterLuck')}</span>
                ) : (
                  <span className="text-amber-300" style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.6))' }}>
                    {result.amount} {t('lumoraCoins')}
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-400 mt-3 px-4">
                {result.isMystery ? t('spinMysteryFunny') : result.amount === 0 ? t('spinZeroFunny') : result.amount >= 50 ? t('spinBigFunny') : t('spinSmallFunny')}
              </p>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ===== TWO EXTRA-SPIN ACTION CARDS ===== */}
      <div className="mb-4">
        <p className="text-center text-amber-300 font-medium text-sm mb-3">{t('getMoreSpins')}</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Task card */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={openTaskPicker}
            disabled={spinning || adWatching}
            className="flex flex-col items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-2xl py-5 text-green-300 disabled:opacity-40 transition relative overflow-hidden group"
            style={{ boxShadow: '0 0 15px rgba(34,197,94,0.15)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/10 group-hover:from-green-500/5 group-hover:to-green-500/20 transition" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <ListChecks size={24} />
              </div>
              <span className="text-sm font-bold text-center">{btnLabelTask}</span>
              <span className="text-xs text-green-400/60 flex items-center gap-1"><Sparkles size={10} /> +1 {t('spin')}</span>
            </div>
          </motion.button>
          {/* Ad card */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={watchAd}
            disabled={spinning || adWatching}
            className="flex flex-col items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-2xl py-5 text-blue-300 disabled:opacity-40 transition relative overflow-hidden group"
            style={{ boxShadow: '0 0 15px rgba(59,130,246,0.15)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/10 group-hover:from-blue-500/5 group-hover:to-blue-500/20 transition" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Play size={24} />
              </div>
              <span className="text-sm font-bold text-center">{adWatching ? `${adCountdown}s...` : btnLabelAd}</span>
              <span className="text-xs text-blue-400/60 flex items-center gap-1"><Star size={10} /> +1 {t('spin')}</span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* ===== AD WATCHING OVERLAY (15s) ===== */}
      <AnimatePresence>
        {adWatching && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/90 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-blue-300 text-lg font-medium">{t('adWatching')}</p>
              <p className="text-blue-400/60 text-3xl font-bold mt-2 tabular-nums">{adCountdown}s</p>
              <div className="mt-4 w-64 h-2 bg-slate-800 rounded-full overflow-hidden mx-auto">
                <motion.div
                  initial={{ width: '0%' }} animate={{ width: '100%' }}
                  transition={{ duration: 15, ease: 'linear' }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TASK PICKER MODAL ===== */}
      {showTaskPicker && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 flex items-center justify-center p-4" onClick={() => setShowTaskPicker(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={20} className="text-green-400" />
              <h3 className="font-bold text-white">{btnLabelTask}</h3>
            </div>
            {tasks.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">{t('noTasks')}</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-slate-700/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{task.title}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Sparkles size={10} /> {t('extraSpinEarned')}</p>
                    </div>
                    <Button className="text-xs py-1.5 px-3" onClick={() => completeTaskForSpin(task)}>{t('accept')}</Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" className="w-full mt-3" onClick={() => setShowTaskPicker(false)}>{t('close')}</Button>
          </motion.div>
        </div>
      )}

      <CelebrationOverlay show={celebrate} onClose={() => setCelebrate(false)} title={t('celebrate')} />
    </div>
  );
}
