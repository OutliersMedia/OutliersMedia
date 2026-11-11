import { supabase } from './supabaseClient.js';
import { generateUploadSchedule } from './scheduleEngine.js';
import { isWebsiteOrder } from './websiteEngine.js';

/**
 * OUTLIERS MEDIA — CLIENT RENEWAL & BILLING CYCLES ENGINE
 * 
 * Manages recurring client cycles, per-client individual package amounts,
 * payment detail generation, content calendar generation, and automatic
 * pending finance entries in the existing 'orders' table.
 */

export const RENEWAL_CACHE_KEY = 'om_billing_cycles_cache_v1';
export const RENEWAL_EVENT_NAME = 'om_renewal_updated';

export const UPI_PAYMENT_DETAILS = {
  upiId: 'dhimanpashvinder@okicici',
  accountHolder: 'Outliers Media',
  qrImagePath: '/payment-qr.png'
};

/**
 * Retrieves cached cycles from localStorage
 */
export function getCachedCycles() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RENEWAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Notice: getCachedCycles read error:", err);
    return [];
  }
}

/**
 * Saves cycles to localStorage cache
 */
export function setCachedCycles(cycles) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RENEWAL_CACHE_KEY, JSON.stringify(cycles || []));
  } catch (err) {
    console.warn("Notice: setCachedCycles write error:", err);
  }
}

/**
 * Helper to compute 1-month / 30-day end date string (YYYY-MM-DD)
 */
export function calculateCycleEndDate(startDateStr) {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

/**
 * Broadcasts renewal updates across all open tabs and components
 */
export function broadcastRenewalSync(payload = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RENEWAL_EVENT_NAME, { detail: payload }));
    window.dispatchEvent(new CustomEvent('om_business_added', { detail: payload }));
  }
}

/**
 * Bootstraps initial Cycle 1 entries from existing orders if not already tracked
 */
export function bootstrapInitialCycles(ordersList = []) {
  if (!Array.isArray(ordersList)) return [];

  return ordersList
    .filter(order => order && order.client_id && order.order_id && !isWebsiteOrder(order))
    .map((order, idx) => {
      const startDate = order.first_upload_date 
        ? order.first_upload_date.split('T')[0] 
        : (order.created_at ? order.created_at.split('T')[0] : '2026-10-01');
      const endDate = calculateCycleEndDate(startDate);
      const isPaid = (Number(order.amount_paid || 0) >= Number(order.total_agreed_amount || 0) && Number(order.amount_paid || 0) > 0)
        || order.payment_status === 'paid'
        || order.status === 'active';

      return {
        id: `bootstrap_c1_${order.order_id}`,
        client_id: order.client_id,
        order_id: order.order_id,
        cycle_number: 1,
        package: order.plan_name || 'Starter Plan',
        amount: Number(order.total_agreed_amount || order.amount_paid || order.original_amount || 3500),
        delivery_start_date: startDate,
        delivery_end_date: endDate,
        payment_status: isPaid ? 'Paid' : 'Pending',
        notes: 'Initial Onboarding Cycle',
        created_at: order.created_at || new Date().toISOString()
      };
    });
}

/**
 * Fetches all billing cycles for a client or all clients
 */
export async function fetchBillingCycles(clientId = null) {
  let dbCycles = [];

  try {
    let query = supabase.from('billing_cycles').select('*').order('cycle_number', { ascending: true });
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      dbCycles = data;
    }
  } catch (err) {
    console.warn("Notice: billing_cycles database query notice:", err);
  }

  // Merge with cached cycles
  const cached = getCachedCycles();
  const mergedMap = new Map();

  // Add cached cycles
  cached.forEach(c => {
    if (c && c.id) mergedMap.set(String(c.id), c);
  });

  // Add db cycles (higher precedence)
  dbCycles.forEach(c => {
    if (c && c.id) mergedMap.set(String(c.id), c);
  });

  let combined = Array.from(mergedMap.values());

  // If no cycles exist at all yet, auto-bootstrap Cycle 1 from existing orders
  if (combined.length === 0) {
    try {
      let ordQuery = supabase.from('orders').select('*').order('created_at', { ascending: true });
      if (clientId) ordQuery = ordQuery.eq('client_id', clientId);
      const { data: ords } = await ordQuery;
      if (ords && ords.length > 0) {
        const bootstrapped = bootstrapInitialCycles(ords);
        bootstrapped.forEach(b => mergedMap.set(String(b.id), b));
        combined = Array.from(mergedMap.values());
        setCachedCycles(combined);
      }
    } catch (err) {
      console.warn("Notice: bootstrap orders fallback error:", err);
    }
  }

  if (clientId) {
    combined = combined.filter(c => c.client_id === clientId);
  }

  // Sort by cycle_number ascending
  combined.sort((a, b) => (a.cycle_number || 1) - (b.cycle_number || 1));
  setCachedCycles(combined);
  return combined;
}

