import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, ListChecks, Sparkles, Volume2, VolumeX, Star, X } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

// ---- Reward tiers with distinct funny comments ----
type Reward = { value: number; label: string; color: string; comment: string; emoji: string };
const REWARDS: Reward[] = [
  { value: 0, label: '0 Coins', color: '#64748b', emoji: '💨', comment: 'ধুর দোস্ত! বক্স ফাটালি ঠিকই কিন্তু ভেতরে তো শুধু বাতাস! মন খারাপ করিস না, আবার চেষ্টা কর।' },
  { value: 5, label: '5 Coins', color: '#f59e0b', emoji: '🪙', comment: 'আরে বাহ্! ৫ কয়েন জিতেছে! এক কাপ লাল চা খাওয়ার ব্যবস্থা তো হলো!' },
  { value: 10, label: '10 Coins', color: '#10b981', emoji: '🪙', comment: '১০ কয়েন পকেটে! একবারে তো আর লাফ দিয়ে কোটিপতি হওয়া যায় না দোস্ত, ধীরে ধীরে এগোও!' },
  { value: 20, label: '20 Coins', color: '#3b82f6', emoji: '💎', comment: '২০ লুমোরা কয়েন পকেটে পুরে নাও! কপাল কিন্তু আস্তে আস্তে খুলতেছে!' },
  { value: 50, label: '50 Coins', color: '#06b6d4', emoji: '💥', comment: 'বুম! ৫০ কয়েন উড়িয়ে নিলে! আজকের দিনটা কিন্তু বেশ জমে উঠেছে!' },
  { value: 100, label: '100 Coins', color: '#ef4444', emoji: '🔥', comment: 'সাবাস বিটলা! এক শটে ১০০ কয়েন হাঁকিয়ে দিলে! তুই তো বস হয়া গেলি রে!' },
  { value: 200, label: '200 Coins', color: '#fb923c', emoji: '🎆', comment: 'ফাটিয়ে দিলি তো! ২০০ কয়েনের ধামাকা বোনাস! আজ রাতে বিরিয়ানি খাওয়া চাই কিন্তু!' },
  { value: 500, label: 'Mystery Jackpot', color: '#ec4899', emoji: '🎁', comment: 'বুম বুম জ্যাকপট! মিস্ট্রি বক্স থেকে ৫০০ কয়েন বেরিয়ে এলো! আজ তো পুরো পার্টি হবে দোস্ত!' },
];

// Rigged probability: low values dominate, jackpot very rare
const WEIGHTED_ODDS = [28, 22, 16, 10, 6, 3, 2, 1];

function pickWeightedIndex(): number {
  const total = WEIGHTED_ODDS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTED_ODDS.length; i++) {
    r -= WEIGHTED_ODDS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ---- Box visual configs ----
const BOX_COLORS = [
  { glow: 'rgba(236, 72, 153, 0.5)', accent: '#ec4899', surface: 'linear-gradient(135deg, #831843, #ec4899, #be185d)' },
  { glow: 'rgba(34, 211, 238, 0.5)', accent: '#22d3ee', surface: 'linear-gradient(135deg, #0c4a6e, #22d3ee, #0e7490)' },
  { glow: 'rgba(251, 191, 36, 0.5)', accent: '#fbbf24', surface: 'linear-gradient(135deg, #78350f, #fbbf24, #b45309)' },
];

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
function playExplosion() {
  playTone(80, 0.3, 'sawtooth', 0.12);
  setTimeout(() => playTone(120, 0.2, 'square', 0.08), 50);
  setTimeout(() => playTone(60, 0.4, 'sawtooth', 0.1), 100);
}
function playFanfare() {
  playTone(523, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 120);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.1), 240);
}
function playLose() { playTone(180, 0.3, 'sawtooth', 0.06); }

