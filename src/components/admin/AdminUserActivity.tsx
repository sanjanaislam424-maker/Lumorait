import { useEffect, useState } from 'react';
import { ArrowLeftRight, LogIn, UserPlus, UserCog, Receipt, Send, KeyRound, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { ActivityKind, ActivityRow, adminErrorMessage, fetchUserActivity } from '@/lib/adminUsers';

const KIND_META: Record<ActivityKind, { label: string; icon: React.ReactNode; tone: string }> = {
  signup: { label: 'Signed up', icon: <UserPlus size={14} />, tone: 'text-emerald-300 bg-emerald-500/15' },
  login: { label: 'Signed in', icon: <LogIn size={14} />, tone: 'text-sky-300 bg-sky-500/15' },
  profile_update: { label: 'Profile updated', icon: <UserCog size={14} />, tone: 'text-teal-200 bg-slate-500/20' },
  account_change: { label: 'Account changed', icon: <UserCog size={14} />, tone: 'text-amber-300 bg-amber-500/15' },
  transaction: { label: 'Transaction', icon: <Receipt size={14} />, tone: 'text-slate-200 bg-slate-500/20' },
  transfer: { label: 'Transfer', icon: <ArrowLeftRight size={14} />, tone: 'text-cyan-300 bg-cyan-500/15' },
  task_submission: { label: 'Task submitted', icon: <Send size={14} />, tone: 'text-sky-200 bg-slate-500/20' },
  credential_change: { label: 'Password reset', icon: <KeyRound size={14} />, tone: 'text-rose-300 bg-rose-500/15' },
};

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AdminUserActivity({ userId }: { userId: string }) {
  const [events, setEvents] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchUserActivity(userId));
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not load the activity timeline.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Reload only when the viewed user changes.
  }, [userId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Latest 100 events, newest first</p>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 text-xs text-slate-300 hover:text-white disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {!loading && !error && events.length === 0 ? (
        <EmptyState message="No activity recorded yet" />
      ) : (
        <ol className="relative border-l border-white/10 ml-3 space-y-3">
          {events.map((event) => {
            const meta = KIND_META[event.kind] ?? KIND_META.transaction;
            return (
              <li key={event.id} className="ml-4">
                <span className={`absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ${meta.tone}`}>
                  {meta.icon}
                </span>
                <div className="bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">{meta.label}</p>
                    <p className="text-[11px] text-slate-500 shrink-0">{formatWhen(event.created_at)}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 break-words">{event.summary}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
