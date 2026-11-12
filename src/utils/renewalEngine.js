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

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Extracts a clean Supabase auth UUID from synthetic multi-business client objects
 * (where AdminClients overrides auth_id as `${real_auth_id}_${order_id}`).
 */
export function resolveClientUuid(client = null, order = null, cycle = null) {
  const candidates = [
    client?.real_auth_id,
    order?.client_id,
    cycle?.client_id,
    client?.auth_id,
    client?.id
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = trimmed.match(UUID_REGEX);
    if (match) return match[0];
  }

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const cleaned = raw.trim().replace(/_OM\d+$/i, '');
    if (cleaned) return cleaned;
  }

  return null;
}

const OPTIONAL_ORDER_COLUMNS = [
  'original_amount',
  'payment_receipt_url',
  'grace_period_days',
  'business_name',
  'business_type',
  'instagram_handle',
  'has_website',
  'posters_total',
  'total_agreed_amount',
  'balance_due',
  'installments'
];

/**
 * Writes to the 'orders' table while automatically stripping any optional columns
 * not yet migrated in the live Supabase schema so renewals never fail on optional fields.
 */
async function safeOrderWrite(mode, payload, matchCol = null, matchVal = null) {
  const currentPayload = { ...payload };

  for (let attempt = 0; attempt < 8; attempt++) {
    const query = mode === 'insert'
      ? supabase.from('orders').insert([currentPayload]).select().maybeSingle()
      : supabase.from('orders').update(currentPayload).eq(matchCol, matchVal).select().maybeSingle();

    const { data, error } = await query;
    if (!error) {
      return { data };
    }

    const msg = String(error.message || '');
    const missingColMatch =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "([^"]+)" of relation "orders" does not exist/i) ||
      msg.match(/column orders\.([a-zA-Z0-9_]+) does not exist/i);

    if (missingColMatch && missingColMatch[1] && Object.prototype.hasOwnProperty.call(currentPayload, missingColMatch[1])) {
      delete currentPayload[missingColMatch[1]];
      continue;
    }

    const matchedOptional = OPTIONAL_ORDER_COLUMNS.filter(col =>
      Object.prototype.hasOwnProperty.call(currentPayload, col) &&
      msg.toLowerCase().includes(col.toLowerCase())
    );
    if (matchedOptional.length > 0) {
      matchedOptional.forEach(col => delete currentPayload[col]);
      continue;
    }

    throw new Error(
      mode === 'insert'
        ? `Could not create finance entry in orders: ${error.message}`
        : `Could not update linked order & finance record: ${error.message}`
    );
  }

  throw new Error(
    mode === 'insert'
      ? 'Could not create finance entry in orders after schema compatibility retries.'
      : 'Could not update linked order & finance record after schema compatibility retries.'
  );
}

/**
 * Bootstraps initial cycle entries from existing social orders if not already tracked in billing_cycles
 */
export function bootstrapInitialCycles(ordersList = []) {
  if (!Array.isArray(ordersList)) return [];

  return ordersList
    .filter(order => order && order.client_id && order.order_id && !isWebsiteOrder(order))
    .map((order) => {
      const cycleNumber = Number(order.schedule_config?.cycle_number || 1);
      const startDate = order.first_upload_date
        ? order.first_upload_date.split('T')[0]
        : (order.created_at ? order.created_at.split('T')[0] : '2026-10-01');
      const endDate = calculateCycleEndDate(startDate);
      const agreed = Number(order.total_agreed_amount || order.original_amount || order.amount_paid || 0);
      const paidAmt = Number(order.amount_paid || 0);
      const hasExplicitUnpaid = ['pending', 'partial', 'pending_verification'].includes(order.payment_status);
      const isPaid =
        order.payment_status === 'paid' ||
        (agreed > 0 && paidAmt >= agreed) ||
        (cycleNumber === 1 && order.status === 'active' && !hasExplicitUnpaid);

      return {
        id: `bootstrap_c${cycleNumber}_${order.order_id}`,
        client_id: order.client_id,
        order_id: order.order_id,
        cycle_number: cycleNumber,
        package: order.plan_name || 'Starter Plan',
        amount: Number(order.total_agreed_amount || order.original_amount || order.amount_paid || 3500),
        delivery_start_date: startDate,
        delivery_end_date: endDate,
        payment_status: isPaid ? 'Paid' : 'Pending',
        notes: cycleNumber > 1 ? `Monthly package renewal for Cycle #${cycleNumber}` : 'Initial Onboarding Cycle',
        created_at: order.created_at || new Date().toISOString()
      };
    });
}

function getCycleDedupeKey(cycle) {
  if (!cycle) return '';
  if (cycle.order_id) {
    return `ord:${cycle.order_id}:c${cycle.cycle_number || 1}`;
  }
  return `id:${cycle.id}`;
}

/**
 * Fetches all billing cycles for a client or all clients
 */
