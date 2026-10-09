import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  Search, Image as ImageIcon, Video, Layout, Plus, CheckCircle, Clock, 
  Calendar as CalendarIcon, Sparkles, Check, ArrowRight, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
  getClientSchedule, saveClientSchedule, generateCustomSchedule, TYPE_CONFIG 
} from '../../utils/scheduleEngine';

export default function AdminDeliverables() {
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('active'); // 'active' | 'pending' | 'all'
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'logging'

  // Schedule Configuration State
  const [firstUploadDate, setFirstUploadDate] = useState('');
  const [staticPerWeek, setStaticPerWeek] = useState(3);
  const [staticInterval, setStaticInterval] = useState(2);
  const [reelsPerWeek, setReelsPerWeek] = useState(1);
  const [reelsInterval, setReelsInterval] = useState(7);
  const [storiesPerWeek, setStoriesPerWeek] = useState(3);
  const [storiesInterval, setStoriesInterval] = useState(2);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSavedSuccess, setScheduleSavedSuccess] = useState(false);

  // Delivery Logging Form State
  const [postType, setPostType] = useState('static');
  const [postTitle, setPostTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // When selectedClient changes, prefill their saved schedule configuration
  useEffect(() => {
    if (selectedClient?.latestOrder) {
      const cfg = getClientSchedule(selectedClient.latestOrder);
      const existingDate = cfg?.firstUploadDate || selectedClient.latestOrder.first_upload_date;
      
      if (existingDate) {
        setFirstUploadDate(new Date(existingDate).toISOString().split('T')[0]);
      } else {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFirstUploadDate(tomorrow.toISOString().split('T')[0]);
      }

      const isStarter = selectedClient.latestOrder.plan_name?.toLowerCase().includes('starter');
      setStaticPerWeek(cfg?.staticPerWeek ?? (isStarter ? 2 : 3));
      setStaticInterval(cfg?.staticInterval ?? 2);
      setReelsPerWeek(cfg?.reelsPerWeek ?? 1);
      setReelsInterval(cfg?.reelsInterval ?? 7);
      setStoriesPerWeek(cfg?.storiesPerWeek ?? (isStarter ? 0 : 3));
      setStoriesInterval(cfg?.storiesInterval ?? 2);
      setScheduleSavedSuccess(false);

      if (postType === 'poster' && selectedClient.latestOrder.posters_total === 0) {
        setPostType('static');
      }
    }
  }, [selectedClient?.auth_id, selectedClient?.latestOrder?.order_id]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all profiles EXCEPT admins (Outliers)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    // Fetch all orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch all post logs
    const { data: posts } = await supabase
      .from('posts_log')
      .select('*')
      .order('published_at', { ascending: false });

    if (profiles) {
      const enrichedClients = profiles.map(profile => {
        const clientOrders = orders ? orders.filter(o => o.client_id === profile.auth_id) : [];
        const activeOrPending = clientOrders.find(o => ['active', 'pending', 'paused'].includes(o.status));
        const latestOrder = activeOrPending || clientOrders[0] || null;

        let calculatedStatus = 'lead';

        if (latestOrder) {
          calculatedStatus = latestOrder.status;

          if (calculatedStatus === 'active' && latestOrder.created_at) {
            const createdDate = new Date(latestOrder.created_at);
            const expiryDate = new Date(createdDate);
            expiryDate.setDate(expiryDate.getDate() + 30);

            if (new Date() > expiryDate) {
              calculatedStatus = 'expired';
            }
          }
        }

        // Deliverables Progress
        let progress = { static: 0, reels: 0, stories: 0, posters: 0, total_delivered: 0, total_quota: 0 };
        let clientPosts = [];
        let scheduleConfig = null;

        if (latestOrder) {
          scheduleConfig = getClientSchedule(latestOrder);
          clientPosts = posts ? posts.filter(p => p.order_id === latestOrder.order_id) : [];

          const staticDelivered = clientPosts.filter(p => p.post_type === 'static').length;
          const reelsDelivered = clientPosts.filter(p => p.post_type === 'reel').length;
          const storiesDelivered = clientPosts.filter(p => p.post_type === 'story').length;
          const postersDelivered = clientPosts.filter(p => p.post_type === 'poster').length;

          const storiesQuota = latestOrder.stories_total || scheduleConfig?.totalStories || 0;
          const totalQuota = (latestOrder.static_posts_total || 0) + 
                             (latestOrder.reels_total || 0) + 
                             (latestOrder.posters_total || 0) + 
                             storiesQuota;

          progress = {
            static: staticDelivered,
            reels: reelsDelivered,
            stories: storiesDelivered,
            posters: postersDelivered,
            total_delivered: staticDelivered + reelsDelivered + storiesDelivered + postersDelivered,
            total_quota: totalQuota
          };
        }

        return {
          ...profile,
          latestOrder,
          calculatedStatus,
          scheduleConfig,
          posts: clientPosts,
          progress
        };
      });

      setClientsList(enrichedClients);

      // Preserve currently selected client if already chosen
      if (selectedClient) {
        const updated = enrichedClients.find(c => c.auth_id === selectedClient.auth_id);
        if (updated) setSelectedClient(updated);
      } else {
        // Auto-select the first active client if none selected
        const firstActive = enrichedClients.find(c => c.calculatedStatus === 'active');
        if (firstActive) setSelectedClient(firstActive);
      }
    }
    setLoading(false);
  };

  // Live schedule preview calculated from current inputs
  const previewSchedule = useMemo(() => {
    if (!firstUploadDate) return [];
    return generateCustomSchedule({
      startDate: new Date(firstUploadDate),
      staticPerWeek: parseInt(staticPerWeek) || 0,
      staticInterval: parseInt(staticInterval) || 1,
      reelsPerWeek: parseInt(reelsPerWeek) || 0,
      reelsInterval: parseInt(reelsInterval) || 1,
      storiesPerWeek: parseInt(storiesPerWeek) || 0,
      storiesInterval: parseInt(storiesInterval) || 1,
      postersTotal: selectedClient?.latestOrder?.posters_total || 0,
      weeksCount: 4
    });
  }, [firstUploadDate, staticPerWeek, staticInterval, reelsPerWeek, reelsInterval, storiesPerWeek, storiesInterval, selectedClient]);

  const handleSaveSchedule = async () => {
    if (!selectedClient?.latestOrder || !firstUploadDate) return;
    setSavingSchedule(true);

    const totalStatic = (parseInt(staticPerWeek) || 0) * 4;
    const totalReels = (parseInt(reelsPerWeek) || 0) * 4;
    const totalStories = (parseInt(storiesPerWeek) || 0) * 4;

    const config = {
      firstUploadDate: new Date(firstUploadDate).toISOString(),
      staticPerWeek: parseInt(staticPerWeek) || 0,
      staticInterval: parseInt(staticInterval) || 1,
      reelsPerWeek: parseInt(reelsPerWeek) || 0,
      reelsInterval: parseInt(reelsInterval) || 1,
      storiesPerWeek: parseInt(storiesPerWeek) || 0,
      storiesInterval: parseInt(storiesInterval) || 1,
      totalStatic,
      totalReels,
      totalStories,
      updatedAt: new Date().toISOString()
    };

    const { error } = await saveClientSchedule(selectedClient.latestOrder.order_id, config);
    setSavingSchedule(false);

    if (error) {
      alert("Error saving schedule: " + error.message);
    } else {
      setScheduleSavedSuccess(true);
      setTimeout(() => setScheduleSavedSuccess(false), 4000);
      await fetchData();
    }
  };

  const handleAddDeliverable = async (e) => {
    e.preventDefault();
    if (!selectedClient?.latestOrder || !postTitle) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from('posts_log')
      .insert([
        {
          order_id: selectedClient.latestOrder.order_id,
          post_type: postType,
          title: postTitle
        }
      ]);

    if (error) {
      alert("Error saving deliverable: " + error.message);
    } else {
      setPostTitle('');
      await fetchData();
    }

    setIsSubmitting(false);
  };

  // Filter clients for the left panel
  const filteredClients = clientsList.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
                          c.email?.toLowerCase().includes(search.toLowerCase()) ||
                          (c.latestOrder && c.latestOrder.order_id?.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (clientFilter === 'active') {
      return c.calculatedStatus === 'active';
    } else if (clientFilter === 'pending') {
      return c.calculatedStatus === 'pending';
    }
    return true; // 'all'
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 min-h-[calc(100vh-140px)] shadow-2xl flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Deliverables & Content Pipeline</h2>
          <p className="text-[#888] text-sm">Configure launch dates, customize weekly upload intervals, and track delivered assets.</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input 
            type="text" 
            placeholder="Search clients or orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
          />
        </div>
      </div>

      {loading && clientsList.length === 0 ? (
        <div className="flex justify-center items-center flex-1">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          
          {/* Left Panel: Active & Pending Clients Sidebar */}
          <div className="w-full lg:w-1/3 flex flex-col gap-3">
            {/* Filter Pills */}
            <div className="flex gap-1.5 bg-[#0a0a0a] p-1 rounded-xl border border-[#222]">
              <button
                onClick={() => setClientFilter('active')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'active' 
                    ? 'bg-[#3428f8] text-white shadow-[0_0_12px_rgba(52,40,248,0.3)]' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                Active Plans
              </button>
              <button
                onClick={() => setClientFilter('pending')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'pending' 
                    ? 'bg-[#3428f8] text-white shadow-[0_0_12px_rgba(52,40,248,0.3)]' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setClientFilter('all')}
                className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'all' 
                    ? 'bg-[#3428f8] text-white shadow-[0_0_12px_rgba(52,40,248,0.3)]' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                All
              </button>
            </div>

            {/* Client List */}
            <div data-lenis-prevent="true" className="flex flex-col gap-3 h-[680px] overflow-y-auto pr-2 custom-scrollbar overscroll-contain">
              {filteredClients.length === 0 ? (
                <div className="text-[#666] text-sm p-8 text-center bg-[#0a0a0a] rounded-2xl border border-[#222]">
                  No {clientFilter} clients found.
                </div>
              ) : (
                filteredClients.map(client => {
                  const hasSchedule = Boolean(client.scheduleConfig?.firstUploadDate || client.latestOrder?.first_upload_date);
                  const firstDateStr = hasSchedule 
                    ? new Date(client.scheduleConfig?.firstUploadDate || client.latestOrder?.first_upload_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : null;

                  return (
                    <button
                      key={client.auth_id}
                      onClick={() => setSelectedClient(client)}
                      className={`text-left p-4 rounded-2xl border transition-all ${
                        selectedClient?.auth_id === client.auth_id 
                          ? 'bg-[#3428f8]/10 border-[#3428f8] shadow-[0_0_20px_rgba(52,40,248,0.25)]' 
                          : 'bg-[#0a0a0a] border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-white font-bold text-sm">{client.name || 'Unknown'}</h4>
                          <p className="text-[#666] text-[10px] font-mono">{client.latestOrder?.order_id || 'No Order ID'}</p>
                        </div>
                        <div>
                          {client.calculatedStatus === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Active</span>}
                          {client.calculatedStatus === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse">Pending</span>}
                          {client.calculatedStatus === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Paused</span>}
                          {client.calculatedStatus === 'expired' && <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Expired</span>}
                          {client.calculatedStatus === 'lead' && <span className="bg-[#222] text-[#888] border border-[#333] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Lead</span>}
                        </div>
                      </div>

                      {client.latestOrder ? (
                        <>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-[#888]">{client.latestOrder.plan_name}</span>
                            {hasSchedule ? (
                              <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                                <CalendarIcon size={10} /> Starts {firstDateStr}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-500/80 font-medium flex items-center gap-1">
                                <Clock size={10} /> Date not set
                              </span>
                            )}
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#3428f8] h-full" 
                              style={{ width: `${client.progress.total_quota > 0 ? (client.progress.total_delivered / client.progress.total_quota) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[10px] mt-1 text-[#555] uppercase font-bold tracking-wider">
                            <span>{client.progress.total_delivered} Done</span>
                            <span>{client.progress.total_quota} Target</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-[#555] text-xs italic mt-2">No Plan Selected</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Tabbed Workspace */}
          <div className="w-full lg:w-2/3 bg-[#0a0a0a] border border-[#222] rounded-2xl flex flex-col h-[740px] overflow-hidden">
            {selectedClient ? (
              selectedClient.latestOrder ? (
                <>
                  {/* Client Summary Header */}
                  <div className="p-6 border-b border-[#222] bg-[#0c0c0c] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-serif text-white">{selectedClient.name}</h3>
                        <span className="text-xs bg-[#1f1f1f] text-[#3428f8] border border-[#333] px-2.5 py-0.5 rounded-full font-bold">
                          {selectedClient.latestOrder.plan_name}
                        </span>
                      </div>
                      <p className="text-[#888] text-xs font-mono mt-1">
                        Order {selectedClient.latestOrder.order_id} • {selectedClient.email} • {selectedClient.phone || 'No phone'}
                      </p>
                    </div>

                    {/* Tab Buttons */}
                    <div className="flex bg-[#161616] p-1 rounded-xl border border-[#2a2a2a]">
                      <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                          activeTab === 'schedule'
                            ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.3)]'
                            : 'text-[#888] hover:text-white'
                        }`}
                      >
                        <CalendarIcon size={14} /> Upload Schedule
                      </button>
                      <button
                        onClick={() => setActiveTab('logging')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                          activeTab === 'logging'
                            ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.3)]'
                            : 'text-[#888] hover:text-white'
                        }`}
                      >
                        <Plus size={14} /> Deliverables & Logging
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: UPLOAD SCHEDULE */}
                  {activeTab === 'schedule' && (
                    <div data-lenis-prevent="true" className="flex-1 overflow-y-auto p-6 custom-scrollbar overscroll-contain flex flex-col gap-6">
                      
                      {/* Success Toast */}
                      {scheduleSavedSuccess && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center justify-between text-xs font-medium animate-fadeIn">
                          <span className="flex items-center gap-2">
                            <Check size={16} /> Schedule successfully applied! Upload dates and quota are now synced with the Overview Calendar.
                          </span>
                          <span className="uppercase text-[10px] tracking-widest font-bold">Live</span>
                        </div>
                      )}

                      {/* Section 1: Set First Upload Date */}
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon size={16} className="text-[#3428f8]" />
                              <h4 className="text-white font-bold text-sm uppercase tracking-wider">1. Set First Upload Date</h4>
                            </div>
                            <p className="text-[#777] text-xs">
                              Select the exact date when your agency will publish the first piece of content for this client.
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <input 
                              type="date"
                              value={firstUploadDate}
                              onChange={(e) => setFirstUploadDate(e.target.value)}
                              className="bg-[#0a0a0a] border border-[#333] text-white px-4 py-2.5 rounded-xl text-sm font-mono focus:border-[#3428f8] outline-none shadow-inner"
                            />
                            {firstUploadDate && (
                              <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl font-medium">
                                Starts {new Date(firstUploadDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Weekly Content Cadence & Intervals */}
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl">
                        <div className="mb-4">
                          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">
                            2. Weekly Frequency & Interval Rules
                          </h4>
                          <p className="text-[#777] text-xs">
                            Define how many pieces of each content type to post every week, and the day gap between uploads.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* Static Posts Card */}
                          <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-xl flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 rounded-lg bg-[#3428f8]/20 text-[#3428f8]">
                                <ImageIcon size={16} />
                              </div>
                              <span className="text-white font-bold text-xs uppercase tracking-wider">Static Posts</span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Posts Per Week</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max="14"
                                  value={staticPerWeek}
                                  onChange={(e) => setStaticPerWeek(e.target.value)}
                                  className="w-full bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-[#3428f8] outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Gap Between Posts</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={staticInterval}
                                    onChange={(e) => setStaticInterval(e.target.value)}
                                    className="w-20 bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-[#3428f8] outline-none"
                                  />
                                  <span className="text-[#777] text-xs">days apart</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex justify-between text-xs">
                              <span className="text-[#666]">Monthly total:</span>
                              <span className="text-[#3428f8] font-bold">{(parseInt(staticPerWeek) || 0) * 4} posts</span>
                            </div>
                          </div>

                          {/* Reels / Shorts Card */}
                          <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-xl flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-500">
                                <Video size={16} />
                              </div>
                              <span className="text-white font-bold text-xs uppercase tracking-wider">Reels / Shorts</span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Reels Per Week</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max="14"
                                  value={reelsPerWeek}
                                  onChange={(e) => setReelsPerWeek(e.target.value)}
                                  className="w-full bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-pink-500 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Gap Between Reels</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    max="14"
                                    value={reelsInterval}
                                    onChange={(e) => setReelsInterval(e.target.value)}
                                    className="w-20 bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-pink-500 outline-none"
                                  />
                                  <span className="text-[#777] text-xs">days apart</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex justify-between text-xs">
                              <span className="text-[#666]">Monthly total:</span>
                              <span className="text-pink-400 font-bold">{(parseInt(reelsPerWeek) || 0) * 4} reels</span>
                            </div>
                          </div>

                          {/* Stories Card */}
                          <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-xl flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-400">
                                <Sparkles size={16} />
                              </div>
                              <span className="text-white font-bold text-xs uppercase tracking-wider">Stories</span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Stories Per Week</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max="21"
                                  value={storiesPerWeek}
                                  onChange={(e) => setStoriesPerWeek(e.target.value)}
                                  className="w-full bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-amber-400 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[#666] text-[10px] font-bold uppercase tracking-wider mb-1">Gap Between Stories</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={storiesInterval}
                                    onChange={(e) => setStoriesInterval(e.target.value)}
                                    className="w-20 bg-[#111] border border-[#333] text-white p-2 rounded-lg text-sm font-bold focus:border-amber-400 outline-none"
                                  />
                                  <span className="text-[#777] text-xs">days apart</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex justify-between text-xs">
                              <span className="text-[#666]">Monthly total:</span>
                              <span className="text-amber-400 font-bold">{(parseInt(storiesPerWeek) || 0) * 4} stories</span>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 3: 4-Week Schedule Preview */}
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
                              Generated 4-Week Timeline ({previewSchedule.length} total deliverables)
                            </h4>
                            <p className="text-[#777] text-xs">
                              This exact schedule will be plotted across your Admin Overview Calendar.
                            </p>
                          </div>

                          <button
                            onClick={handleSaveSchedule}
                            disabled={savingSchedule}
                            className="bg-[#3428f8] hover:bg-[#271bd1] disabled:bg-[#3428f8]/50 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(52,40,248,0.35)] flex items-center gap-2"
                          >
                            {savingSchedule ? (
                              <>
                                <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Check size={16} /> Save & Apply Schedule
                              </>
                            )}
                          </button>
                        </div>

                        {/* Schedule List Preview */}
                        <div data-lenis-prevent="true" className="max-h-64 overflow-y-auto custom-scrollbar overscroll-contain border border-[#1f1f1f] rounded-xl bg-[#080808]">
                          {previewSchedule.length === 0 ? (
                            <div className="p-8 text-center text-[#555] text-xs">
                              Select a First Upload Date and enter weekly values to generate the preview.
                            </div>
                          ) : (
                            <div className="divide-y divide-[#151515]">
                              {previewSchedule.map((item, idx) => {
                                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.static;
                                const Icon = cfg.icon;

                                return (
                                  <div key={idx} className="p-3 px-4 flex items-center justify-between hover:bg-[#111] transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className={`p-1.5 rounded-lg ${cfg.bg}/15 ${cfg.color}`}>
                                        <Icon size={14} />
                                      </div>
                                      <div>
                                        <span className="text-white text-xs font-medium block">
                                          {item.note}
                                        </span>
                                        <span className="text-[#666] text-[10px]">
                                          Day {item.dayNumber} of cycle • Time: {item.time}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <span className="text-xs font-mono text-[#aaa] font-bold block">
                                        {item.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                      </span>
                                      <span className="text-[10px] text-[#555] uppercase">
                                        Week {item.cycleWeek}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: DELIVERABLES & LOGGING (KEEP OLD FEATURES + STORIES) */}
                  {activeTab === 'logging' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Quota Progress Summary Cards */}
                      <div className="p-6 border-b border-[#222]">
                        <div className={`grid gap-4 ${selectedClient.latestOrder.posters_total > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                          
                          {/* Static Posts Progress */}
                          <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-2 mb-2">
                              <ImageIcon size={14} className="text-[#3428f8]" />
                              <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Static Posts</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-2xl font-serif text-white">{selectedClient.progress.static}</span>
                              <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.static_posts_total}</span>
                            </div>
                          </div>
                          
                          {/* Reels Progress */}
                          <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-2 mb-2">
                              <Video size={14} className="text-pink-500" />
                              <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Reels</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-2xl font-serif text-white">{selectedClient.progress.reels}</span>
                              <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.reels_total}</span>
                            </div>
                          </div>

                          {/* Stories Progress */}
                          <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={14} className="text-amber-400" />
                              <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Stories</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-2xl font-serif text-white">{selectedClient.progress.stories}</span>
                              <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.stories_total || selectedClient.scheduleConfig?.totalStories || 0}</span>
                            </div>
                          </div>
                          
                          {/* Posters Progress (if applicable) */}
                          {selectedClient.latestOrder.posters_total > 0 && (
                            <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                              <div className="flex items-center gap-2 mb-2">
                                <Layout size={14} className="text-green-500" />
                                <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Posters</span>
                              </div>
                              <div className="flex items-end gap-2">
                                <span className="text-2xl font-serif text-white">{selectedClient.progress.posters}</span>
                                <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.posters_total}</span>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>

                      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* Form: Log New Delivery */}
                        <div className="w-full md:w-1/2 p-6 border-r border-[#222] flex flex-col">
                          <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-4">Log New Delivery</h4>
                          
                          <form onSubmit={handleAddDeliverable} className="flex flex-col gap-4 flex-1">
                            <div>
                              <label className="block text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2">Post Type</label>
                              <select 
                                value={postType}
                                onChange={(e) => setPostType(e.target.value)}
                                className="w-full bg-[#111] border border-[#333] text-white p-3 rounded-xl outline-none focus:border-[#3428f8] text-sm transition-colors"
                              >
                                <option value="static">Static Post</option>
                                <option value="reel">Reel / Short</option>
                                <option value="story">Story</option>
                                {selectedClient.latestOrder.posters_total > 0 && <option value="poster">Poster</option>}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2">Title / Description</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Weekend Special Reel / Story promo"
                                value={postTitle}
                                onChange={(e) => setPostTitle(e.target.value)}
                                required
                                className="w-full bg-[#111] border border-[#333] text-white p-3 rounded-xl outline-none focus:border-[#3428f8] text-sm transition-colors"
                              />
                            </div>

                            <div className="mt-auto pt-4">
                              <button 
                                type="submit"
                                disabled={isSubmitting || !postTitle}
                                className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(52,40,248,0.3)] flex justify-center items-center gap-2"
                              >
                                {isSubmitting ? (
                                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                ) : (
                                  <><Plus size={16} /> Log Deliverable</>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* History: Delivery History */}
                        <div data-lenis-prevent="true" className="w-full md:w-1/2 p-6 overflow-y-auto custom-scrollbar overscroll-contain">
                          <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-4">Delivery History</h4>
                          
                          <div className="flex flex-col gap-3">
                            {selectedClient.posts.length === 0 ? (
                              <div className="text-center p-6 text-[#555] text-xs">
                                No posts logged yet for this billing cycle.
                              </div>
                            ) : (
                              selectedClient.posts.map(post => {
                                const cfg = TYPE_CONFIG[post.post_type] || TYPE_CONFIG.static;
                                const Icon = cfg.icon;

                                return (
                                  <div key={post.id} className="bg-[#111] border border-[#222] p-3 rounded-xl flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${cfg.bg}/15 ${cfg.color}`}>
                                      <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm truncate">{post.title}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[#666] text-[9px] font-bold uppercase tracking-widest">{post.post_type}</span>
                                        <span className="text-[#444] text-[9px] flex items-center gap-1">
                                          <Clock size={10} /> {new Date(post.published_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-12">
                  <CheckCircle size={48} className="text-[#333] mb-4" />
                  <h3 className="text-white font-serif text-2xl mb-2">{selectedClient.name} has no plan.</h3>
                  <p className="text-[#666] text-sm">This client is a lead and has not activated a subscription plan yet.</p>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-12">
                <CheckCircle size={48} className="text-[#222] mb-4" />
                <h3 className="text-white font-serif text-2xl mb-2">Select a Client</h3>
                <p className="text-[#666] text-sm">Choose an active client from the sidebar to manage their upload schedule and log deliverables.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
