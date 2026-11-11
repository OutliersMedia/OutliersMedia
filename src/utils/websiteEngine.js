import { supabase } from './supabaseClient.js';

/**
 * OUTLIERS MEDIA — WEBSITE PROJECTS & WEBSITE-ONLY CLIENT ENGINE
 *
 * Manages website build requests (public.websites), client-type derivation
 * ('Website only' | 'Social media only' | 'Both'), single-table finance
 * integration with public.orders, and Resend email notifications via /api/send-website-email.
 */

export const WEBSITE_TYPES = [
  'Portfolio',
  'Business site',
  'Menu or ordering site',
  'Landing page',
  'Other'
];

export const WEBSITE_STATUSES = [
  'Requested',
  'In Progress',
  'Delivered',
  'Cancelled'
];

export const OPEN_WEBSITE_STATUSES = ['Requested', 'In Progress'];
export const WEBSITE_EVENT_NAME = 'om_websites_updated';

export function broadcastWebsiteSync(payload = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WEBSITE_EVENT_NAME, { detail: payload }));
    window.dispatchEvent(new CustomEvent('om_business_added', { detail: payload }));
  }
}

/**
 * Identifies whether a finance row in public.orders belongs to a standalone Website project
 * (as opposed to a monthly social media plan).
 */
export function isWebsiteOrder(order) {
  if (!order) return false;
  const planLower = (order.plan_name || '').trim().toLowerCase();
  const orderIdUpper = (order.order_id || '').trim().toUpperCase();
  return (
    orderIdUpper.startsWith('WEB-') ||
    planLower === 'website' ||
    planLower === 'website project' ||
    order.schedule_config?.project_category === 'website'
  );
}

/**
 * Identifies whether a finance row in public.orders belongs to a Social Media package/plan.
 */
export function isSocialMediaOrder(order) {
  if (!order || isWebsiteOrder(order)) return false;
  return ['active', 'paused', 'pending'].includes((order.status || '').toLowerCase());
}

/**
 * Derives client type dynamically from live orders + websites so it never goes out of sync.
 * Returns: 'Website only' | 'Social media only' | 'Both' | null
 */
export function deriveClientType(orders = [], websites = []) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeWebsites = Array.isArray(websites) ? websites : [];

  const hasSocialPlan = safeOrders.some((o) => isSocialMediaOrder(o));
  const hasWebsiteProject =
    safeWebsites.some((w) => w && w.status !== 'Cancelled') ||
    safeOrders.some((o) => isWebsiteOrder(o) && o.status !== 'cancelled');

  if (hasSocialPlan && hasWebsiteProject) return 'Both';
  if (hasWebsiteProject) return 'Website only';
  if (hasSocialPlan) return 'Social media only';
  return null;
}

/**
 * Normalizes website URL with https:// if missing scheme.
 */
export function normalizeWebsiteUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Fetches website requests for a single client.
 */
