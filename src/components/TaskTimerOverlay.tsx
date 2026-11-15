import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X } from 'lucide-react';

const TASK_TIMEOUT_S = 15 * 60;
const WARNING_THRESHOLD_S = 2 * 60;

type TimerColor = 'green' | 'yellow' | 'red';

function getColor(remaining: number): TimerColor {
  if (remaining <= 0) return 'red';
  if (remaining <= WARNING_THRESHOLD_S) return 'yellow';
  return 'green';
}

const colorStyles: Record<TimerColor, { bg: string; border: string; text: string; glow: string }> = {
  green: { bg: 'rgba(34,197,94,0.92)', border: 'rgba(34,197,94,1)', text: '#ffffff', glow: '0 4px 20px rgba(34,197,94,0.5)' },
  yellow: { bg: 'rgba(234,179,8,0.95)', border: 'rgba(234,179,8,1)', text: '#1a1a1a', glow: '0 4px 20px rgba(234,179,8,0.5)' },
  red: { bg: 'rgba(239,68,68,0.96)', border: 'rgba(239,68,68,1)', text: '#ffffff', glow: '0 4px 24px rgba(239,68,68,0.6)' },
};

export function TaskTimerOverlay({ active, onExpire, taskTitle }: { active: boolean; onExpire: () => void; taskTitle: string }) {
  const [seconds, setSeconds] = useState(TASK_TIMEOUT_S);
  const [pos, setPos] = useState({ x: 12, y: 12 });
  const [dismissed, setDismissed] = useState(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (active) {
      setSeconds(TASK_TIMEOUT_S);
      setDismissed(false);
      setPos({ x: 12, y: 12 });
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(iv);
          onExpireRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [active]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 160, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
    });
  };
  const handlePointerUp = () => { dragRef.current = null; };

  const remaining = seconds;
  const color = getColor(remaining);
  const expired = remaining <= 0;
  const cs = colorStyles[color];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <AnimatePresence>
      {active && !dismissed && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="fixed z-[10000] select-none touch-none"
          style={{ left: pos.x, top: pos.y, cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2 backdrop-blur-md max-w-[220px]"
            style={{ background: cs.bg, borderColor: cs.border, color: cs.text, boxShadow: cs.glow }}
          >
            <Clock size={18} className="shrink-0" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[9px] font-semibold uppercase opacity-80 truncate">
                {expired ? 'Expired' : taskTitle}
              </span>
              <span className="text-lg font-extrabold tabular-nums tracking-tight">
                {expired ? '00:00' : timeStr}
              </span>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setDismissed(true)}
              className="ml-1 rounded-lg p-1 hover:bg-black/20 transition shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
