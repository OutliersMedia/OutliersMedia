import { useState, useEffect } from 'react';
import { useAuth, checkIsAdmin, checkIsTester } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, BellOff, ShieldAlert, CheckCircle, RefreshCw, Lock, Sparkles, ExternalLink, LogOut } from 'lucide-react';
import { 
  getNotificationPermission, 
  subscribeClientToPush, 
  setupNotificationListener,
  isPushSupported 
} from '../utils/pushManager';

export default function GlobalNotificationLock() {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester, loading: authLoading, signOut } = useAuth();
  
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  
  // Only regular clients are subject to the notification lock. Admins and Testers are fully exempt.
  const isClient = Boolean(!authLoading && user && !isAdmin && !isTester);

  const [permission, setPermission] = useState('granted');
  const [loading, setLoading] = useState(false);
  const [deniedShake, setDeniedShake] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  // Check current browser permission
  const checkPermission = () => {
    if (!isPushSupported()) {
      setPermission('granted'); // Gracefully allow if browser doesn't support Notifications
      return;
    }
    const current = getNotificationPermission();
    setPermission(current);
  };

  useEffect(() => {
    if (!isClient) return;

    checkPermission();

    // Re-check permission whenever client returns focus to tab (e.g. after changing address bar setting)
    const handleFocus = () => {
      checkPermission();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isClient, checkCount]);

  // Once permission is granted, listen for real-time push alerts in the background for ANY logged in user (clients, testers, and admins)
  useEffect(() => {
    if (user?.id && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const cleanup = setupNotificationListener(user.id, user.email);
      return cleanup;
    }
  }, [user?.id, user?.email, permission]);

  // Trigger browser permission prompt
  const handleRequestPermission = async () => {
    setLoading(true);
    const result = await subscribeClientToPush(user);
    setLoading(false);

    if (result.success && result.permission === 'granted') {
      setPermission('granted');
    } else {
      checkPermission();
      if (getNotificationPermission() === 'denied') {
        triggerDeniedShake();
      }
    }
  };

  // Re-check button for Denied state
  const handleRecheckPermission = async () => {
    setLoading(true);
    // In some browsers, calling requestPermission again may prompt if user reset site settings
    try {
      if ('Notification' in window) {
        await Notification.requestPermission();
      }
    } catch (e) {}

    checkPermission();
    setCheckCount(prev => prev + 1);
    setLoading(false);

    if (Notification.permission === 'denied') {
      triggerDeniedShake();
    }
  };

  const triggerDeniedShake = () => {
    setDeniedShake(true);
    setTimeout(() => setDeniedShake(false), 800);
  };

  // If not a client or permission is already granted, render nothing
  if (!isClient || permission === 'granted') {
    return null;
  }

  const isDenied = permission === 'denied';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-2xl select-none"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ 
            scale: 1, 
            y: 0,
            x: deniedShake ? [-8, 8, -6, 6, -3, 3, 0] : 0 
          }}
          transition={{ duration: 0.4 }}
          className={`w-full max-w-lg bg-[#0e0e0e] border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-center ${
            isDenied ? 'border-amber-500/40' : 'border-[#3428f8]/40'
          }`}
        >
          {/* Top Decorative Glow */}
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
            isDenied 
              ? 'from-transparent via-amber-500 to-transparent' 
              : 'from-transparent via-[#3428f8] to-transparent'
          }`}></div>

          {/* Background Ambient Aura */}
          <div className={`absolute -top-24 -right-24 w-52 h-52 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isDenied ? 'bg-amber-500' : 'bg-[#3428f8]'
          }`}></div>

          {/* Icon Badge */}
          <div className="flex justify-center mb-5">
            <div className={`p-4 rounded-2xl border relative ${
              isDenied 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-[#3428f8]/10 text-[#3428f8] border-[#3428f8]/30'
            }`}>
              {isDenied ? (
                <BellOff size={36} className="animate-pulse" />
              ) : (
                <BellRing size={36} className="animate-bounce" />
              )}
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                isDenied ? 'bg-amber-400' : 'bg-[#3428f8]'
              } animate-ping`}></span>
            </div>
          </div>

          {/* Heading & Subheading */}
          {isDenied ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-3">
                <ShieldAlert size={12} /> Access Temporarily Locked
              </div>
              <h2 className="text-2xl md:text-3xl font-serif text-white mb-2">
                Notifications Are Blocked
              </h2>
              <p className="text-[#888] text-xs md:text-sm mb-6 leading-relaxed">
                Outliers Media requires delivery alerts to notify you the instant your reels, posts, and schedules are uploaded. The website is locked until notifications are enabled.
              </p>

              {/* 2-Step Browser Unblock Guide */}
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 text-left mb-6 flex flex-col gap-3">
                <p className="text-[11px] text-[#aaa] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={12} className="text-amber-400" /> How to re-enable in 2 clicks:
                </p>

                <div className="flex items-start gap-3 bg-[#0a0a0a] p-3 rounded-xl border border-[#1f1f1f]">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-xs text-[#ddd]">
                    Click the <strong className="text-white">lock icon 🔒</strong> or site controls next to the URL in your browser address bar.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-[#0a0a0a] p-3 rounded-xl border border-[#1f1f1f]">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-xs text-[#ddd]">
                    Find <strong className="text-white">Notifications</strong> and switch it from <strong className="text-red-400">Block</strong> to <strong className="text-green-400">Allow</strong>.
                  </p>
                </div>
              </div>

              {/* Action Button: Start Notifications / Re-check */}
              <button
                onClick={handleRecheckPermission}
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer mb-3"
              >
                {loading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <>
                    <RefreshCw size={15} />
                    Start Notifications & Re-check
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-serif text-white mb-2">
                Enable Content Alerts
              </h2>
              <p className="text-[#888] text-xs md:text-sm mb-6 leading-relaxed">
                Stay updated the second Outliers Media uploads your reels, static posts, and deliverables. We send high-priority push notifications directly to your screen.
              </p>

              {/* Benefit Pills */}
              <div className="grid grid-cols-2 gap-2 text-left mb-6">
                <div className="bg-[#141414] border border-[#222] p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <span className="text-[11px] text-[#ccc]">Instant Upload Alerts</span>
                </div>
                <div className="bg-[#141414] border border-[#222] p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <span className="text-[11px] text-[#ccc]">Exclusive Client Offers</span>
                </div>
              </div>

              {/* Action Button: Request Permission */}
              <button
                onClick={handleRequestPermission}
                disabled={loading}
                className="w-full bg-[#3428f8] hover:bg-[#281fe0] text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_25px_rgba(52,40,248,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer mb-3"
              >
                {loading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <>
                    <BellRing size={15} />
                    Enable Instant Notifications
                  </>
                )}
              </button>
            </>
          )}

          {/* Secondary Sign Out Link */}
          <div className="pt-2 border-t border-[#1f1f1f] flex justify-between items-center text-[11px] text-[#666]">
            <span>Signed in as {user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-[#888] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut size={11} /> Sign Out
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
