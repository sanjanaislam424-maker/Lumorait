import { useEffect, useState } from 'react';
import { Pencil, Trash2, Pin, ExternalLink } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { PortfolioItem } from '@/lib/profileDetails';
import { TaskRow } from '@/lib/supabase';
import {
  adminErrorMessage,
  deleteAdminPortfolioItem,
  deleteAdminTask,
  fetchUserPortfolio,
  fetchUserTasks,
  updateAdminPortfolioItem,
  updateAdminTask,
} from '@/lib/adminUsers';

const INPUT_CLASS = 'w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-amber-500/50';
const LABEL_CLASS = 'text-xs text-slate-400 block mb-1';

type EditTarget = { kind: 'task' | 'portfolio'; id: string } | null;

export function AdminUserContent({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [section, setSection] = useState<'tasks' | 'portfolio'>('tasks');

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1 w-fit">
        {(['tasks', 'portfolio'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${section === key ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
          >
            {key === 'tasks' ? 'Tasks posted' : 'Portfolio'}
          </button>
        ))}
      </div>
      {section === 'tasks' ? (
        <TaskList userId={userId} onChanged={onChanged} />
      ) : (
        <PortfolioList userId={userId} onChanged={onChanged} />
      )}
    </div>
  );
}

function useListLoader<T>(load: () => Promise<T[]>, deps: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await load());
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not load this list.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [deps]);

  return { items, loading, error, reload };
}

function ConfirmDeleteButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} disabled={disabled} className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50" aria-label="Delete">
        <Trash2 size={14} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setArmed(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
      <button onClick={onConfirm} disabled={disabled} className="text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg px-2 py-1 disabled:opacity-50">Confirm delete</button>
    </div>
  );
}

function TaskList({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const { notify } = useToast();
  const { items, loading, error, reload } = useListLoader<TaskRow>(() => fetchUserTasks(userId), userId);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [busy, setBusy] = useState(false);

  const removeTask = async (task: TaskRow) => {
    setBusy(true);
    try {
      await deleteAdminTask(task.id);
      notify('Task deleted', 'success');
      await reload();
      onChanged();
    } catch (err) {
      notify(adminErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <p className="text-xs text-slate-500">Loading tasks...</p>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>;
  if (items.length === 0) return <EmptyState message="This user has not posted any tasks" />;

  return (
    <div className="space-y-2">
      {items.map((task) => (
        <TaskEditRow
          key={task.id}
          task={task}
          isEditing={editing?.kind === 'task' && editing.id === task.id}
          busy={busy}
          onEdit={() => setEditing(editing?.id === task.id ? null : { kind: 'task', id: task.id })}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            onChanged();
          }}
          onDelete={() => removeTask(task)}
        />
      ))}
    </div>
  );
}

function TaskEditRow({
  task,
  isEditing,
  busy,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  task: TaskRow;
  isEditing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { notify } = useToast();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [targetUrl, setTargetUrl] = useState(task.target_url ?? '');
  const [reward, setReward] = useState(task.reward_coins);
  const [slots, setSlots] = useState(task.slots);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminTask(task.id, {
        title,
        description,
        target_url: targetUrl.trim() || null,
        reward_coins: reward,
        slots,
      });
      notify('Task saved', 'success');
      onSaved();
    } catch (err) {
      notify(adminErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-white/10 rounded-xl p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{task.title}</p>
          <p className="text-xs text-slate-500">
            {task.platform} • {task.reward_coins} reward • {task.filled}/{task.slots} filled • {task.status}
          </p>
        </div>
        <button onClick={onEdit} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50" aria-label="Edit task">
          <Pencil size={14} />
        </button>
        <ConfirmDeleteButton onConfirm={onDelete} disabled={busy || task.filled > 0} />
      </div>
      {task.filled > 0 && <p className="text-[11px] text-slate-500">Tasks with submissions cannot be deleted.</p>}

      {isEditing && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div>
            <label className={LABEL_CLASS}>Title</label>
            <input className={INPUT_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea className={`${INPUT_CLASS} min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Target link (http or https)</label>
            <input className={INPUT_CLASS} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>Reward coins</label>
              <input type="number" min={0} className={INPUT_CLASS} value={reward} onChange={(e) => setReward(Number(e.target.value))} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Slots (at least {task.filled})</label>
              <input type="number" min={Math.max(task.filled, 1)} className={INPUT_CLASS} value={slots} onChange={(e) => setSlots(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save task'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioList({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const { notify } = useToast();
  const { items, loading, error, reload } = useListLoader<PortfolioItem>(() => fetchUserPortfolio(userId), userId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      notify(successMessage, 'success');
      await reload();
      onChanged();
    } catch (err) {
      notify(adminErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <p className="text-xs text-slate-500">Loading portfolio...</p>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>;
  if (items.length === 0) return <EmptyState message="This user has no portfolio items" />;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="bg-slate-800/50 border border-white/10 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate flex items-center gap-1.5">
                {item.pinned && <Pin size={12} className="text-amber-400 shrink-0" />}
                {item.title}
              </p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline inline-flex items-center gap-1 truncate max-w-full">
                <span className="truncate">{item.url}</span>
                <ExternalLink size={10} className="shrink-0" />
              </a>
            </div>
            <button
              onClick={() => setEditingId(editingId === item.id ? null : item.id)}
              disabled={busy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
              aria-label="Edit portfolio item"
            >
              <Pencil size={14} />
            </button>
            <ConfirmDeleteButton
              disabled={busy}
              onConfirm={() => run(() => deleteAdminPortfolioItem(item.id), 'Portfolio item deleted')}
            />
          </div>
          {editingId === item.id && (
            <PortfolioEditForm
              item={item}
              busy={busy}
              onCancel={() => setEditingId(null)}
              onSave={(patch) =>
                run(async () => {
                  await updateAdminPortfolioItem(item.id, patch);
                  setEditingId(null);
                }, 'Portfolio item saved')
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PortfolioEditForm({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: PortfolioItem;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: { title: string; url: string; description: string | null; pinned: boolean }) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);
  const [description, setDescription] = useState(item.description ?? '');
  const [pinned, setPinned] = useState(item.pinned);

  return (
    <div className="space-y-2 pt-2 border-t border-white/10">
      <div>
        <label className={LABEL_CLASS}>Title</label>
        <input className={INPUT_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </div>
      <div>
        <label className={LABEL_CLASS}>Link (http or https)</label>
        <input className={INPUT_CLASS} value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
      </div>
      <div>
        <label className={LABEL_CLASS}>Description</label>
        <input className={INPUT_CLASS} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-amber-500" />
        Pinned to the top of the profile
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy} onClick={() => onSave({ title, url, description: description.trim() || null, pinned })}>
          Save item
        </Button>
      </div>
    </div>
  );
}
