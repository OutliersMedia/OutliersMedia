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
      payout_status: 'unpaid', // 'unpaid' | 'paid'
      payout_amount: 0,
      payout_date: null,
      payout_method: 'UPI', // 'UPI' | 'Bank Transfer' | 'Cash' | 'Barter Settled'
      payout_reference: '',
      payout_receipt_url: null,
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

/**
 * Computes creator financial statistics (committed, paid, and pending balance)
 */
export function computeCreatorFinances(influencerOrList) {
  if (Array.isArray(influencerOrList)) {
    let totalCommitted = 0;
    let totalPaid = 0;
    let totalBarterValue = 0;
    let pendingCreatorsCount = 0;

    influencerOrList.forEach((inf) => {
      const stats = computeCreatorFinances(inf);
      totalCommitted += stats.committed;
      totalPaid += stats.paid;
      totalBarterValue += stats.barterValue;
      if (stats.pending > 0) {
        pendingCreatorsCount += 1;
      }
    });

    const totalPending = Math.max(0, totalCommitted - totalPaid);
    return {
      totalCommitted,
      totalPaid,
      totalPending,
      totalBarterValue,
      pendingCreatorsCount
    };
  }

  // Single Influencer calculation
  const inf = influencerOrList || {};
  const reels = Array.isArray(inf.reels) ? inf.reels : [];
  
  let committed = 0;
  let paid = 0;
  let barterValue = 0;

  reels.forEach((reel) => {
    const reelCost = Number(reel.paid_amount || 0);
    committed += reelCost;
    
    if (reel.payout_status === 'paid') {
      paid += Number(reel.payout_amount || reelCost);
    } else {
      paid += Number(reel.payout_amount || 0);
    }

    if (reel.is_barter) {
      barterValue += Number(reel.barter_price || 0);
    }
  });

  // If contract has a fixed total_price overriding reels
  if (committed === 0 && Number(inf.total_price) > 0) {
    committed = Number(inf.total_price);
  }

  const pending = Math.max(0, committed - paid);
  let payoutStatus = 'barter_only';

  if (committed > 0) {
    if (pending === 0) {
      payoutStatus = 'paid';
    } else if (paid > 0) {
      payoutStatus = 'partially_paid';
    } else {
      payoutStatus = 'unpaid';
    }
  }

  return {
    committed,
    paid,
    pending,
    barterValue,
    payoutStatus
  };
}

/**
 * Records a payout (full balance or single reel) for an influencer
 */
export async function recordCreatorPayout(influencerId, payoutDetails = {}) {
  const cached = getCachedInfluencers();
  const index = cached.findIndex(item => item.id === influencerId);
  if (index === -1) return { error: "Influencer not found" };

  const current = JSON.parse(JSON.stringify(cached[index]));
  const reels = Array.isArray(current.reels) ? current.reels : [];
  const now = new Date().toISOString();

  const {
    reel_number, // if null/undefined, applies to all unpaid reels
    amount,
    payout_method = 'UPI',
    payout_reference = '',
    payout_receipt_url = null,
    notes = ''
  } = payoutDetails;

  if (reel_number !== undefined && reel_number !== null) {
    // Single reel payout
    const rIdx = reels.findIndex(r => r.reel_number === reel_number);
    if (rIdx >= 0) {
      reels[rIdx] = {
        ...reels[rIdx],
        payout_status: 'paid',
        payout_amount: Number(amount !== undefined ? amount : reels[rIdx].paid_amount || 0),
        payout_date: now,
        payout_method,
        payout_reference: payout_reference || reels[rIdx].payout_reference || '',
        payout_receipt_url: payout_receipt_url || reels[rIdx].payout_receipt_url || null,
        notes: notes ? `${reels[rIdx].notes || ''} [Payout: ${notes}]`.trim() : reels[rIdx].notes
      };
    }
  } else {
    // Settle entire balance across reels
    reels.forEach(r => {
      const reelCost = Number(r.paid_amount || 0);
      if (reelCost > 0) {
        r.payout_status = 'paid';
        r.payout_amount = reelCost;
        r.payout_date = now;
        r.payout_method = payout_method;
        if (payout_reference) r.payout_reference = payout_reference;
        if (payout_receipt_url) r.payout_receipt_url = payout_receipt_url;
      }
    });
  }

  current.reels = reels;
  current.updated_at = now;
  return await saveInfluencer(current);
}

// ----------------------------------------------------
// CREATOR PACK ORDERS & NEGOTIATION MANAGEMENT
// ----------------------------------------------------

const CREATOR_ORDERS_KEY = 'om_creator_orders_v1';

export function getCachedCreatorOrders() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CREATOR_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Could not read creator orders cache:", err);
    return [];
  }
}

export function setCachedCreatorOrders(list) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CREATOR_ORDERS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('om_creator_orders_changed', { detail: { list } }));
  } catch (err) {
    console.warn("Could not write creator orders cache:", err);
  }
}

/**
 * Fetches all Creator Pack orders and negotiation requests
 */
