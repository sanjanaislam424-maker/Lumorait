import { useEffect, useRef, useState } from 'react';
import { Search, Ban, ShieldCheck, BadgeCheck } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { AdminUserDetailModal } from '@/components/admin/AdminUserDetailModal';
import { AdminUserRow, UserFilter, adminErrorMessage, fetchAdminUsers } from '@/lib/adminUsers';

const PAGE_SIZE = 25;

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: 'all', label: 'All users' },
  { key: 'banned', label: 'Banned' },
  { key: 'admin', label: 'Admins' },
  { key: 'kyc_verified', label: 'Verified' },
  { key: 'kyc_pending', label: 'Not verified' },
  { key: 'low_balance', label: 'Low coins' },
];

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminUsersTab() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = async (append: boolean) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchAdminUsers({
        search: debouncedSearch,
        filter,
        offset: append ? rows.length : 0,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestRef.current) return;
      setTotal(result.total);
      setRows(append ? [...rows, ...result.rows] : result.rows);
    } catch (err) {
      if (requestId === requestRef.current) setLoadError(adminErrorMessage(err, 'Could not load users. Please try again.'));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // Reload only when the search text or filter changes.
  }, [debouncedSearch, filter]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

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
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === f.key ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {loading && rows.length === 0 ? 'Loading users...' : `Showing ${rows.length} of ${total} users`}
      </p>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{loadError}</div>
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

      {rows.length < total && (
        <div className="flex justify-center">
          <Button variant="ghost" disabled={loading} onClick={() => load(true)}>
            {loading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}

      {selected && (
        <AdminUserDetailModal
          user={selected}
          onClose={() => setSelectedId(null)}
          onChanged={() => load(false)}
        />
      )}
    </div>
  );
}
