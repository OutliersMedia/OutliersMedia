/**
 * OUTLIERS MEDIA — INSTALLMENT & CUSTOM DISCOUNT ENGINE
 * Manages custom discounted prices, EMI milestone schedules, due dates,
 * automated grace period calculations, account suspension logic, and auto-restoration.
 */

export const getStandardPlanPrice = (planName) => {
  const p = (planName || '').toLowerCase();
  if (p.includes('premium')) return 15000;
  if (p.includes('growth')) return 6000;
  if (p.includes('starter') || p.includes('basic')) return 3500;
  return 3500;
};

/**
 * Checks if an order or client corresponds to Cravory.
 */
export function isCravoryOrder(order) {
  if (!order) return false;
  const searchable = [
    order.order_id,
    order.plan_name,
    order.client_id,
    order.client?.name,
    order.client?.email,
    order.client?.phone,
    order.client?.business_type,
    order.client?.instagram_handle
  ].filter(Boolean).join(' ').toLowerCase();

  return searchable.includes('cravory');
}

/**
 * Computes live metrics for an order with or without an installment plan.
 */
export function computeOrderInstallmentMetrics(order) {
  if (!order) {
    return {
      hasInstallments: false,
      installments: [],
      standardPrice: 3500,
      totalAgreed: 3500,
      discountAmount: 0,
      paidAmount: 0,
      balanceDue: 0,
      isFullyPaid: true,
      isOverdue: false,
      inGracePeriod: false,
      graceDaysLeft: 0,
      nextInstallment: null,
      hasPendingVerification: false,
      calculatedAccountStatus: 'active'
    };
  }

  const basePlanPrice = Number(order.original_amount || getStandardPlanPrice(order.plan_name));
  const pitchedOrPaidPrice = Math.max(Number(order.total_agreed_amount || 0), Number(order.amount_paid || 0));
  const standardPrice = Math.max(basePlanPrice, pitchedOrPaidPrice);
  const rawInstallments = Array.isArray(order.installments) 
    ? order.installments 
    : (order.schedule_config?.installments || []);

  // --- SPECIAL RETROACTIVE HANDLING FOR CRAVORY ---
  // Cravory closed at ₹3,000 total with ₹1,500 advance paid as of now (50% / 50% split)
  const isCravory = isCravoryOrder(order);
  if (isCravory && rawInstallments.length === 0) {
    const totalAgreed = 3000;
    const paidAmount = 1500;
    const balanceDue = 1500;
    const discountAmount = Math.max(0, standardPrice - totalAgreed);
    const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '2026-10-08';
    
    const secondDateObj = order.created_at ? new Date(order.created_at) : new Date();
    secondDateObj.setDate(secondDateObj.getDate() + 15);
    const secondDate = secondDateObj.toISOString().split('T')[0];

    const cravoryInstallments = [
      {
        installment_number: 1,
        amount: 1500,
        due_date: orderDate,
        paid_at: order.created_at || new Date().toISOString(),
        payment_id: order.payment_id || 'TXN-CRAVORY-50PCT-ADVANCE',
        receipt_url: order.payment_receipt_url || null,
        status: 'paid',
        notes: 'Advance Payment (50%)'
      },
      {
        installment_number: 2,
        amount: 1500,
        due_date: secondDate,
        paid_at: null,
        payment_id: null,
        receipt_url: null,
        status: 'pending',
        notes: 'Final Milestone (50%)'
      }
    ];

    return {
      hasInstallments: true,
      installments: cravoryInstallments,
      standardPrice,
      totalAgreed,
      discountAmount,
      paidAmount,
      balanceDue,
      gracePeriodDays: Number(order.grace_period_days || 3),
      isFullyPaid: false,
      isOverdue: false,
      inGracePeriod: false,
      graceDaysLeft: 3,
      daysOverdue: 0,
      nextInstallment: cravoryInstallments[1],
      hasPendingVerification: false,
      calculatedAccountStatus: 'active'
    };
  }

  const totalAgreed = Number(
    order.total_agreed_amount !== undefined && order.total_agreed_amount !== null
      ? order.total_agreed_amount
      : (order.amount_paid || standardPrice)
  );

  const discountAmount = Math.max(0, standardPrice - totalAgreed);
  const gracePeriodDays = Number(order.grace_period_days || 3);

  // If no installments configured, treat as a single 100% payment
  if (rawInstallments.length === 0) {
    const isPaid = ['active', 'paused', 'cancelled'].includes(order.status);
    const paidAmount = Number(order.amount_paid || (isPaid ? totalAgreed : 0));
    const balanceDue = isPaid ? 0 : Math.max(0, totalAgreed - paidAmount);

    return {
      hasInstallments: false,
      installments: [{
        installment_number: 1,
        amount: totalAgreed,
        due_date: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : null,
        paid_at: isPaid ? order.created_at : null,
        payment_id: order.payment_id || null,
        receipt_url: order.receipt_url || null,
        status: isPaid ? 'paid' : 'pending',
        notes: 'Full Payment'
      }],
      standardPrice,
      totalAgreed,
      discountAmount,
      paidAmount,
      balanceDue,
      isFullyPaid: balanceDue <= 0,
      isOverdue: false,
      inGracePeriod: false,
      graceDaysLeft: 0,
      nextInstallment: null,
      hasPendingVerification: order.status === 'pending',
      calculatedAccountStatus: order.status
    };
  }

  // Calculate live installment metrics
  let paidAmount = 0;
  let nextInstallment = null;
  let hasPendingVerification = false;
  let isOverdue = false;
  let inGracePeriod = false;
  let graceDaysLeft = 0;
  let daysOverdue = 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const parsedInstallments = rawInstallments.map((inst, idx) => {
    const instNum = inst.installment_number || idx + 1;
    const amount = Number(inst.amount || 0);
    const status = inst.status || 'pending'; // 'paid' | 'pending_verification' | 'pending'

    if (status === 'paid') {
      paidAmount += amount;
    } else if (status === 'pending_verification') {
      hasPendingVerification = true;
    }

    let itemIsOverdue = false;
    let itemInGracePeriod = false;
    let itemGraceDaysLeft = 0;

    if (status !== 'paid' && inst.due_date) {
      const dueDate = new Date(inst.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (now > dueDate) {
        const diffMs = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= gracePeriodDays) {
          itemInGracePeriod = true;
          itemGraceDaysLeft = Math.max(0, gracePeriodDays - diffDays);
        } else {
          itemIsOverdue = true;
          daysOverdue = diffDays;
        }
      }

      if (!nextInstallment) {
        nextInstallment = {
          ...inst,
          installment_number: instNum,
          amount,
          isOverdue: itemIsOverdue,
          inGracePeriod: itemInGracePeriod,
          graceDaysLeft: itemGraceDaysLeft
        };
      }
    }

    if (itemIsOverdue) isOverdue = true;
    if (itemInGracePeriod) {
      inGracePeriod = true;
      graceDaysLeft = Math.max(graceDaysLeft, itemGraceDaysLeft);
    }

    return {
      ...inst,
      installment_number: instNum,
      amount,
      status,
      isOverdue: itemIsOverdue,
      inGracePeriod: itemInGracePeriod,
      graceDaysLeft: itemGraceDaysLeft
    };
  });

  const balanceDue = Math.max(0, totalAgreed - paidAmount);
  const isFullyPaid = balanceDue <= 0;

  // Determine account suspension vs active status
  let calculatedAccountStatus = order.status;
  if (order.status === 'active' || order.status === 'paused') {
    if (isOverdue) {
      // Overdue after grace period has expired -> should be paused/suspended
      calculatedAccountStatus = 'paused';
    } else if (order.status === 'paused' && !isOverdue && isFullyPaid) {
      // If was paused but now all overdue amounts are cleared -> restore to active
      calculatedAccountStatus = 'active';
    }
  }

  return {
    hasInstallments: true,
    installments: parsedInstallments,
    standardPrice,
    totalAgreed,
    discountAmount,
    paidAmount,
    balanceDue,
    gracePeriodDays,
    isFullyPaid,
    isOverdue,
    inGracePeriod,
    graceDaysLeft,
    daysOverdue,
    nextInstallment,
    hasPendingVerification,
    calculatedAccountStatus
  };
}

