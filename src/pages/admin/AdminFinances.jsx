import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import { 
  IndianRupee, TrendingUp, Clock, Search, ExternalLink, CheckCircle, 
  PauseCircle, PlayCircle, XCircle, History, X, FileDown, Tag, Edit3, 
  AlertCircle, AlertTriangle, ShieldCheck, ShieldAlert, Calendar, 
  Check, CreditCard, Layers, Plus, Trash2, Eye, ArrowRight,
  Zap, Globe, RotateCcw, Sparkles, UserCheck
} from 'lucide-react';
import { generateSingleInvoicePDF, generateLifetimeStatementPDF } from '../../utils/invoiceGenerator';
import { 
  computeOrderInstallmentMetrics, 
  generateDefaultInstallmentPlan, 
  getStandardPlanPrice,
  isCravoryOrder
} from '../../utils/installmentEngine';
import { usePricing, DEFAULT_LIVE_PRICING } from '../../context/PricingContext';

export { getStandardPlanPrice };

export default function AdminFinances() {
  const [searchParams] = useSearchParams();
  const initialFilterParam = searchParams.get('filter');

  const {
    livePricing,
    savingPricing,
    updateLivePricing,
    addPitchMemoryEntry,
    updatePitchEntryStatus,
    deletePitchEntry
  } = usePricing();

  // Live Pricing & Pitch Manager local inputs
  const [customStarterInput, setCustomStarterInput] = useState('');
  const [customGrowthInput, setCustomGrowthInput] = useState('');
  const [customPremiumInput, setCustomPremiumInput] = useState('');
  const [customAddonInput, setCustomAddonInput] = useState('');
  const [pitchClientName, setPitchClientName] = useState('');
  const [pitchPlanName, setPitchPlanName] = useState('Starter Plan');
  const [pitchPriceInput, setPitchPriceInput] = useState('');
  const [pitchStatusInput, setPitchStatusInput] = useState('pitched');
  const [pitchNotesInput, setPitchNotesInput] = useState('');
  const [pitchSearch, setPitchSearch] = useState('');
  const [liveToast, setLiveToast] = useState(null);
  const [showPitchPanel, setShowPitchPanel] = useState(true);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilterParam || 'All');
  const [search, setSearch] = useState('');
  const [metrics, setMetrics] = useState({ 
    totalRevenue: 0, 
    pendingRevenue: 0, 
    totalDiscounts: 0, 
    totalTransactions: 0,
    activeEmis: 0
  });

  const [selectedClientHistory, setSelectedClientHistory] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [popupType, setPopupType] = useState(null); // 'discount' | 'retainer' | null

  // Installment & Custom Price Configurator State
  const [configModalOrder, setConfigModalOrder] = useState(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState('');
  const [gracePeriodInput, setGracePeriodInput] = useState(3);
  const [splitCount, setSplitCount] = useState(2); // 1 | 2 | 3 | 'custom'
  const [configInstallments, setConfigInstallments] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);

  // Quick Milestone Verification State
  const [verifyModalData, setVerifyModalData] = useState(null);
  const [verifyingMilestone, setVerifyingMilestone] = useState(false);

  useEffect(() => {
    setCustomStarterInput(String(livePricing.starter || 3500));
    setCustomGrowthInput(String(livePricing.growth || 6000));
    setCustomPremiumInput(String(livePricing.premium || 8000));
    setCustomAddonInput(String(livePricing.websiteAddon || 7000));
  }, [livePricing.starter, livePricing.growth, livePricing.premium, livePricing.websiteAddon]);

  useEffect(() => {
    if (pitchPlanName === 'Starter Plan') {
      setPitchPriceInput(String(livePricing.starter || 3500));
    } else if (pitchPlanName === 'Growth Plan') {
      setPitchPriceInput(String(livePricing.growth || 6000));
    } else {
      setPitchPriceInput(String((livePricing.premium || 8000) + (livePricing.websiteAddon || 7000)));
    }
  }, [pitchPlanName, livePricing.starter, livePricing.growth, livePricing.premium, livePricing.websiteAddon]);

  const triggerLiveToast = (msg) => {
    setLiveToast(msg);
    setTimeout(() => {
      setLiveToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleInstantPriceChange = async (field, value, label) => {
    const numeric = Number(value);
    if (!numeric || numeric <= 0) {
      alert('Please enter a valid positive price in ₹.');
      return;
    }
    await updateLivePricing({ [field]: numeric });
    triggerLiveToast(`⚡ ${label} is now LIVE at ₹${numeric.toLocaleString()} across the entire website!`);
  };

  const handleResetDefaultPrices = async () => {
    await updateLivePricing({
      starter: DEFAULT_LIVE_PRICING.starter,
      growth: DEFAULT_LIVE_PRICING.growth,
      premium: DEFAULT_LIVE_PRICING.premium,
      websiteAddon: DEFAULT_LIVE_PRICING.websiteAddon,
      activePitchClient: ''
    });
    triggerLiveToast('⚡ Reset all website plan prices to standard defaults (₹3,500 / ₹6,000 / ₹8,000 + ₹7,000 Website).');
  };

  const handleLogAndApplyPitch = async (e) => {
    e.preventDefault();
    const cleanName = pitchClientName.trim();
    const numericPrice = Number(pitchPriceInput);
    if (!cleanName) {
      alert('Please enter the Client or Business Name you are pitching.');
      return;
    }
    if (!numericPrice || numericPrice <= 0) {
      alert('Please enter a valid pitched price.');
      return;
    }

    await addPitchMemoryEntry({
      clientName: cleanName,
      planName: pitchPlanName,
      pitchedPrice: numericPrice,
      status: pitchStatusInput,
      notes: pitchNotesInput.trim() || `Pitched ${pitchPlanName} at ₹${numericPrice.toLocaleString()}`,
      alsoSetLive: true
    });

    setPitchClientName('');
    setPitchNotesInput('');
    triggerLiveToast(`🚀 Set ${pitchPlanName} live to ₹${numericPrice.toLocaleString()} & saved "${cleanName}" in Pitch Memory!`);
  };

  useEffect(() => {
    if (initialFilterParam) {
      setFilter(initialFilterParam);
    }
  }, [initialFilterParam]);

  useEffect(() => {
    fetchFinances();
  }, []);

  const fetchFinances = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_id, name, email, phone, business_type, instagram_handle');

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.auth_id] = p;
      });
    }

    // Fetch all orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (orders) {
      let totalRev = 0;
      let totalPendingBal = 0;
      let totalDiscountGiven = 0;
      let activeEmiCount = 0;

      const mapped = await Promise.all(orders.map(async (order) => {
        const clientProfile = profileMap[order.client_id] || { name: 'Unknown Client', email: 'Unknown' };
        const orderWithClient = { ...order, client: clientProfile };

        // --- RETROACTIVE AUTO-SYNC FOR CRAVORY (₹3,000 Total, ₹1,500 Paid Advance, ₹1,500 Due) ---
        if (isCravoryOrder(orderWithClient)) {
          const rawInst = Array.isArray(order.installments) ? order.installments : [];
          if (rawInst.length === 0 && (!order.total_agreed_amount || !order.amount_paid)) {
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

            try {
              await supabase.from('orders').update({
                total_agreed_amount: 3000,
                amount_paid: 1500,
                balance_due: 1500,
                installments: cravoryInstallments,
                status: 'active',
                payment_status: 'partial',
                grace_period_days: 3
              }).eq('id', order.id);

              order.total_agreed_amount = 3000;
              order.amount_paid = 1500;
              order.balance_due = 1500;
              order.installments = cravoryInstallments;
              order.status = 'active';
              order.payment_status = 'partial';
            } catch (err) {
              console.warn("Could not auto-sync Cravory order to Supabase:", err);
            }
          }
        }

        let currentStatus = order.status;
        const instMetrics = computeOrderInstallmentMetrics({ ...order, client: clientProfile });

        // Auto-suspension check: active order overdue past grace period -> pause
        if (order.status === 'active' && instMetrics.isOverdue) {
          try {
            await supabase.from('orders').update({ status: 'paused' }).eq('id', order.id);
            currentStatus = 'paused';
            instMetrics.calculatedAccountStatus = 'paused';
          } catch (e) {
            console.error("Auto-pause sync error:", e);
          }
        } 
        // Auto-restoration check: paused order where balance is completely paid -> active
        else if (order.status === 'paused' && !instMetrics.isOverdue && instMetrics.isFullyPaid) {
          try {
            await supabase.from('orders').update({ status: 'active' }).eq('id', order.id);
            currentStatus = 'active';
            instMetrics.calculatedAccountStatus = 'active';
          } catch (e) {
            console.error("Auto-restore sync error:", e);
          }
        }

        // Metrics aggregation
        if (currentStatus === 'active' || currentStatus === 'paused' || currentStatus === 'cancelled') {
          totalRev += instMetrics.paidAmount;
          totalPendingBal += instMetrics.balanceDue;
          totalDiscountGiven += instMetrics.discountAmount;
        } else if (currentStatus === 'pending') {
          totalPendingBal += instMetrics.totalAgreed;
          totalDiscountGiven += instMetrics.discountAmount;
        }

        if (instMetrics.hasInstallments && instMetrics.installments.length > 1) {
          activeEmiCount++;
        }

        return {
          ...order,
          status: currentStatus,
          standardPrice: instMetrics.standardPrice,
          totalAgreed: instMetrics.totalAgreed,
          discountAmount: instMetrics.discountAmount,
          instMetrics,
          client: clientProfile
        };
      }));

      setTransactions(mapped);
      setMetrics({
        totalRevenue: totalRev,
        pendingRevenue: totalPendingBal,
        totalDiscounts: totalDiscountGiven,
        totalTransactions: orders.length,
        activeEmis: activeEmiCount
      });
    }
    setLoading(false);
  };

  // Open Installment Configurator Modal
  const handleOpenConfigurator = (order) => {
    setConfigModalOrder(order);
    const metrics = computeOrderInstallmentMetrics(order);
    const agreed = metrics.totalAgreed || getStandardPlanPrice(order.plan_name);
    setAgreedPriceInput(String(agreed));
    setGracePeriodInput(Number(order.grace_period_days || 3));

    if (metrics.hasInstallments && metrics.installments.length > 0) {
      setConfigInstallments(metrics.installments.map(inst => ({
        installment_number: inst.installment_number,
        amount: Number(inst.amount || 0),
        due_date: inst.due_date || new Date().toISOString().split('T')[0],
        status: inst.status || 'pending',
        paid_at: inst.paid_at || (inst.status === 'paid' ? new Date().toISOString() : null),
        payment_id: inst.payment_id || '',
        notes: inst.notes || '',
        receipt_url: inst.receipt_url || null
      })));
      setSplitCount(metrics.installments.length <= 3 ? metrics.installments.length : 'custom');
    } else {
      // Default to 2 splits (50% advance / 50% milestone) for new/pending orders
      if (order.status === 'pending') {
        setSplitCount(2);
        setConfigInstallments(generateDefaultInstallmentPlan({
          total: Number(agreed),
          splits: 2,
          firstDueDate: new Date().toISOString().split('T')[0],
          firstPaymentId: order.payment_id || 'TXN-ADVANCE-UPI',
          firstReceiptUrl: order.payment_receipt_url,
          firstIsPaid: true
        }));
      } else {
        setSplitCount(1);
        setConfigInstallments([{
          installment_number: 1,
          amount: Number(agreed),
          due_date: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          paid_at: order.created_at || new Date().toISOString(),
          status: 'paid',
          payment_id: order.payment_id || 'TXN-FULL-PAID',
          notes: 'Full Retainer Payment (Complete Payment)',
          receipt_url: order.payment_receipt_url || null
        }]);
      }
    }
  };

  // Handle Split Selector click (1x, 2x, 3x)
  const handleSelectSplit = (splits) => {
    setSplitCount(splits);
    const total = Number(agreedPriceInput) || getStandardPlanPrice(configModalOrder?.plan_name);
    if (splits === 1) {
      setConfigInstallments([{
        installment_number: 1,
        amount: total,
        due_date: new Date().toISOString().split('T')[0],
        paid_at: new Date().toISOString(),
        status: 'paid',
        payment_id: configModalOrder?.payment_id || `TXN-FULL-PAID-${Date.now().toString().slice(-6)}`,
        notes: 'Complete Payment (100% Upfront)',
        receipt_url: configModalOrder?.payment_receipt_url || null
      }]);
    } else {
      setConfigInstallments(generateDefaultInstallmentPlan({
        total,
        splits,
        firstDueDate: new Date().toISOString().split('T')[0],
        firstPaymentId: configModalOrder?.payment_id || 'TXN-ADVANCE-UPI',
        firstReceiptUrl: configModalOrder?.payment_receipt_url,
        firstIsPaid: true
      }));
    }
  };

  // 1-Click Complete Payment Option (Client gave complete payment at once)
  const handleMarkCompletePayment = (consolidateToSingle = false) => {
    const total = Number(agreedPriceInput) || getStandardPlanPrice(configModalOrder?.plan_name);
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    if (consolidateToSingle || configInstallments.length <= 1) {
      setSplitCount(1);
      setConfigInstallments([{
        installment_number: 1,
        amount: total,
        due_date: configInstallments[0]?.due_date || todayStr,
        paid_at: configInstallments[0]?.paid_at || nowIso,
        status: 'paid',
        payment_id: configInstallments[0]?.payment_id || configModalOrder?.payment_id || `TXN-FULL-PAID-${Date.now().toString().slice(-6)}`,
        notes: 'Complete Payment (Paid in Full)',
        receipt_url: configInstallments[0]?.receipt_url || configModalOrder?.payment_receipt_url || null
      }]);
    } else {
      // Mark all existing milestones as paid in full
      const updated = configInstallments.map((inst, idx) => ({
        ...inst,
        status: 'paid',
        paid_at: inst.paid_at || nowIso,
        due_date: inst.due_date || todayStr,
        payment_id: inst.payment_id || `TXN-PAID-${Date.now().toString().slice(-6)}`,
        notes: inst.notes || (configInstallments.length > 1 ? `Milestone #${idx + 1} (Complete Payment)` : 'Complete Payment')
      }));
      setConfigInstallments(updated);
    }
  };

  // Handle Agreed Price Change
  const handleAgreedPriceChange = (newVal) => {
    setAgreedPriceInput(newVal);
    const total = Number(newVal);
    if (!isNaN(total) && total > 0 && splitCount !== 'custom') {
      if (splitCount === 1) {
        setConfigInstallments([{
          installment_number: 1,
          amount: total,
          due_date: configInstallments[0]?.due_date || new Date().toISOString().split('T')[0],
          status: configInstallments[0]?.status || 'paid',
          payment_id: configInstallments[0]?.payment_id || 'TXN-FULL-PAID',
          notes: 'Full Retainer Payment',
          receipt_url: configInstallments[0]?.receipt_url || null
        }]);
      } else if (splitCount === 2) {
        const half = Math.round(total / 2);
        setConfigInstallments(configInstallments.map((inst, i) => ({
          ...inst,
          amount: i === 0 ? half : total - half
        })));
      } else if (splitCount === 3) {
        const first = Math.round(total * 0.4);
        const rem = total - first;
        const second = Math.round(rem / 2);
        const third = rem - second;
        setConfigInstallments(configInstallments.map((inst, i) => ({
          ...inst,
          amount: i === 0 ? first : (i === 1 ? second : third)
        })));
      }
    }
  };

  // Add / Remove Custom Milestone
  const handleAddMilestone = () => {
    const nextNum = configInstallments.length + 1;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + nextNum * 15);
    setConfigInstallments([
      ...configInstallments,
      {
        installment_number: nextNum,
        amount: 0,
        due_date: defaultDate.toISOString().split('T')[0],
        status: 'pending',
        payment_id: '',
        notes: `Milestone ${nextNum}`,
        receipt_url: null
      }
    ]);
    setSplitCount('custom');
  };

  const handleRemoveMilestone = (index) => {
    if (configInstallments.length <= 1) return;
    const filtered = configInstallments.filter((_, i) => i !== index).map((inst, i) => ({
      ...inst,
      installment_number: i + 1
    }));
    setConfigInstallments(filtered);
    setSplitCount('custom');
  };

  const handleAutoBalance = () => {
    const total = Number(agreedPriceInput || 0);
    if (configInstallments.length <= 1) return;
    const firstItemsSum = configInstallments
      .slice(0, -1)
      .reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
    const balance = Math.max(0, total - firstItemsSum);
    const updated = [...configInstallments];
    updated[updated.length - 1].amount = balance;
    setConfigInstallments(updated);
  };

  // Save Installment Plan to Supabase
  const handleSaveConfigPlan = async () => {
    if (!configModalOrder) return;
    const totalAgreed = Number(agreedPriceInput);
    if (isNaN(totalAgreed) || totalAgreed < 0) {
      alert("Please enter a valid agreed price in INR.");
      return;
    }

    const currentSum = configInstallments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
    if (Math.abs(currentSum - totalAgreed) > 1) {
      alert(`The sum of milestones (₹${currentSum.toLocaleString()}) does not match the agreed contract price (₹${totalAgreed.toLocaleString()}). Please adjust or click 'Auto-Balance'.`);
      return;
    }

    setSavingPlan(true);
    try {
      const paidAmount = configInstallments
        .filter(inst => inst.status === 'paid')
        .reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
      const balanceDue = Math.max(0, totalAgreed - paidAmount);

      let nextStatus = configModalOrder.status;
      if (configModalOrder.status === 'pending') {
        nextStatus = paidAmount > 0 ? 'active' : 'pending';
      } else if (configModalOrder.status === 'paused') {
        nextStatus = balanceDue <= 0 ? 'active' : 'paused';
      }

      const paymentStatus = balanceDue <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');

      const sanitizedInstallments = configInstallments.map(inst => {
        if (inst.status === 'paid' && !inst.paid_at) {
          return {
            ...inst,
            paid_at: new Date().toISOString(),
            payment_id: inst.payment_id || `TXN-PAID-${Date.now().toString().slice(-6)}`
          };
        }
        return inst;
      });

      const updatePayload = {
        total_agreed_amount: totalAgreed,
        amount_paid: paidAmount,
        balance_due: balanceDue,
        installments: sanitizedInstallments,
        grace_period_days: Number(gracePeriodInput || 3),
        status: nextStatus,
        payment_status: paymentStatus
      };

      if (balanceDue <= 0 && (!configModalOrder.payment_id || configModalOrder.payment_id.trim() === '')) {
        updatePayload.payment_id = sanitizedInstallments[0]?.payment_id || `TXN-FULL-PAID-${Date.now().toString().slice(-6)}`;
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', configModalOrder.id);

      if (error) {
        alert("Failed to save installment plan: " + error.message);
      } else {
        setConfigModalOrder(null);
        await fetchFinances();
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  // Open Quick Verify Modal
  const handleOpenVerifyModal = (order, installment) => {
    setVerifyModalData({
      order,
      installment,
      txnId: installment.payment_id || `TXN-UPI-${Date.now().toString().slice(-6)}`,
      receiptUrl: installment.receipt_url || null
    });
  };

  // Confirm Quick Verify Milestone
  const handleConfirmVerifyMilestone = async () => {
    if (!verifyModalData) return;
    const { order, installment, txnId } = verifyModalData;

    setVerifyingMilestone(true);
    try {
      const rawInstallments = Array.isArray(order.installments) 
        ? order.installments 
        : (order.schedule_config?.installments || []);

      let newPaid = 0;
      const updated = rawInstallments.map(inst => {
        if (inst.installment_number === installment.installment_number) {
          newPaid += Number(inst.amount || 0);
          return {
            ...inst,
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_id: txnId.trim() || inst.payment_id || `TXN-UPI-${Date.now().toString().slice(-6)}`
          };
        }
        if (inst.status === 'paid') {
          newPaid += Number(inst.amount || 0);
        }
        return inst;
      });

      const totalAgreed = Number(order.total_agreed_amount || order.amount_paid || getStandardPlanPrice(order.plan_name));
      const balanceDue = Math.max(0, totalAgreed - newPaid);
      const isFullyPaid = balanceDue <= 0;

      // Restore account if it was paused
      const nextStatus = order.status === 'paused' ? 'active' : order.status;

      const { error } = await supabase
        .from('orders')
        .update({
          installments: updated,
          amount_paid: newPaid,
          balance_due: balanceDue,
          payment_status: isFullyPaid ? 'paid' : 'partial',
          status: nextStatus
        })
        .eq('id', order.id);

      if (error) {
        alert("Failed to verify payment: " + error.message);
      } else {
        setVerifyModalData(null);
        await fetchFinances();
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setVerifyingMilestone(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert("Error updating status: " + error.message);
    } else {
      fetchFinances();
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.payment_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.client.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.client.email?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    if (filter === 'Pending') return t.status === 'pending';
    if (filter === 'Installments') return t.instMetrics.hasInstallments && t.instMetrics.installments.length > 1;
    if (filter === 'Overdue') return t.instMetrics.isOverdue || t.instMetrics.inGracePeriod || t.status === 'paused';
    if (filter === 'Approved') return ['active', 'paused', 'cancelled'].includes(t.status) && t.instMetrics.isFullyPaid;
    
    return true;
  });

  // Combine manual pitch memory entries with actual database client orders so you ALWAYS remember who was pitched/sold at what price
  const hasRealCravoryOrder = transactions.some(t => isCravoryOrder(t));
  const manualPitchRows = (livePricing.pitchHistory || [])
    .filter(item => !((item.id === 'pitch-cravory-default' || item.id === 'pitch_cravory_init') && hasRealCravoryOrder))
    .map(item => ({
      id: item.id,
      clientName: item.clientName || 'Prospect',
      planName: item.planName || 'Starter Plan',
      price: Number(item.pitchedPrice || 3500),
      standardBase: getStandardPlanPrice(item.planName),
      status: (item.status || '').toLowerCase().includes('sold') ? 'sold' : 'pitched',
      notes: item.notes || 'Logged from Pitch Manager',
      date: item.date || item.pitchedAt || new Date().toISOString(),
      isOrder: false,
      orderId: null
    }));

  const orderMemoryRows = transactions.map(t => ({
    id: `order-${t.id}`,
    clientName: t.client?.name || 'Client',
    planName: t.plan_name || 'Starter Plan',
    price: Number(t.totalAgreed || t.instMetrics?.totalAgreed || t.amount_paid || 3500),
    standardBase: getStandardPlanPrice(t.plan_name),
    status: t.status === 'pending' ? 'pending_order' : 'sold',
    notes: t.instMetrics?.hasInstallments && t.instMetrics.installments.length > 1
      ? `Order #${t.order_id} • ${t.instMetrics.installments.length}-Split EMI (₹${t.instMetrics.paidAmount.toLocaleString()} Paid)`
      : `Order #${t.order_id} • Official Client Order`,
    date: t.created_at,
    isOrder: true,
    orderId: t.order_id,
    clientEmail: t.client?.email
  }));

  const allPitchMemoryRows = [...manualPitchRows, ...orderMemoryRows].filter(row => {
    if (!pitchSearch.trim()) return true;
    const q = pitchSearch.toLowerCase();
    return (
      row.clientName?.toLowerCase().includes(q) ||
      row.planName?.toLowerCase().includes(q) ||
      String(row.price).includes(q) ||
      row.notes?.toLowerCase().includes(q) ||
      row.orderId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-6 md:p-8 min-h-[calc(100vh-140px)] shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Financial Command Center</h2>
          <p className="text-[#888] text-sm">
            Manage custom client pricing, multi-installment EMI schedules, automated suspensions, and official invoices.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" 
              placeholder="Search TXN ID, Client, Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Verified Collected Revenue */}
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 relative overflow-hidden group hover:border-[#333] transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 text-green-500 transition-opacity">
            <TrendingUp size={64} />
          </div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-2">Verified Revenue Collected</p>
          <h3 className="text-3xl font-serif text-white flex items-center gap-1.5">
            <IndianRupee size={24} className="text-green-500" />
            {metrics.totalRevenue.toLocaleString()}
          </h3>
          <p className="text-[#666] text-xs mt-2">Cash flow received to date</p>
        </div>

        {/* Pending Payments & Balances */}
        <div 
          onClick={() => setFilter(filter === 'Pending' ? 'All' : 'Pending')}
          className="bg-[#0a0a0a] border border-[#222] hover:border-yellow-500/40 rounded-2xl p-6 relative overflow-hidden cursor-pointer transition-all group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 text-yellow-500 transition-opacity">
            <Clock size={64} />
          </div>
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
            Pending Balances & EMIs
          </p>
          <h3 className="text-3xl font-serif text-white flex items-center gap-1.5">
            <IndianRupee size={24} className="text-yellow-400" />
            {metrics.pendingRevenue.toLocaleString()}
          </h3>
          <p className="text-[#777] text-xs mt-2 group-hover:text-yellow-400/80 transition-colors flex items-center gap-1">
            Click to view pending items <ArrowRight size={10} />
          </p>
        </div>

        {/* Total Discounts Granted */}
        <div 
          onClick={() => setPopupType('discount')}
          className="bg-[#0a0a0a] border border-[#222] hover:border-emerald-500/40 rounded-2xl p-6 relative overflow-hidden cursor-pointer transition-all group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 text-emerald-500 transition-opacity">
            <Tag size={64} />
          </div>
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Special Discounts Granted</span>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
              {transactions.filter(t => (t.instMetrics?.discountAmount || t.discountAmount || 0) > 0).length} Clients
            </span>
          </p>
          <h3 className="text-3xl font-serif text-white flex items-center gap-1.5">
            <IndianRupee size={24} className="text-emerald-400" />
            {metrics.totalDiscounts.toLocaleString()}
          </h3>
          <p className="text-[#777] text-xs mt-2 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
            Click to view discount breakdown <ArrowRight size={10} />
          </p>
        </div>

        {/* Retainers & Active EMI Deals */}
        <div 
          onClick={() => setPopupType('retainer')}
          className="bg-[#0a0a0a] border border-[#222] hover:border-[#3428f8]/50 rounded-2xl p-6 relative overflow-hidden cursor-pointer transition-all group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 text-[#3428f8] transition-opacity">
            <Layers size={64} />
          </div>
          <p className="text-[#3428f8] text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Retainers & Plans</span>
            <span className="text-[10px] bg-[#3428f8]/15 border border-[#3428f8]/30 px-2 py-0.5 rounded-full font-bold">
              {metrics.totalTransactions} Total
            </span>
          </p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-3xl font-serif text-white">{metrics.totalTransactions}</h3>
            {metrics.activeEmis > 0 && (
              <span className="text-xs bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/30 px-2 py-0.5 rounded-full font-bold">
                {metrics.activeEmis} on EMI
              </span>
            )}
          </div>
          <p className="text-[#777] text-xs mt-2 group-hover:text-[#3428f8] transition-colors flex items-center gap-1">
            Click to view client plans <ArrowRight size={10} />
          </p>
        </div>
      </div>

      {/* ⚡ LIVE WEBSITE PRICING & PITCH MEMORY MANAGER */}
      <div className="mb-8 bg-gradient-to-br from-[#0c0c14] via-[#0a0a0a] to-[#0f0c1b] border border-[#3428f8]/40 rounded-3xl p-6 md:p-7 shadow-[0_0_40px_rgba(52,40,248,0.12)] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#222]">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#3428f8]/20 border border-[#3428f8]/40 flex items-center justify-center text-[#3428f8] shrink-0 mt-0.5 shadow-[0_0_20px_rgba(52,40,248,0.3)]">
              <Zap size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xl md:text-2xl font-serif text-white">
                  Live Website Pricing & Pitch Memory
                </h3>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync Active
                </span>
                {livePricing.activePitchClient && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#3428f8]/20 text-[#9aaeff] border border-[#3428f8]/40 px-2.5 py-1 rounded-full">
                    <Sparkles size={11} /> Pitching: {livePricing.activePitchClient}
                  </span>
                )}
              </div>
              <p className="text-[#888] text-xs md:text-sm mt-1">
                Instantly change plan prices on the Home Page, Services Page & Dashboard before showing a client. Existing logged-in clients remain protected and see their own deal price.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaultPrices}
              disabled={savingPricing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#151515] hover:bg-[#222] text-[#aaa] hover:text-white border border-[#2a2a2a] transition-all cursor-pointer"
              title="Reset website prices to standard ₹3,500 / ₹6,000 / ₹11,000"
            >
              <RotateCcw size={13} /> Reset Defaults
            </button>
            <button
              type="button"
              onClick={() => setShowPitchPanel(!showPitchPanel)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#3428f8]/15 hover:bg-[#3428f8]/25 text-[#9aaeff] border border-[#3428f8]/30 transition-all cursor-pointer"
            >
              {showPitchPanel ? 'Hide Controls' : 'Open Pitch Controls'}
            </button>
          </div>
        </div>

        {/* Live Toast Confirmation */}
        <AnimatePresence>
          {liveToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                {liveToast}
              </span>
              <button onClick={() => setLiveToast(null)} className="text-emerald-400 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {showPitchPanel && (
          <div className="mt-6 space-y-6">
            {/* 3 Plan Instant Price Switcher Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 1. STARTER PLAN CARD (Most Pitched) */}
              <div className="bg-[#0a0a0a] border border-[#3428f8]/50 rounded-2xl p-5 relative shadow-[0_0_25px_rgba(52,40,248,0.08)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#9aaeff] bg-[#3428f8]/20 border border-[#3428f8]/30 px-2 py-0.5 rounded">
                      Most Pitched
                    </span>
                    <h4 className="text-white font-serif text-lg mt-1">Starter Plan</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-[#777] block font-bold">Live on Site</span>
                    <span className="text-2xl font-serif font-bold text-emerald-400">
                      ₹{Number(livePricing.starter || 3500).toLocaleString()}
                      <span className="text-xs text-[#666] font-sans font-normal">/mo</span>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#777] font-bold uppercase tracking-wider mb-2">
                  1-Tap Instant Pitch Presets:
                </p>
                <div className="grid grid-cols-5 gap-1.5 mb-3.5">
                  {[3000, 3500, 4000, 4500, 5000].map(preset => {
                    const isActive = Number(livePricing.starter) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={savingPricing}
                        onClick={() => handleInstantPriceChange('starter', preset, 'Starter Plan')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-[#3428f8] text-white border-[#3428f8] shadow-[0_0_15px_rgba(52,40,248,0.4)]'
                            : 'bg-[#141414] text-[#bbb] border-[#262626] hover:border-[#3428f8]/50 hover:text-white'
                        }`}
                      >
                        ₹{preset.toLocaleString()}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666] text-xs font-bold">₹</span>
                    <input
                      type="number"
                      value={customStarterInput}
                      onChange={(e) => setCustomStarterInput(e.target.value)}
                      placeholder="Custom ₹"
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl py-2 pl-7 pr-3 text-white text-xs font-mono focus:border-[#3428f8] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingPricing}
                    onClick={() => handleInstantPriceChange('starter', customStarterInput, 'Starter Plan')}
                    className="px-4 py-2 rounded-xl bg-white text-black hover:bg-[#ddd] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                  >
                    Set Live
                  </button>
                </div>
              </div>

              {/* 2. GROWTH PLAN CARD */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      Most Popular Badge
                    </span>
                    <h4 className="text-white font-serif text-lg mt-1">Growth Plan</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-[#777] block font-bold">Live on Site</span>
                    <span className="text-2xl font-serif font-bold text-white">
                      ₹{Number(livePricing.growth || 6000).toLocaleString()}
                      <span className="text-xs text-[#666] font-sans font-normal">/mo</span>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#777] font-bold uppercase tracking-wider mb-2">
                  1-Tap Instant Pitch Presets:
                </p>
                <div className="grid grid-cols-4 gap-1.5 mb-3.5">
                  {[5000, 6000, 7000, 8000].map(preset => {
                    const isActive = Number(livePricing.growth) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={savingPricing}
                        onClick={() => handleInstantPriceChange('growth', preset, 'Growth Plan')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-[#3428f8] text-white border-[#3428f8] shadow-[0_0_15px_rgba(52,40,248,0.4)]'
                            : 'bg-[#141414] text-[#bbb] border-[#262626] hover:border-[#3428f8]/50 hover:text-white'
                        }`}
                      >
                        ₹{preset.toLocaleString()}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666] text-xs font-bold">₹</span>
                    <input
                      type="number"
                      value={customGrowthInput}
                      onChange={(e) => setCustomGrowthInput(e.target.value)}
                      placeholder="Custom ₹"
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl py-2 pl-7 pr-3 text-white text-xs font-mono focus:border-[#3428f8] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingPricing}
                    onClick={() => handleInstantPriceChange('growth', customGrowthInput, 'Growth Plan')}
                    className="px-4 py-2 rounded-xl bg-white text-black hover:bg-[#ddd] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                  >
                    Set Live
                  </button>
                </div>
              </div>

              {/* 3. PREMIUM PLAN + WEBSITE SETUP CARD */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                      Full Stack + Website
                    </span>
                    <h4 className="text-white font-serif text-lg mt-1">Premium Plan</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-[#777] block font-bold">1st Month Total</span>
                    <span className="text-2xl font-serif font-bold text-white">
                      ₹{(Number(livePricing.premium || 8000) + Number(livePricing.websiteAddon || 7000)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] text-[#777] font-bold uppercase tracking-wider block mb-1">
                      Monthly Retainer (₹{Number(livePricing.premium || 8000).toLocaleString()}/mo)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customPremiumInput}
                        onChange={(e) => setCustomPremiumInput(e.target.value)}
                        className="w-full bg-[#141414] border border-[#262626] rounded-xl py-1.5 px-3 text-white text-xs font-mono focus:border-[#3428f8] outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingPricing}
                        onClick={() => handleInstantPriceChange('premium', customPremiumInput, 'Premium Monthly')}
                        className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#3428f8] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#777] font-bold uppercase tracking-wider block mb-1">
                      One-Time Website Setup (+₹{Number(livePricing.websiteAddon || 7000).toLocaleString()})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customAddonInput}
                        onChange={(e) => setCustomAddonInput(e.target.value)}
                        className="w-full bg-[#141414] border border-[#262626] rounded-xl py-1.5 px-3 text-white text-xs font-mono focus:border-[#3428f8] outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingPricing}
                        onClick={() => handleInstantPriceChange('websiteAddon', customAddonInput, 'Website Setup Add-on')}
                        className="px-3 py-1.5 rounded-xl bg-[#222] hover:bg-[#3428f8] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PITCH LOGGER FORM: Remember to whom you pitched or sold at what price */}
            <form
              onSubmit={handleLogAndApplyPitch}
              className="bg-[#0a0a0a] border border-[#262626] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <UserCheck size={16} className="text-[#3428f8]" />
                  Pitch & Deal Logger — Lock Price for a Specific Client
                </h4>
                <span className="text-[11px] text-[#777]">
                  Sets the price live on the website AND remembers what you quoted this client
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#777] block mb-1">
                    Client / Business Name *
                  </label>
                  <input
                    type="text"
                    value={pitchClientName}
                    onChange={(e) => setPitchClientName(e.target.value)}
                    placeholder="e.g. Cravory, Royal Cafe..."
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl p-2.5 text-white text-xs focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#777] block mb-1">
                    Plan Pitched
                  </label>
                  <select
                    value={pitchPlanName}
                    onChange={(e) => setPitchPlanName(e.target.value)}
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl p-2.5 text-white text-xs focus:border-[#3428f8] outline-none"
                  >
                    <option value="Starter Plan">Starter Plan</option>
                    <option value="Growth Plan">Growth Plan</option>
                    <option value="Premium Plan">Premium Plan</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#777] block mb-1">
                    Quoted Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={pitchPriceInput}
                    onChange={(e) => setPitchPriceInput(e.target.value)}
                    placeholder="4000"
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl p-2.5 text-white text-xs font-mono font-bold focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#777] block mb-1">
                    Deal Status
                  </label>
                  <select
                    value={pitchStatusInput}
                    onChange={(e) => setPitchStatusInput(e.target.value)}
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl p-2.5 text-white text-xs focus:border-[#3428f8] outline-none"
                  >
                    <option value="pitched">Pitched (Showing Site)</option>
                    <option value="sold">Agreed / Sold</option>
                  </select>
                </div>

                <div className="md:col-span-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={savingPricing}
                    className="w-full bg-[#3428f8] hover:bg-[#463bfa] text-white py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(52,40,248,0.35)] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap size={14} /> Set Live & Save Client
                  </button>
                </div>
              </div>
            </form>

            {/* PITCH & SOLD PRICE MEMORY TABLE */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <History size={15} className="text-emerald-400" />
                    Client Pitch & Sold Price Memory ({allPitchMemoryRows.length})
                  </h4>
                  <p className="text-[11px] text-[#777]">
                    Permanent record of every client, what plan & price you pitched or sold them, and 1-click reload to the website.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    type="text"
                    value={pitchSearch}
                    onChange={(e) => setPitchSearch(e.target.value)}
                    placeholder="Filter client name or price..."
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl py-1.5 pl-8 pr-3 text-white text-xs focus:border-[#3428f8] outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="bg-[#111] border-b border-[#222] text-[10px] font-bold uppercase tracking-widest text-[#666]">
                      <th className="py-3 px-4">Client / Prospect</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Pitched / Sold Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Notes & Date</th>
                      <th className="py-3 px-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPitchMemoryRows.map((row) => {
                      const diff = row.price - row.standardBase;
                      const pLower = row.planName.toLowerCase();
                      const isCurrentlyLive =
                        (pLower.includes('starter') && Number(livePricing.starter) === row.price) ||
                        (pLower.includes('growth') && Number(livePricing.growth) === row.price) ||
                        (pLower.includes('premium') && (Number(livePricing.premium) + Number(livePricing.websiteAddon)) === row.price);

                      return (
                        <tr key={row.id} className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              {row.clientName}
                              {row.isOrder && (
                                <span className="text-[9px] bg-[#3428f8]/15 text-[#9aaeff] border border-[#3428f8]/30 px-1.5 py-0.5 rounded uppercase font-bold">
                                  Registered Client
                                </span>
                              )}
                            </div>
                            {row.clientEmail && (
                              <p className="text-[11px] text-[#666]">{row.clientEmail}</p>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-[#ccc] bg-[#181818] border border-[#2a2a2a] px-2.5 py-1 rounded-lg">
                              {row.planName}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-mono font-bold text-white">
                                ₹{row.price.toLocaleString()}
                              </span>
                              {diff > 0 && (
                                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                  +₹{diff.toLocaleString()} Upsell
                                </span>
                              )}
                              {diff < 0 && (
                                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                  -₹{Math.abs(diff).toLocaleString()} Discount
                                </span>
                              )}
                              {diff === 0 && (
                                <span className="text-[10px] text-[#666] font-medium">
                                  Base Price
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {row.isOrder ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                <CheckCircle size={11} /> {row.status === 'pending_order' ? 'Order Pending' : 'Sold & Locked'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  updatePitchEntryStatus(
                                    row.id,
                                    row.status === 'sold' ? 'pitched' : 'sold'
                                  )
                                }
                                title="Click to toggle between Pitched and Agreed/Sold"
                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                                  row.status === 'sold'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                }`}
                              >
                                {row.status === 'sold' ? (
                                  <>
                                    <CheckCircle size={11} /> Agreed / Sold
                                  </>
                                ) : (
                                  <>
                                    <Clock size={11} /> Pitched (Click if Sold)
                                  </>
                                )}
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <p className="text-xs text-[#aaa] line-clamp-1">{row.notes}</p>
                            <p className="text-[10px] text-[#666]">
                              {row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const patch = { activePitchClient: row.clientName };
                                  if (pLower.includes('starter')) patch.starter = row.price;
                                  else if (pLower.includes('growth')) patch.growth = row.price;
                                  else if (pLower.includes('premium')) {
                                    patch.premium = Math.max(1000, row.price - Number(livePricing.websiteAddon || 5000));
                                  }
                                  await updateLivePricing(patch);
                                  triggerLiveToast(`🎯 Loaded ${row.clientName}'s price (₹${row.price.toLocaleString()}) LIVE onto the website!`);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                  isCurrentlyLive
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-[#1a1a1a] hover:bg-[#3428f8] text-[#ccc] hover:text-white border-[#2a2a2a]'
                                }`}
                              >
                                {isCurrentlyLive ? '✓ Live Now' : '🎯 Set Price Live'}
                              </button>

                              {!row.isOrder && (
                                <button
                                  type="button"
                                  onClick={() => deletePitchEntry(row.id)}
                                  className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Delete pitch log entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 bg-[#0a0a0a] p-1.5 rounded-2xl mb-6 inline-flex border border-[#222]">
        {[
          { id: 'All', label: 'All Orders' },
          { id: 'Pending', label: 'Pending Approval' },
          { id: 'Installments', label: 'EMI / Installments' },
          { id: 'Overdue', label: 'Overdue & Grace' },
          { id: 'Approved', label: 'Fully Cleared' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-5 py-2 text-xs uppercase font-bold tracking-wider rounded-xl transition-all cursor-pointer ${
              filter === tab.id 
                ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.35)]' 
                : 'text-[#666] hover:text-[#bbb]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Transactions / Retainers Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#222]">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#222]">
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Date & Order ID</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Client Info</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Contract & EMI Split</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Milestone Standing</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Invoices & Receipts</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((txn) => {
                const inst = txn.instMetrics;
                const isEmi = inst.hasInstallments && inst.installments.length > 1;
                const paidCount = inst.installments.filter(i => i.status === 'paid').length;
                const totalSplits = inst.installments.length;

                // Find next pending or pending_verification milestone
                const pendingVerificationInst = inst.installments.find(i => i.status === 'pending_verification');
                const nextUnpaidInst = inst.installments.find(i => i.status !== 'paid');

                return (
                  <tr key={txn.id} className="border-b border-[#222] bg-[#111] hover:bg-[#151515] transition-colors">
                    {/* Date & Order ID */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-mono font-bold text-sm">{txn.order_id}</span>
                        <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded border border-[#262626] font-medium">
                          {txn.plan_name}
                        </span>
                      </div>
                      <p className="text-[#666] text-xs">
                        {new Date(txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <button
                        onClick={() => setSelectedClientHistory(txn.client_id)}
                        className="inline-flex items-center gap-1.5 text-[10px] text-[#3428f8] hover:text-white font-bold uppercase tracking-wider bg-[#3428f8]/10 hover:bg-[#3428f8] px-2.5 py-1 rounded-lg border border-[#3428f8]/20 transition-all cursor-pointer shadow-sm mt-2"
                        title="View client lifetime statement"
                      >
                        <History size={11} /> Lifetime History
                      </button>
                    </td>

                    {/* Client Info */}
                    <td className="p-4">
                      <p className="text-white font-medium text-sm mb-0.5">{txn.client.name}</p>
                      <p className="text-[#666] text-xs font-mono mb-1">{txn.client.email}</p>
                      {txn.client.phone && (
                        <p className="text-[#555] text-[11px] font-mono">{txn.client.phone}</p>
                      )}
                    </td>

                    {/* Contract & EMI Split */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono font-bold text-base">
                            ₹{inst.totalAgreed.toLocaleString()}
                          </span>
                          {inst.discountAmount > 0 && (
                            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              ₹{inst.discountAmount.toLocaleString()} OFF
                            </span>
                          )}
                        </div>

                        {inst.discountAmount > 0 && (
                          <span className="text-[#666] text-[11px] line-through">
                            Listed: ₹{inst.standardPrice.toLocaleString()}
                          </span>
                        )}

                        <div className="text-xs mt-1">
                          <span className="text-green-400 font-mono font-medium">₹{inst.paidAmount.toLocaleString()} Paid</span>
                          {inst.balanceDue > 0 && (
                            <span className="text-yellow-400 font-mono font-medium ml-2">
                              • ₹{inst.balanceDue.toLocaleString()} Due
                            </span>
                          )}
                        </div>

                        {/* EMI Badge */}
                        <div className="mt-1 flex items-center gap-2">
                          {isEmi ? (
                            <span className="text-[10px] bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              EMI {paidCount}/{totalSplits} Paid
                            </span>
                          ) : (
                            <span className="text-[10px] bg-[#1a1a1a] text-[#777] border border-[#282828] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              Single Payment
                            </span>
                          )}

                          <button 
                            onClick={() => handleOpenConfigurator(txn)}
                            className="inline-flex items-center gap-1.5 bg-[#1b1b1b] hover:bg-[#3428f8] text-[#ddd] hover:text-white border border-[#333] hover:border-[#3428f8] px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                            title="Edit agreed price, discount, or installment plan"
                          >
                            <Edit3 size={11} className="text-[#3428f8]" />
                            Edit Payment & EMIs
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Milestone Standing & Account Status */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {/* Account Status Pill */}
                        {txn.status === 'active' && (
                          <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle size={10} /> Active Retainer
                          </span>
                        )}
                        {txn.status === 'pending' && (
                          <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <Clock size={10} /> Pending Approval
                          </span>
                        )}
                        {txn.status === 'paused' && (
                          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <PauseCircle size={10} /> Suspended / Paused
                          </span>
                        )}
                        {txn.status === 'cancelled' && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <XCircle size={10} /> Cancelled
                          </span>
                        )}

                        {/* Milestone State Details */}
                        {pendingVerificationInst && (
                          <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider animate-pulse">
                            EMI #{pendingVerificationInst.installment_number} Proof Uploaded
                          </span>
                        )}

                        {!pendingVerificationInst && inst.isOverdue && (
                          <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1">
                            <AlertTriangle size={10} /> Overdue ({inst.daysOverdue}d)
                          </span>
                        )}

                        {!pendingVerificationInst && !inst.isOverdue && inst.inGracePeriod && (
                          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1">
                            <Clock size={10} /> Grace Period ({inst.graceDaysLeft}d left)
                          </span>
                        )}

                        {inst.isFullyPaid && txn.status !== 'pending' && (
                          <span className="text-[#666] text-[10px] flex items-center gap-1">
                            <Check size={11} className="text-green-400" /> Fully Paid in Full
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Invoice & Receipts */}
                    <td className="p-4">
                      <div className="flex flex-col gap-2 items-start">
                        <button
                          onClick={() => generateSingleInvoicePDF(txn, txn.client)}
                          className="inline-flex items-center gap-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] hover:border-[#3428f8] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                          title="Generate official PDF Tax Invoice with milestone table"
                        >
                          <FileDown size={12} className="text-[#3428f8]" />
                          PDF Invoice
                        </button>

                        {/* Receipt Link */}
                        {(pendingVerificationInst?.receipt_url || txn.payment_receipt_url) ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(pendingVerificationInst?.receipt_url || txn.payment_receipt_url)}
                            className="inline-flex items-center gap-1 text-[#aaa] hover:text-white text-[10px] font-medium tracking-wider transition-colors"
                          >
                            <Eye size={11} className="text-purple-400" /> View Receipt Proof
                          </button>
                        ) : (
                          <span className="text-[#444] text-[9px] font-mono">No receipt proof</span>
                        )}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Always Visible: Edit Payment & EMIs */}
                        <button 
                          onClick={() => handleOpenConfigurator(txn)}
                          className="bg-[#1c1c1c] hover:bg-[#3428f8] text-[#ddd] hover:text-white border border-[#333] hover:border-[#3428f8] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm group"
                          title="Edit payment amounts, discounts, and installment schedule"
                        >
                          <Edit3 size={13} className="text-[#3428f8] group-hover:text-white transition-colors" />
                          Edit Payment
                        </button>

                        {/* 1. Pending Initial Order Approval */}
                        {txn.status === 'pending' && (
                          <button 
                            onClick={() => handleOpenConfigurator(txn)}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
                            title="Approve order and configure agreed pricing & EMIs"
                          >
                            <CheckCircle size={14} /> Accept Order
                          </button>
                        )}

                        {/* 2. Client Uploaded Proof for Verification */}
                        {txn.status !== 'pending' && pendingVerificationInst && (
                          <button 
                            onClick={() => handleOpenVerifyModal(txn, pendingVerificationInst)}
                            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer"
                            title="Verify client uploaded payment receipt"
                          >
                            <ShieldCheck size={14} /> Verify EMI #{pendingVerificationInst.installment_number}
                          </button>
                        )}

                        {/* 3. Record Next Unpaid Installment */}
                        {txn.status !== 'pending' && !pendingVerificationInst && nextUnpaidInst && (
                          <button 
                            onClick={() => handleOpenVerifyModal(txn, nextUnpaidInst)}
                            className="bg-[#3428f8]/15 hover:bg-[#3428f8]/25 text-[#3428f8] hover:text-white border border-[#3428f8]/30 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                            title="Record manual UPI/cash payment for next milestone"
                          >
                            <CreditCard size={12} /> Record EMI #{nextUnpaidInst.installment_number}
                          </button>
                        )}

                        {/* Plan Status Controls (Pause/Resume/Cancel) */}
                        {txn.status === 'active' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'paused')}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 p-2 rounded-xl transition-colors cursor-pointer" 
                            title="Pause Plan Access"
                          >
                            <PauseCircle size={16} />
                          </button>
                        )}
                        {txn.status === 'paused' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'active')}
                            className="bg-green-500/10 hover:bg-green-500/20 text-green-400 p-2 rounded-xl transition-colors cursor-pointer" 
                            title="Resume Plan Access"
                          >
                            <PlayCircle size={16} />
                          </button>
                        )}
                        {['active', 'paused', 'pending'].includes(txn.status) && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'cancelled')}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl transition-colors cursor-pointer" 
                            title="Cancel Order"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-[#666]">
                    No transactions or orders found matching the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. INSTALLMENT & PRICING CONFIGURATOR MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {configModalOrder && (() => {
          const stdPrice = configModalOrder.standardPrice || getStandardPlanPrice(configModalOrder.plan_name);
          const currentInputVal = Number(agreedPriceInput || 0);
          const discountVal = Math.max(0, stdPrice - currentInputVal);
          const discountPercent = stdPrice > 0 ? Math.round((discountVal / stdPrice) * 100) : 0;
          const isPending = configModalOrder.status === 'pending';

          const milestonesSum = configInstallments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
          const sumDiff = currentInputVal - milestonesSum;
          const isBalanced = Math.abs(sumDiff) <= 1;

          const totalPaidNow = configInstallments
            .filter(inst => inst.status === 'paid')
            .reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
          const remainingBalVal = Math.max(0, currentInputVal - totalPaidNow);
          const isFullyPaidNow = configInstallments.length > 0 && remainingBalVal === 0 && configInstallments.every(inst => inst.status === 'paid');

          const quickPresets = [];
          if (stdPrice === 3500) {
            quickPresets.push({ label: '₹3,500 (Full)', price: 3500 });
            quickPresets.push({ label: '₹3,000 (₹500 off)', price: 3000 });
            quickPresets.push({ label: '₹2,500 (₹1k off)', price: 2500 });
            quickPresets.push({ label: '₹2,000 (Special)', price: 2000 });
          } else if (stdPrice === 6000) {
            quickPresets.push({ label: '₹6,000 (Full)', price: 6000 });
            quickPresets.push({ label: '₹5,000 (₹1k off)', price: 5000 });
            quickPresets.push({ label: '₹4,000 (₹2k off)', price: 4000 });
            quickPresets.push({ label: '₹3,500 (₹2.5k off)', price: 3500 });
          } else if (stdPrice === 11000) {
            quickPresets.push({ label: '₹11,000 (Full)', price: 11000 });
            quickPresets.push({ label: '₹10,000 (₹1k off)', price: 10000 });
            quickPresets.push({ label: '₹8,500 (Discount)', price: 8500 });
          } else {
            quickPresets.push({ label: `₹${stdPrice.toLocaleString()} (Full)`, price: stdPrice });
            if (stdPrice > 1000) {
              quickPresets.push({ label: `₹${(stdPrice - 500).toLocaleString()}`, price: stdPrice - 500 });
              quickPresets.push({ label: `₹${(stdPrice - 1000).toLocaleString()}`, price: stdPrice - 1000 });
            }
          }

          return (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => !savingPlan && setConfigModalOrder(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[92vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-[#222]">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
                      <Tag size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif text-white">
                        {isPending ? 'Approve Retainer & Set Payment Plan' : 'Edit Client Payment & Milestone Schedule'}
                      </h3>
                      <p className="text-xs text-[#888]">
                        Order ID: <span className="font-mono text-white font-bold">{configModalOrder.order_id}</span> • {configModalOrder.client?.name}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => !savingPlan && setConfigModalOrder(null)}
                    className="text-[#666] hover:text-white p-2 rounded-full bg-[#1a1a1a] transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body - Scrollable */}
                <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-6 py-4 custom-scrollbar">
                  {/* Package Summary Box */}
                  <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[#888] text-xs uppercase font-bold tracking-wider block mb-0.5">Package Selected</span>
                      <span className="text-white font-medium text-sm">{configModalOrder.plan_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#888] text-xs uppercase font-bold tracking-wider block mb-0.5">Standard Listed Price</span>
                      <span className="text-white font-mono font-bold text-sm">₹{stdPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Section 1: Agreed Contract Price */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                      1. Agreed Total Contract Price (₹)
                    </label>
                    <div className="relative mb-3">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold text-lg">₹</span>
                      <input 
                        type="number" 
                        min="0"
                        step="100"
                        value={agreedPriceInput}
                        onChange={(e) => handleAgreedPriceChange(e.target.value)}
                        placeholder="e.g. 3000"
                        className="w-full bg-[#0a0a0a] border border-[#333] focus:border-emerald-500 text-white font-mono text-2xl font-bold p-3.5 pl-9 rounded-xl outline-none transition-colors"
                      />
                    </div>

                    {/* Discount Feedback */}
                    {discountVal > 0 ? (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                          <CheckCircle size={14} />
                          <span>Custom Discount: Client saves ₹{discountVal.toLocaleString()} ({discountPercent}% OFF)</span>
                        </div>
                        <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                          -{discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-[#181818] border border-[#262626] rounded-xl text-center mb-3">
                        <p className="text-[#777] text-xs">Standard Price (No discount applied)</p>
                      </div>
                    )}

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2">
                      {quickPresets.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAgreedPriceChange(String(preset.price))}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                            Number(agreedPriceInput) === preset.price
                              ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                              : 'bg-[#181818] hover:bg-[#222] text-[#ccc] border-[#333]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Installment Split Plan */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#aaa]">
                        2. Payment Milestone Strategy
                      </label>
                      <button
                        type="button"
                        onClick={handleAddMilestone}
                        className="text-[11px] text-[#3428f8] hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Milestone
                      </button>
                    </div>

                    {/* Dedicated Complete Payment Option */}
                    <div className={`mb-4 p-4 rounded-2xl border transition-all ${
                      isFullyPaidNow 
                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]' 
                        : 'bg-[#15171d] border-[#2d3045] hover:border-emerald-500/50'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${
                            isFullyPaidNow 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            <CheckCircle size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">Complete Payment Option</h4>
                              {isFullyPaidNow ? (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Check size={10} className="stroke-[3]" /> 100% Paid (₹0 Due)
                                </span>
                              ) : (
                                <span className="text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  ₹{remainingBalVal.toLocaleString()} Remaining
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#888] mt-0.5">
                              If the client gave the full payment at once, mark everything as paid with 1 click.
                            </p>
                            {configInstallments.length > 1 && !isFullyPaidNow && (
                              <button
                                type="button"
                                onClick={() => handleMarkCompletePayment(true)}
                                className="text-[11px] text-[#3428f8] hover:text-white underline cursor-pointer mt-1 font-medium inline-block"
                              >
                                Or convert to 1x single full payment
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleMarkCompletePayment(false)}
                            disabled={isFullyPaidNow}
                            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isFullyPaidNow
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default font-medium'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-[0.98]'
                            }`}
                            title="Mark all installments as paid in full"
                          >
                            <Check size={14} className="stroke-[3]" />
                            {isFullyPaidNow ? 'Completed in Full ✓' : 'Complete Payment'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Split Buttons */}
                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      <button
                        type="button"
                        onClick={() => handleSelectSplit(1)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          splitCount === 1 
                            ? 'bg-[#3428f8]/20 border-[#3428f8] text-white' 
                            : 'bg-[#141414] border-[#252525] text-[#888] hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider">1x Complete Payment</p>
                        <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">100% upfront (Single)</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSplit(2)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          splitCount === 2 
                            ? 'bg-[#3428f8]/20 border-[#3428f8] text-white' 
                            : 'bg-[#141414] border-[#252525] text-[#888] hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider">2x EMIs (50/50)</p>
                        <p className="text-[10px] text-[#666] mt-0.5">Advance + 1 Milestone</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSplit(3)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          splitCount === 3 
                            ? 'bg-[#3428f8]/20 border-[#3428f8] text-white' 
                            : 'bg-[#141414] border-[#252525] text-[#888] hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider">3x EMIs</p>
                        <p className="text-[10px] text-[#666] mt-0.5">40% / 30% / 30%</p>
                      </button>
                    </div>

                    {/* Milestone Items Form */}
                    <div className="flex flex-col gap-3">
                      {configInstallments.map((inst, idx) => (
                        <div key={idx} className="bg-[#141414] border border-[#252525] rounded-xl p-3.5 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#222] text-white text-xs font-bold flex items-center justify-center font-mono">
                              #{inst.installment_number}
                            </span>
                            <div>
                              <p className="text-white text-xs font-bold">{inst.notes || `Milestone ${inst.installment_number}`}</p>
                              <span className="text-[10px] text-[#666]">Due: {inst.due_date}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* Amount Input */}
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888] text-xs">₹</span>
                              <input 
                                type="number"
                                min="0"
                                value={inst.amount}
                                onChange={(e) => {
                                  const updated = [...configInstallments];
                                  updated[idx].amount = Number(e.target.value);
                                  setConfigInstallments(updated);
                                }}
                                className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs font-mono font-bold p-2 pl-6 rounded-lg outline-none"
                              />
                            </div>

                            {/* Due Date Input */}
                            <input 
                              type="date"
                              value={inst.due_date || ''}
                              onChange={(e) => {
                                const updated = [...configInstallments];
                                updated[idx].due_date = e.target.value;
                                setConfigInstallments(updated);
                              }}
                              className="bg-[#0a0a0a] border border-[#333] text-white text-xs font-mono p-2 rounded-lg outline-none"
                            />

                            {/* Status Selector */}
                            <select
                              value={inst.status}
                              onChange={(e) => {
                                const updated = [...configInstallments];
                                updated[idx].status = e.target.value;
                                if (e.target.value === 'paid' && !updated[idx].paid_at) {
                                  updated[idx].paid_at = new Date().toISOString();
                                }
                                setConfigInstallments(updated);
                              }}
                              className={`text-xs font-bold rounded-lg p-2 border outline-none ${
                                inst.status === 'paid' 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                                  : inst.status === 'pending_verification'
                                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              }`}
                            >
                              <option value="paid" className="bg-[#111] text-green-400">Paid</option>
                              <option value="pending" className="bg-[#111] text-yellow-400">Pending</option>
                              <option value="pending_verification" className="bg-[#111] text-purple-400">Review</option>
                            </select>

                            {/* Delete Button */}
                            {configInstallments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMilestone(idx)}
                                className="text-[#666] hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                                title="Remove milestone"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Milestone Balance Validation */}
                    <div className="mt-3 flex justify-between items-center text-xs">
                      <span className="text-[#888]">
                        Milestone Total: <strong className="text-white font-mono">₹{milestonesSum.toLocaleString()}</strong> / Agreed: <strong className="text-white font-mono">₹{currentInputVal.toLocaleString()}</strong>
                      </span>

                      {!isBalanced && (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">
                            Difference: ₹{Math.abs(sumDiff).toLocaleString()} {sumDiff > 0 ? 'unallocated' : 'exceeded'}
                          </span>
                          <button
                            type="button"
                            onClick={handleAutoBalance}
                            className="bg-[#3428f8]/20 hover:bg-[#3428f8] text-[#3428f8] hover:text-white px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                          >
                            Auto-Balance
                          </button>
                        </div>
                      )}

                      {isBalanced && (
                        <span className="text-green-400 font-bold flex items-center gap-1">
                          <Check size={12} /> Milestones Match 100%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Grace Period Config */}
                  <div className="bg-[#161616] border border-[#252525] rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-white font-bold text-xs uppercase tracking-wider block">
                          3. Overdue Grace Period (Auto-Suspension)
                        </span>
                        <p className="text-[#777] text-xs">
                          Number of days after due date before client dashboard is automatically suspended.
                        </p>
                      </div>

                      <select
                        value={gracePeriodInput}
                        onChange={(e) => setGracePeriodInput(Number(e.target.value))}
                        className="bg-[#0a0a0a] border border-[#333] text-white text-xs font-bold p-2.5 rounded-xl outline-none"
                      >
                        <option value={1}>1 Day Grace</option>
                        <option value={2}>2 Days Grace</option>
                        <option value={3}>3 Days Grace (Standard)</option>
                        <option value={5}>5 Days Grace</option>
                        <option value={7}>7 Days Grace (Flexible)</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Contract & Payment Summary Card */}
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Agreed Contract Value</span>
                      <span className="text-white font-mono font-bold text-lg">₹{currentInputVal.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Paid So Far</span>
                      <span className="text-green-400 font-mono font-bold text-lg">
                        ₹{totalPaidNow.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#888] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Remaining Balance</span>
                      <span className={`font-mono font-bold text-lg ${remainingBalVal === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        ₹{remainingBalVal.toLocaleString()}
                        {remainingBalVal === 0 && (
                          <span className="text-xs ml-1.5 font-sans font-medium text-green-400">(Paid in Full ✓)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-[#222] flex gap-3">
                  <button
                    type="button"
                    onClick={() => !savingPlan && setConfigModalOrder(null)}
                    disabled={savingPlan}
                    className="flex-1 bg-[#1a1a1a] hover:bg-[#252525] text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfigPlan}
                    disabled={savingPlan || !isBalanced}
                    className={`flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isBalanced 
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                        : 'bg-[#222] text-[#666] cursor-not-allowed'
                    }`}
                  >
                    {savingPlan ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></span>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        {isFullyPaidNow
                          ? '✓ Save & Complete Payment'
                          : (isPending ? 'Approve & Activate Retainer' : 'Save Payment Changes')}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 2. QUICK MILESTONE PAYMENT VERIFICATION MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {verifyModalData && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => !verifyingMilestone && setVerifyModalData(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => !verifyingMilestone && setVerifyModalData(null)}
                className="absolute top-6 right-6 text-[#666] hover:text-white p-2 rounded-full bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-white">Verify Installment Payment</h3>
                  <p className="text-xs text-[#888]">
                    Milestone #{verifyModalData.installment.installment_number} • {verifyModalData.order.client?.name}
                  </p>
                </div>
              </div>

              {/* Amount & Due Date Box */}
              <div className="bg-[#161616] border border-[#252525] rounded-2xl p-4 mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#888] text-xs uppercase font-bold tracking-wider">Amount to Confirm</span>
                  <span className="text-2xl font-serif text-green-400 font-bold">
                    ₹{Number(verifyModalData.installment.amount).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-[#666] pt-2 border-t border-[#222] flex justify-between">
                  <span>Scheduled Due Date:</span>
                  <span className="text-white font-mono">{verifyModalData.installment.due_date}</span>
                </div>
              </div>

              {/* Receipt Preview if uploaded by client */}
              {verifyModalData.receiptUrl && (
                <div className="mb-5">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                    Client Uploaded Payment Screenshot
                  </span>
                  <div 
                    onClick={() => setPreviewReceiptUrl(verifyModalData.receiptUrl)}
                    className="relative rounded-xl overflow-hidden border border-[#333] max-h-48 group cursor-pointer"
                  >
                    <img 
                      src={verifyModalData.receiptUrl} 
                      alt="Payment Receipt" 
                      className="w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                      <Eye size={14} /> Click to Enlarge
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction ID / UTR Input */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                  Transaction Reference / UTR Number
                </label>
                <input 
                  type="text"
                  value={verifyModalData.txnId}
                  onChange={(e) => setVerifyModalData({ ...verifyModalData, txnId: e.target.value })}
                  placeholder="e.g. 427819284719"
                  className="w-full bg-[#0a0a0a] border border-[#333] focus:border-purple-500 text-white font-mono text-sm p-3 rounded-xl outline-none transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !verifyingMilestone && setVerifyModalData(null)}
                  disabled={verifyingMilestone}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#252525] text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVerifyMilestone}
                  disabled={verifyingMilestone}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-black py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2 cursor-pointer font-bold"
                >
                  {verifyingMilestone ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></span>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Confirm & Activate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 3. RECEIPT PREVIEW MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#333] rounded-3xl p-4 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#222]">
                <span className="text-white text-xs font-bold uppercase tracking-wider">Payment Receipt Proof</span>
                <div className="flex items-center gap-2">
                  <a 
                    href={previewReceiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#3428f8] hover:text-white text-xs flex items-center gap-1 font-bold"
                  >
                    Open Original <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => setPreviewReceiptUrl(null)}
                    className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="overflow-auto flex items-center justify-center p-2 mt-2">
                <img 
                  src={previewReceiptUrl} 
                  alt="Receipt Preview" 
                  className="max-h-[75vh] w-auto rounded-xl object-contain border border-[#222]" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 4. LIFETIME TRANSACTION HISTORY MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {selectedClientHistory && (() => {
          const clientTxns = transactions.filter(t => t.client_id === selectedClientHistory);
          const clientInfo = clientTxns[0]?.client || { name: 'Client', email: '' };
          const approvedSpent = clientTxns
            .filter(t => ['active', 'paused', 'cancelled'].includes(t.status))
            .reduce((sum, t) => sum + Number(t.instMetrics?.paidAmount || t.amount_paid || 0), 0);

          return (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => setSelectedClientHistory(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-[#222]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#3428f8]/10 text-[#3428f8]">
                      <History size={22} />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-serif">{clientInfo.name}</h3>
                      <p className="text-[#666] text-xs font-mono">{clientInfo.email || 'Lifetime Financial History'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generateLifetimeStatementPDF(clientInfo, clientTxns)}
                      className="inline-flex items-center gap-1.5 bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
                      title="Download complete lifetime statement PDF"
                    >
                      <FileDown size={14} />
                      Statement PDF
                    </button>

                    <button 
                      onClick={() => setSelectedClientHistory(null)}
                      className="text-[#666] hover:text-white p-1 rounded-lg hover:bg-[#222] transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Lifetime Summary */}
                <div className="grid grid-cols-3 gap-3 my-4">
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Total Verified Paid</span>
                    <span className="text-green-400 font-serif text-xl font-bold">₹{approvedSpent.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Total Orders</span>
                    <span className="text-white font-serif text-xl font-bold">{clientTxns.length}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Account Standing</span>
                    <span className="text-[#3428f8] font-bold text-xs uppercase tracking-wider block mt-1">Verified Client</span>
                  </div>
                </div>

                {/* Transactions List */}
                <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3 custom-scrollbar">
                  {clientTxns.map((t, idx) => (
                    <div key={idx} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-[#333] transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-sm">{t.plan_name}</span>
                          {t.status === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Active</span>}
                          {t.status === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Pending</span>}
                          {t.status === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Paused</span>}
                          {t.status === 'cancelled' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Cancelled</span>}
                        </div>
                        <p className="text-[#666] text-xs font-mono">
                          Order: {t.order_id} • TXN: {t.payment_id || 'N/A'}
                        </p>
                        <p className="text-[#555] text-[10px] mt-0.5">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(t.created_at).toLocaleTimeString()}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#1a1a1a]">
                        <span className="text-white font-serif font-bold text-base">
                          ₹{Number(t.instMetrics?.paidAmount || t.amount_paid || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => generateSingleInvoicePDF(t, clientInfo)}
                            className="inline-flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-[#3428f8] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            title="Download PDF invoice"
                          >
                            <FileDown size={11} className="text-[#3428f8]" />
                            Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-[#222] flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedClientHistory(null)}
                    className="bg-[#1a1a1a] hover:bg-[#252525] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 5. POPUP: SPECIAL DISCOUNTS BREAKDOWN */}
      {/* ============================================================== */}
      <AnimatePresence>
        {popupType === 'discount' && (() => {
          const discountedOrders = transactions.filter(t => (t.instMetrics?.discountAmount || t.discountAmount || 0) > 0);

          return (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setPopupType(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-[#222]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Tag size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif text-white">Special Discounts Breakdown</h3>
                      <p className="text-xs text-[#888]">
                        Total Concessions: <span className="font-mono text-emerald-400 font-bold">₹{metrics.totalDiscounts.toLocaleString()}</span> across {discountedOrders.length} client{discountedOrders.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setPopupType(null)}
                    className="text-[#666] hover:text-white p-1.5 rounded-full hover:bg-[#222] transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3 py-4 custom-scrollbar">
                  {discountedOrders.length === 0 ? (
                    <div className="text-center py-10 text-[#666]">
                      <Tag size={32} className="mx-auto mb-2 opacity-40 text-emerald-400" />
                      <p className="text-sm text-white font-medium">No special discounts active</p>
                      <p className="text-xs text-[#777] mt-1">All retainers are currently charged standard listed fees.</p>
                    </div>
                  ) : (
                    discountedOrders.map((t) => {
                      const std = t.instMetrics?.standardPrice || t.standardPrice || 3500;
                      const disc = t.instMetrics?.discountAmount || t.discountAmount || 0;
                      const finalAmt = t.instMetrics?.totalAgreed || t.totalAgreed || (std - disc);
                      const discPct = std > 0 ? Math.round((disc / std) * 100) : 0;

                      return (
                        <div key={t.id} className="bg-[#141414] border border-[#252525] hover:border-[#333] rounded-2xl p-4 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-white font-bold text-sm">{t.client?.name || 'Client'}</h4>
                              <p className="text-[#666] text-xs font-mono">{t.plan_name} • {t.order_id}</p>
                            </div>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                              -{discPct}% OFF
                            </span>
                          </div>

                          {/* 3 Metrics: Original Fees, Discount Amount, Final Amount */}
                          <div className="grid grid-cols-3 gap-2 bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                            <div>
                              <span className="text-[10px] text-[#777] uppercase font-bold tracking-wider block mb-0.5">Original Fees</span>
                              <span className="text-[#888] font-mono text-xs line-through block">₹{std.toLocaleString()}</span>
                            </div>

                            <div className="border-x border-[#1f1f1f]">
                              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block mb-0.5">Discount</span>
                              <span className="text-emerald-400 font-mono text-xs font-bold block">-₹{disc.toLocaleString()}</span>
                            </div>

                            <div>
                              <span className="text-[10px] text-white uppercase font-bold tracking-wider block mb-0.5">Final Amount</span>
                              <span className="text-white font-mono text-sm font-bold block">₹{finalAmt.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                setPopupType(null);
                                handleOpenConfigurator(t);
                              }}
                              className="text-[10px] text-[#3428f8] hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 size={11} /> Edit Payment
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-[#222] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPopupType(null)}
                    className="bg-[#1a1a1a] hover:bg-[#252525] text-white px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-[#222] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 6. POPUP: RETAINERS & CLIENT PLANS LIST */}
      {/* ============================================================== */}
      <AnimatePresence>
        {popupType === 'retainer' && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPopupType(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-start pb-4 border-b border-[#222]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-white">Retainers & Client Plans</h3>
                    <p className="text-xs text-[#888]">
                      {transactions.length} registered order{transactions.length === 1 ? '' : 's'} • {metrics.activeEmis} on milestone EMIs
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setPopupType(null)}
                  className="text-[#666] hover:text-white p-1.5 rounded-full hover:bg-[#222] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3 py-4 custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className="text-center py-10 text-[#666]">
                    <Layers size={32} className="mx-auto mb-2 opacity-40 text-[#3428f8]" />
                    <p className="text-sm text-white font-medium">No client retainers found</p>
                  </div>
                ) : (
                  transactions.map((t) => {
                    const isEmi = t.instMetrics?.hasInstallments && t.instMetrics.installments.length > 1;
                    const paidCount = t.instMetrics?.installments?.filter(i => i.status === 'paid')?.length || 0;
                    const totalSplits = t.instMetrics?.installments?.length || 1;

                    return (
                      <div key={t.id} className="bg-[#141414] border border-[#252525] hover:border-[#333] rounded-2xl p-4 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            {/* Client Name */}
                            <h4 className="text-white font-bold text-sm">{t.client?.name || 'Client'}</h4>
                            <p className="text-[#666] text-xs font-mono">{t.client?.email}</p>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {t.status === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>}
                            {t.status === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">Pending</span>}
                            {t.status === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Paused</span>}
                            {t.status === 'cancelled' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Cancelled</span>}
                          </div>
                        </div>

                        {/* Plan & Pricing Box */}
                        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 flex justify-between items-center mt-2">
                          <div>
                            <span className="text-[10px] text-[#777] uppercase font-bold tracking-wider block mb-0.5">Retainer Package</span>
                            <span className="text-[#3428f8] font-bold text-xs">{t.plan_name}</span>
                            <span className="text-[#555] text-[10px] font-mono block mt-0.5">{t.order_id}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-[#777] uppercase font-bold tracking-wider block mb-0.5">Payment Standing</span>
                            <span className="text-white font-mono font-bold text-xs">
                              ₹{(t.instMetrics?.paidAmount || t.amount_paid || 0).toLocaleString()} / ₹{(t.instMetrics?.totalAgreed || t.amount_paid || 0).toLocaleString()}
                            </span>
                            {isEmi && (
                              <span className="text-[9px] text-[#888] font-mono block mt-0.5">
                                EMI {paidCount}/{totalSplits} Paid
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex justify-between items-center pt-2 border-t border-[#1a1a1a]">
                          <span className="text-[10px] text-[#666]">
                            Joined {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>

                          <button
                            onClick={() => {
                              setPopupType(null);
                              handleOpenConfigurator(t);
                            }}
                            className="text-[10px] text-[#3428f8] hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit Payment
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-[#222] flex justify-end">
                <button
                  type="button"
                  onClick={() => setPopupType(null)}
                  className="bg-[#1a1a1a] hover:bg-[#252525] text-white px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-[#222] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
