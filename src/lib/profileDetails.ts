import { supabase } from '@/lib/supabase';

export const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+8801XXXXXXXXX' },
  { key: 'website', label: 'Portfolio website', placeholder: 'https://yourwebsite.com' },
] as const;

export type SocialKey = (typeof SOCIAL_PLATFORMS)[number]['key'];
export type SocialLinks = Partial<Record<SocialKey, string>>;

export const MAX_SKILLS = 12;
export const MAX_SKILL_LENGTH = 24;
export const MAX_PORTFOLIO_ITEMS = 12;
export const MAX_PINNED_ITEMS = 3;

export type PortfolioItem = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  pinned: boolean;
  created_at: string;
};

export function toSafeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSocialValue(key: SocialKey, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (key === 'whatsapp' && !/^https?:\/\//i.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 6 ? `https://wa.me/${digits}` : null;
  }
  return toSafeHttpUrl(trimmed);
}

export async function fetchPortfolio(userId: string): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('profile_portfolio_items')
    .select('id, user_id, title, url, description, pinned, created_at')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioItem[];
}

export async function insertPortfolioItem(input: {
  userId: string;
  title: string;
  url: string;
  description: string | null;
  pinned: boolean;
}) {
  const { error } = await supabase.from('profile_portfolio_items').insert({
    user_id: input.userId,
    title: input.title,
    url: input.url,
    description: input.description,
    pinned: input.pinned,
  });
  if (error) throw error;
}

export async function updatePortfolioItem(
  id: string,
  patch: Partial<Pick<PortfolioItem, 'title' | 'url' | 'description' | 'pinned'>>,
) {
  const { error } = await supabase.from('profile_portfolio_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePortfolioItem(id: string) {
  const { error } = await supabase.from('profile_portfolio_items').delete().eq('id', id);
  if (error) throw error;
}
