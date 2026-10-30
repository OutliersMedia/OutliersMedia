import { Image as ImageIcon, Video, Layout, Flame, BookOpen, Globe, Star } from 'lucide-react';
import { supabase } from './supabaseClient';

/**
 * OUTLIERS MEDIA — 7-DAY REPEATING & CUSTOM INTERVAL SCHEDULE ENGINE
 */

export const TYPE_CONFIG = {
  static:  { label: 'Static Post', shortLabel: 'Post',   icon: ImageIcon, color: 'text-[#3428f8]', bg: 'bg-[#3428f8]', dot: 'bg-[#3428f8]' },
  reel:    { label: 'Reel',        shortLabel: 'Reel',   icon: Video,     color: 'text-pink-500',   bg: 'bg-pink-500',   dot: 'bg-pink-500' },
  poster:  { label: 'Poster',      shortLabel: 'Poster', icon: Layout,    color: 'text-green-500',  bg: 'bg-green-500',  dot: 'bg-green-500' },
  story:   { label: 'Story',       shortLabel: 'Story',  icon: Flame,     color: 'text-amber-400',  bg: 'bg-amber-400',  dot: 'bg-amber-400' },
  special: { label: 'Special Project', shortLabel: 'Special', icon: Star, color: 'text-blue-400',  bg: 'bg-[#3428f8]',  dot: 'bg-blue-400' },
  website: { label: 'Website / App', shortLabel: 'Web',  icon: Globe,     color: 'text-cyan-400',   bg: 'bg-cyan-500',   dot: 'bg-cyan-400' },
};

/**
 * Retrieves custom schedule configuration for an order (with localStorage fallback)
 */
export function getClientSchedule(order) {
  if (!order) return null;
  
  // 1. Check if order object has schedule_config attached from database
  if (order.schedule_config && typeof order.schedule_config === 'object') {
    return order.schedule_config;
  }
  if (typeof order.schedule_config === 'string') {
    try {
      return JSON.parse(order.schedule_config);
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // 2. Check localStorage fallback keyed by order_id
  if (typeof window !== 'undefined' && order.order_id) {
    try {
      const cached = localStorage.getItem(`om_schedule_${order.order_id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }

  return null;
}

/**
 * Saves custom schedule configuration for an order to Supabase + localStorage
 */
export async function saveClientSchedule(orderId, config) {
  if (!orderId || !config) return { error: new Error("Missing orderId or config") };

  // 1. Cache to localStorage for instant local reactivity
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`om_schedule_${orderId}`, JSON.stringify(config));
    } catch (e) {
      console.warn("Local storage cache error:", e);
    }
  }

  // 2. Attempt to update in Supabase orders table
  try {
    const updatePayload = {
      schedule_config: config,
      static_posts_total: config.totalStatic ?? config.static_posts_total,
      reels_total: config.totalReels ?? config.reels_total,
    };

    if (config.firstUploadDate) {
      updatePayload.first_upload_date = config.firstUploadDate;
    }
    if (config.totalStories !== undefined) {
      updatePayload.stories_total = config.totalStories;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('order_id', orderId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Supabase schedule update notice (using cached config):", error.message);
      return { data: config, error: null };
    }

    return { data, error: null };
  } catch (err) {
    console.warn("Database sync notice:", err);
    return { data: config, error: null };
  }
}

/**
 * Generates an interval-based schedule customized by the admin
 */
export function generateCustomSchedule({
  startDate,
  staticPerWeek = 3,
  staticInterval = 2,
  reelsPerWeek = 1,
  reelsInterval = 7,
  storiesPerWeek = 3,
  storiesInterval = 2,
  postersTotal = 0,
  weeksCount = 4
}) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const schedule = [];

  const timePresets = {
    static: ['7:00 PM', '12:30 PM', '6:30 PM', '11:00 AM', '8:00 PM'],
    reel:   ['7:30 PM', '1:00 PM', '8:30 PM', '6:00 PM'],
    story:  ['12:00 PM', '6:00 PM', '10:00 AM', '8:00 PM'],
  };

  const scheduleFormat = (type, perWeek, intervalDays, formatTimes) => {
    const countPerWk = Math.max(0, parseInt(perWeek) || 0);
    const interval = Math.max(1, parseInt(intervalDays) || 1);
    if (countPerWk === 0) return;

    for (let week = 0; week < weeksCount; week++) {
      const weekStartOffset = week * 7;
      
      for (let itemIdx = 0; itemIdx < countPerWk; itemIdx++) {
        // Calculate day offset from start of week based on interval
        const dayInWeek = Math.min(6, itemIdx * interval);
        const dayOffset = weekStartOffset + dayInWeek;

        const date = new Date(start);
        date.setDate(date.getDate() + dayOffset);

        const time = formatTimes[itemIdx % formatTimes.length];

        schedule.push({
          type,
          time,
          note: `${TYPE_CONFIG[type]?.label || type} #${itemIdx + 1} of Week ${week + 1}`,
          date,
          dayNumber: dayOffset + 1,
          cycleWeek: week + 1
        });
      }
    }
  };

  scheduleFormat('static', staticPerWeek, staticInterval, timePresets.static);
  scheduleFormat('reel', reelsPerWeek, reelsInterval, timePresets.reel);
  scheduleFormat('story', storiesPerWeek, storiesInterval, timePresets.story);

  // If poster is included in the plan
  if (postersTotal > 0) {
    const posterDate = new Date(start);
    posterDate.setDate(posterDate.getDate() + 9);
    schedule.push({
      type: 'poster',
      time: '2:00 PM',
      note: 'Print-ready in-store poster design',
      date: posterDate,
      dayNumber: 10,
      cycleWeek: 2
    });
  }

  // Sort chronologically
  schedule.sort((a, b) => a.date - b.date);
  return schedule;
}

