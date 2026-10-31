import { useState } from 'react';
import { Modal } from '@/components/ui';
import { AdminUserActivity } from '@/components/admin/AdminUserActivity';
import { AdminUserContent } from '@/components/admin/AdminUserContent';
import { AdminUserEditor } from '@/components/admin/AdminUserEditor';
import { AdminUserSecurity } from '@/components/admin/AdminUserSecurity';
import { AdminUserRow } from '@/lib/adminUsers';

type Section = 'details' | 'security' | 'activity' | 'content';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'security', label: 'Security' },
  { key: 'activity', label: 'Activity' },
  { key: 'content', label: 'Content' },
];

export function AdminUserDetailModal({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [section, setSection] = useState<Section>('details');

  return (
    <Modal open onClose={onClose} title={user.full_name || user.email || 'User account'}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                section === s.key ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === 'details' && <AdminUserEditor user={user} onChanged={onChanged} />}
        {section === 'security' && <AdminUserSecurity user={user} />}
        {section === 'activity' && <AdminUserActivity userId={user.id} />}
        {section === 'content' && <AdminUserContent userId={user.id} onChanged={onChanged} />}
      </div>
    </Modal>
  );
}
