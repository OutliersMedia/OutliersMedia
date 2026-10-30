import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Download, Copy, CheckCircle, Clock, AlertTriangle, 
  IndianRupee, CreditCard, ShieldCheck, Image as ImageIcon, Video, 
  Layout, Flame, Calendar, ExternalLink, Globe, X, UploadCloud, Check
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { generateSingleInvoicePDF } from '../../utils/invoiceGenerator';
import { computeOrderInstallmentMetrics } from '../../utils/installmentEngine';
import { 
  getClientSchedule,
  getSpecialDeliverables,
  fetchSpecialDeliverablesFromDB,
  saveSpecialDeliverable
} from '../../utils/scheduleEngine';
import { triggerLocalNotification } from '../../utils/pushManager';

export default function ActiveDashboard({ order, profile, onRefreshOrder, onOpenPayModal }) {
  const [posts, setPosts] = useState([]);

  // Special Deliverables & Add-ons state
  const [specialDeliverables, setSpecialDeliverables] = useState([]);
  const [selectedSpecialForPayment, setSelectedSpecialForPayment] = useState(null);
  const [specialPayTxnId, setSpecialPayTxnId] = useState('');
  const [specialPayReceiptFile, setSpecialPayReceiptFile] = useState(null);
  const [payingSpecial, setPayingSpecial] = useState(false);
  const [specialPaySuccess, setSpecialPaySuccess] = useState(false);

  // Sync and fetch special deliverables
  useEffect(() => {
    if (!order) return;
    let isMounted = true;

    const loadSpecials = async () => {
      // 1. Initial extraction from order
      const initial = getSpecialDeliverables(order);
      if (isMounted && initial && initial.length > 0) {
        setSpecialDeliverables(initial);
      }

      // 2. Fetch from database table
      try {
        const fromDb = await fetchSpecialDeliverablesFromDB(order.id || order.order_id);
        if (isMounted && Array.isArray(fromDb) && fromDb.length > 0) {
          setSpecialDeliverables(fromDb);
        }
      } catch (err) {
        console.warn("Notice: special deliverables DB query fallback:", err);
      }
    };

    loadSpecials();

    const handleCustomEvent = (e) => {
      const detailOrderId = e?.detail?.orderId;
      if (!detailOrderId || detailOrderId === order.id || detailOrderId === order.order_id) {
        loadSpecials();
      }
    };
    window.addEventListener('om_special_deliverable_changed', handleCustomEvent);

    const specialsChannel = supabase
      .channel(`client-specials-${order.order_id || order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_deliverables' }, () => {
        loadSpecials();
      })
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('om_special_deliverable_changed', handleCustomEvent);
      supabase.removeChannel(specialsChannel);
    };
  }, [order?.id, order?.order_id, order?.schedule_config]);

  // Submit payment proof for a special deliverable
  const handlePaySpecialProof = async (e) => {
    e.preventDefault();
    if (!selectedSpecialForPayment) return;
    if (!specialPayTxnId.trim()) {
      alert("Please enter the UPI Transaction Reference ID (UTR).");
      return;
    }
    if (!specialPayReceiptFile) {
      alert("Please upload a payment screenshot receipt.");
      return;
    }

    setPayingSpecial(true);
    try {
      const fileExt = specialPayReceiptFile.name.split('.').pop() || 'png';
      const fileName = `special_proof_${order.order_id || 'ord'}_${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, specialPayReceiptFile, { upsert: true });

      let receiptUrl = null;
      if (!uploadErr) {
        const { data: pubData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receiptUrl = pubData?.publicUrl || null;
      }

      const currentReceipts = Array.isArray(selectedSpecialForPayment.receipt_urls)
        ? [...selectedSpecialForPayment.receipt_urls]
        : (selectedSpecialForPayment.receipt_url ? [selectedSpecialForPayment.receipt_url] : []);
      if (receiptUrl) currentReceipts.push(receiptUrl);

      const updated = {
        ...selectedSpecialForPayment,
        payment_status: 'pending_verification',
        utr_reference: specialPayTxnId.trim(),
        receipt_url: receiptUrl || selectedSpecialForPayment.receipt_url,
        receipt_urls: currentReceipts
      };

      await saveSpecialDeliverable(order, updated);
      setSpecialPaySuccess(true);
      setTimeout(() => {
        setSpecialPaySuccess(false);
        setSelectedSpecialForPayment(null);
        setSpecialPayTxnId('');
        setSpecialPayReceiptFile(null);
        if (onRefreshOrder) onRefreshOrder();
      }, 2000);
    } catch (err) {
      alert("Error submitting payment proof: " + err.message);
    } finally {
      setPayingSpecial(false);
    }
  };

  useEffect(() => {
    if (!order?.order_id) return;
    let isMounted = true;
    
    // Fetch Posts
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('posts_log')
        .select('*')
        .eq('order_id', order.order_id)
        .order('published_at', { ascending: true });
      if (data && isMounted) {
        setPosts(data);

        // Offline Catch-up Notification: fires if a post was uploaded while user was offline/closed
        try {
          if (data.length > 0) {
            const latestPost = data[data.length - 1];
            const storageKey = `outliers_seen_post_${order.order_id}`;
            const lastSeenId = localStorage.getItem(storageKey);

            if (latestPost && latestPost.id && String(latestPost.id) !== lastSeenId) {
              const pubTime = new Date(latestPost.published_at || latestPost.created_at || Date.now()).getTime();
              const isRecent = (Date.now() - pubTime) < 48 * 60 * 60 * 1000; // uploaded within last 48h

              if (lastSeenId && isRecent && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const formattedType = (latestPost.post_type || 'post').toUpperCase();
                triggerLocalNotification(latestPost.title || 'New Deliverable Available', {
                  body: `🚀 New ${formattedType} deliverable is now live on your Outliers Media dashboard.`,
                  url: '/dashboard'
                });
              }
              localStorage.setItem(storageKey, String(latestPost.id));
            }
          }
        } catch (e) {
          console.warn("Offline catch-up notification notice:", e);
        }
      }
    };

    fetchPosts();

    // 1. Real-time broadcast channel (instant submit & revert updates from Admin)
    const broadcastChannel = supabase
      .channel('outliers-deliverables-live')
      .on('broadcast', { event: 'deliverables_sync' }, (payload) => {
        const msg = payload?.payload || {};
        if (!msg.orderId || msg.orderId === order.order_id) {
          fetchPosts();
          if (onRefreshOrder) onRefreshOrder();
        }
      })
      .subscribe();

    // 2. Real-time postgres_changes on posts_log table (INSERT, UPDATE, DELETE)
    const dbChannel = supabase
      .channel(`client-posts-log-${order.order_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts_log' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    // 3. Background interval & visibility refresh for rock-solid live updates
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPosts();
      }
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchPosts();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [order?.order_id]);

  const planName = order.plan_name || order.plan || 'Starter Plan';
  const scheduleConfig = getClientSchedule(order);

  // Calculate Progress based on plan quotas stored in database or updated plan defaults
  const isStarterPlan = planName.toLowerCase().includes('starter');
  const defaultStaticForPlan = isStarterPlan ? 12 : 15;
  const defaultReelsForPlan = isStarterPlan ? 8 : 12;

  const targetStatic = (order.static_posts_total && order.static_posts_total !== 10)
    ? order.static_posts_total
    : defaultStaticForPlan;
  const targetReels = (order.reels_total && order.reels_total !== 3 && order.reels_total !== 4)
    ? order.reels_total
    : defaultReelsForPlan;
  const targetPosters = 0; // Physical poster removed
  
  let targetStories = order.stories_total || scheduleConfig?.totalStories;
  if (!targetStories || targetStories === 32) {
    targetStories = 15;
  }

  const hasWebsite = order.has_website || planName.toLowerCase().includes('premium');

  const currentStatic = posts.filter(p => p.post_type === 'static').length;
  const currentReels = posts.filter(p => p.post_type === 'reel').length;
  const currentStories = posts.filter(p => p.post_type === 'story').length;
  const currentPosters = posts.filter(p => p.post_type === 'poster').length;

  // --- INSTALLMENTS & DAYS LEFT CALCULATION (WITHOUT GRACE PERIOD) ---
  const instMetrics = computeOrderInstallmentMetrics(order);
  
  // Find first unpaid installment
  const nextMilestone = instMetrics.hasInstallments 
    ? instMetrics.installments.find(i => i.status !== 'paid')
    : (!instMetrics.isFullyPaid ? { installment_number: 1, amount: instMetrics.balanceDue, due_date: order.created_at } : null);

  let daysUntilNextPayment = null;
  let nextDueDateFormatted = null;
  let isNextPaymentDueToday = false;
  let isNextPaymentOverdue = false;

  if (nextMilestone && nextMilestone.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(nextMilestone.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffMs = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    daysUntilNextPayment = diffDays;
    nextDueDateFormatted = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    isNextPaymentDueToday = diffDays === 0;
    isNextPaymentOverdue = diffDays < 0;
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.order_id);
    alert('Order ID copied to clipboard!');
  };

  const handleDownloadInvoice = () => {
    try {
      generateSingleInvoicePDF(order, profile);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      alert('Failed to generate invoice. Please try again.');
    }
  };

  // Activity Graph: Segmented by post type matching exact Admin colors:
  // Static Post: #3428f8, Reel: #ec4899, Story: #fbbf24, Poster: #22c55e
  const graphData = posts.length > 0 ? Object.values(posts.reduce((acc, curr) => {
    const date = new Date(curr.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[date]) {
      acc[date] = { name: date, static: 0, reel: 0, story: 0, poster: 0, total: 0 };
    }
    const type = curr.post_type || 'static';
    if (acc[date][type] !== undefined) {
      acc[date][type] += 1;
    } else {
      acc[date].static += 1;
    }
    acc[date].total += 1;
    return acc;
  }, {})) : [
    { name: 'Week 1', static: 0, reel: 0, story: 0, poster: 0, total: 0 },
    { name: 'Week 2', static: 0, reel: 0, story: 0, poster: 0, total: 0 },
    { name: 'Week 3', static: 0, reel: 0, story: 0, poster: 0, total: 0 },
    { name: 'Week 4', static: 0, reel: 0, story: 0, poster: 0, total: 0 },
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Top Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-themeborder rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {planName}
            </span>
            <span className="text-muted text-sm font-mono">{order.order_id}</span>
            <button onClick={handleCopyId} className="text-muted hover:text-primary transition-colors cursor-pointer" title="Copy Order ID">
              <Copy size={16} />
            </button>

            {/* Days Left for Next Payment (Without Grace Period) Pill */}
            {nextMilestone && daysUntilNextPayment !== null ? (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isNextPaymentOverdue 
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : isNextPaymentDueToday 
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                  : 'bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/30'
              }`}>
                <Clock size={12} />
                {isNextPaymentOverdue 
                  ? `Payment Due (${Math.abs(daysUntilNextPayment)}d ago)` 
                  : isNextPaymentDueToday 
                  ? 'Payment Due Today' 
                  : `${daysUntilNextPayment} Day${daysUntilNextPayment !== 1 ? 's' : ''} Left for Next Payment`}
              </span>
            ) : instMetrics.isFullyPaid ? (
              <span className="bg-green-500/15 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle size={12} /> Retainer Paid in Full
              </span>
            ) : null}
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-serif text-primary capitalize">
              {order.business_name || order.schedule_config?.business_name || 'Project Dashboard'}
            </h2>
            {(order.instagram_handle || profile?.instagram_handle) && (
              <p className="text-xs text-pink-400 font-mono mt-0.5">
                {order.instagram_handle || profile?.instagram_handle}
              </p>
            )}
          </div>
        </div>

        <button 
          onClick={handleDownloadInvoice}
          className="flex items-center gap-2 bg-raised border border-themeborder hover:border-accent text-primary px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all cursor-pointer"
        >
          <Download size={16} />
          Invoice PDF
        </button>
      </motion.div>

      {/* Grace Period Alert Banner (if in grace period) */}
      {instMetrics.inGracePeriod && nextMilestone && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                Action Required: Installment #{nextMilestone.installment_number} is Due (₹{Number(nextMilestone.amount).toLocaleString('en-IN')})
              </p>
              <p className="text-[#aaa] text-xs mt-0.5">
                You have <strong className="text-amber-400">{instMetrics.graceDaysLeft} day(s)</strong> remaining in your grace period. Clear payment now to keep deliverables uninterrupted.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPayModal && onOpenPayModal(nextMilestone)}
            className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard size={14} /> Pay Installment Now
          </button>
        </motion.div>
      )}

      {/* Pending Proof Review Notice */}
      {instMetrics.hasPendingVerification && (
        <div className="bg-[#3428f8]/10 border border-[#3428f8]/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-white">
          <Clock size={16} className="text-[#3428f8]" />
          <span>
            Payment proof submitted for your milestone installment. Admin verification is in progress.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Progress & Activity */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Deliverables Tracker (Admin Colors Applied) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-glass backdrop-blur-md border border-glass-border p-6 md:p-8 rounded-3xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif text-primary">Deliverables Tracker</h3>
              <div className="flex items-center gap-2.5">
                <span className="bg-green-500/10 text-green-400 border border-green-500/25 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  Live Sync
                </span>
                <span className="text-xs text-muted font-mono uppercase tracking-wider hidden sm:inline">
                  Monthly Retainer Quota
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Static Posts: Admin Indigo #3428f8 */}
              <ProgressRow 
                label="Static Posts" 
                current={currentStatic} 
                target={targetStatic} 
                icon={ImageIcon}
                barColor="bg-[#3428f8]"
                textColor="text-[#3428f8]"
              />

              {/* Reels: Admin Pink #ec4899 */}
              <ProgressRow 
                label="Reels" 
                current={currentReels} 
                target={targetReels} 
                icon={Video}
                barColor="bg-pink-500"
                textColor="text-pink-500"
              />

              {/* Stories: Admin Amber #fbbf24 */}
              {(targetStories > 0 || currentStories > 0) && (
                <ProgressRow 
                  label="Stories" 
                  current={currentStories} 
                  target={targetStories} 
                  icon={Flame}
                  barColor="bg-amber-400"
                  textColor="text-amber-400"
                />
              )}

              {/* Posters: Admin Green #22c55e */}
              {targetPosters > 0 && (
                <ProgressRow 
                  label="Physical Posters" 
                  current={currentPosters} 
                  target={targetPosters} 
                  icon={Layout}
                  barColor="bg-green-500"
                  textColor="text-green-500"
                />
              )}

              {hasWebsite && (
                <div className="flex flex-col gap-2 bg-[#0e0e0e] border border-[#222] p-4 rounded-2xl">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-white">Custom Brand Website</span>
                    <span className="text-[#3428f8]">In Development</span>
                  </div>
                  <div className="w-full bg-[#1c1c1c] rounded-full h-3 overflow-hidden border border-[#282828] p-0.5">
                    <div className="bg-[#3428f8] h-full rounded-full w-[45%]"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Delivered Content Feed */}
            {posts.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#1e1e1e] flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#888]">
                    Recent Delivered Content
                  </span>
                  <span className="text-[10px] font-mono text-[#666]">
                    {posts.length} Total Delivered
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[210px] overflow-y-auto pr-1 custom-scrollbar">
                  {[...posts].reverse().map((item) => {
                    const typeBadge = item.post_type === 'reel'
                      ? { label: 'Reel', color: 'text-pink-400 bg-pink-500/15 border-pink-500/25' }
                      : item.post_type === 'story'
                      ? { label: 'Story', color: 'text-amber-400 bg-amber-400/15 border-amber-400/25' }
                      : { label: 'Static Post', color: 'text-[#6c63ff] bg-[#3428f8]/15 border-[#3428f8]/30' };
                    return (
                      <div
                        key={item.id}
                        className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3 flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${typeBadge.color}`}>
                              {typeBadge.label}
                            </span>
                            <span className="text-[10px] text-[#666] font-mono">
                              {item.published_at
                                ? new Date(item.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                : ''}
                            </span>
                          </div>
                          <p className="text-xs text-white font-medium truncate">{item.title}</p>
                        </div>
                        <CheckCircle size={15} className="text-green-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Special Deliverables & Custom Projects (Spin-the-wheel, Web Apps, Extra Add-ons) */}
          {specialDeliverables.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-glass backdrop-blur-md border border-[#3428f8]/30 p-6 md:p-8 rounded-3xl relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#3428f8]/15 text-blue-400 border border-[#3428f8]/30">
                      <Flame size={16} />
                    </span>
                    <h3 className="text-xl font-serif text-white">Special Deliverables & Custom Projects</h3>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Custom web apps, special campaigns, and add-on deliverables crafted specifically for your brand.
                  </p>
                </div>

                <span className="text-[10px] font-mono font-bold bg-[#3428f8]/10 text-blue-400 border border-[#3428f8]/30 px-3 py-1 rounded-full uppercase tracking-wider">
                  {specialDeliverables.length} Special Item{specialDeliverables.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {specialDeliverables.map((item) => {
                  const fee = Number(item.price || item.fee || 0);
                  const isComp = Boolean(item.is_complimentary);
                  const isPaid = item.payment_status === 'paid';
                  const isReview = item.payment_status === 'pending_verification';

                  return (
                    <div
                      key={item.id}
                      className="bg-[#0b0c10] border border-[#232634] hover:border-[#3428f8]/40 rounded-2xl p-5 flex flex-col justify-between transition-all group"
                    >
                      <div>
                        {/* Top row: Type Badge + Status */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#3428f8]/15 text-blue-400 border border-[#3428f8]/30">
                            {item.type || 'Custom Deliverable'}
                          </span>

                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.status === 'delivered'
                              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}>
                            {item.status === 'delivered' ? <CheckCircle size={10} /> : <Clock size={10} />}
                            <span className="capitalize">{item.status === 'delivered' ? 'Ready / Delivered' : 'In Progress'}</span>
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h4 className="text-white font-bold text-base group-hover:text-blue-400 transition-colors mb-1.5">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="text-xs text-[#888] leading-relaxed mb-4 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Delivery Date */}
                        {item.delivery_date && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#666] mb-4">
                            <Calendar size={12} className="text-blue-400" />
                            <span>Delivery Date: <strong className="text-[#aaa]">{new Date(item.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Project Link & Payment / Price Badge */}
                      <div className="pt-3 border-t border-[#1c1d24] flex flex-wrap items-center justify-between gap-2.5 mt-2">
                        <div>
                          {item.project_url ? (
                            <a
                              href={item.project_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-white bg-[#3428f8]/15 hover:bg-[#3428f8] px-3 py-1.5 rounded-xl border border-[#3428f8]/30 transition-all cursor-pointer shadow-sm"
                            >
                              <ExternalLink size={13} /> Open Project ↗
                            </a>
                          ) : (
                            <span className="text-[11px] text-[#666] italic">Link shared upon completion</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isComp ? (
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                              Complimentary (₹0)
                            </span>
                          ) : isPaid ? (
                            <span className="text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/25 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
                              <CheckCircle size={12} /> ₹{fee.toLocaleString()} Paid
                            </span>
                          ) : isReview ? (
                            <span className="text-[10px] font-bold text-blue-400 bg-[#3428f8]/15 border border-[#3428f8]/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Clock size={11} className="animate-spin" /> Verifying Payment
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-400">
                                ₹{fee.toLocaleString()}
                              </span>
                              <button
                                onClick={() => setSelectedSpecialForPayment(item)}
                                className="text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard size={12} /> Pay Due
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Activity Graph: Stacked Bars with exact Admin Colors */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-glass backdrop-blur-md border border-glass-border p-6 md:p-8 rounded-3xl h-[440px] flex flex-col"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <div>
                <h3 className="text-xl font-serif text-primary">Posting Activity</h3>
                <p className="text-xs text-muted">Weekly published content segmented by post format</p>
              </div>

              {/* Color Legend (Admin Themes) */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[#3428f8]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3428f8]"></span> Posts
                </span>
                <span className="flex items-center gap-1.5 text-pink-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span> Reels
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Stories
                </span>
                {targetPosters > 0 && (
                  <span className="flex items-center gap-1.5 text-green-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Posters
                  </span>
                )}
              </div>
            </div>

            <div className="flex-grow w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    content={<CustomChartTooltip />}
                  />
                  {/* Admin Colors: Static Post (#3428f8), Reel (#ec4899), Story (#fbbf24), Poster (#22c55e) */}
                  <Bar dataKey="static" name="Static Posts" stackId="a" fill="#3428f8" maxBarSize={45} />
                  <Bar dataKey="reel" name="Reels" stackId="a" fill="#ec4899" maxBarSize={45} />
                  <Bar dataKey="story" name="Stories" stackId="a" fill="#fbbf24" maxBarSize={45} />
                  {targetPosters > 0 && (
                    <Bar dataKey="poster" name="Posters" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Billing & Invoices */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          
          {/* Milestone Payment & Billing Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-surface border border-themeborder rounded-3xl p-6 md:p-8 flex flex-col gap-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-serif text-primary flex items-center gap-2">
                <CreditCard size={20} className="text-accent" />
                Billing & Retainer
              </h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                instMetrics.isFullyPaid 
                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {instMetrics.isFullyPaid ? 'Fully Paid' : 'Active EMI Plan'}
              </span>
            </div>

            {/* Price Overview */}
            <div className="bg-raised p-4 rounded-2xl border border-themeborder flex justify-between items-center">
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Agreed Plan Total</span>
                <span className="text-xl font-serif text-primary font-bold">₹{instMetrics.totalAgreed.toLocaleString('en-IN')}</span>
                {instMetrics.discountAmount > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                    ₹{instMetrics.discountAmount.toLocaleString('en-IN')} Discount Applied
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Outstanding Balance</span>
                <span className={`text-xl font-mono font-bold ${instMetrics.balanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ₹{instMetrics.balanceDue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-muted block mt-0.5">₹{instMetrics.paidAmount.toLocaleString('en-IN')} Paid</span>
              </div>
            </div>

            {/* Next Payment Countdown Box (Without Grace Period) */}
            {nextMilestone && daysUntilNextPayment !== null ? (
              <div className={`p-4 rounded-2xl border transition-all ${
                isNextPaymentOverdue 
                  ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                  : isNextPaymentDueToday 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-[#3428f8]/10 border-[#3428f8]/30 text-white'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest block text-[#888]">
                      Next Milestone Payment
                    </span>
                    <h4 className="text-xl font-serif font-bold text-white mt-0.5 flex items-center gap-1">
                      <IndianRupee size={18} className="text-emerald-400" />
                      {Number(nextMilestone.amount).toLocaleString('en-IN')}
                    </h4>
                  </div>

                  {/* Days Left Countdown Pill (Without Grace Period) */}
                  <div>
                    {isNextPaymentOverdue ? (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={12} /> Due {Math.abs(daysUntilNextPayment)}d Ago
                      </span>
                    ) : isNextPaymentDueToday ? (
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        <Clock size={12} /> Due Today
                      </span>
                    ) : (
                      <span className="bg-[#3428f8]/20 text-[#3428f8] border border-[#3428f8]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={12} /> {daysUntilNextPayment} Day{daysUntilNextPayment !== 1 ? 's' : ''} Left
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs">
                  <span className="text-[#aaa]">
                    Due Date: <strong className="text-white font-mono">{nextDueDateFormatted}</strong>
                  </span>
                  <button
                    onClick={() => onOpenPayModal && onOpenPayModal(nextMilestone)}
                    className="text-xs bg-[#3428f8] hover:bg-[#281cd4] text-white px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                  >
                    Pay Milestone
                  </button>
                </div>
              </div>
            ) : instMetrics.isFullyPaid ? (
              <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-2 text-green-400 text-xs font-bold">
                <CheckCircle size={16} /> All Milestone Payments Cleared (No Upcoming Dues)
              </div>
            ) : null}

            {/* Installments List */}
            {instMetrics.hasInstallments && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Installment Schedule:</span>
                {instMetrics.installments.map((inst, idx) => {
                  const isPaid = inst.status === 'paid';
                  const isPendingReview = inst.status === 'pending_verification';

                  // Days calculation for this specific installment
                  let instDaysLeft = null;
                  if (inst.due_date && !isPaid) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const due = new Date(inst.due_date);
                    due.setHours(0, 0, 0, 0);
                    instDaysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  }

                  return (
                    <div key={idx} className="p-3 bg-raised border border-themeborder rounded-xl flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary">Installment #{inst.installment_number || idx + 1}</span>
                          <span className="text-xs font-mono font-bold text-accent">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                        </div>
                        <span className="text-[10px] text-muted block mt-0.5">
                          {isPaid 
                            ? `Paid on ${inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Verified'}`
                            : (inst.due_date 
                                ? (instDaysLeft !== null && instDaysLeft >= 0 
                                    ? `Due ${new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${instDaysLeft}d left)`
                                    : `Due ${new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`)
                                : 'Scheduled')
                          }
                        </span>
                      </div>

                      <div>
                        {isPaid ? (
                          <span className="text-green-500 bg-green-500/10 border border-green-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle size={10} /> Paid
                          </span>
                        ) : isPendingReview ? (
                          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock size={10} /> In Review
                          </span>
                        ) : (
                          <button
                            onClick={() => onOpenPayModal && onOpenPayModal(inst)}
                            className="bg-[#3428f8] hover:bg-[#281cd4] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all shadow-sm cursor-pointer"
                          >
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleDownloadInvoice}
              className="w-full bg-raised hover:bg-themeborder/50 border border-themeborder text-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} /> Download Tax Invoice PDF
            </button>
          </motion.div>
        </div>
      </div>

      {/* Pay Due Modal for Special Deliverables */}
      <AnimatePresence>
        {selectedSpecialForPayment && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => !payingSpecial && setSelectedSpecialForPayment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0f0f12] border border-[#2b2d3d] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-[#20222e] flex justify-between items-center bg-[#14151e]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-[#3428f8]/15 px-2.5 py-0.5 rounded-full border border-[#3428f8]/30">
                    Special Deliverable Add-on
                  </span>
                  <h3 className="text-lg font-serif text-white mt-1">
                    Pay for {selectedSpecialForPayment.title}
                  </h3>
                </div>
                <button
                  onClick={() => !payingSpecial && setSelectedSpecialForPayment(null)}
                  className="p-2 text-[#777] hover:text-white rounded-xl hover:bg-[#222] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {specialPaySuccess ? (
                  <div className="py-10 text-center flex flex-col items-center">
                    <CheckCircle size={46} className="text-green-400 mb-3 animate-bounce" />
                    <h4 className="text-lg font-bold text-white mb-1.5">Payment Submitted!</h4>
                    <p className="text-[#888] text-xs max-w-xs">
                      Your payment receipt and UTR reference have been recorded. Our finance team will verify and mark it as settled.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#14151e] border border-[#252838] p-4 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block">Amount to Clear</span>
                        <span className="text-2xl font-serif text-white flex items-center gap-1 mt-0.5">
                          <IndianRupee size={20} className="text-emerald-400" />
                          {Number(selectedSpecialForPayment.price || selectedSpecialForPayment.fee || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#3428f8]/15 text-blue-400 border border-[#3428f8]/30">
                        {selectedSpecialForPayment.type || 'Custom'}
                      </span>
                    </div>

                    {/* UPI QR & ID */}
                    <div className="bg-[#12131a] border border-[#20222e] p-4 rounded-2xl flex flex-col items-center text-center">
                      <p className="text-xs text-[#aaa] font-medium mb-3">
                        Scan via Google Pay, PhonePe, Paytm or Any UPI App:
                      </p>
                      <div className="p-3 bg-white rounded-2xl shadow-lg border border-white mb-3">
                        <img src="/qr.png" alt="Outliers Media UPI QR" className="w-40 h-40 object-contain" />
                      </div>
                      <div className="bg-[#191b26] px-3.5 py-1.5 rounded-xl border border-[#2a2c3d] flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#777]">UPI ID:</span>
                        <span className="text-xs font-mono text-emerald-400 font-bold select-all">dhimanpashvinder@okicici</span>
                      </div>
                    </div>

                    {/* Submission Form */}
                    <form onSubmit={handlePaySpecialProof} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#aaa] mb-1.5">
                          UPI Reference / UTR Number *
                        </label>
                        <input
                          type="text"
                          value={specialPayTxnId}
                          onChange={(e) => setSpecialPayTxnId(e.target.value)}
                          required
                          className="w-full bg-[#14151e] border border-[#2d3045] text-white p-3 rounded-xl text-sm font-mono focus:border-[#3428f8] outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#aaa] mb-1.5">
                          Upload Payment Screenshot *
                        </label>
                        <div className="relative border-2 border-dashed border-[#2d3045] hover:border-[#3428f8] rounded-2xl p-4 text-center cursor-pointer transition-colors bg-[#14151e]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setSpecialPayReceiptFile(e.target.files[0])}
                            required
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <UploadCloud size={24} className={`mx-auto mb-1 ${specialPayReceiptFile ? 'text-emerald-400' : 'text-[#666]'}`} />
                          <p className="text-xs text-white font-medium truncate">
                            {specialPayReceiptFile ? specialPayReceiptFile.name : 'Click to select screenshot'}
                          </p>
                          <p className="text-[10px] text-[#666] mt-0.5">PNG, JPG up to 10MB</p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={payingSpecial || !specialPayTxnId || !specialPayReceiptFile}
                        className="w-full bg-[#3428f8] hover:bg-[#2d23c9] disabled:bg-[#3428f8]/40 text-white p-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex justify-center items-center gap-2 cursor-pointer"
                      >
                        {payingSpecial ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        ) : (
                          <>
                            <CheckCircle size={16} /> Submit Payment Proof
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ProgressRow component with admin styling: Static (#3428f8), Reel (#ec4899), Story (#fbbf24), Poster (#22c55e)
function ProgressRow({ label, current, target, icon: Icon, barColor, textColor, glow }) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  
  return (
    <div className="flex flex-col gap-2.5 bg-[#0e0e0e] border border-[#222] p-4 rounded-2xl hover:border-[#333] transition-colors">
      <div className="flex justify-between items-center text-sm font-bold">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={`p-2 rounded-xl bg-white/5 ${textColor}`}>
              <Icon size={16} />
            </div>
          )}
          <span className="text-white font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-bold ${textColor}`}>
            {current} / {target}
          </span>
          <span className="text-[11px] text-[#666] font-mono">
            ({percent}%)
          </span>
        </div>
      </div>

      {/* Bargraph Line */}
      <div className="w-full bg-[#1c1c1c] rounded-full h-3 overflow-hidden border border-[#282828] p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor} ${glow || ''}`}
        />
      </div>
    </div>
  );
}

// Custom tooltip for chart showing breakdowns by format
function CustomChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    return (
      <div className="bg-[#141414] border border-[#333] p-3 rounded-2xl shadow-2xl text-xs min-w-[170px]">
        <p className="text-white font-bold mb-2 border-b border-[#252525] pb-1.5">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between items-center gap-3">
              <span className="flex items-center gap-2 text-[#aaa]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="text-white font-mono font-bold">{entry.value}</span>
            </div>
          ))}
          <div className="pt-1.5 border-t border-[#252525] flex justify-between items-center text-white font-bold">
            <span>Total Deliverables:</span>
            <span className="font-mono text-emerald-400">{total}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