/**
 * Master schedule generation function with custom schedule support
 */
export function generateUploadSchedule(
  startDate,
  planName = 'Starter Plan',
  staticTotal = 12,
  reelsTotal = 8,
  postersTotal = 0,
  customConfig = null
) {
  // If custom schedule configuration is provided, use custom interval engine
  if (customConfig && (customConfig.staticPerWeek !== undefined || customConfig.firstUploadDate)) {
    const effectiveStartDate = customConfig.firstUploadDate || startDate;
    return generateCustomSchedule({
      startDate: effectiveStartDate,
      staticPerWeek: customConfig.staticPerWeek ?? 3,
      staticInterval: customConfig.staticInterval ?? 2,
      reelsPerWeek: customConfig.reelsPerWeek ?? 2,
      reelsInterval: customConfig.reelsInterval ?? 3,
      storiesPerWeek: customConfig.storiesPerWeek ?? 4,
      storiesInterval: customConfig.storiesInterval ?? 2,
      postersTotal: 0,
      weeksCount: customConfig.weeksCount ?? 4
    });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const normalizedPlan = (planName || '').toLowerCase();
  const isStarter = normalizedPlan.includes('starter') || normalizedPlan.includes('basic');
  const isPremium = normalizedPlan.includes('premium');
  const schedule = [];

  if (isStarter) {
    // STARTER 7-Day Cycle (12 posts/mo, 8 reels/mo, 15 stories/mo)
    const starterCycle = [
      { dayOffset: 0, type: 'static', time: '7:00 PM', note: 'High engagement window' },
      { dayOffset: 1, type: 'story',  time: '12:00 PM', note: 'Interactive story boost' },
      { dayOffset: 2, type: 'reel',   time: '7:00 PM', note: 'Peak video discovery' },
      { dayOffset: 3, type: 'static', time: '12:30 PM', note: 'Lunch break browsing' },
      { dayOffset: 3, type: 'story',  time: '6:00 PM',  note: 'Evening rush story' },
      { dayOffset: 4, type: 'story',  time: '1:00 PM',  note: 'Mid-week story engagement' },
      { dayOffset: 5, type: 'reel',   time: '7:00 PM', note: 'Weekend discovery reel' },
      { dayOffset: 6, type: 'static', time: '11:00 AM', note: 'Weekend leisure time' },
      { dayOffset: 6, type: 'story',  time: '5:00 PM',  note: 'Weekend story highlight' },
    ];

    let staticCount = 0;
    let reelsCount = 0;
    let storiesCount = 0;
    const maxStatic = (staticTotal && staticTotal !== 10) ? staticTotal : 12;
    const maxReels = (reelsTotal && reelsTotal !== 3) ? reelsTotal : 8;
    const maxStories = 15;

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const item of starterCycle) {
        if (item.type === 'static' && staticCount >= maxStatic) continue;
        if (item.type === 'reel' && reelsCount >= maxReels) continue;
        if (item.type === 'story' && storiesCount >= maxStories) continue;

        const dayNum = cycle * 7 + item.dayOffset;
        if (dayNum >= 30) continue;

        const date = new Date(start);
        date.setDate(date.getDate() + dayNum);

        if (item.type === 'static') staticCount++;
        if (item.type === 'reel') reelsCount++;
        if (item.type === 'story') storiesCount++;

        schedule.push({
          type: item.type,
          time: item.time,
          note: item.note,
          date,
          dayNumber: dayNum + 1,
          cycleWeek: cycle + 1
        });
      }
    }
  } else {
    // GROWTH & PREMIUM 7-Day Cycle (15 posts/mo, 12 reels/mo, 15 stories/mo, 0 posters)
    const growthCycle = [
      { dayOffset: 0, type: 'static', time: '7:00 PM', note: 'High engagement window' },
      { dayOffset: 0, type: 'reel',   time: '12:30 PM', note: 'Week kickoff reel' },
      { dayOffset: 1, type: 'story',  time: '12:00 PM', note: 'Interactive story boost' },
      { dayOffset: 2, type: 'static', time: '7:00 PM', note: 'Evening feed push' },
      { dayOffset: 2, type: 'reel',   time: '1:00 PM',  note: 'Peak video discovery' },
      { dayOffset: 3, type: 'story',  time: '6:00 PM',  note: 'Evening rush story' },
      { dayOffset: 4, type: 'static', time: '12:30 PM', note: 'Lunch break browsing' },
      { dayOffset: 4, type: 'reel',   time: '7:00 PM',  note: 'Weekend preview reel' },
      { dayOffset: 5, type: 'story',  time: '11:00 AM', note: 'Weekend browsing story' },
      { dayOffset: 6, type: 'static', time: '11:00 AM', note: 'Weekend leisure time' },
      { dayOffset: 6, type: 'story',  time: '5:00 PM',  note: 'Sunday evening story' },
    ];

    let staticCount = 0;
    let reelsCount = 0;
    let storiesCount = 0;
    const maxStatic = staticTotal || 15;
    const maxReels = (reelsTotal && reelsTotal !== 4) ? reelsTotal : 12;
    const maxStories = 15;

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const item of growthCycle) {
        if (item.type === 'static' && staticCount >= maxStatic) continue;
        if (item.type === 'reel' && reelsCount >= maxReels) continue;
        if (item.type === 'story' && storiesCount >= maxStories) continue;

        const dayNum = cycle * 7 + item.dayOffset;
        if (dayNum >= 30) continue;

        const date = new Date(start);
        date.setDate(date.getDate() + dayNum);

        if (item.type === 'static') staticCount++;
        if (item.type === 'reel') reelsCount++;
        if (item.type === 'story') storiesCount++;

        schedule.push({
          type: item.type,
          time: item.time,
          note: item.note,
          date,
          dayNumber: dayNum + 1,
          cycleWeek: cycle + 1
        });
      }
    }

    // Premium Weekly Add-ons
    if (isPremium) {
      const pMilestones = [
        { day: 3, note: 'Week 1: Blog post + Website SEO update' },
        { day: 10, note: 'Week 2: Custom 5-page website design & local SEO milestone' },
        { day: 17, note: 'Week 3: In-store event announcement & promo' },
        { day: 24, note: 'Week 4: Monthly analytics video report' },
      ];
      pMilestones.forEach(m => {
        const mDate = new Date(start);
        mDate.setDate(mDate.getDate() + m.day);
        schedule.push({
          type: 'special',
          time: '4:00 PM',
          note: m.note,
          date: mDate,
          dayNumber: m.day + 1,
          cycleWeek: Math.ceil((m.day + 1) / 7)
        });
      });
    }
  }

  // Sort chronologically
  schedule.sort((a, b) => a.date - b.date);
  return schedule;
}

