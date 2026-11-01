import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, ListChecks, Sparkles, Volume2, VolumeX, Star, X, Clock, Trophy, Crown, Zap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase, TaskRow } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

type WinnerRow = {
  id: string;
  user_name: string;
  box_type: string;
  box_label: string;
  coins_won: number;
  created_at: string;
};

type SuperEvent = {
  id: number;
  is_active: boolean;
  activation_at: string | null;
  winner_limit: number;
  reward_coins: number;
  claimers_count: number;
};

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

// ---- 3D box configs ----
type BoxConfig = {
  glow: string;
  accent: string;
  front: string;
  top: string;
  side: string;
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
function playCrack() {
  // Initial crack sound
  playTone(200, 0.08, 'square', 0.12);
  setTimeout(() => playTone(400, 0.06, 'square', 0.08), 60);
  setTimeout(() => playTone(250, 0.05, 'sawtooth', 0.06), 120);
}
function playExplosion() {
  playTone(60, 0.4, 'sawtooth', 0.15);
  setTimeout(() => playTone(140, 0.15, 'square', 0.1), 40);
  setTimeout(() => playTone(90, 0.25, 'sawtooth', 0.08), 80);
  setTimeout(() => playTone(200, 0.1, 'triangle', 0.06), 150);
  setTimeout(() => playTone(160, 0.12, 'triangle', 0.05), 220);
}
function playFanfare() {
  playTone(523, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 120);
  setTimeout(() => playTone(784, 0.25, 'sine', 0.1), 240);
}
function playLose() { playTone(180, 0.3, 'sawtooth', 0.06); }

// ---- Particle system ----
type Particle = {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number; maxLife: number;
  rot: number; vrot: number;
  type: 'spark' | 'debris' | 'streak' | 'glow';
  z: number; vz: number;
};
type Shockwave = { x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number; color: string };
const SPARK_COLORS = ['#fbbf24', '#fde68a', '#fb923c', '#f59e0b', '#fef3c7', '#22d3ee', '#ec4899', '#a855f7'];
const DEBRIS_COLORS = ['#9d174d', '#be185d', '#831843', '#0e7490', '#155e75', '#78350f', '#b45309'];

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---- Antique Treasure Chest ----
function TreasureChest({
  size, cfg, isBlasted, cracking, disabled, onClick,
}: {
  size: number; cfg: BoxConfig; isBlasted: boolean; cracking: boolean; disabled: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const w = size;
  const h = Math.round(size * 0.78);
  const lidH = Math.round(h * 0.42);
  const bodyH = h - lidH;
  const woodDark = '#3b2412';
  const woodMid = '#5b3a1f';
  const woodLight = '#7a4e2a';
  const gold = '#d4a017';
  const goldLight = '#f5d061';

  const rivets = (positions: [number, number][]) =>
    positions.map(([rx, ry], ri) => (
      <div key={ri} className="absolute rounded-full" style={{
        left: rx, top: ry, width: 4, height: 4,
        background: `radial-gradient(circle at 30% 30%, ${goldLight}, ${gold})`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.6), inset 0 -1px 1px rgba(0,0,0,0.4)',
      }} />
    ));

  return (
    <motion.button
      whileHover={!disabled && !isBlasted ? { scale: 1.06, y: -5 } : {}}
      whileTap={!disabled && !isBlasted ? { scale: 0.96 } : {}}
      animate={
        isBlasted && cracking
          ? { x: [0, -3, 3, -2, 2, -1, 1, 0], rotate: [0, 1.5, -1.5, 2, -2, 1, -1, 0] }
          : isBlasted && !cracking
          ? { scale: [1, 1.06, 1, 1] }
          : disabled
          ? {}
          : { y: [0, -6, 0] }
      }
      transition={
        isBlasted && cracking
          ? { duration: 0.5, ease: 'easeInOut' }
          : isBlasted && !cracking
          ? { duration: 1.0, ease: 'easeOut' }
          : disabled
          ? {}
          : { y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } }
      }
      onClick={onClick}
      disabled={disabled}
      className="relative cursor-pointer"
      style={{ width: w, height: h, border: 'none', background: 'none', padding: 0 }}
    >
      {/* Chest body */}
      <div className="absolute left-0 right-0 bottom-0" style={{
        height: bodyH,
        background: `linear-gradient(180deg, ${woodLight} 0%, ${woodMid} 30%, ${woodDark} 100%)`,
        borderRadius: '4px 4px 6px 6px',
        boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.6), inset 0 4px 8px rgba(255,255,255,0.06), inset 6px 0 10px rgba(0,0,0,0.3), inset -6px 0 10px rgba(0,0,0,0.3)',
        border: '1.5px solid #2a1810',
      }}>
        <div className="absolute left-0 right-0" style={{ top: bodyH * 0.33, height: 1, background: 'rgba(0,0,0,0.4)' }} />
        <div className="absolute left-0 right-0" style={{ top: bodyH * 0.66, height: 1, background: 'rgba(0,0,0,0.4)' }} />

        {/* Gold corner braces */}
        {[[0, 0], [w - 14, 0], [0, bodyH - 14], [w - 14, bodyH - 14]].map(([bx, by], bi) => (
          <div key={bi} className="absolute" style={{
            left: bx, top: by, width: 14, height: 14,
            background: `linear-gradient(135deg, ${goldLight}, ${gold}, #9a7411)`,
            borderRadius: 2,
            boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
            border: '1px solid #7a5c0e',
          }} />
        ))}
        {rivets([[4, 4], [w - 8, 4], [4, bodyH - 8], [w - 8, bodyH - 8], [w / 2 - 2, 4], [w / 2 - 2, bodyH - 8]])}

        {/* Center lock plate */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{
          top: bodyH * 0.35, width: 22, height: 26, borderRadius: 3,
          background: `linear-gradient(180deg, ${goldLight}, ${gold}, #9a7411)`,
          border: '1px solid #7a5c0e',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
        }}>
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 8, width: 6, height: 8, borderRadius: 3, background: '#2a1810', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }} />
        </div>

        {!isBlasted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span style={{
              fontSize: '30px', fontWeight: 900,
              color: 'rgba(255,235,180,0.85)',
              textShadow: `0 0 14px ${cfg.accent}, 0 2px 4px rgba(0,0,0,0.8)`,
            }}>?</span>
          </div>
        )}
      </div>

      {/* Inside glow when lid opens */}
      <AnimatePresence>
        {isBlasted && !cracking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7, 0.7] }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              bottom: bodyH - 2, width: w * 0.7, height: lidH * 1.4,
              background: `radial-gradient(ellipse at bottom, ${cfg.accent} 0%, ${cfg.accent}55 30%, transparent 70%)`,
              filter: 'blur(6px)', zIndex: 2,
            }}
          />
        )}
      </AnimatePresence>

      {/* Multi-piece lid — 3 distinct pieces that shatter apart and stay broken */}
      {(() => {
        // Piece dimensions
        const pieceW = w / 3;
        // Crack-edge zigzag paths (jagged edges between pieces)
        const leftJagged = `M0,0 L${pieceW - 3},${lidH * 0.15} L${pieceW + 2},${lidH * 0.4} L${pieceW - 4},${lidH * 0.65} L${pieceW + 1},${lidH * 0.88} L${pieceW - 2},${lidH}`;
        const midJaggedR = `M${pieceW - 1},0 L${pieceW * 2 + 3},${lidH * 0.18} L${pieceW * 2 - 2},${lidH * 0.42} L${pieceW * 2 + 4},${lidH * 0.68} L${pieceW * 2 - 1},${lidH * 0.9} L${pieceW * 2 + 2},${lidH}`;

        const lidPieceStyle = (pieceId: 'left' | 'mid' | 'right') => {
          const clipPath = pieceId === 'left'
            ? `polygon(0 0, ${pieceW + 2}px 0, ${pieceW + 2}px ${lidH * 0.4}px, ${pieceW - 4}px ${lidH * 0.65}px, ${pieceW + 1}px ${lidH * 0.88}px, ${pieceW - 2}px ${lidH}px, 0 ${lidH}px)`
            : pieceId === 'mid'
            ? `polygon(${pieceW - 3}px 0, ${pieceW * 2 + 3}px 0, ${pieceW * 2 + 4}px ${lidH * 0.68}px, ${pieceW * 2 - 1}px ${lidH * 0.9}px, ${pieceW * 2 + 2}px ${lidH}px, ${pieceW + 1}px ${lidH * 0.88}px, ${pieceW - 4}px ${lidH * 0.65}px, ${pieceW + 2}px ${lidH * 0.4}px)`
            : `polygon(${pieceW * 2 - 1}px 0, ${w}px 0, ${w}px ${lidH}px, ${pieceW * 2 + 2}px ${lidH}px, ${pieceW * 2 - 1}px ${lidH * 0.9}px, ${pieceW * 2 + 4}px ${lidH * 0.68}px, ${pieceW * 2 + 3}px ${lidH * 0.18}px)`;

          const origin = pieceId === 'left' ? 'right center' : pieceId === 'right' ? 'left center' : 'center center';

          // Resting positions after shatter (permanent)
          const restPos = isBlasted && !cracking
            ? pieceId === 'left'
              ? { x: -pieceW * 0.35, y: -lidH * 0.15, rotate: -38 }
              : pieceId === 'right'
              ? { x: pieceW * 0.35, y: -lidH * 0.15, rotate: 38 }
              : { x: 0, y: -lidH * 0.6, rotate: 0 }
            : { x: 0, y: 0, rotate: 0 };

          return { clipPath, origin, restPos };
        };

        const renderLidPiece = (pieceId: 'left' | 'mid' | 'right') => {
          const { clipPath, origin, restPos } = lidPieceStyle(pieceId);
          const left = pieceId === 'left' ? 0 : pieceId === 'mid' ? pieceW - 3 : pieceW * 2 - 1;
          const pieceWidth = pieceId === 'left' ? pieceW + 4 : pieceId === 'mid' ? pieceW + 8 : w - (pieceW * 2 - 1) + 4;
          return (
            <motion.div
              key={`lid-${pieceId}`}
              className="absolute"
              style={{
                left, top: 0, width: pieceWidth, height: lidH,
                clipPath,
                transformOrigin: origin, zIndex: 3,
              }}
              animate={
                isBlasted && cracking
                  ? pieceId === 'left'
                    ? { x: [0, -2, 1, -1, 0], rotate: [0, 2, -1, 0], }
                    : pieceId === 'right'
                    ? { x: [0, 2, -1, 1, 0], rotate: [0, -2, 1, 0] }
                    : { y: [0, -1, 0, -2, 0], rotate: [0, 1, -1, 0] }
                  : isBlasted && !cracking
                  ? pieceId === 'left'
                    ? { x: [0, -pieceW * 0.1, -pieceW * 0.35], y: [0, -lidH * 0.05, -lidH * 0.15], rotate: [-5, -15, -38], opacity: 1 }
                    : pieceId === 'right'
                    ? { x: [0, pieceW * 0.1, pieceW * 0.35], y: [0, -lidH * 0.05, -lidH * 0.15], rotate: [5, 15, 38], opacity: 1 }
                    : { y: [0, -lidH * 0.3, -lidH * 0.6], rotate: [0, -8, 0], opacity: 1 }
                  : { x: 0, y: 0, rotate: 0 }
              }
              transition={
                isBlasted && cracking
                  ? { duration: 0.5, ease: 'easeInOut' }
                  : isBlasted && !cracking
                  ? { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
                  : { duration: 0.3 }
              }
            >
              <div className="absolute inset-0" style={{
                background: `linear-gradient(180deg, ${woodLight} 0%, ${woodMid} 50%, ${woodDark} 100%)`,
                borderRadius: '6px 6px 4px 4px',
                boxShadow: 'inset 0 4px 8px rgba(255,255,255,0.08), inset 0 -6px 10px rgba(0,0,0,0.5)',
                border: '1.5px solid #2a1810',
              }}>
                {/* Gold band across pieces */}
                <div className="absolute left-0 right-0" style={{
                  top: lidH * 0.45, height: 6,
                  background: `linear-gradient(180deg, ${goldLight}, ${gold}, #9a7411)`,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
                }} />
                {pieceId === 'left' && [[0, 0]].map(([bx, by], bi) => (
                  <div key={bi} className="absolute" style={{
                    left: bx, top: by, width: 14, height: 14,
                    background: `linear-gradient(135deg, ${goldLight}, ${gold}, #9a7411)`,
                    borderRadius: 2, border: '1px solid #7a5c0e',
                  }} />
                ))}
                {pieceId === 'right' && [[pieceWidth - 14, 0]].map(([bx, by], bi) => (
                  <div key={bi} className="absolute" style={{
                    left: bx, top: by, width: 14, height: 14,
                    background: `linear-gradient(135deg, ${goldLight}, ${gold}, #9a7411)`,
                    borderRadius: 2, border: '1px solid #7a5c0e',
                  }} />
                ))}
                {pieceId === 'left' && rivets([[4, 4], [4, lidH - 6]])}
                {pieceId === 'mid' && rivets([[pieceWidth / 2 - 2, 4]])}
                {pieceId === 'right' && rivets([[pieceWidth - 8, 4], [pieceWidth - 8, lidH - 6]])}
              </div>
            </motion.div>
          );
        };

        return (
          <>
            {renderLidPiece('left')}
            {renderLidPiece('mid')}
            {renderLidPiece('right')}

            {/* Cracking glow lines along the fracture seams */}
            {isBlasted && cracking && (
              <svg className="absolute pointer-events-none" width={w} height={lidH} style={{ top: 0, left: 0, zIndex: 4 }}>
                <motion.path d={`M ${pieceW} 0 L ${pieceW - 2} ${lidH * 0.3} L ${pieceW + 3} ${lidH * 0.6} L ${pieceW - 1} ${lidH}`} stroke={cfg.accent} strokeWidth="2" fill="none"
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 1] }} transition={{ duration: 0.35 }}
                  style={{ filter: `drop-shadow(0 0 5px ${cfg.accent})` }} />
                <motion.path d={`M ${pieceW * 2} 0 L ${pieceW * 2 + 2} ${lidH * 0.3} L ${pieceW * 2 - 3} ${lidH * 0.6} L ${pieceW * 2 + 1} ${lidH}`} stroke={cfg.accent} strokeWidth="2" fill="none"
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 1] }} transition={{ duration: 0.35, delay: 0.08 }}
                  style={{ filter: `drop-shadow(0 0 5px ${cfg.accent})` }} />
              </svg>
            )}
          </>
        );
      })()}

      {/* Burst flash on open */}
      <AnimatePresence>
        {isBlasted && !cracking && (
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.4, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4 pointer-events-none"
            style={{ width: w * 1.2, height: w * 1.2, background: `radial-gradient(circle, ${cfg.accent} 0%, ${cfg.accent}55 40%, transparent 70%)`, filter: 'blur(8px)', zIndex: 4 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Spin() {
  const { t, profile, refreshProfile, lang } = useApp();
  const { notify } = useToast();

  // Persisted cooldown: stored per-user in localStorage
  const getStoredLastBlast = (): number => {
    if (!profile?.id) return 0;
    try {
      const v = localStorage.getItem(`lumora_blast_${profile.id}`);
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  };
  const setStoredLastBlast = (ts: number) => {
    if (!profile?.id) return;
    try { localStorage.setItem(`lumora_blast_${profile.id}`, String(ts)); } catch { /* ignore */ }
  };

  const [lastBlastTs, setLastBlastTs] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [extraBlasts, setExtraBlasts] = useState(0); // extra blasts from ads/tasks
  const [blasting, setBlasting] = useState(false);
  const [cracking, setCracking] = useState(false); // box is cracking phase
  const [soundOn, setSoundOn] = useState(true);
  const [result, setResult] = useState<{ reward: Reward } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [blastedBox, setBlastedBox] = useState<number | null>(null);
  const [floatingReward, setFloatingReward] = useState<{ reward: Reward; boxIndex: number } | null>(null);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [superEvent, setSuperEvent] = useState<SuperEvent | null>(null);
  const [superClaimed, setSuperClaimed] = useState(false);
  const [superBusy, setSuperBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const rafRef = useRef<number | null>(null);

  // Load persisted cooldown on mount / profile change
  useEffect(() => {
    setLastBlastTs(getStoredLastBlast());
    setExtraBlasts(0);
  }, [profile?.id]);

  // Load public winners feed
  const loadWinners = useCallback(async () => {
    const { data } = await supabase
      .from('box_winners')
      .select('id, user_name, box_type, box_label, coins_won, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setWinners((data as WinnerRow[]) || []);
  }, []);

  // Load super mystery box event config
  const loadSuperEvent = useCallback(async () => {
    const { data } = await supabase
      .from('super_mystery_events')
      .select('id, is_active, activation_at, winner_limit, reward_coins, claimers_count')
      .eq('id', 1)
      .maybeSingle();
    setSuperEvent((data as SuperEvent) || null);
  }, []);

  // Check if current user already claimed the super reward
  useEffect(() => {
    if (!profile?.id || !superEvent || !superEvent.is_active) return;
    (async () => {
      const { data } = await supabase
        .from('box_winners')
        .select('id')
        .eq('user_id', profile.id)
        .eq('box_type', 'super')
        .limit(1);
      setSuperClaimed(!!(data && data.length > 0));
    })();
  }, [profile?.id, superEvent]);

  useEffect(() => {
    loadWinners();
    loadSuperEvent();
  }, [loadWinners, loadSuperEvent]);

  // Realtime subscription for new winners
  useEffect(() => {
    const ch = supabase
      .channel('box_winners_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'box_winners' }, () => {
        loadWinners();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadWinners]);

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const cooldownRemaining = Math.max(0, (lastBlastTs + COOLDOWN_MS) - now);
  const freeBoxReady = cooldownRemaining === 0;
  const blastsLeft = (freeBoxReady ? 1 : 0) + extraBlasts;

  // Format countdown
  const formatCountdown = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}${t('hrs')} ${m}${t('mins')} ${s}${t('secs')}`;
  };

  // ---- Spawn full 3D explosion ----
  const spawnExplosion = useCallback((cx: number, cy: number, boxColor: string) => {
    const ringCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < ringCount; i++) {
      shockwavesRef.current.push({
        x: cx, y: cy, radius: 5,
        maxRadius: 100 + i * 40 + Math.random() * 30,
        life: 0, maxLife: 30 + i * 10,
        color: i === 0 ? '#fbbf24' : boxColor,
      });
    }

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
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return true;
    });

    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) return false;

      if (p.type === 'glow') {
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
        p.vy += 0.08;
        return true;
      }

      if (p.type === 'debris') {
        p.vy += 0.18;
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
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, -h / 3);
        ctx.lineTo(w / 2.5, h / 2);
        ctx.lineTo(-w / 2, h / 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        return true;
      }

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
    if (blasting || cracking || blastsLeft <= 0 || !profile) return;

    // Determine if this is a free blast or extra blast
    const usingFree = freeBoxReady;

    setBlasting(true);
    setCracking(true);
    setBlastedBox(boxIndex);
    setResult(null);
    setFloatingReward(null);

    // Phase 1: Cracking — box stays visible, shakes and cracks
    if (soundOn) playCrack();

    // After 500ms of cracking, trigger explosion
    setTimeout(() => {
      setCracking(false);
      if (soundOn) playExplosion();
      triggerExplosion(boxEl, BOX_CONFIGS[boxIndex].accent);

      const winIdx = pickWeightedIndex();
      const reward = REWARDS[winIdx];

      // Show floating coin reveal immediately as box shatters
      setFloatingReward({ reward, boxIndex });

      // Persist cooldown if this was the free blast
      if (usingFree) {
        const ts = Date.now();
        setStoredLastBlast(ts);
        setLastBlastTs(ts);
      } else {
        setExtraBlasts((prev) => Math.max(0, prev - 1));
      }

      // After explosion settles, update DB and show modal
      setTimeout(async () => {
        setBlasting(false);

        if (profile) {
          const { data: fresh } = await supabase
            .from('profiles')
            .select('lumora_coins, bonus_coins')
            .eq('id', profile.id)
            .maybeSingle();
          await supabase.from('profiles').update({
            lumora_coins: (fresh?.lumora_coins ?? profile.lumora_coins) + reward.value,
            bonus_coins: (fresh?.bonus_coins ?? 0) + reward.value,
          }).eq('id', profile.id);
          await supabase.from('spin_history').insert({ user_id: profile.id, reward: reward.value, label: reward.label });
          if (reward.value > 0) {
            await supabase.from('transactions').insert({
              user_id: profile.id, type: 'spin', amount: reward.value, status: 'completed', note: `Mystery box blast: ${reward.label}`,
            });
            await supabase.from('box_winners').insert({
              user_id: profile.id,
              user_name: profile?.full_name || profile?.phone || 'Lumora User',
              box_type: 'normal',
              box_label: lang === 'bn' ? 'নরমাল মিস্ট্রি বক্স' : 'Normal Mystery Box',
              coins_won: reward.value,
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

        // Clear floating reward after a delay; chest stays permanently open
        setTimeout(() => {
          setFloatingReward(null);
        }, 2000);
      }, 1200);
    }, 500);
  };

  // ---- EXTRA BLAST: Watch ad ----
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
      setExtraBlasts((prev) => prev + 1);
      if (soundOn) playFanfare();
      notify(t('adDoneBlast'), 'success');
    }, 15000);
  };

  // ---- EXTRA BLAST: Complete task ----
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
    setExtraBlasts((prev) => prev + 1);
    if (soundOn) playFanfare();
    notify(t('extraBlastEarned'), 'success');
  };

  // ---- SUPER MYSTERY BOX CLAIM ----
  const claimSuperReward = async () => {
    if (!profile || !superEvent || superBusy) return;
    const now = Date.now();
    const activationTime = superEvent.activation_at ? new Date(superEvent.activation_at).getTime() : 0;
    if (!superEvent.is_active || now < activationTime) {
      notify(t('superEventInactive'), 'error');
      return;
    }
    if (superClaimed) {
      notify(t('superEventClaimed'), 'error');
      return;
    }
    if (superEvent.claimers_count >= superEvent.winner_limit) {
      notify(t('superEventFull'), 'error');
      return;
    }
    setSuperBusy(true);
    try {
      const { data: fresh } = await supabase
        .from('profiles')
        .select('lumora_coins, bonus_coins')
        .eq('id', profile.id)
        .maybeSingle();
      const reward = superEvent.reward_coins;
      await supabase.from('profiles').update({
        lumora_coins: (fresh?.lumora_coins ?? profile.lumora_coins) + reward,
        bonus_coins: (fresh?.bonus_coins ?? 0) + reward,
      }).eq('id', profile.id);
      await supabase.from('transactions').insert({
        user_id: profile.id, type: 'spin', amount: reward, status: 'completed',
        note: `Super Mystery Box grand reward: ${reward} coins`,
      });
      await supabase.from('box_winners').insert({
        user_id: profile.id,
        user_name: profile?.full_name || profile?.phone || 'Lumora User',
        box_type: 'super',
        box_label: lang === 'bn' ? 'সুপার মিস্ট্রি বক্স' : 'Super Mystery Box',
        coins_won: reward,
      });
      await supabase.from('super_mystery_events').update({
        claimers_count: (superEvent.claimers_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      await refreshProfile();
      setSuperClaimed(true);
      setSuperEvent({ ...superEvent, claimers_count: (superEvent.claimers_count ?? 0) + 1 });
      setCelebrate(true);
      if (soundOn) playFanfare();
      notify(t('superEventClaimedSuccess'), 'success');
      loadWinners();
    } finally { setSuperBusy(false); }
  };

  // Format Bengali date for winners feed
  const formatWinnerDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (lang === 'bn') {
        const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
        const h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        const m = d.getMinutes();
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${ampm === 'PM' ? 'দুপুর/রাত' : 'সকাল'} ${h12}:${m < 10 ? '0' + m : m}`;
      }
      return d.toLocaleString();
    } catch { return iso; }
  };

  // Super event live status
  const superLive = superEvent?.is_active && superEvent?.activation_at
    ? Date.now() >= new Date(superEvent.activation_at).getTime()
    : superEvent?.is_active;
  const superSlotsLeft = superEvent ? Math.max(0, superEvent.winner_limit - superEvent.claimers_count) : 0;

  if (!profile) return null;

  const btnLabelTask = lang === 'bn' ? 'টাস্ক করে আরেকটি বক্স ফোটাও' : t('taskForBlastBtn');
  const btnLabelAd = lang === 'bn' ? 'অ্যাড দেখে আরেকটি বক্স ফোটাও' : t('adWatchBlastBtn');
  const boxSize = 110;

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

        {/* Cooldown / blast count display */}
        {freeBoxReady ? (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <Sparkles size={14} className="text-green-400" />
            <span className="text-sm text-green-300 font-medium">{t('boxReady')}</span>
            <span className="text-sm text-amber-300 font-bold">{blastsLeft} {t('freeBlastsLeft')}</span>
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Clock size={14} className="text-amber-400" />
            <span className="text-sm text-amber-300 font-medium">{t('nextFreeBoxIn')}</span>
            <span className="text-sm text-amber-200 font-bold tabular-nums">{formatCountdown(cooldownRemaining)}</span>
          </div>
        )}

        {extraBlasts > 0 && (
          <p className="text-xs text-blue-300 mt-2">
            {lang === 'bn' ? `অতিরিক্ত ব্লাস্ট: ${extraBlasts}` : `Extra blasts: ${extraBlasts}`}
          </p>
        )}
      </Card>

      {/* ===== SUPER MYSTERY BOX EVENT BANNER ===== */}
      {superEvent && superEvent.is_active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4"
        >
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-600/20 via-orange-600/15 to-yellow-600/20 p-4">
            <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.3), transparent 60%)' }} />
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown size={22} className="text-amber-400" />
                <h3 className="text-lg font-bold text-amber-300">{t('superMysteryBoxEvent')}</h3>
              </div>
              {superLive ? (
                <>
                  <p className="text-2xl font-extrabold text-amber-200 mb-1">
                    {superEvent.reward_coins} {t('lumoraCoins')}
                  </p>
                  <p className="text-xs text-amber-300/80 mb-3">
                    {superSlotsLeft} / {superEvent.winner_limit} {t('superEventWinnerLimit')}
                  </p>
                  <Button
                    disabled={superBusy || superClaimed || superSlotsLeft === 0}
                    onClick={claimSuperReward}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold"
                  >
                    <Zap size={16} className="mr-1" />
                    {superClaimed ? t('superEventClaimed') : superSlotsLeft === 0 ? t('superEventFull') : t('superEventClaimBtn')}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-amber-300/80">
                  {t('superEventStartsIn')}: {superEvent.activation_at ? new Date(superEvent.activation_at).toLocaleString() : '—'}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== RECENT WINNERS FEED ===== */}
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white">{t('recentWinners')}</h3>
        </div>
        <p className="text-[10px] text-slate-400 mb-3">{t('recentWinnersDesc')}</p>
        {winners.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">{t('noWinnersYet')}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <AnimatePresence>
              {winners.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 rounded-xl p-2.5 border ${
                    w.box_type === 'super'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-slate-800/50 border-white/10'
                  }`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    w.box_type === 'super' ? 'bg-amber-500/20' : 'bg-fuchsia-500/15'
                  }`}>
                    {w.box_type === 'super'
                      ? <Crown size={16} className="text-amber-400" />
                      : <Gift size={16} className="text-fuchsia-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{w.user_name || 'Lumora User'}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {w.box_label} • {formatWinnerDate(w.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-amber-300">+{w.coins_won}</p>
                    <p className="text-[9px] text-slate-500">{t('lumoraCoins')}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* ===== 3 MYSTERY BOXES ===== */}
      <div className="relative mb-6">
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
            const isBlasted = blastedBox === i;
            const disabled = blasting || blastsLeft <= 0;
            return (
              <div key={i} className="flex justify-center items-end relative" style={{ minHeight: boxSize + 40 }}>
                {/* Ground shadow */}
                <div
                  className="absolute rounded-[50%]"
                  style={{
                    width: boxSize * 0.8, height: 12,
                    bottom: 0,
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
                    filter: 'blur(6px)',
                    opacity: isBlasted ? 0 : 0.6,
                    transition: 'opacity 0.3s',
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

                {/* Antique Treasure Chest — lid snaps open on blast, stays in place */}
                <TreasureChest
                  size={boxSize}
                  cfg={cfg}
                  isBlasted={isBlasted}
                  cracking={cracking}
                  disabled={disabled}
                  onClick={(e) => blastBox(i, e.currentTarget as HTMLElement)}
                />

                {/* Flying reward — emerges from inside the chest and floats up */}
                <AnimatePresence>
                  {floatingReward && floatingReward.boxIndex === i && (
                    <motion.div
                      key="float-reward"
                      initial={{ opacity: 0, y: 20, scale: 0.2 }}
                      animate={{ opacity: 1, y: -90, scale: 1 }}
                      exit={{ opacity: 0, y: -150, scale: 0.7 }}
                      transition={{ duration: 1.8, ease: 'easeOut' }}
                      className="absolute pointer-events-none z-50 flex flex-col items-center"
                      style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <motion.div
                        animate={{ rotateY: [0, 360] }}
                        transition={{ duration: 1, repeat: 2, ease: 'linear' }}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={{
                          background: `radial-gradient(circle at 35% 35%, ${floatingReward.reward.color}, ${floatingReward.reward.color}88)`,
                          boxShadow: `0 0 20px ${floatingReward.reward.color}, 0 0 40px ${floatingReward.reward.color}66, inset 0 2px 8px rgba(255,255,255,0.3)`,
                          border: `2px solid ${floatingReward.reward.color}`,
                        }}
                      >
                        {floatingReward.reward.value > 0 ? floatingReward.reward.emoji : '💨'}
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-extrabold mt-2 whitespace-nowrap"
                        style={{
                          color: floatingReward.reward.value > 0 ? '#fbbf24' : '#94a3b8',
                          textShadow: `0 0 16px ${floatingReward.reward.color}, 0 0 4px ${floatingReward.reward.color}, 0 2px 4px rgba(0,0,0,0.8)`,
                        }}
                      >
                        {floatingReward.reward.value > 0 ? `+${floatingReward.reward.value}` : '0'} {t('lumoraCoins')}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.9 }}
                        transition={{ delay: 0.5 }}
                        className="text-xs text-slate-200 mt-1 text-center max-w-[180px] leading-tight px-2"
                      >
                        {floatingReward.reward.comment}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== EXTRA-BLAST ACTION CARDS (always visible if no free box ready) ===== */}
      {blastsLeft === 0 && !blasting && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <p className="text-center text-amber-300 font-medium text-sm mb-3">{t('getMoreBlasts')}</p>
          <div className="grid grid-cols-2 gap-3">
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

      {/* ===== RESULT MODAL ===== */}
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

              <div className="absolute top-0 left-1/4 right-1/4 h-px" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }} />

              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="text-6xl mb-3"
              >
                {result.reward.emoji}
              </motion.div>

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

      {/* ===== AD OVERLAY ===== */}
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

      {/* ===== TASK PICKER ===== */}
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

      {/* Auto-dismiss result modal after 4 seconds */}
      <ResultAutoDismiss result={result} setResult={setResult} />
    </div>
  );
}

function ResultAutoDismiss({ result, setResult }: { result: { reward: Reward } | null; setResult: (v: { reward: Reward } | null) => void }) {
  useEffect(() => {
    if (!result) return;
    const tm = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(tm);
  }, [result, setResult]);
  return null;
}
