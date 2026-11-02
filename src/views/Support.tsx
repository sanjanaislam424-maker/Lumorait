import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Lightbulb, HelpCircle, MessageSquare, Send, ImagePlus, X, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { ChatWidget } from '@/components/ChatWidget';
import { ChatHistory } from '@/components/ChatHistory';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { ReportHistory } from '@/components/ReportHistory';

export function SupportView() {
  const { t, lang, profile } = useApp();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'bug' | 'question' | 'feedback'>('question');
  const [chatStarted, setChatStarted] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const types = [
    { id: 'bug' as const, icon: <Bug size={20} />, label: lang === 'bn' ? 'বাগ রিপোর্ট' : 'Bug Report', desc: lang === 'bn' ? 'কোনো সমস্যা বা এরর পেয়েছে?' : 'Found an issue or error?' },
    { id: 'question' as const, icon: <HelpCircle size={20} />, label: lang === 'bn' ? 'প্রশ্ন' : 'Question', desc: lang === 'bn' ? 'প্ল্যাটফর্ম নিয়ে জিজ্ঞাসা?' : 'Ask about the platform?' },
    { id: 'feedback' as const, icon: <Lightbulb size={20} />, label: lang === 'bn' ? 'ফিডব্যাক' : 'Feedback', desc: lang === 'bn' ? 'আইডিয়া বা সাজেশন দিতে চাও?' : 'Have an idea or suggestion?' },
  ];

  const fullSubject = `[${types.find((tp) => tp.id === selectedType)?.label}] ${subject}`;
  const isQuestion = selectedType === 'question';
  const showScreenshot = !isQuestion;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `support/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('support-screenshots')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('support-screenshots').getPublicUrl(fileName);
      setAttachmentUrl(data.publicUrl);
    } catch {
      // ignore upload errors silently
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachmentUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitReport = async () => {
    if (!profile) return;
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_reports').insert({
        user_id: profile.id,
        type: selectedType as 'bug' | 'feedback',
        subject: subject.trim() || null,
        description: description.trim(),
        image_url: attachmentUrl || null,
        status: 'pending',
      });
      if (error) throw error;
      setSubmitted(true);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setDescription('');
    setSubject('');
    setAttachmentUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- Question mode: AI chat ----
  if (chatStarted) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setChatStarted(false)}
          className="text-sm text-slate-400 hover:text-amber-400 transition"
        >
          ← {lang === 'bn' ? 'ফিরে যাও' : 'Back'}
        </button>
        <ChatWidget supportMode subject={fullSubject} />
      </div>
    );
  }

  // ---- Report History view ----
  if (showHistory) {
    return <ReportHistory onBack={() => setShowHistory(false)} />;
  }

  // ---- Success screen after bug/feedback submission ----
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-10">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
          >
            <CheckCircle2 size={36} className="text-emerald-400" />
          </motion.div>
          <h3 className="text-lg font-bold neon-text mb-2">
            {lang === 'bn' ? 'অ্যাডমিন প্যানেলে সফলভাবে পাঠানো হয়েছে!' : 'Successfully sent to the admin panel!'}
          </h3>
          <p className="text-sm neon-muted mb-6">
            {lang === 'bn'
              ? 'আমাদের টিম শীঘ্রই আপনার রিপোর্ট পর্যালোচনা করবে।'
              : 'Our team will review your report shortly.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition"
              style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))', color: '#fff' }}
            >
              {lang === 'bn' ? 'আরেকটি পাঠাও' : 'Send another'}
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition border"
              style={{ borderColor: 'var(--neon-border)', color: 'var(--neon-text)' }}
            >
              {lang === 'bn' ? 'রিপোর্ট হিস্টোরি' : 'Report history'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- Main form ----
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--neon-text)' }}>
          {lang === 'bn' ? 'সাপোর্ট ও রিপোর্ট' : 'Support & Report'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--neon-muted)' }}>
          {lang === 'bn'
            ? 'আমাদের AI অ্যাসিস্ট্যান্ট তোমার সাহায্যে প্রস্তুত! নিচে তোমার সমস্যার ধরন বেছে নাও।'
            : 'Our AI assistant is ready to help! Select your issue type below.'}
        </p>
      </motion.div>

      {/* Type selector */}
      <div className="space-y-3">
        {types.map((tp) => (
          <button
            key={tp.id}
            onClick={() => setSelectedType(tp.id)}
            className="w-full text-left"
          >
            <Card className={`transition ${selectedType === tp.id ? 'border-amber-500/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: selectedType === tp.id
                      ? 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))'
                      : 'var(--neon-card-bg)',
                    color: selectedType === tp.id ? '#fff' : 'var(--neon-primary)',
                  }}
                >
                  {tp.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--neon-text)' }}>{tp.label}</p>
                  <p className="text-xs" style={{ color: 'var(--neon-muted)' }}>{tp.desc}</p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: selectedType === tp.id ? 'var(--neon-primary)' : 'var(--neon-border)',
                    background: selectedType === tp.id ? 'var(--neon-primary)' : 'transparent',
                  }}
                >
                  {selectedType === tp.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {/* Question → AI chat start button */}
      {isQuestion ? (
        <Card>
          <label className="text-xs block mb-2" style={{ color: 'var(--neon-muted)' }}>
            {lang === 'bn' ? 'বিষয় (ঐচ্ছিক)' : 'Subject (optional)'}
          </label>
          <div className="flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={lang === 'bn' ? 'সংক্ষেপে কী নিয়ে কথা বলতে চাও?' : 'Briefly, what do you want to discuss?'}
              className="flex-1 bg-slate-800 border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--neon-border)', color: 'var(--neon-text)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') setChatStarted(true); }}
            />
            <button
              onClick={() => setChatStarted(true)}
              className="px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))', color: '#fff' }}
            >
              <Send size={16} />
              {lang === 'bn' ? 'শুরু করো' : 'Start'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs mt-3" style={{ color: 'var(--neon-muted)' }}>
            <MessageSquare size={14} />
            <span>
              {lang === 'bn'
                ? 'AI সহকারী সরাসরি উত্তর দেবে।'
                : 'The AI assistant will answer directly.'}
            </span>
          </div>
        </Card>
      ) : (
        /* Bug / Feedback → submit to admin panel */
        <Card>
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-2" style={{ color: 'var(--neon-muted)' }}>
                {lang === 'bn' ? 'বিষয় (ঐচ্ছিক)' : 'Subject (optional)'}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={lang === 'bn' ? 'সংক্ষেপে কী নিয়ে?' : 'Briefly, what is this about?'}
                className="w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--neon-border)', color: 'var(--neon-text)' }}
              />
            </div>
            <div>
              <label className="text-xs block mb-2" style={{ color: 'var(--neon-muted)' }}>
                {lang === 'bn' ? 'বিস্তারিত' : 'Description'} *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={lang === 'bn' ? 'বিস্তারিত লেখো...' : 'Describe in detail...'}
                rows={4}
                className="w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--neon-border)', color: 'var(--neon-text)' }}
              />
            </div>

            {/* Screenshot upload */}
            {showScreenshot && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  className="hidden"
                />
                {!attachmentUrl && !uploading && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition border-dashed border"
                    style={{
                      borderColor: 'var(--neon-border)',
                      color: 'var(--neon-muted)',
                      background: 'var(--neon-card-bg)',
                    }}
                  >
                    <ImagePlus size={14} />
                    {lang === 'bn' ? 'স্ক্রিনশট যোগ করো (ঐচ্ছিক)' : 'Add screenshot (optional)'}
                  </button>
                )}
                {uploading && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ color: 'var(--neon-muted)' }}>
                    <Loader2 size={14} className="animate-spin" />
                    {lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...'}
                  </div>
                )}
                {attachmentUrl && (
                  <div className="relative inline-block">
                    <img
                      src={attachmentUrl}
                      alt="Screenshot preview"
                      className="rounded-xl max-h-32 object-cover border"
                      style={{ borderColor: 'var(--neon-border)' }}
                    />
                    <button
                      onClick={removeAttachment}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition"
                      title={lang === 'bn' ? 'সরাও' : 'Remove'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={submitReport}
              disabled={submitting || !description.trim()}
              className="w-full px-5 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--neon-primary), var(--neon-secondary))', color: '#fff' }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {lang === 'bn' ? 'অ্যাডমিনে পাঠাও' : 'Send to Admin'}
            </button>
          </div>
        </Card>
      )}

      {/* Report history button */}
      <button
        onClick={() => setShowHistory(true)}
        className="flex items-center gap-2 text-sm transition"
        style={{ color: 'var(--neon-muted)' }}
      >
        <ChevronLeft size={16} className="rotate-180" />
        {lang === 'bn' ? 'আমার রিপোর্ট হিস্টোরি' : 'My report history'}
      </button>

      <ChatHistory />
    </div>
  );
}
