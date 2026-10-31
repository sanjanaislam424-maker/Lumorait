import { useEffect, useState } from 'react';
import { Link2, Sparkles, X } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  MAX_SKILLS,
  MAX_SKILL_LENGTH,
  SOCIAL_PLATFORMS,
  SocialKey,
  SocialLinks,
  normalizeSocialValue,
} from '@/lib/profileDetails';

export function SkillsAndLinksCard() {
  const { lang, profile, themeConfig, refreshProfile } = useApp();
  const { notify } = useToast();
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [social, setSocial] = useState<Record<SocialKey, string>>({} as Record<SocialKey, string>);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSkills(profile.skills ?? []);
    const links: SocialLinks = profile.social_links ?? {};
    setSocial(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, links[p.key] ?? ''])) as Record<SocialKey, string>);
  }, [profile?.id, profile?.skills, profile?.social_links]);

  if (!profile) return null;

  const isBn = lang === 'bn';

  const addSkill = () => {
    const value = skillInput.trim().replace(/,$/, '').trim();
    if (!value) return;
    if (value.length > MAX_SKILL_LENGTH) {
      notify(isBn ? `একটি দক্ষতা ${MAX_SKILL_LENGTH} অক্ষরের বেশি হতে পারবে না` : `A skill can be at most ${MAX_SKILL_LENGTH} characters`, 'error');
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      notify(isBn ? `সর্বোচ্চ ${MAX_SKILLS}টি দক্ষতা যোগ করা যাবে` : `You can add up to ${MAX_SKILLS} skills`, 'error');
      return;
    }
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, value]);
    setSkillInput('');
  };

  const save = async () => {
    const links: SocialLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const raw = social[platform.key] ?? '';
      if (!raw.trim()) continue;
      const normalized = normalizeSocialValue(platform.key, raw);
      if (!normalized) {
        notify(isBn ? `${platform.label} লিংকটি সঠিক নয়` : `The ${platform.label} link is not valid`, 'error');
        return;
      }
      links[platform.key] = normalized;
    }

    const pendingSkill = skillInput.trim();
    const finalSkills = pendingSkill && skills.length < MAX_SKILLS && !skills.some((s) => s.toLowerCase() === pendingSkill.toLowerCase())
      ? [...skills, pendingSkill.slice(0, MAX_SKILL_LENGTH)]
      : skills;

    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      skills: finalSkills,
      social_links: links,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      notify(isBn ? 'সংরক্ষণ করা যায়নি' : 'Could not save skills and links', 'error');
      return;
    }
    setSkills(finalSkills);
    setSkillInput('');
    await refreshProfile();
    notify(isBn ? 'দক্ষতা ও লিংক সংরক্ষিত হয়েছে' : 'Skills and links saved', 'success');
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} style={{ color: themeConfig.primary }} />
        <h3 className="font-semibold neon-text text-sm">{isBn ? 'দক্ষতা ও সামাজিক লিংক' : 'Skills & social links'}</h3>
      </div>
      <p className="text-xs neon-muted mb-3">
        {isBn ? 'আপনার দক্ষতা ও প্ল্যাটফর্মের লিংক পাবলিক প্রোফাইলে দেখানো হবে।' : 'Your skills and platform links appear on your public profile.'}
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-xs neon-muted block mb-1">
            {isBn ? `দক্ষতা (সর্বোচ্চ ${MAX_SKILLS}টি)` : `Skills (up to ${MAX_SKILLS})`}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-medium">
                {skill}
                <button
                  type="button"
                  aria-label={isBn ? `${skill} সরান` : `Remove ${skill}`}
                  onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                  className="p-0.5 rounded-full hover:bg-white/10 transition"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSkill();
              }
            }}
            onBlur={addSkill}
            maxLength={MAX_SKILL_LENGTH + 1}
            placeholder={isBn ? 'যেমন: ভিডিও এডিটিং, Facebook Ads' : 'e.g. Video editing, Facebook ads'}
            className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50"
          />
          <p className="text-[11px] neon-muted mt-1">{isBn ? 'Enter বা কমা দিয়ে যোগ করুন' : 'Press Enter or comma to add'}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs neon-muted flex items-center gap-1"><Link2 size={12} /> {isBn ? 'সামাজিক লিংক' : 'Social & platform links'}</label>
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform.key}>
              <span className="text-[11px] neon-muted block mb-1">{platform.label}</span>
              <input
                value={social[platform.key] ?? ''}
                onChange={(e) => setSocial((prev) => ({ ...prev, [platform.key]: e.target.value }))}
                placeholder={platform.placeholder}
                className="w-full bg-slate-700 border border-white/10 rounded-xl px-3 py-2.5 neon-text text-sm outline-none focus:border-amber-500/50"
              />
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সংরক্ষণ করুন' : 'Save skills & links')}
        </Button>
      </div>
    </Card>
  );
}
