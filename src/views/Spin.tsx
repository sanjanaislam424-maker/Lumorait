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
  { value: 20, label: '20 Coins', color: '#3b82f6', emoji: '💎', comment: '২০ এলএম কয়েন পকেটে পুরে নাও! কপাল কিন্তু আস্তে আস্তে খুলতেছে!' },
  { value: 50, label: '50 Coins', color: '#06b6d4', emoji: '💥', comment: 'বুম! ৫০ কয়েন উড়িয়ে নিলে! আজকের দিনটা কিন্তু বেশ জমে উঠেছে!' },
  { value: 100, label: '100 Coins', color: '#ef4444', emoji: '🔥', comment: 'সাবাস বিটলা! এক শটে ১০০ কয়েন হাঁকিয়ে দিলে! তুই তো বস হয়া গেলি রে!' },
  { value: 200, label: '200 Coins', color: '#fb923c', emoji: '🎆', comment: 'ফাটিয়ে দিলি তো! ২০০ কয়েনের ধামাকা বোনাস! আজ রাতে বিরিয়ানি খাওয়া চাই কিন্তু!' },
  { value: 500, label: 'Mystery Jackpot', color: '#ec4899', emoji: '🎁', comment: 'বুম বুম জ্যাকপট! মিস্ট্রি বক্স থেকে ৫০০ কয়েন বেরিয়ে এলো! আজ তো পুরো পার্টি হবে দোস্ত!' },
];

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

// ---- 3D box configs: realistic metallic/wooden textures ----
type BoxConfig = {
  glow: string;
  accent: string;
  // Front face — rich metallic gradient
  front: string;
  // Top face — lighter (lit from above)
  top: string;
  // Side face — darker (in shadow)
  side: string;
  // Stud color
  stud: string;
};
const BOX_CONFIGS: BoxConfig[] = [
  {
    glow: 'rgba(236, 72, 153, 0.45)',
    accent: '#ec4899',
    front: 'linear-gradient(145deg, #9d174d 0%, #be185d 35%, #831843 70%, #6b1238 100%)',
    top: 'linear-gradient(145deg, #f9a8d4 0%, #ec4899 50%, #be185d 100%)',
    side: 'linear-gradient(180deg, #6b1238 0%, #4a0c26 100%)',
    stud: '#f9a8d4',
  },
  {
    glow: 'rgba(34, 211, 238, 0.45)',
    accent: '#22d3ee',
    front: 'linear-gradient(145deg, #0e7490 0%, #0891b2 35%, #155e75 70%, #0c4a6e 100%)',
    top: 'linear-gradient(145deg, #a5f3fc 0%, #22d3ee 50%, #0891b2 100%)',
    side: 'linear-gradient(180deg, #0c4a6e 0%, #082f49 100%)',
    stud: '#a5f3fc',
  },
  {
    glow: 'rgba(251, 191, 36, 0.45)',
    accent: '#fbbf24',
    front: 'linear-gradient(145deg, #b45309 0%, #d97706 35%, #92400e 70%, #78350f 100%)',
    top: 'linear-gradient(145deg, #fde68a 0%, #fbbf24 50%, #d97706 100%)',
    side: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)',
    stud: '#fde68a',
  },
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
  // Low boom
  playTone(60, 0.4, 'sawtooth', 0.15);
  // Crackle
  setTimeout(() => playTone(140, 0.15, 'square', 0.1), 40);
  setTimeout(() => playTone(90, 0.25, 'sawtooth', 0.08), 80);
  // Debris clatter
  setTimeout(() => playTone(200, 0.1, 'triangle', 0.06), 150);
  setTimeout(() => playTone(160, 0.12, 'triangle', 0.05), 220);
}
function playFanfare() {
  playTone(523, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 120);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.1), 240);
}
function playLose() { playTone(180, 0.3, 'sawtooth', 0.06); }

// ---- Particle system: HD sparklers, 3D debris, shockwaves ----
type Particle = {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number; maxLife: number;
  rot: number; vrot: number;
  type: 'spark' | 'debris' | 'streak' | 'glow';
  z: number; vz: number; // pseudo-3D depth
};
type Shockwave = { x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number; color: string };
const SPARK_COLORS = ['#fbbf24', '#fde68a', '#fb923c', '#f59e0b', '#fef3c7', '#22d3ee', '#ec4899', '#a855f7'];
const DEBRIS_COLORS = ['#9d174d', '#be185d', '#831843', '#0e7490', '#155e75', '#78350f', '#b45309'];

