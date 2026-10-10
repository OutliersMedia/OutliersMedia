import { Image as ImageIcon, Video, Layout, Sparkles, BookOpen } from 'lucide-react';
import { supabase } from './supabaseClient';

/**
 * OUTLIERS MEDIA — 7-DAY REPEATING & CUSTOM INTERVAL SCHEDULE ENGINE
 */

export const TYPE_CONFIG = {
  static:  { label: 'Static Post', shortLabel: 'Post',   icon: ImageIcon, color: 'text-[#3428f8]', bg: 'bg-[#3428f8]', dot: 'bg-[#3428f8]' },
  reel:    { label: 'Reel',        shortLabel: 'Reel',   icon: Video,     color: 'text-pink-500',   bg: 'bg-pink-500',   dot: 'bg-pink-500' },
  poster:  { label: 'Poster',      shortLabel: 'Poster', icon: Layout,    color: 'text-green-500',  bg: 'bg-green-500',  dot: 'bg-green-500' },
  story:   { label: 'Story',       shortLabel: 'Story',  icon: Sparkles,  color: 'text-amber-400',  bg: 'bg-amber-400',  dot: 'bg-amber-400' },
  special: { label: 'Special',     shortLabel: 'Special',icon: BookOpen,  color: 'text-purple-400', bg: 'bg-purple-400', dot: 'bg-purple-400' },
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
        { day: 10, note: 'Week 2: 3–5 Micro-influencer collaboration brief' },
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
