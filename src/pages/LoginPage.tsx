import React, { useState, useEffect, memo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { verifyRecoveryCode, changePassword, findUserByUsername } from '@/data/usersData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2, Lock, AlertTriangle, Sparkles, User, KeyRound, ShieldCheck,
  RotateCcw, Eye, EyeOff, CheckCircle,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Static animated background — memo'd so it
   NEVER re-renders on parent state changes
───────────────────────────────────────────── */
const LoginBg = memo(() => (
  <>
    {/* Deep dark gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(230,75%,8%)] via-[hsl(228,48%,12%)] to-[hsl(230,60%,6%)] animate-gradient" />

    {/* Mesh overlay */}
    <div className="absolute inset-0 gradient-mesh opacity-40" />

    {/* Floating blobs */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[8%]  left-[10%]  h-80 w-80 rounded-full bg-primary/8  blur-3xl animate-float" />
      <div className="absolute top-[55%] right-[8%]  h-64 w-64 rounded-full bg-secondary/6 blur-3xl animate-float delay-200" style={{ animationDuration: '9s' }} />
      <div className="absolute bottom-[12%] left-[35%] h-72 w-72 rounded-full bg-primary/5  blur-3xl animate-float delay-500" style={{ animationDuration: '12s' }} />
      <div className="absolute top-[25%] right-[25%] h-48 w-48 rounded-full bg-chart-3/4 blur-2xl animate-float delay-300" style={{ animationDuration: '8s' }} />
      <div className="absolute top-[70%] left-[15%]  h-40 w-40 rounded-full bg-chart-4/3 blur-2xl animate-float delay-600" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[15%] right-[40%] h-32 w-32 rounded-full bg-primary/6  blur-xl  animate-float delay-400" style={{ animationDuration: '7s' }} />
    </div>

    {/* Subtle grid */}
    <div
      className="absolute inset-0 opacity-[0.02]"
      style={{
        backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }}
    />
  </>
));
LoginBg.displayName = 'LoginBg';

/* ─────────────────────────────────────────────
   Isolated password field — memo'd so eye toggle
   ONLY re-renders this component, not the page
───────────────────────────────────────────── */
const PasswordField = memo(({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id="password"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="أدخل كلمة المرور"
        required
        disabled={disabled}
        autoComplete="current-password"
        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pr-4 pl-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-300 disabled:opacity-50"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        onMouseDown={e => { e.preventDefault(); setShow(s => !s); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
      >
        {show
          ? <EyeOff className="h-4 w-4 text-primary pointer-events-none" />
          : <Eye className="h-4 w-4 text-primary pointer-events-none" />}
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

/* ─────────────────────────────────────────────
   Shared glass card wrapper
───────────────────────────────────────────── */
const GlassCard = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4" dir="rtl">
    <LoginBg />
    <div className="relative z-10 w-full max-w-md animate-scale-in">
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 rounded-3xl blur-2xl opacity-50 animate-pulse pointer-events-none" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-primary/20">
        {/* Top accent bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
        {children}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-white/30">© {new Date().getFullYear()} GX GLEAMEX • جميع الحقوق محفوظة</p>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   Main LoginPage
───────────────────────────────────────────── */
type Screen = 'login' | 'forgot' | 'done';

const LoginPage = () => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [lockoutSec, setLockoutSec] = useState(0);

  const [screen, setScreen] = useState<Screen>('login');
  const [fpUsername, setFpUsername] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpPass, setFpPass] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpStep, setFpStep] = useState<1 | 2>(1);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SEC = 30;

  useEffect(() => {
    if (!lockoutEnd) return;
    const tick = () => {
      const rem = Math.ceil((lockoutEnd - Date.now()) / 1000);
      if (rem <= 0) { setLockoutEnd(null); setLockoutSec(0); setAttempts(0); setError(''); }
      else setLockoutSec(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockoutEnd]);

  const isLocked = !!lockoutEnd && Date.now() < lockoutEnd;

  const handleLogin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError(''); setLoading(true);
    try {
      login(username, password);
    } catch (err) {
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) {
        setLockoutEnd(Date.now() + LOCKOUT_SEC * 1000);
        setError(`تم قفل الحساب مؤقتاً. حاول بعد ${LOCKOUT_SEC} ثانية`);
      } else {
        setError(err instanceof Error ? err.message : 'بيانات غير صحيحة');
      }
    } finally {
      setLoading(false);
    }
  }, [login, username, password, attempts, isLocked]);

  const handleFpStep1 = (e: React.FormEvent) => {
    e.preventDefault(); setFpError('');
    if (!findUserByUsername(fpUsername)) { setFpError('اسم المستخدم غير موجود'); return; }
    setFpStep(2);
  };

  const handleFpStep2 = (e: React.FormEvent) => {
    e.preventDefault(); setFpError('');
    if (!verifyRecoveryCode(fpCode)) { setFpError('كود الاسترداد غير صحيح. تواصل مع صاحب النظام'); return; }
    if (fpPass.length < 4) { setFpError('كلمة المرور 4 أحرف على الأقل'); return; }
    if (fpPass !== fpConfirm) { setFpError('كلمتا المرور غير متطابقتين'); return; }
    if (!changePassword(fpUsername, fpPass)) { setFpError('حدث خطأ أثناء التغيير'); return; }
    setScreen('done');
  };

  const goLogin = () => {
    setScreen('login'); setFpStep(1); setFpError('');
    setFpUsername(''); setFpCode(''); setFpPass(''); setFpConfirm('');
  };

  const fieldClass = "h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-300";

  /* ── DONE screen ── */
  if (screen === 'done') return (
    <GlassCard>
      <div className="p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">تم تغيير كلمة المرور</h2>
          <p className="text-sm text-white/50">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>
        </div>
        <button onClick={goLogin}
          className="w-full h-12 rounded-xl bg-gradient-to-l from-primary to-primary/80 font-bold text-white hover:opacity-90 transition-all shadow-lg shadow-primary/25">
          العودة لتسجيل الدخول
        </button>
      </div>
    </GlassCard>
  );

  /* ── FORGOT screen ── */
  if (screen === 'forgot') return (
    <GlassCard>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-3 pt-2">
          <div className="flex justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
              <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-lg opacity-60 animate-pulse" />
              <KeyRound className="relative h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">استرداد كلمة المرور</h2>
          <p className="text-sm text-white/50">{fpStep === 1 ? 'أدخل اسم المستخدم للمتابعة' : 'تواصل مع صاحب النظام للحصول على كود الاسترداد'}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map(n => (
            <React.Fragment key={n}>
              {n > 1 && <div className={`h-px w-12 transition-all ${fpStep >= n ? 'bg-primary' : 'bg-white/20'}`} />}
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${fpStep >= n ? 'bg-primary text-white' : 'bg-white/10 text-white/40'}`}>{n}</div>
            </React.Fragment>
          ))}
        </div>

        {fpStep === 1 ? (
          <form onSubmit={handleFpStep1} className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white/70 font-medium">
                <User className="h-4 w-4 text-primary" /> اسم المستخدم
              </label>
              <input value={fpUsername} onChange={e => setFpUsername(e.target.value)} required autoFocus placeholder="أدخل اسم المستخدم" className={fieldClass} />
            </div>
            {fpError && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertTriangle className="h-4 w-4" /><AlertDescription>{fpError}</AlertDescription>
              </Alert>
            )}
            <button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-l from-primary to-primary/80 font-bold text-white hover:opacity-90 transition-all shadow-lg shadow-primary/20">متابعة</button>
            <button type="button" onClick={goLogin} className="w-full h-10 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" /> العودة لتسجيل الدخول
            </button>
          </form>
        ) : (
          <form onSubmit={handleFpStep2} className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-center">
              <p className="text-xs text-amber-300/80">تواصل مع صاحب النظام وأطلب منه <span className="font-bold">كود الاسترداد</span></p>
              <p className="text-xs text-amber-300/50 mt-1">للمستخدم: <span className="font-mono font-bold text-amber-300/80">{fpUsername}</span></p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white/70 font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> كود الاسترداد</label>
              <input value={fpCode} onChange={e => setFpCode(e.target.value)} required autoFocus placeholder="أدخل الكود" className={`${fieldClass} text-center font-mono tracking-widest text-lg`} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white/70 font-medium"><Lock className="h-4 w-4 text-primary" /> كلمة المرور الجديدة</label>
              <input type="password" value={fpPass} onChange={e => setFpPass(e.target.value)} required minLength={4} placeholder="4 أحرف على الأقل" className={fieldClass} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white/70 font-medium"><Lock className="h-4 w-4 text-primary" /> تأكيد كلمة المرور</label>
              <input type="password" value={fpConfirm} onChange={e => setFpConfirm(e.target.value)} required placeholder="أعد كتابة كلمة المرور" className={fieldClass} />
            </div>
            {fpError && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertTriangle className="h-4 w-4" /><AlertDescription>{fpError}</AlertDescription>
              </Alert>
            )}
            <button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-l from-primary to-primary/80 font-bold text-white hover:opacity-90 transition-all shadow-lg shadow-primary/20">تغيير كلمة المرور</button>
            <button type="button" onClick={() => { setFpStep(1); setFpError(''); }} className="w-full h-10 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all">رجوع</button>
          </form>
        )}
      </div>
    </GlassCard>
  );

  /* ── MAIN LOGIN screen ── */
  return (
    <GlassCard>
      <div className="p-6">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-1 pt-2 pb-5 text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-secondary blur-xl opacity-40 animate-pulse" />
            <div className="absolute -inset-2 rounded-3xl border border-primary/20 animate-pulse-ring" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-[#111] border border-primary/20 shadow-lg shadow-primary/30 overflow-hidden">
              <img src="/logo.png" alt="GX GLEAMEX" className="h-full w-full object-contain"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }} />
              <span className="text-3xl font-black italic text-white hidden items-center justify-center w-full h-full" style={{ display: 'none' }}>
                G<span className="text-primary">X</span>
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white animate-slide-up flex items-center gap-2">
            GX GLEAMEX <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </h1>
          <p className="text-white/50 text-base animate-slide-up">للتجارة والتوزيع</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="username" className="flex items-center gap-2 text-sm font-medium text-white/70">
              <User className="h-4 w-4 text-primary" /> اسم المستخدم
            </label>
            <div className="relative">
              <input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
                autoFocus
                autoComplete="username"
                disabled={loading || isLocked}
                className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pr-4 pl-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-300 disabled:opacity-50"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>

          {/* Password — isolated memo component */}
          <div className="space-y-2">
            <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-white/70">
              <KeyRound className="h-4 w-4 text-primary" /> كلمة المرور
            </label>
            <PasswordField value={password} onChange={setPassword} disabled={loading || isLocked} />
          </div>

          {/* Error */}
          {error && !isLocked && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 animate-slide-down backdrop-blur-sm">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          {/* Lockout */}
          {isLocked && (
            <div className="flex items-center justify-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-4 animate-slide-down backdrop-blur-sm">
              <Lock className="h-5 w-5 text-amber-400" />
              <div className="text-center">
                <span className="text-sm text-amber-400/80 block">محظور مؤقتاً</span>
                <span className="text-2xl font-bold text-amber-400">{lockoutSec} ثانية</span>
              </div>
            </div>
          )}

          {/* Attempts warning */}
          {!isLocked && attempts > 0 && attempts < MAX_ATTEMPTS && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/10 px-4 py-2 animate-fade-in">
              <ShieldCheck className="h-4 w-4 text-amber-500/60" />
              <p className="text-sm text-amber-500/80">
                <span className="font-bold">{MAX_ATTEMPTS - attempts}</span> محاولات متبقية
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full h-12 rounded-xl bg-gradient-to-l from-primary to-primary/80 font-bold text-base text-white hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2 btn-ripple"
          >
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> جاري تسجيل الدخول...</>
              : isLocked
                ? <><Lock className="h-5 w-5" /> محظور مؤقتاً</>
                : 'تسجيل الدخول'}
          </button>

          {/* Forgot password */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setScreen('forgot'); setFpUsername(username); }}
              className="text-sm text-primary/70 hover:text-primary underline underline-offset-4 transition-colors"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
        </form>
      </div>
    </GlassCard>
  );
};

export default LoginPage;
