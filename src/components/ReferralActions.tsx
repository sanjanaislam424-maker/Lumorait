import { useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { useToast } from '@/components/Toast';

export function buildReferralLink(code: string) {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}

export function ReferralActions({ code }: { code: string }) {
  const { lang } = useApp();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  if (!code) return null;

  const link = buildReferralLink(code);
  const shareText = lang === 'bn'
    ? `Lumora IT-তে যোগ দাও! আমার লিঙ্ক দিয়ে সাইন আপ করলে বোনাস পাবে।`
    : `Join Lumora IT and get a signup bonus with my referral link!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      notify(lang === 'bn' ? 'রেফার লিঙ্ক কপি হয়েছে!' : 'Referral link copied!');
    } catch {
      notify(lang === 'bn' ? 'কপি করা যায়নি' : 'Could not copy the link', 'error');
    }
  };

  const shareLink = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: 'Lumora IT', text: shareText, url: link });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      notify(lang === 'bn' ? 'শেয়ার করা যায়নি' : 'Sharing failed', 'error');
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium transition hover:bg-amber-500/20 active:scale-[0.98]"
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        {copied ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'লিঙ্ক কপি' : 'Copy Link')}
      </button>
      <button
        type="button"
        onClick={shareLink}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm font-medium transition hover:bg-green-500/20 active:scale-[0.98]"
      >
        <Share2 size={16} />
        {lang === 'bn' ? 'লিঙ্ক শেয়ার' : 'Share Link'}
      </button>
    </div>
  );
}
