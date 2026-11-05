import { supabase } from './supabaseClient';

const INFLUENCERS_CACHE_KEY = 'om_influencers_cache_v1';
const DELETED_INFLUENCERS_KEY = 'om_deleted_influencers_v1';

/**
 * Gets permanently deleted influencer IDs from localStorage
 */
export function getDeletedInfluencerIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_INFLUENCERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Adds an influencer ID to the permanent deletion blacklist
 */
export function addDeletedInfluencerId(id) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const strId = String(id).trim();
    const current = getDeletedInfluencerIds();
    if (!current.includes(strId)) {
      current.push(strId);
      localStorage.setItem(DELETED_INFLUENCERS_KEY, JSON.stringify(current));
    }
  } catch (err) {
    console.warn("Could not save deleted influencer ID:", err);
  }
}

/**
 * Generates initial empty reels for a contract based on reels_count (3 to 10)
 */
export function generateDefaultReels(count = 3, defaultPaidAmount = 0) {
  const safeCount = Math.max(3, Math.min(10, parseInt(count) || 3));
  const reels = [];
  for (let i = 1; i <= safeCount; i++) {
    reels.push({
      reel_number: i,
      title: `Reel #${i}`,
      is_barter: true,
      barter_item: '',
      barter_price: 0,
      is_paid: defaultPaidAmount > 0,
      paid_amount: defaultPaidAmount > 0 ? Number(defaultPaidAmount) : 0,
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
  const deletedIds = new Set(getDeletedInfluencerIds().map(String));

  try {
    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      // Normalize data with rate_per_reel and final_rate_per_reel, filter out any deleted records
      const normalizedData = data
        .filter(inf => !deletedIds.has(String(inf.id).trim()))
        .map(inf => {
          const reels = Array.isArray(inf.reels) ? inf.reels : [];
          const rate_per_reel = Number(
            inf.rate_per_reel !== undefined 
              ? inf.rate_per_reel 
              : (reels[0]?.rate_per_reel || (inf.total_price && inf.reels_count ? Math.round(Number(inf.total_price) / Number(inf.reels_count)) : 0))
          );
          const final_rate_per_reel = Number(
            inf.final_rate_per_reel !== undefined 
              ? inf.final_rate_per_reel 
              : (reels[0]?.final_rate_per_reel || 0)
          );
          return {
            ...inf,
            rate_per_reel,
            final_rate_per_reel
          };
        });

      // Merge with any offline cached items that aren't in data yet and not in deleted blacklist
      const dbIds = new Set(normalizedData.map(i => String(i.id).trim()));
      const localOnly = cached.filter(i => !dbIds.has(String(i.id).trim()) && !deletedIds.has(String(i.id).trim()));
      const combined = [...normalizedData, ...localOnly];
      setCachedInfluencers(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Notice: public.influencers table query fallback:", err);
  }
  return cached.filter(i => !deletedIds.has(String(i.id).trim()));
}

/**
 * Creates or updates an influencer record
 */
export async function saveInfluencer(influencerData) {
  const id = influencerData.id || `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const reelsCount = Math.max(3, Math.min(10, parseInt(influencerData.reels_count) || 3));

  // Determine rate_per_reel (influencer quote) and final_rate_per_reel (admin final approved rate)
  const ratePerReel = Number(
    influencerData.rate_per_reel !== undefined 
      ? influencerData.rate_per_reel 
      : (influencerData.reels?.[0]?.rate_per_reel || 0)
  );
  const finalRatePerReel = Number(
    influencerData.final_rate_per_reel !== undefined 
      ? influencerData.final_rate_per_reel 
      : (influencerData.reels?.[0]?.final_rate_per_reel || 0)
  );

  // Compute total price: finalRate takes precedence once approved
  let totalPrice = Number(influencerData.total_price || 0);
  if (finalRatePerReel > 0) {
    totalPrice = finalRatePerReel * reelsCount;
  } else if (ratePerReel > 0 && (totalPrice === 0 || influencerData.recalculate_total)) {
    totalPrice = ratePerReel * reelsCount;
  }

  // Ensure reels array matches reels_count
  let reels = Array.isArray(influencerData.reels) ? [...influencerData.reels] : [];
  if (reels.length === 0) {
    reels = generateDefaultReels(reelsCount, finalRatePerReel || ratePerReel);
  } else if (reels.length < reelsCount) {
    // Add extra reels if count increased
    for (let i = reels.length + 1; i <= reelsCount; i++) {
      reels.push({
        reel_number: i,
        title: `Reel #${i}`,
        is_barter: influencerData.contract_type === 'barter' || influencerData.contract_type === 'hybrid',
        barter_item: '',
        barter_price: 0,
        is_paid: influencerData.contract_type === 'paid' || influencerData.contract_type === 'hybrid',
        paid_amount: finalRatePerReel || ratePerReel || 0,
        editor: 'me',
        final_reel_url: '',
        status: 'pending',
        notes: ''
      });
    }
  } else if (reels.length > reelsCount) {
    reels = reels.slice(0, reelsCount);
  }

  // Stamp rate metadata onto reels
  reels = reels.map(r => ({
    ...r,
    rate_per_reel: ratePerReel,
    final_rate_per_reel: finalRatePerReel,
    paid_amount: (influencerData.apply_to_all_reels && finalRatePerReel > 0 && r.is_paid)
      ? finalRatePerReel
      : (r.paid_amount !== undefined ? Number(r.paid_amount) : (finalRatePerReel || ratePerReel || 0))
  }));

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
    rate_per_reel: ratePerReel,
    final_rate_per_reel: finalRatePerReel,
    total_price: totalPrice,
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
    // Attempt upsert with all fields
    const { error: fullError } = await supabase
      .from('influencers')
      .upsert([record], { onConflict: 'id' });

    if (fullError) {
      // If error is PGRST204 (column not found in schema cache), retry without top-level rate_per_reel / final_rate_per_reel
      // (The rates are still 100% securely saved in the 'reels' JSONB column!)
      if (fullError.code === 'PGRST204' || String(fullError.message).includes('column')) {
        const { rate_per_reel, final_rate_per_reel, ...fallbackRecord } = record;
        const { error: fallbackErr } = await supabase
          .from('influencers')
          .upsert([fallbackRecord], { onConflict: 'id' });
        if (fallbackErr) {
          console.warn("Notice: public.influencers fallback upsert warning:", fallbackErr.message);
        }
      } else {
        console.warn("Notice: public.influencers upsert warning (stored in local cache):", fullError.message);
      }
    }
  } catch (err) {
    console.warn("Notice: Supabase influencers upsert error:", err);
  }

  return { data: record, error: null };
}