// ---- Particle canvas (explosion + confetti) ----
type Particle = { x: number; y: number; vx: number; vy: number; color: string; size: number; life: number; maxLife: number; rot: number; vrot: number; shape: 'circle' | 'rect' };
const CONFETTI_COLORS = ['#fbbf24', '#22d3ee', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#fde68a', '#fb923c', '#a855f7'];

type BlastedBox = { index: number } | null;

export function Spin() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();

  // STRICT: starts at 1, only decrements on blast, never increments via blast
  const [blastsLeft, setBlastsLeft] = useState(1);
  const [blasting, setBlasting] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [result, setResult] = useState<{ reward: Reward } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [blastedBox, setBlastedBox] = useState<BlastedBox>(null);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const fwActiveRef = useRef(false);
  const blastCenterRef = useRef<{ x: number; y: number } | null>(null);

  // ---- Canvas explosion system ----
  const spawnExplosion = useCallback((cx: number, cy: number) => {
    const count = 60 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      const isRect = Math.random() > 0.4;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: isRect ? 4 + Math.random() * 6 : 3 + Math.random() * 5,
        life: 0,
        maxLife: 60 + Math.random() * 60,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        shape: isRect ? 'rect' : 'circle',
      });
    }
  }, []);

  const fwLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = null; return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Secondary bursts while active
    if (fwActiveRef.current && blastCenterRef.current) {
      spawnExplosion(blastCenterRef.current.x, blastCenterRef.current.y);
    }
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      p.rot += p.vrot;
      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;
      if (p.shape === 'rect') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return true;
    });
    if (particlesRef.current.length > 0 || fwActiveRef.current) {
      rafRef.current = requestAnimationFrame(fwLoop);
    } else {
      rafRef.current = null;
    }
  }, [spawnExplosion]);

  const triggerExplosion = useCallback((boxEl: HTMLElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const boxRect = boxEl.getBoundingClientRect();
    const cx = boxRect.left + boxRect.width / 2 - canvasRect.left;
    const cy = boxRect.top + boxRect.height / 2 - canvasRect.top;
    blastCenterRef.current = { x: cx, y: cy };
    spawnExplosion(cx, cy);
    fwActiveRef.current = true;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(fwLoop);
    // Stop secondary bursts after initial explosion
    setTimeout(() => { fwActiveRef.current = false; }, 300);
  }, [spawnExplosion, fwLoop]);

  useEffect(() => () => {
    fwActiveRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  // ---- CORE: blast a box ----
  const blastBox = async (boxIndex: number, boxEl: HTMLElement) => {
    if (blasting || blastsLeft <= 0 || !profile) return;

    // STRICT DECREMENT — never increments
    setBlastsLeft((prev) => Math.max(0, prev - 1));
    setBlasting(true);
    setBlastedBox({ index: boxIndex });
    setResult(null);

    if (soundOn) playExplosion();
    triggerExplosion(boxEl);

    const winIdx = pickWeightedIndex();
    const reward = REWARDS[winIdx];

    setTimeout(async () => {
      setBlasting(false);

      // Persist reward + blast history
      if (profile) {
        const { data: fresh } = await supabase
          .from('profiles')
          .select('lumora_coins')
          .eq('id', profile.id)
          .maybeSingle();
        await supabase.from('profiles').update({
          lumora_coins: (fresh?.lumora_coins ?? profile.lumora_coins) + reward.value,
        }).eq('id', profile.id);
        await supabase.from('spin_history').insert({ user_id: profile.id, reward: reward.value, label: reward.label });
        if (reward.value > 0) {
          await supabase.from('transactions').insert({
            user_id: profile.id, type: 'spin', amount: reward.value, status: 'completed', note: `Mystery box blast: ${reward.label}`,
          });
        }
        await refreshProfile();
      }

      setResult({ reward });

      if (reward.value > 0) {
        setCelebrate(true);
        if (soundOn) playFanfare();
        notify(`${t('boxBlasted')} ${reward.value} ${t('lumoraCoins')}!`, 'success');
      } else {
        if (soundOn) playLose();
        notify(reward.comment, 'info');
      }
    }, 1200);
  };

  // ---- EXTRA BLAST: Watch ad (15s) -> +1 ----
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
      setBlastsLeft((prev) => prev + 1);
      setBlastedBox(null);
      if (soundOn) playFanfare();
      notify(t('adDoneBlast'), 'success');
    }, 15000);
  };

  // ---- EXTRA BLAST: Complete task -> +1 ----
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

  const completeTaskForBlast = async (task: TaskRow) => {
    if (!profile) return;
    await supabase.from('task_submissions').insert({
      task_id: task.id, doer_id: profile.id, proof_urls: ['[]'],
      notes: 'Completed for extra box blast', status: 'approved',
    });
    setShowTaskPicker(false);
    setBlastsLeft((prev) => prev + 1);
    setBlastedBox(null);
    if (soundOn) playFanfare();
    notify(t('extraBlastEarned'), 'success');
  };

  if (!profile) return null;

  const btnLabelTask = lang === 'bn' ? 'টাস্ক করে আরেকটি বক্স ফোটাও' : t('taskForBlastBtn');
  const btnLabelAd = lang === 'bn' ? 'অ্যাড দেখে আরেকটি বক্স ফোটাও' : t('adWatchBlastBtn');

  return (
    <div>
      {/* Header + blast counter */}
      <Card className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Gift className="text-amber-400" size={20} />
          <h2 className="text-lg font-bold text-white">{t('mysteryBlast')}</h2>
          <button
            onClick={() => setSoundOn((v) => !v)}
            className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition"
            style={{ color: soundOn ? 'var(--neon-primary)' : '#64748b' }}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
        <p className="text-sm text-slate-300 mt-2 px-4 leading-relaxed">
          {t('mysteryBlastHeader')}
        </p>
        <p className="text-sm text-slate-400 mt-2">
          {t('freeBlastsLeft')}: <span className="text-amber-300 font-bold text-base">{blastsLeft}</span>
        </p>
      </Card>

      {/* ===== 3 GLOWING 3D MYSTERY BOXES ===== */}
      <div className="relative mb-6">
        {/* Explosion canvas (covers the boxes area) */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="absolute pointer-events-none"
          style={{ top: '-80px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, maxWidth: '120%', width: '100%' }}
        />

        <div className="grid grid-cols-3 gap-3 sm:gap-4" style={{ perspective: '800px' }}>
          {[0, 1, 2].map((i) => {
            const cfg = BOX_COLORS[i];
            const isBlasted = blastedBox?.index === i;
            const disabled = blasting || blastsLeft <= 0;
            return (
              <div key={i} className="flex justify-center">
                <motion.button
                  whileHover={!disabled ? { scale: 1.06, y: -4 } : {}}
                  whileTap={!disabled ? { scale: 0.92 } : {}}
                  animate={disabled ? {} : { y: [0, -6, 0] }}
                  transition={disabled ? {} : { duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                  onClick={(e) => blastBox(i, e.currentTarget as HTMLElement)}
                  disabled={disabled}
                  className="relative"
                  style={{ width: '100%', maxWidth: 120, aspectRatio: '1', transformStyle: 'preserve-3d', transform: 'rotateX(15deg) rotateY(0deg)' }}
                >
                  {/* Glow halo */}
                  <div className="absolute inset-0 rounded-2xl" style={{
                    background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
                    filter: 'blur(16px)', transform: 'translateZ(-30px)',
                    opacity: isBlasted ? 0 : 1,
                  }} />

                  {/* Box body */}
                  <AnimatePresence>
                    {!isBlasted && (
                      <motion.div
                        exit={{ scale: 1.5, opacity: 0, rotate: 15 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: cfg.surface,
                          border: `2px solid ${cfg.accent}`,
                          boxShadow: `0 8px 24px rgba(0,0,0,0.5), inset 0 -8px 16px rgba(0,0,0,0.4), inset 0 4px 8px rgba(255,255,255,0.15), 0 0 20px ${cfg.glow}`,
                          transform: 'translateZ(20px)',
                        }}
                      >
                        {/* Lid line */}
                        <div className="absolute top-[20%] left-0 right-0 h-[3px]" style={{ background: 'rgba(0,0,0,0.3)' }} />
                        {/* Question mark */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span style={{
                            fontSize: '40px',
                            fontWeight: 900,
                            color: 'rgba(255,255,255,0.9)',
                            textShadow: `0 0 12px ${cfg.accent}, 0 2px 4px rgba(0,0,0,0.6)`,
                          }}>?</span>
                        </div>
                        {/* Metallic corner studs */}
                        <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full" style={{ background: cfg.accent, boxShadow: `0 0 4px ${cfg.accent}` }} />
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: cfg.accent, boxShadow: `0 0 4px ${cfg.accent}` }} />
                        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full" style={{ background: cfg.accent, boxShadow: `0 0 4px ${cfg.accent}` }} />
                        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: cfg.accent, boxShadow: `0 0 4px ${cfg.accent}` }} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Blasted placeholder */}
                  {isBlasted && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      className="absolute inset-0 rounded-2xl border-2 border-dashed"
                      style={{ borderColor: cfg.accent, transform: 'translateZ(10px)' }}
                    />
                  )}
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== TWO EXTRA-BLAST ACTION CARDS (shown once free blast reaches 0) ===== */}
      {blastsLeft === 0 && !blasting && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <p className="text-center text-amber-300 font-medium text-sm mb-3">{t('getMoreBlasts')}</p>
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
                <span className="text-sm font-bold text-center leading-tight">{btnLabelTask}</span>
                <span className="text-xs text-green-400/60 flex items-center gap-1"><Sparkles size={10} /> +1</span>
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
                <span className="text-sm font-bold text-center leading-tight">{adWatching ? `${adCountdown}s...` : btnLabelAd}</span>
                <span className="text-xs text-blue-400/60 flex items-center gap-1"><Star size={10} /> +1</span>
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
              initial={{ scale: 0.7, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.7, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center relative"
              style={{
                boxShadow: result.reward.value > 0
                  ? `0 0 40px ${result.reward.color}55`
                  : '0 0 20px rgba(0,0,0,0.6)',
                border: result.reward.value > 0
                  ? `1px solid ${result.reward.color}55`
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <button
                onClick={() => setResult(null)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white transition"
              >
                <X size={20} />
              </button>

              {/* Emoji */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="text-6xl mb-3"
              >
                {result.reward.emoji}
              </motion.div>

              {/* Reward amount in glowing 3D text */}
              {result.reward.value === 0 ? (
                <p className="text-3xl font-extrabold text-slate-400">{t('betterLuck')}</p>
              ) : result.reward.value === 500 ? (
                <>
                  <p className="text-sm text-pink-300 font-medium">{t('mysteryJackpot')}</p>
                  <motion.p
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    className="text-5xl font-extrabold mt-2"
                    style={{
                      color: result.reward.color,
                      textShadow: `0 0 20px ${result.reward.color}, 0 4px 8px rgba(0,0,0,0.6)`,
                    }}
                  >
                    {result.reward.value}
                  </motion.p>
                  <p className="text-lg text-amber-300 font-bold mt-1">{t('lumoraCoins')}</p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm font-medium">{t('spinReward')}</p>
                  <motion.p
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    className="text-5xl font-extrabold mt-2"
                    style={{
                      color: result.reward.color,
                      textShadow: `0 0 16px ${result.reward.color}, 0 4px 8px rgba(0,0,0,0.6)`,
                    }}
                  >
                    {result.reward.value}
                  </motion.p>
                  <p className="text-lg text-amber-300 font-bold mt-1">{t('lumoraCoins')}</p>
                </>
              )}

              {/* Funny best-friend comment */}
              <p className="text-sm text-slate-200 mt-4 px-2 leading-relaxed">
                {result.reward.comment}
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
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Sparkles size={10} /> {t('extraBlastEarned')}</p>
                    </div>
                    <Button className="text-xs py-1.5 px-3" onClick={() => completeTaskForBlast(task)}>{t('accept')}</Button>
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
