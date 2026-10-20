import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

export function TaskTimerOverlay({ active, onExpire, taskTitle }: { active: boolean; onExpire: () => void; taskTitle: string }) {
  const [seconds, setSeconds] = useState(300);

  useEffect(() => {
    if (active) {
      setSeconds(300);
      const iv = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(iv);
            onExpire();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [active, onExpire]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = ((300 - seconds) / 300) * 100;
  const danger = seconds <= 60;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 right-4 z-[9985] bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl w-64"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className={danger ? 'text-red-400' : 'text-amber-400'} />
            <span className="text-xs text-slate-400 truncate">{taskTitle}</span>
          </div>
          <div className={`text-3xl font-bold tabular-nums ${danger ? 'text-red-400' : 'text-white'}`}>
            {mins}:{secs.toString().padStart(2, '0')}
          </div>
          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
