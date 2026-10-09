import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Copy, LifeBuoy, CheckCircle, Clock, AlertTriangle, IndianRupee, CreditCard, ShieldCheck } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import TicketModal from './TicketModal';
import { generateSingleInvoicePDF } from '../../utils/invoiceGenerator';
import { computeOrderInstallmentMetrics } from '../../utils/installmentEngine';

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

  // Calculate Progress based on plan quotas stored in database or plan name defaults
  let targetStatic = order.static_posts_total ?? (planName === 'Starter Plan' ? 10 : 15);
  let targetReels = order.reels_total ?? (planName === 'Starter Plan' ? 3 : 4);
  let targetPosters = order.posters_total ?? (planName === 'Starter Plan' ? 0 : 1);
  const hasWebsite = order.has_website || planName === 'Premium Plan';

  const currentStatic = posts.filter(p => p.post_type === 'static').length;
  const currentReels = posts.filter(p => p.post_type === 'reel').length;
  const currentPosters = posts.filter(p => p.post_type === 'poster').length;

  const instMetrics = computeOrderInstallmentMetrics(order);
  const nextInst = instMetrics.nextInstallment;

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

  // Mock data for graph if no posts yet
  const graphData = posts.length > 0 ? posts.reduce((acc, curr) => {
    const date = new Date(curr.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(x => x.name === date);
    if (existing) {
      existing.posts += 1;
    } else {
      acc.push({ name: date, posts: 1 });
    }
    return acc;
  }, []) : [
    { name: 'Week 1', posts: 0 },
    { name: 'Week 2', posts: 0 },
    { name: 'Week 3', posts: 0 },
    { name: 'Week 4', posts: 0 },
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
          <div className="flex items-center gap-3">
            <span className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {planName}
            </span>
            <span className="text-muted text-sm font-mono">{order.order_id}</span>
            <button onClick={handleCopyId} className="text-muted hover:text-primary transition-colors" title="Copy Order ID">
              <Copy size={16} />
            </button>
          </div>
          <h2 className="text-2xl font-serif text-primary">Project Dashboard</h2>
        </div>

        <button 
          onClick={handleDownloadInvoice}
          className="flex items-center gap-2 bg-raised border border-themeborder hover:border-accent text-primary px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all"
        >
          <Download size={16} />
          Invoice PDF
        </button>
      </motion.div>

      {/* Grace Period or Upcoming Due Alert Banner */}
      {instMetrics.inGracePeriod && nextInst && (
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
                Action Required: Installment #{nextInst.installment_number} is Due (₹{Number(nextInst.amount).toLocaleString('en-IN')})
              </p>
              <p className="text-[#aaa] text-xs mt-0.5">
                You have <strong className="text-amber-400">{instMetrics.graceDaysLeft} day(s)</strong> remaining in your grace period. Clear payment now to keep deliverables uninterrupted.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPayModal && onOpenPayModal(nextInst)}
            className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] whitespace-nowrap flex items-center gap-1.5"
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
          
          {/* Deliverables Progress */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-glass backdrop-blur-md border border-glass-border p-6 md:p-8 rounded-3xl"
          >
            <h3 className="text-xl font-serif text-primary mb-6">Deliverables Tracker</h3>
            <div className="flex flex-col gap-6">
              <ProgressRow label="Static Posts" current={currentStatic} target={targetStatic} />
              <ProgressRow label="Reels" current={currentReels} target={targetReels} />
              {targetPosters > 0 && (
                <ProgressRow label="Physical Posters" current={currentPosters} target={targetPosters} />
              )}
              {hasWebsite && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-primary">Website Status</span>
                    <span className="text-accent">In Development</span>
                  </div>
                  <div className="w-full bg-raised rounded-full h-3 overflow-hidden border border-themeborder">
                    <div className="bg-accent h-full rounded-full w-[40%]"></div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Activity Graph */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-glass backdrop-blur-md border border-glass-border p-6 md:p-8 rounded-3xl h-[400px] flex flex-col"
          >
            <h3 className="text-xl font-serif text-primary mb-6">Posting Activity</h3>
            <div className="flex-grow w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-raised)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="posts" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={50} />
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

            {/* Installments List */}
            {instMetrics.hasInstallments && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Installment Schedule:</span>
                {instMetrics.installments.map((inst, idx) => {
                  const isPaid = inst.status === 'paid';
                  const isPendingReview = inst.status === 'pending_verification';

                  return (
                    <div key={idx} className="p-3 bg-raised border border-themeborder rounded-xl flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary">Installment #{inst.installment_number || idx + 1}</span>
                          <span className="text-xs font-mono font-bold text-accent">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                        </div>
                        <span className="text-[10px] text-muted">
                          {isPaid 
                            ? `Paid on ${inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Verified'}`
                            : (inst.due_date ? `Due ${new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Scheduled')
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
                            className="bg-[#3428f8] hover:bg-[#281cd4] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all shadow-sm"
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
              className="w-full bg-raised hover:bg-themeborder/50 border border-themeborder text-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download Tax Invoice PDF
            </button>
          </motion.div>

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
                className="text-xs bg-accent/10 text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-full font-bold uppercase tracking-widest transition-colors"
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

function ProgressRow({ label, current, target }) {
  const percent = Math.min(100, Math.round((current / target) * 100)) || 0;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm font-bold">
        <span className="text-primary">{label}</span>
        <span className="text-muted">{current} / {target}</span>
      </div>
      <div className="w-full bg-raised rounded-full h-3 overflow-hidden border border-themeborder">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="bg-accent h-full rounded-full"
        ></motion.div>
      </div>
    </div>
  );
}