/**
 * Creates a clean default installment plan array for splitting an agreed price.
 * @param {number} total - Total agreed price (e.g. 3000)
 * @param {number} splits - Number of installments (2 or 3)
 * @param {number} [customFirstAmount] - Optional advance amount (e.g. 1500)
 * @param {string} [firstDueDate] - Initial payment date
 * @param {string} [secondDueDate] - 2nd payment due date
 * @param {string} [thirdDueDate] - 3rd payment due date
 */
export function generateDefaultInstallmentPlan({
  total,
  splits = 2,
  customFirstAmount = null,
  firstDueDate = null,
  secondDueDate = null,
  thirdDueDate = null,
  firstPaymentId = null,
  firstReceiptUrl = null,
  firstIsPaid = true
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Default second installment due in 15 days
  const defaultSecondDate = new Date();
  defaultSecondDate.setDate(defaultSecondDate.getDate() + 15);
  const secondDateStr = defaultSecondDate.toISOString().split('T')[0];

  // Default third installment due in 30 days
  const defaultThirdDate = new Date();
  defaultThirdDate.setDate(defaultThirdDate.getDate() + 30);
  const thirdDateStr = defaultThirdDate.toISOString().split('T')[0];

  if (splits === 2) {
    const firstAmount = customFirstAmount !== null ? Number(customFirstAmount) : Math.round(total / 2);
    const secondAmount = Math.max(0, total - firstAmount);

    return [
      {
        installment_number: 1,
        amount: firstAmount,
        due_date: firstDueDate || todayStr,
        paid_at: firstIsPaid ? (firstDueDate ? new Date(firstDueDate).toISOString() : new Date().toISOString()) : null,
        payment_id: firstPaymentId || 'TXN-ADVANCE-UPI',
        receipt_url: firstReceiptUrl || null,
        status: firstIsPaid ? 'paid' : 'pending',
        notes: 'Advance Payment (50%)'
      },
      {
        installment_number: 2,
        amount: secondAmount,
        due_date: secondDueDate || secondDateStr,
        paid_at: null,
        payment_id: null,
        receipt_url: null,
        status: 'pending',
        notes: 'Final Installment (50%)'
      }
    ];
  }

  // 3-way split
  const firstAmount = customFirstAmount !== null ? Number(customFirstAmount) : Math.round(total * 0.4);
  const remaining = total - firstAmount;
  const secondAmount = Math.round(remaining / 2);
  const thirdAmount = Math.max(0, remaining - secondAmount);

  return [
    {
      installment_number: 1,
      amount: firstAmount,
      due_date: firstDueDate || todayStr,
      paid_at: firstIsPaid ? (firstDueDate ? new Date(firstDueDate).toISOString() : new Date().toISOString()) : null,
      payment_id: firstPaymentId || 'TXN-ADVANCE-UPI',
      receipt_url: firstReceiptUrl || null,
      status: firstIsPaid ? 'paid' : 'pending',
      notes: 'Initial Advance'
    },
    {
      installment_number: 2,
      amount: secondAmount,
      due_date: secondDueDate || secondDateStr,
      paid_at: null,
      payment_id: null,
      receipt_url: null,
      status: 'pending',
      notes: 'Second Milestone'
    },
    {
      installment_number: 3,
      amount: thirdAmount,
      due_date: thirdDueDate || thirdDateStr,
      paid_at: null,
      payment_id: null,
      receipt_url: null,
      status: 'pending',
      notes: 'Final Installment'
    }
  ];
}
