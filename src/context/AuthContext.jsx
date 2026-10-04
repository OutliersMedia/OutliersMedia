import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

export const ADMIN_EMAILS = [
  'dhimanpashvinder@gmail.com',
  'outliersmedia22@gmail.com'
];

export const isEmailAdmin = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const checkIsAdmin = (user, profile) => {
  if (profile?.role?.toLowerCase() === 'admin') return true;
  const emails = [
    user?.email,
    user?.user_metadata?.email,
    profile?.email
  ];
  return emails.some((e) => isEmailAdmin(e));
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Check for errors returned in query string or URL hash (from Supabase/Google)
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash
        );
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');
        
        if (errorDescription) {
          console.error("OAuth Error:", errorDescription);
          alert("Sign-in notification: " + decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const isOAuthCallback = searchParams.has('code') || hashParams.has('access_token');

        // 2. Explicitly handle PKCE auth code if present in the URL
        const code = searchParams.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (e) {
            console.warn("PKCE exchange notice:", e);
          }
        }

        // 2b. Implicit tokens fallback (if both access_token and refresh_token are present)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
          } catch (e) {
            console.error("setSession notice:", e);
          }
        }

        // 3. Normal session restore
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
            if (isOAuthCallback) {
              window.history.replaceState({}, document.title, window.location.pathname);
              if (window.location.pathname === '/' || window.location.pathname === '/auth') {
                const isUserAdmin = checkIsAdmin(session.user, null);
                window.location.replace(isUserAdmin ? '/admin' : '/dashboard');
              }
            }
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Auth init exception:", err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 4. Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authId, retries = 3) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();
      
      if (!data) {
        if (retries > 0) {
          await new Promise((res) => setTimeout(res, 800));
          return await fetchProfile(authId, retries - 1);
        }
        console.warn("Profile not found in database, creating placeholder...");
        // Auto-heal: If user is authenticated but has no profile row, create basic profile row
        const { data: userResp } = await supabase.auth.getUser();
        const authedUser = userResp?.user;
        if (authedUser) {
          const defaultName = authedUser.user_metadata?.full_name || authedUser.user_metadata?.name || authedUser.email?.split('@')[0] || 'Client';
          const isAuthedAdmin = isEmailAdmin(authedUser.email);
          const { data: newProf, error: insErr } = await supabase
            .from('profiles')
            .upsert({
              auth_id: authedUser.id,
              email: authedUser.email,
              name: defaultName,
              role: isAuthedAdmin ? 'admin' : 'client'
            }, { onConflict: 'auth_id' })
            .select()
            .single();
          if (!insErr && newProf) {
            setProfile(newProf);
          }
        }
      } else {
        // If user is an admin email, guarantee role is set to admin
        if (isEmailAdmin(data.email) || isEmailAdmin(user?.email)) {
          data.role = 'admin';
          supabase.from('profiles').update({ role: 'admin' }).eq('auth_id', authId).then();
        }
        setProfile(data);
      }
    } catch (err) {
      console.error("fetchProfile exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const signInWithProvider = async (provider) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://outliersmedia.vercel.app';
    return supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/dashboard`
      }
    });
  };

  const signInWithEmail = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUpWithEmail = async (email, password, fullName) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
  };

  const verifyEmailOtp = async (email, token) => {
    return supabase.auth.verifyOtp({ email, token, type: 'signup' });
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    return supabase.auth.signOut();
  };

  const updateProfile = async ({ name, phone, business_type, instagram_handle }) => {
    if (!user) return { error: new Error("No user logged in") };
    
    // Call the self-healing RPC function to guarantee success
    const { data, error } = await supabase.rpc('complete_onboarding', {
      p_name: name || '',
      p_phone: phone || '',
      p_business_type: business_type || '',
      p_instagram: instagram_handle || ''
    });
    
    if (error) return { error };
    
    setProfile(data);
    return { data, error: null };
  };

  const isProfileComplete = profile && profile.phone;
  const isAdmin = checkIsAdmin(user, profile);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAdmin,
      loading, 
      isProfileComplete,
      signInWithProvider, 
      signInWithEmail, 
      signUpWithEmail, 
      verifyEmailOtp,
      signOut,
      updateProfile,
      refreshProfile: () => fetchProfile(user?.id)
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
