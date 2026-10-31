import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Modal, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { submitReview, ReviewType } from '@/lib/reviews';

export type ReviewTarget = {
  submissionId: string;
  revieweeId: string;
  revieweeName: string;
  taskTitle: string;
};

const MAX_LENGTH = 1000;

export function ReviewFormModal({
  target,
  onClose,
  onSubmitted,
}: {
  target: ReviewTarget | null;
  onClose: () => void;
  onSubmitted: (submissionId: string) => void;
}) {
  const { lang, profile } = useApp();
  const { notify } = useToast();
  const [reviewType, setReviewType] = useState<ReviewType>('good');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReviewType('good');
    setComment('');
  }, [target?.submissionId]);

  const trimmedLength = comment.trim().length;
  const canSubmit = !busy && trimmedLength > 0 && trimmedLength <= MAX_LENGTH;

  const handleSubmit = async () => {
    if (!target || !profile || !canSubmit) return;
    setBusy(true);
    try {
      await submitReview({
        reviewerId: profile.id,
        revieweeId: target.revieweeId,
        submissionId: target.submissionId,
        reviewType,
        comment,
      });
      notify(lang === 'bn' ? 'রিভিউ জমা হয়েছে' : 'Review submitted', 'success');
      onSubmitted(target.submissionId);
      onClose();
    } catch (err: any) {
      const alreadyReviewed = err?.code === '23505';
      notify(
        alreadyReviewed
          ? (lang === 'bn' ? 'আপনি ইতিমধ্যে এই কাজের রিভিউ দিয়েছেন' : 'You have already reviewed this task')
          : (lang === 'bn' ? 'রিভিউ জমা দেওয়া যায়নি' : 'Could not submit review'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const typeOptions: { value: ReviewType; label: string; icon: React.ReactNode; active: string }[] = [
    {
      value: 'good',
      label: lang === 'bn' ? 'ভালো রিভিউ' : 'Good review',
      icon: <ThumbsUp size={16} />,
      active: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
    },
    {
      value: 'bad',
      label: lang === 'bn' ? 'খারাপ রিভিউ' : 'Bad review',
      icon: <ThumbsDown size={16} />,
      active: 'border-rose-500/60 bg-rose-500/15 text-rose-300',
    },
  ];

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={lang === 'bn' ? 'রিভিউ লিখুন' : 'Leave a review'}
    >
      {target && (
        <div className="space-y-4">
          <div>
            <p className="text-xs neon-muted">{lang === 'bn' ? 'কাজ' : 'Task'}</p>
            <p className="text-sm font-semibold neon-text">{target.taskTitle}</p>
            <p className="text-xs neon-muted mt-1">
              {lang === 'bn' ? 'রিভিউ করা হচ্ছে' : 'Reviewing'}: <span className="neon-text font-medium">{target.revieweeName}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {typeOptions.map((opt) => {
              const active = reviewType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReviewType(opt.value)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                    active ? opt.active : 'border-white/10 bg-slate-800 text-slate-300 hover:border-white/20'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-xs neon-muted block mb-1">
              {lang === 'bn' ? 'কাজের মান নিয়ে বিস্তারিত লিখুন' : 'Describe the quality of the work'}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_LENGTH))}
              rows={4}
              className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none resize-none focus:border-amber-500/50"
            />
            <p className="text-xs neon-muted text-right mt-1">{comment.length}/{MAX_LENGTH}</p>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? (lang === 'bn' ? 'জমা হচ্ছে...' : 'Submitting...') : (lang === 'bn' ? 'রিভিউ জমা দিন' : 'Submit review')}
          </Button>
        </div>
      )}
    </Modal>
  );
}
