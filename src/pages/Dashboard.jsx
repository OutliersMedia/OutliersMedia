import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth, checkIsAdmin, checkIsTester } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import { IndianRupee, AlertTriangle, ShieldAlert, CreditCard, MessageSquare, ExternalLink } from 'lucide-react';
import PlanModal from '../components/dashboard/PlanModal';
import ActiveDashboard from '../components/dashboard/ActiveDashboard';
import InstallmentPayModal from '../components/dashboard/InstallmentPayModal';
import NotificationBell from '../components/dashboard/NotificationBell';
import { computeOrderInstallmentMetrics } from '../utils/installmentEngine';

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
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [preSelectedPlanId, setPreSelectedPlanId] = useState(null);
  const [payModalInstallment, setPayModalInstallment] = useState(null);

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
      const instMetrics = computeOrderInstallmentMetrics(data);
      // Automated suspension check: if active but past grace period, auto-pause
      if (data.status === 'active' && instMetrics.isOverdue) {
        await supabase.from('orders').update({ status: 'paused' }).eq('id', data.id);
        data.status = 'paused';
      }
      // Automated restoration check: if paused but all overdue payments confirmed, auto-restore
      if (data.status === 'paused' && !instMetrics.isOverdue && instMetrics.isFullyPaid) {
        await supabase.from('orders').update({ status: 'active' }).eq('id', data.id);
        data.status = 'active';
      }
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

  return (
    <div className="min-h-screen bg-base pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 flex justify-between items-end border-b border-themeborder pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif text-primary mb-2">Welcome, {profile.name?.split(' ')[0] || 'Client'}</h1>
            <p className="text-muted text-sm uppercase tracking-widest font-bold">Client ID: <span className="text-accent">{profile.user_id}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell user={user} order={activeOrder} />
            <button 
              onClick={() => signOut()} 
              className="text-xs font-bold uppercase tracking-widest text-muted hover:text-danger transition-colors"
            >
              Sign Out
            </button>
          </div>
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
            (() => {
              const instMetrics = computeOrderInstallmentMetrics(activeOrder);
              const overdueInst = instMetrics.nextInstallment;
              const hasPendingProof = instMetrics.hasPendingVerification;

              return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111] border border-red-500/30 p-8 md:p-12 rounded-3xl text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-2xl">
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
                    <ShieldAlert size={36} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3">
                    Account Temporarily Paused
                  </span>
                  <h3 className="text-3xl font-serif text-white mb-3">Overdue Milestone Payment</h3>
                  <p className="text-[#aaa] text-sm max-w-lg mb-6 leading-relaxed">
                    Your <strong>{activeOrder.plan_name}</strong> deliverables are temporarily on hold because an installment payment is past due and the grace period has elapsed.
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
                        className="w-full bg-[#3428f8] hover:bg-[#281cd4] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(52,40,248,0.35)] flex items-center justify-center gap-2"
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
              order={activeOrder} 
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

      <InstallmentPayModal
        isOpen={Boolean(payModalInstallment)}
        onClose={() => setPayModalInstallment(null)}
        order={activeOrder}
        installment={payModalInstallment}
        onSuccess={fetchActiveOrder}
      />
    </div>
  );
}
