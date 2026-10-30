import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, PanInfo } from 'framer-motion';
import { Phone, Lock, User as UserIcon, Eye, EyeOff, Hand, Check, X, Ticket, KeyRound, Mail, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';
import { useToast } from '@/components/Toast';
import { Logo } from '@/components/Logo';

export function AuthScreen() {
  const { t, lang, setLang, logoUrl } = useApp();
  const { notify } = useToast();
  const [lit, setLit] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const isEmail = phone.includes('@');
  const email = isEmail ? phone.trim() : `${phone.replace(/\D/g, '')}@lumora.app`;

  const pwdChecks = useMemo(() => {
    const minLen = password.length >= 6;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    return { minLen, hasNumber, hasSpecial };
  }, [password]);
  const pwdValid = pwdChecks.minLen && pwdChecks.hasNumber && pwdChecks.hasSpecial;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!acceptTerms && mode === 'signup') {
      notify(t('termsToast'), 'error');
      return;
    }
    if (!isEmail && phone.replace(/\D/g, '').length < 10) {
      setError(lang === 'bn' ? 'সঠিক ফোন নাম্বার দাও' : 'Enter a valid phone number');
      return;
    }
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phone.trim())) {
      setError(lang === 'bn' ? 'সঠিক ইমেইল দাও' : 'Enter a valid email');
      return;
    }
    setBusy(true);
    try {
      let referrerId: string | null = null;
      if (mode === 'signup' && referralCode.trim()) {
        const { data: refProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode.trim().toUpperCase())
          .maybeSingle();
        if (!refProfile) {
          setError(t('referralInvalid'));
          setBusy(false);
          return;
        }
        referrerId = refProfile.id;
      }
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { phone, full_name: name, referred_by: referrerId } } });
        if (err) throw err;
        if (data.user && referrerId) {
          const { data: settings } = await supabase.from('app_settings').select('referral_bonus, referee_bonus').eq('id', 1).maybeSingle();
          const refBonus = settings?.referral_bonus ?? 500;
          const refereeBonus = settings?.referee_bonus ?? 200;
          await supabase.from('profiles').update({ referred_by: referrerId, lumora_coins: refereeBonus, referral_earned: refereeBonus }).eq('id', data.user.id);
          await supabase.from('transactions').insert({ user_id: data.user.id, type: 'referral_signup', amount: refereeBonus, status: 'completed', note: 'Referral signup bonus' });
          const { data: refProf } = await supabase.from('profiles').select('lumora_coins, referral_earned').eq('id', referrerId).maybeSingle();
          if (refProf) {
            await supabase.from('profiles').update({ lumora_coins: refProf.lumora_coins + refBonus, referral_earned: refProf.referral_earned + refBonus }).eq('id', referrerId);
            await supabase.from('transactions').insert({ user_id: referrerId, type: 'referral_signup', amount: refBonus, status: 'completed', note: 'Referral signup bonus' });
          }
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (/weak.*password|password.*weak|password.*strength/i.test(msg)) {
        notify(t('pwdWeakToast'), 'error');
      }
      setError(err.message || (lang === 'bn' ? 'কিছু সমস্যা হয়েছে' : 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const toggleLight = useCallback(() => {
    playClick();
    setLit((v) => !v);
  }, []);

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{
        perspective: '1200px',
      }}
    >
      {/* Background wall logo — always rendered, opacity driven by light toggle */}
      <div
        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none transition-all duration-700 ease-in-out"
        style={{ opacity: lit ? 1 : 0 }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="rounded-3xl object-cover transition-all duration-700 ease-in-out"
            style={{
              width: 384,
              height: 384,
              opacity: lit ? 0.2 : 0,
              filter: 'blur(12px) saturate(1.3)',
              transition: 'opacity 700ms ease-in-out, filter 700ms ease-in-out',
              boxShadow: '0 0 25px rgba(251,191,36,0.3), 0 0 80px rgba(251,191,36,0.15)',
            }}
          />
        ) : (
          <div
            className="rounded-3xl flex items-center justify-center font-bold transition-all duration-700 ease-in-out"
            style={{
              width: 384,
              height: 384,
              fontSize: 160,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              opacity: lit ? 0.2 : 0,
              filter: 'blur(12px) saturate(1.3)',
              transition: 'opacity 700ms ease-in-out, filter 700ms ease-in-out',
              boxShadow: '0 0 25px rgba(251,191,36,0.3), 0 0 80px rgba(251,191,36,0.15)',
              color: '#0a0301',
            }}
          >
            L
          </div>
        )}
      </div>

      {/* Animated room illumination layer — warm indoor light when on */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-700 ease-in-out"
        style={{
          opacity: lit ? 1 : 0,
          background: 'radial-gradient(ellipse at 50% 12%, rgba(251,191,36,0.20) 0%, rgba(15,23,42,0.95) 45%, rgba(2,6,23,1) 100%)',
          transition: 'opacity 700ms ease-in-out',
        }}
      />
      {/* Dark room baseline — visible when light is off */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-700 ease-in-out"
        style={{
          opacity: lit ? 0 : 1,
          background: 'linear-gradient(180deg, #020617 0%, #080d1a 50%, #020617 100%)',
          transition: 'opacity 700ms ease-in-out',
        }}
      />
      {/* Ambient volumetric glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-700 ease-in-out"
        style={{
          width: 800,
          height: 700,
          background: 'radial-gradient(ellipse, rgba(251,191,36,0.16) 0%, rgba(251,140,0,0.06) 30%, transparent 65%)',
          filter: 'blur(24px)',
          opacity: lit ? 1 : 0,
          transform: `translateX(-50%) scale(${lit ? 1 : 0.25})`,
          transition: 'opacity 700ms ease-in-out, transform 700ms ease-in-out',
        }}
      />

      {/* Dust motes in light beam */}
      <AnimatePresence>
        {lit && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ width: 300, height: 600 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${20 + i * 4}%`,
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  background: 'rgba(251,191,36,0.3)',
                  boxShadow: '0 0 4px rgba(251,191,36,0.4)',
                }}
                animate={{
                  y: [0, 400 + (i % 3) * 50],
                  x: [0, (i % 2 ? 1 : -1) * 30],
                  opacity: [0, 0.6, 0],
                }}
                transition={{ duration: 6 + (i % 4), repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating language toggle */}
      <motion.button
        onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
        whileTap={{ scale: 0.9 }}
        className="absolute top-5 right-5 z-40 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl text-sm font-medium transition-colors hover:bg-white/15"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(251,191,36,0.25)',
          boxShadow: lit ? '0 4px 20px rgba(251,191,36,0.15)' : 'none',
        }}
      >
        <span className={lang === 'bn' ? 'text-amber-400' : 'text-slate-500'}>বাংলা</span>
        <span className="text-slate-600">/</span>
        <span className={lang === 'en' ? 'text-amber-400' : 'text-slate-500'}>EN</span>
      </motion.button>

      {/* 3D Chandelier + pull cord */}
      <Chandelier3D lit={lit} onToggle={toggleLight} />

      {/* Main content */}
      <div className="relative z-20 w-full max-w-md flex flex-col items-center">
        {/* 3D Mascot */}
        <AnimatePresence>
          {lit && (
            <Mascot3D
              phoneFocused={phoneFocused}
              pwdFocused={pwdFocused}
              showPwd={showPwd}
              phoneValue={phone}
            />
          )}
        </AnimatePresence>

        {/* 3D Glassmorphic login card with tilt */}
        <AnimatePresence>
          {lit && (
            <GlassCard3D>
              {/* Welcome micro-copy */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center mb-5"
              >
                <div className="flex justify-center mb-3">
                  <Logo size={56} rounded="rounded-2xl" />
                </div>
                <h1
                  className="text-3xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fb923c)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 2px 8px rgba(251,191,36,0.3))',
                  }}
                >
                  Lumora IT
                </h1>
                <motion.p
                  key={lang}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-amber-200/80 mt-2 text-sm font-medium px-2"
                >
                  {t('lightOnWelcome')}
                </motion.p>
              </motion.div>

              {/* Tab switcher */}
              <div
                className="flex gap-2 mb-6 rounded-xl p-1"
                style={{ background: 'rgba(8,12,24,0.7)', border: '1px solid rgba(251,191,36,0.1)' }}
              >
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="relative flex-1 py-2 rounded-lg text-sm font-medium transition"
                    style={{
                      background: mode === m ? 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(245,158,11,0.9))' : 'transparent',
                      color: mode === m ? '#0a0301' : '#94a3b8',
                      boxShadow: mode === m ? '0 4px 15px rgba(251,191,36,0.3)' : 'none',
                    }}
                  >
                    {t(m)}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === 'signup' && (
                  <Field3D icon={<UserIcon size={18} />}>
                    <input className="w-full bg-transparent outline-none text-white placeholder-slate-500" placeholder={t('fullName')} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field3D>
                )}
                <Field3D icon={isEmail ? <Mail size={18} /> : <Phone size={18} />} focused={phoneFocused}>
                  <input
                    className="w-full bg-transparent outline-none text-white placeholder-slate-500"
                    placeholder={t('enterPhoneOrEmail')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                  />
                </Field3D>
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300"
                  style={{
                    background: pwdFocused ? 'rgba(251,191,36,0.08)' : 'rgba(8,12,24,0.6)',
                    border: `1px solid ${pwdFocused ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: pwdFocused ? '0 0 15px rgba(251,191,36,0.1), inset 0 0 10px rgba(251,191,36,0.03)' : 'none',
                  }}
                >
                  <span className="text-slate-400"><Lock size={18} /></span>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="w-full bg-transparent outline-none text-white placeholder-slate-500"
                    placeholder={t('enterPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password checklist — signup only */}
                {mode === 'signup' && (
                  <PasswordChecklist checks={pwdChecks} lang={lang} t={t} />
                )}

                {/* Referral code — signup only */}
                {mode === 'signup' && (
                  <Field3D icon={<Ticket size={18} />}>
                    <input
                      className="w-full bg-transparent outline-none text-white placeholder-slate-500"
                      placeholder={t('referralPlaceholder')}
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                    />
                  </Field3D>
                )}

                {/* Mandatory Terms & Conditions checkbox — signup only */}
                {mode === 'signup' && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setAcceptTerms((v) => !v)}
                    className="mt-0.5 shrink-0 rounded-md flex items-center justify-center transition-colors"
                    style={{
                      width: 18,
                      height: 18,
                      background: acceptTerms ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'rgba(8,12,24,0.6)',
                      border: `1px solid ${acceptTerms ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: acceptTerms ? '0 0 8px rgba(251,191,36,0.3)' : 'none',
                    }}
                  >
                    {acceptTerms && <Check size={12} className="text-slate-900" strokeWidth={3} />}
                  </button>
                  <span className="text-xs text-slate-300 leading-relaxed">
                    {t('acceptTerms')}{' '}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                    >
                      {t('termsLink')}
                    </button>
                    {lang === 'bn' ? ' মেনে নিচ্ছি' : ''}
                  </span>
                </label>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                {mode === 'login' && (
                  <button type="button" onClick={() => setResetOpen(true)} className="text-amber-400/70 hover:text-amber-400 text-xs flex items-center gap-1 transition-colors">
                    <KeyRound size={12} /> {t('forgotPassword')}
                  </button>
                )}

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={busy || (mode === 'signup' && !pwdValid) || (mode === 'signup' && !acceptTerms) || phone.replace(/\D/g, '').length < 10}
                  className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300"
                  style={{
                    background: (mode === 'login' || (pwdValid && acceptTerms)) && phone.replace(/\D/g, '').length >= 10
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : 'rgba(30,41,59,0.6)',
                    color: (mode === 'login' || (pwdValid && acceptTerms)) && phone.replace(/\D/g, '').length >= 10 ? '#0a0301' : '#64748b',
                    boxShadow: (mode === 'login' || (pwdValid && acceptTerms)) && phone.replace(/\D/g, '').length >= 10
                      ? '0 8px 25px rgba(251,191,36,0.3), 0 0 20px rgba(251,191,36,0.15)'
                      : 'none',
                  }}
                >
                  {busy ? '...' : mode === 'login' ? t('login') : t('signup')}
                </motion.button>
              </form>

                {/* Social auth buttons */}
                <div className="pt-2">
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <span className="text-slate-500 text-xs">{lang === 'bn' ? 'অথবা' : 'or'}</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div className="flex flex-col gap-2.5 mt-3">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={() => notify(t('socialError'), 'info')}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        color: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {t('continueGoogle')}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={() => notify(t('socialError'), 'info')}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium transition-all duration-200"
                      style={{
                        background: '#1877F2',
                        color: '#ffffff',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
                      </svg>
                      {t('continueFacebook')}
                    </motion.button>
                  </div>
                </div>
            </GlassCard3D>
          )}
        </AnimatePresence>
      </div>

      {/* Pre-light hint */}
      <AnimatePresence>
        {!lit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.6 }}
            className="absolute bottom-14 left-0 right-0 text-center z-10"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="inline-flex flex-col items-center gap-2">
              <Hand size={24} className="text-amber-400/50" />
              <p className="text-slate-400 text-sm">{t('pullTheCord')}</p>
              <p className="text-slate-600 text-xs">{t('lightOnHint')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ResetPasswordModal open={resetOpen} onClose={() => setResetOpen(false)} />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col"
            style={{
              background: 'rgba(15,20,35,0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(251,191,36,0.2)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
                <FileText size={20} /> {t('termsTitle')}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto text-sm text-slate-300 leading-relaxed space-y-3 pr-1">
              <p>{t('termsBody')}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-xl font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                color: '#0a0301',
                boxShadow: '0 8px 25px rgba(251,191,36,0.3)',
              }}
            >
              {t('termsClose')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ResetPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useApp();
  const { notify } = useToast();
  const [resetPhone, setResetPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = resetPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      notify(lang === 'bn' ? 'সঠিক ফোন নাম্বার দাও' : 'Enter a valid phone number', 'error');
      return;
    }
    setBusy(true);
    try {
      const resetEmail = `${digits}@lumora.app`;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .like('phone', `%${digits}%`)
        .limit(1)
        .maybeSingle();

      if (!data) {
        notify(t('accountNotFound'), 'error');
        setBusy(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });

      if (resetError) throw resetError;
      notify(t('resetSent'), 'success');
      setResetPhone('');
      onClose();
    } catch {
      notify(t('accountNotFound'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative rounded-2xl p-6 w-full max-w-md"
            style={{
              background: 'rgba(15,20,35,0.9)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(251,191,36,0.2)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
                <KeyRound size={20} /> {t('resetPassword')}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(8,12,24,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Phone size={18} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none text-white placeholder-slate-500"
                  placeholder={t('resetPhone')}
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value)}
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-semibold transition-all"
                style={{
                  background: busy ? 'rgba(30,41,59,0.6)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  color: busy ? '#64748b' : '#0a0301',
                  boxShadow: busy ? 'none' : '0 8px 25px rgba(251,191,36,0.3)',
                }}
              >
                {busy ? t('resetBusy') : t('resetSend')}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============== 3D GLASSMORPHIC CARD WITH TILT ============== */

function GlassCard3D({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotX = useSpring(useMotionValue(0), { stiffness: 150, damping: 20 });
  const rotY = useSpring(useMotionValue(0), { stiffness: 150, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowLeft = useTransform(glowX, (v) => `${v}%`);
  const glowTop = useTransform(glowY, (v) => `${v}%`);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotY.set((px - 0.5) * 8);
    rotX.set((0.5 - py) * 8);
    glowX.set(px * 100);
    glowY.set(py * 100);
  };

  const handleMouseLeave = () => {
    rotX.set(0);
    rotY.set(0);
    glowX.set(50);
    glowY.set(50);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.92, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      exit={{ opacity: 0, y: 60, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.25 }}
      style={{ transformStyle: 'preserve-3d', rotateX: rotX, rotateY: rotY, perspective: 1000 }}
      className="w-full"
    >
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative rounded-3xl p-6 overflow-hidden backdrop-blur-xl bg-white/10 dark:bg-black/25"
        style={{
          border: '1px solid rgba(251,191,36,0.18)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 30px rgba(251,191,36,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Cursor-following spotlight glow */}
        <motion.div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 300,
            height: 300,
            left: glowLeft,
            top: glowTop,
            x: '-50%',
            y: '-50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 60%)',
          }}
        />

        {/* Top metallic shimmer line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)' }}
        />

        {children}
      </div>
    </motion.div>
  );
}

/* ============== 3D REALISTIC CHANDELIER ============== */

function Chandelier3D({ lit, onToggle }: { lit: boolean; onToggle: () => void }) {
  const dragY = useMotionValue(0);
  const springY = useSpring(dragY, { stiffness: 120, damping: 14, mass: 1.5 });
  const [pulling, setPulling] = useState(false);
  const cordRef = useRef<HTMLDivElement>(null);

  const sway = useSpring(0, { stiffness: 40, damping: 5, mass: 4 });
  useEffect(() => {
    if (!pulling) {
      let dir = 1;
      const iv = setInterval(() => {
        dir *= -1;
        sway.set(dir * 2);
      }, 3500);
      return () => clearInterval(iv);
    }
  }, [pulling, sway]);

  const fixtureX = useTransform([springY, sway], ([dy, sw]: number[]) => sw + dy * 0.08);
  const fixtureRotate = useTransform([springY, sway], ([dy, sw]: number[]) => sw + dy * 0.025);

  const handleDragEnd = (_: any, info: PanInfo) => {
    setPulling(false);
    if (Math.abs(info.offset.y) > 40 || Math.abs(info.velocity.y) > 250) {
      dragY.set(0);
      onToggle();
    } else {
      dragY.set(0);
    }
  };

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none" style={{ height: 320, perspective: '800px' }}>
      {/* Ceiling mounting plate — 3D metallic */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: 90,
          height: 6,
          background: 'linear-gradient(180deg, #475569 0%, #1e293b 50%, #0f172a 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 rounded-b-lg"
        style={{
          width: 60,
          height: 12,
          background: 'linear-gradient(180deg, #64748b 0%, #334155 60%, #1e293b 100%)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      />

      {/* Swinging unit */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2"
        style={{ x: fixtureX, rotate: fixtureRotate, originY: 0, transformStyle: 'preserve-3d' }}
      >
        {/* Chain — multi-segment for 3D depth */}
        <div className="flex flex-col items-center" style={{ gap: 0 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 6 - i * 0.3,
                height: 10,
                background: `linear-gradient(135deg, #64748b 0%, #334155 50%, #1e293b 100%)`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                marginTop: -1,
              }}
            />
          ))}
        </div>

        {/* Chandelier body — 3D metallic fixture */}
        <div className="relative flex flex-col items-center" style={{ transformStyle: 'preserve-3d' }}>
          {/* Top canopy */}
          <div
            className="rounded-t-xl"
            style={{
              width: 52,
              height: 18,
              background: 'linear-gradient(180deg, #92400e 0%, #78350f 50%, #451a03 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.2)',
              border: '1px solid rgba(251,191,36,0.15)',
            }}
          />
          {/* Mid band — polished brass */}
          <div
            className="rounded-full"
            style={{
              width: 68,
              height: 8,
              background: 'linear-gradient(180deg, #b45309 0%, #92400e 40%, #78350f 100%)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(251,191,36,0.3)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          />

          {/* Arm ring — decorative 3D arms */}
          <div className="relative my-1" style={{ width: 80, height: 20 }}>
            {[0, 120, 240].map((angle) => (
              <div
                key={angle}
                className="absolute top-1/2 left-1/2 origin-center"
                style={{
                  width: 38,
                  height: 3,
                  background: 'linear-gradient(90deg, #92400e, #b45309, #78350f)',
                  borderRadius: '2px',
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              >
                <div
                  className="absolute rounded-full"
                  style={{
                    right: -3, top: -3, width: 9, height: 9,
                    background: 'radial-gradient(circle at 30% 30%, #fde68a, #fbbf24 40%, #92400e 100%)',
                    boxShadow: lit ? '0 0 12px rgba(251,191,36,0.6)' : '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Central bulb housing */}
          <div
            className="rounded-full"
            style={{
              width: 28,
              height: 8,
              background: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          />

          {/* Main bulb — 3D glass */}
          <Bulb3D lit={lit} />

          {/* Pull cord — physically weighted */}
          <motion.div
            ref={cordRef}
            className="absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing touch-none pointer-events-auto"
            style={{ y: dragY, originY: 0, top: 35 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 120 }}
            dragElastic={0.15 }
            onDragStart={() => setPulling(true)}
            onDragEnd={handleDragEnd}
            onClick={() => { if (!pulling) onToggle(); }}
          >
            {/* Beaded chain cord */}
            <div className="flex flex-col items-center" style={{ gap: 0 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 4, height: 7, marginTop: -1,
                    background: 'linear-gradient(135deg, #64748b, #334155, #1e293b)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                  }}
                />
              ))}
            </div>

            {/* Pull knob — 3D metallic bead */}
            <motion.div
              className="relative mt-0 rounded-full flex items-center justify-center"
              style={{
                width: 28, height: 28,
                background: 'radial-gradient(circle at 30% 25%, #fde68a 0%, #fbbf24 30%, #d97706 60%, #78350f 100%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(251,191,36,0.2), inset 0 2px 4px rgba(255,255,255,0.2)',
                border: '1px solid rgba(251,191,36,0.3)',
              }}
              animate={{ scale: pulling ? 1.15 : 1 }}
              whileHover={{ scale: 1.08 }}
            >
              <span className="rounded-full" style={{ width: 6, height: 6, background: 'rgba(254,243,199,0.4)' }} />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Dynamic drop shadow on floor */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
        style={{
          bottom: -20,
          width: 100,
          height: 20,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
        animate={{ opacity: lit ? 0.5 : 0.3, scale: lit ? 1.1 : 0.9 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      />
    </div>
  );
}

/* ============== 3D REALISTIC BULB ============== */

function Bulb3D({ lit }: { lit: boolean }) {
  return (
    <div className="relative" style={{ marginTop: 2 }}>
      {/* Volumetric light cone when lit */}
      <AnimatePresence>
        {lit && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              top: 20,
              width: 0,
              height: 0,
              borderLeft: '80px solid transparent',
              borderRight: '80px solid transparent',
              borderTop: '300px solid rgba(251,191,36,0.04)',
              filter: 'blur(15px)',
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          />
        )}
      </AnimatePresence>

      {/* Glow halo — spring-smoothed ease-in-out expansion */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(251,140,0,0.1) 30%, transparent 60%)',
        }}
        animate={{ opacity: lit ? 1 : 0, scale: lit ? 1 : 0.2 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      />

      {/* Light rays */}
      <AnimatePresence>
        {lit && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 1, height: 14,
                  left: 0, top: -85,
                  transformOrigin: 'bottom center',
                  rotate: i * 45,
                  background: 'linear-gradient(180deg, rgba(251,191,36,0.4), transparent)',
                }}
                animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Glass bulb SVG with gradients */}
      <motion.div animate={{ scale: lit ? 1.05 : 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
        <svg width="70" height="90" viewBox="0 0 70 90" fill="none">
          <defs>
            <radialGradient id="bulbGlass3d" cx="0.35" cy="0.3" r="0.7">
              <stop offset="0%" stopColor={lit ? '#fffbeb' : '#1e293b'} />
              <stop offset="30%" stopColor={lit ? '#fde68a' : '#1e293b'} />
              <stop offset="70%" stopColor={lit ? '#fbbf24' : '#0f172a'} />
              <stop offset="100%" stopColor={lit ? '#d97706' : '#020617'} />
            </radialGradient>
            <radialGradient id="bulbHighlight3d" cx="0.25" cy="0.2" r="0.3">
              <stop offset="0%" stopColor="white" stopOpacity={lit ? 0.6 : 0.1} />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bulbBase3d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* Screw base */}
          <rect x="25" y="54" width="20" height="4" rx="1" fill="url(#bulbBase3d)" />
          <rect x="24" y="59" width="22" height="4" rx="1" fill="#1e293b" />
          <rect x="23" y="64" width="24" height="6" rx="2" fill="#0f172a" />
          <rect x="22" y="70" width="26" height="4" rx="2" fill="#020617" />

          {/* Glass dome — 3D gradient */}
          <ellipse
            cx="35" cy="32" rx="28" ry="30"
            fill="url(#bulbGlass3d)"
            stroke={lit ? 'rgba(251,191,36,0.6)' : 'rgba(51,65,85,0.5)'}
            strokeWidth="1"
            style={{ filter: lit ? 'drop-shadow(0 0 8px rgba(251,191,36,0.4))' : 'none' }}
          />

          {/* Glass highlight reflection */}
          <ellipse cx="25" cy="22" rx="10" ry="14" fill="url(#bulbHighlight3d)" />

          {/* Filament */}
          <motion.path
            d="M 24 30 Q 30 18 35 30 Q 40 42 46 30"
            stroke={lit ? '#f59e0b' : '#475569'}
            strokeWidth="1.5"
            fill="none"
            animate={{ stroke: lit ? '#f59e0b' : '#475569' }}
            transition={{ duration: 0.35 }}
          />
          {lit && (
            <motion.path
              d="M 24 30 Q 30 18 35 30 Q 40 42 46 30"
              stroke="#fef3c7"
              strokeWidth="0.8"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.7] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </svg>
      </motion.div>

      {/* Sleeping zzz */}
      <AnimatePresence>
        {!lit && (
          <motion.div
            className="absolute text-slate-700 text-xs font-bold"
            style={{ right: -10, top: 5 }}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: [0, 1, 0], x: [0, 10, 16], y: [0, -6, -12] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            zzz
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============== 3D VOLUMETRIC MASCOT ============== */

function Mascot3D({
  phoneFocused,
  pwdFocused,
  showPwd,
  phoneValue,
}: {
  phoneFocused: boolean;
  pwdFocused: boolean;
  showPwd: boolean;
  phoneValue: string;
}) {
  // 3D eye tracking — follows cursor in 3D space
  const trackX = useSpring(0, { stiffness: 100, damping: 15 });
  const trackY = useSpring(0, { stiffness: 100, damping: 15 });
  const headRotX = useSpring(0, { stiffness: 80, damping: 12 });
  const headRotY = useSpring(0, { stiffness: 80, damping: 12 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      trackX.set(dx * 5);
      trackY.set(dy * 4);
      headRotY.set(dx * 8);
      headRotX.set(-dy * 6);
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, [trackX, trackY, headRotX, headRotY]);

  // Also respond to phone typing
  useEffect(() => {
    if (phoneFocused) {
      const len = phoneValue.length;
      const offset = Math.min(len * 1.0, 5) - 2.5;
      trackX.set(offset);
      trackY.set(2);
    }
  }, [phoneFocused, phoneValue, trackX, trackY]);

  const covering = pwdFocused && !showPwd;
  const peeking = pwdFocused && showPwd;

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, scale: 0.8, rotateX: -20 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      className="mb-2 -mt-4"
      style={{ perspective: '600px' }}
    >
      <motion.div
        style={{
          rotateX: headRotX,
          rotateY: headRotY,
          transformStyle: 'preserve-3d',
        }}
      >
        <svg width="130" height="120" viewBox="0 0 130 120" fill="none">
          <defs>
            {/* 3D volumetric body gradient */}
            <radialGradient id="body3d" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="25%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#fbbf24" />
              <stop offset="85%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <radialGradient id="ear3d" cx="0.3" cy="0.3" r="0.8">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <radialGradient id="earInner3d" cx="0.3" cy="0.3" r="0.8">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>
            <radialGradient id="cheek3d" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hand3d" cx="0.3" cy="0.3" r="0.7">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <radialGradient id="eyeWhite3d" cx="0.4" cy="0.35" r="0.6">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </radialGradient>
            <filter id="mascotShadow3d">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.3)" />
            </filter>
            <filter id="mascotGlow3d">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Drop shadow */}
          <ellipse cx="65" cy="112" rx="30" ry="4" fill="rgba(0,0,0,0.2)" />

          {/* Ears — 3D volumetric */}
          <ellipse cx="30" cy="30" rx="15" ry="20" fill="url(#ear3d)" filter="url(#mascotShadow3d)" />
          <ellipse cx="100" cy="30" rx="15" ry="20" fill="url(#ear3d)" filter="url(#mascotShadow3d)" />
          <ellipse cx="30" cy="32" rx="7" ry="11" fill="url(#earInner3d)" />
          <ellipse cx="100" cy="32" rx="7" ry="11" fill="url(#earInner3d)" />

          {/* Head — 3D sphere with volumetric gradient */}
          <circle cx="65" cy="62" r="40" fill="url(#body3d)" filter="url(#mascotShadow3d)" />

          {/* Specular highlight — top-left */}
          <ellipse cx="48" cy="45" rx="14" ry="18" fill="white" opacity="0.25" />

          {/* Blush cheeks — soft 3D */}
          <circle cx="33" cy="70" r="8" fill="url(#cheek3d)" />
          <circle cx="97" cy="70" r="8" fill="url(#cheek3d)" />

          {/* Eyes — 3D glossy spheres */}
          {!covering && (
            <>
              {/* Eye whites with 3D shading */}
              <ellipse cx="48" cy="58" rx="12" ry="14" fill="url(#eyeWhite3d)" />
              <ellipse cx="82" cy="58" rx="12" ry="14" fill="url(#eyeWhite3d)" />
              {/* Pupil + highlight tracked in 3D */}
              <motion.g style={{ x: trackX, y: trackY }}>
                <circle cx="48" cy="58" r="6" fill="#0f172a" />
                <circle cx="82" cy="58" r="6" fill="#0f172a" />
                {/* Eye shine */}
                <circle cx="50" cy="55" r="2" fill="white" opacity="0.9" />
                <circle cx="84" cy="55" r="2" fill="white" opacity="0.9" />
                <circle cx="46" cy="61" r="1" fill="white" opacity="0.5" />
                <circle cx="80" cy="61" r="1" fill="white" opacity="0.5" />
              </motion.g>
            </>
          )}

          {/* 3D Paw hands covering eyes */}
          <AnimatePresence>
            {covering && (
              <motion.g
                initial={{ y: 45, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 45, opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                style={{ transformBox: 'fill-box' }}
              >
                <MascotPaw cx={48} cy={58} side="left" />
                <MascotPaw cx={82} cy={58} side="right" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Peeking — paws slightly raised */}
          <AnimatePresence>
            {peeking && (
              <motion.g
                initial={{ y: 45, opacity: 0 }}
                animate={{ y: -12, opacity: 1 }}
                exit={{ y: 45, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              >
                <MascotPaw cx={48} cy={52} side="left" peek />
                <MascotPaw cx={82} cy={52} side="right" peek />
                {/* Peek eyes */}
                <circle cx="48" cy="60" r="3.5" fill="#0f172a" />
                <circle cx="82" cy="60" r="3.5" fill="#0f172a" />
                <circle cx="49.5" cy="58.5" r="1.2" fill="white" opacity="0.8" />
                <circle cx="83.5" cy="58.5" r="1.2" fill="white" opacity="0.8" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Smile */}
          <motion.path
            d={covering || peeking ? 'M 54 80 Q 65 87 76 80' : 'M 52 78 Q 65 90 78 78'}
            stroke="#451a03"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            animate={{ d: covering || peeking ? 'M 54 80 Q 65 86 76 80' : 'M 52 78 Q 65 90 78 78' }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}

/* ============== MASCOT PAW HAND ============== */

function MascotPaw({ cx, cy, side, peek }: { cx: number; cy: number; side: 'left' | 'right'; peek?: boolean }) {
  const dir = side === 'left' ? -1 : 1;
  const padW = 16;
  const padH = peek ? 12 : 17;
  const fingerR = 3.2;
  const thumbOffset = dir * 9;
  return (
    <g>
      {/* Wrist/arm stub */}
      <ellipse cx={cx - thumbOffset * 0.3} cy={cy + padH + 4} rx={6} ry={6} fill="url(#hand3d)" opacity={0.85} />
      {/* Main palm pad */}
      <ellipse cx={cx} cy={cy} rx={padW} ry={padH} fill="url(#hand3d)" filter="url(#mascotShadow3d)" />
      {/* Finger pads — 4 small toes-beans across the top */}
      <ellipse cx={cx - dir * 7} cy={cy - padH + 4} rx={fingerR} ry={fingerR + 0.5} fill="url(#hand3d)" />
      <ellipse cx={cx - dir * 2.5} cy={cy - padH + 1} rx={fingerR} ry={fingerR + 0.5} fill="url(#hand3d)" />
      <ellipse cx={cx + dir * 2.5} cy={cy - padH + 1} rx={fingerR} ry={fingerR + 0.5} fill="url(#hand3d)" />
      <ellipse cx={cx + dir * 7} cy={cy - padH + 4} rx={fingerR} ry={fingerR + 0.5} fill="url(#hand3d)" />
      {/* Thumb pad on outer side */}
      <ellipse cx={cx + thumbOffset} cy={cy - 1} rx={fingerR - 0.4} ry={fingerR} fill="url(#hand3d)" />
      {/* Inner shadow crease lines for depth */}
      <path d={`M ${cx - 4} ${cy - 3} Q ${cx} ${cy - 1} ${cx + 4} ${cy - 3}`} stroke="#92400e" strokeWidth={0.7} fill="none" opacity={0.35} />
      <path d={`M ${cx - dir * 9} ${cy + 2} Q ${cx - dir * 5} ${cy + 5} ${cx - dir * 2} ${cy + 2}`} stroke="#92400e" strokeWidth={0.6} fill="none" opacity={0.25} />
      {/* Specular highlight */}
      <ellipse cx={cx - dir * 4} cy={cy - 4} rx={4} ry={3} fill="white" opacity={0.22} />
    </g>
  );
}

/* ============== PASSWORD CHECKLIST ============== */

function PasswordChecklist({
  checks,
  lang,
  t,
}: {
  checks: { minLen: boolean; hasNumber: boolean; hasSpecial: boolean };
  lang: string;
  t: (k: any) => string;
}) {
  const items: { key: any; ok: boolean }[] = [
    { key: 'pwdMinLen', ok: checks.minLen },
    { key: 'pwdHasNumber', ok: checks.hasNumber },
    { key: 'pwdHasSpecial', ok: checks.hasSpecial },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="rounded-xl p-3 space-y-2"
      style={{
        background: 'rgba(8,12,24,0.5)',
        border: '1px solid rgba(251,191,36,0.1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <p className="text-xs font-medium text-amber-300/80 mb-1">{t('pwdInstructions')}</p>
      {items.map((item) => (
        <CheckRow key={item.key} ok={item.ok} label={t(item.key)} />
      ))}
    </motion.div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        animate={{ scale: ok ? [0.8, 1.15, 1] : 1, backgroundColor: ok ? 'rgb(34 197 94)' : 'rgb(51 65 85)' }}
        transition={{ duration: 0.3 }}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={ok ? { boxShadow: '0 0 8px rgba(34,197,94,0.4)' } : {}}
      >
        <AnimatePresence mode="wait">
          {ok ? (
            <motion.div
              key="check"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check size={13} className="text-white" strokeWidth={3} />
            </motion.div>
          ) : (
            <motion.div key="x" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <X size={12} className="text-slate-500" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <span className={`text-xs transition-colors duration-300 ${ok ? 'text-green-400' : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}

/* ============== 3D GLASS FIELD ============== */

function Field3D({ icon, children, focused }: { icon: React.ReactNode; children: React.ReactNode; focused?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300"
      style={{
        background: focused ? 'rgba(251,191,36,0.06)' : 'rgba(8,12,24,0.6)',
        border: `1px solid ${focused ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: focused ? '0 0 12px rgba(251,191,36,0.08)' : 'none',
      }}
    >
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

/* ============== CLICK SOUND ============== */

function playClick() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // audio not available
  }
}
