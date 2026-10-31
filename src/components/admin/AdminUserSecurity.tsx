import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { ACTIVITY_PAGE_SIZE, ActivityRow, AdminUserRow, fetchUserActivity } from '@/lib/adminUsers';

const EXACT_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'medium' };

function formatExact(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, EXACT_TIME) : 'Never';
}

export function AdminUserSecurity({ user }: { user: AdminUserRow }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchUserActivity(user.id, { from: null, to: null, kinds: ['password_change'] }, 1)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Could not load password history. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id, reloadToken]);

  const statuses = [
    { label: 'Role', value: user.role === 'admin' ? 'Admin' : 'Member', tone: user.role === 'admin' ? 'text-amber-300' : 'text-slate-200' },
    { label: 'Account', value: user.banned ? 'Banned' : 'Active', tone: user.banned ? 'text-red-300' : 'text-emerald-300' },
    { label: 'Identity verified', value: user.kyc_verified ? 'Yes' : 'No', tone: user.kyc_verified ? 'text-emerald-300' : 'text-slate-200' },
    { label: 'Email', value: user.email ?? 'Not set', tone: 'text-slate-200' },
    { label: 'Last sign-in', value: formatExact(user.last_sign_in_at), tone: 'text-slate-200' },
  ];

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Credential status</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {statuses.map((s) => (
            <div key={s.label} className="bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</dt>
              <dd className={`text-sm font-medium break-all ${s.tone}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <KeyRound size={12} /> To set a new password, use Reset password in the Details section.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Password change history</h3>
          {!loading && !error && <span className="text-xs text-slate-500">{total} recorded</span>}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center justify-between gap-3">
            <span className="text-sm text-red-300">{error}</span>
            <Button variant="ghost" className="text-xs px-2 py-1 shrink-0" onClick={() => setReloadToken((t) => t + 1)}>
              <RefreshCw size={12} className="inline mr-1" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && <EmptyState message="No password changes recorded" />}

        {total > ACTIVITY_PAGE_SIZE && (
          <p className="text-xs text-amber-300 flex items-center gap-1.5">
            <ShieldAlert size={12} /> Showing the latest {ACTIVITY_PAGE_SIZE} of {total} changes. Use the Activity section to page through older events.
          </p>
        )}

        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-300">{row.summary}</span>
              <time className="text-xs text-slate-500" dateTime={row.created_at}>{formatExact(row.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