export async function fetchClientWebsites(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('websites')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Notice: fetchClientWebsites error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches all website requests for the admin panel.
 */
export async function fetchAllWebsites() {
  const { data, error } = await supabase
    .from('websites')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Notice: fetchAllWebsites error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Calls the Vercel Resend API endpoint without blocking database workflows if email is skipped/unconfigured.
 */
export async function sendWebsiteNotificationEmail({ type, website, clientEmail, clientName }) {
  try {
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://outliersmedia.in';
    const response = await fetch('/api/send-website-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        website,
        clientEmail,
        clientName,
        appOrigin
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { sent: false, error: result?.error || 'Email service returned an error' };
    }
    return result;
  } catch (err) {
    return { sent: false, error: err?.message || 'Unable to reach email notification service' };
  }
}

/**
 * Creates a new website request for a client and notifies outliersmedia22@gmail.com.
 * Blocks duplicate open ('Requested' / 'In Progress') submissions.
 */
export async function createWebsiteRequest({ user, profile, formData }) {
  const clientId = user?.id || profile?.auth_id;
  if (!clientId) {
    throw new Error('Your session expired. Please sign in again.');
  }

  const businessName = (formData.business_name || '').trim();
  const websiteType = (formData.website_type || '').trim();
  const description = (formData.description || '').trim();
  const referenceLinks = (formData.reference_links || '').trim();
  const preferredDeadline = (formData.preferred_deadline || '').trim();
  const contactNumber = (formData.contact_number || '').trim();
  const rawBudget = formData.budget !== undefined && formData.budget !== null && String(formData.budget).trim() !== ''
    ? Number(formData.budget)
    : null;

  if (!businessName) throw new Error('Please enter your business or brand name.');
  if (!WEBSITE_TYPES.includes(websiteType)) throw new Error('Please select a valid website type.');
  if (!description || description.length < 10) {
    throw new Error('Please provide a short description of what you need (at least 10 characters).');
  }
  if (rawBudget !== null && (!Number.isFinite(rawBudget) || rawBudget <= 0)) {
    throw new Error('Budget must be greater than ₹0 if provided.');
  }

  // Prevent duplicate open requests ('Requested' or 'In Progress')
  const { data: existingOpen, error: checkErr } = await supabase
    .from('websites')
    .select('id, status, business_name')
    .eq('client_id', clientId)
    .in('status', OPEN_WEBSITE_STATUSES);

  if (checkErr) {
    if (checkErr.message?.includes('does not exist')) {
      throw new Error('Website requests table is not set up yet. Please ask admin to run create_websites_table.sql in Supabase.');
    }
    throw new Error(checkErr.message || 'Could not verify existing website requests.');
  }

  if (Array.isArray(existingOpen) && existingOpen.length > 0) {
    throw new Error(
      `You already have an open website request (${existingOpen[0].business_name} — ${existingOpen[0].status}). Duplicate submissions are disabled while a request is open.`
    );
  }

  const insertPayload = {
    client_id: clientId,
    business_name: businessName,
    website_type: websiteType,
    description,
    reference_links: referenceLinks || null,
    preferred_deadline: preferredDeadline || null,
    budget: rawBudget,
    contact_number: contactNumber || null,
    status: 'Requested'
  };

  const { data: created, error: insertErr } = await supabase
    .from('websites')
    .insert([insertPayload])
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      throw new Error('You already have an active website request in progress.');
    }
    throw new Error(insertErr.message || 'Failed to submit website request.');
  }

  // Send admin notification email via Resend
  const emailResult = await sendWebsiteNotificationEmail({
    type: 'new_request',
    website: created,
    clientEmail: user?.email || profile?.email || '',
    clientName: profile?.name || user?.user_metadata?.name || businessName
  });

  broadcastWebsiteSync({ action: 'created', website: created });

  return {
    website: created,
    emailSent: Boolean(emailResult?.sent),
    emailError: emailResult?.error || null
  };
}

/**
 * Ensures a one-time Finance entry exists in public.orders whenever admin sets an agreed amount.
 * Uses the single finance table (public.orders) with status 'pending' by default and labeled 'Website'.
 */
