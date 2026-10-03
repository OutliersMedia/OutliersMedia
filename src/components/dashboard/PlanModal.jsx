import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, QrCode, UploadCloud } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const plans = [
  {
    id: 'starter',
    name: 'Starter Plan',
    price: 3500,
    period: 'mo',
    features: [
      '10 Static Posts',
      '3 Reels',
      'Instagram Setup + Profile Optimization',
      'Google Business Profile Setup',
      'Content Calendar + Captions',
      'Basic Hashtag Research'
    ],
    highlight: false
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    price: 6000,
    period: 'mo',
    features: [
      '15 Static Posts',
      '4 Reels',
      '8–10 Stories/week',
      'Google Maps Daily Optimization',
      '1 Physical Poster Design',
      'Weekly Interactive Games',
      'Monthly Performance Summary'
    ],
    highlight: true,
    badge: 'MOST SELECTED'
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: 11000,
    period: 'first mo',
    subtext: '(₹6,000/mo + ₹5,000 Setup)',
    features: [
      'Everything in Growth',
      '5-Page Website',
      'Local SEO Optimization',
      'Influencer Collaboration (3–5)',
      'Monthly Analytics Video Report',
      'Monthly In-Store Event Planning'
    ],
    highlight: false
  }
];

export default function PlanModal({ isOpen, onClose, onSelectPlan, preSelectedPlanId }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  // Auto-select the plan passed from homepage
  useState(() => {
    if (preSelectedPlanId && isOpen && !selectedPlan) {
      const found = plans.find(p => p.id === preSelectedPlanId);
      if (found) setSelectedPlan(found);
    }
  });

  if (!isOpen) {
    if (selectedPlan) {
      setSelectedPlan(null);
      setReceiptFile(null);
      setIsProcessing(false);
    }
    return null;
  }

  // If modal just opened with a preSelectedPlanId but selectedPlan is still null, set it now
  if (preSelectedPlanId && !selectedPlan) {
    const found = plans.find(p => p.id === preSelectedPlanId);
    if (found) {
      setSelectedPlan(found);
      return null; // Let React re-render with the selected plan
    }
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
        receipt_url: publicUrlData.publicUrl
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`relative flex flex-col p-8 rounded-2xl border transition-all duration-300 ${
                      plan.highlight 
                        ? 'bg-surface border-accent shadow-[0_0_30px_rgba(52,40,248,0.15)] transform md:-translate-y-4' 
                        : 'bg-glass border-themeborder hover:border-accent/50'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-[#EEF2FF] text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                        {plan.badge}
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
                        plan.highlight 
                          ? 'bg-accent text-[#EEF2FF] hover:opacity-90 shadow-[0_0_20px_var(--accent-glow)]' 
                          : 'bg-surface text-primary border border-themeborder hover:border-accent'
                      }`}
                    >
                      Select Plan
                    </button>
                  </div>
                ))}
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
                className="w-full bg-accent text-[#EEF2FF] py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-[0_0_20px_var(--accent-glow)] flex justify-center items-center gap-2"
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
