import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const supabaseUrl = (supabase as any).supabaseUrl as string;
export const supabaseAnonKey = (supabase as any).supabaseKey as string;

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
  cash_balance: number;
  withdrawable_balance: number;
  membership_tier: string;
  membership_expires: string | null;
  box_blasts_used_today: number;
  box_blast_date: string | null;
  admin_permissions: Record<string, boolean> | null;
  ai_tone: 'buddy' | 'mentor' | 'coach';
  is_super_admin: boolean;
  bio: string | null;
  contact_email: string | null;
  address: string | null;
  share_contact_info: boolean;
  level: number;
  xp_points: number;
  notify_tasks: boolean;
  notify_payments: boolean;
  notify_promo: boolean;
  level_reward_claimed: number;
  deletion_requested_at: string | null;
  avg_rating: number;
  total_tasks_completed: number;
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
  is_promoted?: boolean;
  promotion_coins?: number;
  promotion_expires_at?: string | null;
  daily_slot_limit?: number | null;
  promotion_weight?: number;
  promotion_tier?: string | null;
  promotion_started_at?: string | null;
  promotion_locked_until?: string | null;
  promotion_daily_rate?: number | null;
  promotion_end_at?: string | null;
  promotion_last_charged_at?: string | null;
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
  sender_number: string | null;
  trx_id: string | null;
  receiver_number: string | null;
  personal_admin_number: string | null;
  deposit_promo_code: string | null;
  withdraw_promo_code: string | null;
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
  service_charge_pct: number;
  vip_service_charge_pct: number;
  admin_bkash_number: string | null;
  admin_nagad_number: string | null;
  admin_rocket_number: string | null;
  updated_at: string;
};
