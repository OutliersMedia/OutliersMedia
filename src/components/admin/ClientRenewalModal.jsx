import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, RefreshCw, Calendar, IndianRupee, Copy, Check, 
  QrCode, AlertCircle, ArrowRight, CheckCircle2, Package as PackageIcon,
  Clock, ShieldAlert, Sparkles, Layers
} from 'lucide-react';
import { createRenewalCycle, calculateCycleEndDate, UPI_PAYMENT_DETAILS } from '../../utils/renewalEngine';

export default function ClientRenewalModal({
  isOpen,
  onClose,
  client,
  currentOrder,
  latestCycle,
  onRenewalSuccess
}) {
  const [packageName, setPackageName] = useState('Starter Plan');
  const [amount, setAmount] = useState('3500');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Success view state after submission
  const [renewalResult, setRenewalResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Available package options
  const PACKAGE_OPTIONS = [
    { id: 'Starter Plan', label: 'Starter Plan', defaultPrice: 3500, desc: '12 Static • 8 Reels • 15 Stories' },
    { id: 'Growth Plan',  label: 'Growth Plan',  defaultPrice: 6000, desc: '15 Static • 12 Reels • 15 Stories' },
    { id: 'Premium Plan', label: 'Premium Plan', defaultPrice: 8000, desc: '15 Static • 12 Reels • 15 Stories + Web' }
  ];

  // Initialize or reset fields when modal opens
  useEffect(() => {
    if (isOpen && client) {
      setErrorMsg('');
      setDuplicateWarning(null);
      setRenewalResult(null);
      setCopied(false);

      // Prefill package from latest cycle or current order
      const initialPackage = latestCycle?.package || currentOrder?.plan_name || 'Starter Plan';
      setPackageName(initialPackage);

      // Prefill amount: individual current amount for this client
      const initialAmount = latestCycle?.amount !== undefined 
        ? String(latestCycle.amount)
        : (currentOrder?.total_agreed_amount || currentOrder?.amount_paid || '3500');
      setAmount(String(initialAmount));

      // Prefill delivery start date: day after previous cycle's end date, or tomorrow
      if (latestCycle?.delivery_end_date) {
        const nextDay = new Date(latestCycle.delivery_end_date);
        nextDay.setDate(nextDay.getDate() + 1);
        setStartDate(nextDay.toISOString().split('T')[0]);
      } else if (currentOrder?.first_upload_date) {
        const endDate = calculateCycleEndDate(currentOrder.first_upload_date);
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setStartDate(nextDay.toISOString().split('T')[0]);
      } else {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        setStartDate(tmrw.toISOString().split('T')[0]);
      }

      setNotes('');
    }
  }, [isOpen, client, currentOrder, latestCycle]);

  // Adjust amount recommendation if user switches package (while allowing manual custom edit)
  const handlePackageChange = (newPkg) => {
    setPackageName(newPkg);
    const matched = PACKAGE_OPTIONS.find(p => p.id === newPkg);
    if (matched) {
      setAmount(String(matched.defaultPrice));
    }
  };

  const handleCopyPaymentDetails = () => {
    if (!renewalResult?.paymentDetailsText) return;
    navigator.clipboard.writeText(renewalResult.paymentDetailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setDuplicateWarning(null);

    const priceNum = Number(amount);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid renewal amount greater than ₹0.');
      return;
    }

    if (!startDate) {
      setErrorMsg('Please select a delivery start date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createRenewalCycle({
        client,
        currentOrder,
        packageName,
        amount: priceNum,
        startDate,
        notes: notes.trim()
      });

      if (!res.success && res.isDuplicate) {
        setDuplicateWarning(res.message);
        setSubmitting(false);
        return;
      }

      // Successful renewal
      setRenewalResult(res);
      if (onRenewalSuccess) {
        onRenewalSuccess(res);
      }
    } catch (err) {
      console.error("Renewal submission failed:", err);
      setErrorMsg(err.message || 'Failed to renew client package.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !client) return null;

  const clientDisplayName = client.name || client.displayBusinessName || 'Client';
  const businessName = client.displayBusinessName || currentOrder?.business_name || client.business_type || 'Main Brand';
  const computedEndDate = startDate ? calculateCycleEndDate(startDate) : '';
  const currentCycleNumber = latestCycle ? (latestCycle.cycle_number || 1) : 1;
  const nextCycleNumber = currentCycleNumber + 1;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        onClick={() => !submitting && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-5 sm:p-7 max-w-xl w-full shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
                <RefreshCw size={22} className={submitting ? 'animate-spin' : ''} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-serif text-white flex items-center gap-2">
                  Renew Package for Next Month
                </h3>
                <p className="text-xs text-[#888]">
                  {clientDisplayName} • <span className="text-white font-medium">{businessName}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="text-[#666] hover:text-white p-2 rounded-full bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="py-4 overflow-y-auto flex-grow space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Duplicate Renewal Blocked</span>
                  <span>{duplicateWarning}</span>
                </div>
              </div>
            )}

            {/* STEP 1: FORM */}
            {!renewalResult ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Cycle Banner */}
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#3428f8]/15 border border-[#3428f8]/30 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                      #{nextCycleNumber}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] block">Upcoming Billing Cycle</span>
                      <span className="text-xs font-semibold text-white">Month #{nextCycleNumber} Renewal</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-[#222] text-amber-400 border border-[#333]">
                    Status: Pending Payment
                  </span>
                </div>

                {/* Package Selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Package / Plan
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

                {/* Amount for Next Month */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                      Amount for Next Month (₹)
                    </label>
                    <span className="text-[10px] text-[#666]">Stored individually per client</span>
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
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white font-mono font-bold text-sm focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#777] mt-1">
                    Current amount prefilled. Editing this amount updates this client's next cycle without affecting past cycles or other clients.
                  </p>
                </div>

                {/* Delivery Start Date */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                      New Delivery Start Date *
                    </label>
                    {computedEndDate && (
                      <span className="text-[10px] text-blue-400 font-mono">
                        Cycle ends: {computedEndDate}
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
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-xs focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#777] mt-1">
                    Content calendar will be automatically plotted from this start date for a full 1-month period.
                  </p>
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
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#181818] hover:bg-[#222] text-[#aaa] hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#3428f8] hover:bg-[#281bd6] text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating Cycle...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Confirm & Generate Renewal
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: RENEWAL CREATED — SHOW PAYMENT DETAILS & CALENDAR SUMMARY */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <div>
                    <h4 className="font-serif font-bold text-sm text-white">
                      Renewal Cycle #{renewalResult.cycle.cycle_number} Generated!
                    </h4>
                    <p className="text-xs text-emerald-400/90">
                      Finance entry created as <span className="font-bold underline">Pending</span> ({renewalResult.order.order_id}). Content calendar is scheduled.
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
                      <span className="text-[10px] text-[#777] block uppercase font-bold">Renewal Amount</span>
                      <span className="text-lg font-serif font-bold text-emerald-400">
                        ₹{Number(renewalResult.cycle.amount).toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#202020]">
                      <span className="text-[10px] text-[#777] block uppercase font-bold">UPI ID</span>
                      <span className="font-mono font-bold text-white text-xs">
                        {UPI_PAYMENT_DETAILS.upiId}
                      </span>
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
                      Window: <strong className="text-white">30 Days</strong>
                    </span>
                    <span className="px-2 py-1 rounded bg-[#222] border border-[#333]">
                      Finance Status: <strong className="text-amber-400">Pending Verification</strong>
                    </span>
                  </div>
                </div>

                {/* Done Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
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
      </div>
    </AnimatePresence>
  );
}
