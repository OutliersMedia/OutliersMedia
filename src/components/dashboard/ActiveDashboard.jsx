import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Download, Copy, LifeBuoy, CheckCircle, Clock, AlertTriangle, 
  IndianRupee, CreditCard, ShieldCheck, Image as ImageIcon, Video, 
  Layout, Sparkles, Calendar 
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import TicketModal from './TicketModal';
import { generateSingleInvoicePDF } from '../../utils/invoiceGenerator';
import { computeOrderInstallmentMetrics } from '../../utils/installmentEngine';
import { getClientSchedule } from '../../utils/scheduleEngine';

export default function ActiveDashboard({ order, profile, onRefreshOrder, onOpenPayModal }) {
  const [posts, setPosts] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  useEffect(() => {
    if (!order) return;
    
    // Fetch Posts
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('posts_log')
        .select('*')
        .eq('order_id', order.order_id)
        .order('published_at', { ascending: true });
      if (data) setPosts(data);
    };

    // Fetch Tickets
    const fetchTickets = async () => {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('order_id', order.order_id)
        .order('created_at', { ascending: false });
      if (data) setTickets(data);
    };

    fetchPosts();
    fetchTickets();
  }, [order]);

  const planName = order.plan_name || order.plan || 'Starter Plan';
  const scheduleConfig = getClientSchedule(order);

  // Calculate Progress based on plan quotas stored in database or plan defaults
  const targetStatic = order.static_posts_total ?? (planName === 'Starter Plan' ? 10 : 15);
  const targetReels = order.reels_total ?? (planName === 'Starter Plan' ? 3 : 4);
  const targetPosters = order.posters_total ?? (planName === 'Starter Plan' ? 0 : 1);
  
  let targetStories = order.stories_total || scheduleConfig?.totalStories;
  if (!targetStories) {
    if (planName.toLowerCase().includes('growth') || planName.toLowerCase().includes('premium')) {
      targetStories = 32;
    } else {
      targetStories = 0;
    }
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
          <h2 className="text-2xl font-serif text-primary">Project Dashboard</h2>
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
            className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
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
              <span className="text-xs text-muted font-mono uppercase tracking-wider">
                Monthly Retainer Quota
              </span>
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
                glow="shadow-[0_0_12px_rgba(52,40,248,0.35)]"
              />

              {/* Reels: Admin Pink #ec4899 */}
              <ProgressRow 
                label="Reels" 
                current={currentReels} 
                target={targetReels} 
                icon={Video}
                barColor="bg-pink-500"
                textColor="text-pink-500"
                glow="shadow-[0_0_12px_rgba(236,72,153,0.35)]"
              />

              {/* Stories: Admin Amber #fbbf24 */}
              {(targetStories > 0 || currentStories > 0) && (
                <ProgressRow 
                  label="Stories" 
                  current={currentStories} 
                  target={targetStories} 
                  icon={Sparkles}
                  barColor="bg-amber-400"
                  textColor="text-amber-400"
                  glow="shadow-[0_0_12px_rgba(251,191,36,0.35)]"
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
                  glow="shadow-[0_0_12px_rgba(34,197,94,0.35)]"
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
          </motion.div>

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

        {/* Right Column: Billing & Ticketing */}
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

          {/* Support Ticket Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface border border-themeborder rounded-3xl p-6 md:p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif text-primary flex items-center gap-2">
                <LifeBuoy size={20} className="text-accent" />
                Support
              </h3>
              <button 
                onClick={() => setIsTicketModalOpen(true)}
                className="text-xs bg-accent/10 text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-full font-bold uppercase tracking-widest transition-colors cursor-pointer"
              >
                + New Ticket
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {tickets.length === 0 ? (
                <div className="text-center p-6 bg-raised rounded-2xl border border-themeborder border-dashed">
                  <p className="text-muted text-sm">No open tickets. Need a revision or have a question? Raise a ticket!</p>
                </div>
              ) : (
                tickets.map(ticket => (
                  <div key={ticket.id} className="p-4 bg-raised border border-themeborder rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary truncate pr-2">{ticket.category}</span>
                      {ticket.status === 'resolved' ? (
                        <span className="text-green-500 flex items-center gap-1 text-xs font-bold uppercase"><CheckCircle size={12} /> Resolved</span>
                      ) : (
                        <span className="text-yellow-500 flex items-center gap-1 text-xs font-bold uppercase"><Clock size={12} /> Open</span>
                      )}
                    </div>
                    <p className="text-sm text-body line-clamp-2">{ticket.message}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <TicketModal 
        isOpen={isTicketModalOpen} 
        onClose={() => setIsTicketModalOpen(false)} 
        order={order} 
        onTicketCreated={(newTicket) => setTickets([newTicket, ...tickets])}
      />
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
