import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, CheckCircle, Plus, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Layout, AlertTriangle, Clock, X, Check, ArrowRight, ExternalLink, Flame, IndianRupee, MessageSquare, RotateCcw, Trash2, Star, Globe, Briefcase, CreditCard, Edit3 } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

import { generateUploadSchedule, getClientSchedule, TYPE_CONFIG, matchPostsToScheduleSlots, broadcastDeliverablesSync, getSpecialDeliverables, saveSpecialDeliverable, toLocalDateKey } from '../../utils/scheduleEngine';
import { computeOrderInstallmentMetrics } from '../../utils/installmentEngine';
import { dispatchPushNotification, triggerLocalNotification } from '../../utils/pushManager';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ mrr: 0, activeRetainers: 0, pendingAmount: 0, pendingOrdersCount: 0, pendingToday: 0 });
  const [loading, setLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Top Metrics Details Modal state
  const [selectedMetric, setSelectedMetric] = useState(null); // 'mrr' | 'retainers' | 'pending_payments' | 'due'
  const [pendingPaymentsList, setPendingPaymentsList] = useState([]);
  const [pendingFilter, setPendingFilter] = useState('all'); // 'all' | 'emi' | 'special' | 'order'
  const [detailedRetainers, setDetailedRetainers] = useState([]);

  // Quick Post Logger state
  const [logOrderId, setLogOrderId] = useState('');
  const [logType, setLogType] = useState('static');
  const [logTitle, setLogTitle] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [quickLogSuccess, setQuickLogSuccess] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  // Calendar Event Card Popup state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventPostType, setEventPostType] = useState('static');
  const [eventSwapNote, setEventSwapNote] = useState('');
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [isRevertingWork, setIsRevertingWork] = useState(false);

  // Edit Already Delivered Event state
  const [isEditingDelivered, setIsEditingDelivered] = useState(false);
  const [editDeliveredType, setEditDeliveredType] = useState('static');
  const [editDeliveredTitle, setEditDeliveredTitle] = useState('');
  const [editDeliveredSwapNote, setEditDeliveredSwapNote] = useState('');
  const [isSavingEditDelivered, setIsSavingEditDelivered] = useState(false);

  // Custom Deliverable Adder state
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customOrderId, setCustomOrderId] = useState('');
  const [customType, setCustomType] = useState('reel');
  const [customTitle, setCustomTitle] = useState('');
  const [customSwapNote, setCustomSwapNote] = useState('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const handleOpenEvent = (ev) => {
    setSelectedEvent(ev);
    setIsEditingDelivered(false);
    const initialType = ev.deliveredType || (['static', 'reel', 'story', 'poster'].includes(ev.type) ? ev.type : 'static');
    setEventPostType(initialType);
    setEditDeliveredType(initialType);
    setEventSwapNote('');
    setEditDeliveredSwapNote('');

    const cfg = TYPE_CONFIG[initialType] || TYPE_CONFIG.static;
    const defaultTitle = ev.deliveredTitle
      ? ev.deliveredTitle
      : ev.note 
      ? `${cfg.label} — ${ev.note}` 
      : `${cfg.label} Delivery (${new Date(ev.date).toLocaleDateString('en-IN')})`;
    setEventTitle(defaultTitle);
    setEditDeliveredTitle(ev.deliveredTitle || defaultTitle);
  };

  const handleMarkDelivered = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEvent) return;
    setIsSubmittingWork(true);

    const postType = ['static', 'reel', 'story', 'poster'].includes(eventPostType) 
      ? eventPostType 
      : (['static', 'reel', 'story', 'poster'].includes(selectedEvent.type) ? selectedEvent.type : 'static');

    // Anchor published_at to the exact calendar slot date (at 12:00 local time) so it matches this exact date slot
    const slotD = new Date(selectedEvent.date);
    const targetPublishedAt = new Date(
      slotD.getFullYear(),
      slotD.getMonth(),
      slotD.getDate(),
      12, 0, 0
    ).toISOString();

    let deliverableTitle = eventTitle.trim() || `${TYPE_CONFIG[postType]?.label || 'Deliverable'}`;
    if (eventSwapNote.trim() && !deliverableTitle.includes(eventSwapNote.trim())) {
      deliverableTitle = `${deliverableTitle} (${eventSwapNote.trim()})`;
    }

    const { error } = await supabase.from('posts_log').insert([{
      order_id: selectedEvent.orderId,
      post_type: postType,
      title: deliverableTitle,
      published_at: targetPublishedAt
    }]);

    if (error) {
      alert("Error logging deliverable: " + error.message);
    } else {
      // Broadcast live update to Client Dashboard immediately
      await broadcastDeliverablesSync({
        orderId: selectedEvent.orderId,
        action: 'submit',
        postType,
        title: deliverableTitle
      });

      // Dispatch push notification to client with the submitted content title
      let targetUserId = selectedEvent?.clientId;
      let clientDisplayName = selectedEvent?.clientName || 'Client';

      if (!targetUserId && selectedEvent?.orderId) {
        const { data: ordData } = await supabase
          .from('orders')
          .select('client_id')
          .eq('order_id', selectedEvent.orderId)
          .single();
        if (ordData) targetUserId = ordData.client_id;
      }

      const formattedType = postType.toUpperCase();

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

        // Also trigger immediate local notification so submitter sees the notification pop up
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          await triggerLocalNotification(deliverableTitle, {
            body: `🚀 New ${formattedType} uploaded for ${clientDisplayName}!`,
            url: '/dashboard'
          });
        }
      } catch (pushErr) {
        console.warn("Could not dispatch deliverable push notification:", pushErr);
      }

      setQuickLogSuccess(`✓ Submitted "${deliverableTitle}" as ${formattedType} for ${new Date(selectedEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} & pushed live to ${clientDisplayName}!`);
      setTimeout(() => setQuickLogSuccess(null), 5000);

      await fetchAll();
      setSelectedEvent(null);
    }
    setIsSubmittingWork(false);
  };

  const handleSaveEditDelivered = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEvent?.postLogId || !editDeliveredTitle.trim()) return;
    setIsSavingEditDelivered(true);

    try {
      let finalTitle = editDeliveredTitle.trim();
      if (editDeliveredSwapNote.trim() && !finalTitle.includes(editDeliveredSwapNote.trim())) {
        finalTitle = `${finalTitle} (${editDeliveredSwapNote.trim()})`;
      }

      const { error } = await supabase
        .from('posts_log')
        .update({
          post_type: editDeliveredType,
          title: finalTitle
        })
        .eq('id', selectedEvent.postLogId);

      if (error) {
        alert("Failed to update deliverable: " + error.message);
        setIsSavingEditDelivered(false);
        return;
      }

      await broadcastDeliverablesSync({
        orderId: selectedEvent.orderId,
        action: 'edit',
        postLogId: selectedEvent.postLogId,
        postType: editDeliveredType,
        title: finalTitle
      });

      setQuickLogSuccess(`✓ Deliverable updated! Swapped format to ${editDeliveredType.toUpperCase()} & synchronized live.`);
      setTimeout(() => setQuickLogSuccess(null), 5000);

      await fetchAll();
      setIsEditingDelivered(false);
      setSelectedEvent(null);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingEditDelivered(false);
    }
  };

  const handleOpenAddCustomDeliverable = (initialDateStr) => {
    const defaultDate = initialDateStr || toLocalDateKey(new Date());
    setCustomDate(defaultDate);
    setCustomOrderId(activeOrders[0]?.order_id || '');
    setCustomType('reel');
    setCustomTitle('');
    setCustomSwapNote('');
    setIsAddCustomModalOpen(true);
  };

  const handleSaveCustomDeliverable = async (e) => {
    if (e) e.preventDefault();
    if (!customOrderId || !customTitle.trim() || !customDate) {
      alert("Please select a client, date, and enter a title.");
      return;
    }

    setIsSubmittingCustom(true);
    try {
      const parts = customDate.split('-');
      const targetPublishedAt = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
        12, 0, 0
      ).toISOString();

      let finalTitle = customTitle.trim();
      if (customSwapNote.trim() && !finalTitle.includes(customSwapNote.trim())) {
        finalTitle = `${finalTitle} (${customSwapNote.trim()})`;
      }

      const { error } = await supabase.from('posts_log').insert([{
        order_id: customOrderId,
        post_type: customType,
        title: finalTitle,
        published_at: targetPublishedAt
      }]);

      if (error) {
        alert("Error saving custom deliverable: " + error.message);
        setIsSubmittingCustom(false);
        return;
      }

      const targetOrder = activeOrders.find(o => o.order_id === customOrderId);
      const targetUserId = targetOrder?.client_id;
      const clientDisplayName = targetOrder?.clientName || 'Client';
      const formattedType = customType.toUpperCase();

      await broadcastDeliverablesSync({
        orderId: customOrderId,
        action: 'submit',
        postType: customType,
        title: finalTitle
      });

      try {
        await dispatchPushNotification({
          targetUserId,
          targetClientName: clientDisplayName,
          title: finalTitle,
          body: `🚀 New ${formattedType} deliverable is now live on your Outliers Media dashboard.`,
          url: '/dashboard',
          isGlobal: false,
          postType: customType
        });
      } catch (pushErr) {
        console.warn("Could not dispatch push notification:", pushErr);
      }

      setQuickLogSuccess(`✓ Custom ${formattedType} deliverable added for ${clientDisplayName} on ${customDate}!`);
      setTimeout(() => setQuickLogSuccess(null), 5000);

      setIsAddCustomModalOpen(false);
      await fetchAll();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  // Revert (Undo) a submitted deliverable and push live changes to Client Dashboard
  const handleRevertDeliverable = async (postLogId, meta = {}) => {
    if (!postLogId) {
      alert("Could not find the log ID for this submission.");
      return;
    }
    setIsRevertingWork(true);
    try {
      const { error } = await supabase
        .from('posts_log')
        .delete()
        .eq('id', postLogId);

      if (error) {
        alert("Failed to revert submission: " + error.message);
        setIsRevertingWork(false);
        return;
      }

      // Also clean up any matching persistent notification in Supabase if present
      if (meta.title) {
        try {
          await supabase
            .from('notifications')
            .delete()
            .eq('title', meta.title);
        } catch {
          // Ignore if notifications table doesn't restrict or match
        }
      }

      // Broadcast live revert to Client Dashboard immediately
      await broadcastDeliverablesSync({
        orderId: meta.orderId || selectedEvent?.orderId,
        action: 'revert',
        postLogId
      });

      setQuickLogSuccess(`↩ Reverted "${meta.title || 'Deliverable'}" — Client dashboard updated live!`);
      setTimeout(() => setQuickLogSuccess(null), 5000);

      await fetchAll();
      if (selectedEvent && selectedEvent.postLogId === postLogId) {
        setSelectedEvent(null);
      }
    } catch (err) {
      alert("Error reverting deliverable: " + err.message);
    } finally {
      setIsRevertingWork(false);
    }
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
    const { data: rawPosts } = await supabase.from('posts_log').select('*').order('published_at', { ascending: false });
    
    const ordersList = orders || [];
    let postsList = rawPosts || [];

    // Fetch special deliverables (with fallback)
    let specialList = [];
    try {
      const { data: spData } = await supabase
        .from('special_deliverables')
        .select('*')
        .order('created_at', { ascending: false });
      if (spData) specialList = spData;
    } catch {}

    // --- ONE-TIME AUTO-REPAIR FOR OCT 12 CRAVORY STORY/STATIC SUBMISSIONS ---
    // Previously, submitting a 'story' event on the calendar fell back to post_type='static',
    // which caused extra 'static' rows to mark Oct 14, 16, and 19 Static Posts as delivered.
    try {
      const repairKey = 'outliers_repaired_oct12_cravory_v2';
      if (typeof window !== 'undefined' && !localStorage.getItem(repairKey) && postsList.length > 0) {
        let didRepair = false;

        for (const ord of ordersList) {
          const ordPosts = [...postsList.filter(p => p.order_id === ord.order_id)].sort(
            (a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0)
          );
          const staticPosts = ordPosts.filter(p => p.post_type === 'static');
          const storyPosts = ordPosts.filter(p => p.post_type === 'story');

          // 1. Any post saved as 'static' whose title starts with 'Story' was meant to be a story
          const mislabelledStories = staticPosts.filter(p => (p.title || '').toLowerCase().includes('story'));
          if (mislabelledStories.length > 0) {
            const firstStory = mislabelledStories[0];
            await supabase
              .from('posts_log')
              .update({
                post_type: 'story',
                published_at: new Date(2026, 9, 12, 12, 0, 0).toISOString()
              })
              .eq('id', firstStory.id);

            // Delete any extra duplicate clicks beyond the first story
            for (let i = 1; i < mislabelledStories.length; i++) {
              await supabase.from('posts_log').delete().eq('id', mislabelledStories[i].id);
            }
            didRepair = true;
          } else if (staticPosts.length > 1 && storyPosts.length === 0) {
            // 2. If multiple static posts were submitted at once for Oct 12 and 0 stories exist:
            // Keep the first static post on Oct 12, convert one to Story on Oct 12 if title wasn't custom static, and remove accidental Oct 14/16/19 overflow
            const firstStatic = staticPosts[0];
            await supabase
              .from('posts_log')
              .update({ published_at: new Date(2026, 9, 12, 12, 0, 0).toISOString() })
              .eq('id', firstStatic.id);

            if (staticPosts.length >= 2) {
              const secondAsStory = staticPosts[1];
              await supabase
                .from('posts_log')
                .update({
                  post_type: 'story',
                  published_at: new Date(2026, 9, 12, 12, 0, 0).toISOString()
                })
                .eq('id', secondAsStory.id);
            }

            for (let i = 2; i < staticPosts.length; i++) {
              await supabase.from('posts_log').delete().eq('id', staticPosts[i].id);
            }
            didRepair = true;
          }
        }

        localStorage.setItem(repairKey, 'true');
        if (didRepair) {
          const { data: refreshedPosts } = await supabase
            .from('posts_log')
            .select('*')
            .order('published_at', { ascending: false });
          if (refreshedPosts) postsList = refreshedPosts;
          await broadcastDeliverablesSync({ action: 'auto_repaired_oct12' });
        }
      }
    } catch (repairErr) {
      console.warn('Auto-repair check notice:', repairErr);
    }

    // Metrics
    const activeOrds = ordersList.filter(o => o.status === 'active');
    const currentMRR = activeOrds.reduce((sum, o) => sum + Number(o.amount_paid || 0), 0);

    // Enrich recent logs for Quick Revert panel
    const orderMap = {};
    ordersList.forEach(o => {
      orderMap[o.order_id] = {
        ...o,
        clientName: profileMap[o.client_id]?.name || 'Client'
      };
    });
    setRecentLogs(
      postsList.slice(0, 12).map(p => ({
        ...p,
        clientName: orderMap[p.order_id]?.clientName || 'Client'
      }))
    );

    // Build Detailed Retainers
    const detailed = activeOrds.map(order => {
      const isStarterOrd = (order.plan_name || '').toLowerCase().includes('starter');
      const normStatic = (order.static_posts_total && order.static_posts_total !== 10)
        ? order.static_posts_total
        : (isStarterOrd ? 12 : 15);
      const normReels = (order.reels_total && order.reels_total !== 3 && order.reels_total !== 4)
        ? order.reels_total
        : (isStarterOrd ? 8 : 12);

      const scheduleConfig = getClientSchedule(order);
      const effectiveStart = scheduleConfig?.firstUploadDate || order.first_upload_date || order.created_at;
      const orderPosts = postsList.filter(p => p.order_id === order.order_id);
      const staticDone = orderPosts.filter(p => p.post_type === 'static').length;
      const reelsDone = orderPosts.filter(p => p.post_type === 'reel').length;
      const storiesDone = orderPosts.filter(p => p.post_type === 'story').length;
      const postersDone = 0;
      const totalDone = staticDone + reelsDone + storiesDone;
      const storiesQuota = order.stories_total || scheduleConfig?.totalStories || 15;
      const totalQuota = normStatic + normReels + storiesQuota;

      const startD = new Date(effectiveStart);
      const now = new Date();
      const diffDays = Math.floor((now - startD) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, 30 - diffDays);

      return {
        ...order,
        static_posts_total: normStatic,
        reels_total: normReels,
        stories_total: storiesQuota,
        posters_total: 0,
        clientName: profileMap[order.client_id]?.name || 'Unknown',
        totalDone,
        totalQuota,
        staticDone,
        reelsDone,
        storiesDone,
        postersDone,
        daysLeft,
        daysActive: diffDays
      };
    });
    setDetailedRetainers(detailed);

    // Build calendar events from all active orders using exact date + type matching
    const events = [];
    let pendingToday = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    activeOrds.forEach(order => {
      const isStarterOrd = (order.plan_name || '').toLowerCase().includes('starter');
      const normStatic = (order.static_posts_total && order.static_posts_total !== 10)
        ? order.static_posts_total
        : (isStarterOrd ? 12 : 15);
      const normReels = (order.reels_total && order.reels_total !== 3 && order.reels_total !== 4)
        ? order.reels_total
        : (isStarterOrd ? 8 : 12);

      const clientName = profileMap[order.client_id]?.name || 'Unknown';
      const scheduleConfig = getClientSchedule(order);
      const effectiveStart = scheduleConfig?.firstUploadDate || order.first_upload_date || order.created_at;

      const orderPosts = postsList.filter(p => p.order_id === order.order_id);

      const schedule = generateUploadSchedule(
        effectiveStart,
        order.plan_name,
        normStatic,
        normReels,
        0,
        scheduleConfig
      );

      const matchedSchedule = matchPostsToScheduleSlots(schedule, orderPosts);

      matchedSchedule.forEach(slot => {
        const delivered = Boolean(slot.delivered);
        const slotDate = new Date(slot.date);
        slotDate.setHours(0, 0, 0, 0);

        if (!delivered && slotDate.getTime() === today.getTime() && ['static', 'reel', 'poster', 'story'].includes(slot.type)) {
          pendingToday++;
        }

        events.push({
          date: slot.date,
          type: slot.type,
          originalType: slot.originalType || slot.type,
          isSwapped: Boolean(slot.isSwapped),
          swappedFrom: slot.swappedFrom || null,
          isCustomDeliverable: Boolean(slot.isCustomDeliverable),
          time: slot.time,
          note: slot.note,
          clientName,
          clientId: order.client_id,
          orderId: order.order_id,
          delivered,
          postLogId: slot.postLogId || null,
          deliveredTitle: slot.deliveredTitle || null,
          deliveredType: slot.deliveredType || slot.type,
          matchedPost: slot.matchedPost || null,
          isOverdue: !delivered && slotDate < today && ['static', 'reel', 'poster', 'story'].includes(slot.type)
        });
      });

      // Plot Special Deliverables (e.g. Spin the Wheel Web App, Custom Landing Page, Extra Reels)
      const ordSpecial = specialList.length > 0
        ? specialList.filter(s => s.order_id === order.order_id)
        : getSpecialDeliverables(order);

      ordSpecial.forEach(sp => {
        const spDate = new Date(sp.delivered_at || sp.created_at);
        events.push({
          date: spDate,
          type: 'special',
          time: 'Special Deliverable',
          note: sp.title,
          clientName,
          brandName: order.business_name || order.schedule_config?.business_name || profileMap[order.client_id]?.business_type || 'Main Brand',
          clientId: order.client_id,
          orderId: order.order_id,
          delivered: sp.status === 'delivered',
          isSpecialDeliverable: true,
          specialDeliverable: sp,
          deliveredTitle: sp.title,
          isOverdue: false
        });
      });
    });

    // Calculate Pending Payments (pending plan orders, individual milestone EMIs, and pending special deliverables)
    let totalPendingAmount = 0;
    const pendingList = [];

    // 1. Plan Orders and Individual Milestone EMIs
    ordersList.forEach(order => {
      const clientName = profileMap[order.client_id]?.name || 'Unknown Client';
      const bName = order.business_name || order.schedule_config?.business_name || profileMap[order.client_id]?.business_type || 'Main Brand';
      const instMetrics = computeOrderInstallmentMetrics(order);

      if (order.status === 'pending') {
        totalPendingAmount += instMetrics.totalAgreed;
        pendingList.push({
          type: 'order',
          category: 'Plan Order Approval',
          itemType: 'New Order Approval Pending',
          orderId: order.order_id,
          clientName,
          brandName: bName,
          planName: order.plan_name,
          amountPending: instMetrics.totalAgreed,
          status: 'New Order Approval Pending',
          isNewOrder: true,
          instMetrics,
          created_at: order.created_at
        });
      } else if (instMetrics.hasInstallments && Array.isArray(instMetrics.installments) && instMetrics.installments.length > 0) {
        // Break out EACH individual unpaid installment / EMI
        instMetrics.installments.forEach(inst => {
          if (inst.status !== 'paid' && inst.status !== 'verified') {
            const instAmount = Number(inst.amount || 0);
            totalPendingAmount += instAmount;
            
            let instStatus = 'Installment Scheduled';
            if (inst.status === 'pending_verification') {
              instStatus = 'Proof Uploaded (Verification Due)';
            } else if (inst.isOverdue || (instMetrics.isOverdue && inst.installment_number === instMetrics.nextInstallment?.installment_number)) {
              instStatus = 'Overdue (Grace Expired)';
            } else if (inst.inGracePeriod || (instMetrics.inGracePeriod && inst.installment_number === instMetrics.nextInstallment?.installment_number)) {
              instStatus = `Grace Period (${instMetrics.graceDaysLeft}d left)`;
            }

            pendingList.push({
              type: 'emi',
              category: `Plan EMI #${inst.installment_number}`,
              itemType: `EMI #${inst.installment_number}`,
              orderId: order.order_id,
              clientName,
              brandName: bName,
              planName: order.plan_name,
              amountPending: instAmount,
              dueDate: inst.due_date,
              installmentNumber: inst.installment_number,
              status: instStatus,
              isNewOrder: false,
              instMetrics,
              created_at: order.created_at
            });
          }
        });
      } else if (instMetrics.balanceDue > 0) {
        totalPendingAmount += instMetrics.balanceDue;
        pendingList.push({
          type: 'emi',
          category: 'Plan Milestone EMI',
          itemType: 'Installment Milestone',
          orderId: order.order_id,
          clientName,
          brandName: bName,
          planName: order.plan_name,
          amountPending: instMetrics.balanceDue,
          status: instMetrics.isOverdue 
            ? 'Overdue (Grace Expired)' 
            : (instMetrics.inGracePeriod ? `Grace Period (${instMetrics.graceDaysLeft}d left)` : 'Installment Scheduled'),
          isNewOrder: false,
          instMetrics,
          created_at: order.created_at
        });
      }
    });

    // 2. Special Deliverables (Custom Websites, Extra Reels, Web Apps)
    // Combine unique special deliverables from table + order configs
    const allSpecialsMap = new Map();
    specialList.forEach(s => { if (s && s.id) allSpecialsMap.set(s.id, s); });
    ordersList.forEach(ord => {
      const ordSpecials = (ord.schedule_config?.special_deliverables && Array.isArray(ord.schedule_config.special_deliverables))
        ? ord.schedule_config.special_deliverables
        : [];
      ordSpecials.forEach(s => { if (s && s.id && !allSpecialsMap.has(s.id)) allSpecialsMap.set(s.id, s); });
    });

    Array.from(allSpecialsMap.values()).forEach(sd => {
      const isPaid = sd.payment_status === 'paid';
      const isComplimentary = sd.payment_status === 'complimentary' || Number(sd.price || 0) === 0;
      const fee = Number(sd.price || sd.fee || 0);

      if (!isPaid && !isComplimentary && fee > 0) {
        totalPendingAmount += fee;
        const matchingOrder = ordersList.find(o => o.order_id === sd.order_id || o.id === sd.order_id);
        const clientName = profileMap[matchingOrder?.client_id || sd.client_id]?.name || 'Client';
        const brandName = matchingOrder?.business_name || matchingOrder?.schedule_config?.business_name || profileMap[matchingOrder?.client_id || sd.client_id]?.business_type || 'Main Brand';

        pendingList.push({
          type: 'special',
          category: 'Special Deliverable',
          itemType: sd.category || sd.custom_type_name || 'Custom Project',
          title: sd.title,
          orderId: sd.order_id || matchingOrder?.order_id || 'SPECIAL',
          clientName,
          brandName,
          amountPending: fee,
          dueDate: sd.delivered_at || sd.scheduled_date || sd.created_at,
          status: sd.payment_status === 'pending_verification' ? 'Proof Uploaded (Verification Due)' : 'Special Deliverable Due',
          isNewOrder: false,
          specialId: sd.id,
          projectUrl: sd.project_url,
          created_at: sd.created_at
        });
      }
    });

    setPendingPaymentsList(pendingList);
    setCalendarEvents(events);
    setActiveOrders(activeOrds.map(o => ({ ...o, clientName: profileMap[o.client_id]?.name || 'Unknown' })));
    setMetrics({
      mrr: currentMRR,
      activeRetainers: activeOrds.length,
      pendingAmount: totalPendingAmount,
      pendingOrdersCount: pendingList.length,
      pendingToday
    });
    setLoading(false);
  };

  const handleQuickLog = async (e) => {
    e.preventDefault();
    if (!logOrderId || !logTitle) return;
    setIsLogging(true);
    setQuickLogSuccess(null);

    const { error } = await supabase.from('posts_log').insert([{
      order_id: logOrderId,
      post_type: logType,
      title: logTitle
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      // Find the corresponding order and client
      let targetOrder = activeOrders.find(o => o.order_id === logOrderId);
      let targetUserId = targetOrder?.client_id;
      let clientDisplayName = targetOrder?.clientName || 'Client';

      if (!targetUserId) {
        const { data: ordData } = await supabase
          .from('orders')
          .select('client_id')
          .eq('order_id', logOrderId)
          .single();
        if (ordData) targetUserId = ordData.client_id;
      }

      const formattedType = logType.toUpperCase();
      const deliverableTitle = logTitle.trim();

      // Dispatch push notification to client with submitted content title
      try {
        await dispatchPushNotification({
          targetUserId,
          targetClientName: clientDisplayName,
          title: deliverableTitle,
          body: `🚀 New ${formattedType} deliverable is now live on your Outliers Media dashboard.`,
          url: '/dashboard',
          isGlobal: false,
          postType: logType
        });

        // Also trigger immediate local notification so submitter sees the notification pop up
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          await triggerLocalNotification(deliverableTitle, {
            body: `🚀 New ${formattedType} uploaded for ${clientDisplayName}!`,
            url: '/dashboard'
          });
        }
      } catch (pushErr) {
        console.warn("Could not dispatch deliverable push notification:", pushErr);
      }

      // Broadcast real-time update to client's live dashboard
      try {
        await broadcastDeliverablesSync({
          action: 'submit',
          orderId: logOrderId,
          postType: logType,
          title: deliverableTitle
        });
      } catch (e) {
        console.warn("Realtime broadcast error:", e);
      }

      setQuickLogSuccess(`✓ Logged "${deliverableTitle}" & sent push notification to ${clientDisplayName}!`);
      setTimeout(() => setQuickLogSuccess(null), 5000);

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
    { id: 'pending_payments', label: 'Pending Payments', value: `₹${metrics.pendingAmount.toLocaleString()}`, subtitle: `${metrics.pendingOrdersCount} Awaiting`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'due', label: 'Due Today', value: metrics.pendingToday, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  ];

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 sm:gap-8">
      {/* Metrics Row: 2x2 grid on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {metricCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelectedMetric(card.id)}
            className="bg-[#111] border border-[#222] p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between gap-2.5 sm:gap-4 relative overflow-hidden group hover:border-[#444] cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between items-start gap-2 relative z-10">
              <span className="text-[#888] text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest leading-tight">{card.label}</span>
              <div className={`${card.bg} ${card.color} p-1.5 sm:p-2 rounded-lg shrink-0`}>
                <card.icon size={16} />
              </div>
            </div>
            <div className="flex justify-between items-end relative z-10">
              <div className="text-xl sm:text-3xl font-serif text-white truncate">
                {loading ? <span className="animate-pulse bg-[#222] h-7 sm:h-8 w-20 sm:w-24 rounded block"></span> : card.value}
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#555] group-hover:text-white font-bold uppercase tracking-wider flex items-center gap-0.5 sm:gap-1 transition-colors shrink-0">
                View <ArrowRight size={10} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">

        {/* Master Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-[#111] border border-[#222] rounded-2xl p-3.5 sm:p-6 md:p-8 flex flex-col"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-serif text-white">Agency Master Calendar</h2>
              <p className="text-[11px] text-[#666] mt-0.5">Track, edit, swap formats, or add custom deliverables directly.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#888]">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3428f8]"></div> Static</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Reel</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Stories</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Special</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddCustomDeliverable()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3428f8] hover:bg-[#2d23c9] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                title="Add custom deliverable for any client on this calendar"
              >
                <Plus size={14} /> Add Deliverable
              </button>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 bg-[#0b0b0b] border border-[#1d1d1d] rounded-xl p-1.5 sm:p-2">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 sm:p-2 rounded-lg hover:bg-[#222] transition-colors text-[#888] hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-white text-xs sm:text-sm font-bold uppercase tracking-widest">{monthName}</h3>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 sm:p-2 rounded-lg hover:bg-[#222] transition-colors text-[#888] hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-[#555] py-1.5 sm:py-2">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="min-h-[68px] sm:min-h-[85px]"></div>;

              const dayEvents = getEventsForDay(day);
              const isToday = todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === day;
              const cellDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

              return (
                <div
                  key={day}
                  onClick={() => handleOpenAddCustomDeliverable(cellDateKey)}
                  className={`min-h-[68px] sm:min-h-[85px] p-1 sm:p-1.5 rounded-lg border transition-colors group relative cursor-pointer ${isToday ? 'border-[#3428f8] bg-[#3428f8]/5' : 'border-[#1a1a1a] hover:border-[#333]'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] font-bold ${isToday ? 'text-[#3428f8]' : 'text-[#666]'}`}>{day}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddCustomDeliverable(cellDateKey);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 hover:text-white font-bold px-1 rounded hover:bg-[#222] transition-opacity"
                      title="Add deliverable on this date"
                    >
                      +
                    </button>
                  </div>
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
                          title={`${ev.clientName} — ${cfg.label} @ ${ev.time || 'N/A'}${ev.isSwapped ? `\n⚡ SWAPPED: ${ev.type.toUpperCase()} (was ${ev.swappedFrom || 'Post'})` : ''}${ev.note ? `\n🎯 ${ev.note}` : ''}${ev.delivered ? '\n✓ DELIVERED' : ev.isOverdue ? '\n⚠ OVERDUE' : ''}\n(Click to view, edit or swap)`}
                          className={`text-[8px] px-1 py-0.5 rounded truncate font-bold uppercase tracking-tight sm:tracking-wider cursor-pointer hover:opacity-80 active:scale-95 transition-all flex items-center gap-0.5 ${
                            ev.delivered
                              ? 'bg-[#222] text-[#555] line-through'
                              : ev.isOverdue
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : `${cfg.bg}/20 ${cfg.color} hover:ring-1 hover:ring-[#3428f8]/40`
                          }`}
                        >
                          {ev.isSwapped && <span className="text-amber-400 font-bold">⚡</span>}
                          <span className="hidden sm:inline">{ev.clientName.split(' ')[0]}: </span>
                          <span>{cfg.shortLabel || cfg.label}</span>
                          <span className="hidden md:inline">{timeSnippet}</span>
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
          className="lg:col-span-1 bg-[#111] border border-[#222] rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col"
        >
          <h2 className="text-lg sm:text-xl font-serif text-white mb-4 sm:mb-6">Quick Post Logger</h2>

          {quickLogSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-semibold flex items-center gap-2"
            >
              <CheckCircle size={16} className="shrink-0" />
              <span>{quickLogSuccess}</span>
            </motion.div>
          )}

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
                <option value="story">Story</option>
                <option value="poster">Poster</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#888]">Title / Description</label>
              <input
                type="text"
                value={logTitle}
                onChange={(e) => setLogTitle(e.target.value)}
                required
                className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-sm focus:border-[#3428f8] focus:outline-none transition-all rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={isLogging || !logOrderId || !logTitle}
              className="mt-4 w-full bg-[#3428f8] disabled:bg-[#3428f8]/50 text-white p-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-xl flex items-center justify-center gap-2"
            >
              {isLogging ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                <><Plus size={16} /> Log & Push to Client</>
              )}
            </button>
          </form>

          {/* Recent Submissions with Instant Revert */}
          {recentLogs.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#1e1e1e] flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                  Recent Submissions
                </span>
                <span className="text-[9px] text-[#555] font-mono">Click Revert to Undo</span>
              </div>
              <div className="flex flex-col gap-2 max-h-[210px] overflow-y-auto pr-1 custom-scrollbar">
                {recentLogs.map((logItem) => {
                  const cfg = TYPE_CONFIG[logItem.post_type] || TYPE_CONFIG.static;
                  return (
                    <div
                      key={logItem.id}
                      className="bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#333] rounded-xl p-2.5 flex justify-between items-center gap-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${cfg.bg}/20 ${cfg.color}`}>
                            {cfg.shortLabel || cfg.label}
                          </span>
                          <span className="text-[10px] text-white font-bold truncate">
                            {logItem.clientName}
                          </span>
                          <span className="text-[9px] text-[#555] font-mono shrink-0">
                            {logItem.published_at ? new Date(logItem.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#aaa] truncate">{logItem.title}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isRevertingWork}
                        onClick={() => handleRevertDeliverable(logItem.id, { orderId: logItem.order_id, title: logItem.title })}
                        className="shrink-0 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Revert this submission and update client live"
                      >
                        <RotateCcw size={10} /> Revert
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                    'bg-yellow-400/10 text-yellow-400'
                  }`}>
                    {selectedMetric === 'mrr' && <TrendingUp size={22} />}
                    {selectedMetric === 'retainers' && <Users size={22} />}
                    {selectedMetric === 'due' && <AlertTriangle size={22} />}
                  </div>
                  <div>
                    <h3 className="text-white text-lg font-serif">
                      {selectedMetric === 'mrr' && 'Monthly Recurring Revenue'}
                      {selectedMetric === 'retainers' && 'Active Client Retainers'}
                      {selectedMetric === 'due' && "Today's Deliverables"}
                    </h3>
                    <p className="text-[#666] text-xs">
                      {selectedMetric === 'mrr' && 'Live subscription retainers breakdown'}
                      {selectedMetric === 'retainers' && 'Contract pacing & deliverable completion'}
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
                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-md font-bold">
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
                      <span className="text-xs bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20 px-2.5 py-1 rounded-md font-bold">
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

                {/* 3. PENDING PAYMENTS MODAL */}
                {selectedMetric === 'pending_payments' && (() => {
                  const filteredPending = pendingPaymentsList.filter(item => {
                    if (pendingFilter === 'emi') return item.type === 'emi';
                    if (pendingFilter === 'special') return item.type === 'special';
                    if (pendingFilter === 'order') return item.type === 'order';
                    return true;
                  });

                  const emiCount = pendingPaymentsList.filter(i => i.type === 'emi').length;
                  const specialCount = pendingPaymentsList.filter(i => i.type === 'special').length;
                  const orderCount = pendingPaymentsList.filter(i => i.type === 'order').length;

                  return (
                    <>
                      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-1">
                        <div>
                          <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block">Total Outstanding Balance</span>
                          <span className="text-2xl font-serif text-amber-400">₹{metrics.pendingAmount.toLocaleString()}</span>
                          <span className="text-[11px] text-[#888] block mt-0.5 font-mono">
                            {pendingPaymentsList.length} total pending items ({emiCount} Plan EMIs, {specialCount} Special Dues)
                          </span>
                        </div>
                        <button 
                          onClick={() => navigate('/admin/finances?filter=Pending')}
                          className="text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/30 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          Open in Finances <ArrowRight size={12} />
                        </button>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-b border-[#1f1f1f]">
                        <button
                          type="button"
                          onClick={() => setPendingFilter('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            pendingFilter === 'all'
                              ? 'bg-[#3428f8] text-white'
                              : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                          }`}
                        >
                          All ({pendingPaymentsList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingFilter('emi')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            pendingFilter === 'emi'
                              ? 'bg-[#3428f8] text-white'
                              : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                          }`}
                        >
                          Plan EMIs ({emiCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingFilter('special')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            pendingFilter === 'special'
                              ? 'bg-[#3428f8] text-white'
                              : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                          }`}
                        >
                          Special Deliverables ({specialCount})
                        </button>
                        {orderCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPendingFilter('order')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                              pendingFilter === 'order'
                                ? 'bg-amber-500 text-black'
                                : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                            }`}
                          >
                            New Orders ({orderCount})
                          </button>
                        )}
                      </div>

                      {filteredPending.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle size={32} className="text-green-500 mx-auto mb-2 opacity-60" />
                          <p className="text-white text-sm font-medium">No pending payments under this filter!</p>
                          <p className="text-[#666] text-xs">All selected plan EMIs or special projects are up to date.</p>
                        </div>
                      ) : (
                        filteredPending.map((item, i) => (
                          <div key={i} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3.5 flex flex-col gap-2 hover:border-[#333] transition-colors">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  {item.type === 'special' ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#3428f8]/20 text-blue-300 border border-[#3428f8]/30 flex items-center gap-1">
                                      <Star size={10} /> {item.category}
                                    </span>
                                  ) : item.type === 'emi' ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#3428f8]/20 text-[#8b82ff] border border-[#3428f8]/30 flex items-center gap-1">
                                      <CreditCard size={10} /> {item.category}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {item.category}
                                    </span>
                                  )}
                                  <span className="text-white text-xs font-bold truncate">{item.clientName}</span>
                                  {item.brandName && (
                                    <span className="text-[#666] text-[10px]">({item.brandName})</span>
                                  )}
                                </div>

                                <div className="text-xs text-[#aaa]">
                                  {item.type === 'special' ? (
                                    <span className="font-bold text-white">{item.title}</span>
                                  ) : (
                                    <span>{item.planName} • <span className="font-mono text-[#666]">{item.orderId}</span></span>
                                  )}
                                  {item.dueDate && (
                                    <span className="text-[#666] text-[10px] block mt-0.5">
                                      Due: {new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-amber-400 font-mono font-bold text-base block">₹{item.amountPending.toLocaleString()}</span>
                                <span className="text-[10px] text-[#666] uppercase tracking-wider font-bold">Pending Due</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-[#1a1a1a]">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                                item.status.includes('Overdue') 
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
                                  : item.status.includes('Grace')
                                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                  : item.status.includes('Proof')
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : item.type === 'special'
                                  ? 'bg-[#3428f8]/15 text-blue-300 border border-[#3428f8]/30'
                                  : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                              }`}>
                                {item.status}
                              </span>

                              {item.type === 'special' ? (
                                <button
                                  onClick={() => {
                                    setSelectedMetric(null);
                                    navigate('/admin/deliverables');
                                  }}
                                  className="text-[10px] text-blue-400 hover:text-white font-bold uppercase flex items-center gap-1 cursor-pointer"
                                >
                                  Deliverables Tab <ArrowRight size={10} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedMetric(null);
                                    navigate('/admin/finances?filter=Pending');
                                  }}
                                  className="text-[10px] text-[#3428f8] hover:text-white font-bold uppercase flex items-center gap-1 cursor-pointer"
                                >
                                  Manage in Finances <ArrowRight size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  );
                })()}

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
                        <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-md font-bold">
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

                              <div className="flex items-center gap-2">
                                {ev.delivered ? (
                                  <>
                                    <span className="text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                      <Check size={14} /> Done
                                    </span>
                                    {ev.postLogId && (
                                      <button
                                        type="button"
                                        disabled={isRevertingWork}
                                        onClick={() => handleRevertDeliverable(ev.postLogId, { orderId: ev.orderId, title: ev.deliveredTitle })}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                                      >
                                        <RotateCcw size={11} /> Revert
                                      </button>
                                    )}
                                  </>
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
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
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
                    className="bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
                  >
                    Manage All Clients <ArrowRight size={14} />
                  </button>
                )}
                {selectedMetric === 'due' && (
                  <button
                    onClick={() => {
                      setSelectedMetric(null);
                      navigate('/admin/deliverables');
                    }}
                    className="bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
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
              {selectedEvent.isSpecialDeliverable ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3.5 bg-[#3428f8]/10 border border-[#3428f8]/25 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#888] font-bold uppercase tracking-wider">Project Type</span>
                      <span className="text-blue-300 font-bold">{selectedEvent.specialDeliverable?.category || 'Special Project'}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#888] font-bold uppercase tracking-wider">Pricing / Fee</span>
                      <span className="text-white font-mono font-bold">
                        {Number(selectedEvent.specialDeliverable?.price || 0) === 0 ? 'Complimentary (₹0)' : `₹${Number(selectedEvent.specialDeliverable?.price).toLocaleString()}`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#888] font-bold uppercase tracking-wider">Payment Status</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedEvent.specialDeliverable?.payment_status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : selectedEvent.specialDeliverable?.payment_status === 'complimentary'
                          ? 'bg-[#3428f8]/20 text-blue-300 border border-[#3428f8]/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {selectedEvent.specialDeliverable?.payment_status === 'paid' ? 'Paid ✓' : selectedEvent.specialDeliverable?.payment_status === 'complimentary' ? 'Included' : 'Payment Due ⚠️'}
                      </span>
                    </div>

                    {selectedEvent.specialDeliverable?.project_url && (
                      <div className="pt-2 border-t border-[#3428f8]/20">
                        <a
                          href={selectedEvent.specialDeliverable.project_url.startsWith('http') ? selectedEvent.specialDeliverable.project_url : `https://${selectedEvent.specialDeliverable.project_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          <Globe size={13} />
                          <span>Open Live Project Link</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEvent(null);
                        navigate('/admin/deliverables');
                      }}
                      className="w-full bg-[#3428f8] hover:bg-[#2d23c9] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Deliverables Tab <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ) : !selectedEvent.delivered ? (
                <form onSubmit={handleMarkDelivered} className="flex flex-col gap-4">
                  {/* Format Selector for Fulfilling this Slot */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Deliverable Format
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#090909] rounded-xl border border-[#222]">
                      {[
                        { id: 'static', label: 'Static Post' },
                        { id: 'reel', label: 'Reel' },
                        { id: 'story', label: 'Story' },
                        { id: 'poster', label: 'Poster' }
                      ].map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setEventPostType(fmt.id)}
                          className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            eventPostType === fmt.id
                              ? 'bg-[#3428f8] text-white shadow-sm'
                              : 'text-[#777] hover:text-white'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                    {eventPostType !== selectedEvent.type && (
                      <div className="mt-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-[11px] text-blue-300 flex items-center gap-1.5">
                        <span>⚡ Format Swapped: Will fulfill this slot as <strong>{TYPE_CONFIG[eventPostType]?.label}</strong> instead of scheduled {TYPE_CONFIG[selectedEvent.type]?.label}.</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Deliverable Title / Caption *
                    </label>
                    <input 
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      required
                      className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Swap / Client Note (Optional)
                    </label>
                    <input 
                      type="text"
                      value={eventSwapNote}
                      onChange={(e) => setEventSwapNote(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#222] p-2.5 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>

                  {/* Two Buttons: Close and Submit */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingWork || !eventTitle}
                      className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingWork ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                      ) : (
                        <><Check size={14} /> Submit Work</>
                      )}
                    </button>
                  </div>
                </form>
              ) : isEditingDelivered ? (
                <form onSubmit={handleSaveEditDelivered} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <Edit3 size={13} /> Edit Deliverable & Swap Format
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingDelivered(false)}
                      className="text-xs text-[#777] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Select Format (Swap Post ↔ Reel ↔ Story)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#090909] rounded-xl border border-[#222]">
                      {[
                        { id: 'static', label: 'Static Post' },
                        { id: 'reel', label: 'Reel' },
                        { id: 'story', label: 'Story' },
                        { id: 'poster', label: 'Poster' }
                      ].map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setEditDeliveredType(fmt.id)}
                          className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            editDeliveredType === fmt.id
                              ? 'bg-[#3428f8] text-white shadow-sm'
                              : 'text-[#777] hover:text-white'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Deliverable Title *
                    </label>
                    <input 
                      type="text"
                      value={editDeliveredTitle}
                      onChange={(e) => setEditDeliveredTitle(e.target.value)}
                      required
                      className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Swap / Client Reason (e.g. Delivered Reel instead of Post)
                    </label>
                    <input 
                      type="text"
                      value={editDeliveredSwapNote}
                      onChange={(e) => setEditDeliveredSwapNote(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#222] p-2.5 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingDelivered(false)}
                      className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEditDelivered || !editDeliveredTitle.trim()}
                      className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSavingEditDelivered ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                      ) : (
                        <><Check size={14} /> Save Changes</>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 p-3.5 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400 shrink-0" />
                        <span className="text-green-400 text-xs font-bold">Deliverable Submitted & Live</span>
                      </div>
                      {selectedEvent.isSwapped && (
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                          ⚡ Swapped: {selectedEvent.type.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {selectedEvent.deliveredTitle && (
                      <p className="text-white text-xs font-medium pl-6">
                        "{selectedEvent.deliveredTitle}"
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingDelivered(true)}
                      className="w-full bg-[#3428f8] hover:bg-[#2d23c9] text-white p-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Edit deliverable format or swap type"
                    >
                      <Edit3 size={12} /> Edit / Swap
                    </button>
                    <button
                      type="button"
                      disabled={isRevertingWork || !selectedEvent.postLogId}
                      onClick={() => handleRevertDeliverable(selectedEvent.postLogId, {
                        orderId: selectedEvent.orderId,
                        title: selectedEvent.deliveredTitle
                      })}
                      className="w-full bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50 text-red-400 border border-red-500/30 p-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isRevertingWork ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-400"></span>
                      ) : (
                        <><RotateCcw size={12} /> Revert</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Deliverable Adder Modal */}
      <AnimatePresence>
        {isAddCustomModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsAddCustomModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#222] mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block">Custom Deliverable Adder</span>
                  <h3 className="text-white text-base font-bold mt-0.5">Add Deliverable Directly to Calendar</h3>
                </div>
                <button
                  onClick={() => setIsAddCustomModalOpen(false)}
                  className="text-[#666] hover:text-white p-1 rounded-lg hover:bg-[#222] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomDeliverable} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Target Date *
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      required
                      className="w-full bg-[#0a0a0a] border border-[#222] p-2.5 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                      Client / Order *
                    </label>
                    <select
                      value={customOrderId}
                      onChange={(e) => setCustomOrderId(e.target.value)}
                      required
                      className="w-full bg-[#0a0a0a] border border-[#222] p-2.5 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none"
                    >
                      <option value="">Select a client...</option>
                      {activeOrders.map(ord => (
                        <option key={ord.order_id} value={ord.order_id}>
                          {ord.clientName} ({ord.business_name || ord.plan_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                    Deliverable Format *
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#090909] rounded-xl border border-[#222]">
                    {[
                      { id: 'reel', label: 'Reel / Short' },
                      { id: 'static', label: 'Static Post' },
                      { id: 'story', label: 'Story' },
                      { id: 'poster', label: 'Poster' }
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setCustomType(fmt.id)}
                        className={`py-2 px-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          customType === fmt.id
                            ? 'bg-[#3428f8] text-white shadow-sm'
                            : 'text-[#777] hover:text-white'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                    Deliverable Title / Description *
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-1.5">
                    Swap / Special Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={customSwapNote}
                    onChange={(e) => setCustomSwapNote(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] p-2.5 text-white text-xs rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomModalOpen(false)}
                    className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCustom || !customOrderId || !customTitle.trim()}
                    className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingCustom ? (
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                    ) : (
                      <><Plus size={14} /> Add Deliverable</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
