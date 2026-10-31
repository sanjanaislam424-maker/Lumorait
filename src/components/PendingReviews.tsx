import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { fetchMyReviewedSubmissionIds } from '@/lib/reviews';
import { ReviewFormModal, ReviewTarget } from '@/components/ReviewFormModal';

type SubmissionRow = {
  id: string;
  doer_id: string;
  task: { id: string; title: string; creator_id: string } | null;
};

export function PendingReviews() {
  const { lang, profile } = useApp();
  const [items, setItems] = useState<ReviewTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<ReviewTarget | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const { data, error } = await supabase
          .from('task_submissions')
          .select('id, doer_id, task:tasks(id, title, creator_id)')
          .eq('status', 'approved');
        if (error) throw error;

        const rows = ((data ?? []) as unknown as SubmissionRow[]).filter(
          (r) => r.task && (r.task.creator_id === profile.id || r.doer_id === profile.id) && r.task.creator_id !== r.doer_id,
        );
        const reviewed = new Set(await fetchMyReviewedSubmissionIds(profile.id));
        const pending = rows.filter((r) => !reviewed.has(r.id));

        const counterpartOf = (r: SubmissionRow) => (r.task!.creator_id === profile.id ? r.doer_id : r.task!.creator_id);
        const counterpartIds = [...new Set(pending.map(counterpartOf))];
        const names = new Map<string, string | null>();
        if (counterpartIds.length > 0) {
          const { data: people, error: peopleErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', counterpartIds);
          if (peopleErr) throw peopleErr;
          (people ?? []).forEach((p) => names.set(p.id as string, p.full_name as string | null));
        }

        if (cancelled) return;
        setItems(pending.map((r) => ({
          submissionId: r.id,
          revieweeId: counterpartOf(r),
          revieweeName: names.get(counterpartOf(r)) || (lang === 'bn' ? 'ব্যবহারকারী' : 'User'),
          taskTitle: r.task!.title,
        })));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile, lang]);

  if (!loading && !failed && items.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={18} className="text-amber-400" />
        <h3 className="font-semibold neon-text text-sm">{lang === 'bn' ? 'রিভিউ দেওয়ার বাকি' : 'Reviews to leave'}</h3>
      </div>

      {loading && <p className="text-sm neon-muted">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>}
      {!loading && failed && (
        <p className="text-sm text-rose-300">{lang === 'bn' ? 'রিভিউ তালিকা লোড করা যায়নি।' : 'Could not load your pending reviews.'}</p>
      )}

      {!loading && !failed && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.submissionId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 border border-white/5 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold neon-text truncate">{item.taskTitle}</p>
                <p className="text-xs neon-muted truncate">{lang === 'bn' ? 'সঙ্গী' : 'With'}: {item.revieweeName}</p>
              </div>
              <Button className="shrink-0 !px-3 !py-2 text-sm" onClick={() => setTarget(item)}>
                {lang === 'bn' ? 'রিভিউ দিন' : 'Review'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <ReviewFormModal
        target={target}
        onClose={() => setTarget(null)}
        onSubmitted={(id) => setItems((prev) => prev.filter((i) => i.submissionId !== id))}
      />
    </Card>
  );
}
