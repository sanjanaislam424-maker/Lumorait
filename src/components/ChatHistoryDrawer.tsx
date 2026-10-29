import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { chatSessionLabel, fetchChatSessions, type ChatSessionSummary } from '@/lib/chatSessions';

interface ChatHistoryDrawerProps {
  open: boolean;
  activeSessionId: string | null;
  onClose: () => void;
  onSelect: (session: ChatSessionSummary) => void;
  onNewChat: () => void;
}

export function ChatHistoryDrawer({ open, activeSessionId, onClose, onSelect, onNewChat }: ChatHistoryDrawerProps) {
  const { profile, lang } = useApp();
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    setFailed(false);
    const data = await fetchChatSessions(profile.id);
    setFailed(data === null);
    setSessions(data);
  }, [profile]);

  useEffect(() => {
    if (open) loadSessions();
  }, [open, loadSessions]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-10 bg-black/40"
          />
          <motion.aside
            key="panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute inset-y-0 left-0 z-20 w-[82%] max-w-[260px] flex flex-col border-r"
            style={{ background: 'var(--neon-card-bg)', borderColor: 'var(--neon-border)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--neon-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--neon-text)' }}>
                {lang === 'bn' ? 'চ্যাট ইতিহাস' : 'Chat history'}
              </p>
              <button
                onClick={onClose}
                aria-label={lang === 'bn' ? 'বন্ধ করো' : 'Close history'}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                style={{ color: 'var(--neon-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={onNewChat}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white transition hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))' }}
              >
                <Plus size={14} />
                {lang === 'bn' ? 'নতুন চ্যাট' : 'New chat'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {failed && (
                <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
                  {lang === 'bn' ? 'ইতিহাস লোড করা যায়নি।' : 'Could not load history.'}{' '}
                  <button onClick={loadSessions} className="underline" style={{ color: 'var(--neon-primary)' }}>
                    {lang === 'bn' ? 'আবার চেষ্টা করো' : 'Retry'}
                  </button>
                </p>
              )}

              {!failed && sessions === null && (
                <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
                  {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
                </p>
              )}

              {!failed && sessions !== null && sessions.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--neon-muted)' }}>
                  {lang === 'bn' ? 'এখনও কোনো চ্যাট নেই' : 'No chats yet'}
                </p>
              )}

              {sessions?.map((s) => {
                const active = s.id === activeSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border transition hover:bg-white/5"
                    style={{
                      borderColor: active ? 'var(--neon-primary)' : 'var(--neon-border)',
                      background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--neon-text)' }}>
                      {chatSessionLabel(s, lang)}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--neon-muted)' }}>
                      {formatDate(s.created_at)} · {s.chat_messages.length} {lang === 'bn' ? 'বার্তা' : 'msgs'}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
