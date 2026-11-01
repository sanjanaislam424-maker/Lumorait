import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export function CelebrationOverlay({ show, onClose, title }: { show: boolean; onClose: () => void; title: string }) {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number }[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (show) {
      const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ec4899'];
      const arr = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
      }));
      setParticles(arr);
      const tm = setTimeout(() => onCloseRef.current(), 3500);
      return () => clearTimeout(tm);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute w-3 h-3 rounded-full"
                style={{ left: `${p.x}%`, top: '-20px', backgroundColor: p.color }}
                initial={{ y: 0, opacity: 1, rotate: 0 }}
                animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 360 }}
                transition={{ duration: 3, delay: p.delay, ease: 'easeIn' }}
              />
            ))}
          </div>
          <motion.div
            className="relative z-10 text-center"
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">{title}</h2>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
