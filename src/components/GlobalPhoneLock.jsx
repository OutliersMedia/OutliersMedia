import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalPhoneLock() {
  const { user, profile, updateProfile, isProfileComplete, loading: authLoading, signOut } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // If loading auth, or no user, or profile is complete, or user is admin -> Do NOT show lock
  const shouldShowLock = !authLoading && user && isProfileComplete === false && profile?.role !== 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setErrorMsg("Phone number is mandatory.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await updateProfile({
      name: profile?.name || '',
      phone: phone.trim(),
      business_type: profile?.business_type || '',
      instagram_handle: profile?.instagram_handle || ''
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AnimatePresence>
      {shouldShowLock && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md bg-[#0a0a0a] border border-[#222] p-8 rounded-3xl shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#3428f8] to-transparent"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#3428f8]/20 blur-3xl rounded-full pointer-events-none"></div>

            <div className="text-center mb-8 relative z-10">
              <h2 className="text-3xl font-serif text-white mb-3">Security Check</h2>
              <p className="text-[#888] text-sm leading-relaxed">
                Please verify your active WhatsApp/Contact number to securely access Outliers Media.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl font-medium relative z-10">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#888]">Phone Number <span className="text-[#3428f8]">*</span></label>
                <input 
                  type="tel" 
                  required 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] p-4 text-white focus:border-[#3428f8] focus:shadow-[0_0_0_2px_rgba(52,40,248,0.2)] focus:outline-none transition-all duration-200 rounded-xl"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#3428f8] text-white p-5 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all duration-300 hover:scale-[1.02] rounded-xl shadow-[0_0_20px_rgba(52,40,248,0.3)] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                  Unlock Website
                </button>
                <button 
                  type="button"
                  onClick={handleSignOut}
                  className="w-full bg-transparent text-[#888] p-4 text-xs font-bold uppercase tracking-widest hover:text-red-400 transition-colors"
                >
                  Sign Out / Cancel
                </button>
              </div>

            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