export async function fetchCreatorOrders() {
  const cached = getCachedCreatorOrders();
  try {
    // Also query special_deliverables where deliverable_type is creator_pack
    const { data, error } = await supabase
      .from('special_deliverables')
      .select('*, client:client_id(name, email, phone, business_type, instagram_handle)')
      .eq('deliverable_type', 'creator_pack')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const dbIds = new Set(data.map(o => o.id));
      const localOnly = cached.filter(o => !dbIds.has(o.id));
      const combined = [...data, ...localOnly];
      setCachedCreatorOrders(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Notice: public.special_deliverables creator_pack query fallback:", err);
  }
  return cached;
}

/**
 * Saves a new Creator Pack order or negotiation proposal
 */
export async function saveCreatorOrder(orderData) {
  const id = orderData.id || `crord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record = {
    id,
    order_number: orderData.order_number || `CR-${Date.now().toString().slice(-4)}`,
    deliverable_type: 'creator_pack',
    title: orderData.title || `Creator Pack (${orderData.reels_count || 3} Reels)`,
    business_name: (orderData.business_name || '').trim(),
    contact_name: (orderData.contact_name || '').trim(),
    phone: (orderData.phone || '').trim(),
    email: (orderData.email || '').trim(),
    instagram_handle: (orderData.instagram_handle || '').trim().replace(/^@/, ''),
    niche: (orderData.niche || 'Lifestyle').trim(),
    reels_count: Math.max(3, parseInt(orderData.reels_count) || 3),
    initial_quoted_price: Number(orderData.initial_quoted_price || 0),
    negotiated_price: Number(orderData.negotiated_price || orderData.initial_quoted_price || 0),
    proposed_budget: Number(orderData.proposed_budget || 0),
    status: orderData.status || 'negotiating', // 'negotiating' | 'approved' | 'active' | 'completed' | 'cancelled'
    payment_status: orderData.payment_status || 'unpaid', // 'unpaid' | 'advance_paid' | 'paid'
    payment_terms: orderData.payment_terms || '100% On Agreement',
    client_notes: (orderData.client_notes || '').trim(),
    admin_notes: (orderData.admin_notes || '').trim(),
    created_at: orderData.created_at || now,
    updated_at: now
  };

  // 1. Update localStorage cache
  const cached = getCachedCreatorOrders();
  const existingIdx = cached.findIndex(o => o.id === id);
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...cached];
    updatedList[existingIdx] = record;
  } else {
    updatedList = [record, ...cached];
  }
  setCachedCreatorOrders(updatedList);

  // 2. Dual-write to Supabase special_deliverables if available
  try {
    const supabasePayload = {
      id: record.id,
      deliverable_type: 'creator_pack',
      title: record.title,
      price: record.negotiated_price,
      payment_status: record.payment_status,
      delivery_status: record.status,
      description: `Reels: ${record.reels_count} | Client: ${record.business_name} (${record.phone}) | Notes: ${record.client_notes}`,
      custom_notes: JSON.stringify({
        contact_name: record.contact_name,
        email: record.email,
        phone: record.phone,
        business_name: record.business_name,
        instagram_handle: record.instagram_handle,
        reels_count: record.reels_count,
        initial_quoted_price: record.initial_quoted_price,
        negotiated_price: record.negotiated_price,
        proposed_budget: record.proposed_budget,
        admin_notes: record.admin_notes
      }),
      updated_at: now
    };

    const { error } = await supabase
      .from('special_deliverables')
      .upsert([supabasePayload], { onConflict: 'id' });

    if (error) {
      console.warn("Notice: special_deliverables dual-write warning:", error.message);
    }
  } catch (err) {
    console.warn("Notice: special_deliverables dual-write exception:", err);
  }

  return { data: record, error: null };
}

/**
 * Updates negotiated price and parameters from Admin
 */
export async function updateCreatorOrderNegotiation(orderId, negotiationData) {
  const cached = getCachedCreatorOrders();
  const idx = cached.findIndex(o => o.id === orderId);
  if (idx === -1) return { error: "Order not found" };

  const current = { ...cached[idx] };
  if (negotiationData.negotiated_price !== undefined) {
    current.negotiated_price = Number(negotiationData.negotiated_price);
  }
  if (negotiationData.reels_count !== undefined) {
    current.reels_count = Math.max(3, parseInt(negotiationData.reels_count));
    current.title = `Creator Pack (${current.reels_count} Reels)`;
  }
  if (negotiationData.status !== undefined) {
    current.status = negotiationData.status;
  }
  if (negotiationData.payment_status !== undefined) {
    current.payment_status = negotiationData.payment_status;
  }
  if (negotiationData.payment_terms !== undefined) {
    current.payment_terms = negotiationData.payment_terms;
  }
  if (negotiationData.admin_notes !== undefined) {
    current.admin_notes = negotiationData.admin_notes;
  }
  current.updated_at = new Date().toISOString();

  return await saveCreatorOrder(current);
}
