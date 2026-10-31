import { ActivityFilters, ActivityKind } from '@/lib/adminUsers';

type Category = { key: string; label: string; kinds: ActivityKind[] };

export const ACTIVITY_CATEGORIES: Category[] = [
  { key: 'all', label: 'All events', kinds: [] },
  { key: 'login', label: 'Sign-ins', kinds: ['login'] },
  { key: 'checkin', label: 'Daily check-ins', kinds: ['checkin'] },
  { key: 'tasks', label: 'Task submissions', kinds: ['task_submission'] },
  { key: 'settings', label: 'Settings updates', kinds: ['profile_update', 'account_change'] },
  { key: 'password', label: 'Password changes', kinds: ['password_change', 'credential_change'] },
  { key: 'money', label: 'Balance & transfers', kinds: ['transaction', 'transfer'] },
  { key: 'signup', label: 'Sign-up', kinds: ['signup'] },
];

export function dateRangeIso(fromDay: string, toDay: string): { from: string | null; to: string | null } {
  const from = fromDay ? new Date(`${fromDay}T00:00:00`).toISOString() : null;
  let to: string | null = null;
  if (toDay) {
    const end = new Date(`${toDay}T00:00:00`);
    end.setDate(end.getDate() + 1);
    to = end.toISOString();
  }
  return { from, to };
}

const INPUT_CLASS = 'bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500/50';

export function ActivityFilterBar({
  fromDay,
  toDay,
  category,
  onChange,
}: {
  fromDay: string;
  toDay: string;
  category: string;
  onChange: (next: { fromDay: string; toDay: string; category: string }) => void;
}) {
  const invalidRange = fromDay && toDay && fromDay > toDay;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          From
          <input type="date" className={INPUT_CLASS} value={fromDay} max={toDay || undefined} onChange={(e) => onChange({ fromDay, toDay: e.target.value, category })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          To
          <input type="date" className={INPUT_CLASS} value={toDay} min={fromDay || undefined} onChange={(e) => onChange({ fromDay, toDay: e.target.value, category })} />
        </label>
        {(fromDay || toDay) && (
          <button onClick={() => onChange({ fromDay: '', toDay: '', category })} className="text-xs text-slate-400 hover:text-white px-2 py-2">
            Clear dates
          </button>
        )}
      </div>
      {invalidRange && <p className="text-xs text-red-300">The start date must be before the end date.</p>}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ACTIVITY_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange({ fromDay, toDay, category: c.key })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              category === c.key ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function buildActivityFilters(fromDay: string, toDay: string, category: string): ActivityFilters {
  const range = dateRangeIso(fromDay, toDay);
  const kinds = ACTIVITY_CATEGORIES.find((c) => c.key === category)?.kinds ?? [];
  return { from: range.from, to: range.to, kinds: [...kinds] };
}
