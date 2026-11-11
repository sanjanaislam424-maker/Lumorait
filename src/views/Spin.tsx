import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, ListChecks, Sparkles, Volume2, VolumeX, Star, X, Clock, Trophy, Crown, Zap, Plus, Users } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { createMicrocopy } from '@/lib/microcopy';
import { supabase } from '@/lib/supabase';
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

type P2pTaskRow = {
  id: string;
  title: string;
  description: string;
  platform: string;
  target_url: string | null;
  reward_coins: number;
  cost_coins: number;
  creator_id: string;
  status: string;
  filled: number;
  photo_urls: string[] | null;
};

type PendingSubmission = {
  id: string;
  task_id: string;
  doer_id: string;
  doer_name: string | null;
  proof_urls: string[];
  notes: string;
  status: string;
  task_title: string;
};

function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      if (u.pathname.startsWith('/embed/')) return url;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
  } catch { /* not a url */ }
  return null;
}

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

// Guaranteed reward for Bonus Mystery Boxes — never zero, minimum 5 coins.
const BONUS_REWARDS: Reward[] = REWARDS.filter((r) => r.value >= 5);
const BONUS_WEIGHTS = [25, 22, 18, 12, 8, 5, 3, 2];

function pickBonusRewardIndex(): number {
  const total = BONUS_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < BONUS_WEIGHTS.length; i++) {
    r -= BONUS_WEIGHTS[i];
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
  size, cfg, isBlasted, cracking, repairing, disabled, onClick,
}: {
  size: number; cfg: BoxConfig; isBlasted: boolean; cracking: boolean; repairing: boolean; disabled: boolean;
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
          : isBlasted && repairing
          ? { scale: [1, 1.03, 1] }
          : isBlasted && !cracking
          ? { scale: [1, 1.06, 1, 1] }
          : disabled
          ? {}
          : { y: [0, -6, 0] }
      }
      transition={
        isBlasted && cracking
          ? { duration: 0.5, ease: 'easeInOut' }
          : isBlasted && repairing
          ? { duration: 0.6, ease: 'easeInOut' }
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
        {isBlasted && !cracking && !repairing && (
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

      {/* Lid — single solid piece when pristine, splits into 3 fragments when blasted */}
      {!isBlasted ? (
        <div className="absolute left-0 right-0" style={{ top: 0, height: lidH, zIndex: 3 }}>
          <div className="absolute inset-0" style={{
            background: `linear-gradient(180deg, ${woodLight} 0%, ${woodMid} 50%, ${woodDark} 100%)`,
            borderRadius: '6px 6px 4px 4px',
            boxShadow: 'inset 0 4px 8px rgba(255,255,255,0.08), inset 0 -6px 10px rgba(0,0,0,0.5)',
            border: '1.5px solid #2a1810',
          }}>
            <div className="absolute left-0 right-0" style={{
              top: lidH * 0.45, height: 6,
              background: `linear-gradient(180deg, ${goldLight}, ${gold}, #9a7411)`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
            }} />
            {[[0, 0], [w - 14, 0]].map(([bx, by], bi) => (
              <div key={bi} className="absolute" style={{
                left: bx, top: by, width: 14, height: 14,
                background: `linear-gradient(135deg, ${goldLight}, ${gold}, #9a7411)`,
                borderRadius: 2, border: '1px solid #7a5c0e',
              }} />
            ))}
            {rivets([[4, 4], [w - 8, 4], [4, lidH - 6], [w - 8, lidH - 6], [w / 2 - 2, 4]])}
          </div>
        </div>
      ) : (
      <>
      {/* Multi-piece lid — 3 distinct pieces that shatter apart and stay broken */}
      {(() => {
        const pieceW = w / 3;

        const lidPieceStyle = (pieceId: 'left' | 'mid' | 'right') => {
          const clipPath = pieceId === 'left'
            ? `polygon(0 0, ${pieceW + 2}px 0, ${pieceW + 2}px ${lidH * 0.4}px, ${pieceW - 4}px ${lidH * 0.65}px, ${pieceW + 1}px ${lidH * 0.88}px, ${pieceW - 2}px ${lidH}px, 0 ${lidH}px)`
            : pieceId === 'mid'
            ? `polygon(${pieceW - 3}px 0, ${pieceW * 2 + 3}px 0, ${pieceW * 2 + 4}px ${lidH * 0.68}px, ${pieceW * 2 - 1}px ${lidH * 0.9}px, ${pieceW * 2 + 2}px ${lidH}px, ${pieceW + 1}px ${lidH * 0.88}px, ${pieceW - 4}px ${lidH * 0.65}px, ${pieceW + 2}px ${lidH * 0.4}px)`
            : `polygon(${pieceW * 2 - 1}px 0, ${w}px 0, ${w}px ${lidH}px, ${pieceW * 2 + 2}px ${lidH}px, ${pieceW * 2 - 1}px ${lidH * 0.9}px, ${pieceW * 2 + 4}px ${lidH * 0.68}px, ${pieceW * 2 + 3}px ${lidH * 0.18}px)`;

          const origin = pieceId === 'left' ? 'right center' : pieceId === 'right' ? 'left center' : 'center center';
          return { clipPath, origin };
        };

        const renderLidPiece = (pieceId: 'left' | 'mid' | 'right') => {
          const { clipPath, origin } = lidPieceStyle(pieceId);
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
                    ? { x: [0, -2, 1, -1, 0], rotate: [0, 2, -1, 0] }
                    : pieceId === 'right'
                    ? { x: [0, 2, -1, 1, 0], rotate: [0, -2, 1, 0] }
                    : { y: [0, -1, 0, -2, 0], rotate: [0, 1, -1, 0] }
                  : isBlasted && repairing
                  ? pieceId === 'left'
                    ? { x: [-pieceW * 0.35, 0], y: [-lidH * 0.15, 0], rotate: [-38, 0] }
                    : pieceId === 'right'
                    ? { x: [pieceW * 0.35, 0], y: [-lidH * 0.15, 0], rotate: [38, 0] }
                    : { y: [-lidH * 0.6, 0], rotate: [0, 0] }
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
                  : isBlasted && repairing
                  ? { duration: 0.6, ease: 'easeInOut' }
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
      </>
      )}

      {/* Burst flash on open */}
      <AnimatePresence>
        {isBlasted && !cracking && !repairing && (
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
  const [blasting, setBlasting] = useState(false);
  const [crackingBox, setCrackingBox] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [result, setResult] = useState<{ reward: Reward } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [blastedBoxes, setBlastedBoxes] = useState<Set<number>>(new Set());
  const [repairingBoxes, setRepairingBoxes] = useState<Set<number>>(new Set());
  const repairTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [floatingReward, setFloatingReward] = useState<{ reward: Reward; boxIndex: number } | null>(null);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(15);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [superEvent, setSuperEvent] = useState<SuperEvent | null>(null);
  const [superClaimed, setSuperClaimed] = useState(false);
  const [superBusy, setSuperBusy] = useState(false);
  const [boxUnlock, setBoxUnlock] = useState({ task: true, video: true });
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [videoUnlockWatching, setVideoUnlockWatching] = useState(false);
  const [videoUnlockCountdown, setVideoUnlockCountdown] = useState(10);
  const [tutorialUrl, setTutorialUrl] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTaskHub, setShowTaskHub] = useState(false);
  const [p2pTasks, setP2pTasks] = useState<P2pTaskRow[]>([]);
  const [addTaskForm, setAddTaskForm] = useState({ title: '', description: '', platform: 'youtube', target_url: '', cost_coins: 25 });
  const [addTaskBusy, setAddTaskBusy] = useState(false);
  const [addTaskPhotos, setAddTaskPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const taskPhotoInputRef = useRef<HTMLInputElement>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<P2pTaskRow | null>(null);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [proofUploading, setProofUploading] = useState(false);
  const proofPhotoInputRef = useRef<HTMLInputElement>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [pendingSubs, setPendingSubs] = useState<PendingSubmission[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const rafRef = useRef<number | null>(null);

  // Load persisted cooldown on mount / profile change
  useEffect(() => {
    setLastBlastTs(getStoredLastBlast());
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

  // Load admin-controlled unlock toggles + tutorial URL
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('box_unlock_task_enabled, box_unlock_video_enabled, box_tutorial_url')
        .eq('id', 1)
        .maybeSingle();
      if (data) {
        setBoxUnlock({
          task: data.box_unlock_task_enabled !== false,
          video: data.box_unlock_video_enabled !== false,
        });
        setTutorialUrl(data.box_tutorial_url || null);
      }
    })();
  }, []);

  // Load open P2P box tasks from other users
  const loadP2pTasks = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, platform, target_url, reward_coins, cost_coins, creator_id, status, filled, photo_urls')
      .eq('is_admin_task', false)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20);
    setP2pTasks((data as P2pTaskRow[]) || []);
  }, [profile?.id]);

  // Load pending submissions for tasks the current user created
  const loadPendingSubs = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('task_submissions')
      .select('id, task_id, doer_id, proof_urls, notes, status, tasks!inner(title, creator_id)')
      .eq('status', 'pending')
      .eq('tasks.creator_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) {
      const mapped: PendingSubmission[] = (data as any[]).map((r) => ({
        id: r.id,
        task_id: r.task_id,
        doer_id: r.doer_id,
        doer_name: null,
        proof_urls: r.proof_urls || [],
        notes: r.notes || '',
        status: r.status,
        task_title: r.tasks?.title || '',
      }));
      // Fetch doer names
      const doerIds = [...new Set(mapped.map((m) => m.doer_id))];
      if (doerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', doerIds);
        const nameMap = new Map<string, string>();
        (profiles || []).forEach((p: any) => {
          nameMap.set(p.id, p.full_name || p.phone || 'Lumora User');
        });
        mapped.forEach((m) => { m.doer_name = nameMap.get(m.doer_id) || 'Lumora User'; });
      }
      setPendingSubs(mapped);
    } else {
      setPendingSubs([]);
    }
  }, [profile?.id]);

  useEffect(() => { loadP2pTasks(); loadPendingSubs(); }, [loadP2pTasks, loadPendingSubs]);

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

  // Realtime: toast the creator when someone completes their P2P box task
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel('p2p_box_tasks_watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `creator_id=eq.${profile.id}` },
        (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { status?: string; title?: string } | null;
          if (newRow?.status === 'closed' && oldRow?.status === 'open') {
            loadP2pTasks();
            if (soundOn) playFanfare();
            setCelebrate(true);
            notify(
              lang === 'bn'
                ? `দারুণ খবর! কেউ তোমার "${newRow.title || 'টাস্ক'}" টাস্ক কমপ্লিট করেছে — তোমার +১ বোনাস মিস্ট্রি বক্স যোগ হয়ে গেছে!`
                : `Great news! Someone completed your task "${newRow.title || 'task'}" — your +1 bonus Mystery Box has been added!`,
              'success'
            );
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, lang, soundOn, loadP2pTasks, notify]);

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const cooldownRemaining = Math.max(0, (lastBlastTs + COOLDOWN_MS) - now);
  const freeBoxReady = cooldownRemaining === 0;
  const bonusSlots = profile?.box_slots ?? 0;
  const blastsLeft = (freeBoxReady ? 1 : 0) + bonusSlots;

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
    repairTimersRef.current.forEach((t) => clearTimeout(t));
    repairTimersRef.current.clear();
  }, []);

  // ---- CORE: blast a box ----
  const blastBox = async (boxIndex: number, boxEl: HTMLElement) => {
    if (blasting || crackingBox !== null || !profile) return;
    if (blastsLeft <= 0) {
      // Out of blasts — show the funny best-friend limit popup instead of opening the box
      setShowLimitPopup(true);
      if (soundOn) playLose();
      return;
    }

    // Determine if this is a free blast or extra blast
    const usingFree = freeBoxReady;

    setBlasting(true);
    setCrackingBox(boxIndex);
    setBlastedBoxes((prev) => new Set(prev).add(boxIndex));
    setResult(null);
    setFloatingReward(null);

    // Phase 1: Cracking — box stays visible, shakes and cracks
    if (soundOn) playCrack();

    // After 500ms of cracking, trigger explosion
    setTimeout(() => {
      setCrackingBox(null);
      if (soundOn) playExplosion();
      triggerExplosion(boxEl, BOX_CONFIGS[boxIndex].accent);

      const winIdx = usingFree ? pickWeightedIndex() : pickBonusRewardIndex();
      const reward = usingFree ? REWARDS[winIdx] : BONUS_REWARDS[winIdx];

      // Show floating coin reveal immediately as box shatters
      setFloatingReward({ reward, boxIndex });

      // Persist cooldown if this was the free blast; otherwise spend a bonus box via RPC
      if (usingFree) {
        const ts = Date.now();
        setStoredLastBlast(ts);
        setLastBlastTs(ts);
      } else {
        (async () => {
          const { error: spendError } = await supabase.rpc('spend_bonus_box');
          if (!spendError) await refreshProfile();
        })();
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

        // Clear floating reward after a delay
        setTimeout(() => {
          setFloatingReward(null);
        }, 2000);

        // 15-second auto-repair: merge lid pieces back and restore to pristine
        const repairTimer = setTimeout(() => {
          repairTimersRef.current.delete(boxIndex);
          setRepairingBoxes((prev) => new Set(prev).add(boxIndex));
          // After repair animation completes, clear both states
          setTimeout(() => {
            setBlastedBoxes((prev) => { const n = new Set(prev); n.delete(boxIndex); return n; });
            setRepairingBoxes((prev) => { const n = new Set(prev); n.delete(boxIndex); return n; });
          }, 600);
        }, 15000);
        repairTimersRef.current.set(boxIndex, repairTimer);
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
      (async () => {
        const { error } = await supabase.rpc('earn_bonus_box', { p_source: 'ad' });
        if (!error) await refreshProfile();
      })();
      if (soundOn) playFanfare();
      notify(t('adDoneBlast'), 'success');
    }, 15000);
  };

  // ---- VIDEO UNLOCK from the limit popup ----
  const startVideoUnlock = () => {
    if (videoUnlockWatching) return;
    setVideoUnlockWatching(true);
    setVideoUnlockCountdown(10);
    const countdown = setInterval(() => {
      setVideoUnlockCountdown((p) => { if (p <= 1) { clearInterval(countdown); return 0; } return p - 1; });
    }, 1000);
    setTimeout(() => {
      clearInterval(countdown);
      setVideoUnlockWatching(false);
      (async () => {
        const { error } = await supabase.rpc('earn_bonus_box', { p_source: 'video_unlock' });
        if (!error) { await refreshProfile(); }
      })();
      setShowLimitPopup(false);
      if (soundOn) playFanfare();
      notify(lang === 'bn' ? 'ভিডিও দেখা শেষ! +১ মিস্ট্রি বক্স আনলক হয়েছে, দোস্ত!' : 'Video done! +1 Mystery Box unlocked, buddy!', 'success');
    }, 10000);
  };

  // ---- P2P BOX TASKS: publish + complete ----
  const uploadTaskPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (addTaskPhotos.length >= 3) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `box-tasks/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('support-screenshots')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('support-screenshots').getPublicUrl(fileName);
      setAddTaskPhotos((prev) => [...prev, data.publicUrl]);
    } catch {
      notify(lang === 'bn' ? 'ছবি আপলোড করা যায়নি।' : 'Could not upload photo.', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  // ---- P2P BOX TASKS: publish + complete ----
  const publishBoxTask = async () => {
    if (addTaskBusy || !profile) return;
    if (addTaskForm.title.trim().length < 3) {
      notify(lang === 'bn' ? 'টাস্কের একটা নাম দাও দোস্ত!' : 'Give your task a name, buddy!', 'error');
      return;
    }
    const url = addTaskForm.target_url.trim();
    if (!url) {
      notify(lang === 'bn' ? 'টাস্ক লিংক দেওয়া বাধ্যতামূলক দোস্ত!' : 'Task link is required, buddy!', 'error');
      return;
    }
    if (!/^https?:\/\/.+\..+/.test(url)) {
      notify(lang === 'bn' ? 'একটা সঠিক লিংক দাও (https://...)!' : 'Please enter a valid URL (https://...)!', 'error');
      return;
    }
    setAddTaskBusy(true);
    try {
      const { data, error } = await supabase.rpc('publish_box_task', {
        p_title: addTaskForm.title.trim(),
        p_description: addTaskForm.description.trim(),
        p_platform: addTaskForm.platform,
        p_target_url: url,
        p_cost_coins: Math.max(0, addTaskForm.cost_coins),
        p_photo_urls: addTaskPhotos,
      });
      if (error) throw error;
      setAddTaskForm({ title: '', description: '', platform: 'youtube', target_url: '', cost_coins: 25 });
      setAddTaskPhotos([]);
      setShowAddTask(false);
      await refreshProfile();
      loadP2pTasks();
      if (soundOn) playFanfare();
      notify(lang === 'bn' ? 'টাস্ক পাবলিশ হয়ে গেছে! কেউ কমপ্লিট করলেই তুমি +১ মিস্ট্রি বক্স পাবে!' : 'Task published! You will earn +1 Mystery Box when someone completes it!', 'success');
    } catch (e: unknown) {
      console.error('DETAILED TASK PUBLISH ERROR:', e);
      const err = e as { message?: string; code?: string; details?: string; hint?: string };
      const msg = err?.message || (e instanceof Error ? e.message : 'unknown');
      const code = err?.code || '';
      const hint = err?.hint || '';
      const fullDetail = `${msg}${code ? ` [${code}]` : ''}${hint ? ` — ${hint}` : ''}`;

      if (msg.includes('insufficient_coins')) {
        notify(lang === 'bn' ? 'কয়েন যথেষ্ট নেই দোস্ত! আগে টাকা ভরো বা টাস্ক করো।' : 'Not enough coins, buddy! Deposit or do tasks first.', 'error');
      } else if (msg.includes('missing_url') || msg.includes('invalid_url')) {
        notify(lang === 'bn' ? 'টাস্ক লিংক সঠিক নয়!' : 'Please provide a valid task link!', 'error');
      } else if (msg.includes('not_authenticated')) {
        notify(lang === 'bn' ? 'লগইন করা নেই! আবার লগইন করো।' : 'Not authenticated! Please log in again.', 'error');
      } else if (msg.includes('profile_not_found')) {
        notify(lang === 'bn' ? 'প্রোফাইল পাওয়া যায়নি! পেজ রিফ্রেশ করো।' : 'Profile not found! Please refresh the page.', 'error');
      } else if (msg.includes('invalid_title')) {
        notify(lang === 'bn' ? 'টাস্কের নাম ৩-১২০ অক্ষরের মধ্যে দাও।' : 'Task title must be 3-120 characters.', 'error');
      } else if (msg.includes('invalid_cost')) {
        notify(lang === 'bn' ? 'রিওয়ার্ড কয়েন সঠিক নয়!' : 'Invalid reward coins amount!', 'error');
      } else if (code === '42501' || msg.includes('permission') || msg.includes('RLS') || msg.includes('policy')) {
        notify(lang === 'bn' ? `ডাটাবেস পারমিশন এরর: ${fullDetail}` : `Database permission error: ${fullDetail}`, 'error');
      } else if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        notify(lang === 'bn' ? `ডাটাবেস কলাম সমস্যা: ${fullDetail}` : `Database column issue: ${fullDetail}`, 'error');
      } else if (code === '42883' || msg.includes('function') || msg.includes('does not exist')) {
        notify(lang === 'bn' ? `ফাংশন সমস্যা: ${fullDetail}` : `Database function issue: ${fullDetail}`, 'error');
      } else {
        notify(`${lang === 'bn' ? 'পাবলিশ ব্যর্থ: ' : 'Publish failed: '}${fullDetail}`, 'error');
      }
    } finally { setAddTaskBusy(false); }
  };

  const uploadProofPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (proofPhotos.length >= 3) return;
    setProofUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `box-proofs/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('support-screenshots')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('support-screenshots').getPublicUrl(fileName);
      setProofPhotos((prev) => [...prev, data.publicUrl]);
    } catch {
      notify(lang === 'bn' ? 'ছবি আপলোড করা যায়নি।' : 'Could not upload photo.', 'error');
    } finally {
      setProofUploading(false);
    }
  };

  const submitTaskProof = async () => {
    if (submittingProof || !profile || !detailTask) return;
    if (proofPhotos.length < 1) {
      notify(lang === 'bn' ? 'প্রমাণ হিসেবে অন্তত ১টা স্ক্রিনশট দাও!' : 'Please upload at least 1 screenshot as proof!', 'error');
      return;
    }
    setSubmittingProof(true);
    try {
      const { error } = await supabase.rpc('submit_box_task_proof', {
        p_task_id: detailTask.id,
        p_proof_urls: proofPhotos,
        p_notes: 'Submitted from Mystery Box',
      });
      if (error) throw error;
      await refreshProfile();
      loadP2pTasks();
      setDetailTask(null);
      setProofPhotos([]);
      if (soundOn) playFanfare();
      notify(
        lang === 'bn'
          ? 'প্রমাণ জমা হয়েছে! টাস্ক ক্রিয়েটর অনুমোদন করলেই তুমি +১ বোনাস মিস্ট্রি বক্স পাবে!'
          : 'Proof submitted! You will get +1 Bonus Mystery Box when the creator approves!',
        'success'
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = err?.message || (e instanceof Error ? e.message : 'unknown');
      if (msg.includes('proof_required')) {
        notify(lang === 'bn' ? 'প্রমাণ হিসেবে অন্তত ১টা স্ক্রিনশট দাও!' : 'At least 1 screenshot is required!', 'error');
      } else if (msg.includes('cannot_complete_own_task')) {
        notify(lang === 'bn' ? 'নিজের টাস্ক কমপ্লিট করা যায় না!' : 'You cannot complete your own task!', 'error');
      } else if (msg.includes('task_unavailable')) {
        notify(lang === 'bn' ? 'এই টাস্কটা আর পাওয়া যাচ্ছে না!' : 'This task is no longer available!', 'error');
      } else if (msg.includes('not_authenticated')) {
        notify(lang === 'bn' ? 'লগইন করা নেই! আবার লগইন করো।' : 'Not authenticated! Please log in again.', 'error');
      } else {
        notify(`${lang === 'bn' ? 'জমা ব্যর্থ: ' : 'Submit failed: '}${msg}`, 'error');
      }
    } finally { setSubmittingProof(false); }
  };

  const approveSubmission = async (subId: string) => {
    if (reviewBusyId || !profile) return;
    setReviewBusyId(subId);
    try {
      const { error } = await supabase.rpc('approve_box_task_submission', { p_submission_id: subId });
      if (error) throw error;
      await refreshProfile();
      loadP2pTasks();
      loadPendingSubs();
      if (soundOn) playFanfare();
      setCelebrate(true);
      notify(lang === 'bn' ? 'অনুমোদন হয়েছে! তুমি ও তোমার বন্ধু দুজনেই +১ বোনাস মিস্ট্রি বক্স পেয়েছ!' : 'Approved! Both you and your buddy got +1 Bonus Mystery Box!', 'success');
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = err?.message || (e instanceof Error ? e.message : 'unknown');
      notify(`${lang === 'bn' ? 'অনুমোদন ব্যর্থ: ' : 'Approve failed: '}${msg}`, 'error');
    } finally { setReviewBusyId(null); }
  };

  const rejectSubmission = async (subId: string) => {
    if (reviewBusyId || !profile) return;
    setReviewBusyId(subId);
    try {
      const { error } = await supabase.rpc('reject_box_task_submission', { p_submission_id: subId });
      if (error) throw error;
      loadP2pTasks();
      loadPendingSubs();
      notify(lang === 'bn' ? 'প্রমাণ বাতিল করা হয়েছে। টাস্কটা আবার খোলা হয়েছে।' : 'Proof rejected. Task reopened for others.', 'info');
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = err?.message || (e instanceof Error ? e.message : 'unknown');
      notify(`${lang === 'bn' ? 'বাতিল ব্যর্থ: ' : 'Reject failed: '}${msg}`, 'error');
    } finally { setReviewBusyId(null); }
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

  const microcopy = createMicrocopy(lang);
  const btnLabelTask = microcopy.boxBtnTask();
  const btnLabelAd = microcopy.boxBtnAd();
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

        {/* Bonus box slots — earned via rewarded video, admin tasks & P2P task loop */}
        <motion.div
          key={bonusSlots}
          initial={{ scale: 1.25, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${
            bonusSlots > 0
              ? 'bg-fuchsia-500/10 border-fuchsia-500/30'
              : 'bg-slate-700/30 border-white/10'
          }`}
        >
          <Gift size={14} className={bonusSlots > 0 ? 'text-fuchsia-400' : 'text-slate-500'} />
          <span className={`text-sm font-medium ${bonusSlots > 0 ? 'text-fuchsia-300' : 'text-slate-400'}`}>
            {lang === 'bn' ? 'বোনাস মিস্ট্রি বক্স' : 'Bonus Mystery Boxes'}
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${bonusSlots > 0 ? 'text-fuchsia-200' : 'text-slate-500'}`}
          >
            {bonusSlots}
          </span>
        </motion.div>
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
            const isBlasted = blastedBoxes.has(i);
            const isCracking = crackingBox === i;
            const isRepairing = repairingBoxes.has(i);
            const disabled = blasting || isBlasted;
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
                  cracking={isCracking}
                  repairing={isRepairing}
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

      {/* ===== EXTRA-BLAST ACTION CARDS (always visible; admin toggles hide them) ===== */}
      {(boxUnlock.task || boxUnlock.video) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <p className="text-center text-amber-300 font-medium text-sm mb-3">{t('getMoreBlasts')}</p>
          <div className={`grid gap-3 ${boxUnlock.task && boxUnlock.video ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {boxUnlock.task && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => { setShowTaskHub(true); setShowAddTask(false); }}
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
            )}
            {boxUnlock.video && (
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
            )}
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

      {/* ===== BOX LIMIT POPUP (funny best-friend style) ===== */}
      <AnimatePresence>
        {showLimitPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowLimitPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.7, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-sm w-full text-center bg-slate-800/90 border border-amber-500/40 rounded-3xl p-6"
              style={{ boxShadow: '0 0 50px rgba(251, 191, 36, 0.2), 0 12px 40px rgba(0,0,0,0.5)' }}
            >
              <button
                onClick={() => setShowLimitPopup(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
              <motion.div
                animate={{ rotate: [0, -8, 8, -5, 0] }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-5xl mb-3"
              >
                😅
              </motion.div>
              <h3 className="text-lg font-bold text-amber-300 mb-2">
                {lang === 'bn' ? 'আরে ভাই/দোস্ত! এত তাড়াহুড়ো কিসের?' : 'Whoa buddy! What is the rush?'}
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {lang === 'bn'
                  ? 'আজকের মিস্ট্রি বক্সের বারোটা বাজাইয়া দিছিস! নতুন বক্স পাইতে চাইলে এবার একটু খাটাখাটনি কর — টাস্ক কমপ্লিট কর অথবা ভিডিও দেখ!'
                  : "You have used up today's Mystery Boxes! Want a new one? Time to put in a little work — complete a task or watch a video!"}
              </p>
              <div className="space-y-2">
                {boxUnlock.task && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowLimitPopup(false); setShowTaskHub(true); setShowAddTask(false); }}
                    className="w-full flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl p-3.5 text-left hover:bg-green-500/20 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                      <ListChecks size={20} className="text-green-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-green-300">{lang === 'bn' ? 'টাস্ক কমপ্লিট করো' : 'Complete a Task'}</p>
                      <p className="text-[11px] text-green-400/70">+1 {t('mysteryBlast')}</p>
                    </div>
                    <Sparkles size={14} className="text-green-400/60 shrink-0" />
                  </motion.button>
                )}
                {boxUnlock.video && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={startVideoUnlock}
                    disabled={videoUnlockWatching}
                    className="w-full flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 text-left hover:bg-blue-500/20 transition disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Play size={20} className="text-blue-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-blue-300">
                        {videoUnlockWatching ? `${lang === 'bn' ? 'ভিডিও চলছে...' : 'Video playing...'} ${videoUnlockCountdown}s` : lang === 'bn' ? 'ভিডিও দেখে আনলক করো' : 'Watch a Video'}
                      </p>
                      <p className="text-[11px] text-blue-400/70">+1 {t('mysteryBlast')}</p>
                    </div>
                    <Star size={14} className="text-blue-400/60 shrink-0" />
                  </motion.button>
                )}
              </div>
              <Button variant="ghost" className="w-full mt-4" onClick={() => setShowLimitPopup(false)}>{t('close')}</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TUTORIAL BUTTON (visible below boxes) ===== */}
      {tutorialUrl && youtubeEmbedUrl(tutorialUrl) && (
        <div className="flex items-center justify-center mb-4">
          <Button variant="ghost" className="text-xs px-3 py-2 flex items-center gap-1.5" onClick={() => setShowTutorial(true)}>
            <Play size={14} /> {lang === 'bn' ? 'কিভাবে খেলবেন?' : 'Tutorial'}
          </Button>
        </div>
      )}

      {/* ===== TUTORIAL MODAL (YouTube player) ===== */}
      {showTutorial && tutorialUrl && (() => {
        const embed = youtubeEmbedUrl(tutorialUrl);
        if (!embed) return null;
        return (
          <div className="fixed inset-0 z-[9999] bg-slate-950/90 flex items-center justify-center p-4" onClick={() => setShowTutorial(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-2xl p-3 w-full max-w-2xl"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-bold text-white text-sm">{lang === 'bn' ? 'কিভাবে খেলবেন?' : 'How to Play'}</h3>
                <button onClick={() => setShowTutorial(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`${embed}?autoplay=1`}
                  title="Mystery Box Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full rounded-xl"
                />
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ===== TASK HUB MODAL (encapsulates all P2P task features) ===== */}
      {showTaskHub && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 flex items-center justify-center p-4" onClick={() => setShowTaskHub(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks size={20} className="text-amber-400" />
                <h3 className="font-bold text-white">{lang === 'bn' ? 'টাস্ক হাব' : 'Task Hub'}</h3>
              </div>
              <button onClick={() => setShowTaskHub(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {/* Toggle between Create form and Task list */}
            <div className="flex gap-2 mb-4 bg-slate-700/40 rounded-xl p-1">
              <button
                onClick={() => setShowAddTask(false)}
                className={`flex-1 text-xs font-medium py-2 rounded-lg transition ${!showAddTask ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
              >
                <Users size={14} className="inline mr-1" /> {lang === 'bn' ? 'বন্ধুদের টাস্ক' : 'Buddy Tasks'}
              </button>
              <button
                onClick={() => setShowAddTask(true)}
                className={`flex-1 text-xs font-medium py-2 rounded-lg transition ${showAddTask ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
              >
                <Plus size={14} className="inline mr-1" /> {lang === 'bn' ? 'টাস্ক তৈরি করুন' : 'Create Task'}
              </button>
            </div>

            {/* ---- CREATE TASK FORM ---- */}
            {showAddTask ? (
              <>
                <p className="text-xs text-amber-300/80 mb-4">
                  {lang === 'bn'
                    ? 'টাস্ক পাবলিশ করলেই তোমার +১ মিস্ট্রি বক্স স্লট! যেই বন্ধু টাস্কটা কমপ্লিট করবে সে-ও +১ স্লট + রিওয়ার্ড কয়েন পাবে। টাস্ক একজনই কমপ্লিট করতে পারবে।'
                    : 'Publishing a task instantly earns you +1 Mystery Box slot! Whoever completes it also gets +1 slot plus your reward coins. Only ONE person can complete it.'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{t('title')}</label>
                    <input value={addTaskForm.title} onChange={(e) => setAddTaskForm({ ...addTaskForm, title: e.target.value })} maxLength={120} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'প্ল্যাটফর্ম' : 'Platform'}</label>
                    <select value={addTaskForm.platform} onChange={(e) => setAddTaskForm({ ...addTaskForm, platform: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm">
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'টাস্ক লিংক (বাধ্যতামূলক)' : 'Task Link (required)'} <span className="text-red-400">*</span></label>
                    <input value={addTaskForm.target_url} onChange={(e) => setAddTaskForm({ ...addTaskForm, target_url: e.target.value })} placeholder="https://..." className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'ছবি / স্ক্রিনশট (সর্বোচ্চ ৩টি)' : 'Photos / Screenshots (up to 3)'}</label>
                    <input
                      ref={taskPhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTaskPhoto(f); e.target.value = ''; }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      {addTaskPhotos.map((url, idx) => (
                        <div key={idx} className="relative inline-block">
                          <img src={url} alt={`Preview ${idx + 1}`} className="rounded-lg w-16 h-16 object-cover border border-white/10" />
                          <button
                            onClick={() => setAddTaskPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {addTaskPhotos.length < 3 && !photoUploading && (
                        <button
                          onClick={() => taskPhotoInputRef.current?.click()}
                          className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-slate-400 hover:border-amber-400/50 hover:text-amber-400 transition"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                      {photoUploading && (
                        <div className="w-16 h-16 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 text-xs">...</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'বর্ণনা (অপশনাল)' : 'Description (optional)'}</label>
                    <textarea value={addTaskForm.description} onChange={(e) => setAddTaskForm({ ...addTaskForm, description: e.target.value })} rows={2} maxLength={1000} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">{lang === 'bn' ? 'রিওয়ার্ড কয়েন (তোমার খরচ)' : 'Reward Coins (your cost)'}</label>
                    <input type="number" min={0} max={100000} value={addTaskForm.cost_coins} onChange={(e) => setAddTaskForm({ ...addTaskForm, cost_coins: +e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm" />
                  </div>
                  <div className="bg-slate-700/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{t('lumoraCoins')}</span>
                    <span className="text-sm font-bold text-amber-300">{(profile?.lumora_coins ?? 0) + (profile?.bonus_coins ?? 0)} 🪙</span>
                  </div>
                  <Button className="w-full" disabled={addTaskBusy} onClick={publishBoxTask}>
                    {addTaskBusy ? (lang === 'bn' ? 'পাবলিশ হচ্ছে...' : 'Publishing...') : (lang === 'bn' ? 'পাবলিশ করো (+১ বক্স স্লট)' : 'Publish (+1 Box Slot)')}
                  </Button>
                </div>
              </>
            ) : (
              /* ---- ACTIVE TASKS LIST ---- */
              <>
                <p className="text-[10px] text-slate-400 mb-3">
                  {lang === 'bn' ? 'যেকোনো একটা কমপ্লিট করে +১ বক্স স্লট + কয়েন জেতো! প্রতিটা টাস্ক শুধু একবারই কমপ্লিট হয়।' : 'Complete any one to earn +1 box slot + coins! Each task can only be completed once.'}
                </p>
                {p2pTasks.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">{lang === 'bn' ? 'এখনও কোনো টাস্ক নেই।' : 'No active tasks yet.'}</p>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {p2pTasks.map((task) => {
                      const isOwn = task.creator_id === profile?.id;
                      return (
                      <div key={task.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{task.title}</p>
                          <p className="text-xs text-amber-300/80">{task.reward_coins} 🪙 · {task.platform}</p>
                          {isOwn && (
                            <p className="text-[10px] text-blue-300/80 mt-0.5">
                              {lang === 'bn' ? 'আপনার নিজের পোস্ট করা টাস্ক — অন্য কেউ কমপ্লিট করলে আপনিও বক্স পাবেন' : 'Your own posted task — you earn a box when someone else completes it'}
                            </p>
                          )}
                        </div>
                        {isOwn ? (
                          <span className="text-[10px] text-slate-500 italic px-3 py-1.5 shrink-0">{lang === 'bn' ? 'আপনার নিজের' : 'Yours'}</span>
                        ) : (
                          <Button className="text-xs py-1.5 px-3" disabled={completingTaskId === task.id} onClick={() => completeBoxTask(task)}>
                            {completingTaskId === task.id ? '...' : (lang === 'bn' ? 'করো' : 'Do it')}
                          </Button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <Button variant="ghost" className="w-full mt-4" onClick={() => setShowTaskHub(false)}>{t('close')}</Button>
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
