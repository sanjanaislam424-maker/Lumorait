import { supabase } from '@/lib/supabase';

export type ReviewType = 'good' | 'bad';

export type PublicBadge = { label: string; icon: string; tier: string };

export type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  xp_points: number;
  total_tasks_completed: number;
  avg_rating: number;
  good_reviews: number;
  bad_reviews: number;
  badges: PublicBadge[];
  contact: { phone: string | null; email: string | null; address: string | null } | null;
};

export type UserReview = {
  id: string;
  review_type: ReviewType;
  comment: string;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  return data as PublicProfile;
}

export async function fetchReviews(revieweeId: string): Promise<UserReview[]> {
  const { data, error } = await supabase
    .from('user_reviews')
    .select('id, review_type, comment, created_at, reviewer:profiles!reviewer_id(full_name, avatar_url)')
    .eq('reviewee_id', revieweeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserReview[];
}

export async function fetchMyReviewedSubmissionIds(reviewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_reviews')
    .select('submission_id')
    .eq('reviewer_id', reviewerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.submission_id as string);
}

export async function submitReview(input: { reviewerId: string; revieweeId: string; submissionId: string; reviewType: ReviewType; comment: string }) {
  const { error } = await supabase.from('user_reviews').insert({
    reviewer_id: input.reviewerId,
    reviewee_id: input.revieweeId,
    submission_id: input.submissionId,
    review_type: input.reviewType,
    comment: input.comment.trim(),
  });
  if (error) throw error;
}
