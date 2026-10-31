import { useEffect, useRef, useState } from 'react';
import { Search, Ban, ShieldCheck, BadgeCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { AdminUserDetailModal } from '@/components/admin/AdminUserDetailModal';
import { AdminUserRow, UserFilter, fetchAdminUsers } from '@/lib/adminUsers';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: 'all', label: 'All Users' },
  { key: 'admin', label: 'Admins' },
  { key: 'banned', label: 'Banned' },
  { key: 'kyc_verified', label: 'Verified' },
  { key: 'kyc_pending', label: 'Unverified' },
  { key: 'low_balance', label: 'Low Coin' },
];

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminUsersTab() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    fetchAdminUsers({
      search: debouncedSearch,
      filter,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    })
      .then((result) => {
        if (requestId !== requestRef.current) return;
        setTotal(result.total);
        setRows(result.rows);
      })
      .catch((err: unknown) => {
        if (requestId !== requestRef.current) return;
        setRows([]);
        setTotal(0);
        setLoadError(err instanceof Error ? err.message : 'Could not load users. Please try again.');
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [debouncedSearch, filter, page, pageSize, reloadToken]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    setPage(1);
  };

  const changePageSize = (next: PageSize) => {
    setPageSize(next);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, or user ID"
          className="w-full bg-slate-700 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => changeFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === f.key ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {loading && rows.length === 0 ? 'Loading users...' : `Showing ${rangeStart}-${rangeEnd} of ${total} users`}
        </p>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Per page
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value) as PageSize)}
            className="bg-slate-700 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500/50"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-red-300">{loadError}</span>
          <Button variant="ghost" className="text-xs px-2 py-1 shrink-0" onClick={() => setReloadToken((t) => t + 1)}>
            <RefreshCw size={12} className="inline mr-1" /> Retry
          </Button>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 ? (
        <EmptyState message="No users match these filters" />
      ) : (
        <div className="space-y-2">
          {rows.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-white/10 hover:border-amber-500/30 rounded-xl p-3 flex items-center gap-3 transition"
            >
              <div className="w-9 h-9 rounded-full bg-slate-700 text-amber-300 flex items-center justify-center text-sm font-semibold shrink-0">
                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{u.full_name || u.phone || 'Unnamed user'}</p>
                  {u.role === 'admin' && <ShieldCheck size={14} className="text-amber-400 shrink-0" />}
                  {u.kyc_verified && <BadgeCheck size={14} className="text-emerald-400 shrink-0" />}
                  {u.banned && <Ban size={14} className="text-red-400 shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 truncate">{u.email || u.phone || u.id}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-slate-300">{u.lumora_coins} coins</p>
                <p className="text-[11px] text-slate-500">Last sign-in {formatDate(u.last_sign_in_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={14} className="inline mr-1" /> Previous
          </Button>
          <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
          <Button variant="ghost" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next <ChevronRight size={14} className="inline ml-1" />
          </Button>
        </div>
      )}

      {selected && (
        <AdminUserDetailModal
          user={selected}
          onClose={() => setSelectedId(null)}
          onChanged={() => setReloadToken((t) => t + 1)}
        />
      )}
    </div>
  );
}
