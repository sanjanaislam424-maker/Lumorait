import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative neon-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold neon-text neon-glow-text">{title}</h3>
              <button onClick={onClose} className="neon-muted hover:neon-primary-text"><X size={20} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`neon-card rounded-2xl p-5 ${className}`}>{children}</div>;
}

export function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const variants = {
    primary: 'neon-btn-primary',
    secondary: 'neon-btn-ghost',
    danger: 'neon-btn-danger',
    ghost: 'neon-btn-ghost',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function CoinBadge({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold ${className}`}
      style={{ background: 'var(--neon-card-bg)', color: 'var(--neon-primary)', border: '1px solid var(--neon-border)' }}>
      <span className="w-3.5 h-3.5 rounded-full inline-block"
        style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))', boxShadow: '0 0 6px var(--neon-glow)' }} />
      {amount.toLocaleString()}
    </span>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-12 neon-muted">
      {icon && <div className="flex justify-center mb-3 opacity-50">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function NeonParticles() {
  const particles = Array.from({ length: 20 });
  return (
    <div className="neon-bg-particles">
      {particles.map((_, i) => (
        <div
          key={i}
          className="neon-particle"
          style={{
            left: `${(i * 5) % 100}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${6 + (i % 4) * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
