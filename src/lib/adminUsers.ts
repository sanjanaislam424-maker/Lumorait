import { supabase, supabaseUrl, Profile, TaskRow } from '@/lib/supabase';
import type { PortfolioItem } from '@/lib/profileDetails';

export type AdminUserRow = Profile & { email: string | null; last_sign_in_at: string | null };

export type UserFilter = 'all' | 'banned' | 'admin' | 'kyc_verified' | 'kyc_pending' | 'low_balance';

export type ActivityKind =
  | 'signup'
  | 'login'
  | 'profile_update'
  | 'account_change'
  | 'transaction'
  | 'transfer'
  | 'task_submission'
  | 'credential_change';

export type ActivityRow = {
  id: string;
  kind: ActivityKind;
  summary: string;
  actor_id: string | null;
  created_at: string;
};

export type BalanceForm = {
  lumora_coins: number;
  withdrawable_coins: number;
  bonus_coins: number;
  cash_balance: number;
  withdrawable_balance: number;
};

export type AdminTaskPatch = {
  title?: string;
  description?: string;
  target_url?: string | null;
  reward_coins?: number;
  slots?: number;
};

export type AdminPortfolioPatch = {
  title?: string;
  url?: string;
  description?: string | null;
  pinned?: boolean;
};

export type ProfileDetailsPatch = {
  full_name?: string;
  phone?: string;
  bio?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
};

const SAFE_DB_CODE_PREFIX = 'P0001';

export function adminErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as { code?: string; message?: string } | null;
  if (err?.code === SAFE_DB_CODE_PREFIX && err.message) return err.message;
  console.error('admin action failed', error);
  return fallback;
}

export async function fetchAdminUsers(params: {
  search: string;
  filter: UserFilter;
  offset: number;
  limit: number;
}): Promise<{ total: number; rows: AdminUserRow[] }> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: params.search,
    p_filter: params.filter,
    p_limit: params.limit,
    p_offset: params.offset,
  });
  if (error) {
    console.error('admin_list_users failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      params,
    });
    if (error.code === '42501') throw new Error('Your account does not have admin access.');
    throw new Error('Could not load users. Please try again.');
  }
  const payload = data as { total?: unknown; rows?: unknown } | null;
  if (!payload || typeof payload.total !== 'number' || !Array.isArray(payload.rows)) {
    console.error('admin_list_users returned an unexpected shape', data);
    throw new Error('Could not load users. Please try again.');
  }
  return { total: payload.total, rows: payload.rows as AdminUserRow[] };
}

export async function updateUserProfileDetails(userId: string, patch: ProfileDetailsPatch): Promise<void> {
  const { error } = await supabase.rpc('admin_update_user_profile', { p_user_id: userId, p_patch: patch });
  if (error) throw error;
}

export async function setUserBalances(userId: string, balances: BalanceForm, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_balances', {
    p_user_id: userId,
    p_lumora_coins: balances.lumora_coins,
    p_withdrawable_coins: balances.withdrawable_coins,
    p_bonus_coins: balances.bonus_coins,
    p_cash_balance: balances.cash_balance,
    p_withdrawable_balance: balances.withdrawable_balance,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function setUserBanned(userId: string, banned: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_banned', { p_user_id: userId, p_banned: banned });
  if (error) throw error;
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  const body = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!response.ok || body?.success !== true) {
    throw new Error(body?.error || 'Could not reset the password. Please try again.');
  }
}

export async function fetchUserActivity(userId: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from('user_activity_log')
    .select('id, kind, summary, actor_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as ActivityRow[];
}

export async function fetchUserTasks(userId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as TaskRow[];
}

export async function fetchUserPortfolio(userId: string): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('profile_portfolio_items')
    .select('id, user_id, title, url, description, pinned, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PortfolioItem[];
}

export async function updateAdminTask(taskId: string, patch: AdminTaskPatch): Promise<void> {
  const { error } = await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: patch });
  if (error) throw error;
}

export async function deleteAdminTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_task', { p_task_id: taskId });
  if (error) throw error;
}

export async function updateAdminPortfolioItem(itemId: string, patch: AdminPortfolioPatch): Promise<void> {
  const { error } = await supabase.rpc('admin_update_portfolio_item', { p_item_id: itemId, p_patch: patch });
  if (error) throw error;
}

export async function deleteAdminPortfolioItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_portfolio_item', { p_item_id: itemId });
  if (error) throw error;
}
