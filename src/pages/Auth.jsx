import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, checkIsAdmin } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithProvider, signInWithEmail, signUpWithEmail, verifyEmailOtp, user, profile, isAdmin: authIsAdmin, isProfileComplete } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectParam = searchParams.get('redirect');
  const planParam = searchParams.get('plan');
  const incomingPlan = planParam || (redirectParam?.includes('plan=') ? new URLSearchParams(redirectParam.split('?')[1]).get('plan') : null);

  const getRedirectDestination = () => {
    if (isAdmin) return '/admin';
    if (redirectParam && redirectParam.startsWith('/')) return redirectParam;
    if (planParam) return `/dashboard?plan=${planParam.toLowerCase()}`;
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('auth_redirect') : null;
    if (saved && saved.startsWith('/')) return saved;
    return '/dashboard';
  };

  useEffect(() => {
    if (user && !showOtp) {
      const destination = getRedirectDestination();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('auth_redirect');
      }
      navigate(destination, { replace: true });
    }
  }, [user, isAdmin, navigate, showOtp]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();

    try {
      let result;
      if (isSignUp) {
        result = await signUpWithEmail(cleanEmail, password, fullName);
        if (result.error) throw result.error;
        
        // Supabase sends a confirmation email (if Confirm Email is ON in dashboard)
        // Check if a session was created. If NOT, it means email verification is required.
        if (result.data?.user && !result.data?.session) {
          setShowOtp(true);
          setSuccessMsg('A 6-digit code has been sent to your email.');
        } else if (result.data?.session) {
          const destination = getRedirectDestination();
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_redirect');
          }
          navigate(destination, { replace: true });
        }
      } else {
        // Sign In
        result = await signInWithEmail(cleanEmail, password);
        if (result.error) {
          if (result.error.message.includes('Email not confirmed')) {
            setShowOtp(true);
            setErrorMsg('Please verify your email to log in.');
          } else {
            throw result.error;
          }
        }
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const result = await verifyEmailOtp(email.trim(), otpCode.trim());
      if (result.error) throw result.error;
      
      // If success, the AuthContext listener will pick up the session and the useEffect will route.
      // But just to be safe, we turn off the OTP screen.
      setShowOtp(false);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      const destination = getRedirectDestination();
      if (typeof window !== 'undefined' && destination && destination !== '/dashboard') {
        sessionStorage.setItem('auth_redirect', destination);
      }
      const { error } = await signInWithProvider(provider, destination);
      if (error) throw error;
    } catch (error) {
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-base pt-32 pb-20 px-6 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.3 }}></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <AnimatePresence mode="wait">
        {!showOtp ? (
          <motion.div 
            key="auth-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md bg-glass backdrop-blur-xl border border-glass-border p-8 rounded-3xl shadow-2xl relative z-10"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif text-primary mb-2">
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="text-muted text-sm">
                {isSignUp ? 'Join Outliers Media today' : 'Log in to your client dashboard'}
              </p>
            </div>

            {incomingPlan && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-2xl text-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-accent block">Plan Selected</span>
                <span className="text-base font-serif font-bold text-primary capitalize">{incomingPlan} Plan</span>
                <p className="text-xs text-muted mt-1">Sign in or register below to proceed to your plan activation.</p>
              </div>
            )}

            {errorMsg && (
              <div className="mb-6 p-4 bg-danger/10 border border-danger text-danger text-sm rounded-xl text-center font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-4 mb-8">
              <button 
                onClick={() => handleOAuth('google')}
                className="w-full bg-surface hover:bg-raised border border-themeborder hover:border-accent text-primary p-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-sm group"
              >
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                  <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                  <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                  <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                </svg>
                <span className="font-bold text-sm tracking-wide">Continue with Google</span>
              </button>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="h-px bg-themeborder flex-1"></div>
              <span className="text-xs text-muted font-bold uppercase tracking-widest">Or with email</span>
              <div className="h-px bg-themeborder flex-1"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="flex flex-col gap-5">
              {isSignUp && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                    placeholder="John Doe"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Email</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                  placeholder="hello@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface dark:bg-raised border border-themeborder p-4 pr-12 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                        <line x1="2" y1="2" x2="22" y2="22"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#3428f8] text-[#EEF2FF] p-4 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-[1.02] rounded-xl shadow-[0_0_20px_var(--accent-glow)] mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }} 
                  className="ml-2 text-accent font-bold hover:underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="otp-form"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md bg-glass backdrop-blur-xl border border-glass-border p-8 rounded-3xl shadow-2xl relative z-10"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-accent/10 border border-accent/30 text-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_var(--accent-glow)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/>
                </svg>
              </div>
              <h1 className="text-3xl font-serif text-primary mb-2">Check your email</h1>
              <p className="text-muted text-sm">
                We sent a 6-digit verification code to <br/>
                <span className="text-primary font-bold">{email}</span>
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-danger/10 border border-danger text-danger text-sm rounded-xl text-center font-medium">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent text-accent text-sm rounded-xl text-center font-medium">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted text-center">Verification Code</label>
                <input 
                  type="text" 
                  required 
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary text-center text-2xl tracking-[0.5em] font-mono focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                  placeholder="000000"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-[#3428f8] text-[#EEF2FF] p-4 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-[1.02] rounded-xl shadow-[0_0_20px_var(--accent-glow)] mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                Verify & Continue
              </button>
            </form>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setShowOtp(false)} 
                className="text-sm font-bold text-muted hover:text-primary transition-colors uppercase tracking-widest"
              >
                Back to Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
