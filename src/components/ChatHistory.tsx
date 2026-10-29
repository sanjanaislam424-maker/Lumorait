import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, History, UserCog } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, EmptyState, Modal } from '@/components/ui';

interface SessionRow {
  id: string;
  title: string;
  subject: string | null;
  is_support: boolean;
  status: string;
  created_at: string;
  chat_messages: { id: string }[];
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const SESSION_LIMIT = 20;

export function ChatHistory() {
  const { profile, lang } = useApp();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<SessionRow | null>(null);

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, subject, is_support, status, created_at, chat_messages!inner(id)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(SESSION_LIMIT);
    if (error) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSessions((data ?? []) as SessionRow[]);
  }, [profile]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const sessionLabel = (s: SessionRow) =>
    s.is_support ? (s.subject || (lang === 'bn' ? 'সাপোর্ট অনুরোধ' : 'Support request')) : (lang === 'bn' ? 'AI চ্যাট' : 'AI chat');

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
                <p className="text-sm font-medium truncate" style={{ color: 'var(--neon-text)' }}>{sessionLabel(s)}</p>
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
        title={selected ? sessionLabel(selected) : ''}
      >
        {selected && <Transcript sessionId={selected.id} />}
      </Modal>
    </div>
  );
}

function Transcript({ sessionId }: { sessionId: string }) {
  const { lang } = useApp();
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      setMessages((data ?? []) as MessageRow[]);
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