export async function fetchBillingCycles(clientId = null) {
  const resolvedClientId = clientId ? resolveClientUuid({ auth_id: clientId }) : null;
  let dbCycles = [];
  let dbQuerySucceeded = false;

  try {
    let query = supabase.from('billing_cycles').select('*').order('cycle_number', { ascending: true });
    if (resolvedClientId) {
      query = query.eq('client_id', resolvedClientId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      dbCycles = data;
      dbQuerySucceeded = true;
    }
  } catch (err) {
    console.warn("Notice: billing_cycles database query notice:", err);
  }

  // Merge DB cycles with cache only when DB query could not complete; when Supabase succeeds,
  // rely on live DB rows + missing orders backfill so deleted/orphaned localStorage entries never resurrect.
  const cached = getCachedCycles();
  const mergedMap = new Map();

  if (!dbQuerySucceeded) {
    cached.forEach(c => {
      if (!c || !c.id) return;
      if (/_OM\d+$/i.test(String(c.client_id || ''))) return;
      if (resolvedClientId && c.client_id !== resolvedClientId) return;
      mergedMap.set(getCycleDedupeKey(c), c);
    });
  }

  dbCycles.forEach(c => {
    if (!c || !c.id) return;
    mergedMap.set(getCycleDedupeKey(c), c);
  });

  // Backfill any social orders that do not yet have a cycle entry (even when later renewals already exist in DB)
  try {
    let ordQuery = supabase.from('orders').select('*').order('created_at', { ascending: true });
    if (resolvedClientId) ordQuery = ordQuery.eq('client_id', resolvedClientId);
    const { data: ords } = await ordQuery;
    if (ords && ords.length > 0) {
      const coveredOrderIds = new Set(
        Array.from(mergedMap.values()).map(c => c.order_id).filter(Boolean)
      );
      const missingOrders = ords.filter(o => o && o.order_id && !coveredOrderIds.has(o.order_id));
      if (missingOrders.length > 0) {
        const bootstrapped = bootstrapInitialCycles(missingOrders);
        bootstrapped.forEach(b => mergedMap.set(getCycleDedupeKey(b), b));
      }
    }
  } catch (err) {
    console.warn("Notice: bootstrap orders fallback error:", err);
  }

  let combined = Array.from(mergedMap.values());

  if (resolvedClientId) {
    combined = combined.filter(c => c.client_id === resolvedClientId);
  }

  combined.sort((a, b) => (a.cycle_number || 1) - (b.cycle_number || 1));

  // Preserve other clients' cached cycles when fetching for a single client
  if (resolvedClientId) {
    const others = cached.filter(c => c && c.client_id !== resolvedClientId && !/_OM\d+$/i.test(String(c.client_id || '')));
    setCachedCycles([...others, ...combined]);
  } else {
    setCachedCycles(combined);
  }

  return combined;
}

/**
 * Gets the latest cycle for a client
 */
export function getOrderBusinessKey(order, fallbackBusiness = 'Main Brand') {
  const raw =
    order?.business_name ||
    order?.schedule_config?.business_name ||
    order?.business_type ||
    order?.schedule_config?.business_type ||
    fallbackBusiness ||
    'Main Brand';
  return String(raw).trim().toLowerCase() || 'main brand';
}

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

export function getPlanDefaultQuotas(packageName = 'Starter Plan') {
  const norm = (packageName || 'Starter Plan').toLowerCase();
  if (norm.includes('premium')) {
    return {
      staticPosts: 15,
      reels: 12,
      stories: 15,
      posters: 0,
      hasWebsite: true,
      defaultPrice: 8000
    };
  }
  if (norm.includes('growth')) {
    return {
      staticPosts: 15,
      reels: 12,
      stories: 15,
      posters: 0,
      hasWebsite: false,
      defaultPrice: 6000
    };
  }
  return {
    staticPosts: 12,
    reels: 8,
    stories: 15,
    posters: 0,
    hasWebsite: false,
    defaultPrice: 3500
  };
}

export function formatPaymentStructureLabel(paymentMode = 'full', installments = []) {
  if (paymentMode === 'emi_2') return '2x EMIs (50% / 50%)';
  if (paymentMode === 'emi_3') return '3x EMIs (40% / 30% / 30%)';
  if (paymentMode === 'custom') {
    const count = Array.isArray(installments) ? installments.length : 0;
    return count > 1 ? `Custom EMI (${count} Milestones)` : 'Custom Single Payment';
  }
  return 'Full Payment (1x)';
}

/**
 * Formats structured payment details for clipboard copy
 */
export function formatPaymentDetailsText({
  client,
  cycle,
  orderId,
  amount,
  packageName,
  startDate,
  endDate,
  paymentMode = 'full',
  paymentChannel = 'UPI',
  paymentRef = '',
  installments = [],
  deliverables = null,
  uploadedReceiptUrls = []
}) {
  const clientName = client?.name || client?.business_type || 'Valued Client';
  const business = client?.displayBusinessName || client?.business_name || client?.business_type || clientName;
  const cycleNum = cycle?.cycle_number || 2;
  const orderRef = orderId || cycle?.order_id || 'OM-RENEW';
  const structureLabel = formatPaymentStructureLabel(paymentMode, installments);

  const paidSoFar = Array.isArray(installments)
    ? installments.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    : 0;
  const balanceRemaining = Math.max(0, Number(amount || 0) - paidSoFar);

  const deliverablesLine = deliverables
    ? `\nDeliverables: ${deliverables.staticPosts ?? 0} Static Posts • ${deliverables.reels ?? 0} Reels • ${deliverables.stories ?? 0} Stories${Number(deliverables.posters || 0) > 0 ? ` • ${deliverables.posters} Posters` : ''}${deliverables.hasWebsite ? ' + Website/SEO' : ''}`
    : '';

  const milestoneLines = Array.isArray(installments) && installments.length > 1
    ? '\n\nEMI / MILESTONE SCHEDULE:\n----------------------------------------\n' +
      installments.map((inst, idx) => {
        const st = inst.status === 'paid' ? 'PAID' : (inst.status === 'pending_verification' ? 'IN REVIEW' : 'PENDING');
        return `EMI #${inst.installment_number || idx + 1}: ₹${Number(inst.amount || 0).toLocaleString()} • Due ${inst.due_date || startDate} • [${st}]${inst.notes ? ` (${inst.notes})` : ''}`;
      }).join('\n')
    : '';

  const refLine = paymentRef ? `\nTransaction / UTR Ref: ${paymentRef}` : '';
  const proofLine = uploadedReceiptUrls.length > 0
    ? `\nPayment Proof Attached: ${uploadedReceiptUrls.length} screenshot(s) uploaded`
    : '';

  return `========================================
OUTLIERS MEDIA — PACKAGE RENEWAL DETAILS
========================================
Client: ${clientName}
Business Brand: ${business}
Package: ${packageName} (Cycle #${cycleNum})
Renewal Amount: ₹${Number(amount || 0).toLocaleString()}
Payment Plan: ${structureLabel} (${paymentChannel})
Paid So Far: ₹${paidSoFar.toLocaleString()} | Balance Due: ₹${balanceRemaining.toLocaleString()}
Delivery Period: ${startDate} to ${endDate}
Order Reference: ${orderRef}${deliverablesLine}${refLine}${proofLine}${milestoneLines}

PAYMENT METHODS:
----------------------------------------
UPI ID: ${UPI_PAYMENT_DETAILS.upiId}
Bank: ICICI Bank (Outliers Media)
Instant QR: Scan QR on Outliers Media Portal

Please share your transaction screenshot or reference ID after payment to begin scheduled deliverables immediately.
========================================`;
}

/**
 * Resolves and validates custom or default deliverable quotas for a cycle.
 */
function resolveDeliverableQuotas(packageName, deliverables = null) {
  const defaults = getPlanDefaultQuotas(packageName);
  const staticQuota = Math.max(0, Number.isFinite(Number(deliverables?.staticPosts))
    ? parseInt(deliverables.staticPosts, 10)
    : defaults.staticPosts);
  const reelsQuota = Math.max(0, Number.isFinite(Number(deliverables?.reels))
    ? parseInt(deliverables.reels, 10)
    : defaults.reels);
  const storiesQuota = Math.max(0, Number.isFinite(Number(deliverables?.stories))
    ? parseInt(deliverables.stories, 10)
    : defaults.stories);
  const postersQuota = Math.max(0, Number.isFinite(Number(deliverables?.posters))
    ? parseInt(deliverables.posters, 10)
    : defaults.posters);
  const hasWebsite = deliverables?.hasWebsite !== undefined
    ? Boolean(deliverables.hasWebsite)
    : defaults.hasWebsite;

  if (staticQuota + reelsQuota + storiesQuota + postersQuota === 0 && !hasWebsite) {
    throw new Error("Please include at least 1 deliverable (or enable Website support) for this renewal.");
  }

  return { staticQuota, reelsQuota, storiesQuota, postersQuota, hasWebsite };
}

/**
 * Merges retained receipt URLs and uploads new receipt files to Supabase storage.
 */
async function uploadRenewalReceipts({ orderId, cycleNumber, receiptFiles = [], existingUrls = [] }) {
  const uploadedReceiptUrls = Array.isArray(existingUrls)
    ? [...new Set(existingUrls.filter(Boolean))]
    : [];

  if (Array.isArray(receiptFiles) && receiptFiles.length > 0) {
    for (let i = 0; i < receiptFiles.length; i++) {
      const entry = receiptFiles[i];
      const fileObj = entry?.file || entry;
      if (!fileObj || typeof fileObj.name !== 'string') continue;

      const ext = fileObj.name.split('.').pop() || 'png';
      const fileName = `receipt_${orderId}_C${cycleNumber}_${Date.now()}_${i}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileObj, { upsert: true });

      if (uploadErr) {
        throw new Error(`Failed to upload payment screenshot (${fileObj.name}): ${uploadErr.message}`);
      }

      const { data: pubData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      if (pubData?.publicUrl && !uploadedReceiptUrls.includes(pubData.publicUrl)) {
        uploadedReceiptUrls.push(pubData.publicUrl);
      }
    }
  }

  return uploadedReceiptUrls;
}

/**
 * Normalizes EMI / Full payment milestones and derives billing + order statuses.
 */
function buildRenewalPaymentState({
  orderId,
  cycleNumber,
  amount,
  startDate,
  paymentDetails = null,
  uploadedReceiptUrls = [],
  pruneRemovedReceipts = false,
  isAdminRenewal = true,
  existingOrderStatus = null
}) {
  const paymentMode = paymentDetails?.paymentMode || 'full';
  const paymentChannel = paymentDetails?.paymentChannel || 'UPI';
  const paymentRef = (paymentDetails?.paymentRef || '').trim();
  const gracePeriodDays = Math.max(1, parseInt(paymentDetails?.gracePeriodDays, 10) || 3);
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cleanStartDate = String(startDate).split('T')[0];
  const defaultPendingDueDate = cleanStartDate >= todayStr ? cleanStartDate : todayStr;
  const primaryReceiptUrl = uploadedReceiptUrls.length > 0 ? uploadedReceiptUrls[0] : null;

  let renewalInstallments = [];
  if (Array.isArray(paymentDetails?.installments) && paymentDetails.installments.length > 0) {
    const milestoneSum = paymentDetails.installments.reduce((s, m) => s + Number(m.amount || 0), 0);
    if (Math.abs(milestoneSum - amount) > 1) {
      throw new Error(
        `EMI milestone amounts (₹${milestoneSum.toLocaleString()}) must equal the renewal amount (₹${amount.toLocaleString()}).`
      );
    }

    const firstPaidIdx = paymentDetails.installments.findIndex(
      m => m.status === 'paid' || m.status === 'pending_verification'
    );
    const proofTargetIdx = firstPaidIdx >= 0 ? firstPaidIdx : 0;

    renewalInstallments = paymentDetails.installments.map((inst, idx) => {
      const st = ['paid', 'pending_verification', 'pending'].includes(inst.status) ? inst.status : 'pending';
      const attachProof = idx === proofTargetIdx && uploadedReceiptUrls.length > 0;
      const rawInstReceipts = Array.isArray(inst.receipt_urls) ? inst.receipt_urls.filter(Boolean) : [];
      const existingInstReceipts = pruneRemovedReceipts
        ? rawInstReceipts.filter(u => uploadedReceiptUrls.includes(u))
        : rawInstReceipts;

      const instReceipts = attachProof
        ? [...new Set([...existingInstReceipts, ...uploadedReceiptUrls])]
        : existingInstReceipts;

      const keptSingleUrl = inst.receipt_url && (!pruneRemovedReceipts || uploadedReceiptUrls.includes(inst.receipt_url))
        ? inst.receipt_url
        : null;

      return {
        installment_number: idx + 1,
        amount: Math.max(0, Number(inst.amount || 0)),
        due_date: inst.due_date || defaultPendingDueDate,
        status: st,
        paid_at: st === 'paid' ? (inst.paid_at || nowIso) : null,
        payment_id: (inst.payment_id || '').trim() || (idx === 0 && paymentRef ? paymentRef : `TXN-${orderId}-C${cycleNumber}-${idx + 1}`),
        notes: (inst.notes || '').trim() || (
          paymentDetails.installments.length > 1
            ? `Cycle #${cycleNumber} EMI #${idx + 1} (${paymentChannel})`
            : `Cycle #${cycleNumber} Full Payment (${paymentChannel})`
        ),
        receipt_url: attachProof ? primaryReceiptUrl : (instReceipts[0] || keptSingleUrl),
        receipt_urls: instReceipts
      };
    });
  } else {
    const initStatus = ['paid', 'pending_verification', 'pending'].includes(paymentDetails?.initialStatus)
      ? paymentDetails.initialStatus
      : 'pending';

    renewalInstallments = [
      {
        installment_number: 1,
        amount,
        due_date: initStatus === 'pending' ? defaultPendingDueDate : cleanStartDate,
        status: initStatus,
        paid_at: initStatus === 'paid' ? nowIso : null,
        payment_id: paymentRef || `TXN-${orderId}-C${cycleNumber}`,
        notes: `Cycle #${cycleNumber} Full Payment (${paymentChannel})`,
        receipt_url: primaryReceiptUrl,
        receipt_urls: uploadedReceiptUrls
      }
    ];
  }

  const paidAmount = renewalInstallments
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const balanceDue = Math.max(0, amount - paidAmount);
  const hasPendingVerification = renewalInstallments.some(i => i.status === 'pending_verification');
  const isFullyPaid = balanceDue <= 0;
  const resolvedOrderStatus = existingOrderStatus === 'cancelled'
    ? 'cancelled'
    : (isAdminRenewal || paidAmount > 0 ? 'active' : 'pending');

  return {
    nowIso,
    paymentMode,
    paymentChannel,
    paymentRef,
    gracePeriodDays,
    primaryReceiptUrl,
    renewalInstallments,
    paidAmount,
    balanceDue,
    hasPendingVerification,
    isFullyPaid,
    orderStatus: resolvedOrderStatus,
    orderPaymentStatus: isFullyPaid
      ? 'paid'
      : (paidAmount > 0 ? 'partial' : (hasPendingVerification ? 'pending_verification' : 'pending')),
    cyclePaymentStatus: isFullyPaid ? 'Paid' : 'Pending',
    paymentStructureLabel: formatPaymentStructureLabel(paymentMode, renewalInstallments)
  };
}

