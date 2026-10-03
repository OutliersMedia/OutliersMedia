import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Onboarding() {
  const { user, profile, updateProfile, isProfileComplete, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('ecommerce');
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Populate name if it arrives late from the profile fetch
  useEffect(() => {
    if (profile?.name && !name) {
      setName(profile.name);
    }
  }, [profile, name]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isProfileComplete) {
      navigate('/');
    }
  }, [user, isProfileComplete, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await updateProfile({
      name,
      phone,
      business_type: businessType,
      instagram_handle: instagram
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      navigate('/');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-base pt-32 pb-20 px-6 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.3 }}></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-glass backdrop-blur-xl border border-glass-border p-8 md:p-12 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-accent/10 border border-accent/30 text-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_var(--accent-glow)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-3">Complete your profile</h1>
          <p className="text-muted">Just a few more details to get your workspace ready.</p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-danger/10 border border-danger text-danger text-sm rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Full Name <span className="text-accent">*</span></label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
              placeholder="John Doe"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Phone Number <span className="text-accent">*</span></label>
            <input 
              type="tel" 
              required 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Business Type <span className="text-accent">*</span></label>
            <select 
              required 
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl appearance-none"
            >
              <option value="ecommerce">E-Commerce</option>
              <option value="restaurant">Restaurant</option>
              <option value="influencer">Social Media Influencer</option>
              <option value="agency">Agency</option>
              <option value="freelancer">Freelancer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Instagram Handle (Optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">@</span>
              <input 
                type="text" 
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full bg-surface dark:bg-raised border border-themeborder p-4 pl-10 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                placeholder="outliersmedia22"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#3428f8] text-[#EEF2FF] p-5 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-[1.02] rounded-xl shadow-[0_0_20px_var(--accent-glow)] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
              Complete Setup
            </button>
            <button 
              type="button"
              onClick={handleSignOut}
              className="w-full bg-transparent text-muted p-4 text-xs font-bold uppercase tracking-widest hover:text-danger transition-colors"
            >
              Sign Out / Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
