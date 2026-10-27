import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, QrCode, UploadCloud, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { usePricing } from '../../context/PricingContext';

export default function PlanModal({ isOpen, onClose, onSelectPlan, preSelectedPlanId }) {
  const { dynamicModalPlans: plans } = usePricing();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [instagramHandleInput, setInstagramHandleInput] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleConfirmPayment = async () => {
    if (!receiptFile) {
      alert("Please upload a screenshot of your payment receipt before continuing.");
      return;
    }

    setIsProcessing(true);

    try {
      // Upload receipt to Supabase Storage
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) {
        alert("Error uploading receipt: " + uploadError.message);
        return; // Finally block will reset isProcessing
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      await onSelectPlan({
        ...selectedPlan,
        receipt_url: publicUrlData.publicUrl,
        business_name: businessNameInput.trim() || undefined,
        instagram_handle: instagramHandleInput.trim() || undefined
      });
    } catch (err) {
      alert("Unexpected error during upload: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pt-20 pb-4 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setSelectedPlan(null);
            setReceiptFile(null);
            onClose();
          }}
        ></motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`bg-base border border-themeborder rounded-3xl shadow-2xl relative z-10 w-full ${selectedPlan ? 'max-w-xl' : 'max-w-6xl'} p-6 lg:p-10 my-auto`}
        >
          <button 
            onClick={() => {
              setSelectedPlan(null);
              setReceiptFile(null);
              onClose();
            }}
            className="absolute top-6 right-6 text-muted hover:text-primary transition-colors bg-surface rounded-full p-2"
          >
            <X size={20} />
          </button>

          {!selectedPlan ? (
            <>
              <div className="text-center mb-10 mt-4">
                <h2 className="text-3xl md:text-5xl font-serif text-primary mb-4">Select Your Plan</h2>
                <p className="text-muted max-w-2xl mx-auto">Activate your project instantly. Choose the plan that best fits your brand's goals.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => {
                  const isPreSelected = Boolean(preSelectedPlanId && plan.id.toLowerCase() === preSelectedPlanId.toLowerCase());
                  const isHighlighted = isPreSelected || plan.highlight;

                  return (
                    <div 
                      key={plan.id}
                      className={`relative flex flex-col p-8 rounded-2xl border transition-all duration-300 ${
                        isHighlighted 
                          ? 'bg-surface border-accent transform md:-translate-y-4 ring-2 ring-accent/50' 
                          : 'bg-glass border-themeborder hover:border-accent/50'
                      }`}
                    >
                      {(isPreSelected || plan.badge) && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-[#EEF2FF] text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                          {isPreSelected ? 'YOUR SELECTED PLAN' : plan.badge}
                        </div>
                      )}
                      
                      <h3 className="text-2xl font-serif text-primary mb-2">{plan.name}</h3>
                      <div className="mb-6 flex items-end gap-1">
                        <span className="text-4xl font-bold text-primary">₹{plan.price.toLocaleString()}</span>
                        <span className="text-muted text-sm pb-1">/{plan.period}</span>
                      </div>
                      {plan.subtext && <p className="text-muted text-sm mb-4">{plan.subtext}</p>}
                      
                      <div className="h-px w-full bg-themeborder mb-6"></div>
                      
                      <ul className="flex flex-col gap-4 mb-8 flex-grow">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm text-primary">
                            <CheckCircle2 size={20} className="text-accent shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button 
                        onClick={() => setSelectedPlan(plan)}
                        className={`w-full py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                          isHighlighted 
                            ? 'bg-accent text-[#EEF2FF] hover:opacity-90' 
                            : 'bg-surface text-primary border border-themeborder hover:border-accent'
                        }`}
                      >
                        Activate This Plan
                      </button>
                    </div>
                  );
                })}

                {/* Influencer Marketing Plan Option */}
                <div className="relative flex flex-col p-8 rounded-2xl border border-purple-500/40 bg-purple-950/15 hover:border-purple-400 transition-all duration-300">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest px-3.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                    <Sparkles size={11} /> INFLUENCERS
                  </div>
                  
                  <h3 className="text-2xl font-serif text-primary mb-2">Influencers</h3>
                  <div className="mb-6 flex items-end gap-1">
                    <span className="text-3xl font-bold text-primary">Custom</span>
                    <span className="text-muted text-sm pb-1">/campaign</span>
                  </div>
                  <p className="text-muted text-sm mb-4">Dedicated influencer collaboration campaigns, barter & paid reels matching your brand vibe.</p>
                  
                  <div className="h-px w-full bg-themeborder mb-6"></div>
                  
                  <ul className="flex flex-col gap-4 mb-8 flex-grow">
                    <li className="flex items-start gap-3 text-sm text-primary">
                      <CheckCircle2 size={20} className="text-purple-400 shrink-0" />
                      <span>3 to 10 Reels Per Contract</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-primary">
                      <CheckCircle2 size={20} className="text-purple-400 shrink-0" />
                      <span>Niche Creator Matching (Food, Lifestyle, Fashion)</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-primary">
                      <CheckCircle2 size={20} className="text-purple-400 shrink-0" />
                      <span>Barter & Paid Compensation Options</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-primary">
                      <CheckCircle2 size={20} className="text-purple-400 shrink-0" />
                      <span>Scripting, Editing & Delivery Management</span>
                    </li>
                  </ul>

                  <a
                    href="https://wa.me/919729714352?text=Please%20share%20the%20details%20about%20the%20influencer%20marketing%20plan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <MessageSquare size={16} /> Connect on WhatsApp
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 text-accent">
                  <QrCode size={32} />
                </div>
                <h2 className="text-2xl font-serif text-primary mb-2">Complete Payment</h2>
                <p className="text-muted text-sm">
                  Scan the QR code below or use the UPI ID to pay <strong className="text-primary">₹{selectedPlan.price.toLocaleString()}</strong>
                </p>
              </div>

              <div className="bg-surface border border-themeborder rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 justify-center mb-6">
                <div className="w-40 h-40 bg-raised border border-themeborder rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
                  <img src="/payment-qr.png" alt="UPI QR Code" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                
                <div className="w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1 block">Brand / Business Name</label>
                      <input
                        type="text"
                        value={businessNameInput}
                        onChange={(e) => setBusinessNameInput(e.target.value)}
                        className="w-full bg-base border border-themeborder rounded-xl p-2.5 text-xs text-primary focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1 block">Instagram Handle (Optional)</label>
                      <input
                        type="text"
                        value={instagramHandleInput}
                        onChange={(e) => setInstagramHandleInput(e.target.value)}
                        className="w-full bg-base border border-themeborder rounded-xl p-2.5 text-xs text-primary focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div className="w-full bg-base border border-themeborder rounded-xl p-4 text-center mb-4">
                    <p className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1">UPI ID</p>
                    <p className="text-primary font-mono text-xs font-bold tracking-wide">dhimanpashvinder@okicici</p>
                  </div>

                  <div className="w-full">
                    <label className="text-muted text-[10px] uppercase tracking-widest font-bold mb-2 block text-center">Upload Payment Screenshot</label>
                    <div className="relative border border-themeborder border-dashed rounded-xl p-4 text-center hover:bg-base transition-colors cursor-pointer group">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <UploadCloud size={20} className={receiptFile ? 'text-green-500' : 'text-muted group-hover:text-primary'} />
                        <span className={`text-xs ${receiptFile ? 'text-green-500 font-bold' : 'text-primary'}`}>
                          {receiptFile ? receiptFile.name : 'Click to browse or drag file'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="w-full bg-accent text-[#EEF2FF] py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex justify-center items-center gap-2"
              >
                {isProcessing ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : 'Payment Done & Receipt Uploaded'}
              </button>
              
              <button 
                onClick={() => {
                  setSelectedPlan(null);
                  setReceiptFile(null);
                }}
                className="w-full text-center text-muted text-xs font-bold uppercase tracking-widest mt-4 hover:text-primary transition-colors"
              >
                Back to Plans
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
