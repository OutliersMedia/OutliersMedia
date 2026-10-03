import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, Ticket, CheckCircle, Plus, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Layout, AlertTriangle, Clock, X, Check, ArrowRight, ExternalLink, Sparkles, IndianRupee, MessageSquare } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

import { generateUploadSchedule, TYPE_CONFIG } from '../../utils/scheduleEngine';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ mrr: 0, activeRetainers: 0, openTickets: 0, pendingToday: 0 });
  const [loading, setLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Top Metrics Details Modal state
  const [selectedMetric, setSelectedMetric] = useState(null); // 'mrr' | 'retainers' | 'tickets' | 'due'
  const [openTicketsList, setOpenTicketsList] = useState([]);
  const [detailedRetainers, setDetailedRetainers] = useState([]);

  // Quick Post Logger state
  const [logOrderId, setLogOrderId] = useState('');
  const [logType, setLogType] = useState('static');
  const [logTitle, setLogTitle] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);

  // Calendar Event Card Popup state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);

  const handleOpenEvent = (ev) => {
    setSelectedEvent(ev);
    const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.static;
    const defaultTitle = ev.note 
      ? `${cfg.label} — ${ev.note}` 
      : `${cfg.label} Delivery (${new Date(ev.date).toLocaleDateString('en-IN')})`;
    setEventTitle(defaultTitle);
  };

  const handleMarkDelivered = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEvent) return;
    setIsSubmittingWork(true);

    const postType = ['static', 'reel', 'poster'].includes(selectedEvent.type) 
      ? selectedEvent.type 
      : 'static';

    const { error } = await supabase.from('posts_log').insert([{
      order_id: selectedEvent.orderId,
      post_type: postType,
      title: eventTitle || `${TYPE_CONFIG[selectedEvent.type]?.label || 'Post'}`
    }]);

    if (error) {
      alert("Error logging deliverable: " + error.message);
    } else {
      await fetchAll();
      setSelectedEvent(null);
    }
    setIsSubmittingWork(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    const { data: profiles } = await supabase.from('profiles').select('auth_id, name');
    const profileMap = {};
    if (profiles) profiles.forEach(p => profileMap[p.auth_id] = p);

    const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: posts } = await supabase.from('posts_log').select('*').order('published_at', { ascending: false });
    
    // Fetch open support tickets list
    const { data: openTicketsData, count: ticketsCount } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    
    if (openTicketsData) setOpenTicketsList(openTicketsData);

    const ordersList = orders || [];
    const postsList = posts || [];

    // Metrics
    const activeOrds = ordersList.filter(o => o.status === 'active');
    const currentMRR = activeOrds.reduce((sum, o) => sum + Number(o.amount_paid || 0), 0);

    // Build Detailed Retainers
    const detailed = activeOrds.map(order => {
      const orderPosts = postsList.filter(p => p.order_id === order.order_id);
      const staticDone = orderPosts.filter(p => p.post_type === 'static').length;
      const reelsDone = orderPosts.filter(p => p.post_type === 'reel').length;
      const postersDone = orderPosts.filter(p => p.post_type === 'poster').length;
      const totalDone = staticDone + reelsDone + postersDone;
      const totalQuota = (order.static_posts_total || 0) + (order.reels_total || 0) + (order.posters_total || 0);

      const created = new Date(order.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, 30 - diffDays);

      return {
        ...order,
        clientName: profileMap[order.client_id]?.name || 'Unknown',
        totalDone,
        totalQuota,
        staticDone,
        reelsDone,
        postersDone,
        daysLeft,
        daysActive: diffDays
      };
    });
    setDetailedRetainers(detailed);

    // Build calendar events from all active orders
    const events = [];
    let pendingToday = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    activeOrds.forEach(order => {
      const clientName = profileMap[order.client_id]?.name || 'Unknown';
      const orderPosts = postsList.filter(p => p.order_id === order.order_id);
      const staticDone = orderPosts.filter(p => p.post_type === 'static').length;
      const reelsDone = orderPosts.filter(p => p.post_type === 'reel').length;
      const postersDone = orderPosts.filter(p => p.post_type === 'poster').length;

      const schedule = generateUploadSchedule(
        order.created_at,
        order.plan_name,
        order.static_posts_total,
        order.reels_total,
        order.posters_total
      );

      // Mark delivered vs pending slots
      let sSkipped = 0, rSkipped = 0, pSkipped = 0;
      schedule.forEach(slot => {
        let delivered = false;
        if (slot.type === 'static') { if (sSkipped < staticDone) { sSkipped++; delivered = true; } }
        else if (slot.type === 'reel') { if (rSkipped < reelsDone) { rSkipped++; delivered = true; } }
        else if (slot.type === 'poster') { if (pSkipped < postersDone) { pSkipped++; delivered = true; } }

        const slotDate = new Date(slot.date);
        slotDate.setHours(0, 0, 0, 0);

        if (!delivered && slotDate.getTime() === today.getTime() && ['static', 'reel', 'poster'].includes(slot.type)) {
          pendingToday++;
        }

        events.push({
          date: slot.date,
          type: slot.type,
          time: slot.time,
          note: slot.note,
          clientName,
          orderId: order.order_id,
          delivered,
          isOverdue: !delivered && slotDate < today && ['static', 'reel', 'poster'].includes(slot.type)
        });
      });
    });

    setCalendarEvents(events);
    setActiveOrders(activeOrds.map(o => ({ ...o, clientName: profileMap[o.client_id]?.name || 'Unknown' })));
    setMetrics({
      mrr: currentMRR,
      activeRetainers: activeOrds.length,
      openTickets: ticketsCount || 0,
      pendingToday
    });
    setLoading(false);
  };

  const handleQuickLog = async (e) => {
    e.preventDefault();
    if (!logOrderId || !logTitle) return;
    setIsLogging(true);

    const { error } = await supabase.from('posts_log').insert([{
      order_id: logOrderId,
      post_type: logType,
      title: logTitle
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setLogTitle('');
      await fetchAll();
    }
    setIsLogging(false);
  };

  // --- CALENDAR RENDERING ---
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getEventsForDay = (day) => {
    if (!day) return [];
    return calendarEvents.filter(ev => {
      const d = new Date(ev.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const todayDate = new Date();

  const metricCards = [
    { id: 'mrr', label: 'Monthly Recurring Revenue', value: `₹${metrics.mrr.toLocaleString()}`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'retainers', label: 'Active Retainers', value: metrics.activeRetainers, icon: Users, color: 'text-[#3428f8]', bg: 'bg-[#3428f8]/10' },
    { id: 'tickets', label: 'Open Tickets', value: metrics.openTickets, icon: Ticket, color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 'due', label: 'Due Today', value: metrics.pendingToday, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  ];

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelectedMetric(card.id)}
            className="bg-[#111] border border-[#222] p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group hover:border-[#444] cursor-pointer hover:shadow-[0_0_25px_rgba(255,255,255,0.03)] active:scale-[0.99] transition-all"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 ${card.bg} blur-2xl transition-all group-hover:scale-150`}></div>
            <div className="flex justify-between items-start relative z-10">
              <span className="text-[#888] text-xs font-bold uppercase tracking-widest">{card.label}</span>
              <div className={`${card.bg} ${card.color} p-2 rounded-lg`}>
                <card.icon size={18} />
              </div>
            </div>
            <div className="flex justify-between items-end relative z-10">
              <div className="text-3xl font-serif text-white">
                {loading ? <span className="animate-pulse bg-[#222] h-8 w-24 rounded block"></span> : card.value}
              </div>
              <span className="text-[10px] text-[#555] group-hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                View <ArrowRight size={10} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Master Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-[#111] border border-[#222] rounded-2xl p-6 md:p-8 flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif text-white">Agency Master Calendar</h2>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-[#888]">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#3428f8]"></div> Static</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Reel</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Poster</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Stories</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-400"></div> Special</span>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-[#222] transition-colors text-[#888] hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-white text-sm font-bold uppercase tracking-widest">{monthName}</h3>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-[#222] transition-colors text-[#888] hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#555] py-2">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="min-h-[85px]"></div>;

              const dayEvents = getEventsForDay(day);
              const isToday = todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === day;

              return (
                <div
                  key={day}
                  className={`min-h-[85px] p-1.5 rounded-lg border transition-colors ${isToday ? 'border-[#3428f8] bg-[#3428f8]/5' : 'border-[#1a1a1a] hover:border-[#333]'}`}
                >
                  <div className={`text-[10px] font-bold mb-1 ${isToday ? 'text-[#3428f8]' : 'text-[#666]'}`}>{day}</div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev, evIdx) => {
                      const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.static;
                      const timeSnippet = ev.time ? ` ${ev.time.split(' ')[0]}` : '';
                      return (
                        <div
                          key={evIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvent(ev);
                          }}
                          title={`${ev.clientName} — ${cfg.label} @ ${ev.time || 'N/A'}${ev.note ? `\n🎯 ${ev.note}` : ''}${ev.delivered ? '\n✓ DELIVERED' : ev.isOverdue ? '\n⚠ OVERDUE' : ''}\n(Click to view details & submit)`}
                          className={`text-[8px] px-1 py-0.5 rounded truncate font-bold uppercase tracking-wider cursor-pointer hover:opacity-80 active:scale-95 transition-all ${
                            ev.delivered
                              ? 'bg-[#222] text-[#555] line-through'
                              : ev.isOverdue
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : `${cfg.bg}/20 ${cfg.color} hover:ring-1 hover:ring-[#3428f8]/40`
                          }`}
                        >
                          {ev.clientName.split(' ')[0]}: {cfg.shortLabel || cfg.label}{timeSnippet}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEvent(dayEvents[3]);
                        }}
                        className="text-[8px] text-[#555] font-bold cursor-pointer hover:text-white"
                      >
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Post Logger */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-1 bg-[#111] border border-[#222] rounded-2xl p-6 md:p-8 flex flex-col"
        >
          <h2 className="text-xl font-serif text-white mb-6">Quick Post Logger</h2>

          <form onSubmit={handleQuickLog} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#888]">Client / Order</label>
              <select
                value={logOrderId}
                onChange={(e) => setLogOrderId(e.target.value)}
                required
                className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-sm focus:border-[#3428f8] focus:outline-none transition-all rounded-xl"
              >
                <option value="">Select a client...</option>
                {activeOrders.map(o => (
                  <option key={o.order_id} value={o.order_id}>
                    {o.clientName} — {o.plan_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#888]">Deliverable Type</label>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-sm focus:border-[#3428f8] focus:outline-none transition-all rounded-xl"
              >
                <option value="static">Static Post</option>
                <option value="reel">Reel / Short</option>
                <option value="poster">Poster</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#888]">Title / Description</label>
              <input
                type="text"
                placeholder="e.g. Diwali Sale Promo"
                value={logTitle}
                onChange={(e) => setLogTitle(e.target.value)}
                required
                className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-sm focus:border-[#3428f8] focus:outline-none transition-all rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={isLogging || !logOrderId || !logTitle}
              className="mt-4 w-full bg-[#3428f8] disabled:bg-[#3428f8]/50 text-white p-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-xl shadow-[0_0_15px_rgba(52,40,248,0.4)] flex items-center justify-center gap-2"
            >
              {isLogging ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                <><Plus size={16} /> Log & Push to Client</>
              )}
            </button>
          </form>
        </motion.div>

      </div>

      {/* Top Metric Details Card Modal */}
      <AnimatePresence>
        {selectedMetric && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedMetric(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-[#222]">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    selectedMetric === 'mrr' ? 'bg-green-400/10 text-green-400' :
                    selectedMetric === 'retainers' ? 'bg-[#3428f8]/10 text-[#3428f8]' :
                    selectedMetric === 'tickets' ? 'bg-red-400/10 text-red-400' :
                    'bg-yellow-400/10 text-yellow-400'
                  }`}>
                    {selectedMetric === 'mrr' && <TrendingUp size={22} />}
                    {selectedMetric === 'retainers' && <Users size={22} />}
                    {selectedMetric === 'tickets' && <Ticket size={22} />}
                    {selectedMetric === 'due' && <AlertTriangle size={22} />}
                  </div>
                  <div>
                    <h3 className="text-white text-lg font-serif">
                      {selectedMetric === 'mrr' && 'Monthly Recurring Revenue'}
                      {selectedMetric === 'retainers' && 'Active Client Retainers'}
                      {selectedMetric === 'tickets' && 'Open Support Tickets'}
                      {selectedMetric === 'due' && "Today's Deliverables"}
                    </h3>
                    <p className="text-[#666] text-xs">
                      {selectedMetric === 'mrr' && 'Live subscription retainers breakdown'}
                      {selectedMetric === 'retainers' && 'Contract pacing & deliverable completion'}
                      {selectedMetric === 'tickets' && 'Customer queries pending resolution'}
                      {selectedMetric === 'due' && 'Content scheduled to be published today'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedMetric(null)}
                  className="text-[#666] hover:text-white p-1 rounded-lg hover:bg-[#222] transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Body based on metric type */}
              <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3 custom-scrollbar my-2">
                {/* 1. MRR MODAL */}
                {selectedMetric === 'mrr' && (
                  <>
                    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block">Total Monthly Retainer Pool</span>
                        <span className="text-2xl font-serif text-green-400">₹{metrics.mrr.toLocaleString()}</span>
                      </div>
                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-bold">
                        {detailedRetainers.length} Active Plan{detailedRetainers.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {detailedRetainers.length === 0 ? (
                      <p className="text-[#666] text-xs text-center py-8">No active retainers currently active.</p>
                    ) : (
                      detailedRetainers.map((ret, i) => (
                        <div key={i} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3.5 flex justify-between items-center hover:border-[#333] transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white text-sm font-bold">{ret.clientName}</span>
                              <span className="text-[10px] font-mono text-[#666]">{ret.order_id}</span>
                            </div>
                            <span className="text-[#3428f8] text-xs font-semibold">{ret.plan_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white font-mono font-bold text-sm block">₹{Number(ret.amount_paid || 0).toLocaleString()}</span>
                            <span className="text-[#666] text-[10px]">Joined {new Date(ret.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 2. ACTIVE RETAINERS MODAL */}
                {selectedMetric === 'retainers' && (
                  <>
                    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block">Client Subscription Status</span>
                        <span className="text-2xl font-serif text-[#3428f8]">{detailedRetainers.length} Retainers</span>
                      </div>
                      <span className="text-xs bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20 px-2.5 py-1 rounded-full font-bold">
                        100% In Good Standing
                      </span>
                    </div>

                    {detailedRetainers.length === 0 ? (
                      <p className="text-[#666] text-xs text-center py-8">No active retainers found.</p>
                    ) : (
                      detailedRetainers.map((ret, i) => (
                        <div key={i} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3.5 flex flex-col gap-2 hover:border-[#333] transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-white text-sm font-bold block">{ret.clientName}</span>
                              <span className="text-[#888] text-xs">{ret.plan_name} • <span className="font-mono text-[#555]">{ret.order_id}</span></span>
                            </div>
                            <span className="text-[#3428f8] text-xs font-bold font-mono">
                              {ret.totalDone} / {ret.totalQuota} Done
                            </span>
                          </div>

                          <div className="w-full bg-[#1a1a1a] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#3428f8] h-full transition-all" 
                              style={{ width: `${ret.totalQuota > 0 ? (ret.totalDone / ret.totalQuota) * 100 : 0}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between text-[10px] text-[#666]">
                            <span>Static: {ret.staticDone}/{ret.static_posts_total} • Reels: {ret.reelsDone}/{ret.reels_total}{ret.posters_total > 0 ? ` • Poster: ${ret.postersDone}/${ret.posters_total}` : ''}</span>
                            <span className="font-medium text-[#aaa]">{ret.daysLeft} days remaining</span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 3. OPEN TICKETS MODAL */}
                {selectedMetric === 'tickets' && (
                  <>
                    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block">Customer Inquiries</span>
                        <span className="text-2xl font-serif text-red-400">{metrics.openTickets} Open Ticket{metrics.openTickets === 1 ? '' : 's'}</span>
                      </div>
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full font-bold">
                        Requires Action
                      </span>
                    </div>

                    {openTicketsList.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle size={32} className="text-green-500 mx-auto mb-2 opacity-60" />
                        <p className="text-white text-sm font-medium">All support tickets resolved!</p>
                        <p className="text-[#666] text-xs">No pending revisions or inquiries from clients.</p>
                      </div>
                    ) : (
                      openTicketsList.map((ticket, i) => (
                        <div key={i} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3.5 flex flex-col gap-2 hover:border-[#333] transition-colors">
                          <div className="flex justify-between items-center">
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              {ticket.category || 'General Support'}
                            </span>
                            <span className="text-[#666] text-[10px] font-mono">
                              {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-white text-xs line-clamp-2">{ticket.message}</p>
                          <span className="text-[#555] text-[10px] font-mono">Order ID: {ticket.order_id || 'N/A'}</span>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 4. DUE TODAY MODAL */}
                {selectedMetric === 'due' && (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const todayEvents = calendarEvents.filter(ev => {
                    const d = new Date(ev.date);
                    d.setHours(0, 0, 0, 0);
                    return d.getTime() === today.getTime();
                  });

                  return (
                    <>
                      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex justify-between items-center mb-1">
                        <div>
                          <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block">Today's Schedule</span>
                          <span className="text-2xl font-serif text-yellow-400">{todayEvents.length} Task{todayEvents.length === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-full font-bold">
                          {metrics.pendingToday} Pending
                        </span>
                      </div>

                      {todayEvents.length === 0 ? (
                        <div className="text-center py-8">
                          <Clock size={32} className="text-yellow-500 mx-auto mb-2 opacity-60" />
                          <p className="text-white text-sm font-medium">No uploads scheduled for today.</p>
                          <p className="text-[#666] text-xs">Check tomorrow's calendar or use Quick Post Logger.</p>
                        </div>
                      ) : (
                        todayEvents.map((ev, i) => {
                          const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.static;
                          const Icon = cfg.icon;
                          return (
                            <div key={i} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3.5 flex justify-between items-center hover:border-[#333] transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${cfg.bg}/20`}>
                                  <Icon size={16} className={cfg.color} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white text-sm font-bold">{ev.clientName}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${cfg.bg}/20 ${cfg.color}`}>
                                      {cfg.label}
                                    </span>
                                  </div>
                                  <p className="text-[#666] text-xs font-mono">{ev.time || 'Flexible Time'} {ev.note ? `• ${ev.note}` : ''}</p>
                                </div>
                              </div>

                              <div>
                                {ev.delivered ? (
                                  <span className="text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Check size={14} /> Done
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedMetric(null);
                                      handleOpenEvent(ev);
                                    }}
                                    className="bg-[#3428f8] hover:bg-[#2d23c9] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    Submit Work
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer with Action Buttons */}
              <div className="pt-4 border-t border-[#222] flex justify-between items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMetric(null)}
                  className="bg-[#1a1a1a] hover:bg-[#252525] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222]"
                >
                  Close
                </button>

                {selectedMetric === 'mrr' && (
                  <button
                    onClick={() => {
                      setSelectedMetric(null);
                      navigate('/admin/finances');
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center gap-1.5"
                  >
                    Open Finances Ledger <ArrowRight size={14} />
                  </button>
                )}
                {selectedMetric === 'retainers' && (
                  <button
                    onClick={() => {
                      setSelectedMetric(null);
                      navigate('/admin/clients');
                    }}
                    className="bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(52,40,248,0.3)] flex items-center gap-1.5"
                  >
                    Manage All Clients <ArrowRight size={14} />
                  </button>
                )}
                {selectedMetric === 'tickets' && (
                  <button
                    onClick={() => {
                      setSelectedMetric(null);
                      navigate('/admin/tickets');
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-1.5"
                  >
                    Open Support Inbox <ArrowRight size={14} />
                  </button>
                )}
                {selectedMetric === 'due' && (
                  <button
                    onClick={() => {
                      setSelectedMetric(null);
                      navigate('/admin/deliverables');
                    }}
                    className="bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(52,40,248,0.3)] flex items-center gap-1.5"
                  >
                    Open Deliverables Tab <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calendar Event Details Card Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl ${(TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.static).bg}/20`}>
                    {(() => {
                      const Icon = (TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.static).icon;
                      return <Icon size={20} className={(TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.static).color} />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-white text-base font-bold">
                      {(TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.static).label}
                    </h3>
                    <p className="text-[#666] text-xs font-mono">{selectedEvent.orderId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedEvent.delivered ? (
                    <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      ✓ Delivered
                    </span>
                  ) : selectedEvent.isOverdue ? (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                      ⚠ Overdue
                    </span>
                  ) : (
                    <span className="bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      Scheduled
                    </span>
                  )}
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="text-[#666] hover:text-white p-1 rounded-lg hover:bg-[#222] transition-colors ml-1"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Details Body */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 mb-5 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#666] font-bold uppercase tracking-wider">Client</span>
                  <span className="text-white font-medium">{selectedEvent.clientName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#666] font-bold uppercase tracking-wider">Target Date</span>
                  <span className="text-white font-mono">
                    {new Date(selectedEvent.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {selectedEvent.time && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#666] font-bold uppercase tracking-wider">Best Post Time</span>
                    <span className="text-[#3428f8] font-bold font-mono">{selectedEvent.time}</span>
                  </div>
                )}
                {selectedEvent.note && (
                  <div className="pt-2 border-t border-[#1a1a1a]">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Audience Strategy</span>
                    <p className="text-[#aaa] text-xs font-medium">🎯 {selectedEvent.note}</p>
                  </div>
                )}
              </div>

              {/* Submission Form / Status */}
              {!selectedEvent.delivered ? (
                <form onSubmit={handleMarkDelivered} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Deliverable Title / Caption
                    </label>
                    <input 
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="e.g. Weekend Special Reel #1"
                      required
                      className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>

                  {/* Two Buttons: Close and Submit */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222]"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingWork || !eventTitle}
                      className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(52,40,248,0.4)] flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingWork ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                      ) : (
                        <><Check size={14} /> Submit Work</>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-400 shrink-0" />
                    <span className="text-green-400 text-xs font-medium">This deliverable is already completed and recorded in client records.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222]"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
