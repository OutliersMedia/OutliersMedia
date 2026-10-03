import { Image as ImageIcon, Video, Layout, Sparkles, BookOpen } from 'lucide-react';

/**
 * OUTLIERS MEDIA — 7-DAY REPEATING CYCLE SCHEDULE ENGINE
 * Generates an accurate, professional content calendar matching the agency's exact specifications:
 *
 * STARTER (7-Day Repeating Pattern):
 * - Day 1: Post @ 7:00 PM (High engagement window)
 * - Day 3: Post @ 12:30 PM (Lunch break browsing)
 * - Day 5: Reel @ 7:00 PM (Peak video discovery)
 * - Day 7: Post @ 11:00 AM (Weekend leisure time)
 * Quota: 10 Posts, 3 Reels
 *
 * GROWTH & PREMIUM (7-Day Repeating Pattern):
 * - Day 1: Post @ 7:00 PM (High engagement)
 * - Day 2: Stories @ 12:00 PM & 7:00 PM (Mid-week boost)
 * - Day 3: Reel @ 12:30 PM (Peak discovery) + Post @ 7:00 PM (Evening push)
 * - Day 4: Stories @ 11:00 AM & 6:00 PM (Lunch + evening rush)
 * - Day 5: Post @ 12:30 PM (Lunch break) + Reel @ 7:00 PM (Double-day push)
 * - Day 6: Stories @ 10:00 AM & 5:00 PM (Weekend browsing peak)
 * - Day 7: Post @ 11:00 AM (Weekend leisure time)
 * Quota: 15 Posts, 4 Reels, 1 Physical Poster (Day 10 @ 2:00 PM)
 *
 * PREMIUM Add-ons:
 * - Weekly Milestones: Week 1 SEO Blog, Week 2 Influencer, Week 3 Event Promo, Week 4 Recap Video
 */

export const TYPE_CONFIG = {
  static:  { label: 'Static Post', shortLabel: 'Post',   icon: ImageIcon, color: 'text-[#3428f8]', bg: 'bg-[#3428f8]', dot: 'bg-[#3428f8]' },
  reel:    { label: 'Reel',        shortLabel: 'Reel',   icon: Video,     color: 'text-pink-500',   bg: 'bg-pink-500',   dot: 'bg-pink-500' },
  poster:  { label: 'Poster',      shortLabel: 'Poster', icon: Layout,    color: 'text-green-500',  bg: 'bg-green-500',  dot: 'bg-green-500' },
  story:   { label: 'Stories',     shortLabel: 'Story',  icon: Sparkles,  color: 'text-amber-400',  bg: 'bg-amber-400',  dot: 'bg-amber-400' },
  special: { label: 'Special',     shortLabel: 'Special',icon: BookOpen,  color: 'text-purple-400', bg: 'bg-purple-400', dot: 'bg-purple-400' },
};

export function generateUploadSchedule(startDate, planName = 'Starter Plan', staticTotal = 10, reelsTotal = 3, postersTotal = 0) {
  const start = new Date(startDate);
  const normalizedPlan = (planName || '').toLowerCase();
  const isStarter = normalizedPlan.includes('starter') || normalizedPlan.includes('basic');
  const isPremium = normalizedPlan.includes('premium');
  const schedule = [];

  if (isStarter) {
    // STARTER 7-Day Cycle
    const starterCycle = [
      { dayOffset: 0, type: 'static', time: '7:00 PM', note: 'High engagement window' },
      { dayOffset: 2, type: 'static', time: '12:30 PM', note: 'Lunch break browsing' },
      { dayOffset: 4, type: 'reel',   time: '7:00 PM', note: 'Peak video discovery' },
      { dayOffset: 6, type: 'static', time: '11:00 AM', note: 'Weekend leisure time' },
    ];

    let staticCount = 0;
    let reelsCount = 0;
    const maxStatic = staticTotal || 10;
    const maxReels = reelsTotal || 3;

    // Run 5 cycles to comfortably cover the full 30-day month
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const item of starterCycle) {
        if (item.type === 'static' && staticCount >= maxStatic) continue;
        if (item.type === 'reel' && reelsCount >= maxReels) continue;

        const dayNum = cycle * 7 + item.dayOffset;
        if (dayNum >= 30) continue;

        const date = new Date(start);
        date.setDate(date.getDate() + dayNum);

        if (item.type === 'static') staticCount++;
        if (item.type === 'reel') reelsCount++;

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
    // GROWTH & PREMIUM 7-Day Cycle
    const growthCycle = [
      { dayOffset: 0, type: 'static', time: '7:00 PM', note: 'High engagement window' },
      { dayOffset: 1, type: 'story',  time: '12:00 PM & 7:00 PM', note: '2–3 stories mid-week boost' },
      { dayOffset: 2, type: 'reel',   time: '12:30 PM', note: 'Peak video discovery' },
      { dayOffset: 2, type: 'static', time: '7:00 PM', note: 'Evening feed push' },
      { dayOffset: 3, type: 'story',  time: '11:00 AM & 6:00 PM', note: 'Lunch + evening rush stories' },
      { dayOffset: 4, type: 'static', time: '12:30 PM', note: 'Lunch break browsing' },
      { dayOffset: 4, type: 'reel',   time: '7:00 PM', note: 'Double-day video push' },
      { dayOffset: 5, type: 'story',  time: '10:00 AM & 5:00 PM', note: 'Weekend browsing peak' },
      { dayOffset: 6, type: 'static', time: '11:00 AM', note: 'Weekend leisure time' },
    ];

    let staticCount = 0;
    let reelsCount = 0;
    const maxStatic = staticTotal || 15;
    const maxReels = reelsTotal || 4;

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const item of growthCycle) {
        if (item.type === 'static' && staticCount >= maxStatic) continue;
        if (item.type === 'reel' && reelsCount >= maxReels) continue;

        const dayNum = cycle * 7 + item.dayOffset;
        if (dayNum >= 30) continue;

        const date = new Date(start);
        date.setDate(date.getDate() + dayNum);

        if (item.type === 'static') staticCount++;
        if (item.type === 'reel') reelsCount++;

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

    // Physical Poster Design (Day 10)
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

// Find next deliverable to be uploaded (static, reel, or poster)
export function getNextUpload(schedule, staticDone = 0, reelsDone = 0, postersDone = 0) {
  let staticSkipped = 0;
  let reelsSkipped = 0;
  let postersSkipped = 0;

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
  }
  return null; // All core deliverables completed
}
