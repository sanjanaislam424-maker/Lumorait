import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import {
  ACTIVITY_PAGE_SIZE,
  ActivityFilters,
  ActivityKind,
  ActivityRow,
  fetchUserActivity,
} from '@/lib/adminUsers';
import { ActivityFilterBar, buildActivityFilters } from '@/components/admin/AdminUserActivityFilters';
import { ACTIVITY_KIND_META } from '@/components/admin/activityKindMeta';

export function AdminUserActivity({ userId }: { userId: string }) {
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestRef = useRef(0);

  const rangeInvalid = Boolean(fromDay && toDay && fromDay > toDay);
  const filters: ActivityFilters = useMemo(() => buildActivityFilters(fromDay, toDay, category), [fromDay, toDay, category]);

  useEffect(() => {
    if (rangeInvalid) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    fetchUserActivity(userId, filters, page)
      .then((result) => {
        if (requestId !== requestRef.current) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (requestId !== requestRef.current) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Could not load activity. Please try again.');
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [userId, filters, page, reloadToken, rangeInvalid]);

  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * ACTIVITY_PAGE_SIZE, total);

  const changeFilters = (next: { fromDay: string; toDay: string; category: string }) => {
    setFromDay(next.fromDay);
    setToDay(next.toDay);
    setCategory(next.category);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ActivityFilterBar fromDay={fromDay} toDay={toDay} category={category} onChange={changeFilters} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {loading && rows.length === 0 ? 'Loading activity...' : `Showing ${rangeStart}-${rangeEnd} of ${total} events, newest first`}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-red-300">{error}</span>
          <Button variant="ghost" className="text-xs px-2 py-1 shrink-0" onClick={() => setReloadToken((t) => t + 1)}>
            <RefreshCw size={12} className="inline mr-1" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && !rangeInvalid && <EmptyState message="No activity matches these filters" />}

      <ol className="relative border-l border-white/10 ml-3 space-y-4">
        {rows.map((row) => (
          <ActivityItem key={row.id} row={row} />
        ))}
      </ol>

      {total > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={14} className="inline mr-1" /> Newer
          </Button>
          <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
          <Button variant="ghost" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Older <ChevronRight size={14} className="inline ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const meta = ACTIVITY_KIND_META[row.kind as ActivityKind] ?? ACTIVITY_KIND_META.account_change;
  return (
    <li className="relative ml-5">
      <span className={`absolute -left-8 flex items-center justify-center w-6 h-6 rounded-full ${meta.tone}`}>{meta.icon}</span>
      <div className="bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-white">{meta.label}</p>
          <time className="text-[11px] text-slate-500" dateTime={row.created_at}>
            {new Date(row.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{row.summary}</p>
      </div>
    </li>
  );
}
