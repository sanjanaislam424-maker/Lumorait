import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, ListChecks, Sparkles, Volume2, VolumeX, Star, X } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

// ---- 8 slices: capped coin values (max 100) + mystery box (100-500) ----
type Slice = { label: string; value: number; color: string; comment: string };
const SLICES: Slice[] = [
  { label: '0 Coins', value: 0, color: '#1e293b', comment: 'আজ কপালটা একটু পচা দোস্ত! জিরো লুমোরা কয়েন পেলো। মন খারাপ করিস না, আবার চেষ্টা কর!' },
  { label: '5 Coins', value: 5, color: '#f59e0b', comment: 'আরে বাহ্! ৫ কয়েন দিয়ে এক কাপ চা খাওয়ার ব্যবস্থা হলো!' },
  { label: '10 Coins', value: 10, color: '#10b981', comment: '১০ কয়েন জিতেছে! একবারে লাফ দিয়ে বড়লোক হওয়া যায় না দোস্ত!' },
  { label: '20 Coins', value: 20, color: '#3b82f6', comment: '২০ লুমোরা কয়েন পকেটে পুরে নাও! ধীরে ধীরে তো কপাল খুলছে!' },
  { label: '50 Coins', value: 50, color: '#06b6d4', comment: 'বুম! ৫০ কয়েন পকেটে! আজকের দিনটা মন্দ যাবে না কিন্তু!' },
  { label: '100 Coins', value: 100, color: '#ef4444', comment: 'সাবাস বিটলা! এক শটে ১০০ কয়েন হাঁকিয়ে দিলে!' },
  { label: 'Mystery Box 🎁', value: -1, color: '#ec4899', comment: 'বুম! রহস্যময় বাক্স থেকে ১০০-৫০০ কয়েনের জ্যাকপট বেরিয়ে এসেছে! আজ তো তুই পার্টি দিবি!' },
  { label: '0 Coins', value: 0, color: '#334155', comment: 'আবারো জিরো! ভাগ্য দেবতা মনে হয় একটু ঘুমাচ্ছে, আবার ঘুরাও!' },
];
const SEG_COUNT = 8;
const SEG_ANGLE = 360 / SEG_COUNT; // 45
// Rigged: vast majority land on 0/5/10; 50/100 rare; mystery very rare
const WEIGHTED_ODDS = [25, 20, 15, 8, 4, 2, 1, 25];

function pickWeightedIndex(): number {
  const total = WEIGHTED_ODDS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTED_ODDS.length; i++) {
    r -= WEIGHTED_ODDS[i];
    if (r <= 0) return i;
  }
  return 0;
}

function rollMystery(): number {
  return Math.floor(Math.random() * 401) + 100; // 100-500
}