/**
 * Merges schedule_config metadata and generates the exact content calendar slots.
 */
function buildCycleScheduleAndConfig({
  client,
  baseOrder,
  existingScheduleConfig = null,
  cycleNumber,
  packageName,
  startDate,
  quotas,
  paymentState,
  uploadedReceiptUrls,
  isNewRenewal = false
}) {
  const normPkg = (packageName || 'Starter Plan').toLowerCase();
  const isStarter = normPkg.includes('starter');
  const baseCfg = existingScheduleConfig && typeof existingScheduleConfig === 'object' ? existingScheduleConfig : {};

  const scheduleConfig = {
    ...baseCfg,
    business_name: client?.displayBusinessName || baseOrder?.business_name || baseCfg.business_name || client?.business_type || client?.name || 'Brand',
    business_type: client?.displayBusinessType || baseOrder?.business_type || baseCfg.business_type || 'Business',
    instagram_handle: client?.displayInstagram || baseOrder?.instagram_handle || baseCfg.instagram_handle || '',
    firstUploadDate: startDate,
    staticPerWeek: Math.max(0, Math.round(quotas.staticQuota / 4)) || (isStarter ? 3 : 4),
    staticInterval: baseCfg.staticInterval || 2,
    reelsPerWeek: Math.max(0, Math.round(quotas.reelsQuota / 4)) || (isStarter ? 2 : 3),
    reelsInterval: baseCfg.reelsInterval || 3,
    storiesPerWeek: Math.max(0, Math.round(quotas.storiesQuota / 4)) || 4,
    storiesInterval: baseCfg.storiesInterval || 2,
    totalStatic: quotas.staticQuota,
    totalReels: quotas.reelsQuota,
    totalStories: quotas.storiesQuota,
    totalPosters: quotas.postersQuota,
    custom_deliverables: true,
    useExactQuotas: true,
    cycle_number: cycleNumber,
    is_renewal: baseCfg.is_renewal !== undefined ? baseCfg.is_renewal : (isNewRenewal || cycleNumber > 1),
    payment_mode: paymentState.paymentMode,
    payment_mode_label: paymentState.paymentStructureLabel,
    payment_channel: paymentState.paymentChannel,
    payment_reference: paymentState.paymentRef || null,
    receipt_urls: uploadedReceiptUrls,
    installments: paymentState.renewalInstallments
  };

  const generatedSchedule = generateUploadSchedule(
    startDate,
    packageName,
    quotas.staticQuota,
    quotas.reelsQuota,
    quotas.postersQuota,
    scheduleConfig
  );

  return { scheduleConfig, generatedSchedule };
}

