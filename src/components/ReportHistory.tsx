import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Bug, Lightbulb, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface ReportRow {
  id: string;
  type: 'bug' | 'feedback';
  subject: string | null;
  description: string;
  image_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export function ReportHistory({ onBack }: { onBack?: () => void }) {
  const { lang } = useApp();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) return;
      const { data } = await supabase
        .from('support_reports')
        .select('*')
        .eq('user_id', profile.user.id)
        .order('created_at', { ascending: false });
      setReports((data as ReportRow[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-amber-400 transition flex items-center gap-1"
        >
          <ChevronLeft size={16} />
          {lang === 'bn' ? 'ফিরে যাও' : 'Back'}
        </button>
      )}

      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--neon-text)' }}>
          {lang === 'bn' ? 'রিপোর্ট হিস্টোরি' : 'Report History'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
          {lang === 'bn' ? 'তোমার জমা দেওয়া সব বাগ রিপোর্ট ও ফিডব্যাক' : 'All your submitted bug reports and feedback'}
        </p>
      </div>

      {loading ? (
        <Card className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
            {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
          </p>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
            {lang === 'bn' ? 'কোনো রিপোর্ট নেই' : 'No reports yet'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: r.type === 'bug' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: r.type === 'bug' ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {r.type === 'bug' ? <Bug size={18} /> : <Lightbulb size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--neon-text)' }}>
                        {r.subject || (r.type === 'bug' ? (lang === 'bn' ? 'বাগ রিপোর্ট' : 'Bug Report') : (lang === 'bn' ? 'ফিডব্যাক' : 'Feedback'))}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--neon-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        r.status === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {r.status === 'resolved' ? (
                        <span className="flex items-center gap-1"><CheckCircle2 size={10} /> {lang === 'bn' ? 'সমাধান' : 'Resolved'}</span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock size={10} /> {lang === 'bn' ? 'অপেক্ষমাণ' : 'Pending'}</span>
                      )}
                    </span>
                  </div>
                </button>

                {expanded === r.id && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--neon-border)' }}>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--neon-text)' }}>
                      {r.description}
                    </p>
                    {r.image_url && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--neon-muted)' }}>
                          <ImageIcon size={12} />
                          {lang === 'bn' ? 'স্ক্রিনশট' : 'Screenshot'}
                        </div>
                        <img
                          src={r.image_url}
                          alt="Screenshot"
                          className="rounded-xl max-h-48 object-cover border"
                          style={{ borderColor: 'var(--neon-border)' }}
                        />
                      </div>
                    )}
                    {r.admin_note && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs font-bold mb-1" style={{ color: '#f59e0b' }}>
                          {lang === 'bn' ? 'অ্যাডমিন নোট:' : 'Admin note:'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--neon-text)' }}>{r.admin_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
