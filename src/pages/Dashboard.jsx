import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth, checkIsAdmin, checkIsTester } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import { IndianRupee, AlertTriangle, ShieldAlert, CreditCard, MessageSquare, ExternalLink, Briefcase, Plus, Globe, CheckCircle } from 'lucide-react';
import PlanModal from '../components/dashboard/PlanModal';
import ActiveDashboard from '../components/dashboard/ActiveDashboard';
import InstallmentPayModal from '../components/dashboard/InstallmentPayModal';
import NotificationBell from '../components/dashboard/NotificationBell';
import BuildWebsiteModal from '../components/dashboard/BuildWebsiteModal';
import WebsiteProjectView from '../components/dashboard/WebsiteProjectView';
import { computeOrderInstallmentMetrics } from '../utils/installmentEngine';
import {
  fetchClientWebsites,
  isWebsiteOrder,
  OPEN_WEBSITE_STATUSES,
  WEBSITE_EVENT_NAME
} from '../utils/websiteEngine';
import { getOrderBusinessKey, RENEWAL_EVENT_NAME } from '../utils/renewalEngine';

export default function Dashboard() {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester, isProfileComplete, signOut, loading } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orderId, setOrderId] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  
  const [activeOrder, setActiveOrder] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [preSelectedPlanId, setPreSelectedPlanId] = useState(null);
  const [payModalInstallment, setPayModalInstallment] = useState(null);
  const [clientWebsites, setClientWebsites] = useState([]);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [dashboardView, setDashboardView] = useState('social'); // 'social' | 'website'
  const [websiteToast, setWebsiteToast] = useState(null);

  // Auto-open PlanModal if user arrived with ?plan=starter/growth/premium
  useEffect(() => {
    const planParam = searchParams.get('plan');
    if (planParam && !loadingOrder) {
      setPreSelectedPlanId(planParam.toLowerCase());
      setShowPlanModal(true);
      // Clean the URL so refreshing doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loadingOrder]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const target = location.pathname + location.search;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_redirect', target);
      }
      navigate(`/auth?redirect=${encodeURIComponent(target)}`, { replace: true });
    } else if (isAdmin || isTester) {
      navigate('/admin', { replace: true });
    } else if (!isProfileComplete) {
      navigate('/onboarding');
    } else {
      fetchActiveOrder();
    }
  }, [user, isAdmin, isTester, isProfileComplete, loading, navigate, location]);

  useEffect(() => {
    if (!user?.id) return;
    const handleLiveSync = () => fetchActiveOrder();
    window.addEventListener(WEBSITE_EVENT_NAME, handleLiveSync);
    window.addEventListener(RENEWAL_EVENT_NAME, handleLiveSync);
    window.addEventListener('om_business_added', handleLiveSync);

    const liveChannel = supabase
      .channel(`client-live-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'websites', filter: `client_id=eq.${user.id}` }, () => {
        fetchActiveOrder();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${user.id}` }, () => {
        fetchActiveOrder();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_cycles', filter: `client_id=eq.${user.id}` }, () => {
        fetchActiveOrder();
      })
      .subscribe();

    return () => {
      window.removeEventListener(WEBSITE_EVENT_NAME, handleLiveSync);
      window.removeEventListener(RENEWAL_EVENT_NAME, handleLiveSync);
      window.removeEventListener('om_business_added', handleLiveSync);
      supabase.removeChannel(liveChannel);
    };
  }, [user?.id]);

  const fetchActiveOrder = async (preferredOrderId = null) => {
    setLoadingOrder(true);
    const [{ data: allOrders }, websitesList] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('client_id', user.id)
        .in('status', ['active', 'pending', 'paused', 'expired'])
        .order('created_at', { ascending: false }),
      fetchClientWebsites(user.id)
    ]);

    setClientWebsites(websitesList || []);

    if (allOrders && allOrders.length > 0) {
      for (const ord of allOrders) {
        if (isWebsiteOrder(ord)) continue;
        const instMetrics = computeOrderInstallmentMetrics(ord);
        // Automated suspension check: if active but past grace period, auto-pause
        if (ord.status === 'active' && instMetrics.isOverdue) {
          await supabase.from('orders').update({ status: 'paused' }).eq('id', ord.id);
          ord.status = 'paused';
        }
        // Automated restoration check: if paused but all overdue payments confirmed, auto-restore
        if (ord.status === 'paused' && !instMetrics.isOverdue && instMetrics.isFullyPaid) {
          await supabase.from('orders').update({ status: 'active' }).eq('id', ord.id);
          ord.status = 'active';
        }
      }

      setUserOrders(allOrders);

      const socialOnlyOrders = allOrders
        .filter(o => !isWebsiteOrder(o))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setActiveOrder((prevActive) => {
        if (preferredOrderId) {
          const explicit = socialOnlyOrders.find(o => o.order_id === preferredOrderId);
          if (explicit) return explicit;
        }
        if (prevActive) {
          const prevBKey = getOrderBusinessKey(prevActive, profile?.business_type || 'Main Brand');
          const sameBusinessLatest = socialOnlyOrders.find(
            o => getOrderBusinessKey(o, profile?.business_type || 'Main Brand') === prevBKey
          );
          if (sameBusinessLatest) return sameBusinessLatest;
          const exactMatch = socialOnlyOrders.find(o => o.order_id === prevActive.order_id);
          if (exactMatch) return exactMatch;
        }
        return socialOnlyOrders[0] || null;
      });
      if (socialOnlyOrders.length === 0 && websitesList && websitesList.length > 0) {
        setDashboardView('website');
      }
    } else {
      setUserOrders([]);
      setActiveOrder(null);
      if (websitesList && websitesList.length > 0) {
        setDashboardView('website');
      }
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
      if (!userOrders.some(o => o.order_id === data.order_id)) {
        setUserOrders(prev => [data, ...prev]);
      }
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
        const isStarter = (plan.name || '').toLowerCase().includes('starter');
        const staticQuota = isStarter ? 12 : 15;
        const reelsQuota = isStarter ? 8 : 12;
        const storiesQuota = 15;
        const bName = plan.business_name || profile.business_type || 'Brand';
        const bType = plan.business_type || profile.business_type || 'General';
        const igHandle = plan.instagram_handle || profile.instagram_handle || '';

        // Attempt to lock in original_amount, total_agreed_amount, business details, and updated plan quotas
        try {
          await supabase
            .from('orders')
            .update({
              original_amount: plan.price,
              total_agreed_amount: plan.price,
              static_posts_total: staticQuota,
              reels_total: reelsQuota,
              stories_total: storiesQuota,
              posters_total: 0,
              business_name: bName,
              business_type: bType,
              instagram_handle: igHandle,
              schedule_config: {
                business_name: bName,
                business_type: bType,
                instagram_handle: igHandle
              }
            })
            .eq('id', data.id);
        } catch {
          // Non-fatal if RLS restricts client direct update
        }

        await fetchActiveOrder(data.order_id);
        setShowPlanModal(false); // Only close on success
        return true;
      }
    } catch (err) {
      alert("Unexpected error: " + err.message);
      return false;
    }
  };

  if (isAdmin || isTester) {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base pt-32 pb-20 px-6 flex items-center justify-center">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></span>
      </div>
    );
  }

  if (!user || !profile) return null;

  const rawSocialOrders = userOrders
    .filter(o => !isWebsiteOrder(o))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const socialBusinessMap = new Map();
  rawSocialOrders.forEach(ord => {
    const bKey = getOrderBusinessKey(ord, profile.business_type || 'Main Brand');
    if (!socialBusinessMap.has(bKey)) {
      socialBusinessMap.set(bKey, ord);
    }
  });
  const socialOrders = Array.from(socialBusinessMap.values());
  const websiteOrders = userOrders.filter(o => isWebsiteOrder(o));
  const effectiveSocialOrder =
    socialOrders.find(o => o.order_id === activeOrder?.order_id) ||
    (activeOrder
      ? socialOrders.find(
          o =>
            getOrderBusinessKey(o, profile.business_type || 'Main Brand') ===
            getOrderBusinessKey(activeOrder, profile.business_type || 'Main Brand')
        )
      : null) ||
    socialOrders[0] ||
    null;
  const latestWebsite = clientWebsites[0] || null;
  const openWebsiteRequest = clientWebsites.find(w => OPEN_WEBSITE_STATUSES.includes(w.status)) || null;
  const showWebsiteDashboard =
    !loadingOrder &&
    clientWebsites.length > 0 &&
    (socialOrders.length === 0 || dashboardView === 'website');

  return (
    <div className="min-h-screen bg-base pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 flex justify-between items-end border-b border-themeborder pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif text-primary mb-2">Welcome, {profile.name?.split(' ')[0] || 'Client'}</h1>
            <p className="text-muted text-sm uppercase tracking-widest font-bold">Client ID: <span className="text-accent">{profile.user_id}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell user={user} order={effectiveSocialOrder} />
            <button 
              onClick={() => signOut()} 
              className="text-xs font-bold uppercase tracking-widest text-muted hover:text-danger transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {websiteToast && (
          <div className="mb-6 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle size={15} className="text-emerald-400 shrink-0" />
              {websiteToast}
            </span>
            <button type="button" onClick={() => setWebsiteToast(null)} className="text-emerald-300 hover:text-white cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Multi-Business & Website Project Tabs */}
        {!loadingOrder && (socialOrders.length > 0 || clientWebsites.length > 0) && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-8 border-b border-themeborder/50">
            {socialOrders.map((ord) => {
              const isCurrent = dashboardView !== 'website' && ord.order_id === effectiveSocialOrder?.order_id;
              const bName = ord.business_name || ord.schedule_config?.business_name || (socialOrders.length > 1 ? `Business (${ord.order_id})` : profile.business_type || 'Main Brand');
              const isPaused = ord.status === 'paused';
              const isPending = ord.status === 'pending';
              const isActive = ord.status === 'active';

              return (
                <button
                  key={ord.order_id}
                  onClick={() => {
                    setDashboardView('social');
                    setActiveOrder(ord);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? 'bg-accent text-white border border-accent'
                      : 'bg-surface hover:bg-raised text-muted hover:text-primary border border-themeborder'
                  }`}
                >
                  <Briefcase size={14} className={isCurrent ? 'text-white' : 'text-accent'} />
                  <span className="capitalize">{bName}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-mono font-bold ${
                    isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    isPending ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    isPaused ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-[#222] text-[#888]'
                  }`}>
                    {ord.status}
                  </span>
                </button>
              );
            })}

            {latestWebsite && (
              <button
                type="button"
                onClick={() => setDashboardView('website')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  showWebsiteDashboard
                    ? 'bg-accent text-white border border-accent'
                    : 'bg-surface hover:bg-raised text-muted hover:text-primary border border-themeborder'
                }`}
              >
                <Globe size={14} className={showWebsiteDashboard ? 'text-white' : 'text-accent'} />
                <span>Website: {latestWebsite.status}</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!latestWebsite ? (
                <button
                  type="button"
                  onClick={() => setShowWebsiteModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-primary hover:text-white bg-surface hover:bg-[#3428f8] border border-themeborder hover:border-[#3428f8] transition-all whitespace-nowrap cursor-pointer"
                >
                  <Globe size={14} className="text-accent" /> Build a Website
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (openWebsiteRequest) {
                      setDashboardView('website');
                    } else {
                      setShowWebsiteModal(true);
                    }
                  }}
                  title={openWebsiteRequest ? 'An open website request is already active' : 'Request another website build'}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                    openWebsiteRequest
                      ? 'bg-[#3428f8]/15 text-blue-300 border-[#3428f8]/30'
                      : 'bg-surface hover:bg-[#3428f8] text-primary hover:text-white border-themeborder'
                  }`}
                >
                  <Globe size={14} /> Website: {latestWebsite.status}
                </button>
              )}

              <button
                onClick={() => {
                  setPreSelectedPlanId(null);
                  setShowPlanModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent border border-accent/30 transition-all whitespace-nowrap cursor-pointer"
                title="Enroll another business brand"
              >
                <Plus size={14} /> {socialOrders.length > 0 ? 'Add Another Business' : 'Activate Plan'}
              </button>
            </div>
          </div>
        )}

        {loadingOrder ? (
          <div className="flex justify-center items-center h-64">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></span>
          </div>
        ) : showWebsiteDashboard ? (
          <WebsiteProjectView
            websites={clientWebsites}
            websiteOrders={websiteOrders}
            profile={profile}
            hasSocialPlan={socialOrders.length > 0}
            onOpenActivatePlan={() => {
              setPreSelectedPlanId(null);
              setShowPlanModal(true);
            }}
            onOpenBuildWebsite={() => setShowWebsiteModal(true)}
          />
        ) : effectiveSocialOrder ? (
          effectiveSocialOrder.status === 'pending' && !effectiveSocialOrder.schedule_config?.is_renewal ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface/30 border border-themeborder border-dashed p-12 rounded-3xl text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h3 className="text-3xl font-serif text-primary mb-4">Waiting for Approval</h3>
              <p className="text-muted text-sm max-w-lg mb-2">Your payment details have been received. The admin will manually verify the payment and activate your <strong>{effectiveSocialOrder.plan_name}</strong> shortly.</p>
              <p className="text-muted text-xs font-bold uppercase tracking-widest mt-6 bg-base px-4 py-2 rounded-lg border border-themeborder">Order ID: {effectiveSocialOrder.order_id}</p>
            </motion.div>
          ) : effectiveSocialOrder.status === 'paused' ? (
            (() => {
              const instMetrics = computeOrderInstallmentMetrics(effectiveSocialOrder);
              const overdueInst = instMetrics.nextInstallment;
              const hasPendingProof = instMetrics.hasPendingVerification;

              return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111] border border-red-500/30 p-8 md:p-12 rounded-3xl text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-2xl">
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-500">
                    <ShieldAlert size={36} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-red-400 block mb-2">
                    Account Temporarily Paused
                  </span>
                  <h3 className="text-3xl font-serif text-white mb-3">Overdue Milestone Payment</h3>
                  <p className="text-[#aaa] text-sm max-w-lg mb-6 leading-relaxed">
                    Your <strong>{effectiveSocialOrder.plan_name}</strong> deliverables are temporarily on hold because an installment payment is past due and the grace period has elapsed.
                  </p>

                  {/* Overdue Breakdown Box */}
                  <div className="w-full bg-[#0a0a0a] border border-[#222] p-5 rounded-2xl mb-6 text-left space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#888]">Installment Due:</span>
                      <span className="text-white font-bold font-mono">
                        {overdueInst ? `Installment #${overdueInst.installment_number}` : 'Remaining Balance'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#888]">Amount to Clear:</span>
                      <span className="text-emerald-400 font-bold font-mono text-lg flex items-center">
                        <IndianRupee size={16} />
                        {Number(overdueInst?.amount || instMetrics.balanceDue).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {overdueInst?.due_date && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#888]">Scheduled Due Date:</span>
                        <span className="text-red-400 font-mono">
                          {new Date(overdueInst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#1a1a1a] flex justify-between text-xs text-[#666]">
                      <span>Total Agreed: ₹{instMetrics.totalAgreed.toLocaleString()}</span>
                      <span>Paid to Date: ₹{instMetrics.paidAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  {hasPendingProof ? (
                    <div className="w-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-xl text-xs font-medium mb-6">
                      ✓ Payment proof submitted! Our finance team is verifying your transaction. Your dashboard will automatically unlock as soon as confirmed.
                    </div>
                  ) : (
                    <div className="w-full space-y-3 mb-6">
                      <button
                        onClick={() => setPayModalInstallment(overdueInst || { amount: instMetrics.balanceDue, installment_number: 2 })}
                        className="w-full bg-[#3428f8] hover:bg-[#281cd4] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <CreditCard size={16} /> Pay Installment & Submit Receipt Proof
                      </button>
                    </div>
                  )}

                  {/* Support Link */}
                  <div className="flex items-center gap-4 text-xs text-[#777]">
                    <span>Need assistance?</span>
                    <a
                      href="https://wa.me/919915357805"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3428f8] hover:underline font-bold inline-flex items-center gap-1"
                    >
                      <MessageSquare size={13} /> Contact Support on WhatsApp
                    </a>
                  </div>
                </motion.div>
              );
            })()
          ) : (
            <ActiveDashboard 
              order={effectiveSocialOrder} 
              allClientOrders={rawSocialOrders}
              profile={profile} 
              onRefreshOrder={fetchActiveOrder}
              onOpenPayModal={(inst) => setPayModalInstallment(inst)}
            />
          )
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Empty State / Activation Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface/30 border border-themeborder border-dashed p-8 md:p-12 rounded-3xl flex flex-col items-center justify-center text-center min-h-[350px]"
            >
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6 text-accent">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>
                </svg>
              </div>
              <h3 className="text-2xl font-serif text-primary mb-3">No Active Packages</h3>
              <p className="text-muted text-sm max-w-md mb-8">
                Choose a social media growth plan, request a custom website build, or track an existing order ID.
              </p>
              
              <div className="flex flex-col w-full max-w-xl gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 w-full gap-3">
                  {/* Primary Social Plan CTA */}
                  <button 
                    onClick={() => setShowPlanModal(true)}
                    className="w-full bg-[#3428f8] text-[#EEF2FF] px-6 py-5 text-xs sm:text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all duration-300 rounded-xl hover:scale-[1.02] cursor-pointer"
                  >
                    Activate Plan
                  </button>

                  {/* Website-Only Option CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      if (openWebsiteRequest) {
                        setDashboardView('website');
                      } else {
                        setShowWebsiteModal(true);
                      }
                    }}
                    className="w-full bg-surface hover:bg-raised border border-[#3428f8]/50 hover:border-[#3428f8] text-primary px-6 py-5 text-xs sm:text-sm font-bold uppercase tracking-widest transition-all duration-300 rounded-xl hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Globe size={16} className="text-[#3428f8]" />
                    {latestWebsite ? `Website: ${latestWebsite.status}` : 'Build a Website'}
                  </button>
                </div>

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

      <BuildWebsiteModal
        isOpen={showWebsiteModal}
        onClose={() => setShowWebsiteModal(false)}
        user={user}
        profile={profile}
        existingWebsites={clientWebsites}
        onSuccess={async (res) => {
          await fetchActiveOrder();
          setDashboardView('website');
          setWebsiteToast(
            res?.emailSent
              ? 'Website request submitted! Our team has been notified by email.'
              : 'Website request submitted successfully! Track live status here.'
          );
        }}
      />

      <InstallmentPayModal
        isOpen={Boolean(payModalInstallment)}
        onClose={() => setPayModalInstallment(null)}
        order={effectiveSocialOrder}
        installment={payModalInstallment}
        onSuccess={fetchActiveOrder}
      />
    </div>
  );
}
