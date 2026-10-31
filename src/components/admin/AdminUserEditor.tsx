import { useState } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApp } from '@/lib/AppContext';
import {
  AdminUserRow,
  BalanceForm,
  ProfileDetailsPatch,
  resetUserPassword,
  setUserBalances,
  setUserBanned,
  setUserRole,
  updateUserProfileDetails,
  adminErrorMessage,
} from '@/lib/adminUsers';

const INPUT_CLASS = 'w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500/50';
const LABEL_CLASS = 'text-xs text-slate-400 block mb-1';
const CARD_CLASS = 'bg-slate-800/50 border border-white/10 rounded-xl p-4 space-y-3';

const MIN_PASSWORD_LENGTH = 8;

function toBalanceForm(user: AdminUserRow): BalanceForm {
  return {
    lumora_coins: user.lumora_coins ?? 0,
    withdrawable_coins: user.withdrawable_coins ?? 0,
    bonus_coins: user.bonus_coins ?? 0,
    cash_balance: user.cash_balance ?? 0,
    withdrawable_balance: user.withdrawable_balance ?? 0,
  };
}

function toDetailsForm(user: AdminUserRow): Required<ProfileDetailsPatch> {
  return {
    full_name: user.full_name ?? '',
    phone: user.phone ?? '',
    bio: user.bio ?? '',
    contact_email: user.contact_email ?? '',
    contact_phone: user.contact_phone ?? '',
    address: user.address ?? '',
  };
}

export function AdminUserEditor({ user, onChanged }: { user: AdminUserRow; onChanged: () => void }) {
  const { notify } = useToast();
  const { profile: viewer } = useApp();
  const isSelf = viewer?.id === user.id;

  const [details, setDetails] = useState(() => toDetailsForm(user));
  const [balances, setBalances] = useState<BalanceForm>(() => toBalanceForm(user));
  const [reason, setReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>, successMessage: string) => {
    setBusy(key);
    try {
      await action();
      notify(successMessage, 'success');
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : adminErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = () =>
    run('details', () => updateUserProfileDetails(user.id, details), 'Profile details saved');

  const saveBalances = () => {
    if (reason.trim().length < 3) {
      notify('Add a reason of at least 3 characters for this balance change', 'warning');
      return;
    }
    const values = Object.values(balances);
    if (values.some((v) => !Number.isFinite(v) || v < 0)) {
      notify('Balances must be zero or more', 'warning');
      return;
    }
    run(
      'balances',
      async () => {
        await setUserBalances(user.id, balances, reason.trim());
        setReason('');
      },
      'Balances updated',
    );
  };

  const toggleRole = () => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    run(
      'role',
      () => setUserRole(user.id, nextRole),
      nextRole === 'admin' ? 'User is now an admin' : 'Admin access removed',
    );
  };

  const toggleBanned = () =>
    run(
      'ban',
      () => setUserBanned(user.id, !user.banned),
      user.banned ? 'Account unbanned' : 'Account banned',
    );

  const resetPassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      notify(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('The two passwords do not match', 'warning');
      return;
    }
    await run(
      'password',
      async () => {
        await resetUserPassword(user.id, newPassword);
        setNewPassword('');
        setConfirmPassword('');
      },
      'Password reset. Share the new password with the user securely.',
    );
  };

  const setDetail = (key: keyof ProfileDetailsPatch) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDetails({ ...details, [key]: e.target.value });

  const setBalance = (key: keyof BalanceForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBalances({ ...balances, [key]: Number(e.target.value) });

  return (
    <div className="space-y-4">
      <div className={CARD_CLASS}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Account</p>
          <p className="text-[11px] text-slate-500 break-all text-right">{user.id}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <p className={LABEL_CLASS}>Sign-in email</p>
            <p className="text-slate-200 break-all">{user.email || 'Not available'}</p>
          </div>
          <div>
            <p className={LABEL_CLASS}>Joined</p>
            <p className="text-slate-200">{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <p className="text-sm font-semibold text-white">Profile details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Full name</label>
            <input className={INPUT_CLASS} value={details.full_name} onChange={setDetail('full_name')} maxLength={120} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Sign-in phone</label>
            <input className={INPUT_CLASS} value={details.phone} onChange={setDetail('phone')} maxLength={30} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Public contact email</label>
            <input className={INPUT_CLASS} value={details.contact_email} onChange={setDetail('contact_email')} maxLength={120} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Public contact phone</label>
            <input className={INPUT_CLASS} value={details.contact_phone} onChange={setDetail('contact_phone')} maxLength={30} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Address</label>
            <input className={INPUT_CLASS} value={details.address} onChange={setDetail('address')} maxLength={300} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Bio</label>
            <textarea className={`${INPUT_CLASS} min-h-[72px]`} value={details.bio} onChange={setDetail('bio')} maxLength={280} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveDetails} disabled={busy !== null}>{busy === 'details' ? 'Saving...' : 'Save details'}</Button>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <p className="text-sm font-semibold text-white">Balances</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Lumora coins</label>
            <input type="number" min={0} className={INPUT_CLASS} value={balances.lumora_coins} onChange={setBalance('lumora_coins')} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Withdrawable coins</label>
            <input type="number" min={0} className={INPUT_CLASS} value={balances.withdrawable_coins} onChange={setBalance('withdrawable_coins')} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Bonus coins</label>
            <input type="number" min={0} className={INPUT_CLASS} value={balances.bonus_coins} onChange={setBalance('bonus_coins')} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Cash balance (BDT)</label>
            <input type="number" min={0} className={INPUT_CLASS} value={balances.cash_balance} onChange={setBalance('cash_balance')} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Withdrawable balance (BDT)</label>
            <input type="number" min={0} className={INPUT_CLASS} value={balances.withdrawable_balance} onChange={setBalance('withdrawable_balance')} />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Reason (shown in the user's history)</label>
          <input className={INPUT_CLASS} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Refund for task 4821" />
        </div>
        <div className="flex justify-end">
          <Button onClick={saveBalances} disabled={busy !== null}>{busy === 'balances' ? 'Saving...' : 'Save balances'}</Button>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <p className="text-sm font-semibold text-white">Access</p>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Role: {user.role === 'admin' ? 'Admin' : 'User'}</p>
            <p className="text-xs text-slate-500">{isSelf ? 'This is your own account and cannot be changed here.' : 'Admins can open this panel and manage other accounts.'}</p>
          </div>
          <Button variant="secondary" onClick={toggleRole} disabled={busy !== null || isSelf}>
            {busy === 'role' ? 'Updating...' : user.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Status: {user.banned ? 'Banned' : 'Active'}</p>
            <p className="text-xs text-slate-500">A banned account cannot use the app.</p>
          </div>
          <Button variant={user.banned ? 'secondary' : 'danger'} onClick={toggleBanned} disabled={busy !== null || isSelf}>
            {busy === 'ban' ? 'Updating...' : user.banned ? 'Unban account' : 'Ban account'}
          </Button>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <p className="text-sm font-semibold text-white">Reset password</p>
        <p className="text-xs text-slate-500">Sets a new password for this account. The user will need to sign in with it.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>New password</label>
            <input type="password" autoComplete="new-password" className={INPUT_CLASS} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} maxLength={72} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Confirm password</label>
            <input type="password" autoComplete="new-password" className={INPUT_CLASS} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} maxLength={72} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="danger" onClick={resetPassword} disabled={busy !== null || !newPassword || !confirmPassword}>
            {busy === 'password' ? 'Resetting...' : 'Reset password'}
          </Button>
        </div>
      </div>
    </div>
  );
}
