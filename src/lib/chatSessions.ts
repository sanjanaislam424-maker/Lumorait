import { supabase } from '@/lib/supabase';

export interface ChatSessionSummary {
  id: string;
  title: string;
  subject: string | null;
  is_support: boolean;
  status: string;
  created_at: string;
  chat_messages: { id: string }[];
}

export interface ChatMessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export async function fetchChatSessions(userId: string, limit = 20): Promise<ChatSessionSummary[] | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, subject, is_support, status, created_at, chat_messages!inner(id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return (data ?? []) as ChatSessionSummary[];
}

export async function fetchChatMessages(sessionId: string): Promise<ChatMessageRow[] | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) return null;
  return (data ?? []) as ChatMessageRow[];
}

export function chatSessionLabel(session: ChatSessionSummary, lang: string): string {
  if (session.is_support) return session.subject || (lang === 'bn' ? 'সাপোর্ট অনুরোধ' : 'Support request');
  return lang === 'bn' ? 'AI চ্যাট' : 'AI chat';
}