/**
 * Gets the latest cycle for a client
 */
export function getLatestCycle(cycles = []) {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;
  const sorted = [...cycles].sort((a, b) => (b.cycle_number || 1) - (a.cycle_number || 1));
  return sorted[0];
}

/**
 * Computes renewal status and days left
 * - Renewal due: cycle ends within 5 days or already ended
 * - Active: cycle is running with > 5 days left
 * - Paused: marked as paused
 */
export function computeRenewalStatus(client, latestCycle, latestOrder) {
  // Renewal logic applies to monthly plan clients only. Website projects are one-time.
  if (isWebsiteOrder(latestOrder) && !latestCycle) {
    return { status: 'website_only', label: 'Website Project (One-Time)', daysLeft: null, isDue: false, isOverdue: false };
  }

  if (!client || (!latestCycle && !latestOrder)) {
    return { status: 'lead', label: 'Lead / Onboarding', daysLeft: 0, isDue: false, isOverdue: false };
  }

  if (latestOrder?.status === 'paused') {
    return { status: 'paused', label: 'Paused', daysLeft: 0, isDue: false, isOverdue: false };
  }

  const effectiveEnd = latestCycle?.delivery_end_date || (latestOrder?.first_upload_date ? calculateCycleEndDate(latestOrder.first_upload_date) : null);
  if (!effectiveEnd) {
    return { status: 'active', label: 'Active', daysLeft: 30, isDue: false, isOverdue: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(effectiveEnd);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return {
      status: 'renewal_due',
      label: 'Renewal Due (Ended)',
      daysLeft,
      isDue: true,
      isOverdue: true,
      delivery_end_date: effectiveEnd
    };
  }

  if (daysLeft <= 5) {
    return {
      status: 'renewal_due',
      label: `Renewal Due (${daysLeft}d left)`,
      daysLeft,
      isDue: true,
      isOverdue: false,
      delivery_end_date: effectiveEnd
    };
  }

  return {
    status: 'active',
    label: 'Active',
    daysLeft,
    isDue: false,
    isOverdue: false,
    delivery_end_date: effectiveEnd
  };
}

/**
 * Formats structured payment details for clipboard copy
 */
export function formatPaymentDetailsText({ client, cycle, orderId, amount, packageName, startDate, endDate }) {
  const clientName = client?.name || client?.business_type || 'Valued Client';
  const business = client?.displayBusinessName || client?.business_name || client?.business_type || clientName;
  const cycleNum = cycle?.cycle_number || 2;
  const orderRef = orderId || cycle?.order_id || 'OM-RENEW';

  return `========================================
OUTLIERS MEDIA — PACKAGE RENEWAL DETAILS
========================================
Client: ${clientName}
Business Brand: ${business}
Package: ${packageName} (Cycle #${cycleNum})
Renewal Amount: ₹${Number(amount || 0).toLocaleString()}
Delivery Period: ${startDate} to ${endDate}
Order Reference: ${orderRef}

PAYMENT METHODS:
----------------------------------------
UPI ID: ${UPI_PAYMENT_DETAILS.upiId}
Bank: ICICI Bank (Outliers Media)
Instant QR: Scan QR on Outliers Media Portal

Please share your transaction screenshot or reference ID after payment to begin scheduled deliverables immediately.
========================================`;
}

/**
 * Creates a new client renewal cycle:
 * 1. Saves new cycle in billing_cycles with client's new individual amount
 * 2. Generates content calendar in existing format (startDate to startDate + 1 month)
 * 3. Creates finance entry in the existing 'orders' table with status 'pending'
 * 4. Generates payment details in existing format with copy/download support
 */
export async function createRenewalCycle({
  client,
  currentOrder,
  packageName,
  amount,
  startDate,
  notes = ''
}) {
  if (!client || (!client.auth_id && !client.id)) {
    throw new Error("Client identifier is required.");
  }

  const clientId = client.auth_id || client.id;
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Renewal amount must be a positive number.");
  }

  if (!startDate) {
    throw new Error("Delivery start date is required.");
  }

  const cleanStartDate = String(startDate).split('T')[0];
  const cleanEndDate = calculateCycleEndDate(cleanStartDate);

  // 1. Fetch current cycles to determine next cycle number and prevent duplicates
  const existingCycles = await fetchBillingCycles(clientId);
  const latestCycle = getLatestCycle(existingCycles);

  // Duplicate Check: block duplicate renewals if next cycle already exists for this exact start date
  const isDuplicate = existingCycles.some(c => 
    c.delivery_start_date === cleanStartDate &&
    c.payment_status === 'Pending'
  );

  if (isDuplicate) {
    const dup = existingCycles.find(c => c.delivery_start_date === cleanStartDate);
    return {
      success: false,
      isDuplicate: true,
      message: `A renewal cycle starting on ${cleanStartDate} already exists (Cycle #${dup.cycle_number}).`,
      existingCycle: dup
    };
  }

  const nextCycleNumber = latestCycle ? (latestCycle.cycle_number + 1) : (existingCycles.length + 1);

  // 2. Generate Next OMxxxx Order ID
  let nextOrderNum = 1005;
  try {
    const { data: allOrders } = await supabase
      .from('orders')
      .select('order_id')
      .order('created_at', { ascending: false });

    if (allOrders && allOrders.length > 0) {
      const numbers = allOrders
        .map(o => parseInt((o.order_id || '').replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n));
      if (numbers.length > 0) {
        nextOrderNum = Math.max(...numbers) + 1;
      }
    }
  } catch (err) {
    console.warn("Notice: order_id generation fallback:", err);
  }
  const newOrderId = `OM${nextOrderNum}`;

  // 3. Determine Quotas for the renewed package
  const normPkg = (packageName || 'Starter Plan').toLowerCase();
  const isStarter = normPkg.includes('starter');
  const isGrowth = normPkg.includes('growth');
  const isPremium = normPkg.includes('premium');

  const staticQuota = isStarter ? 12 : (isGrowth ? 15 : 15);
  const reelsQuota = isStarter ? 8 : (isGrowth ? 12 : 12);
  const storiesQuota = 15;
  const postersQuota = 0;
  const hasWebsite = isPremium;

  // 4. Generate Content Calendar in existing format
  const scheduleConfig = {
    business_name: client.displayBusinessName || currentOrder?.business_name || client.name || 'Brand',
    business_type: client.displayBusinessType || currentOrder?.business_type || 'Business',
    instagram_handle: client.displayInstagram || currentOrder?.instagram_handle || '',
    firstUploadDate: cleanStartDate,
    staticPerWeek: isStarter ? 3 : 4,
    staticInterval: 2,
    reelsPerWeek: isStarter ? 2 : 3,
    reelsInterval: 3,
    storiesPerWeek: 4,
    storiesInterval: 2,
    totalStories: storiesQuota,
    cycle_number: nextCycleNumber,
    is_renewal: true
  };

  const generatedSchedule = generateUploadSchedule(
    cleanStartDate,
    packageName,
    staticQuota,
    reelsQuota,
    postersQuota,
    scheduleConfig
  );

  // 5. Initial Installment for this Renewal Cycle
  const renewalInstallments = [
    {
      installment_number: 1,
      amount: numAmount,
      due_date: cleanStartDate,
      status: 'pending',
      paid_at: null,
      payment_id: `TXN-${newOrderId}-C${nextCycleNumber}`,
      notes: `Renewal Cycle #${nextCycleNumber} Retainer`,
      receipt_url: null,
      receipt_urls: []
    }
  ];

  // 6. Create Finance Entry in the existing 'orders' table with status 'pending'
  const newOrderPayload = {
    order_id: newOrderId,
    client_id: clientId,
    plan_name: packageName,
    amount_paid: 0,
    original_amount: numAmount,
    total_agreed_amount: numAmount,
    balance_due: numAmount,
    static_posts_total: staticQuota,
    reels_total: reelsQuota,
    stories_total: storiesQuota,
    posters_total: postersQuota,
    has_website: hasWebsite,
    status: 'pending', // Pending payment
    payment_status: 'pending',
    payment_id: `TXN-${newOrderId}`,
    first_upload_date: cleanStartDate,
    schedule_config: scheduleConfig,
    installments: renewalInstallments,
    business_name: scheduleConfig.business_name,
    business_type: scheduleConfig.business_type,
    instagram_handle: scheduleConfig.instagram_handle,
    created_at: new Date().toISOString()
  };

  let createdOrder = newOrderPayload;
  try {
    const { data: dbOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([newOrderPayload])
      .select()
      .maybeSingle();

    if (!orderErr && dbOrder) {
      createdOrder = dbOrder;
    }
  } catch (err) {
    console.warn("Notice: Supabase orders insert error:", err);
  }

  // 7. Save New Cycle in 'billing_cycles' table
  const newCyclePayload = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bc_${Date.now()}`,
    client_id: clientId,
    order_id: newOrderId,
    cycle_number: nextCycleNumber,
    package: packageName,
    amount: numAmount,
    delivery_start_date: cleanStartDate,
    delivery_end_date: cleanEndDate,
    payment_status: 'Pending',
    notes: notes || `Monthly package renewal for Cycle #${nextCycleNumber}`,
    created_at: new Date().toISOString()
  };

  try {
    const { data: dbCycle, error: cycleErr } = await supabase
      .from('billing_cycles')
      .insert([newCyclePayload])
      .select()
      .maybeSingle();

    if (cycleErr) {
      console.warn("Notice: Supabase billing_cycles insert error:", cycleErr.message);
    }
  } catch (err) {
    console.warn("Notice: billing_cycles database write notice:", err);
  }

  // 8. Update Local Cache
  const updatedCycles = [...existingCycles, newCyclePayload];
  setCachedCycles(updatedCycles);

  // 9. Format Payment Details
  const paymentDetailsText = formatPaymentDetailsText({
    client,
    cycle: newCyclePayload,
    orderId: newOrderId,
    amount: numAmount,
    packageName,
    startDate: cleanStartDate,
    endDate: cleanEndDate
  });

  // 10. Broadcast Sync Event
  broadcastRenewalSync({
    client,
    newCycle: newCyclePayload,
    newOrder: createdOrder
  });

  return {
    success: true,
    cycle: newCyclePayload,
    order: createdOrder,
    schedule: generatedSchedule,
    paymentDetailsText,
    upi: UPI_PAYMENT_DETAILS
  };
}