// Conic gradient with thin dark dividers between slices
const CONIC_GRADIENT = `conic-gradient(from 0deg, ${
  SLICES.map((s, i) =>
    `${s.color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE - 0.5}deg, #050505 ${(i + 1) * SEG_ANGLE - 0.5}deg ${(i + 1) * SEG_ANGLE}deg`,
  ).join(', ')
})`;

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

// ---- Fireworks particle system (canvas) ----
type Particle = { x: number; y: number; vx: number; vy: number; color: string; size: number; life: number; maxLife: number };
const FW_COLORS = ['#fbbf24', '#22d3ee', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#fde68a', '#fb923c'];

export function Spin() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();

  // STRICT: starts at 1, only decrements on spin, never increments via spin
  const [spinsLeft, setSpinsLeft] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [result, setResult] = useState<{ amount: number; label: string; isMystery: boolean; comment: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const fwActiveRef = useRef(false);

  const clearTick = useCallback(() => {
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
  }, []);

  // ---- Canvas fireworks ----
  const fwSpawn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const count = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
        size: 2 + Math.random() * 4,
        life: 0,
        maxLife: 40 + Math.random() * 50,
      });
    }
  }, []);

  const fwLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = null; return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (fwActiveRef.current) fwSpawn();
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.vx *= 0.99;
      p.vy *= 0.99;
      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 3;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
    if (particlesRef.current.length > 0 || fwActiveRef.current) {
      rafRef.current = requestAnimationFrame(fwLoop);
    } else {
      rafRef.current = null;
    }
  }, [fwSpawn]);

  const startFireworks = useCallback(() => {
    fwActiveRef.current = true;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(fwLoop);
  }, [fwLoop]);

  const stopFireworks = useCallback(() => {
    fwActiveRef.current = false;
  }, []);

  useEffect(() => () => {
    clearTick();
    fwActiveRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, [clearTick]);

  // ---- CORE SPIN: strictly decrements spinsLeft ----
  const doSpin = async () => {
    if (spinning || spinsLeft <= 0 || !profile) return;

    // STRICT DECREMENT — never increments
    setSpinsLeft((prev) => Math.max(0, prev - 1));

    setSpinning(true);
    setResult(null);
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
    const slice = SLICES[winIdx];
    const isMystery = slice.value === -1;

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
        actualReward = rollMystery();
        label = `${t('mysteryBox')} (${actualReward})`;
      } else if (slice.value === 0) {
        actualReward = 0;
        label = t('betterLuck');
      } else {
        actualReward = slice.value;
        label = `${slice.value} ${t('lumoraCoins')}`;
      }

      // Persist reward + spin history
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

      setResult({ amount: actualReward, label, isMystery, comment: slice.comment });

      if (actualReward > 0) {
        setCelebrate(true);
        startFireworks();
        setTimeout(() => stopFireworks(), 1500);
        if (soundOn) playFanfare();
        notify(`${t('spinReward')} ${actualReward} ${t('lumoraCoins')}!`, 'success');
      } else {
        if (soundOn) playLose();
        notify(slice.comment, 'info');
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
      setSpinsLeft((prev) => prev + 1);
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
    setSpinsLeft((prev) => prev + 1);
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

      {/* ===== 3D WHEEL WITH FIREWORKS CANVAS BEHIND ===== */}
      <div className="flex justify-center mb-6 relative" style={{ perspective: '1000px' }}>
        {/* Fireworks canvas layer (behind wheel) */}
        <canvas
          ref={canvasRef}
          width={420}
          height={420}
          className="absolute pointer-events-none"
          style={{ top: '-60px', left: '50%', transform: 'translateX(-50%)', zIndex: 0 }}
        />

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

            {/* ===== ROTATING WHEEL FACE (Pure HTML/CSS conic-gradient + labels) ===== */}
            <motion.div
              animate={{ rotate: rotation }}
              transition={{ duration: 4.2, ease: [0.17, 0.67, 0.3, 0.99] }}
              className="absolute rounded-full overflow-hidden"
              style={{ inset: '12px', transform: 'translateZ(8px)', background: CONIC_GRADIENT }}
            >
              {/* Radial sheen overlay */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0%, transparent 55%, rgba(0,0,0,0.3) 100%)',
              }} />

              {/* Slice labels — high-contrast glowing white text */}
              {SLICES.map((slice, i) => {
                const angle = i * SEG_ANGLE + SEG_ANGLE / 2;
                const fontSize = slice.label.includes('Mystery') ? 12 : 16;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transformOrigin: '0 0',
                      transform: `rotate(${angle}deg)`,
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '-88px',
                      left: '0',
                      transform: 'translate(-50%, -50%)',
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        color: '#FFFFFF',
                        fontSize: `${fontSize}px`,
                        fontWeight: 800,
                        textShadow: '0px 2px 4px #000',
                        letterSpacing: '0.02em',
                      }}>
                        {slice.label}
                      </span>
                    </div>
                  </div>
                );
              })}
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

      {/* ===== TWO EXTRA-SPIN ACTION CARDS (shown once free spin reaches 0) ===== */}
      {spinsLeft === 0 && !spinning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <p className="text-center text-amber-300 font-medium text-sm mb-3">{t('getMoreSpins')}</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Task card */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={openTaskPicker}
              disabled={adWatching}
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
              disabled={adWatching}
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
        </motion.div>
      )}

      {/* ===== RESULT POPUP (centered, z-50, full opacity) ===== */}
      <AnimatePresence>
        {result !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
            onClick={() => setResult(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center relative"
              style={{
                boxShadow: result.amount > 0
                  ? '0 0 40px rgba(251,191,36,0.35)'
                  : '0 0 20px rgba(0,0,0,0.6)',
                border: result.amount > 0 ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <button
                onClick={() => setResult(null)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white transition"
              >
                <X size={20} />
              </button>

              {result.isMystery ? (
                <>
                  <div className="text-5xl mb-2">🎁</div>
                  <p className="text-slate-400 text-sm font-medium">{t('mysteryReward')}</p>
                  <p className="text-4xl font-extrabold mt-2 text-pink-400" style={{ filter: 'drop-shadow(0 0 12px rgba(236,72,153,0.5))' }}>
                    {result.amount} <span className="text-amber-300 text-2xl">{t('lumoraCoins')}</span>
                  </p>
                </>
              ) : result.amount === 0 ? (
                <p className="text-3xl font-extrabold mt-2 text-slate-400">{t('betterLuck')}</p>
              ) : (
                <>
                  <p className="text-slate-400 text-sm font-medium">{t('spinReward')}</p>
                  <p className="text-4xl font-extrabold mt-2 text-amber-300" style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.6))' }}>
                    {result.amount} <span className="text-2xl">{t('lumoraCoins')}</span>
                  </p>
                </>
              )}

              <p className="text-sm text-slate-300 mt-4 px-2 leading-relaxed">
                {result.comment}
              </p>

              <Button className="w-full mt-5" onClick={() => setResult(null)}>
                {t('close')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
