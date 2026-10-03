import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import PlanModal from '../components/dashboard/PlanModal';
import ActiveDashboard from '../components/dashboard/ActiveDashboard';

export default function Dashboard() {
  const { user, profile, isAdmin, isProfileComplete, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orderId, setOrderId] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  
  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [preSelectedPlanId, setPreSelectedPlanId] = useState(null);

  const [editName, setEditName] = useState('');
  const [editBusiness, setEditBusiness] = useState('');
  const [editInsta, setEditInsta] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditBusiness(profile.business_type || '');
      setEditInsta(profile.instagram_handle || '');
    }
  }, [profile]);

  // Auto-open PlanModal if user arrived from homepage with ?plan=starter/growth/premium
  useEffect(() => {
    const planParam = searchParams.get('plan');
    if (planParam && !activeOrder && !loadingOrder) {
      setPreSelectedPlanId(planParam);
      setShowPlanModal(true);
      // Clean the URL so refreshing doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, activeOrder, loadingOrder]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    await updateProfile({
      name: editName,
      phone: profile?.phone, // Keep existing phone
      business_type: editBusiness,
      instagram_handle: editInsta
    });
    setUpdatingProfile(false);
    alert('Profile Updated Successfully!');
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      if (!isProfileComplete && !isAdmin) {
        navigate('/onboarding');
      } else {
        fetchActiveOrder();
      }
    }
  }, [user, isProfileComplete, isAdmin, navigate]);

  const fetchActiveOrder = async () => {
    setLoadingOrder(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', user.id)
      .in('status', ['active', 'pending', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (data) {
      setActiveOrder(data);
    }
    setLoadingOrder(false);
  };

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    
    setIsTracking(true);
    // Try to find the order by ID manually
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId.trim().toUpperCase())
      .single();
      
    setIsTracking(false);
    
    if (data) {
      setActiveOrder(data);
      setOrderId('');
    } else {
      alert(`No active order found with ID: ${orderId.trim()}`);
    }
  };

  const handleSelectPlan = async (plan) => {
    try {
      // Call our secure Supabase RPC to create the order as 'pending'
      const { data, error } = await supabase.rpc('create_order', {
        p_plan: plan.name,
        p_amount: plan.price,
        p_receipt_url: plan.receipt_url
      });
      
      if (error) {
        alert("Failed to submit payment details: " + error.message);
        return false; // Return false so the modal knows it failed
      } else if (data) {
        setActiveOrder(data);
        setShowPlanModal(false); // Only close on success
        return true;
      }
    } catch (err) {
      alert("Unexpected error: " + err.message);
      return false;
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-base pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 flex justify-between items-end border-b border-themeborder pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif text-primary mb-2">Welcome, {profile.name?.split(' ')[0] || 'Client'}</h1>
            <p className="text-muted text-sm uppercase tracking-widest font-bold">Client ID: <span className="text-accent">{profile.user_id}</span></p>
          </div>
          <button 
            onClick={() => signOut()} 
            className="text-xs font-bold uppercase tracking-widest text-muted hover:text-danger transition-colors"
          >
            Sign Out
          </button>
        </header>

        {loadingOrder ? (
          <div className="flex justify-center items-center h-64">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></span>
          </div>
        ) : activeOrder ? (
          activeOrder.status === 'pending' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface/30 border border-themeborder border-dashed p-12 rounded-3xl text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h3 className="text-3xl font-serif text-primary mb-4">Waiting for Approval</h3>
              <p className="text-muted text-sm max-w-lg mb-2">Your payment details have been received. The admin will manually verify the payment and activate your <strong>{activeOrder.plan_name}</strong> shortly.</p>
              <p className="text-muted text-xs font-bold uppercase tracking-widest mt-6 bg-base px-4 py-2 rounded-lg border border-themeborder">Order ID: {activeOrder.order_id}</p>
            </motion.div>
          ) : activeOrder.status === 'paused' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface/30 border border-themeborder border-dashed p-12 rounded-3xl text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              </div>
              <h3 className="text-3xl font-serif text-primary mb-4">Plan Paused</h3>
              <p className="text-muted text-sm max-w-lg">Your <strong>{activeOrder.plan_name}</strong> is currently paused by the admin. Please contact support for more details.</p>
            </motion.div>
          ) : (
            <ActiveDashboard order={activeOrder} profile={profile} />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Editable Profile Form */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-glass backdrop-blur-md border border-glass-border p-8 rounded-3xl col-span-1"
            >
              <h3 className="text-xl font-serif text-primary mb-6">Complete Your Profile</h3>
              
              <form onSubmit={handleProfileUpdate} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Full Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-surface dark:bg-raised border border-themeborder p-3 text-primary text-sm focus:border-accent-border focus:shadow-[0_0_0_2px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                    placeholder="Your Name"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Business Type</label>
                  <select 
                    value={editBusiness}
                    onChange={(e) => setEditBusiness(e.target.value)}
                    className="w-full bg-surface dark:bg-raised border border-themeborder p-3 text-primary text-sm focus:border-accent-border focus:shadow-[0_0_0_2px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl appearance-none"
                  >
                    <option value="" disabled>Select...</option>
                    <option value="ecommerce">E-Commerce</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="influencer">Social Media Influencer</option>
                    <option value="agency">Agency</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Social Media (Insta)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">@</span>
                    <input 
                      type="text" 
                      value={editInsta}
                      onChange={(e) => setEditInsta(e.target.value)}
                      className="w-full bg-surface dark:bg-raised border border-themeborder p-3 pl-8 text-primary text-sm focus:border-accent-border focus:shadow-[0_0_0_2px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                      placeholder="handle"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={updatingProfile}
                  className="mt-2 w-full bg-[#3428f8] text-[#EEF2FF] p-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all duration-300 rounded-xl shadow-[0_0_15px_var(--accent-glow)] flex items-center justify-center"
                >
                  {updatingProfile ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : 'Save Details'}
                </button>
              </form>
            </motion.div>

            {/* Empty State / Activation Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface/30 border border-themeborder border-dashed p-8 rounded-3xl col-span-1 md:col-span-2 flex flex-col items-center justify-center text-center min-h-[300px]"
            >
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6 text-accent shadow-[0_0_20px_var(--accent-glow)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>
                </svg>
              </div>
              <h3 className="text-2xl font-serif text-primary mb-3">No Active Packages</h3>
              <p className="text-muted text-sm max-w-md mb-8">
                Your order details and reports will appear here once you activate a project. Choose a plan or track an existing order ID.
              </p>
              
              <div className="flex flex-col w-full max-w-md gap-4">
                {/* Primary CTA */}
                <button 
                  onClick={() => setShowPlanModal(true)}
                  className="w-full bg-[#3428f8] text-[#EEF2FF] px-8 py-5 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all duration-300 rounded-xl shadow-[0_0_25px_var(--accent-glow)] hover:scale-[1.02]"
                >
                  Activate Project
                </button>

                <div className="flex items-center gap-4 my-2">
                  <div className="h-px bg-themeborder flex-1"></div>
                  <span className="text-xs text-muted font-bold uppercase tracking-widest">OR</span>
                  <div className="h-px bg-themeborder flex-1"></div>
                </div>

                {/* Secondary Action */}
                <form onSubmit={handleTrackOrder} className="flex flex-col sm:flex-row w-full gap-3">
                  <input 
                    type="text" 
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value.toUpperCase())}
                    placeholder="e.g. OM1002"
                    className="flex-1 bg-surface dark:bg-raised border border-themeborder p-4 text-primary text-sm focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl"
                  />
                  <button 
                    type="submit"
                    disabled={isTracking || !orderId.trim()}
                    className="bg-raised border border-themeborder text-primary px-6 py-4 sm:py-0 text-xs font-bold uppercase tracking-widest hover:border-accent transition-all duration-300 rounded-xl disabled:opacity-50 flex items-center justify-center whitespace-nowrap"
                  >
                    {isTracking ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></span>
                    ) : (
                      'Track Order'
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      <PlanModal 
        isOpen={showPlanModal} 
        onClose={() => { setShowPlanModal(false); setPreSelectedPlanId(null); }} 
        onSelectPlan={handleSelectPlan}
        preSelectedPlanId={preSelectedPlanId}
      />
    </div>
  );
}
