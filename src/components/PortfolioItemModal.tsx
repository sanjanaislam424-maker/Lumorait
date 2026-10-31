import { useState } from 'react';
import { Modal, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApp } from '@/lib/AppContext';
import {
  MAX_PINNED_ITEMS,
  PortfolioItem,
  insertPortfolioItem,
  toSafeHttpUrl,
  updatePortfolioItem,
} from '@/lib/profileDetails';

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 300;

export function PortfolioItemModal({
  item,
  pinnedCount,
  onClose,
  onSaved,
}: {
  item: PortfolioItem | 'new' | null;
  pinnedCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang, profile } = useApp();
  const { notify } = useToast();
  const isBn = lang === 'bn';

  const title = item === 'new' ? (isBn ? 'নতুন কাজ যোগ করুন' : 'Add a work') : (isBn ? 'কাজ সম্পাদনা' : 'Edit work');

  return (
    <Modal open={!!item} onClose={onClose} title={title}>
      {item && profile && (
        <PortfolioForm
          key={item === 'new' ? 'new' : item.id}
          item={item === 'new' ? null : item}
          pinnedCount={pinnedCount}
          userId={profile.id}
          isBn={isBn}
          onCancel={onClose}
          onSaved={() => { onSaved(); onClose(); }}
          notify={notify}
        />
      )}
    </Modal>
  );
}

function PortfolioForm({
  item, pinnedCount, userId, isBn, onCancel, onSaved, notify,
}: {
  item: PortfolioItem | null;
  pinnedCount: number;
  userId: string;
  isBn: boolean;
  onCancel: () => void;
  onSaved: () => void;
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [busy, setBusy] = useState(false);

  const pinLimitReached = !pinned && pinnedCount >= MAX_PINNED_ITEMS && !item?.pinned;

  const submit = async () => {
    const cleanTitle = title.trim();
    const safeUrl = toSafeHttpUrl(url);
    if (!cleanTitle || cleanTitle.length > MAX_TITLE) {
      notify(isBn ? `শিরোনাম ১-${MAX_TITLE} অক্ষরের মধ্যে হতে হবে` : `Title must be 1 to ${MAX_TITLE} characters`, 'error');
      return;
    }
    if (!safeUrl) {
      notify(isBn ? 'সঠিক লিংক দিন (https://...)' : 'Please enter a valid link (https://...)', 'error');
      return;
    }
    const cleanDescription = description.trim();
    if (cleanDescription.length > MAX_DESCRIPTION) {
      notify(isBn ? `বিবরণ ${MAX_DESCRIPTION} অক্ষরের বেশি হতে পারবে না` : `Description can be at most ${MAX_DESCRIPTION} characters`, 'error');
      return;
    }

    setBusy(true);
    try {
      if (item) {
        await updatePortfolioItem(item.id, {
          title: cleanTitle,
          url: safeUrl,
          description: cleanDescription || null,
          pinned,
        });
      } else {
        await insertPortfolioItem({
          userId,
          title: cleanTitle,
          url: safeUrl,
          description: cleanDescription || null,
          pinned,
        });
      }
      notify(isBn ? 'কাজ সংরক্ষিত হয়েছে' : 'Work saved', 'success');
      onSaved();
    } catch {
      notify(isBn ? 'সংরক্ষণ করা যায়নি। সীমা (১২টি কাজ, ৩টি পিন) পরীক্ষা করুন।' : 'Could not save. Check the limits (12 works, 3 pinned).', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs neon-muted block mb-1">{isBn ? 'শিরোনাম' : 'Title'}</label>
        <input value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
      </div>
      <div>
        <label className="text-xs neon-muted block mb-1">{isBn ? 'লিংক' : 'Link'}</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50" />
      </div>
      <div>
        <label className="text-xs neon-muted block mb-1">{isBn ? 'সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)' : 'Short description (optional)'}</label>
        <textarea value={description} maxLength={MAX_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none resize-none focus:border-amber-500/50" />
      </div>
      <label className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/10 ${pinLimitReached ? 'opacity-50' : 'cursor-pointer'}`}>
        <span>
          <span className="block text-sm neon-text">{isBn ? 'প্রোফাইলের উপরে পিন করুন' : 'Pin to top of profile'}</span>
          <span className="block text-[11px] neon-muted">
            {pinLimitReached
              ? (isBn ? `সর্বোচ্চ ${MAX_PINNED_ITEMS}টি পিন করা যাবে` : `You can pin up to ${MAX_PINNED_ITEMS} works`)
              : (isBn ? `সর্বোচ্চ ${MAX_PINNED_ITEMS}টি` : `Up to ${MAX_PINNED_ITEMS} works`)}
          </span>
        </span>
        <input type="checkbox" checked={pinned} disabled={pinLimitReached} onChange={(e) => setPinned(e.target.checked)} className="w-5 h-5 accent-amber-500 shrink-0" />
      </label>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>{isBn ? 'বাতিল' : 'Cancel'}</Button>
        <Button className="flex-1" onClick={submit} disabled={busy}>{busy ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সংরক্ষণ' : 'Save')}</Button>
      </div>
    </div>
  );
}
