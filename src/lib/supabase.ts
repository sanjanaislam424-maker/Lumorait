import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Profile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  lumora_coins: number;
  withdrawable_coins: number;
  bonus_coins: number;
  kyc_verified: boolean;
  kyc_fee_paid: boolean;
  trust_score: number;
  streak_days: number;
  last_check_in: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_earned: number;
  spin_used_today: number;
  spin_reset_date: string | null;
  banned: boolean;
  referral_step2_paid: boolean;
  referral_activated_at: string | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  creator_id: string;
  platform: string;
  title: string;
  description: string;
  target_url: string | null;
  reward_coins: number;
  cost_coins: number;
  is_admin_task: boolean;
  status: string;
  slots: number;
  filled: number;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  task_id: string;
  doer_id: string;
  proof_urls: string[];
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'challenged';
  doer_rating: number | null;
  poster_rating: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export type TxRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  note: string | null;
  created_at: string;
};

export type SettingsRow = {
  id: number;
  bdt_to_coin: number;
  min_deposit_bdt: number;
  spin_rewards: string;
  free_spins_daily: number;
  checkin_rewards: string;
  referral_bonus: number;
  referee_bonus: number;
  referrer_deposit_pct: number;
  updated_at: string;
};
