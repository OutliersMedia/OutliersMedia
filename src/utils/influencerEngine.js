import { supabase } from './supabaseClient';

const INFLUENCERS_CACHE_KEY = 'om_influencers_cache_v1';

/**
 * Generates initial empty reels for a contract based on reels_count (3 to 10)
 */
export function generateDefaultReels(count = 3) {
  const safeCount = Math.max(3, Math.min(10, parseInt(count) || 3));
  const reels = [];
  for (let i = 1; i <= safeCount; i++) {
    reels.push({
      reel_number: i,
      title: `Reel #${i}`,
      is_barter: true,
      barter_item: '',
      barter_price: 0,
      is_paid: false,
      paid_amount: 0,
      editor: 'me', // 'me' (Outliers Media / Admin) | 'they' (Influencer)
      final_reel_url: '',
      status: 'pending', // 'pending' | 'shooting' | 'editing' | 'uploaded' | 'completed'
      notes: ''
    });
  }
  return reels;
}

/**
 * Gets cached influencers from localStorage
 */
export function getCachedInfluencers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INFLUENCERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Could not read influencers cache:", err);
    return [];
  }
}

/**
 * Sets cached influencers in localStorage and emits real-time event
 */
export function setCachedInfluencers(list) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INFLUENCERS_CACHE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('om_influencer_changed', { detail: { list } }));
  } catch (err) {
    console.warn("Could not write influencers cache:", err);
  }
}

/**
 * Fetches all influencers from Supabase with localStorage fallback
 */
export async function fetchInfluencers() {
  const cached = getCachedInfluencers();
  try {
    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      // Merge with any offline cached items that aren't in data yet
      const dbIds = new Set(data.map(i => i.id));
      const localOnly = cached.filter(i => !dbIds.has(i.id));
      const combined = [...data, ...localOnly];
      setCachedInfluencers(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Notice: public.influencers table query fallback:", err);
  }
  return cached;
}

/**
 * Creates or updates an influencer record
 */
export async function saveInfluencer(influencerData) {
  const id = influencerData.id || `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const reelsCount = Math.max(3, Math.min(10, parseInt(influencerData.reels_count) || 3));

  // Ensure reels array matches reels_count
  let reels = Array.isArray(influencerData.reels) ? [...influencerData.reels] : [];
  if (reels.length === 0) {
    reels = generateDefaultReels(reelsCount);
  } else if (reels.length < reelsCount) {
    // Add extra reels if count increased
    for (let i = reels.length + 1; i <= reelsCount; i++) {
      reels.push({
        reel_number: i,
        title: `Reel #${i}`,
        is_barter: true,
        barter_item: '',
        barter_price: 0,
        is_paid: false,
        paid_amount: 0,
        editor: 'me',
        final_reel_url: '',
        status: 'pending',
        notes: ''
      });
    }
  } else if (reels.length > reelsCount) {
    reels = reels.slice(0, reelsCount);
  }

  const record = {
    id,
    name: (influencerData.name || '').trim(),
    instagram_id: (influencerData.instagram_id || '').trim().replace(/^@/, ''),
    phone: (influencerData.phone || '').trim(),
    email: (influencerData.email || '').trim(),
    city: (influencerData.city || '').trim(),
    niche: (influencerData.niche || 'Lifestyle').trim(),
    follower_count: (influencerData.follower_count || '').trim(),
    reels_count: reelsCount,
    dashboard_screenshot_url: influencerData.dashboard_screenshot_url || null,
    contract_type: influencerData.contract_type || 'barter', // 'barter' | 'paid' | 'hybrid'
    total_price: Number(influencerData.total_price || 0),
    status: influencerData.status || 'pending', // 'pending' | 'negotiating' | 'approved' | 'active' | 'rejected' | 'completed'
    notes: (influencerData.notes || '').trim(),
    reels,
    created_at: influencerData.created_at || now,
    updated_at: now
  };

  // 1. Update localStorage cache immediately
  const cached = getCachedInfluencers();
  const existingIdx = cached.findIndex(item => item.id === id);
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...cached];
    updatedList[existingIdx] = record;
  } else {
    updatedList = [record, ...cached];
  }
  setCachedInfluencers(updatedList);

  // 2. Dual-write to Supabase
  try {
    const { error } = await supabase
      .from('influencers')
      .upsert([record], { onConflict: 'id' });

    if (error) {
      console.warn("Notice: public.influencers upsert warning (stored in local cache):", error.message);
    }
  } catch (err) {
    console.warn("Notice: Supabase influencers upsert error:", err);
  }

  return { data: record, error: null };
}

/**
 * Deletes an influencer record
 */
export async function deleteInfluencer(id) {
  if (!id) return;
  
  // 1. Remove from local cache
  const cached = getCachedInfluencers();
  const updated = cached.filter(item => item.id !== id);
  setCachedInfluencers(updated);

  // 2. Remove from Supabase
  try {
    await supabase.from('influencers').delete().eq('id', id);
  } catch (err) {
    console.warn("Notice: Supabase influencers delete error:", err);
  }
}
