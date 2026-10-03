import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (authId, retries = 3) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', authId)
        .single();
      
      if (error) {
        if (retries > 0) {
          // The database trigger might still be creating the profile, wait 1s and retry
          setTimeout(() => fetchProfile(authId, retries - 1), 1000);
          return;
        }
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const signInWithProvider = async (provider) => {
    return supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
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