// Format a Date or ISO timestamp into local YYYY-MM-DD
export function toLocalDateKey(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Matches logged posts (from posts_log) to generated schedule slots.
 * Pass 1: Exact calendar date (YYYY-MM-DD) + deliverable type match.
 * Pass 2: Chronological fallback for legacy logs that didn't store the target slot date.
 */
export function matchPostsToScheduleSlots(schedule, orderPosts = []) {
  if (!Array.isArray(schedule)) return [];
  const sortedPosts = [...(orderPosts || [])].sort(
    (a, b) => new Date(a.published_at || a.created_at || 0) - new Date(b.published_at || b.created_at || 0)
  );

  const usedPostIds = new Set();
  const slotsWithMeta = schedule.map((slot, index) => ({
    ...slot,
    _slotIndex: index,
    _dateKey: toLocalDateKey(slot.date),
    originalType: slot.type,
    delivered: false,
    matchedPost: null,
    postLogId: null,
    deliveredTitle: null,
    deliveredType: slot.type,
    isSwapped: false
  }));

  // Pass 1: Exact Date + Type Match
  for (const slot of slotsWithMeta) {
    const exactPost = sortedPosts.find(
      p =>
        !usedPostIds.has(p.id) &&
        (p.post_type || 'static') === slot.type &&
        toLocalDateKey(p.published_at) === slot._dateKey
    );
    if (exactPost) {
      usedPostIds.add(exactPost.id);
      slot.delivered = true;
      slot.matchedPost = exactPost;
      slot.postLogId = exactPost.id;
      slot.deliveredTitle = exactPost.title;
      slot.deliveredType = exactPost.post_type || slot.type;
    }
  }

  // Pass 1.5: Exact Date Match with Swapped Deliverable Type (e.g. client wanted a Reel instead of a Post on this date)
  for (const slot of slotsWithMeta) {
    if (slot.delivered) continue;
    const sameDatePost = sortedPosts.find(
      p =>
        !usedPostIds.has(p.id) &&
        toLocalDateKey(p.published_at) === slot._dateKey
    );
    if (sameDatePost) {
      usedPostIds.add(sameDatePost.id);
      slot.delivered = true;
      slot.matchedPost = sameDatePost;
      slot.postLogId = sameDatePost.id;
      slot.deliveredTitle = sameDatePost.title;
      slot.deliveredType = sameDatePost.post_type || slot.type;
      slot.isSwapped = (sameDatePost.post_type !== slot.originalType);
      slot.swappedFrom = slot.originalType;
      slot.type = sameDatePost.post_type; // display with actual delivered format on calendar
    }
  }

  // Pass 2: Fallback for legacy posts whose published_at didn't match an exact slot date
  for (const post of sortedPosts) {
    if (usedPostIds.has(post.id)) continue;
    const pType = post.post_type || 'static';
    const candidateSlot = slotsWithMeta.find(
      s => !s.delivered && s.type === pType
    );
    if (candidateSlot) {
      usedPostIds.add(post.id);
      candidateSlot.delivered = true;
      candidateSlot.matchedPost = post;
      candidateSlot.postLogId = post.id;
      candidateSlot.deliveredTitle = post.title;
      candidateSlot.deliveredType = pType;
    }
  }

  // Pass 3: Append any custom deliverable posts added by admin that didn't correspond to any scheduled slot
  for (const post of sortedPosts) {
    if (usedPostIds.has(post.id)) continue;
    usedPostIds.add(post.id);
    const postDate = new Date(post.published_at || post.created_at || Date.now());
    slotsWithMeta.push({
      type: post.post_type || 'static',
      originalType: post.post_type || 'static',
      time: 'Custom Deliverable',
      note: post.title,
      date: postDate,
      _dateKey: toLocalDateKey(postDate),
      delivered: true,
      isCustomDeliverable: true,
      matchedPost: post,
      postLogId: post.id,
      deliveredTitle: post.title,
      deliveredType: post.post_type || 'static',
      isSwapped: false
    });
  }

  // Sort chronologically
  slotsWithMeta.sort((a, b) => new Date(a.date) - new Date(b.date));
  return slotsWithMeta;
}

// Broadcast live deliverable changes so Client Dashboard updates in real time
let deliverablesSyncChannel = null;
export async function broadcastDeliverablesSync(payload = {}) {
  try {
    if (!deliverablesSyncChannel) {
      deliverablesSyncChannel = supabase.channel('outliers-deliverables-live', {
        config: { broadcast: { self: true } }
      });
      deliverablesSyncChannel.subscribe();
    }
    await Promise.race([
      deliverablesSyncChannel.send({
        type: 'broadcast',
        event: 'deliverables-updated',
        payload: {
          ...payload,
          timestamp: Date.now()
        }
      }),
      new Promise((res) => setTimeout(res, 800))
    ]);
  } catch (err) {
    console.warn('Deliverables live broadcast notice:', err);
  }
}

// Find next deliverable to be uploaded (static, reel, poster, or story)
export function getNextUpload(schedule, staticDone = 0, reelsDone = 0, postersDone = 0, storiesDone = 0) {
  if (!schedule || !Array.isArray(schedule)) return null;

  let staticSkipped = 0;
  let reelsSkipped = 0;
  let postersSkipped = 0;
  let storiesSkipped = 0;

  for (const slot of schedule) {
    if (slot.type === 'static') {
      if (staticSkipped < staticDone) { staticSkipped++; continue; }
      return slot;
    }
    if (slot.type === 'reel') {
      if (reelsSkipped < reelsDone) { reelsSkipped++; continue; }
      return slot;
    }
    if (slot.type === 'poster') {
      if (postersSkipped < postersDone) { postersSkipped++; continue; }
      return slot;
    }
    if (slot.type === 'story') {
      if (storiesSkipped < storiesDone) { storiesSkipped++; continue; }
      return slot;
    }
  }
  return null;
}

// ==============================================================================
// SPECIAL DELIVERABLES & CUSTOM PROJECT HELPERS
// ==============================================================================

/**
 * Extracts special deliverables array from an order object (with dual storage check)
 */
export function getSpecialDeliverables(order) {
  if (!order) return [];
  // 1. Check if directly attached on order (e.g. from table join or schedule_config)
  if (Array.isArray(order.special_deliverables)) {
    return order.special_deliverables;
  }
  // 2. Check inside schedule_config
  if (order.schedule_config && typeof order.schedule_config === 'object') {
    if (Array.isArray(order.schedule_config.special_deliverables)) {
      return order.schedule_config.special_deliverables;
    }
  }
  if (typeof order.schedule_config === 'string') {
    try {
      const parsed = JSON.parse(order.schedule_config);
      if (Array.isArray(parsed?.special_deliverables)) {
        return parsed.special_deliverables;
      }
    } catch {}
  }
  // 3. Check localStorage cache
  if (typeof window !== 'undefined' && order.order_id) {
    try {
      const cached = localStorage.getItem(`om_special_deliv_${order.order_id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
}

/**
 * Fetches special deliverables for an order from public.special_deliverables with fallback
 */
export async function fetchSpecialDeliverablesFromDB(orderId) {
  if (!orderId) return [];
  try {
    const { data, error } = await supabase
      .from('special_deliverables')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`om_special_deliv_${orderId}`, JSON.stringify(data));
      }
      return data;
    }
  } catch (err) {
    console.warn("Notice: public.special_deliverables query fallback:", err);
  }

  // Fallback: fetch from orders.schedule_config
  try {
    const { data: orderData } = await supabase
      .from('orders')
      .select('schedule_config')
      .eq('order_id', orderId)
      .maybeSingle();

    if (orderData?.schedule_config?.special_deliverables) {
      return orderData.schedule_config.special_deliverables;
    }
  } catch {}

  // Last resort: localStorage
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`om_special_deliv_${orderId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  return [];
}

/**
 * Saves or updates a special deliverable (dual write to table & orders.schedule_config)
 */
export async function saveSpecialDeliverable(order, deliverableData) {
  if (!order || !order.order_id) return { error: new Error("Missing order") };
  const orderId = order.order_id;
  const clientId = order.client_id || order.auth_id;

  const id = deliverableData.id || `deliv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record = {
    id,
    order_id: orderId,
    client_id: clientId || null,
    title: (deliverableData.title || '').trim(),
    category: deliverableData.category || 'Website / Web App',
    custom_type_name: deliverableData.custom_type_name || null,
    deliverable_type: deliverableData.deliverable_type || 'special', // 'reel' | 'static' | 'story' | 'website' | 'special'
    description: (deliverableData.description || '').trim(),
    project_url: (deliverableData.project_url || '').trim() || null,
    status: deliverableData.status || 'delivered', // 'delivered' | 'in_progress'
    price: Number(deliverableData.price || 0),
    payment_status: deliverableData.payment_status || (Number(deliverableData.price || 0) === 0 ? 'complimentary' : 'pending'), // 'paid' | 'pending' | 'complimentary'
    payment_id: (deliverableData.payment_id || '').trim() || null,
    payment_receipt_url: deliverableData.payment_receipt_url || null,
    receipt_urls: Array.isArray(deliverableData.receipt_urls) ? deliverableData.receipt_urls : (deliverableData.payment_receipt_url ? [deliverableData.payment_receipt_url] : []),
    delivered_at: deliverableData.delivered_at || deliverableData.scheduled_date || now,
    created_at: deliverableData.created_at || now,
    updated_at: now
  };

  // 1. Update localStorage cache
  const existingList = getSpecialDeliverables(order);
  const updatedList = existingList.some(item => item.id === id)
    ? existingList.map(item => item.id === id ? { ...item, ...record } : item)
    : [record, ...existingList];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`om_special_deliv_${orderId}`, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('om_special_deliverable_changed', { detail: { orderId, record } }));
    } catch {}
  }

  // 2. Write to public.special_deliverables
  try {
    const { error: dbError } = await supabase
      .from('special_deliverables')
      .upsert([
        {
          id: record.id,
          order_id: record.order_id,
          client_id: record.client_id,
          title: record.title,
          category: record.category,
          description: record.description,
          project_url: record.project_url,
          status: record.status,
          price: record.price,
          payment_status: record.payment_status,
          payment_id: record.payment_id,
          payment_receipt_url: record.payment_receipt_url,
          delivered_at: record.delivered_at,
          created_at: record.created_at
        }
      ], { onConflict: 'id' });

    if (dbError) {
      console.warn("Notice: public.special_deliverables upsert notice (using JSONB mirror):", dbError.message);
    }
  } catch (err) {
    console.warn("Notice: special_deliverables table upsert error:", err);
  }

  // 3. Mirror into orders.schedule_config
  try {
    const currentCfg = (order.schedule_config && typeof order.schedule_config === 'object')
      ? { ...order.schedule_config }
      : {};

    currentCfg.special_deliverables = updatedList;

    await supabase
      .from('orders')
      .update({ schedule_config: currentCfg })
      .eq('order_id', orderId);
  } catch (err) {
    console.warn("Notice: order schedule_config update notice:", err);
  }

  // 4. Real-time broadcast
  await broadcastDeliverablesSync({
    type: 'special_deliverable_saved',
    order_id: orderId,
    deliverable: record
  });

  return { data: record, error: null };
}

/**
 * Deletes a special deliverable from both table and orders.schedule_config
 */
export async function deleteSpecialDeliverable(order, deliverableId) {
  if (!order || !order.order_id || !deliverableId) return { error: new Error("Missing parameters") };
  const orderId = order.order_id;

  // 1. Update localStorage cache
  const existingList = getSpecialDeliverables(order);
  const updatedList = existingList.filter(item => item.id !== deliverableId);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`om_special_deliv_${orderId}`, JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('om_special_deliverable_changed', { detail: { orderId, deletedId: deliverableId } }));
    } catch {}
  }

  // 2. Delete from public.special_deliverables
  try {
    await supabase
      .from('special_deliverables')
      .delete()
      .eq('id', deliverableId);
  } catch (err) {
    console.warn("Notice: special_deliverables delete notice:", err);
  }

  // 3. Mirror in orders.schedule_config
  try {
    const currentCfg = (order.schedule_config && typeof order.schedule_config === 'object')
      ? { ...order.schedule_config }
      : {};

    currentCfg.special_deliverables = updatedList;

    await supabase
      .from('orders')
      .update({ schedule_config: currentCfg })
      .eq('order_id', orderId);
  } catch (err) {
    console.warn("Notice: order schedule_config delete update notice:", err);
  }

  await broadcastDeliverablesSync({
    type: 'special_deliverable_deleted',
    order_id: orderId,
    deletedId: deliverableId
  });

  return { success: true };
}
