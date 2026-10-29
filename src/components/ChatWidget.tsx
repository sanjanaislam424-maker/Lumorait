import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, UserCog, Sparkles, RefreshCw, Menu } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { streamAiReply } from '@/lib/aiChatStream';
import { createTypewriter } from '@/lib/typewriter';
import type { ChatMessageRow as ChatMsg, ChatSessionSummary } from '@/lib/chatSessions';
import { ChatHistoryDrawer } from '@/components/ChatHistoryDrawer';

const AI_FALLBACK = "আমি এখন একটু ব্যস্ত আছি, একটু পরে আবার চেষ্টা করো — অথবা মানুষের সাথে কথা বলতে নিচের বাটনে ট্যাপ করো! 😊";

export function ChatWidget({ supportMode = false, subject = '' }: { supportMode?: boolean; subject?: string }) {
  const { t, profile, lang } = useApp();
  const { notify } = useToast();
  const [open, setOpen] = useState(supportMode);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [pendingHuman, setPendingHuman] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef(false);
  const aiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!profile) return null;
    setCreatingSession(true);
    try {
      const { data, error } = await supabase.from('chat_sessions').insert({
        user_id: profile.id,
        title: supportMode ? (subject || 'Support Request') : 'AI Chat',
        is_support: supportMode,
        subject: supportMode ? subject : null,
        status: 'active',
      }).select('*').single();
      if (error) {
        notify(lang === 'bn' ? 'চ্যাট শুরু করা যায়নি' : 'Could not start chat', 'error');
        return null;
      }
      setSessionId(data.id);
      setSessionStatus(data.status);
      return data.id;
    } finally {
      setCreatingSession(false);
    }
  }, [profile, supportMode, subject, notify, lang]);

  const loadMessages = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as ChatMsg[]);
  }, []);

  useEffect(() => {
    if (open && !sessionId && profile && !creatingSession) {
      createSession().then((sid) => { if (sid) loadMessages(sid); });
    }
  }, [open, sessionId, profile, creatingSession, createSession, loadMessages]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newMsg = payload.new as ChatMsg;
          if (newMsg.role === 'assistant' && streamingRef.current) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as { status: string };
          setSessionStatus(updated.status);
          setPendingHuman(updated.status === 'pending_human');
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || loading || pendingHuman) return;
    const text = input.trim();
    setInput('');
    setLoading(true);

    let sid = sessionId;
    if (!sid) {
      sid = await createSession();
      if (!sid) { setLoading(false); return; }
    }

    const userMsg: ChatMsg = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const { data: inserted } = await supabase.from('chat_messages').insert({
      session_id: sid,
      role: 'user',
      content: text,
    }).select('*').single();

    if (inserted) {
      setMessages((prev) => prev.map((m) => m.id === userMsg.id ? inserted as ChatMsg : m));
    }

    const history = [...messages, { role: 'user', content: text }].slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const streamId = 'stream-' + Date.now();
    streamingRef.current = true;

    const typewriter = createTypewriter((chunk) => {
      setStreaming(true);
      setMessages((prev) => {
        if (prev.some((m) => m.id === streamId)) {
          return prev.map((m) => m.id === streamId ? { ...m, content: m.content + chunk } : m);
        }
        return [...prev, { id: streamId, role: 'assistant', content: chunk, created_at: new Date().toISOString() }];
      });
      scrollToBottom();
    });

    try {
      const result = await streamAiReply({
        endpoint: aiEndpoint,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        messages: history,
        sessionId: sid,
        onText: (delta) => typewriter.push(delta),
        onDone: async (savedId) => {
          await typewriter.drain();
          if (savedId) {
            setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, id: savedId } : m));
          }
        },
      });

      if (!result.ok) {
        if (result.partial) {
          await typewriter.drain();
          notify(lang === 'bn' ? 'সংযোগ বিচ্ছিন্ন হয়েছে, উত্তর অসম্পূর্ণ থাকতে পারে' : 'Connection interrupted, the reply may be incomplete', 'error');
        } else {
          setMessages((prev) => [...prev, {
            id: 'fallback-' + Date.now(),
            role: 'assistant',
            content: AI_FALLBACK,
            created_at: new Date().toISOString(),
          }]);
        }
      }
    } finally {
      typewriter.stop();
      streamingRef.current = false;
      setLoading(false);
      setStreaming(false);
      scrollToBottom();
    }
  };

  const requestHuman = async () => {
    if (!sessionId) return;
    await supabase.from('chat_sessions').update({ status: 'pending_human' }).eq('id', sessionId);
    setPendingHuman(true);
    setSessionStatus('pending_human');
    notify(lang === 'bn' ? 'সাপোর্ট টিমের জন্য অনুরোধ পাঠানো হয়েছে!' : 'Human support requested!', 'success');
  };

  const startNewChat = () => {
    if (loading) return;
    setMessages([]);
    setSessionId(null);
    setPendingHuman(false);
    setSessionStatus('active');
    setHistoryOpen(false);
  };

  const selectSession = (session: ChatSessionSummary) => {
    if (loading) return;
    setMessages([]);
    setSessionId(session.id);
    setSessionStatus(session.status);
    setPendingHuman(session.status === 'pending_human');
    setHistoryOpen(false);
    loadMessages(session.id);
  };

  if (supportMode) {
    return (
      <div className="flex flex-col h-[500px] bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
        <ChatHeader
          title={subject || t('support')}
          subtitle={pendingHuman ? (lang === 'bn' ? 'অ্যাডমিনের জন্য অপেক্ষা...' : 'Waiting for admin...') : 'Lumora AI'}
          pendingHuman={pendingHuman}
        />
        <ChatMessages messages={messages} loading={loading && !streaming} scrollRef={scrollRef} lang={lang} />
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          loading={loading}
          pendingHuman={pendingHuman}
          onRequestHuman={requestHuman}
          lang={lang}
        />
      </div>
    );
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-[100] w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))',
          boxShadow: '0 0 20px var(--neon-glow)',
        }}
        title={t('navAIAssistant')}
      >
        {open ? <X size={24} className="text-white" /> : <Bot size={24} className="text-white" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 right-4 z-[100] w-[calc(100vw-2rem)] max-w-sm h-[500px] flex flex-col relative bg-slate-900/95 backdrop-blur-xl border rounded-2xl overflow-hidden"
            style={{ borderColor: 'var(--neon-border)' }}
          >
            <ChatHeader
              title={t('navAIAssistant')}
              subtitle={pendingHuman
                ? (lang === 'bn' ? 'অ্যাডমিনের জন্য অপেক্ষা...' : 'Waiting for admin...')
                : 'Lumora AI'}
              pendingHuman={pendingHuman}
              onNewChat={startNewChat}
              onOpenHistory={() => setHistoryOpen(true)}
            />
            <ChatMessages messages={messages} loading={loading && !streaming} scrollRef={scrollRef} lang={lang} />
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={sendMessage}
              loading={loading}
              pendingHuman={pendingHuman}
              onRequestHuman={requestHuman}
              lang={lang}
            />
            <ChatHistoryDrawer
              open={historyOpen}
              activeSessionId={sessionId}
              onClose={() => setHistoryOpen(false)}
              onSelect={selectSession}
              onNewChat={startNewChat}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatHeader({ title, subtitle, pendingHuman, onNewChat, onOpenHistory }: {
  title: string; subtitle: string; pendingHuman: boolean; onNewChat?: () => void; onOpenHistory?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--neon-border)', background: 'var(--neon-card-bg)' }}>
      <div className="flex items-center gap-2 min-w-0">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            aria-label="Chat history"
            title="Chat history"
            className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition shrink-0"
            style={{ color: 'var(--neon-muted)' }}
          >
            <Menu size={18} />
          </button>
        )}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))' }}>
          <Bot size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--neon-text)' }}>{title}</p>
          <p className="text-[10px]" style={{ color: pendingHuman ? '#f59e0b' : 'var(--neon-muted)' }}>
            {pendingHuman && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-pulse" />}
            {subtitle}
          </p>
        </div>
      </div>
      {onNewChat && (
        <button onClick={onNewChat} className="p-1.5 rounded-lg hover:bg-white/10 transition shrink-0" style={{ color: 'var(--neon-muted)' }} title="New chat">
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
}

function ChatMessages({ messages, loading, scrollRef, lang }: {
  messages: ChatMsg[]; loading: boolean; scrollRef: React.RefObject<HTMLDivElement>; lang: string;
}) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {messages.length === 0 && (
        <div className="text-center py-6">
          <Sparkles size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--neon-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>
            {lang === 'bn' ? 'হাই! আমি Lumora AI. কীভাবে সাহায্য করতে পারি?' : 'Hi! I\'m Lumora AI. How can I help?'}
          </p>
        </div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
            style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))'
                : msg.role === 'admin'
                ? 'rgba(245,158,11,0.15)'
                : 'var(--neon-card-bg)',
              color: msg.role === 'user' ? '#fff' : 'var(--neon-text)',
              border: msg.role !== 'user' ? `1px solid var(--neon-border)` : 'none',
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
      {loading && (
        <div className="flex justify-start">
          <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1" style={{ background: 'var(--neon-card-bg)', border: '1px solid var(--neon-border)' }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full"
                style={{ background: 'var(--neon-primary)' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatInput({ input, setInput, onSend, loading, pendingHuman, onRequestHuman, lang }: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  pendingHuman: boolean;
  onRequestHuman: () => void;
  lang: string;
}) {
  return (
    <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: 'var(--neon-border)' }}>
      {pendingHuman ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <UserCog size={16} className="text-amber-400" />
          <p className="text-xs text-amber-300 flex-1">
            {lang === 'bn' ? 'অ্যাডমিন শীঘ্রই উত্তর দেবে। অপেক্ষা করো...' : 'An admin will respond shortly. Please wait...'}
          </p>
        </div>
      ) : (
        <button
          onClick={onRequestHuman}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          <UserCog size={14} />
          {lang === 'bn' ? 'মানুষের সাথে কথা বলো' : 'Talk to Human Agent'}
        </button>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={lang === 'bn' ? 'মেসেজ লেখো...' : 'Type a message...'}
          disabled={loading || pendingHuman}
          className="flex-1 bg-slate-800 border rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-50"
          style={{ borderColor: 'var(--neon-border)', color: 'var(--neon-text)' }}
        />
        <button
          onClick={onSend}
          disabled={loading || pendingHuman || !input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50 transition shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))' }}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
