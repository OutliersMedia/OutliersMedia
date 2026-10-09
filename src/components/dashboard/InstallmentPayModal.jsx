import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, CheckCircle, IndianRupee, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function InstallmentPayModal({ isOpen, onClose, order, installment, onSuccess }) {
  const { user } = useAuth();
  const [txnId, setTxnId] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !installment || !order) return null;

  const instAmount = Number(installment.amount || 0);
  const instNumber = installment.installment_number || 2;

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!txnId.trim()) {
      alert("Please enter the UPI Transaction Reference ID or UTR number.");
      return;
    }
    if (!receiptFile) {
      alert("Please upload a screenshot of your payment receipt.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload receipt screenshot to Supabase Storage 'receipts' bucket
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `installment_${order.order_id}_emi${instNumber}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        throw new Error("Receipt upload failed: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const receiptUrl = publicUrlData?.publicUrl || null;

      // 2. Update installment status in order record
      const rawInstallments = Array.isArray(order.installments) 
        ? order.installments 
        : (order.schedule_config?.installments || []);

      const updatedInstallments = rawInstallments.map(inst => {
        if (inst.installment_number === instNumber) {
          return {
            ...inst,
            status: 'pending_verification',
            payment_id: txnId.trim(),
            receipt_url: receiptUrl,
            submitted_at: new Date().toISOString()
          };
        }
        return inst;
      });

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          installments: updatedInstallments
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error("Failed to update order: " + updateError.message);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2200);
    } catch (err) {
      alert(err.message || "An error occurred while submitting payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0f0f0f] border border-[#262626] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#141414]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#3428f8] bg-[#3428f8]/10 px-2.5 py-0.5 rounded-full border border-[#3428f8]/20">
                Order #{order.order_id}
              </span>
              <h3 className="text-xl font-serif text-white mt-1">
                Pay Installment #{instNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#777] hover:text-white rounded-xl hover:bg-[#222] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {isSuccess ? (
              <div className="py-12 text-center flex flex-col items-center">
                <CheckCircle size={48} className="text-green-400 mb-3 animate-bounce" />
                <h4 className="text-xl font-bold text-white mb-2">Receipt Submitted!</h4>
                <p className="text-[#888] text-xs max-w-xs">
                  Your payment receipt has been forwarded to our finance team for verification. Access will remain uninterrupted.
                </p>
              </div>
            ) : (
              <>
                {/* Amount Due Card */}
                <div className="bg-[#161616] border border-[#2a2a2a] p-5 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block">Amount Due</span>
                    <span className="text-3xl font-serif text-white flex items-center gap-1 mt-0.5">
                      <IndianRupee size={22} className="text-emerald-400" />
                      {instAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {installment.due_date && (
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block">Due Date</span>
                      <span className="text-xs font-mono font-medium text-amber-400 mt-1 block">
                        {new Date(installment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* QR Code Section */}
                <div className="bg-[#121212] border border-[#222] p-5 rounded-2xl flex flex-col items-center text-center">
                  <p className="text-xs text-[#aaa] font-medium mb-3">
                    Scan via Google Pay, PhonePe, Paytm or Any UPI App:
                  </p>
                  <div className="p-3 bg-white rounded-2xl shadow-lg border border-white mb-3">
                    <img src="/qr.png" alt="Outliers Media UPI QR" className="w-44 h-44 object-contain" />
                  </div>
                  <div className="bg-[#1a1a1a] px-4 py-2 rounded-xl border border-[#333] flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#777]">UPI ID:</span>
                    <span className="text-xs font-mono text-emerald-400 font-bold select-all">dhimanpashvinder@okicici</span>
                  </div>
                </div>

                {/* Submission Form */}
                <form onSubmit={handleSubmitProof} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#aaa] mb-1.5">
                      UPI Reference / Transaction ID (UTR) *
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 429182910281"
                      value={txnId}
                      onChange={(e) => setTxnId(e.target.value)}
                      required
                      className="w-full bg-[#161616] border border-[#333] text-white p-3 rounded-xl text-sm font-mono focus:border-[#3428f8] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#aaa] mb-1.5">
                      Upload Payment Screenshot *
                    </label>
                    <div className="relative border-2 border-dashed border-[#333] hover:border-[#3428f8] rounded-2xl p-4 text-center cursor-pointer transition-colors bg-[#141414]">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setReceiptFile(e.target.files[0])}
                        required
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud size={24} className={`mx-auto mb-1 ${receiptFile ? 'text-emerald-400' : 'text-[#666]'}`} />
                      <p className="text-xs text-white font-medium truncate">
                        {receiptFile ? receiptFile.name : 'Click or drag screenshot here'}
                      </p>
                      <p className="text-[10px] text-[#666] mt-0.5">PNG, JPG, JPEG up to 10MB</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !txnId || !receiptFile}
                    className="w-full bg-[#3428f8] hover:bg-[#281cd4] disabled:bg-[#3428f8]/40 text-white p-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(52,40,248,0.3)] flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Submit Installment Proof
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
