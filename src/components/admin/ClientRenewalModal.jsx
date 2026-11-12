import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, Calendar, IndianRupee, Copy, Check,
  AlertCircle, ArrowRight, CheckCircle2, Edit3,
  ShieldAlert, Upload, Trash2, Eye, Plus, Minus,
  Layers, CreditCard, RotateCcw, Image as ImageIcon, Video, Flame, Layout
} from 'lucide-react';
import {
  createRenewalCycle,
  updateRenewalCycle,
  calculateCycleEndDate,
  getPlanDefaultQuotas,
  UPI_PAYMENT_DETAILS
} from '../../utils/renewalEngine';
import { generateDefaultInstallmentPlan } from '../../utils/installmentEngine';

function addDaysToIsoDate(baseDateStr, days) {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().split('T')[0];
  }
  base.setDate(base.getDate() + days);
  return base.toISOString().split('T')[0];
}

function collectOrderReceiptUrls(orderObj) {
  if (!orderObj) return [];
  const urls = new Set();
  if (orderObj.payment_receipt_url) urls.add(orderObj.payment_receipt_url);
  if (Array.isArray(orderObj.schedule_config?.receipt_urls)) {
    orderObj.schedule_config.receipt_urls.filter(Boolean).forEach((u) => urls.add(u));
  }
  const insts = Array.isArray(orderObj.installments)
    ? orderObj.installments
    : (Array.isArray(orderObj.schedule_config?.installments) ? orderObj.schedule_config.installments : []);
  insts.forEach((m) => {
    if (m?.receipt_url) urls.add(m.receipt_url);
    if (Array.isArray(m?.receipt_urls)) {
      m.receipt_urls.filter(Boolean).forEach((u) => urls.add(u));
    }
  });
  return Array.from(urls);
}

function extractEditableNotes(rawNotes = '') {
  if (!rawNotes) return '';
  const autoTagRe = /^(Full Payment|2x EMI|3x EMI|Custom \d+x EMI|\d+S\/\d+R|\d+\s*screenshot\(s\)|Monthly (package renewal|plan details) for Cycle #\d+)/i;
  return rawNotes
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part && !autoTagRe.test(part))
    .join(' | ');
}

