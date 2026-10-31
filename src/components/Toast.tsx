import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' | 'warning' };
const ToastCtx = createContext<{ notify: (msg: string, type?: Toast['type']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((tst) => (
            <motion.div
              key={tst.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="flex items-center gap-2 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 shadow-lg max-w-xs"
            >
              {tst.type === 'success' && <CheckCircle size={18} className="text-green-400" />}
              {tst.type === 'error' && <XCircle size={18} className="text-red-400" />}
              {tst.type === 'info' && <Info size={18} className="text-blue-400" />}
              {tst.type === 'warning' && <AlertTriangle size={18} className="text-amber-400" />}
              <span className="text-white text-sm">{tst.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
