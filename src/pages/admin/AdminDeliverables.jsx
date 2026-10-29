import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  Search, Image as ImageIcon, Video, Layout, Plus, CheckCircle, Clock, 
  Calendar as CalendarIcon, Sparkles, Check, ArrowRight, RefreshCw, AlertCircle, RotateCcw, Briefcase,
  Star, Globe, ExternalLink, Trash2, IndianRupee, Link as LinkIcon
} from 'lucide-react';
import { 
  getClientSchedule, saveClientSchedule, generateCustomSchedule, TYPE_CONFIG, broadcastDeliverablesSync,
  getSpecialDeliverables, saveSpecialDeliverable, deleteSpecialDeliverable
} from '../../utils/scheduleEngine';
import { dispatchPushNotification, triggerLocalNotification } from '../../utils/pushManager';
import AddSpecialDeliverableModal from '../../components/admin/AddSpecialDeliverableModal';
import { 
  fetchCreatorOrders, 
  saveCreatorOrder, 
  updateCreatorOrderNegotiation 
} from '../../utils/influencerEngine';

export default function AdminDeliverables() {
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('active'); // 'active' | 'pending' | 'all'
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'logging' | 'special'

  // Deliverables View Switcher: Retainers vs Creator Orders
  const [deliverablesMode, setDeliverablesMode] = useState('retainers'); // 'retainers' | 'creator_orders'
  const [creatorOrdersList, setCreatorOrdersList] = useState([]);

  // Negotiation Modal State
  const [negotiationOrder, setNegotiationOrder] = useState(null);
  const [negotiatedPriceInput, setNegotiatedPriceInput] = useState('');
  const [negotiatedReelsInput, setNegotiatedReelsInput] = useState(3);
  const [negotiatedStatusInput, setNegotiatedStatusInput] = useState('approved');
  const [negotiatedTermsInput, setNegotiatedTermsInput] = useState('100% On Agreement');
  const [negotiatedNotesInput, setNegotiatedNotesInput] = useState('');
  const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);

  // Special Deliverables State
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [togglingPaymentId, setTogglingPaymentId] = useState(null);
  const [deletingSpecialId, setDeletingSpecialId] = useState(null);

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
  const [revertingId, setRevertingId] = useState(null);

  // Dedicated refs for right panel scrolling isolation
  const rightPanelContainerRef = useRef(null);
  const scheduleScrollRef = useRef(null);
  const historyScrollRef = useRef(null);
  const specialScrollRef = useRef(null);

  // Isolate mouse wheel and touchpad scrolling exclusively to the right panel
  useEffect(() => {
    const container = rightPanelContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (window.innerWidth < 1024) return;
      // Prevent the wheel event from ever scrolling the outer Deliverables page / window
      e.preventDefault();
      e.stopPropagation();

      // Check if scrolling over a nested scrollable element (e.g. preview schedule table)
      const nested = e.target.closest('.nested-scroll');
      if (nested && nested.scrollHeight > nested.clientHeight) {
        const canScrollNestedDown = e.deltaY > 0 && nested.scrollTop + nested.clientHeight < nested.scrollHeight;
        const canScrollNestedUp = e.deltaY < 0 && nested.scrollTop > 0;
        if (canScrollNestedDown || canScrollNestedUp) {
          nested.scrollTop += e.deltaY;
          return;
        }
      }

      // Determine active target scroll pane
      const scrollTarget = activeTab === 'schedule' 
        ? scheduleScrollRef.current 
        : (activeTab === 'special' ? specialScrollRef.current : historyScrollRef.current);

      if (scrollTarget) {
        scrollTarget.scrollTop += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [activeTab, selectedClient]);

  useEffect(() => {
    fetchData();
    loadCreatorOrders();

    const handleRefresh = () => {
      fetchData();
      loadCreatorOrders();
    };
    window.addEventListener('om_business_added', handleRefresh);
    window.addEventListener('om_special_deliverable_changed', handleRefresh);
    window.addEventListener('om_creator_orders_changed', handleRefresh);
    return () => {
      window.removeEventListener('om_business_added', handleRefresh);
      window.removeEventListener('om_special_deliverable_changed', handleRefresh);
      window.removeEventListener('om_creator_orders_changed', handleRefresh);
    };
  }, []);

  const loadCreatorOrders = async () => {
    try {
      const orders = await fetchCreatorOrders();
      setCreatorOrdersList(orders || []);
    } catch (err) {
      console.warn("Could not fetch creator orders:", err);
    }
  };

  const handleOpenNegotiation = (order) => {
    setNegotiationOrder(order);
    setNegotiatedPriceInput(String(order.negotiated_price || order.proposed_budget || order.initial_quoted_price || ''));
    setNegotiatedReelsInput(order.reels_count || 3);
    setNegotiatedStatusInput(order.status || 'approved');
    setNegotiatedTermsInput(order.payment_terms || '100% On Agreement');
    setNegotiatedNotesInput(order.admin_notes || '');
  };

  const handleSaveNegotiation = async (e) => {
    if (e) e.preventDefault();
    if (!negotiationOrder) return;
    setIsSavingNegotiation(true);
    try {
      await updateCreatorOrderNegotiation(negotiationOrder.id, {
        negotiated_price: Number(negotiatedPriceInput || 0),
        reels_count: parseInt(negotiatedReelsInput) || 3,
        status: negotiatedStatusInput,
        payment_terms: negotiatedTermsInput,
        admin_notes: negotiatedNotesInput.trim()
      });
      setNegotiationOrder(null);
      await loadCreatorOrders();
    } catch (err) {
      alert("Error saving negotiation: " + err.message);
    } finally {
      setIsSavingNegotiation(false);
    }
  };

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
      setStaticPerWeek(cfg?.staticPerWeek ?? (isStarter ? 3 : 4));
      setStaticInterval(cfg?.staticInterval ?? 2);
      setReelsPerWeek(cfg?.reelsPerWeek ?? (isStarter ? 2 : 3));
      setReelsInterval(cfg?.reelsInterval ?? 3);
      setStoriesPerWeek(cfg?.storiesPerWeek ?? 4);
      setStoriesInterval(cfg?.storiesInterval ?? 2);
      setScheduleSavedSuccess(false);

      if (postType === 'poster') {
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

    // Fetch all special deliverables (with fallback)
    let specialDeliverablesList = [];
    try {
      const { data: spData } = await supabase
        .from('special_deliverables')
        .select('*')
        .order('created_at', { ascending: false });
      if (spData) specialDeliverablesList = spData;
    } catch {}

    if (profiles) {
      const enrichedClients = [];

      profiles.forEach(profile => {
        const clientOrders = orders ? orders.filter(o => o.client_id === profile.auth_id) : [];

        if (clientOrders.length === 0) {
          enrichedClients.push({
            ...profile,
            latestOrder: null,
            calculatedStatus: 'lead',
            scheduleConfig: null,
            posts: [],
            progress: { static: 0, reels: 0, stories: 0, posters: 0, total_delivered: 0, total_quota: 0 },
            displayTitle: profile.name,
            displayBusinessName: profile.business_type || 'Main Brand'
          });
        } else {
          clientOrders.forEach(order => {
            const isStarterOrd = (order.plan_name || '').toLowerCase().includes('starter');
            const normStatic = (order.static_posts_total && order.static_posts_total !== 10)
              ? order.static_posts_total
              : (isStarterOrd ? 12 : 15);
            const normReels = (order.reels_total && order.reels_total !== 3 && order.reels_total !== 4)
              ? order.reels_total
              : (isStarterOrd ? 8 : 12);
            const normStories = (order.stories_total && order.stories_total !== 32)
              ? order.stories_total
              : 15;

            const normalizedOrder = {
              ...order,
              static_posts_total: normStatic,
              reels_total: normReels,
              stories_total: normStories,
              posters_total: 0
            };

            let calculatedStatus = normalizedOrder.status;

            if (calculatedStatus === 'active' && normalizedOrder.created_at) {
              const createdDate = new Date(normalizedOrder.created_at);
              const expiryDate = new Date(createdDate);
              expiryDate.setDate(expiryDate.getDate() + 30);

              if (new Date() > expiryDate) {
                calculatedStatus = 'expired';
              }
            }

            const scheduleConfig = getClientSchedule(normalizedOrder);
            const clientPosts = posts ? posts.filter(p => p.order_id === normalizedOrder.order_id) : [];

            const staticDelivered = clientPosts.filter(p => p.post_type === 'static').length;
            const reelsDelivered = clientPosts.filter(p => p.post_type === 'reel').length;
            const storiesDelivered = clientPosts.filter(p => p.post_type === 'story').length;
            const postersDelivered = clientPosts.filter(p => p.post_type === 'poster').length;

            const storiesQuota = normalizedOrder.stories_total || scheduleConfig?.totalStories || 15;
            const totalQuota = (normalizedOrder.static_posts_total || 0) + 
                               (normalizedOrder.reels_total || 0) + 
                               storiesQuota;

            const progress = {
              static: staticDelivered,
              reels: reelsDelivered,
              stories: storiesDelivered,
              posters: postersDelivered,
              total_delivered: staticDelivered + reelsDelivered + storiesDelivered,
              total_quota: totalQuota
            };

            const bName = normalizedOrder.business_name || normalizedOrder.schedule_config?.business_name || profile.business_type || 'Main Brand';

            const clientSpecial = specialDeliverablesList.length > 0
              ? specialDeliverablesList.filter(s => s.order_id === normalizedOrder.order_id)
              : getSpecialDeliverables(normalizedOrder);

            enrichedClients.push({
              ...profile,
              auth_id: `${profile.auth_id}_${normalizedOrder.order_id}`,
              real_auth_id: profile.auth_id,
              displayTitle: `${profile.name} (${bName})`,
              displayBusinessName: bName,
              latestOrder: normalizedOrder,
              calculatedStatus,
              scheduleConfig,
              posts: clientPosts,
              specialDeliverables: clientSpecial,
              progress
            });
          });
        }
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
      // Dispatch push notification to client with the submitted content title
      const targetUserId = selectedClient.latestOrder.client_id || selectedClient.auth_id;
      const clientDisplayName = selectedClient.name || 'Client';
      const formattedType = postType.toUpperCase();
      const deliverableTitle = postTitle.trim();

      try {
        await dispatchPushNotification({
          targetUserId,
          targetClientName: clientDisplayName,
          title: deliverableTitle,
          body: `🚀 New ${formattedType} deliverable is now live on your Outliers Media dashboard.`,
          url: '/dashboard',
          isGlobal: false,
          postType
        });

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          await triggerLocalNotification(deliverableTitle, {
            body: `🚀 New ${formattedType} uploaded for ${clientDisplayName}!`,
            url: '/dashboard'
          });
        }
      } catch (pushErr) {
        console.warn("Could not dispatch deliverable push notification:", pushErr);
      }

      try {
        await broadcastDeliverablesSync({
          action: 'submit',
          orderId: selectedClient.latestOrder.order_id,
          postType,
          title: deliverableTitle
        });
      } catch (e) {
        console.warn("Realtime broadcast error:", e);
      }

      setPostTitle('');
      await fetchData();
    }

    setIsSubmitting(false);
  };

  const handleRevertDeliverable = async (post) => {
    if (!post?.id) return;
    setRevertingId(post.id);

    const { error } = await supabase
      .from('posts_log')
      .delete()
      .eq('id', post.id);

    if (error) {
      alert("Error reverting deliverable: " + error.message);
      setRevertingId(null);
      return;
    }

    if (post.title) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('title', post.title);
      } catch (e) {
        // Non-fatal
      }
    }

    try {
      await broadcastDeliverablesSync({
        action: 'revert',
        orderId: post.order_id,
        postLogId: post.id,
        title: post.title
      });
    } catch (e) {
      console.warn("Realtime broadcast error:", e);
    }

    await fetchData();
    setRevertingId(null);
  };

  const handleToggleSpecialPayment = async (deliverable) => {
    if (!selectedClient?.latestOrder) return;
    const nextStatus = deliverable.payment_status === 'paid' ? 'pending' : 'paid';
    setTogglingPaymentId(deliverable.id);
    try {
      const updated = {
        ...deliverable,
        payment_status: nextStatus,
        payment_id: nextStatus === 'paid' ? (deliverable.payment_id || `TXN-SPECIAL-${Date.now().toString().slice(-6)}`) : deliverable.payment_id
      };
      await saveSpecialDeliverable(selectedClient.latestOrder, updated);
      await fetchData();
    } catch (err) {
      alert("Error updating payment status: " + err.message);
    } finally {
      setTogglingPaymentId(null);
    }
  };

  const handleDeleteSpecial = async (deliverableId) => {
    if (!selectedClient?.latestOrder) return;
    if (!confirm("Are you sure you want to remove this special deliverable?")) return;
    setDeletingSpecialId(deliverableId);
    try {
      await deleteSpecialDeliverable(selectedClient.latestOrder, deliverableId);
      await fetchData();
    } catch (err) {
      alert("Error deleting special deliverable: " + err.message);
    } finally {
      setDeletingSpecialId(null);
    }
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
    <div className="bg-[#111] border border-[#222] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 min-h-[calc(100vh-140px)] shadow-2xl flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 sm:mb-6 gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif text-white mb-1 sm:mb-2">Deliverables & Content Pipeline</h2>
          <p className="text-[#888] text-xs sm:text-sm">Configure launch dates, customize weekly upload intervals, and track delivered assets.</p>
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

      {/* Pipeline View Mode Switcher: Retainers vs Creator Orders */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-2 rounded-2xl bg-[#0d0d0d] border border-[#222]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDeliverablesMode('retainers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              deliverablesMode === 'retainers'
                ? 'bg-[#3428f8] text-white shadow-md'
                : 'text-[#888] hover:text-white'
            }`}
          >
            Client Retainers & Schedules
          </button>

          <button
            type="button"
            onClick={() => setDeliverablesMode('creator_orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              deliverablesMode === 'creator_orders'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-purple-300/80 hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Creator Packs & Negotiations</span>
            {creatorOrdersList.filter(o => o.status === 'negotiating').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-mono font-bold">
                {creatorOrdersList.filter(o => o.status === 'negotiating').length}
              </span>
            )}
          </button>
        </div>

        {deliverablesMode === 'creator_orders' && (
          <span className="text-xs text-[#888] pr-2">
            {creatorOrdersList.length} Total Creator Orders Enrolled
          </span>
        )}
      </div>

      {deliverablesMode === 'creator_orders' ? (
        <div className="flex flex-col gap-6 flex-1">
          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                Total Creator Orders
              </span>
              <span className="text-2xl font-bold font-mono text-white">{creatorOrdersList.length}</span>
            </div>

            <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                In Negotiation
              </span>
              <span className="text-2xl font-bold font-mono text-amber-400">
                {creatorOrdersList.filter(o => o.status === 'negotiating').length}
              </span>
            </div>

            <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                Approved / Active
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {creatorOrdersList.filter(o => o.status === 'approved' || o.status === 'active').length}
              </span>
            </div>

            <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                Total Deal Volume
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                ₹{creatorOrdersList.reduce((acc, o) => acc + Number(o.negotiated_price || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {creatorOrdersList.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-[#222] p-12 rounded-3xl text-center text-[#777] flex flex-col items-center justify-center">
              <Video size={40} className="text-[#333] mb-3" />
              <h4 className="text-white text-base font-bold mb-1">No Creator Pack Orders Yet</h4>
              <p className="text-xs text-[#666] max-w-sm">
                When customers book or negotiate a Creator Reels Pack on the Home page, their proposals will appear here for you to negotiate and lock terms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {creatorOrdersList.map(order => {
                const isNegotiating = order.status === 'negotiating';
                return (
                  <div
                    key={order.id}
                    className={`bg-[#0a0a0a] border p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all ${
                      isNegotiating ? 'border-amber-500/40' : 'border-[#222]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-[#888] bg-[#161616] px-2 py-0.5 rounded border border-[#262626]">
                          {order.order_number || order.id}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isNegotiating
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : order.status === 'approved'
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            : order.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      <h3 className="text-white font-bold text-base truncate mb-1">
                        {order.business_name || 'Client Order'}
                      </h3>
                      <p className="text-xs text-[#888] mb-3">
                        {order.contact_name} • {order.phone}
                        {order.instagram_handle && (
                          <span className="block text-[#aaa] mt-0.5 font-mono">@{order.instagram_handle}</span>
                        )}
                      </p>

                      {/* Financial & Scope Box */}
                      <div className="p-3 rounded-xl bg-[#121212] border border-[#222] space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#777]">Scope:</span>
                          <span className="text-cyan-400 font-bold font-mono">{order.reels_count} Creator Reels</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#777]">Initial Quoted:</span>
                          <span className="text-[#888] font-mono">₹{Number(order.initial_quoted_price || 0).toLocaleString()}</span>
                        </div>
                        {order.proposed_budget > 0 && order.proposed_budget !== order.initial_quoted_price && (
                          <div className="flex justify-between">
                            <span className="text-amber-400 font-bold">Client Offer:</span>
                            <span className="text-amber-400 font-mono font-bold">₹{Number(order.proposed_budget).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-[#1f1f1f]">
                          <span className="text-white font-bold">Agreed / Current:</span>
                          <span className="text-emerald-400 font-mono font-bold text-sm">
                            ₹{Number(order.negotiated_price || order.initial_quoted_price || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {order.client_notes && (
                        <div className="mt-3 p-2.5 rounded-lg bg-[#141414] border border-[#1f1f1f] text-[11px] text-[#aaa]">
                          <span className="text-[#666] block text-[9px] uppercase font-bold mb-0.5">Client Note:</span>
                          {order.client_notes}
                        </div>
                      )}

                      {order.admin_notes && (
                        <div className="mt-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300">
                          <span className="text-purple-400 block text-[9px] uppercase font-bold mb-0.5">Admin Terms:</span>
                          {order.admin_notes}
                        </div>
                      )}
                    </div>

                    {/* Action: Negotiate */}
                    <button
                      type="button"
                      onClick={() => handleOpenNegotiation(order)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1e1e1e] hover:bg-purple-600 text-white border border-[#333] hover:border-purple-500 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      {isNegotiating ? 'Negotiate & Lock Price' : 'Edit Agreed Terms'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      loading && clientsList.length === 0 ? (
        <div className="flex justify-center items-center flex-1">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 flex-1">
          
          {/* Left Panel: Active & Pending Clients Sidebar */}
          <div className="w-full lg:w-1/3 flex flex-col gap-3">
            {/* Filter Pills */}
            <div className="flex gap-1.5 bg-[#0a0a0a] p-1 rounded-xl border border-[#222]">
              <button
                onClick={() => setClientFilter('active')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'active' 
                    ? 'bg-[#3428f8] text-white' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                Active Plans
              </button>
              <button
                onClick={() => setClientFilter('pending')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'pending' 
                    ? 'bg-[#3428f8] text-white' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setClientFilter('all')}
                className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  clientFilter === 'all' 
                    ? 'bg-[#3428f8] text-white' 
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
              >
                All
              </button>
            </div>

            {/* Client List: Compact max-height on mobile so workspace is immediately visible below */}
            <div data-lenis-prevent="true" className="flex flex-col gap-2.5 sm:gap-3 max-h-[240px] lg:max-h-none lg:h-[680px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar overscroll-contain">
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
                      className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        selectedClient?.auth_id === client.auth_id 
                          ? 'bg-[#3428f8]/10 border-[#3428f8]' 
                          : 'bg-[#0a0a0a] border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-white font-bold text-sm truncate">{client.name || 'Unknown'}</h4>
                          {client.displayBusinessName && (
                            <p className="text-[#3428f8] text-xs font-semibold truncate capitalize flex items-center gap-1 mt-0.5">
                              <Briefcase size={11} className="shrink-0" />
                              {client.displayBusinessName}
                            </p>
                          )}
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
          <div ref={rightPanelContainerRef} className="w-full lg:w-2/3 bg-[#0a0a0a] border border-[#222] rounded-2xl flex flex-col h-auto lg:h-[740px] overflow-visible lg:overflow-hidden">
            {selectedClient ? (
              selectedClient.latestOrder ? (
                <>
                  {/* Client Summary Header */}
                  <div className="p-4 sm:p-6 border-b border-[#222] bg-[#0c0c0c] flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                    <div className="min-w-0 w-full md:w-auto">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h3 className="text-lg sm:text-xl font-serif text-white truncate">
                          {selectedClient.name}
                          {selectedClient.displayBusinessName && (
                            <span className="text-sm font-sans font-bold text-[#3428f8] ml-2">
                              • {selectedClient.displayBusinessName}
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] sm:text-xs bg-[#1f1f1f] text-[#3428f8] border border-[#333] px-2.5 py-0.5 rounded-full font-bold">
                          {selectedClient.latestOrder.plan_name}
                        </span>
                      </div>
                      <p className="text-[#888] text-[11px] sm:text-xs font-mono mt-1 truncate">
                        Order {selectedClient.latestOrder.order_id} • {selectedClient.email}
                      </p>
                    </div>

                    {/* Tab Buttons & Action */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      <div className="flex w-full sm:w-auto bg-[#161616] p-1 rounded-xl border border-[#2a2a2a]">
                        <button
                          onClick={() => setActiveTab('schedule')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'schedule'
                              ? 'bg-[#3428f8] text-white'
                              : 'text-[#888] hover:text-white'
                          }`}
                        >
                          <CalendarIcon size={13} /> Schedule
                        </button>
                        <button
                          onClick={() => setActiveTab('logging')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'logging'
                              ? 'bg-[#3428f8] text-white'
                              : 'text-[#888] hover:text-white'
                          }`}
                        >
                          <Plus size={13} /> Log & History
                        </button>
                        <button
                          onClick={() => setActiveTab('special')}
                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'special'
                              ? 'bg-purple-600 text-white'
                              : 'text-purple-300/80 hover:text-white'
                          }`}
                        >
                          <Star size={13} className="text-purple-400" />
                          <span>Special</span>
                          {selectedClient.specialDeliverables?.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 bg-purple-500/20 text-purple-200 rounded-full text-[9px] font-mono font-bold">
                              {selectedClient.specialDeliverables.length}
                            </span>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSpecialModalOpen(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                        title="Add a custom deliverable (website, extra reels, landing page)"
                      >
                        <Plus size={13} />
                        <span>+ Special Deliverable</span>
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: UPLOAD SCHEDULE */}
                  {activeTab === 'schedule' && (
                    <div ref={scheduleScrollRef} data-lenis-prevent="true" className="flex-1 min-h-0 lg:overflow-y-auto p-4 sm:p-6 custom-scrollbar overscroll-contain flex flex-col gap-5 sm:gap-6">
                      
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
                      <div className="bg-[#111] border border-[#222] p-4 sm:p-6 rounded-2xl">
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

                          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
                            <input 
                              type="date"
                              value={firstUploadDate}
                              onChange={(e) => setFirstUploadDate(e.target.value)}
                              className="w-full sm:w-auto bg-[#0a0a0a] border border-[#333] text-white px-4 py-2.5 rounded-xl text-sm font-mono focus:border-[#3428f8] outline-none shadow-inner"
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
                            className="bg-[#3428f8] hover:bg-[#271bd1] disabled:bg-[#3428f8]/50 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
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
                        <div data-lenis-prevent="true" className="max-h-64 overflow-y-auto custom-scrollbar overscroll-contain border border-[#1f1f1f] rounded-xl bg-[#080808] nested-scroll">
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
                    <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
                      {/* Quota Progress Summary Cards */}
                      <div className="p-4 sm:p-6 border-b border-[#222]">
                        <div className={`grid gap-2.5 sm:gap-4 ${selectedClient.latestOrder.posters_total > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                          
                          {/* Static Posts Progress */}
                          <div className="bg-[#111] p-3 sm:p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                              <ImageIcon size={13} className="text-[#3428f8] shrink-0" />
                              <span className="text-[#888] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest truncate">Posts</span>
                            </div>
                            <div className="flex items-end gap-1 sm:gap-2">
                              <span className="text-xl sm:text-2xl font-serif text-white">{selectedClient.progress.static}</span>
                              <span className="text-[#555] text-xs sm:text-sm mb-0.5 sm:mb-1">/ {selectedClient.latestOrder.static_posts_total}</span>
                            </div>
                          </div>
                          
                          {/* Reels Progress */}
                          <div className="bg-[#111] p-3 sm:p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                              <Video size={13} className="text-pink-500 shrink-0" />
                              <span className="text-[#888] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest truncate">Reels</span>
                            </div>
                            <div className="flex items-end gap-1 sm:gap-2">
                              <span className="text-xl sm:text-2xl font-serif text-white">{selectedClient.progress.reels}</span>
                              <span className="text-[#555] text-xs sm:text-sm mb-0.5 sm:mb-1">/ {selectedClient.latestOrder.reels_total}</span>
                            </div>
                          </div>

                          {/* Stories Progress */}
                          <div className="bg-[#111] p-3 sm:p-4 rounded-xl border border-[#222]">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                              <Sparkles size={13} className="text-amber-400 shrink-0" />
                              <span className="text-[#888] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest truncate">Stories</span>
                            </div>
                            <div className="flex items-end gap-1 sm:gap-2">
                              <span className="text-xl sm:text-2xl font-serif text-white">{selectedClient.progress.stories}</span>
                              <span className="text-[#555] text-xs sm:text-sm mb-0.5 sm:mb-1">/ {selectedClient.latestOrder.stories_total || selectedClient.scheduleConfig?.totalStories || 0}</span>
                            </div>
                          </div>
                          
                          {/* Posters Progress (if applicable) */}
                          {selectedClient.latestOrder.posters_total > 0 && (
                            <div className="bg-[#111] p-3 sm:p-4 rounded-xl border border-[#222]">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                <Layout size={13} className="text-green-500 shrink-0" />
                                <span className="text-[#888] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest truncate">Posters</span>
                              </div>
                              <div className="flex items-end gap-1 sm:gap-2">
                                <span className="text-xl sm:text-2xl font-serif text-white">{selectedClient.progress.posters}</span>
                                <span className="text-[#555] text-xs sm:text-sm mb-0.5 sm:mb-1">/ {selectedClient.latestOrder.posters_total}</span>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>

                      <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#222] lg:overflow-hidden">
                        {/* Form: Log New Delivery */}
                        <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col">
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
                                className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex justify-center items-center gap-2"
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
                        <div ref={historyScrollRef} data-lenis-prevent="true" className="w-full md:w-1/2 p-4 sm:p-6 min-h-0 max-h-[380px] lg:max-h-none overflow-y-auto custom-scrollbar overscroll-contain">
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
                                  <div key={post.id} className="bg-[#111] border border-[#222] hover:border-[#333] p-3 rounded-xl flex items-center gap-3 transition-colors">
                                    <div className={`p-2 rounded-lg ${cfg.bg}/15 ${cfg.color}`}>
                                      <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm truncate">{post.title}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[#666] text-[9px] font-bold uppercase tracking-widest">{post.post_type}</span>
                                        <span className="text-[#444] text-[9px] flex items-center gap-1">
                                          <Clock size={10} /> {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={revertingId === post.id}
                                      onClick={() => handleRevertDeliverable(post)}
                                      className="shrink-0 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/25 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                                      title="Revert this submission and update client live"
                                    >
                                      {revertingId === post.id ? (
                                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400"></span>
                                      ) : (
                                        <><RotateCcw size={11} /> Revert</>
                                      )}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB 3: SPECIAL DELIVERABLES & CUSTOM PROJECTS */}
                  {activeTab === 'special' && (
                    <div ref={specialScrollRef} data-lenis-prevent="true" className="flex-1 min-h-0 lg:overflow-y-auto p-4 sm:p-6 custom-scrollbar overscroll-contain flex flex-col gap-5">
                      
                      {/* Top Action Bar & Metrics */}
                      <div className="bg-[#111] border border-[#222] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Star size={16} className="text-purple-400" />
                            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
                              Special Deliverables & Custom Add-ons
                            </h4>
                            <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                              {selectedClient.specialDeliverables?.length || 0} Total
                            </span>
                          </div>
                          <p className="text-[#777] text-xs mt-1">
                            Interactive websites, spin the wheel apps, extra reels, landing pages, or event campaigns.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsSpecialModalOpen(true)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Plus size={14} /> + Add Special Deliverable
                        </button>
                      </div>

                      {/* Deliverables List */}
                      {(!selectedClient.specialDeliverables || selectedClient.specialDeliverables.length === 0) ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0a0a] border border-[#222] rounded-2xl text-center">
                          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 border border-purple-500/20">
                            <Star size={24} />
                          </div>
                          <h4 className="text-white font-bold text-base mb-1">No Special Deliverables Yet</h4>
                          <p className="text-[#666] text-xs max-w-md mb-4">
                            Has this client asked for a custom website (like a spin-the-wheel app), extra reels, or a special promotional campaign?
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsSpecialModalOpen(true)}
                            className="inline-flex items-center gap-1.5 bg-[#181818] hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                          >
                            <Plus size={13} /> Add First Special Deliverable
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {selectedClient.specialDeliverables.map(deliv => {
                            const isPaid = deliv.payment_status === 'paid';
                            const isComplimentary = deliv.payment_status === 'complimentary' || Number(deliv.price || 0) === 0;
                            const isDelivered = deliv.status === 'delivered';

                            return (
                              <div 
                                key={deliv.id}
                                className="bg-[#111] border border-[#222] hover:border-[#333] p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                      <Star size={10} /> {deliv.category || deliv.custom_type_name || 'Special Project'}
                                    </span>

                                    {isDelivered ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                        <CheckCircle size={10} /> Delivered / Live
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                        <Clock size={10} /> In Progress
                                      </span>
                                    )}

                                    <span className="text-[10px] text-[#666] font-mono flex items-center gap-1 ml-auto sm:ml-0">
                                      <CalendarIcon size={11} />
                                      {deliv.delivered_at ? new Date(deliv.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </span>
                                  </div>

                                  <h4 className="text-white text-base font-bold truncate mb-1">
                                    {deliv.title}
                                  </h4>

                                  {deliv.description && (
                                    <p className="text-[#888] text-xs line-clamp-2 mb-2">
                                      {deliv.description}
                                    </p>
                                  )}

                                  {/* Project / Live URL Link */}
                                  {deliv.project_url && (
                                    <div className="mt-1">
                                      <a
                                        href={deliv.project_url.startsWith('http') ? deliv.project_url : `https://${deliv.project_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
                                      >
                                        <Globe size={13} />
                                        <span className="truncate max-w-xs">{deliv.project_url}</span>
                                        <ExternalLink size={11} />
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {/* Financial Badge & Actions */}
                                <div className="flex flex-wrap md:flex-col items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[#1c1c1c]">
                                  {/* Price & Payment Pill */}
                                  <div className="flex items-center gap-2">
                                    {isComplimentary ? (
                                      <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                        Complimentary (₹0)
                                      </span>
                                    ) : (
                                      <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                                        isPaid 
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                      }`}>
                                        <IndianRupee size={12} />
                                        <span>₹{Number(deliv.price).toLocaleString()}</span>
                                        <span className="text-[10px] uppercase font-sans font-extrabold ml-1">
                                          {isPaid ? '• Paid ✓' : '• Due ⚠️'}
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Quick Action Toggles */}
                                  <div className="flex items-center gap-2">
                                    {!isComplimentary && (
                                      <button
                                        type="button"
                                        disabled={togglingPaymentId === deliv.id}
                                        onClick={() => handleToggleSpecialPayment(deliv)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                          isPaid
                                            ? 'bg-[#181818] hover:bg-amber-500/20 text-[#aaa] hover:text-amber-300 border-[#2a2a2a]'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-black border-transparent'
                                        }`}
                                        title={isPaid ? "Click to toggle payment back to Pending" : "Click to mark payment as Paid"}
                                      >
                                        {togglingPaymentId === deliv.id ? (
                                          <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                                        ) : isPaid ? (
                                          'Mark Due'
                                        ) : (
                                          '✓ Mark Paid'
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={deletingSpecialId === deliv.id}
                                      onClick={() => handleDeleteSpecial(deliv.id)}
                                      className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                      title="Delete special deliverable"
                                    >
                                      {deletingSpecialId === deliv.id ? (
                                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400"></span>
                                      ) : (
                                        <Trash2 size={13} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

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
      ))}

      {/* Add Special Deliverable Modal */}
      {selectedClient?.latestOrder && (
        <AddSpecialDeliverableModal
          isOpen={isSpecialModalOpen}
          onClose={() => setIsSpecialModalOpen(false)}
          initialClient={selectedClient}
          initialOrder={selectedClient.latestOrder}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Negotiation & Terms Editor Modal */}
      {negotiationOrder && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setNegotiationOrder(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#101010] border border-[#2a2a2a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex justify-between items-center pb-4 border-b border-[#222] mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                  Proposal Management
                </span>
                <h3 className="text-xl font-serif text-white font-bold">
                  Negotiate Creator Pack
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNegotiationOrder(null)}
                className="text-[#888] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#161616] border border-[#252525] mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#888]">Business:</span>
                <span className="text-white font-bold">{negotiationOrder.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">Contact:</span>
                <span className="text-white">{negotiationOrder.contact_name} ({negotiationOrder.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">Original Quote:</span>
                <span className="text-[#aaa] font-mono">₹{Number(negotiationOrder.initial_quoted_price).toLocaleString()}</span>
              </div>
              {negotiationOrder.proposed_budget > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-400 font-bold">Client Offer:</span>
                  <span className="text-amber-400 font-mono font-bold">₹{Number(negotiationOrder.proposed_budget).toLocaleString()}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveNegotiation} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Agreed Package Price (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  value={negotiatedPriceInput}
                  onChange={(e) => setNegotiatedPriceInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white font-mono focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                    Reels Allocated *
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="50"
                    required
                    value={negotiatedReelsInput}
                    onChange={(e) => setNegotiatedReelsInput(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white font-mono focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                    Order Status *
                  </label>
                  <select
                    value={negotiatedStatusInput}
                    onChange={(e) => setNegotiatedStatusInput(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="negotiating">Negotiating</option>
                    <option value="approved">Approved</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Payment Milestone Terms
                </label>
                <select
                  value={negotiatedTermsInput}
                  onChange={(e) => setNegotiatedTermsInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="100% On Agreement">100% On Agreement</option>
                  <option value="50% Advance / 50% On Delivery">50% Advance / 50% On Delivery</option>
                  <option value="33% x 3 Milestones">33% x 3 Milestones</option>
                  <option value="Post-Delivery">Post-Delivery</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Negotiation Notes / Contract Specifics
                </label>
                <textarea
                  rows="2"
                  value={negotiatedNotesInput}
                  onChange={(e) => setNegotiatedNotesInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setNegotiationOrder(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#181818] border border-[#282828] text-xs font-bold uppercase tracking-wider text-[#aaa] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNegotiation}
                  className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingNegotiation ? 'Saving...' : 'Lock & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