type BlastedBox = { index: number } | null;

export function Spin() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();

  // STRICT: starts at 1, only decrements on blast
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
  const shockwavesRef = useRef<Shockwave[]>([]);
  const rafRef = useRef<number | null>(null);

  // ---- Spawn full 3D explosion at (cx, cy) ----
  const spawnExplosion = useCallback((cx: number, cy: number, boxColor: string) => {
    // Shockwave rings (2-3 expanding rings)
    const ringCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < ringCount; i++) {
      shockwavesRef.current.push({
        x: cx, y: cy, radius: 5,
        maxRadius: 100 + i * 40 + Math.random() * 30,
        life: 0, maxLife: 30 + i * 10,
        color: i === 0 ? '#fbbf24' : boxColor,
      });
    }

    // HD golden sparklers (small, bright, many)
    const sparkCount = 80 + Math.floor(Math.random() * 40);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size: 2 + Math.random() * 3,
        life: 0, maxLife: 50 + Math.random() * 50,
        rot: 0, vrot: 0,
        type: 'spark',
        z: 0, vz: Math.random() * 4 - 1,
      });
    }

    // Light streaks (fast, elongated, few)
    const streakCount = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < streakCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 12;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        size: 2 + Math.random() * 2,
        life: 0, maxLife: 30 + Math.random() * 30,
        rot: angle, vrot: 0,
        type: 'streak',
        z: 0, vz: 0,
      });
    }

    // 3D debris fragments (larger, gravity, rotate)
    const debrisCount = 20 + Math.floor(Math.random() * 12);
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 9;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: DEBRIS_COLORS[Math.floor(Math.random() * DEBRIS_COLORS.length)],
        size: 5 + Math.random() * 10,
        life: 0, maxLife: 70 + Math.random() * 50,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.4,
        type: 'debris',
        z: 0, vz: Math.random() * 6 - 1,
      });
    }

    // Central glow flash
    particlesRef.current.push({
      x: cx, y: cy, vx: 0, vy: 0,
      color: '#ffffff', size: 60, life: 0, maxLife: 15,
      rot: 0, vrot: 0, type: 'glow', z: 0, vz: 0,
    });
  }, []);

  const fwLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = null; return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw shockwaves (behind particles)
    shockwavesRef.current = shockwavesRef.current.filter((sw) => {
      sw.life++;
      const t = sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * t;
      const alpha = 1 - t;
      if (alpha <= 0) return false;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * (1 - t * 0.5);
      ctx.shadowBlur = 15;
      ctx.shadowColor = sw.color;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      // Inner glow ring
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return true;
    });

    // Draw particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;

      if (p.type === 'glow') {
        // Central flash — radial gradient, fades fast
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.4, `rgba(251,191,36,${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      }

      if (p.type === 'streak') {
        // Light streak — elongated line in direction of travel
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.shadowBlur = p.size * 4;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const tailLen = 12 + p.life * 0.5;
        ctx.lineTo(p.x - Math.cos(p.rot) * tailLen, p.y - Math.sin(p.rot) * tailLen);
        ctx.stroke();
        ctx.restore();
        // Apply gravity to streaks too
        p.vy += 0.08;
        return true;
      }

      if (p.type === 'debris') {
        // 3D debris — gravity, rotation, perspective scale
        p.vy += 0.18; // heavier gravity
        p.vx *= 0.99;
        const depthScale = 1 + p.z * 0.01;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const w = p.size * depthScale;
        const h = p.size * 0.6 * depthScale;
        // Draw as 3D-looking shard (parallelogram)
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, -h / 3);
        ctx.lineTo(w / 2.5, h / 2);
        ctx.lineTo(-w / 2, h / 3);
        ctx.closePath();
        ctx.fill();
        // Highlight edge
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        return true;
      }

      // Spark — HD glowing dot with additive blending
      p.vy += 0.06;
      p.vx *= 0.97;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 4;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });

    if (particlesRef.current.length > 0 || shockwavesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(fwLoop);
    } else {
      rafRef.current = null;
    }
  }, []);

  const triggerExplosion = useCallback((boxEl: HTMLElement, boxColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const boxRect = boxEl.getBoundingClientRect();
    const cx = boxRect.left + boxRect.width / 2 - canvasRect.left;
    const cy = boxRect.top + boxRect.height / 2 - canvasRect.top;
    spawnExplosion(cx, cy, boxColor);
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(fwLoop);
  }, [spawnExplosion, fwLoop]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  // ---- CORE: blast a box ----
  const blastBox = async (boxIndex: number, boxEl: HTMLElement) => {
    if (blasting || blastsLeft <= 0 || !profile) return;

    setBlastsLeft((prev) => Math.max(0, prev - 1));
    setBlasting(true);
    setBlastedBox({ index: boxIndex });
    setResult(null);

    if (soundOn) playExplosion();
    triggerExplosion(boxEl, BOX_CONFIGS[boxIndex].accent);

    const winIdx = pickWeightedIndex();
    const reward = REWARDS[winIdx];

    // Wait for explosion to settle, then show modal
    setTimeout(async () => {
      setBlasting(false);

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
    }, 1400);
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

      {/* ===== 3 REALISTIC 3D MYSTERY BOXES ===== */}
      <div className="relative mb-6">
        {/* Explosion canvas overlay */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="absolute pointer-events-none"
          style={{ top: '-80px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, maxWidth: '130%', width: '100%' }}
        />

        <div className="grid grid-cols-3 gap-3 sm:gap-6" style={{ perspective: '900px', perspectiveOrigin: '50% 30%' }}>
          {[0, 1, 2].map((i) => {
            const cfg = BOX_CONFIGS[i];
            const isBlasted = blastedBox?.index === i;
            const disabled = blasting || blastsLeft <= 0;
            const boxSize = 110;
            return (
              <div key={i} className="flex justify-center items-end" style={{ minHeight: boxSize + 40 }}>
                {/* Ground shadow */}
                <div
                  className="absolute rounded-[50%]"
                  style={{
                    width: boxSize * 0.8, height: 12,
                    bottom: 0,
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
                    filter: 'blur(6px)',
                    opacity: isBlasted ? 0 : 0.6,
                  }}
                />

                {/* Ambient glow halo */}
                <div
                  className="absolute rounded-2xl"
                  style={{
                    width: boxSize + 40, height: boxSize + 40,
                    background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 65%)`,
                    filter: 'blur(20px)',
                    opacity: isBlasted ? 0 : 0.8,
                    transition: 'opacity 0.3s',
                  }}
                />

                <AnimatePresence mode="wait">
                  {!isBlasted ? (
                    <motion.button
                      key="box"
                      whileHover={!disabled ? { scale: 1.08, y: -6, rotateY: 8 } : {}}
                      whileTap={!disabled ? { scale: 0.94 } : {}}
                      animate={disabled ? {} : {
                        y: [0, -8, 0],
                        rotateY: [0, 5, 0, -5, 0],
                      }}
                      transition={disabled ? {} : {
                        y: { duration: 2.5 + i * 0.4, repeat: Infinity, ease: 'easeInOut' },
                        rotateY: { duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' },
                      }}
                      onClick={(e) => blastBox(i, e.currentTarget as HTMLElement)}
                      disabled={disabled}
                      className="relative cursor-pointer"
                      style={{
                        width: boxSize, height: boxSize,
                        transformStyle: 'preserve-3d',
                        transform: 'rotateX(18deg) rotateY(-15deg)',
                        border: 'none', background: 'none', padding: 0,
                      }}
                      exit={{ scale: 1.3, opacity: 0 }}
                    >
                      {/* Front face */}
                      <div className="absolute" style={{
                        width: boxSize, height: boxSize,
                        transform: `translateZ(${boxSize / 2}px)`,
                        background: cfg.front,
                        borderRadius: 10,
                        border: `1.5px solid ${cfg.accent}`,
                        boxShadow: `inset 0 -12px 24px rgba(0,0,0,0.5), inset 0 6px 12px rgba(255,255,255,0.12), inset 4px 0 8px rgba(0,0,0,0.2), inset -4px 0 8px rgba(0,0,0,0.2)`,
                      }}>
                        {/* Lid seam */}
                        <div className="absolute left-0 right-0" style={{
                          top: '22%', height: 3,
                          background: 'linear-gradient(90deg, rgba(0,0,0,0.4), rgba(0,0,0,0.6), rgba(0,0,0,0.4))',
                          boxShadow: '0 1px 0 rgba(255,255,255,0.08)',
                        }} />
                        {/* Metallic lock plate */}
                        <div className="absolute" style={{
                          top: '14%', left: '50%', transform: 'translateX(-50%)',
                          width: 18, height: 14, borderRadius: 3,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(0,0,0,0.3))',
                          border: '1px solid rgba(255,255,255,0.2)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                        }} />
                        {/* Question mark with glow */}
                        <div className="absolute inset-0 flex items-center justify-center" style={{ top: '8%' }}>
                          <span style={{
                            fontSize: '36px', fontWeight: 900,
                            color: 'rgba(255,255,255,0.92)',
                            textShadow: `0 0 16px ${cfg.accent}, 0 0 4px ${cfg.accent}, 0 3px 6px rgba(0,0,0,0.7)`,
                          }}>?</span>
                        </div>
                        {/* Corner studs */}
                        {[[8, 8], [8, boxSize - 12], [boxSize - 16, 8], [boxSize - 16, boxSize - 12]].map(([sx, sy], si) => (
                          <div key={si} className="absolute rounded-full" style={{
                            left: sx, top: sy, width: 6, height: 6,
                            background: `radial-gradient(circle at 30% 30%, ${cfg.stud}, ${cfg.accent})`,
                            boxShadow: `0 0 6px ${cfg.accent}, inset 0 -1px 2px rgba(0,0,0,0.4)`,
                          }} />
                        ))}
                      </div>

                      {/* Top face (lid) */}
                      <div className="absolute" style={{
                        width: boxSize, height: boxSize * 0.3,
                        top: 0, left: 0,
                        transform: `rotateX(-90deg) translateZ(${boxSize * 0.15}px) translateY(${boxSize * 0.15}px)`,
                        transformOrigin: 'top',
                        background: cfg.top,
                        borderRadius: '10px 10px 0 0',
                        border: `1.5px solid ${cfg.accent}`,
                        boxShadow: `inset 0 4px 8px rgba(255,255,255,0.2), inset 0 -4px 8px rgba(0,0,0,0.3)`,
                      }} />

                      {/* Right side face */}
                      <div className="absolute" style={{
                        width: boxSize * 0.3, height: boxSize,
                        top: 0, right: 0,
                        transform: `rotateY(90deg) translateZ(${boxSize * 0.2}px) translateX(${boxSize * 0.2}px)`,
                        transformOrigin: 'right',
                        background: cfg.side,
                        boxShadow: `inset 0 0 12px rgba(0,0,0,0.4)`,
                      }} />

                      {/* Top bevel highlight */}
                      <div className="absolute" style={{
                        width: boxSize - 4, height: 3,
                        top: 0, left: 2,
                        transform: `translateZ(${boxSize / 2 + 0.5}px)`,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        borderRadius: 2,
                      }} />
                    </motion.button>
                  ) : (
                    <motion.div
                      key="blasted"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 0.25, scale: 1 }}
                      className="rounded-2xl border-2 border-dashed"
                      style={{
                        width: boxSize, height: boxSize,
                        borderColor: cfg.accent,
                        transform: 'rotateX(18deg) rotateY(-15deg)',
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== TWO EXTRA-BLAST ACTION CARDS ===== */}
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

      {/* ===== GLASSMORPHISM RESULT MODAL ===== */}
      <AnimatePresence>
        {result !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setResult(null)}
          >
            <motion.div
              initial={{ scale: 0.6, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.6, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-sm w-full text-center"
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: '28px 24px',
                border: `1px solid ${result.reward.value > 0 ? `${result.reward.color}66` : 'rgba(255,255,255,0.12)'}`,
                boxShadow: result.reward.value > 0
                  ? `0 0 50px ${result.reward.color}44, 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)`
                  : `0 12px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.06)`,
              }}
            >
              <button
                onClick={() => setResult(null)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white transition"
              >
                <X size={20} />
              </button>

              {/* Glass highlight strip */}
              <div className="absolute top-0 left-1/4 right-1/4 h-px" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }} />

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
                      textShadow: `0 0 24px ${result.reward.color}, 0 0 8px ${result.reward.color}, 0 4px 8px rgba(0,0,0,0.6)`,
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
                      textShadow: `0 0 20px ${result.reward.color}, 0 4px 8px rgba(0,0,0,0.6)`,
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

      {/* ===== AD WATCHING OVERLAY ===== */}
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
