import { useEffect, useState } from 'react';
import { User as UserIcon, Mail, MapPin, Phone, ThumbsUp, ThumbsDown, Award, Trophy } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Modal } from '@/components/ui';
import {
  fetchPublicProfile,
  fetchReviews,
  PublicProfile,
  ReviewType,
  UserReview,
} from '@/lib/reviews';

const tierStyles: Record<string, string> = {
  bronze: 'text-amber-400 bg-amber-700/20 border-amber-700/30',
  silver: 'text-slate-300 bg-slate-400/20 border-slate-400/30',
  gold: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30',
  platinum: 'text-cyan-300 bg-cyan-400/20 border-cyan-400/30',
};

export function PublicProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { lang } = useApp();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [tab, setTab] = useState<ReviewType>('good');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setProfile(null);
    setReviews([]);
    setTab('good');
    setFailed(false);
    setLoading(true);
    (async () => {
      try {
        const [p, r] = await Promise.all([fetchPublicProfile(userId), fetchReviews(userId)]);
        if (cancelled) return;
        setProfile(p);
        setReviews(r);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const visibleReviews = reviews.filter((r) => r.review_type === tab);
  const contact = profile?.contact;
  const hasContact = !!(contact && (contact.phone || contact.email || contact.address));
  const avgRating = Number(profile?.avg_rating ?? 0);

  const emptyText = lang === 'bn' ? 'এখনও কোনো রিভিউ নেই' : 'No reviews yet';

  return (
    <Modal
      open={!!userId}
      onClose={onClose}
      title={lang === 'bn' ? 'পাবলিক প্রোফাইল' : 'Public profile'}
    >
      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
        {loading && <p className="text-sm neon-muted text-center py-6">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>}

        {!loading && failed && (
          <p className="text-sm text-rose-300 text-center py-6">
            {lang === 'bn' ? 'প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।' : 'Could not load this profile. Please try again.'}
          </p>
        )}

        {!loading && !failed && !profile && userId && (
          <p className="text-sm neon-muted text-center py-6">
            {lang === 'bn' ? 'এই প্রোফাইলটি পাওয়া যায়নি' : 'This profile is not available'}
          </p>
        )}

        {!loading && !failed && profile && (
          <>
            <div className="text-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-amber-500/40" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mx-auto flex items-center justify-center">
                  <UserIcon size={36} className="text-white" />
                </div>
              )}
              <h3 className="text-lg font-bold neon-text mt-3">{profile.full_name || (lang === 'bn' ? 'ব্যবহারকারী' : 'User')}</h3>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                {lang === 'bn' ? 'লেভেল' : 'Level'} {profile.level}
              </span>
              {profile.bio && <p className="text-sm neon-muted mt-2 italic">"{profile.bio}"</p>}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label={lang === 'bn' ? 'সম্পন্ন কাজ' : 'Tasks done'} value={String(profile.total_tasks_completed ?? 0)} />
              <Stat label={lang === 'bn' ? 'গড় রেটিং' : 'Avg rating'} value={avgRating > 0 ? avgRating.toFixed(1) : '-'} />
              <Stat label={lang === 'bn' ? 'এক্সপি' : 'XP'} value={String(profile.xp_points ?? 0)} />
            </div>

            {profile.badges.length > 0 && (
              <div>
                <p className="text-xs neon-muted mb-2">{lang === 'bn' ? 'ব্যাজ' : 'Badges'}</p>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((b) => (
                    <span
                      key={b.label}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${tierStyles[b.tier] ?? 'text-slate-300 bg-slate-600/20 border-slate-500/30'}`}
                    >
                      <Award size={12} /> {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasContact && contact && (
              <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3 space-y-2">
                <p className="text-xs neon-muted">{lang === 'bn' ? 'যোগাযোগ' : 'Contact'}</p>
                {contact.phone && <ContactRow icon={<Phone size={14} />} value={contact.phone} />}
                {contact.email && <ContactRow icon={<Mail size={14} />} value={contact.email} />}
                {contact.address && <ContactRow icon={<MapPin size={14} />} value={contact.address} />}
              </div>
            )}

            <div>
              <p className="text-xs neon-muted mb-2">{lang === 'bn' ? 'রিভিউ' : 'Reviews'}</p>
              <div className="grid grid-cols-2 gap-2">
                <ReviewTab
                  active={tab === 'good'}
                  onClick={() => setTab('good')}
                  icon={<ThumbsUp size={14} />}
                  label={lang === 'bn' ? 'ভালো রিভিউ' : 'Good reviews'}
                  count={profile.good_reviews ?? 0}
                  activeClass="border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                />
                <ReviewTab
                  active={tab === 'bad'}
                  onClick={() => setTab('bad')}
                  icon={<ThumbsDown size={14} />}
                  label={lang === 'bn' ? 'খারাপ রিভিউ' : 'Bad reviews'}
                  count={profile.bad_reviews ?? 0}
                  activeClass="border-rose-500/60 bg-rose-500/15 text-rose-300"
                />
              </div>

              <div className="space-y-2 mt-3">
                {visibleReviews.length === 0 && <p className="text-sm neon-muted text-center py-4">{emptyText}</p>}
                {visibleReviews.map((r) => (
                  <div key={r.id} className="rounded-xl bg-slate-800/60 border border-white/5 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold neon-text flex items-center gap-1">
                        <Trophy size={12} className="text-slate-500" />
                        {r.reviewer?.full_name || (lang === 'bn' ? 'ব্যবহারকারী' : 'User')}
                      </span>
                      <span className="text-[11px] neon-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm neon-muted whitespace-pre-line break-words">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-white/5 py-2">
      <p className="text-base font-bold neon-text">{value}</p>
      <p className="text-[11px] neon-muted">{label}</p>
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm neon-text break-all">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function ReviewTab({
  active, onClick, icon, label, count, activeClass,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; activeClass: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
        active ? activeClass : 'border-white/10 bg-slate-800 text-slate-300 hover:border-white/20'
      }`}
    >
      <span className="flex items-center gap-2">{icon} {label}</span>
      <span className="text-xs font-bold">{count}</span>
    </button>
  );
}