/**
 * Marks a billing cycle and its associated order as 'Paid'
 */
export async function markCyclePaid(cycleId, orderId) {
  if (!cycleId && !orderId) return { success: false, error: "Missing identifier" };

  // 1. Update billing_cycles
  try {
    if (cycleId) {
      await supabase
        .from('billing_cycles')
        .update({ payment_status: 'Paid', updated_at: new Date().toISOString() })
        .eq('id', cycleId);
    } else if (orderId) {
      await supabase
        .from('billing_cycles')
        .update({ payment_status: 'Paid', updated_at: new Date().toISOString() })
        .eq('order_id', orderId);
    }
  } catch (err) {
    console.warn("Notice: billing_cycles update error:", err);
  }

  // 2. Update orders table (single source of truth for finances)
  if (orderId) {
    try {
      // Fetch order first to get amount
      const { data: ord } = await supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle();
      const amount = ord ? Number(ord.total_agreed_amount || ord.original_amount || 0) : 0;
      
      const installments = (ord && Array.isArray(ord.installments)) ? ord.installments.map(i => ({
        ...i,
        status: 'paid',
        paid_at: new Date().toISOString()
      })) : [];

      await supabase
        .from('orders')
        .update({
          status: 'active',
          payment_status: 'paid',
          amount_paid: amount,
          balance_due: 0,
          installments: installments
        })
        .eq('order_id', orderId);
    } catch (err) {
      console.warn("Notice: orders payment update error:", err);
    }
  }

  // 3. Update local cache
  const cached = getCachedCycles();
  const updated = cached.map(c => {
    if ((cycleId && c.id === cycleId) || (orderId && c.order_id === orderId)) {
      return { ...c, payment_status: 'Paid' };
    }
    return c;
  });
  setCachedCycles(updated);

  broadcastRenewalSync({ cycleId, orderId, payment_status: 'Paid' });
  return { success: true };
}

/**
 * Marks a client / order as Paused
 */
export async function markClientPaused(orderId, clientId) {
  if (!orderId && !clientId) return { success: false, error: "Missing identifier" };

  try {
    let query = supabase.from('orders').update({ status: 'paused' });
    if (orderId) query = query.eq('order_id', orderId);
    else query = query.eq('client_id', clientId);
    await query;
  } catch (err) {
    console.warn("Notice: orders pause update error:", err);
  }

  broadcastRenewalSync({ orderId, clientId, status: 'paused' });
  return { success: true };
}
