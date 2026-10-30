import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const DELETION_WINDOW_DAYS = 30;

export function DeletionPendingModal() {
  const { profile, refreshProfile, signOut, t } = useApp();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  if (!profile?.deletion_requested_at) return null;

  const daysElapsed = Math.floor((Date.now() - new Date(profile.deletion_requested_at).getTime()) / 86400000);
  const daysLeft = Math.max(0, DELETION_WINDOW_DAYS - daysElapsed);

  const restore = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({ deletion_requested_at: null }).eq('id', profile.id);
      if (error) { notify(error.message, 'error'); return; }
      await refreshProfile();
      notify(t('deletionCancelSuccess'), 'success');
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={() => {}} title={t('restoreAccountTitle')}>
      <p className="text-sm neon-muted mb-2">{t('restoreAccountBody')}</p>
      <p className="text-xs neon-muted mb-5">{t('deletionRequested')} {daysLeft} {t('daysLeft')}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" onClick={restore} disabled={busy}>{t('restoreAccountBtn')}</Button>
        <Button variant="ghost" className="flex-1" onClick={signOut} disabled={busy}>{t('staySignedOutBtn')}</Button>
      </div>
    </Modal>
  );
}