export async function syncWebsiteFinanceOrder({ website, agreedAmount, clientProfile }) {
  const numAmount = Number(agreedAmount);
  if (!website || !Number.isFinite(numAmount) || numAmount <= 0) {
    return null;
  }

  // 1. Check if an order already exists by website.order_id or client_id + schedule_config->website_id
  let existingOrder = null;
  if (website.order_id) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', website.order_id)
      .maybeSingle();
    existingOrder = data || null;
  }

  if (!existingOrder) {
    const { data: clientOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', website.client_id);

    existingOrder = (clientOrders || []).find(
      (o) => o?.schedule_config?.website_id === website.id
    ) || null;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  if (existingOrder) {
    const paidAmount = Number(existingOrder.amount_paid || 0);
    const isAlreadyPaid =
      existingOrder.payment_status === 'paid' && paidAmount >= numAmount;
    const newBalanceDue = isAlreadyPaid ? 0 : Math.max(0, numAmount - paidAmount);

    const existingInstallments = Array.isArray(existingOrder.installments) && existingOrder.installments.length > 0
      ? existingOrder.installments
      : [
          {
            installment_number: 1,
            amount: numAmount,
            due_date: website.preferred_deadline || todayStr,
            status: isAlreadyPaid ? 'paid' : 'pending',
            payment_id: existingOrder.payment_id || `TXN-${existingOrder.order_id}`,
            notes: `One-Time Website Project (${website.website_type})`,
            receipt_url: null,
            receipt_urls: []
          }
        ];

    const updatedInstallments =
      existingInstallments.length === 1
        ? [
            {
              ...existingInstallments[0],
              amount: numAmount,
              status: isAlreadyPaid ? 'paid' : existingInstallments[0].status || 'pending'
            }
          ]
        : existingInstallments;

    const updatePayload = {
      plan_name: 'Website',
      original_amount: numAmount,
      total_agreed_amount: numAmount,
      balance_due: newBalanceDue,
      has_website: true,
      business_name: website.business_name,
      business_type: website.website_type,
      schedule_config: {
        ...(existingOrder.schedule_config || {}),
        project_category: 'website',
        website_id: website.id,
        website_type: website.website_type,
        business_name: website.business_name
      },
      installments: updatedInstallments
    };

    const { data: updatedOrd, error: ordErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', existingOrder.id)
      .select()
      .maybeSingle();

    if (ordErr) {
      throw new Error('Website saved, but failed updating Finance entry: ' + ordErr.message);
    }

    return updatedOrd || { ...existingOrder, ...updatePayload };
  }

  // 2. Create brand-new one-time Website finance order in public.orders with status Pending
  const generatedOrderId = `WEB-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const txnRef = `TXN-${generatedOrderId}`;

  const newOrderPayload = {
    order_id: generatedOrderId,
    client_id: website.client_id,
    plan_name: 'Website',
    amount_paid: 0,
    original_amount: numAmount,
    total_agreed_amount: numAmount,
    balance_due: numAmount,
    static_posts_total: 0,
    reels_total: 0,
    stories_total: 0,
    posters_total: 0,
    has_website: true,
    status: 'pending',
    payment_status: 'pending',
    payment_id: txnRef,
    first_upload_date: null,
    business_name: website.business_name,
    business_type: website.website_type || clientProfile?.business_type || 'Website',
    instagram_handle: clientProfile?.instagram_handle || '',
    schedule_config: {
      project_category: 'website',
      website_id: website.id,
      website_type: website.website_type,
      business_name: website.business_name,
      one_time_project: true
    },
    installments: [
      {
        installment_number: 1,
        amount: numAmount,
        due_date: website.preferred_deadline || todayStr,
        status: 'pending',
        payment_id: txnRef,
        notes: `One-Time Website Project (${website.website_type})`,
        receipt_url: null,
        receipt_urls: []
      }
    ],
    created_at: new Date().toISOString()
  };

  const { data: insertedOrder, error: insertOrdErr } = await supabase
    .from('orders')
    .insert([newOrderPayload])
    .select()
    .single();

  if (insertOrdErr) {
    throw new Error('Could not create Finance entry in orders table: ' + insertOrdErr.message);
  }

  return insertedOrder;
}

/**
 * Admin action to update website request status, agreed_amount, live_url, or mark Delivered.
 * Automatically creates/updates Finance entry when agreed_amount > 0, and sends Resend client emails
 * when status transitions to 'In Progress' or 'Delivered'.
 */
export async function updateWebsiteRequestByAdmin({ website, updates, clientProfile }) {
  if (!website?.id) {
    throw new Error('Missing website request identifier.');
  }

  const nextStatus = updates.status || website.status;
  if (!WEBSITE_STATUSES.includes(nextStatus)) {
    throw new Error('Invalid website status selected.');
  }

  const parsedAmount =
    updates.agreed_amount !== undefined &&
    updates.agreed_amount !== null &&
    String(updates.agreed_amount).trim() !== ''
      ? Number(updates.agreed_amount)
      : null;

  if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
    throw new Error('Agreed amount must be a valid positive number.');
  }

  const cleanedLiveUrl = normalizeWebsiteUrl(updates.live_url);
  if (nextStatus === 'Delivered' && cleanedLiveUrl) {
    try {
      new URL(cleanedLiveUrl);
    } catch {
      throw new Error('Please enter a valid live website URL (e.g., clientdomain.com).');
    }
  }

  // Sync Finance order FIRST if agreed_amount > 0
  let syncedOrder = null;
  if (parsedAmount && parsedAmount > 0) {
    syncedOrder = await syncWebsiteFinanceOrder({
      website: {
        ...website,
        agreed_amount: parsedAmount
      },
      agreedAmount: parsedAmount,
      clientProfile
    });
  }

  const resolvedOrderId = syncedOrder?.order_id || website.order_id || null;
  const nextDeliveredAt =
    nextStatus === 'Delivered'
      ? (website.delivered_at || new Date().toISOString())
      : null;

  const dbUpdates = {
    status: nextStatus,
    agreed_amount: parsedAmount,
    live_url: cleanedLiveUrl || null,
    delivered_at: nextDeliveredAt,
    order_id: resolvedOrderId
  };

  const { data: updatedWebsite, error: updateErr } = await supabase
    .from('websites')
    .update(dbUpdates)
    .eq('id', website.id)
    .select()
    .single();

  if (updateErr) {
    throw new Error(updateErr.message || 'Failed to save website updates.');
  }

  // Send Resend email when status changes to In Progress or Delivered
  let emailResult = { sent: false, skipped: true };
  const statusChanged = nextStatus !== website.status;
  if (statusChanged && (nextStatus === 'In Progress' || nextStatus === 'Delivered')) {
    emailResult = await sendWebsiteNotificationEmail({
      type: nextStatus === 'In Progress' ? 'in_progress' : 'delivered',
      website: updatedWebsite,
      clientEmail: clientProfile?.email || '',
      clientName: clientProfile?.name || updatedWebsite.business_name
    });
  }

  broadcastWebsiteSync({
    action: 'updated',
    website: updatedWebsite,
    order: syncedOrder
  });

  return {
    website: updatedWebsite,
    order: syncedOrder,
    emailSent: Boolean(emailResult?.sent),
    emailSkipped: Boolean(emailResult?.skipped),
    emailError: emailResult?.error || null
  };
}

/**
 * One-click "Mark as Paid" for a one-time Website finance order in public.orders.
 */
export async function markWebsiteOrderPaid(order) {
  if (!order?.id && !order?.order_id) {
    throw new Error('Missing order reference.');
  }

  const agreedAmount = Number(
    order.total_agreed_amount || order.original_amount || order.amount_paid || 0
  );
  const nowIso = new Date().toISOString();

  const updatedInstallments = Array.isArray(order.installments) && order.installments.length > 0
    ? order.installments.map((inst) => ({
        ...inst,
        status: 'paid',
        paid_at: inst.paid_at || nowIso
      }))
    : [
        {
          installment_number: 1,
          amount: agreedAmount,
          due_date: order.created_at ? order.created_at.split('T')[0] : nowIso.split('T')[0],
          status: 'paid',
          paid_at: nowIso,
          payment_id: order.payment_id || `TXN-${order.order_id}`,
          notes: `One-Time Website Project Paid`
        }
      ];

  let query = supabase
    .from('orders')
    .update({
      status: 'active',
      payment_status: 'paid',
      amount_paid: agreedAmount,
      balance_due: 0,
      installments: updatedInstallments
    });

  if (order.id) query = query.eq('id', order.id);
  else query = query.eq('order_id', order.order_id);

  const { data: updatedOrder, error } = await query.select().single();
  if (error) {
    throw new Error(error.message || 'Failed to mark website payment as paid.');
  }

  broadcastWebsiteSync({ action: 'paid', order: updatedOrder });
  return updatedOrder;
}