/**
 * Deletes an influencer record cleanly from cache, permanent blacklist, and Supabase
 */
export async function deleteInfluencer(id) {
  if (!id) return { success: false, error: "No ID provided" };
  const targetId = String(id).trim();

  // 1. Add to permanent blacklist so this creator is never re-merged from Supabase or cache
  addDeletedInfluencerId(targetId);

  // 2. Remove from local cache immediately
  const cached = getCachedInfluencers();
  const updated = cached.filter(item => String(item.id).trim() !== targetId);
  setCachedInfluencers(updated);

  // 3. Remove from Supabase
  try {
    const { error } = await supabase.from('influencers').delete().eq('id', targetId);
    if (error) {
      console.warn("Notice: Supabase influencers delete response:", error);
    }
  } catch (err) {
    console.warn("Notice: Supabase influencers delete error:", err);
  }

  return { success: true };
}

/**
 * Computes creator financial statistics (committed, paid, pending balance, and per-reel breakdown)
 */
export function computeCreatorFinances(influencerOrList) {
  if (Array.isArray(influencerOrList)) {
    let totalCommitted = 0;
    let totalPaid = 0;
    let totalBarterValue = 0;
    let pendingCreatorsCount = 0;
    let totalUploadedReels = 0;
    let totalPaidReels = 0;
    let totalReelsCount = 0;

    influencerOrList.forEach((inf) => {
      const stats = computeCreatorFinances(inf);
      totalCommitted += stats.committed;
      totalPaid += stats.paid;
      totalBarterValue += stats.barterValue;
      totalUploadedReels += stats.uploadedReels;
      totalPaidReels += stats.paidReels;
      totalReelsCount += stats.totalReels;
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
      pendingCreatorsCount,
      totalUploadedReels,
      totalPaidReels,
      totalReelsCount
    };
  }

  // Single Influencer calculation
  const inf = influencerOrList || {};
  const reels = Array.isArray(inf.reels) ? inf.reels : [];
  const safeCount = Math.max(3, Math.min(10, parseInt(inf.reels_count) || reels.length || 3));
  const perReelRate = Number(inf.final_rate_per_reel || inf.rate_per_reel || 0);

  let committed = 0;
  let paid = 0;
  let barterValue = 0;
  let uploadedReels = 0;
  let paidReels = 0;

  const reelsSummary = reels.map((reel) => {
    const reelCost = Number(reel.paid_amount !== undefined ? reel.paid_amount : perReelRate);
    committed += reelCost;

    const isUploaded = Boolean(reel.final_reel_url) || reel.status === 'uploaded' || reel.status === 'completed';
    if (isUploaded) {
      uploadedReels += 1;
    }

    const isPaid = reel.payout_status === 'paid';
    if (isPaid) {
      paidReels += 1;
      paid += Number(reel.payout_amount || reelCost);
    } else {
      paid += Number(reel.payout_amount || 0);
    }

    if (reel.is_barter) {
      barterValue += Number(reel.barter_price || 0);
    }

    return {
      reel_number: reel.reel_number,
      title: reel.title || `Reel #${reel.reel_number}`,
      cost: reelCost,
      status: reel.status || 'pending',
      isUploaded,
      isPaid,
      payout_status: reel.payout_status || 'unpaid',
      payout_amount: Number(reel.payout_amount || 0),
      payout_date: reel.payout_date || null,
      payout_method: reel.payout_method || 'UPI',
      payout_reference: reel.payout_reference || '',
      final_reel_url: reel.final_reel_url || ''
    };
  });

  // Fallback committed total if individual reels were not specified
  if (committed === 0) {
    if (perReelRate > 0) {
      committed = perReelRate * safeCount;
    } else if (Number(inf.total_price) > 0) {
      committed = Number(inf.total_price);
    }
  }

  const pending = Math.max(0, committed - paid);
  const unpaidReelsCount = Math.max(0, safeCount - paidReels);

  // Determine the next reel to pay (prioritizing uploaded reels that are unpaid, then next unpaid reel)
  const uploadedUnpaid = reelsSummary.find(r => r.isUploaded && !r.isPaid);
  const anyUnpaid = reelsSummary.find(r => !r.isPaid);
  const nextReelToPay = uploadedUnpaid || anyUnpaid || null;
  const nextReelNumber = nextReelToPay ? nextReelToPay.reel_number : null;
  const nextReelAmount = nextReelToPay ? (nextReelToPay.cost || perReelRate || 0) : 0;

  let payoutStatus = 'barter_only';
  if (committed > 0) {
    if (pending === 0 && paidReels >= safeCount) {
      payoutStatus = 'paid';
    } else if (paid > 0) {
      payoutStatus = 'partially_paid';
    } else {
      payoutStatus = 'unpaid';
    }
  }

  return {
    totalReels: safeCount,
    uploadedReels,
    paidReels,
    unpaidReelsCount,
    reelsSummary,
    nextReelToPay,
    nextReelNumber,
    nextReelAmount,
    committed,
    paid,
    pending,
    barterValue,
    payoutStatus
  };
}

/**
 * Records a single reel payout for an influencer (strictly pay per reel after reel is done)
 */
export async function recordCreatorPayout(influencerId, payoutDetails = {}) {
  const cached = getCachedInfluencers();
  const index = cached.findIndex(item => String(item.id).trim() === String(influencerId).trim());
  if (index === -1) return { error: "Influencer not found" };

  const current = JSON.parse(JSON.stringify(cached[index]));
  const reels = Array.isArray(current.reels) ? current.reels : [];
  const now = new Date().toISOString();

  let {
    reel_number, // specific reel to pay (e.g. 1, 2, 3...)
    amount,
    payout_method = 'UPI',
    payout_reference = '',
    payout_receipt_url = null,
    notes = ''
  } = payoutDetails;

  // Always target one specific reel — never pay all at once
  if (reel_number === undefined || reel_number === null) {
    const fin = computeCreatorFinances(current);
    reel_number = fin.nextReelNumber || 1;
  }

  const targetReelNum = parseInt(reel_number);
  const rIdx = reels.findIndex(r => parseInt(r.reel_number) === targetReelNum);

  if (rIdx >= 0) {
    const defaultReelCost = Number(reels[rIdx].paid_amount || current.final_rate_per_reel || current.rate_per_reel || 0);
    const finalReelAmount = Number(amount !== undefined && amount !== null && amount !== '' ? amount : defaultReelCost);
    
    reels[rIdx] = {
      ...reels[rIdx],
      payout_status: 'paid',
      payout_amount: finalReelAmount,
      payout_date: now,
      payout_method: payout_method || 'UPI',
      payout_reference: (payout_reference || '').trim(),
      payout_receipt_url: payout_receipt_url || reels[rIdx].payout_receipt_url || null,
      notes: notes ? `${reels[rIdx].notes || ''} [Paid Reel #${targetReelNum}: ${notes}]`.trim() : reels[rIdx].notes
    };
  } else {
    // If reel wasn't in array yet, add it as paid
    const reelCost = Number(amount || current.final_rate_per_reel || current.rate_per_reel || 0);
    reels.push({
      reel_number: targetReelNum,
      title: `Reel #${targetReelNum}`,
      is_paid: true,
      paid_amount: reelCost,
      payout_status: 'paid',
      payout_amount: reelCost,
      payout_date: now,
      payout_method: payout_method || 'UPI',
      payout_reference: (payout_reference || '').trim(),
      notes: notes ? `[Paid Reel #${targetReelNum}: ${notes}]`.trim() : ''
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
