import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, History, UserCog } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import {
  chatSessionLabel,
  fetchChatMessages,
  fetchChatSessions,
  type ChatMessageRow,
  type ChatSessionSummary,
} from '@/lib/chatSessions';
import { Card, EmptyState, Modal } from '@/components/ui';

export function ChatHistory() {
  const { profile, lang } = useApp();
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<ChatSessionSummary | null>(null);

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    const data = await fetchChatSessions(profile.id);
    setFailed(data === null);
    setSessions(data);
  }, [profile]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History size={16} style={{ color: 'var(--neon-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--neon-text)' }}>
          {lang === 'bn' ? 'আগের কথোপকথন' : 'Previous conversations'}
        </h3>
      </div>

      {failed && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
            {lang === 'bn' ? 'কথোপকথন লোড করা যায়নি। আবার চেষ্টা করো।' : 'Could not load your conversations. Please try again.'}
          </p>
          <button onClick={loadSessions} className="mt-2 text-xs underline" style={{ color: 'var(--neon-primary)' }}>
            {lang === 'bn' ? 'আবার চেষ্টা করো' : 'Retry'}
          </button>
        </Card>
      )}

      {!failed && sessions === null && (
        <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
          {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
        </p>
      )}

      {!failed && sessions !== null && sessions.length === 0 && (
        <EmptyState
          icon={<Bot size={28} />}
          message={lang === 'bn' ? 'এখনও কোনো কথোপকথন নেই' : 'No conversations yet'}
        />
      )}

      {sessions?.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.03 }}
          onClick={() => setSelected(s)}
          className="w-full text-left"
        >
          <Card className="transition hover:border-amber-500/40">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--neon-text)' }}>{chatSessionLabel(s, lang)}</p>
                <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
                  {formatDate(s.created_at)} · {s.chat_messages.length} {lang === 'bn' ? 'বার্তা' : 'messages'}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--neon-muted)' }} />
            </div>
          </Card>
        </motion.button>
      ))}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? chatSessionLabel(selected, lang) : ''}
      >
        {selected && <Transcript sessionId={selected.id} />}
      </Modal>
    </div>
  );
}

function Transcript({ sessionId }: { sessionId: string }) {
  const { lang } = useApp();
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchChatMessages(sessionId);
      if (cancelled) return;
      setFailed(data === null);
      setMessages(data);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (failed) {
    return (
      <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
        {lang === 'bn' ? 'বার্তাগুলো লোড করা যায়নি।' : 'Could not load these messages.'}
      </p>
    );
  }

  if (messages === null) {
    return (
      <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
        {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
            style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))'
                : 'var(--neon-card-bg)',
              color: msg.role === 'user' ? '#fff' : 'var(--neon-text)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--neon-border)',
            }}
          >
            {msg.role === 'admin' && (
              <div className="flex items-center gap-1 mb-1 text-[10px] font-bold" style={{ color: '#f59e0b' }}>
                <UserCog size={10} /> {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
              </div>
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
