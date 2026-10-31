import type { ReactNode } from 'react';
import { ArrowLeftRight, CalendarCheck, Coins, KeyRound, LogIn, ListChecks, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import type { ActivityKind } from '@/lib/adminUsers';

type KindMeta = { label: string; tone: string; icon: ReactNode };

const ICON_SIZE = 12;

export const ACTIVITY_KIND_META: Record<ActivityKind, KindMeta> = {
  signup: { label: 'Account created', tone: 'bg-sky-500/20 text-sky-300', icon: <UserPlus size={ICON_SIZE} /> },
  login: { label: 'Signed in', tone: 'bg-teal-500/20 text-teal-300', icon: <LogIn size={ICON_SIZE} /> },
  checkin: { label: 'Daily check-in', tone: 'bg-amber-500/20 text-amber-300', icon: <CalendarCheck size={ICON_SIZE} /> },
  task_submission: { label: 'Task submission', tone: 'bg-sky-500/20 text-sky-300', icon: <ListChecks size={ICON_SIZE} /> },
  profile_update: { label: 'Settings updated', tone: 'bg-slate-500/30 text-slate-200', icon: <Settings size={ICON_SIZE} /> },
  account_change: { label: 'Account change', tone: 'bg-slate-500/30 text-slate-200', icon: <ShieldCheck size={ICON_SIZE} /> },
  password_change: { label: 'Password changed', tone: 'bg-red-500/20 text-red-300', icon: <KeyRound size={ICON_SIZE} /> },
  credential_change: { label: 'Credential change', tone: 'bg-red-500/20 text-red-300', icon: <KeyRound size={ICON_SIZE} /> },
  transaction: { label: 'Balance change', tone: 'bg-amber-500/20 text-amber-300', icon: <Coins size={ICON_SIZE} /> },
  transfer: { label: 'Coin transfer', tone: 'bg-amber-500/20 text-amber-300', icon: <ArrowLeftRight size={ICON_SIZE} /> },
};