function upsertCachedCycles(entries = []) {
  const existing = getCachedCycles();
  const map = new Map();
  existing.forEach(c => {
    if (c && c.id) map.set(getCycleDedupeKey(c), c);
  });
  entries.forEach(c => {
    if (c && c.id) map.set(getCycleDedupeKey(c), c);
  });
  setCachedCycles(Array.from(map.values()));
}

/**
 * Formats compact cycle notes summary stored on billing_cycles.
 */
function formatCycleNotesSummary({ notes, paymentStructureLabel, paymentChannel, quotas, receiptCount, fallback }) {
  const parts = [
    notes?.trim(),
    `${paymentStructureLabel} • ${paymentChannel}`,
    `${quotas.staticQuota}S/${quotas.reelsQuota}R/${quotas.storiesQuota}St${quotas.postersQuota > 0 ? `/${quotas.postersQuota}P` : ''}`,
    receiptCount > 0 ? `${receiptCount} screenshot(s)` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : fallback;
}

/**
 * Creates a new client renewal cycle:
 * 1. Saves new cycle in billing_cycles with client's new individual amount
 * 2. Generates content calendar in existing format (startDate to startDate + 1 month)
 * 3. Creates finance entry in the existing 'orders' table with EMI / receipt metadata
 * 4. Generates payment details in existing format with copy support
 */
export async function createRenewalCycle({
  client,
  currentOrder,
  packageName,
  amount,
  startDate,
  notes = '',
  deliverables = null,
  paymentDetails = null,
  receiptFiles = []
}) {
  const clientId = resolveClientUuid(client, currentOrder);
  if (!client || !clientId) {
    throw new Error("Client identifier is required.");
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Renewal amount must be a positive number.");
  }

  if (!startDate) {
    throw new Error("Delivery start date is required.");
  }

  const cleanStartDate = String(startDate).split('T')[0];
  const cleanEndDate = calculateCycleEndDate(cleanStartDate);

  // 1. Fetch live orders & billing cycles to check duplicates, resolve next order_id, and detect orphaned cycles
  let allOrders = [];
  try {
    const { data: ordData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (Array.isArray(ordData)) allOrders = ordData;
  } catch (err) {
    console.warn("Notice: order lookup during renewal:", err);
  }

  const clientOrders = allOrders.filter(o => o && o.client_id === clientId && !isWebsiteOrder(o));
  const clientOrdersByOrderId = new Map(clientOrders.map(o => [o.order_id, o]));
  const targetBusinessKey = currentOrder
    ? getOrderBusinessKey(currentOrder, client?.business_type || 'Main Brand')
    : null;
  const sameBusinessOrderIds = targetBusinessKey
    ? new Set(
        clientOrders
          .filter(o => getOrderBusinessKey(o, client?.business_type || 'Main Brand') === targetBusinessKey)
          .map(o => o.order_id)
      )
    : new Set();

  const existingCycles = await fetchBillingCycles(clientId);
  const sameStartPendingCycles = existingCycles.filter(c =>
    c.delivery_start_date === cleanStartDate &&
    c.payment_status === 'Pending'
  );

  // Only treat a same-start Pending cycle as a blocking duplicate when it actually backs an order for this business
  const blockingDup = sameStartPendingCycles.find(c => {
    if (!c.order_id) return true;
    const hasBackedOrder = clientOrdersByOrderId.has(c.order_id);
    if (!hasBackedOrder) return false;
    return !targetBusinessKey || sameBusinessOrderIds.size === 0 || sameBusinessOrderIds.has(c.order_id);
  });

  if (blockingDup) {
    const dupOrder = blockingDup.order_id ? clientOrdersByOrderId.get(blockingDup.order_id) : currentOrder;
    return {
      success: false,
      isDuplicate: true,
      message: `A renewal cycle starting on ${cleanStartDate} already exists (Cycle #${blockingDup.cycle_number}${dupOrder?.order_id ? ` • ${dupOrder.order_id}` : ''}).`,
      existingCycle: blockingDup,
      existingOrder: dupOrder || null
    };
  }

  // Recover an orphaned billing_cycles row (saved without a backing order) instead of failing
  const orphanedDup = sameStartPendingCycles.find(c => c.order_id && !clientOrdersByOrderId.has(c.order_id)) || null;

  const validCyclesForCount = existingCycles.filter(c => !orphanedDup || c.id !== orphanedDup.id);
  const maxExistingCycleNum = validCyclesForCount.reduce(
    (maxNum, c) => Math.max(maxNum, Number(c.cycle_number || 1)),
    clientOrders.length > 0 ? 1 : 0
  );
  const nextCycleNumber = maxExistingCycleNum + 1;

  // 2. Generate Next OMxxxx Order ID
  let nextOrderNum = 1005;
  if (allOrders.length > 0) {
    const numbers = allOrders
      .map(o => parseInt((o.order_id || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    if (numbers.length > 0) {
      nextOrderNum = Math.max(...numbers) + 1;
    }
  }
  const newOrderId = `OM${nextOrderNum}`;

  // 3. Quotas, Receipt Upload, Payment Milestones & Content Calendar
  const quotas = resolveDeliverableQuotas(packageName, deliverables);
  const uploadedReceiptUrls = await uploadRenewalReceipts({
    orderId: newOrderId,
    cycleNumber: nextCycleNumber,
    receiptFiles,
    existingUrls: paymentDetails?.existingReceiptUrls || []
  });
  const paymentState = buildRenewalPaymentState({
    orderId: newOrderId,
    cycleNumber: nextCycleNumber,
    amount: numAmount,
    startDate: cleanStartDate,
    paymentDetails,
    uploadedReceiptUrls,
    isAdminRenewal: true
  });
  const { scheduleConfig, generatedSchedule } = buildCycleScheduleAndConfig({
    client,
    baseOrder: currentOrder,
    cycleNumber: nextCycleNumber,
    packageName,
    startDate: cleanStartDate,
    quotas,
    paymentState,
    uploadedReceiptUrls,
    isNewRenewal: true
  });

  // 4. Create Finance Entry in the existing 'orders' table
  const newOrderPayload = {
    order_id: newOrderId,
    client_id: clientId,
    plan_name: packageName,
    amount_paid: paymentState.paidAmount,
    original_amount: numAmount,
    total_agreed_amount: numAmount,
    balance_due: paymentState.balanceDue,
    static_posts_total: quotas.staticQuota,
    reels_total: quotas.reelsQuota,
    stories_total: quotas.storiesQuota,
    posters_total: quotas.postersQuota,
    has_website: quotas.hasWebsite,
    status: paymentState.orderStatus,
    payment_status: paymentState.orderPaymentStatus,
    payment_id: paymentState.paymentRef || `TXN-${newOrderId}`,
    payment_receipt_url: paymentState.primaryReceiptUrl,
    grace_period_days: paymentState.gracePeriodDays,
    first_upload_date: cleanStartDate,
    schedule_config: scheduleConfig,
    installments: paymentState.renewalInstallments,
    business_name: scheduleConfig.business_name,
    business_type: scheduleConfig.business_type,
    instagram_handle: scheduleConfig.instagram_handle,
    created_at: paymentState.nowIso
  };

  let createdOrder = newOrderPayload;
  try {
    const { data: dbOrder } = await safeOrderWrite('insert', newOrderPayload);
    if (dbOrder) {
      createdOrder = dbOrder;
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Could not save renewal order.');
  }

  // 5. Save New Cycle in 'billing_cycles' table
  const cycleNotesSummary = formatCycleNotesSummary({
    notes,
    paymentStructureLabel: paymentState.paymentStructureLabel,
    paymentChannel: paymentState.paymentChannel,
    quotas,
    receiptCount: uploadedReceiptUrls.length,
    fallback: `Monthly package renewal for Cycle #${nextCycleNumber}`
  });

  const newCyclePayload = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bc_${Date.now()}`,
    client_id: clientId,
    order_id: newOrderId,
    cycle_number: nextCycleNumber,
    package: packageName,
    amount: numAmount,
    delivery_start_date: cleanStartDate,
    delivery_end_date: cleanEndDate,
    payment_status: paymentState.cyclePaymentStatus,
    notes: cycleNotesSummary,
    created_at: paymentState.nowIso
  };

  try {
    if (orphanedDup && orphanedDup.id && !String(orphanedDup.id).startsWith('bootstrap_')) {
      const { data: updatedOrphan, error: orphanErr } = await supabase
        .from('billing_cycles')
        .update({
          order_id: newOrderId,
          cycle_number: nextCycleNumber,
          package: packageName,
          amount: numAmount,
          delivery_start_date: cleanStartDate,
          delivery_end_date: cleanEndDate,
          payment_status: paymentState.cyclePaymentStatus,
          notes: cycleNotesSummary,
          updated_at: paymentState.nowIso
        })
        .eq('id', orphanedDup.id)
        .select()
        .maybeSingle();

      if (orphanErr) {
        console.warn("Notice: Supabase orphaned billing_cycles repair error:", orphanErr.message);
      } else if (updatedOrphan) {
        newCyclePayload.id = updatedOrphan.id;
      }
    } else {
      const { data: dbCycle, error: cycleErr } = await supabase
        .from('billing_cycles')
        .insert([newCyclePayload])
        .select()
        .maybeSingle();

      if (cycleErr) {
        console.warn("Notice: Supabase billing_cycles insert error:", cycleErr.message);
      } else if (dbCycle) {
        newCyclePayload.id = dbCycle.id;
      }
    }
  } catch (err) {
    console.warn("Notice: billing_cycles database write notice:", err);
  }

  // 6. Update Local Cache & Format Payment Details
  upsertCachedCycles([...validCyclesForCount, newCyclePayload]);

  const paymentDetailsText = formatPaymentDetailsText({
    client,
    cycle: newCyclePayload,
    orderId: newOrderId,
    amount: numAmount,
    packageName,
    startDate: cleanStartDate,
    endDate: cleanEndDate,
    paymentMode: paymentState.paymentMode,
    paymentChannel: paymentState.paymentChannel,
    paymentRef: paymentState.paymentRef,
    installments: paymentState.renewalInstallments,
    deliverables: {
      staticPosts: quotas.staticQuota,
      reels: quotas.reelsQuota,
      stories: quotas.storiesQuota,
      posters: quotas.postersQuota,
      hasWebsite: quotas.hasWebsite
    },
    uploadedReceiptUrls
  });

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
    uploadedReceiptUrls,
    paymentSummary: {
      paymentMode: paymentState.paymentMode,
      paymentStructureLabel: paymentState.paymentStructureLabel,
      paymentChannel: paymentState.paymentChannel,
      paymentRef: paymentState.paymentRef,
      paidAmount: paymentState.paidAmount,
      balanceDue: paymentState.balanceDue,
      isFullyPaid: paymentState.isFullyPaid,
      hasPendingVerification: paymentState.hasPendingVerification,
      installments: paymentState.renewalInstallments
    },
    upi: UPI_PAYMENT_DETAILS
  };
}

/**
 * Updates an existing billing cycle (and its linked order, schedule, payment/EMI structure,
 * deliverables, dates, and receipt screenshots) across both billing_cycles and orders.
 */
export async function updateRenewalCycle({
  client,
  cycle,
  order = null,
  packageName,
  amount,
  startDate,
  endDate = null,
  notes = '',
  deliverables = null,
  paymentDetails = null,
  receiptFiles = [],
  savedReceiptUrls = null
}) {
  const clientId = resolveClientUuid(client, order, cycle);
  if (!clientId) {
    throw new Error("Client identifier is required to edit this cycle.");
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Total plan cost must be a positive number.");
  }

  if (!startDate) {
    throw new Error("Delivery start date is required.");
  }

  const cleanStartDate = String(startDate).split('T')[0];
  const cleanEndDate = endDate ? String(endDate).split('T')[0] : calculateCycleEndDate(cleanStartDate);
  if (cleanEndDate < cleanStartDate) {
    throw new Error("Delivery end date cannot be earlier than the delivery start date.");
  }

  const resolvedOrderId = order?.order_id || cycle?.order_id || null;
  let baseOrder = order || null;

  if (resolvedOrderId && (!baseOrder || baseOrder.schedule_config === undefined)) {
    try {
      const { data: liveOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', resolvedOrderId)
        .maybeSingle();
      if (liveOrder) baseOrder = liveOrder;
    } catch (err) {
      console.warn("Notice: lookup order for edit failed:", err);
    }
  }

  const existingCycles = await fetchBillingCycles(clientId);

  const conflictingCycle = existingCycles.find(c =>
    String(c.id || '') !== String(cycle?.id || '') &&
    (!resolvedOrderId || c.order_id !== resolvedOrderId) &&
    c.delivery_start_date === cleanStartDate &&
    c.payment_status === 'Pending'
  );
  if (conflictingCycle) {
    return {
      success: false,
      isDuplicate: true,
      message: `Another pending renewal cycle starting on ${cleanStartDate} already exists (Cycle #${conflictingCycle.cycle_number}).`,
      existingCycle: conflictingCycle
    };
  }

  const targetCycleNumber = Number(
    cycle?.cycle_number || baseOrder?.schedule_config?.cycle_number || 1
  );

  const quotas = resolveDeliverableQuotas(packageName, deliverables);
  const retainedUrls = Array.isArray(savedReceiptUrls)
    ? savedReceiptUrls
    : (Array.isArray(paymentDetails?.existingReceiptUrls) ? paymentDetails.existingReceiptUrls : []);

  const uploadedReceiptUrls = await uploadRenewalReceipts({
    orderId: resolvedOrderId || `C${targetCycleNumber}`,
    cycleNumber: targetCycleNumber,
    receiptFiles,
    existingUrls: retainedUrls
  });

  const paymentState = buildRenewalPaymentState({
    orderId: resolvedOrderId || `C${targetCycleNumber}`,
    cycleNumber: targetCycleNumber,
    amount: numAmount,
    startDate: cleanStartDate,
    paymentDetails,
    uploadedReceiptUrls,
    pruneRemovedReceipts: true,
    isAdminRenewal: true,
    existingOrderStatus: baseOrder?.status || null
  });

  const { scheduleConfig, generatedSchedule } = buildCycleScheduleAndConfig({
    client,
    baseOrder,
    existingScheduleConfig: baseOrder?.schedule_config,
    cycleNumber: targetCycleNumber,
    packageName,
    startDate: cleanStartDate,
    quotas,
    paymentState,
    uploadedReceiptUrls
  });

  // Update linked finance/order row
  const orderUpdatePayload = {
    plan_name: packageName,
    amount_paid: paymentState.paidAmount,
    original_amount: numAmount,
    total_agreed_amount: numAmount,
    balance_due: paymentState.balanceDue,
    static_posts_total: quotas.staticQuota,
    reels_total: quotas.reelsQuota,
    stories_total: quotas.storiesQuota,
    posters_total: quotas.postersQuota,
    has_website: quotas.hasWebsite,
    status: paymentState.orderStatus,
    payment_status: paymentState.orderPaymentStatus,
    payment_id: paymentState.paymentRef || baseOrder?.payment_id || (resolvedOrderId ? `TXN-${resolvedOrderId}` : null),
    payment_receipt_url: paymentState.primaryReceiptUrl,
    grace_period_days: paymentState.gracePeriodDays,
    first_upload_date: cleanStartDate,
    schedule_config: scheduleConfig,
    installments: paymentState.renewalInstallments
  };

  let savedOrder = { ...(baseOrder || {}), ...orderUpdatePayload, order_id: resolvedOrderId };
  if (resolvedOrderId || baseOrder?.id) {
    const matchCol = resolvedOrderId ? 'order_id' : 'id';
    const matchVal = resolvedOrderId || baseOrder.id;
    const { data: dbUpdatedOrder } = await safeOrderWrite('update', orderUpdatePayload, matchCol, matchVal);
    if (dbUpdatedOrder) {
      savedOrder = dbUpdatedOrder;
    }
  }

  // Update billing_cycles row (or materialize bootstrapped Cycle #1 into billing_cycles)
  const cycleNotesSummary = formatCycleNotesSummary({
    notes,
    paymentStructureLabel: paymentState.paymentStructureLabel,
    paymentChannel: paymentState.paymentChannel,
    quotas,
    receiptCount: uploadedReceiptUrls.length,
    fallback: cycle?.notes || `Monthly plan details for Cycle #${targetCycleNumber}`
  });

  const cycleUpdateFields = {
    package: packageName,
    amount: numAmount,
    delivery_start_date: cleanStartDate,
    delivery_end_date: cleanEndDate,
    payment_status: paymentState.cyclePaymentStatus,
    notes: cycleNotesSummary
  };

  let updatedCyclePayload = {
    ...(cycle || {}),
    ...cycleUpdateFields,
    client_id: clientId,
    order_id: resolvedOrderId,
    cycle_number: targetCycleNumber
  };

  try {
    const isBootstrapId = !cycle?.id || String(cycle.id).startsWith('bootstrap_');
    let dbCycle = null;

    if (!isBootstrapId) {
      const { data, error } = await supabase
        .from('billing_cycles')
        .update(cycleUpdateFields)
        .eq('id', cycle.id)
        .select()
        .maybeSingle();
      if (error) {
        console.warn("Notice: billing_cycles update error:", error.message);
      } else {
        dbCycle = data;
      }
    } else if (resolvedOrderId) {
      const { data: matched } = await supabase
        .from('billing_cycles')
        .update(cycleUpdateFields)
        .eq('order_id', resolvedOrderId)
        .select()
        .maybeSingle();

      if (matched) {
        dbCycle = matched;
      } else {
        const insertPayload = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bc_${Date.now()}`,
          client_id: clientId,
          order_id: resolvedOrderId,
          cycle_number: targetCycleNumber,
          ...cycleUpdateFields,
          created_at: cycle?.created_at || paymentState.nowIso
        };
        const { data: inserted } = await supabase
          .from('billing_cycles')
          .insert([insertPayload])
          .select()
          .maybeSingle();
        dbCycle = inserted || insertPayload;
      }
    }

    if (dbCycle) {
      updatedCyclePayload = dbCycle;
    }
  } catch (err) {
    console.warn("Notice: billing_cycles sync notice:", err);
  }

  // Update local cache cleanly without overwriting other clients
  upsertCachedCycles([...existingCycles, updatedCyclePayload]);

  const paymentDetailsText = formatPaymentDetailsText({
    client,
    cycle: updatedCyclePayload,
    orderId: resolvedOrderId || updatedCyclePayload.id,
    amount: numAmount,
    packageName,
    startDate: cleanStartDate,
    endDate: cleanEndDate,
    paymentMode: paymentState.paymentMode,
    paymentChannel: paymentState.paymentChannel,
    paymentRef: paymentState.paymentRef,
    installments: paymentState.renewalInstallments,
    deliverables: {
      staticPosts: quotas.staticQuota,
      reels: quotas.reelsQuota,
      stories: quotas.storiesQuota,
      posters: quotas.postersQuota,
      hasWebsite: quotas.hasWebsite
    },
    uploadedReceiptUrls
  });

  broadcastRenewalSync({
    client,
    updatedCycle: updatedCyclePayload,
    updatedOrder: savedOrder,
    newCycle: updatedCyclePayload,
    newOrder: savedOrder
  });

  return {
    success: true,
    isEdit: true,
    cycle: updatedCyclePayload,
    order: savedOrder,
    schedule: generatedSchedule,
    paymentDetailsText,
    uploadedReceiptUrls,
    paymentSummary: {
      paymentMode: paymentState.paymentMode,
      paymentStructureLabel: paymentState.paymentStructureLabel,
      paymentChannel: paymentState.paymentChannel,
      paymentRef: paymentState.paymentRef,
      paidAmount: paymentState.paidAmount,
      balanceDue: paymentState.balanceDue,
      isFullyPaid: paymentState.isFullyPaid,
      hasPendingVerification: paymentState.hasPendingVerification,
      installments: paymentState.renewalInstallments
    },
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
        paid_at: i.paid_at || new Date().toISOString()
      })) : [];

      await safeOrderWrite(
        'update',
        {
          status: 'active',
          payment_status: 'paid',
          amount_paid: amount,
          balance_due: 0,
          installments: installments
        },
        'order_id',
        orderId
      );
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

  const resolvedClientId = resolveClientUuid({ auth_id: clientId });
  try {
    let query = supabase.from('orders').update({ status: 'paused' });
    if (orderId) query = query.eq('order_id', orderId);
    else if (resolvedClientId) query = query.eq('client_id', resolvedClientId);
    await query;
  } catch (err) {
    console.warn("Notice: orders pause update error:", err);
  }

  broadcastRenewalSync({ orderId, clientId: resolvedClientId, status: 'paused' });
  return { success: true };
}
