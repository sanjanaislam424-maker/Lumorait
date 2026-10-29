import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Lightbulb, HelpCircle, MessageSquare, Send } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { ChatWidget } from '@/components/ChatWidget';
import { ChatHistory } from '@/components/ChatHistory';
import { Card } from '@/components/ui';

export function SupportView() {
  const { t, lang } = useApp();
  const [subject, setSubject] = useState('');
  const [selectedType, setSelectedType] = useState<'bug' | 'question' | 'feedback'>('question');
  const [chatStarted, setChatStarted] = useState(false);

  const types = [
    { id: 'bug' as const, icon: <Bug size={20} />, label: lang === 'bn' ? 'বাগ রিপোর্ট' : 'Bug Report', desc: lang === 'bn' ? 'কোনো সমস্যা বা এরর পেয়েছে?' : 'Found an issue or error?' },
    { id: 'question' as const, icon: <HelpCircle size={20} />, label: lang === 'bn' ? 'প্রশ্ন' : 'Question', desc: lang === 'bn' ? 'প্ল্যাটফর্ম নিয়ে জিজ্ঞাসা?' : 'Ask about the platform?' },
    { id: 'feedback' as const, icon: <Lightbulb size={20} />, label: lang === 'bn' ? 'ফিডব্যাক' : 'Feedback', desc: lang === 'bn' ? 'আইডিয়া বা সাজেশন দিতে চাও?' : 'Have an idea or suggestion?' },
  ];

  const fullSubject = `[${types.find((tp) => tp.id === selectedType)?.label}] ${subject}`;

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

      <div className="space-y-3">
        {types.map((tp) => (
          <button
            key={tp.id}
            onClick={() => setSelectedType(tp.id)}
            className="w-full text-left"
          >
            <Card className={`transition ${selectedType === tp.id ? 'border-amber-500/50' : ''}`}
            >
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
      </Card>

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--neon-muted)' }}>
        <MessageSquare size={14} />
        <span>
          {lang === 'bn'
            ? 'AI প্রথমে সাহায্য করবে। দরকার হলে "মানুষের সাথে কথা বলো" বাটনে ট্যাপ করো।'
            : 'AI will help first. Tap "Talk to Human Agent" if you need a real person.'}
        </span>
      </div>

      <ChatHistory />
    </div>
  );
}