export default function ClientRenewalModal({
  isOpen,
  onClose,
  client,
  currentOrder,
  latestCycle,
  mode = 'create',
  targetCycle = null,
  targetOrder = null,
  onRenewalSuccess
}) {
  const [modalMode, setModalMode] = useState(mode === 'edit' ? 'edit' : 'create');
  const [activeEditCycle, setActiveEditCycle] = useState(targetCycle || null);
  const [activeEditOrder, setActiveEditOrder] = useState(targetOrder || null);

  const [packageName, setPackageName] = useState('Starter Plan');
  const [amount, setAmount] = useState('3500');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endDateManuallyEdited, setEndDateManuallyEdited] = useState(false);
  const [notes, setNotes] = useState('');

  // Customizable deliverables count state
  const [staticCount, setStaticCount] = useState(12);
  const [reelsCount, setReelsCount] = useState(8);
  const [storiesCount, setStoriesCount] = useState(15);
  const [postersCount, setPostersCount] = useState(0);
  const [hasWebsiteAddon, setHasWebsiteAddon] = useState(false);

  // Payment structure / EMI & proof details
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' | 'emi_2' | 'emi_3' | 'custom'
  const [fullPaymentStatus, setFullPaymentStatus] = useState('pending'); // 'pending' | 'paid' | 'pending_verification'
  const [paymentChannel, setPaymentChannel] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [installments, setInstallments] = useState([]);

  // Payment proof screenshots (saved DB URLs in edit mode + staged local files)
  const [savedReceiptUrls, setSavedReceiptUrls] = useState([]);
  const [receiptFiles, setReceiptFiles] = useState([]); // Array of { id, file, previewUrl, name }
  const [previewZoomUrl, setPreviewZoomUrl] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Success view state after submission
  const [renewalResult, setRenewalResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Available package presets
  const PACKAGE_OPTIONS = [
    { id: 'Starter Plan', label: 'Starter Plan', defaultPrice: 3500, desc: '12 Static • 8 Reels • 15 Stories' },
    { id: 'Growth Plan', label: 'Growth Plan', defaultPrice: 6000, desc: '15 Static • 12 Reels • 15 Stories' },
    { id: 'Premium Plan', label: 'Premium Plan', defaultPrice: 8000, desc: '15 Static • 12 Reels • 15 Stories + Web' }
  ];

  const cleanupStagedPreviews = (filesList) => {
    (filesList || []).forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const hydrateForm = useCallback(({ nextMode, cycleObj, orderObj }) => {
    setErrorMsg('');
    setDuplicateWarning(null);
    setRenewalResult(null);
    setCopied(false);
    setPreviewZoomUrl(null);
    setReceiptFiles((prev) => {
      cleanupStagedPreviews(prev);
      return [];
    });

    const isEditing = nextMode === 'edit';
    setModalMode(isEditing ? 'edit' : 'create');
    setActiveEditCycle(isEditing ? (cycleObj || null) : null);
    setActiveEditOrder(isEditing ? (orderObj || null) : null);
    setEndDateManuallyEdited(false);

    const initialPackage = cycleObj?.package || orderObj?.plan_name || 'Starter Plan';
    setPackageName(initialPackage);

    const planDefaults = getPlanDefaultQuotas(initialPackage);
    const fallbackAmount = orderObj?.total_agreed_amount || orderObj?.amount_paid || planDefaults.defaultPrice;
    const initialAmount = cycleObj?.amount !== undefined && cycleObj?.amount !== null
      ? String(cycleObj.amount)
      : String(fallbackAmount);
    setAmount(initialAmount);

    if (isEditing) {
      const editStart = cycleObj?.delivery_start_date
        || orderObj?.first_upload_date
        || new Date().toISOString().split('T')[0];
      const editEnd = cycleObj?.delivery_end_date || calculateCycleEndDate(editStart);
      setStartDate(editStart);
      setEndDate(editEnd);

      const staticVal = orderObj?.static_posts_total ?? orderObj?.schedule_config?.totalStatic ?? planDefaults.staticPosts;
      const reelsVal = orderObj?.reels_total ?? orderObj?.schedule_config?.totalReels ?? planDefaults.reels;
      const storiesVal = orderObj?.stories_total ?? orderObj?.schedule_config?.totalStories ?? planDefaults.stories;
      const postersVal = orderObj?.posters_total ?? orderObj?.schedule_config?.totalPosters ?? planDefaults.posters;
      setStaticCount(Number(staticVal || 0));
      setReelsCount(Number(reelsVal || 0));
      setStoriesCount(Number(storiesVal || 0));
      setPostersCount(Number(postersVal || 0));
      setHasWebsiteAddon(
        orderObj?.has_website !== undefined ? Boolean(orderObj.has_website) : planDefaults.hasWebsite
      );

      const instList = Array.isArray(orderObj?.installments) && orderObj.installments.length > 0
        ? orderObj.installments
        : (Array.isArray(orderObj?.schedule_config?.installments) ? orderObj.schedule_config.installments : []);

      if (instList.length > 1) {
        const storedMode = orderObj?.schedule_config?.payment_mode;
        const resolvedMode = ['emi_2', 'emi_3', 'custom'].includes(storedMode)
          ? storedMode
          : (instList.length === 2 ? 'emi_2' : instList.length === 3 ? 'emi_3' : 'custom');
        setPaymentMode(resolvedMode);
        setInstallments(instList.map((m, idx) => ({
          ...m,
          installment_number: m.installment_number || idx + 1,
          amount: Number(m.amount || 0),
          due_date: m.due_date || editStart,
          status: ['paid', 'pending_verification', 'pending'].includes(m.status) ? m.status : 'pending',
          notes: m.notes || `EMI #${idx + 1}`
        })));
        setFullPaymentStatus('pending');
      } else {
        setPaymentMode('full');
        setInstallments([]);
        const singleStatus = instList[0]?.status;
        if (['paid', 'pending_verification', 'pending'].includes(singleStatus)) {
          setFullPaymentStatus(singleStatus);
        } else if (cycleObj?.payment_status === 'Paid' || orderObj?.payment_status === 'paid') {
          setFullPaymentStatus('paid');
        } else if (orderObj?.payment_status === 'pending_verification') {
          setFullPaymentStatus('pending_verification');
        } else {
          setFullPaymentStatus('pending');
        }
      }

      setPaymentChannel(orderObj?.schedule_config?.payment_channel || 'UPI');
      const storedRef = orderObj?.schedule_config?.payment_reference
        || (orderObj?.payment_id && !String(orderObj.payment_id).startsWith('TXN-OM') ? orderObj.payment_id : '')
        || '';
      setPaymentRef(storedRef);
      setGracePeriodDays(Number(orderObj?.grace_period_days || 3));
      setSavedReceiptUrls(collectOrderReceiptUrls(orderObj));
      setNotes(extractEditableNotes(cycleObj?.notes || ''));
      return;
    }

    // Create renewal mode defaults
    let computedStart = '';
    if (cycleObj?.delivery_end_date) {
      computedStart = addDaysToIsoDate(cycleObj.delivery_end_date, 1);
    } else if (orderObj?.first_upload_date) {
      const prevEnd = calculateCycleEndDate(orderObj.first_upload_date);
      computedStart = addDaysToIsoDate(prevEnd, 1);
    } else {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      computedStart = tmrw.toISOString().split('T')[0];
    }
    setStartDate(computedStart);
    setEndDate(calculateCycleEndDate(computedStart));

    const hasCustomOrder = Boolean(
      orderObj?.schedule_config?.custom_deliverables ||
      orderObj?.schedule_config?.is_renewal
    );
    setStaticCount(
      orderObj && hasCustomOrder && orderObj.static_posts_total !== undefined && orderObj.static_posts_total !== null
        ? Number(orderObj.static_posts_total)
        : (orderObj?.static_posts_total && orderObj.static_posts_total !== 10 ? Number(orderObj.static_posts_total) : planDefaults.staticPosts)
    );
    setReelsCount(
      orderObj && hasCustomOrder && orderObj.reels_total !== undefined && orderObj.reels_total !== null
        ? Number(orderObj.reels_total)
        : (orderObj?.reels_total && orderObj.reels_total !== 3 && orderObj.reels_total !== 4 ? Number(orderObj.reels_total) : planDefaults.reels)
    );
    setStoriesCount(
      orderObj && hasCustomOrder && orderObj.stories_total !== undefined && orderObj.stories_total !== null
        ? Number(orderObj.stories_total)
        : (orderObj?.stories_total && orderObj.stories_total !== 32 ? Number(orderObj.stories_total) : (orderObj?.schedule_config?.totalStories ?? planDefaults.stories))
    );
    setPostersCount(Number(orderObj?.posters_total || 0));
    setHasWebsiteAddon(
      orderObj?.has_website !== undefined ? Boolean(orderObj.has_website) : planDefaults.hasWebsite
    );

    setPaymentMode('full');
    setFullPaymentStatus('pending');
    setPaymentChannel('UPI');
    setPaymentRef('');
    setGracePeriodDays(Number(orderObj?.grace_period_days || 3));
    setInstallments([]);
    setSavedReceiptUrls([]);
    setNotes('');
  }, []);

  // Initialize or reset fields when modal opens
  useEffect(() => {
    if (!isOpen || !client) return;
    const initialMode = mode === 'edit' ? 'edit' : 'create';
    hydrateForm({
      nextMode: initialMode,
      cycleObj: initialMode === 'edit' ? (targetCycle || latestCycle) : latestCycle,
      orderObj: initialMode === 'edit' ? (targetOrder || currentOrder) : currentOrder
    });
  }, [isOpen, client, currentOrder, latestCycle, mode, targetCycle, targetOrder, hydrateForm]);

  // Adjust plan defaults cleanly when switching package preset
  const handlePackageChange = (newPkg) => {
    setPackageName(newPkg);
    const defaults = getPlanDefaultQuotas(newPkg);
    setAmount(String(defaults.defaultPrice));
    setStaticCount(defaults.staticPosts);
    setReelsCount(defaults.reels);
    setStoriesCount(defaults.stories);
    setPostersCount(defaults.posters);
    setHasWebsiteAddon(defaults.hasWebsite);

    if (paymentMode === 'emi_2' || paymentMode === 'emi_3') {
      const nextSplits = paymentMode === 'emi_2' ? 2 : 3;
      setInstallments(
        generateDefaultInstallmentPlan({
          total: defaults.defaultPrice,
          splits: nextSplits,
          firstDueDate: startDate || new Date().toISOString().split('T')[0],
          secondDueDate: addDaysToIsoDate(startDate, 15),
          thirdDueDate: addDaysToIsoDate(startDate, 30),
          firstIsPaid: false
        })
      );
    }
  };

  const handleResetDeliverablesToPlan = () => {
    const defaults = getPlanDefaultQuotas(packageName);
    setStaticCount(defaults.staticPosts);
    setReelsCount(defaults.reels);
    setStoriesCount(defaults.stories);
    setPostersCount(defaults.posters);
    setHasWebsiteAddon(defaults.hasWebsite);
  };

  // Recalculate 2x / 3x EMI splits automatically when total amount edits
  const handleAmountChange = (val) => {
    setAmount(val);
    const total = Number(val);
    if (!Number.isFinite(total) || total <= 0) return;

    if (paymentMode === 'emi_2' && installments.length === 2) {
      const firstAmt = Math.round(total / 2);
      setInstallments((prev) =>
        prev.map((inst, idx) => ({
          ...inst,
          amount: idx === 0 ? firstAmt : Math.max(0, total - firstAmt)
        }))
      );
    } else if (paymentMode === 'emi_3' && installments.length === 3) {
      const firstAmt = Math.round(total * 0.4);
      const rem = total - firstAmt;
      const secondAmt = Math.round(rem / 2);
      const thirdAmt = Math.max(0, rem - secondAmt);
      setInstallments((prev) =>
        prev.map((inst, idx) => ({
          ...inst,
          amount: idx === 0 ? firstAmt : (idx === 1 ? secondAmt : thirdAmt)
        }))
      );
    }
  };

  const handleSelectPaymentMode = (nextMode) => {
    setPaymentMode(nextMode);
    const total = Number(amount) || 0;
    const baseDue = startDate || new Date().toISOString().split('T')[0];

    if (nextMode === 'full') {
      setInstallments([]);
      return;
    }

    if (nextMode === 'emi_2' || nextMode === 'emi_3') {
      const splits = nextMode === 'emi_2' ? 2 : 3;
      const generated = generateDefaultInstallmentPlan({
        total: total > 0 ? total : 3500,
        splits,
        firstDueDate: baseDue,
        secondDueDate: addDaysToIsoDate(baseDue, 15),
        thirdDueDate: addDaysToIsoDate(baseDue, 30),
        firstIsPaid: false
      });
      setInstallments(generated);
      return;
    }

    if (nextMode === 'custom') {
      if (installments.length >= 2) return;
      const firstAmt = Math.round(total / 2);
      setInstallments([
        {
          installment_number: 1,
          amount: firstAmt,
          due_date: baseDue,
          status: fullPaymentStatus,
          notes: 'Advance EMI'
        },
        {
          installment_number: 2,
          amount: Math.max(0, total - firstAmt),
          due_date: addDaysToIsoDate(baseDue, 15),
          status: 'pending',
          notes: 'Balance EMI'
        }
      ]);
    }
  };

  const handleAddMilestone = () => {
    const nextNum = installments.length + 1;
    setInstallments((prev) => [
      ...prev,
      {
        installment_number: nextNum,
        amount: 0,
        due_date: addDaysToIsoDate(startDate, Math.max(7, (nextNum - 1) * 10)),
        status: 'pending',
        notes: `EMI #${nextNum}`
      }
    ]);
    setPaymentMode('custom');
  };

  const handleRemoveMilestone = (index) => {
    if (installments.length <= 1) return;
    setInstallments((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, idx) => ({ ...item, installment_number: idx + 1 }))
    );
    setPaymentMode('custom');
  };

  const handleAutoBalanceMilestones = () => {
    const total = Number(amount || 0);
    if (installments.length <= 1 || !Number.isFinite(total) || total <= 0) return;
    const prefixSum = installments.slice(0, -1).reduce((s, m) => s + Number(m.amount || 0), 0);
    const rem = Math.max(0, total - prefixSum);
    setInstallments((prev) =>
      prev.map((m, i) => (i === prev.length - 1 ? { ...m, amount: rem } : m))
    );
  };

  const handleAttachReceipts = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files).map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name
      }));
      setReceiptFiles((prev) => [...prev, ...added]);
      e.target.value = '';
    }
  };

  const handleRemoveReceipt = (id) => {
    setReceiptFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleRemoveSavedReceipt = (url) => {
    setSavedReceiptUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleSwitchToEditResult = (resultObj) => {
    if (!resultObj?.cycle) return;
    hydrateForm({
      nextMode: 'edit',
      cycleObj: resultObj.cycle,
      orderObj: resultObj.order || activeEditOrder || targetOrder || currentOrder
    });
  };

  const handleCopyPaymentDetails = () => {
    if (!renewalResult?.paymentDetailsText) return;
    navigator.clipboard.writeText(renewalResult.paymentDetailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseSafe = () => {
    if (submitting) return;
    cleanupStagedPreviews(receiptFiles);
    setReceiptFiles([]);
    setPreviewZoomUrl(null);
    onClose();
  };

  const isEditMode = modalMode === 'edit';
  const effectiveCycle = activeEditCycle || (isEditMode ? targetCycle : null) || latestCycle;
  const effectiveOrder = activeEditOrder || (isEditMode ? targetOrder : null) || currentOrder;

  // Derived summaries for live display & validation
  const totalDeliverablesCount =
    Math.max(0, parseInt(staticCount, 10) || 0) +
    Math.max(0, parseInt(reelsCount, 10) || 0) +
    Math.max(0, parseInt(storiesCount, 10) || 0) +
    Math.max(0, parseInt(postersCount, 10) || 0);

  const planDefaultsForSelected = useMemo(() => getPlanDefaultQuotas(packageName), [packageName]);
  const isCustomDeliverables =
    Number(staticCount) !== planDefaultsForSelected.staticPosts ||
    Number(reelsCount) !== planDefaultsForSelected.reels ||
    Number(storiesCount) !== planDefaultsForSelected.stories ||
    Number(postersCount) !== planDefaultsForSelected.posters ||
    Boolean(hasWebsiteAddon) !== planDefaultsForSelected.hasWebsite;

  const isEmiMode = paymentMode !== 'full' && installments.length > 0;
  const priceNumForCheck = Number(amount || 0);
  const milestonesSum = installments.reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const milestonesBalanced = !isEmiMode || Math.abs(milestonesSum - priceNumForCheck) <= 1;

  const previewPaidAmount = isEmiMode
    ? installments.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    : (fullPaymentStatus === 'paid' ? priceNumForCheck : 0);
  const previewPendingReview = isEmiMode
    ? installments.some((i) => i.status === 'pending_verification')
    : fullPaymentStatus === 'pending_verification';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setDuplicateWarning(null);

    const priceNum = Number(amount);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid plan amount greater than ₹0.');
      return;
    }

    if (!startDate) {
      setErrorMsg('Please select a delivery start date.');
      return;
    }

    if (isEditMode && endDate && endDate < startDate) {
      setErrorMsg('Delivery end date cannot be earlier than the delivery start date.');
      return;
    }

    if (totalDeliverablesCount === 0 && !hasWebsiteAddon) {
      setErrorMsg('Please set at least 1 deliverable (Static, Reel, Story, or Poster) for this cycle.');
      return;
    }

    if (isEmiMode && !milestonesBalanced) {
      setErrorMsg(
        `EMI milestone amounts (₹${milestonesSum.toLocaleString()}) must equal ₹${priceNum.toLocaleString()}. Click "Auto-Balance" or adjust the amounts.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const commonPayload = {
        client,
        packageName,
        amount: priceNum,
        startDate,
        notes: notes.trim(),
        deliverables: {
          staticPosts: Math.max(0, parseInt(staticCount, 10) || 0),
          reels: Math.max(0, parseInt(reelsCount, 10) || 0),
          stories: Math.max(0, parseInt(storiesCount, 10) || 0),
          posters: Math.max(0, parseInt(postersCount, 10) || 0),
          hasWebsite: hasWebsiteAddon
        },
        paymentDetails: {
          paymentMode,
          initialStatus: fullPaymentStatus,
          paymentChannel,
          paymentRef: paymentRef.trim(),
          gracePeriodDays: Number(gracePeriodDays || 3),
          installments: isEmiMode ? installments : [],
          existingReceiptUrls: savedReceiptUrls
        },
        receiptFiles
      };

      const res = isEditMode
        ? await updateRenewalCycle({
            ...commonPayload,
            cycle: effectiveCycle,
            order: effectiveOrder,
            endDate: endDate || calculateCycleEndDate(startDate),
            savedReceiptUrls
          })
        : await createRenewalCycle({
            ...commonPayload,
            currentOrder: effectiveOrder
          });

      if (!res.success && res.isDuplicate) {
        setDuplicateWarning({
          message: res.message,
          existingCycle: res.existingCycle || null,
          existingOrder: res.existingOrder || null
        });
        setSubmitting(false);
        return;
      }

      cleanupStagedPreviews(receiptFiles);
      setReceiptFiles([]);
      setRenewalResult(res);
      if (onRenewalSuccess) {
        onRenewalSuccess(res);
      }
    } catch (err) {
      console.error('Renewal submission failed:', err);
      setErrorMsg(err.message || (isEditMode ? 'Failed to update plan details.' : 'Failed to renew client package.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !client) return null;

  const clientDisplayName = client.name || client.displayBusinessName || 'Client';
  const businessName = client.displayBusinessName || effectiveOrder?.business_name || client.business_type || 'Main Brand';
  const computedEndDate = endDate || (startDate ? calculateCycleEndDate(startDate) : '');
  const currentCycleNumber = latestCycle ? (latestCycle.cycle_number || 1) : 1;
  const displayedCycleNumber = isEditMode
    ? Number(effectiveCycle?.cycle_number || effectiveOrder?.schedule_config?.cycle_number || 1)
    : (currentCycleNumber + 1);
  const totalProofCount = savedReceiptUrls.length + receiptFiles.length;

  const statusBadgeText =
    previewPaidAmount >= priceNumForCheck && priceNumForCheck > 0
      ? 'Paid in Full'
      : previewPaidAmount > 0
      ? `EMI • ₹${previewPaidAmount.toLocaleString()} Paid`
      : previewPendingReview
      ? 'In Review'
      : 'Pending Payment';

  const statusBadgeClass =
    previewPaidAmount >= priceNumForCheck && priceNumForCheck > 0
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : previewPaidAmount > 0
      ? 'bg-[#3428f8]/20 text-blue-300 border-[#3428f8]/40'
      : previewPendingReview
      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
      : 'bg-[#222] text-amber-400 border-[#333]';

  const deliverableStepFields = [
    {
      key: 'static',
      label: 'Static Posts',
      value: staticCount,
      setter: setStaticCount,
      icon: ImageIcon,
      color: 'text-[#3428f8]'
    },
    {
      key: 'reels',
      label: 'Reels',
      value: reelsCount,
      setter: setReelsCount,
      icon: Video,
      color: 'text-pink-400'
    },
    {
      key: 'stories',
      label: 'Stories',
      value: storiesCount,
      setter: setStoriesCount,
      icon: Flame,
      color: 'text-amber-400'
    },
    {
      key: 'posters',
      label: 'Posters',
      value: postersCount,
      setter: setPostersCount,
      icon: Layout,
      color: 'text-emerald-400'
    }
  ];

  const firstUnpaidIsPending = isEmiMode
    ? installments[0]?.status === 'pending'
    : fullPaymentStatus === 'pending';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        onClick={handleCloseSafe}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
                {isEditMode
                  ? <Edit3 size={22} className={submitting ? 'animate-pulse' : ''} />
                  : <RefreshCw size={22} className={submitting ? 'animate-spin' : ''} />}
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-serif text-white flex items-center gap-2">
                  {isEditMode ? `Edit Cycle #${displayedCycleNumber} Plan` : 'Renew Package for Next Month'}
                </h3>
                <p className="text-xs text-[#888]">
                  {clientDisplayName} • <span className="text-white font-medium">{businessName}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseSafe}
              className="text-[#666] hover:text-white p-2 rounded-full bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="py-4 overflow-y-auto flex-grow space-y-4 pr-1 custom-scrollbar">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5 text-amber-300">Renewal Cycle Already Exists</span>
                  <span className="text-amber-200/90 block">
                    {typeof duplicateWarning === 'string' ? duplicateWarning : duplicateWarning.message}
                  </span>
                  {duplicateWarning?.existingCycle && (
                    <button
                      type="button"
                      onClick={() =>
                        hydrateForm({
                          nextMode: 'edit',
                          cycleObj: duplicateWarning.existingCycle,
                          orderObj: duplicateWarning.existingOrder || effectiveOrder
                        })
                      }
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 transition-all cursor-pointer"
                    >
                      <Edit3 size={12} /> Open & Edit Cycle #{duplicateWarning.existingCycle.cycle_number || 1} Instead
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: FORM */}
            {!renewalResult ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Cycle Banner */}
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#3428f8]/15 border border-[#3428f8]/30 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                      #{displayedCycleNumber}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] block">
                        {isEditMode ? 'Editing Saved Billing Cycle' : 'Upcoming Billing Cycle'}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {isEditMode
                          ? `Month #${displayedCycleNumber} Plan Details${effectiveOrder?.order_id ? ` • ${effectiveOrder.order_id}` : ''}`
                          : `Month #${displayedCycleNumber} Renewal`}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border ${statusBadgeClass}`}>
                    {statusBadgeText}
                  </span>
                </div>

                {/* Package Selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    1. Package / Plan
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PACKAGE_OPTIONS.map((pkg) => {
                      const isSelected = packageName === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handlePackageChange(pkg.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#3428f8]/15 border-[#3428f8] text-white shadow-sm'
                              : 'bg-[#141414] border-[#222] text-[#888] hover:text-white hover:border-[#333]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{pkg.label}</span>
                            {isSelected && <Check size={13} className="text-blue-400" />}
                          </div>
                          <span className="text-[10px] text-[#777] block">{pkg.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount & Date Row */}
                <div className={`grid grid-cols-1 ${isEditMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3.5`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                        {isEditMode ? 'Total Plan Cost (₹) *' : 'Amount for Next Month (₹) *'}
                      </label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                        <IndianRupee size={16} />
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white font-mono font-bold text-sm focus:border-[#3428f8] outline-none transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-[#777] mt-1">
                      Individual per client; other cycles remain untouched.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                        {isEditMode ? 'Delivery Start Date *' : 'New Delivery Start Date *'}
                      </label>
                      {!isEditMode && computedEndDate && (
                        <span className="text-[10px] text-blue-400 font-mono">
                          Ends: {computedEndDate}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777]">
                        <Calendar size={16} />
                      </div>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setStartDate(nextVal);
                          if (!endDateManuallyEdited) {
                            setEndDate(nextVal ? calculateCycleEndDate(nextVal) : '');
                          }
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-xs focus:border-[#3428f8] outline-none transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-[#777] mt-1">
                      Content calendar updates from this date.
                    </p>
                  </div>

                  {isEditMode && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                          Delivery End Date *
                        </label>
                        {endDateManuallyEdited && startDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEndDateManuallyEdited(false);
                              setEndDate(calculateCycleEndDate(startDate));
                            }}
                            className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                          >
                            Reset +1 Mo
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777]">
                          <Calendar size={16} />
                        </div>
                        <input
                          type="date"
                          required
                          value={endDate}
                          onChange={(e) => {
                            setEndDateManuallyEdited(true);
                            setEndDate(e.target.value);
                          }}
                          className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-xs focus:border-[#3428f8] outline-none transition-colors"
                        />
                      </div>
                      <p className="text-[11px] text-[#777] mt-1">
                        Defaults to +1 month; adjustable for billing period.
                      </p>
                    </div>
                  )}
                </div>

                {/* SECTION 2: CUSTOMIZE DELIVERABLES */}
                <div className="bg-[#151515] border border-[#242424] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#aaa] flex items-center gap-1.5">
                        <Layers size={14} className="text-[#3428f8]" />
                        2. Customize Deliverables for This Cycle
                      </span>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        Adjust exact monthly quotas ({totalDeliverablesCount} total deliverables configured).
                      </p>
                    </div>
                    {isCustomDeliverables && (
                      <button
                        type="button"
                        onClick={handleResetDeliverablesToPlan}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-white bg-[#3428f8]/10 hover:bg-[#3428f8] border border-[#3428f8]/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        <RotateCcw size={11} /> Reset Defaults
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {deliverableStepFields.map((field) => {
                      const Icon = field.icon;
                      return (
                        <div
                          key={field.key}
                          className="bg-[#0d0d0d] border border-[#242424] rounded-xl p-2.5 flex flex-col justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon size={13} className={field.color} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] truncate">
                              {field.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => field.setter((v) => Math.max(0, Number(v || 0) - 1))}
                              className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-[#ccc] hover:text-white flex items-center justify-center border border-[#2a2a2a] cursor-pointer"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={field.value}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                field.setter(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                              }}
                              className="w-12 text-center bg-transparent text-white font-mono font-bold text-sm outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => field.setter((v) => Math.min(200, Number(v || 0) + 1))}
                              className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-[#ccc] hover:text-white flex items-center justify-center border border-[#2a2a2a] cursor-pointer"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex items-center justify-between bg-[#0d0d0d] border border-[#242424] rounded-xl px-3 py-2 cursor-pointer hover:border-[#333] transition-colors">
                    <span className="text-xs text-[#ccc] font-medium">
                      Include Website / SEO Maintenance Support in This Cycle
                    </span>
                    <input
                      type="checkbox"
                      checked={hasWebsiteAddon}
                      onChange={(e) => setHasWebsiteAddon(e.target.checked)}
                      className="w-4 h-4 accent-[#3428f8] cursor-pointer"
                    />
                  </label>
                </div>

                {/* SECTION 3: PAYMENT DETAILS & EMI STRUCTURE */}
                <div className="bg-[#151515] border border-[#242424] rounded-2xl p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#aaa] flex items-center gap-1.5">
                        <CreditCard size={14} className="text-[#3428f8]" />
                        3. Payment Details & EMI Structure
                      </span>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        Specify full upfront or EMI installment schedule, payment mode, and current payment status.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#3428f8] hover:text-white cursor-pointer"
                    >
                      <Plus size={12} /> Add Milestone
                    </button>
                  </div>

                  {/* EMI vs Full Split Mode Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'full', title: '1x Full Payment', sub: 'Single payment' },
                      { id: 'emi_2', title: '2x EMIs', sub: '50% / 50% split' },
                      { id: 'emi_3', title: '3x EMIs', sub: '40% / 30% / 30%' },
                      { id: 'custom', title: 'Custom EMI', sub: 'Flexible splits' }
                    ].map((opt) => {
                      const active = paymentMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectPaymentMode(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-[#3428f8]/20 border-[#3428f8] text-white'
                              : 'bg-[#0e0e0e] border-[#252525] text-[#888] hover:text-white'
                          }`}
                        >
                          <p className="text-xs font-bold">{opt.title}</p>
                          <p className="text-[10px] text-[#777] mt-0.5">{opt.sub}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Channel, Reference & Grace / Single Payment Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                        Payment Channel
                      </label>
                      <select
                        value={paymentChannel}
                        onChange={(e) => setPaymentChannel(e.target.value)}
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-[#3428f8]"
                      >
                        <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                        <option value="Bank Transfer">Bank Transfer (IMPS / NEFT)</option>
                        <option value="Cash">Cash</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                        UTR / TXN Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs p-2.5 rounded-xl outline-none focus:border-[#3428f8]"
                      />
                    </div>

                    {paymentMode === 'full' ? (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                          Payment Status
                        </label>
                        <select
                          value={fullPaymentStatus}
                          onChange={(e) => setFullPaymentStatus(e.target.value)}
                          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-[#3428f8]"
                        >
                          <option value="pending">Pending Payment</option>
                          <option value="paid">Paid (Received Now)</option>
                          <option value="pending_verification">Review / Proof Uploaded</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                          Overdue Grace Period
                        </label>
                        <select
                          value={gracePeriodDays}
                          onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-[#3428f8]"
                        >
                          <option value={1}>1 Day Grace</option>
                          <option value={2}>2 Days Grace</option>
                          <option value={3}>3 Days Grace (Standard)</option>
                          <option value={5}>5 Days Grace</option>
                          <option value={7}>7 Days Grace</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* EMI Milestones Editor */}
                  {isEmiMode && (
                    <div className="space-y-2.5 pt-1">
                      {installments.map((inst, idx) => (
                        <div
                          key={idx}
                          className="bg-[#0e0e0e] border border-[#252525] rounded-xl p-3 flex flex-col gap-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                              <span className="w-6 h-6 rounded-full bg-[#1f1f1f] text-white text-[11px] font-bold flex items-center justify-center font-mono shrink-0">
                                #{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={inst.notes || ''}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setInstallments((prev) =>
                                    prev.map((m, i) => (i === idx ? { ...m, notes: nextVal } : m))
                                  );
                                }}
                                aria-label={`EMI ${idx + 1} label`}
                                className="w-full bg-[#151515] border border-[#262626] text-white text-xs font-medium px-2.5 py-1.5 rounded-lg outline-none focus:border-[#3428f8]"
                              />
                            </div>

                            {installments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMilestone(idx)}
                                className="text-[#666] hover:text-red-400 p-1 rounded-lg transition-colors cursor-pointer"
                                title="Remove milestone"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888] text-xs">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={inst.amount}
                                onChange={(e) => {
                                  const nextAmt = Number(e.target.value);
                                  setPaymentMode('custom');
                                  setInstallments((prev) =>
                                    prev.map((m, i) => (i === idx ? { ...m, amount: nextAmt } : m))
                                  );
                                }}
                                aria-label={`EMI ${idx + 1} amount`}
                                className="w-full bg-[#151515] border border-[#2a2a2a] text-white text-xs font-mono font-bold p-2 pl-6 rounded-lg outline-none focus:border-[#3428f8]"
                              />
                            </div>

                            <input
                              type="date"
                              value={inst.due_date || ''}
                              onChange={(e) => {
                                const nextDue = e.target.value;
                                setInstallments((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, due_date: nextDue } : m))
                                );
                              }}
                              aria-label={`EMI ${idx + 1} due date`}
                              className="bg-[#151515] border border-[#2a2a2a] text-white text-xs font-mono p-2 rounded-lg outline-none focus:border-[#3428f8]"
                            />

                            <select
                              value={inst.status || 'pending'}
                              onChange={(e) => {
                                const nextSt = e.target.value;
                                setInstallments((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, status: nextSt } : m))
                                );
                              }}
                              aria-label={`EMI ${idx + 1} status`}
                              className={`text-xs font-bold rounded-lg p-2 border outline-none ${
                                inst.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : inst.status === 'pending_verification'
                                  ? 'bg-[#3428f8]/15 text-blue-300 border-[#3428f8]/40'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              <option value="pending" className="bg-[#111] text-amber-400">Pending</option>
                              <option value="paid" className="bg-[#111] text-emerald-400">Paid Now</option>
                              <option value="pending_verification" className="bg-[#111] text-blue-300">Review</option>
                            </select>
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                        <span className="text-[#888]">
                          EMI Sum: <strong className="text-white font-mono">₹{milestonesSum.toLocaleString()}</strong> / Total: <strong className="text-white font-mono">₹{priceNumForCheck.toLocaleString()}</strong>
                        </span>
                        {milestonesBalanced ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check size={12} /> Milestones Match
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAutoBalanceMilestones}
                            className="bg-[#3428f8]/20 hover:bg-[#3428f8] text-blue-300 hover:text-white px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                          >
                            Auto-Balance Final EMI
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 4: PAYMENT SCREENSHOT UPLOAD */}
                <div className="bg-[#151515] border border-[#242424] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#aaa] flex items-center gap-1.5">
                        <Upload size={14} className="text-[#3428f8]" />
                        4. Payment Proof Screenshots ({totalProofCount})
                      </span>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        Upload UPI, GPay, PhonePe, or bank transfer screenshot(s) for this cycle.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#3428f8] hover:bg-[#281bd6] px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                      <Upload size={12} />
                      <span>{totalProofCount > 0 ? '+ Add More' : 'Upload Screenshot'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleAttachReceipts}
                      />
                    </label>
                  </div>

                  {totalProofCount > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap gap-2.5">
                        {savedReceiptUrls.map((url, idx) => (
                          <div
                            key={url}
                            className="relative group rounded-xl overflow-hidden border border-emerald-500/40 bg-[#0a0a0a] w-24 h-20 shrink-0"
                          >
                            <img
                              src={url}
                              alt={`Saved Payment Proof ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => setPreviewZoomUrl(url)}
                            />
                            <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/80 text-[8px] font-bold uppercase text-emerald-400">
                              Saved
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSavedReceipt(url);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove saved screenshot"
                            >
                              <Trash2 size={10} />
                            </button>
                            <div
                              onClick={() => setPreviewZoomUrl(url)}
                              className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold pointer-events-none gap-1"
                            >
                              <Eye size={11} /> Zoom
                            </div>
                          </div>
                        ))}

                        {receiptFiles.map((item, idx) => (
                          <div
                            key={item.id}
                            className="relative group rounded-xl overflow-hidden border border-[#2f2f2f] bg-[#0a0a0a] w-24 h-20 shrink-0"
                          >
                            <img
                              src={item.previewUrl}
                              alt={`Payment Proof ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => setPreviewZoomUrl(item.previewUrl)}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveReceipt(item.id);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove screenshot"
                            >
                              <Trash2 size={10} />
                            </button>
                            <div
                              onClick={() => setPreviewZoomUrl(item.previewUrl)}
                              className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold pointer-events-none gap-1"
                            >
                              <Eye size={11} /> Zoom
                            </div>
                          </div>
                        ))}
                      </div>

                      {firstUnpaidIsPending && (
                        <div className="p-2.5 rounded-xl bg-[#3428f8]/10 border border-[#3428f8]/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-200">
                          <span>Screenshot attached. Would you like to mark this payment as received?</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isEmiMode) {
                                setInstallments((prev) =>
                                  prev.map((m, i) => (i === 0 ? { ...m, status: 'paid' } : m))
                                );
                              } else {
                                setFullPaymentStatus('paid');
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#3428f8] hover:bg-[#281bd6] text-white font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                          >
                            {isEmiMode ? 'Mark EMI #1 Paid' : 'Mark Full Paid'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Internal Notes (Optional) */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Notes / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-xs focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-3 border-t border-[#222] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseSafe}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#181818] hover:bg-[#222] text-[#aaa] hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !milestonesBalanced}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#3428f8] hover:bg-[#281bd6] text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        {isEditMode ? 'Saving Changes...' : 'Generating Cycle...'}
                      </>
                    ) : (
                      <>
                        {isEditMode ? <Edit3 size={14} /> : <RefreshCw size={14} />}
                        {isEditMode ? 'Save Plan Changes' : 'Confirm & Generate Renewal'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: RENEWAL CREATED OR UPDATED — SHOW PAYMENT DETAILS, SCREENSHOTS & CALENDAR SUMMARY */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <div>
                    <h4 className="font-serif font-bold text-sm text-white">
                      {renewalResult.isEdit
                        ? `Cycle #${renewalResult.cycle.cycle_number} Updated!`
                        : `Renewal Cycle #${renewalResult.cycle.cycle_number} Generated!`}
                    </h4>
                    <p className="text-xs text-emerald-400/90">
                      {renewalResult.isEdit ? 'Plan & finance entry updated' : 'Finance entry created'} ({renewalResult.order.order_id}) as{' '}
                      <span className="font-bold underline">
                        {renewalResult.paymentSummary?.isFullyPaid
                          ? 'Paid in Full'
                          : renewalResult.paymentSummary?.paidAmount > 0
                          ? `Partial EMI (₹${renewalResult.paymentSummary.paidAmount.toLocaleString()} Paid)`
                          : 'Pending'}
                      </span>
                      . Content calendar synced.
                    </p>
                  </div>
                </div>

                {/* Payment Details Card */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222] mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
                      Payment Details for Client
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPaymentDetails}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3428f8] hover:bg-[#281bd6] text-white transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check size={13} className="text-green-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Details</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                    <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                      <span className="text-[10px] text-[#777] block uppercase font-bold">Renewal Amount & Mode</span>
                      <span className="text-lg font-serif font-bold text-emerald-400 block">
                        ₹{Number(renewalResult.cycle.amount).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#999]">
                        {renewalResult.paymentSummary?.paymentStructureLabel} • {renewalResult.paymentSummary?.paymentChannel}
                      </span>
                    </div>

                    <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                      <span className="text-[10px] text-[#777] block uppercase font-bold">UPI ID</span>
                      <span className="font-mono font-bold text-white text-xs block">
                        {UPI_PAYMENT_DETAILS.upiId}
                      </span>
                      {renewalResult.paymentSummary?.paymentRef && (
                        <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">
                          Ref: {renewalResult.paymentSummary.paymentRef}
                        </span>
                      )}
                    </div>

                    <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                      <span className="text-[10px] text-[#777] block uppercase font-bold">Delivery Period</span>
                      <span className="font-mono text-white text-xs">
                        {renewalResult.cycle.delivery_start_date} → {renewalResult.cycle.delivery_end_date}
                      </span>
                    </div>

                    <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                      <span className="text-[10px] text-[#777] block uppercase font-bold">Order ID</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">
                        {renewalResult.order.order_id}
                      </span>
                    </div>
                  </div>

                  {/* EMI Breakdown if applicable */}
                  {renewalResult.paymentSummary?.installments?.length > 1 && (
                    <div className="mb-3 bg-[#0a0a0a] border border-[#202020] rounded-xl p-3 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                        EMI Milestone Schedule
                      </span>
                      {renewalResult.paymentSummary.installments.map((inst) => (
                        <div key={inst.installment_number} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#bbb]">
                            #{inst.installment_number} ({inst.due_date})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">₹{Number(inst.amount).toLocaleString()}</span>
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                inst.status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {inst.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Uploaded Screenshots Preview */}
                  {Array.isArray(renewalResult.uploadedReceiptUrls) && renewalResult.uploadedReceiptUrls.length > 0 && (
                    <div className="mb-3 bg-[#0a0a0a] border border-[#202020] rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                        Uploaded Payment Proof ({renewalResult.uploadedReceiptUrls.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {renewalResult.uploadedReceiptUrls.map((url, idx) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setPreviewZoomUrl(url)}
                            className="w-16 h-14 rounded-lg overflow-hidden border border-[#2c2c2c] hover:border-[#3428f8] transition-all cursor-pointer"
                          >
                            <img src={url} alt={`Uploaded receipt ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* QR Image */}
                  <div className="flex items-center gap-3 bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                    <img
                      src={UPI_PAYMENT_DETAILS.qrImagePath}
                      alt="UPI QR"
                      className="w-14 h-14 object-contain rounded-lg bg-white p-1 shrink-0"
                    />
                    <div className="text-[11px] text-[#888]">
                      <span className="text-white font-bold block mb-0.5">UPI QR Code Ready</span>
                      <span>Client can scan this QR in GPay, PhonePe, Paytm or pay via UPI ID.</span>
                    </div>
                  </div>
                </div>

                {/* Calendar Generation Summary */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block mb-2">
                    Content Calendar Generated ({renewalResult.schedule?.length || 0} Deliverables)
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#aaa]">
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Package: <strong className="text-white">{renewalResult.cycle.package}</strong>
                    </span>
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Posts: <strong className="text-white">{renewalResult.order.static_posts_total ?? 0}</strong>
                    </span>
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Reels: <strong className="text-white">{renewalResult.order.reels_total ?? 0}</strong>
                    </span>
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Stories: <strong className="text-white">{renewalResult.order.stories_total ?? 0}</strong>
                    </span>
                    {Number(renewalResult.order.posters_total || 0) > 0 && (
                      <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                        Posters: <strong className="text-white">{renewalResult.order.posters_total}</strong>
                      </span>
                    )}
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Status:{' '}
                      <strong className={renewalResult.paymentSummary?.isFullyPaid ? 'text-emerald-400' : 'text-amber-400'}>
                        {renewalResult.paymentSummary?.isFullyPaid
                          ? 'Paid'
                          : renewalResult.paymentSummary?.paidAmount > 0
                          ? `Partial EMI (₹${renewalResult.paymentSummary.balanceDue.toLocaleString()} Due)`
                          : 'Pending Payment'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Step 2 Actions: Edit Again or Done */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchToEditResult(renewalResult)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#1a1a1a] hover:bg-[#242424] border border-[#2f2f2f] text-blue-300 hover:text-white transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit This Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseSafe}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#3428f8] hover:bg-[#281bd6] text-white transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Done & Refresh</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Fullscreen Zoom Preview for Receipt Screenshot */}
        {previewZoomUrl && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setPreviewZoomUrl(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#333] rounded-3xl p-4 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#222]">
                <span className="text-white text-xs font-bold uppercase tracking-wider">Payment Screenshot Preview</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoomUrl(null)}
                  className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-auto flex items-center justify-center p-2 mt-2">
                <img
                  src={previewZoomUrl}
                  alt="Payment Screenshot Zoom"
                  className="max-h-[75vh] w-auto rounded-xl object-contain border border-[#222]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
