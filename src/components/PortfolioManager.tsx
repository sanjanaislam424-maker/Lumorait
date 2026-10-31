import { useEffect, useState } from 'react';
import { Briefcase, ExternalLink, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Card, Button, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  MAX_PINNED_ITEMS,
  MAX_PORTFOLIO_ITEMS,
  PortfolioItem,
  deletePortfolioItem,
  fetchPortfolio,
  updatePortfolioItem,
} from '@/lib/profileDetails';
import { PortfolioItemModal } from '@/components/PortfolioItemModal';

export function PortfolioManager() {
  const { lang, profile, themeConfig } = useApp();
  const { notify } = useToast();
  const isBn = lang === 'bn';
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | 'new' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchPortfolio(profile.id)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.id, reloadKey]);

  if (!profile) return null;

  const pinnedCount = items.filter((i) => i.pinned).length;
  const atCapacity = items.length >= MAX_PORTFOLIO_ITEMS;

  const togglePin = async (item: PortfolioItem) => {
    if (!item.pinned && pinnedCount >= MAX_PINNED_ITEMS) {
      notify(isBn ? `সর্বোচ্চ ${MAX_PINNED_ITEMS}টি কাজ পিন করা যাবে` : `You can pin up to ${MAX_PINNED_ITEMS} works`, 'error');
      return;
    }
    try {
      await updatePortfolioItem(item.id, { pinned: !item.pinned });
      setReloadKey((k) => k + 1);
    } catch {
      notify(isBn ? 'পিন আপডেট করা যায়নি' : 'Could not update pin', 'error');
    }
  };

  const removeItem = async (item: PortfolioItem) => {
    if (!window.confirm(isBn ? `"${item.title}" মুছে ফেলবেন?` : `Delete "${item.title}"?`)) return;
    try {
      await deletePortfolioItem(item.id);
      notify(isBn ? 'কাজ মুছে ফেলা হয়েছে' : 'Work deleted', 'success');
      setReloadKey((k) => k + 1);
    } catch {
      notify(isBn ? 'মুছে ফেলা যায়নি' : 'Could not delete work', 'error');
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Briefcase size={18} style={{ color: themeConfig.primary }} />
          <h3 className="font-semibold neon-text text-sm">{isBn ? 'আমার কাজের নমুনা' : 'Portfolio showcase'}</h3>
        </div>
        <span className="text-[11px] neon-muted">{items.length}/{MAX_PORTFOLIO_ITEMS}</span>
      </div>
      <p className="text-xs neon-muted mb-3">
        {isBn ? 'আপনার সেরা কাজগুলো যোগ করুন। পিন করা কাজ সবার উপরে দেখাবে।' : 'Add your best work. Pinned works appear first on your public profile.'}
      </p>

      {loading && <p className="text-sm neon-muted">{isBn ? 'লোড হচ্ছে...' : 'Loading...'}</p>}
      {!loading && failed && (
        <div className="text-center space-y-2 py-2">
          <p className="text-sm text-rose-300">{isBn ? 'কাজের তালিকা লোড করা যায়নি।' : 'Could not load your works.'}</p>
          <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>{isBn ? 'আবার চেষ্টা করুন' : 'Try again'}</Button>
        </div>
      )}

      {!loading && !failed && (
        <div className="space-y-2">
          {items.length === 0 && <EmptyState message={isBn ? 'এখনও কোনো কাজ যোগ করা হয়নি' : 'No works added yet'} />}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-800/60 border border-white/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold neon-text truncate flex items-center gap-1.5">
                    {item.pinned && <Pin size={12} className="text-amber-400 shrink-0" />}
                    <span className="truncate">{item.title}</span>
                  </p>
                  {item.description && <p className="text-xs neon-muted mt-1 line-clamp-2">{item.description}</p>}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] inline-flex items-center gap-1 mt-1 text-amber-300 hover:underline break-all">
                    <ExternalLink size={11} /> {item.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" aria-label={item.pinned ? (isBn ? 'আনপিন' : 'Unpin') : (isBn ? 'পিন' : 'Pin')} onClick={() => togglePin(item)} className="p-2 rounded-lg text-slate-300 hover:bg-white/10 transition">
                    {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button type="button" aria-label={isBn ? 'সম্পাদনা' : 'Edit'} onClick={() => setEditing(item)} className="p-2 rounded-lg text-slate-300 hover:bg-white/10 transition">
                    <Pencil size={14} />
                  </button>
                  <button type="button" aria-label={isBn ? 'মুছুন' : 'Delete'} onClick={() => removeItem(item)} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => setEditing('new')}
            disabled={atCapacity}
          >
            <Plus size={16} /> {atCapacity
              ? (isBn ? `সর্বোচ্চ ${MAX_PORTFOLIO_ITEMS}টি কাজ যোগ হয়েছে` : `Limit of ${MAX_PORTFOLIO_ITEMS} works reached`)
              : (isBn ? 'কাজ যোগ করুন' : 'Add a work')}
          </Button>
        </div>
      )}

      <PortfolioItemModal
        item={editing}
        pinnedCount={pinnedCount}
        onClose={() => setEditing(null)}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </Card>
  );
}
