import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { isEmailAdmin } from '../../context/AuthContext';
import { 
  Search, Copy, Check, Clock, Image as ImageIcon, Video, Layout, 
  AlertTriangle, Edit3, Briefcase, Plus, Star, RefreshCw, ChevronDown, 
  ChevronUp, CheckCircle2, History, Pause, Play, IndianRupee
} from 'lucide-react';
import AddSpecialDeliverableModal from '../../components/admin/AddSpecialDeliverableModal';
import ClientRenewalModal from '../../components/admin/ClientRenewalModal';
import { 
  fetchBillingCycles, 
  getLatestCycle, 
  computeRenewalStatus, 
  markClientPaused,
  calculateCycleEndDate,
  RENEWAL_EVENT_NAME 
} from '../../utils/renewalEngine';
import { generateUploadSchedule, getNextUpload, getClientSchedule, TYPE_CONFIG } from '../../utils/scheduleEngine';

// --- COPY BUTTON COMPONENT ---
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="p-0.5 rounded hover:bg-[#333] transition-colors ml-1 inline-flex items-center" title="Copy">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#555] hover:text-[#aaa]" />}
    </button>
  );
}

export default function AdminClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [leadsSubFilter, setLeadsSubFilter] = useState('all'); // 'all' | 'leads' | 'admins'
  const [specialModalOrder, setSpecialModalOrder] = useState(null);
  
  // Renewal Modal state
  const [renewalModalClient, setRenewalModalClient] = useState(null);
  const [expandedCyclesClientId, setExpandedCyclesClientId] = useState(null);
  const [pausingClientId, setPausingClientId] = useState(null);

  useEffect(() => {
    fetchClients();

    const handleRefresh = () => fetchClients();
    window.addEventListener('om_business_added', handleRefresh);
    window.addEventListener(RENEWAL_EVENT_NAME, handleRefresh);
    return () => {
      window.removeEventListener('om_business_added', handleRefresh);
      window.removeEventListener(RENEWAL_EVENT_NAME, handleRefresh);
    };
  }, []);

  const fetchClients = async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: posts } = await supabase
      .from('posts_log')
      .select('*')
      .order('published_at', { ascending: false });

    // Fetch billing cycles
    const allBillingCycles = await fetchBillingCycles();

    if (profiles) {
      const ordersList = orders || [];
      const postsList = posts || [];

      const clientItems = [];

      profiles.forEach(profile => {
        const isAdmin = profile.role === 'admin' || isEmailAdmin(profile.email);
        const clientOrders = ordersList.filter(o => o.client_id === profile.auth_id);
        const clientCycles = allBillingCycles.filter(c => c.client_id === profile.auth_id);
        const latestCycle = getLatestCycle(clientCycles);

        if (clientOrders.length === 0 || isAdmin) {
          // Profile without orders (Lead or Admin)
          clientItems.push({
            ...profile,
            displayBusinessName: profile.business_type || 'Main Brand',
            displayBusinessType: profile.business_type || '',
            displayInstagram: profile.instagram_handle || '',
            latestOrder: null,
            latestCycle: null,
            clientCycles: [],
            renewalStatus: { status: 'lead', label: 'Lead', daysLeft: 0, isDue: false },
            calculatedStatus: 'lead',
            scheduleInfo: null,
            isAdmin,
            isMultiBusiness: false,
            businessCount: 0
          });
        } else {
          // Decompose each enrolled order as its own business item
          clientOrders.forEach(order => {
            let calculatedStatus = order.status;
            if (calculatedStatus === 'active' && order.created_at) {
              const expiryDate = new Date(order.created_at);
              expiryDate.setDate(expiryDate.getDate() + 30);
              if (new Date() > expiryDate) calculatedStatus = 'expired';
            }

            const scheduleConfig = getClientSchedule(order);
            const effectiveStart = scheduleConfig?.firstUploadDate || order.first_upload_date || order.created_at;

            let scheduleInfo = null;
            if (calculatedStatus === 'active') {
              const orderPosts = postsList.filter(p => p.order_id === order.order_id);
              const staticDone = orderPosts.filter(p => p.post_type === 'static').length;
              const reelsDone = orderPosts.filter(p => p.post_type === 'reel').length;
              const storiesDone = orderPosts.filter(p => p.post_type === 'story').length;
              const postersDone = orderPosts.filter(p => p.post_type === 'poster').length;
              const totalDone = staticDone + reelsDone + storiesDone + postersDone;
              const storiesQuota = order.stories_total || scheduleConfig?.totalStories || 0;
              const totalQuota = (order.static_posts_total || 0) + (order.reels_total || 0) + (order.posters_total || 0) + storiesQuota;

              const schedule = generateUploadSchedule(
                effectiveStart,
                order.plan_name,
                order.static_posts_total,
                order.reels_total,
                order.posters_total,
                scheduleConfig
              );

              const nextSlot = getNextUpload(schedule, staticDone, reelsDone, postersDone, storiesDone);

              const deadline = new Date(effectiveStart);
              deadline.setDate(deadline.getDate() + 30);
              const daysLeftCycle = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)));

              scheduleInfo = {
                totalDone,
                totalQuota,
                daysLeftCycle,
                nextSlot,
                allDone: totalDone >= totalQuota
              };
            }

            const bName = order.business_name || order.schedule_config?.business_name || profile.business_type || 'Main Brand';
            const bType = order.business_type || order.schedule_config?.business_type || profile.business_type;
            const bInstagram = order.instagram_handle || order.schedule_config?.instagram_handle || profile.instagram_handle;

            // Find cycles matching this client/order
            const matchingCycles = clientCycles.filter(c => c.order_id === order.order_id || !c.order_id);
            const currentCycle = matchingCycles.length > 0 ? getLatestCycle(matchingCycles) : latestCycle;

            // Compute renewal due status based on cycle end date (ends within 5 days or already ended)
            const renewalStatus = computeRenewalStatus(profile, currentCycle, order);

            clientItems.push({
              ...profile,
              auth_id: `${profile.auth_id}_${order.order_id}`,
              real_auth_id: profile.auth_id,
              displayBusinessName: bName,
              displayBusinessType: bType,
              displayInstagram: bInstagram,
              latestOrder: order,
              latestCycle: currentCycle,
              clientCycles: matchingCycles.length > 0 ? matchingCycles : clientCycles,
              renewalStatus,
              calculatedStatus,
              scheduleInfo,
              isAdmin: false,
              isMultiBusiness: clientOrders.length > 1,
              businessCount: clientOrders.length
            });
          });
        }
      });

      setClients(clientItems);
    }
    setLoading(false);
  };

  const handlePauseClient = async (clientItem) => {
    if (!clientItem?.latestOrder) return;
    const confirmPause = window.confirm(`Pause deliverables for ${clientItem.name || clientItem.displayBusinessName}? Client profile will not be deleted.`);
    if (!confirmPause) return;

    setPausingClientId(clientItem.auth_id);
    try {
      await markClientPaused(clientItem.latestOrder.order_id, clientItem.real_auth_id || clientItem.auth_id);
      await fetchClients();
    } catch (err) {
      alert("Error pausing client: " + err.message);
    } finally {
      setPausingClientId(null);
    }
  };

  const counts = useMemo(() => {
    const res = {
      All: 0,
      'Renewal Due': 0,
      Active: 0,
      Leads: 0,
      clientLeads: 0,
      admins: 0,
      Pending: 0,
      Testers: 0,
      Expired: 0,
      Paused: 0,
      Inactive: 0
    };

    clients.forEach(c => {
      if (c.isAdmin) {
        res.admins += 1;
        res.Leads += 1; // Admins are organized exclusively under Leads
        return;
      }

      // Non-admin profiles are clients
      res.All += 1;
      if (c.renewalStatus?.status === 'renewal_due') {
        res['Renewal Due'] += 1;
      }
      if (c.calculatedStatus === 'active') res.Active += 1;
      if (c.calculatedStatus === 'pending') res.Pending += 1;
      if (c.calculatedStatus === 'paused') res.Paused += 1;
      if (c.calculatedStatus === 'expired') res.Expired += 1;
      if (c.calculatedStatus === 'lead') {
        res.Leads += 1;
        res.clientLeads += 1;
      }
      if (c.calculatedStatus === 'cancelled') res.Inactive += 1;
      if (c.role === 'tester') res.Testers += 1;
    });

    return res;
  }, [clients]);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
                          c.email?.toLowerCase().includes(search.toLowerCase()) ||
                          c.displayBusinessName?.toLowerCase().includes(search.toLowerCase()) ||
                          c.latestOrder?.order_id?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    // Admins must NOT be visible in the main client table (All, Active, Pending, etc.)
    if (c.isAdmin) {
      if (filter !== 'Leads') return false;
      if (leadsSubFilter === 'leads') return false; // User requested client leads only
      return true;
    }

    // For non-admin profiles (Clients):
    if (filter === 'All') return true;
    if (filter === 'Renewal Due') return c.renewalStatus?.status === 'renewal_due';
    if (filter === 'Active') return c.calculatedStatus === 'active' && c.renewalStatus?.status !== 'renewal_due';
    if (filter === 'Pending') return c.calculatedStatus === 'pending';
    if (filter === 'Paused') return c.calculatedStatus === 'paused';
    if (filter === 'Expired') return c.calculatedStatus === 'expired';
    if (filter === 'Leads') {
      if (leadsSubFilter === 'admins') return false;
      return c.calculatedStatus === 'lead';
    }
    if (filter === 'Inactive') return c.calculatedStatus === 'cancelled';
    if (filter === 'Testers') return c.role === 'tester';
    return true;
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 min-h-[calc(100vh-140px)] shadow-2xl">
      {/* Title & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif text-white mb-1 sm:mb-2">Client Management</h2>
          <p className="text-[#888] text-xs sm:text-sm">
            Track signed-up clients, manage monthly renewals, monitor cycles and deliverables.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 bg-[#0a0a0a] p-1.5 rounded-xl mb-3 sm:mb-4 border border-[#222] max-w-full">
        {['All', 'Renewal Due', 'Active', 'Pending', 'Leads', 'Testers', 'Expired', 'Paused', 'Inactive'].map(f => {
          const isRenewalDueTab = f === 'Renewal Due';
          return (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                if (f !== 'Leads') setLeadsSubFilter('all');
              }}
              className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs uppercase font-bold tracking-wider sm:tracking-widest rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
                filter === f 
                  ? (isRenewalDueTab ? 'bg-amber-500 text-black' : 'bg-[#3428f8] text-white')
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
            >
              <span>{f === 'All' ? 'All Clients' : f}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                filter === f 
                  ? (isRenewalDueTab ? 'bg-black/20 text-black font-bold' : 'bg-white/20 text-white') 
                  : (isRenewalDueTab && counts[f] > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-[#181818] text-[#777]')
              }`}>
                {counts[f] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {filter === 'Leads' && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 p-2.5 sm:p-3 bg-[#0a0a0a] border border-[#222] rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#888] text-[11px] font-bold uppercase tracking-wider">Leads Tab View:</span>
            <span className="text-[11px] text-[#555] hidden sm:inline">• Admins are organized here to keep client lists focused</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#121212] p-1 rounded-lg border border-[#1f1f1f]">
            <button
              onClick={() => setLeadsSubFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${leadsSubFilter === 'all' ? 'bg-[#222] text-white font-bold' : 'text-[#777] hover:text-[#bbb]'}`}
            >
              All ({counts.Leads})
            </button>
            <button
              onClick={() => setLeadsSubFilter('leads')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${leadsSubFilter === 'leads' ? 'bg-[#222] text-white font-bold' : 'text-[#777] hover:text-[#bbb]'}`}
            >
              Client Leads ({counts.clientLeads})
            </button>
            <button
              onClick={() => setLeadsSubFilter('admins')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${leadsSubFilter === 'admins' ? 'bg-[#3428f8]/20 text-[#8b82ff] border border-[#3428f8]/40 font-bold' : 'text-[#777] hover:text-[#bbb]'}`}
            >
              Admins Only ({counts.admins})
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <>
          {/* Mobile Client Card List (Phone & Small Screens) */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredClients.map((client) => {
              const order = client.latestOrder;
              const cycle = client.latestCycle;
              const si = client.scheduleInfo;
              const renewalStatus = client.renewalStatus;
              const isDue = renewalStatus?.isDue;
              const isExpanded = expandedCyclesClientId === client.auth_id;

              return (
                <div key={client.auth_id} className="bg-[#0b0b0b] border border-[#222] rounded-2xl p-4 flex flex-col gap-3">
                  {/* Top Row: Name + Status Pill */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <p className="text-white font-bold text-sm truncate">{client.name || 'Unknown'}</p>
                        {(client.isAdmin || client.role === 'admin') && <span className="text-[9px] bg-[#3428f8] px-1.5 py-0.5 rounded text-white uppercase font-bold">Admin</span>}
                        {client.role === 'tester' && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Tester</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#888] truncate">
                        <span className="truncate">{client.email}</span>
                        {client.email && <CopyButton text={client.email} />}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#666] font-mono mt-0.5">
                        <span>{client.phone || 'No Phone'}</span>
                        {client.phone && <CopyButton text={client.phone} />}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {client.isAdmin ? (
                        <span className="bg-[#3428f8]/15 text-[#8b82ff] border border-[#3428f8]/30 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Admin Account</span>
                      ) : (
                        <>
                          {isDue ? (
                            <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                              <Clock size={11} /> {renewalStatus.daysLeft <= 0 ? 'Renewal Due' : `Due in ${renewalStatus.daysLeft}d`}
                            </span>
                          ) : client.calculatedStatus === 'paused' ? (
                            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Paused</span>
                          ) : client.calculatedStatus === 'active' ? (
                            <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Active</span>
                          ) : client.calculatedStatus === 'pending' ? (
                            <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Pending</span>
                          ) : client.calculatedStatus === 'expired' ? (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Expired</span>
                          ) : (
                            <span className="bg-[#222] text-[#888] border border-[#333] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Lead</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Business / IG Info */}
                  {(client.displayBusinessName || client.displayBusinessType || client.displayInstagram) && (
                    <div className="bg-[#121212] p-2.5 rounded-xl border border-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Briefcase size={12} className="text-[#3428f8] shrink-0" />
                        <span className="text-white font-bold capitalize">
                          {client.displayBusinessName}
                        </span>
                        {client.displayBusinessType && client.displayBusinessType !== client.displayBusinessName && (
                          <span className="text-[#777]">({client.displayBusinessType})</span>
                        )}
                        {client.isMultiBusiness && (
                          <span className="text-[9px] bg-[#3428f8]/20 text-blue-300 border border-[#3428f8]/30 px-1.5 py-0.2 rounded font-mono font-bold">
                            Multi-Brand ({client.businessCount})
                          </span>
                        )}
                      </div>
                      {client.displayInstagram && (
                        <a
                          href={`https://instagram.com/${client.displayInstagram.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-400 font-medium"
                        >
                          {client.displayInstagram}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Current Cycle Details */}
                  {order && (
                    <div className="bg-[#141414] border border-[#222] rounded-xl p-3 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#777]">
                          Current Cycle {cycle ? `(Month #${cycle.cycle_number})` : ''}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          ₹{Number(cycle?.amount || order.total_agreed_amount || order.amount_paid || 0).toLocaleString()}/mo
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#aaa]">
                        <span>{cycle?.package || order.plan_name}</span>
                        <span className="font-mono text-[10px] text-[#777]">
                          {cycle?.delivery_start_date || order.first_upload_date ? `${cycle?.delivery_start_date || order.first_upload_date} → ${cycle?.delivery_end_date || calculateCycleEndDate(order.first_upload_date)}` : 'Ongoing'}
                        </span>
                      </div>

                      {/* Past cycles toggle */}
                      {client.clientCycles && client.clientCycles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedCyclesClientId(isExpanded ? null : client.auth_id)}
                          className="mt-2 text-[10px] text-blue-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                        >
                          <History size={11} />
                          <span>{isExpanded ? 'Hide Cycle History' : `View Cycles History (${client.clientCycles.length})`}</span>
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      )}

                      {/* Collapsible Past Cycles List */}
                      {isExpanded && client.clientCycles && (
                        <div className="mt-2.5 pt-2.5 border-t border-[#222] space-y-1.5">
                          {client.clientCycles.map((cyc, idx) => (
                            <div key={cyc.id || idx} className="bg-[#0e0e0e] p-2 rounded-lg border border-[#1f1f1f] flex items-center justify-between text-[10px]">
                              <div>
                                <span className="font-bold text-white block">Cycle #{cyc.cycle_number}: {cyc.package}</span>
                                <span className="text-[#666] font-mono">{cyc.delivery_start_date} → {cyc.delivery_end_date}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-white block">₹{Number(cyc.amount).toLocaleString()}</span>
                                <span className={`text-[9px] font-bold uppercase ${cyc.payment_status === 'Paid' ? 'text-green-400' : 'text-amber-400'}`}>
                                  {cyc.payment_status || 'Pending'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* "Continue for next month?" Prompt for Due Clients */}
                  {isDue && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        <span className="font-bold text-amber-300">Continue for next month?</span>
                      </div>
                      <p className="text-[11px] text-[#aaa] mb-2.5">
                        Cycle ends soon ({renewalStatus.delivery_end_date}). Renew package or pause client account.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRenewalModalClient({ client, order, cycle })}
                          className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#3428f8] hover:bg-[#281bd6] text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <RefreshCw size={11} /> Yes, Renew
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePauseClient(client)}
                          disabled={pausingClientId === client.auth_id}
                          className="py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#1c1c1c] hover:bg-red-500/20 text-[#aaa] hover:text-red-400 border border-[#2a2a2a] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Pause size={10} /> No, Pause
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="pt-2.5 border-t border-[#1c1c1c] flex items-center justify-between gap-2">
                    {order ? (
                      <div className="flex items-center gap-1.5 w-full justify-between">
                        <button
                          onClick={() => setRenewalModalClient({ client, order, cycle })}
                          className="inline-flex items-center gap-1.5 text-xs text-white font-bold bg-[#3428f8] hover:bg-[#281bd6] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
                          title="Renew client's package for next month"
                        >
                          <RefreshCw size={12} /> Renew
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSpecialModalOrder({ client, order })}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-white font-bold bg-[#3428f8]/10 hover:bg-[#3428f8] px-2.5 py-1.5 rounded-xl border border-[#3428f8]/30 transition-all cursor-pointer"
                            title="Add special deliverable"
                          >
                            <Plus size={11} /> + Special
                          </button>
                          <button
                            onClick={() => navigate(`/admin/finances?search=${encodeURIComponent(client.name || order.order_id)}`)}
                            className="inline-flex items-center gap-1.5 text-[10px] text-white font-bold bg-[#181818] hover:bg-[#252525] px-3 py-1.5 rounded-xl border border-[#2a2a2a] transition-all"
                          >
                            <Edit3 size={11} className="text-[#3428f8]" /> Finances
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#555] text-xs italic">Lead Account</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-[#666] text-sm bg-[#0a0a0a] rounded-2xl border border-[#222]">
                {filter === 'Renewal Due' 
                  ? 'No clients currently due for renewal.' 
                  : 'No clients match the current filter.'}
              </div>
            )}
          </div>

          {/* Desktop Table (md and up) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[#222]">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-[#0a0a0a] border-b border-[#222]">
                  <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Client / Contact</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Billing Cycle & Plan</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Renewal Status</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Next Upload</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const order = client.latestOrder;
                  const cycle = client.latestCycle;
                  const si = client.scheduleInfo;
                  const renewalStatus = client.renewalStatus;
                  const isDue = renewalStatus?.isDue;
                  const isExpanded = expandedCyclesClientId === client.auth_id;

                  return (
                    <tr key={client.auth_id} className="border-b border-[#222] bg-[#111] hover:bg-[#151515] transition-colors">
                      {/* Client / Contact */}
                      <td className="p-4 min-w-[260px]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium">{client.name || 'Unknown'}</p>
                          {(client.isAdmin || client.role === 'admin') && <span className="text-[9px] bg-[#3428f8] px-1 py-0.5 rounded text-white uppercase font-bold">Admin</span>}
                          {client.role === 'tester' && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Tester</span>}
                          {client.user_id && <span className="text-[9px] text-[#666] font-mono border border-[#333] px-1 py-0.5 rounded">{client.user_id}</span>}
                        </div>
                        <div className="flex items-center gap-0 mb-0.5">
                          <p className="text-[#888] text-xs">{client.email}</p>
                          {client.email && <CopyButton text={client.email} />}
                        </div>
                        <div className="flex items-center gap-0 mb-1">
                          <p className="text-[#555] text-xs font-mono">{client.phone || 'No Phone'}</p>
                          {client.phone && <CopyButton text={client.phone} />}
                        </div>
                        {(client.displayBusinessName || client.displayBusinessType || client.displayInstagram) && (
                          <div className="bg-[#0a0a0a] p-2 rounded-lg border border-[#222] flex flex-col gap-1 mt-1">
                            <p className="text-[#aaa] text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 flex-wrap">
                              <Briefcase size={11} className="text-[#3428f8] shrink-0" />
                              Brand: <span className="text-white font-bold capitalize tracking-normal">{client.displayBusinessName}</span>
                              {client.displayBusinessType && client.displayBusinessType !== client.displayBusinessName && (
                                <span className="text-[#777] font-normal font-sans">({client.displayBusinessType})</span>
                              )}
                              {client.isMultiBusiness && (
                                <span className="text-[9px] bg-[#3428f8]/20 text-blue-300 border border-[#3428f8]/30 px-1.5 py-0.2 rounded font-mono font-bold ml-auto">
                                  Multi-Brand ({client.businessCount})
                                </span>
                              )}
                            </p>
                            {client.displayInstagram && (
                              <p className="text-[#aaa] text-[10px] uppercase font-bold tracking-wider">
                                IG: <a href={`https://instagram.com/${client.displayInstagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-pink-500 hover:text-pink-400 font-normal tracking-normal lowercase">{client.displayInstagram}</a>
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Billing Cycle & Plan */}
                      <td className="p-4 min-w-[240px]">
                        {client.isAdmin ? (
                          <span className="text-[#3428f8] text-xs font-semibold">Outliers Team Administrator</span>
                        ) : order ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[#3428f8] font-bold text-sm">{cycle?.package || order.plan_name}</p>
                              {cycle?.cycle_number && (
                                <span className="text-[10px] bg-[#3428f8]/15 border border-[#3428f8]/30 text-blue-300 px-1.5 py-0.2 rounded font-mono font-bold">
                                  Cycle #{cycle.cycle_number}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-emerald-400 font-serif font-bold text-xs mb-1">
                              ₹{Number(cycle?.amount || order.total_agreed_amount || order.amount_paid || 0).toLocaleString()} / month
                            </p>

                            <p className="text-[#666] text-[10px] font-mono mb-2">
                              {cycle?.delivery_start_date ? `${cycle.delivery_start_date} → ${cycle.delivery_end_date}` : order.order_id}
                            </p>

                            {/* View cycles history toggle */}
                            {client.clientCycles && client.clientCycles.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedCyclesClientId(isExpanded ? null : client.auth_id)}
                                className="text-[10px] text-[#888] hover:text-blue-400 flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                <History size={11} />
                                <span>{isExpanded ? 'Hide Cycles' : `Cycles History (${client.clientCycles.length})`}</span>
                                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}

                            {isExpanded && client.clientCycles && (
                              <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-1">
                                {client.clientCycles.map((cyc, idx) => (
                                  <div key={cyc.id || idx} className="flex items-center justify-between text-[9px] border-b border-[#1a1a1a] pb-1 last:border-0 last:pb-0">
                                    <span className="text-white font-bold">#{cyc.cycle_number} {cyc.package}</span>
                                    <span className="font-mono text-emerald-400">₹{Number(cyc.amount).toLocaleString()}</span>
                                    <span className={`font-bold uppercase ${cyc.payment_status === 'Paid' ? 'text-green-400' : 'text-amber-400'}`}>
                                      {cyc.payment_status || 'Pending'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-[#555] text-sm italic">No Plan Selected</span>
                        )}
                      </td>

                      {/* Status + Renewal Prompt */}
                      <td className="p-4 min-w-[220px]">
                        {client.isAdmin ? (
                          <span className="bg-[#3428f8]/15 text-[#8b82ff] border border-[#3428f8]/30 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Admin Account</span>
                        ) : (
                          <div className="space-y-2">
                            {isDue ? (
                              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 animate-pulse">
                                <Clock size={12} /> {renewalStatus.daysLeft <= 0 ? 'Renewal Due' : `Due in ${renewalStatus.daysLeft}d`}
                              </span>
                            ) : client.calculatedStatus === 'paused' ? (
                              <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Paused</span>
                            ) : client.calculatedStatus === 'active' ? (
                              <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Active</span>
                            ) : client.calculatedStatus === 'pending' ? (
                              <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Pending</span>
                            ) : (
                              <span className="bg-[#222] text-[#888] border border-[#333] px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Lead</span>
                            )}

                            {/* "Continue for next month?" prompt */}
                            {isDue && (
                              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px]">
                                <span className="font-bold text-amber-300 block mb-1">Continue for next month?</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <button
                                    onClick={() => setRenewalModalClient({ client, order, cycle })}
                                    className="px-2.5 py-1 rounded bg-[#3428f8] hover:bg-[#281bd6] text-white font-bold text-[10px] uppercase transition-all cursor-pointer"
                                  >
                                    Yes, Renew
                                  </button>
                                  <button
                                    onClick={() => handlePauseClient(client)}
                                    disabled={pausingClientId === client.auth_id}
                                    className="px-2.5 py-1 rounded bg-[#1f1f1f] hover:bg-red-500/20 text-[#aaa] hover:text-red-400 font-bold text-[10px] uppercase transition-all cursor-pointer"
                                  >
                                    No, Pause
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Next Upload Schedule */}
                      <td className="p-4 min-w-[260px]">
                        {si && si.nextSlot ? (() => {
                          const cfg = TYPE_CONFIG[si.nextSlot.type];
                          const Icon = cfg.icon;
                          const uploadDate = si.nextSlot.date;
                          const now = new Date();
                          const diffMs = uploadDate - now;
                          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                          const isOverdue = diffDays < 0;
                          const isToday = diffDays === 0;

                          return (
                            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-2.5 text-xs">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Icon size={14} className={cfg.color} />
                                <span className="text-white font-bold truncate">1 {cfg.label}</span>
                                <span className="text-[10px] text-[#777] font-mono ml-auto">
                                  {uploadDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <div className="w-full bg-[#222] h-1 rounded-full overflow-hidden mb-1">
                                <div className="bg-[#3428f8] h-full" style={{ width: `${(si.totalDone / si.totalQuota) * 100}%` }}></div>
                              </div>
                              <span className="text-[9px] text-[#666] font-mono block">
                                {si.totalDone}/{si.totalQuota} posts • {isOverdue ? `Overdue ${Math.abs(diffDays)}d` : isToday ? 'Due today' : `In ${diffDays}d`}
                              </span>
                            </div>
                          );
                        })() : (
                          <span className="text-[#555] text-xs italic">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        {order && (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => setRenewalModalClient({ client, order, cycle })}
                              className="inline-flex items-center gap-1.5 text-xs text-white font-bold bg-[#3428f8] hover:bg-[#281bd6] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                              title="Renew client's package for next month"
                            >
                              <RefreshCw size={12} /> Renew
                            </button>

                            <button
                              onClick={() => setSpecialModalOrder({ client, order })}
                              className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-white font-bold bg-[#3428f8]/10 hover:bg-[#3428f8] px-2.5 py-1.5 rounded-xl border border-[#3428f8]/30 transition-all cursor-pointer"
                              title="Add a special deliverable"
                            >
                              <Plus size={11} /> + Special
                            </button>

                            <button
                              onClick={() => navigate(`/admin/finances?search=${encodeURIComponent(client.name || order.order_id)}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-[#aaa] hover:text-white font-bold bg-[#141414] hover:bg-[#252525] px-2.5 py-1.5 rounded-xl border border-[#2a2a2a] transition-all cursor-pointer"
                              title="View and edit in Finances"
                            >
                              <Edit3 size={11} className="text-[#3428f8]" /> Finances
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-[#666]">
                      {filter === 'Renewal Due'
                        ? 'No clients currently due for renewal.'
                        : 'No clients match the current filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Special Deliverable Modal */}
      {specialModalOrder && (
        <AddSpecialDeliverableModal
          isOpen={Boolean(specialModalOrder)}
          onClose={() => setSpecialModalOrder(null)}
          initialClient={specialModalOrder.client}
          initialOrder={specialModalOrder.order}
          onSuccess={() => fetchClients()}
        />
      )}

      {/* Shared Client Renewal Modal */}
      {renewalModalClient && (
        <ClientRenewalModal
          isOpen={Boolean(renewalModalClient)}
          onClose={() => setRenewalModalClient(null)}
          client={renewalModalClient.client}
          currentOrder={renewalModalClient.order}
          latestCycle={renewalModalClient.cycle}
          onRenewalSuccess={() => {
            fetchClients();
          }}
        />
      )}
    </div>
  );
}
