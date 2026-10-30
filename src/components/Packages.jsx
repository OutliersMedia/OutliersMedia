import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, checkIsAdmin, checkIsTester } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Flame, Check, ArrowRight, ShieldCheck, Minus, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { saveCreatorOrder } from '../utils/influencerEngine';
import FadeSection from './FadeSection';

export default function Packages() {
  const [activeTab, setActiveTab] = useState('retainers'); // 'retainers' | 'creators'
  const [selectedPlanId, setSelectedPlanId] = useState("Growth");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester } = useAuth();
  const { dynamicPackages: packages } = usePricing();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  const navigate = useNavigate();

  // Creator Reels Pack States
  const [creatorPreset, setCreatorPreset] = useState(5); // 3 | 5 | 10 | 'custom'
  const [customReels, setCustomReels] = useState(4); // min 3
  const [isCreatorBookingOpen, setIsCreatorBookingOpen] = useState(false);
  const [isNegotiatingMode, setIsNegotiatingMode] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);

  // Form Fields (No Placeholders)
  const [businessName, setBusinessName] = useState(profile?.business_type || '');
  const [contactName, setContactName] = useState(profile?.name || user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagram_handle || '');
  const [niche, setNiche] = useState('Food & Cafes');
  const [proposedBudget, setProposedBudget] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price Calculation Logic
  const getReelsCount = () => {
    if (creatorPreset === 'custom') return Math.max(3, parseInt(customReels) || 3);
    return creatorPreset;
  };

  const getCreatorPrice = () => {
    if (creatorPreset === 3) return 5000;
    if (creatorPreset === 5) return 8000;
    if (creatorPreset === 10) return 15000;
    const count = Math.max(3, parseInt(customReels) || 3);
    return count * 1500;
  };

  const currentReelsCount = getReelsCount();
  const currentPrice = getCreatorPrice();

  const handleSelectClick = (id) => {
    setSelectedPlanId(id);
    setIsModalOpen(true);
  };

  const selectedPlan = packages.find(p => p.id === selectedPlanId);

  const handleOpenCreatorAction = (negotiate = false) => {
    setIsNegotiatingMode(negotiate);
    if (negotiate) {
      setProposedBudget(String(currentPrice));
    }
    setFormError('');
    setIsCreatorBookingOpen(true);
  };

  const handleCreatorOrderSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim() || !contactName.trim() || !phone.trim()) {
      setFormError("Please enter your Business Name, Contact Name, and Phone Number.");
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const orderPayload = {
        title: `Creator Reels Pack (${currentReelsCount} Reels)`,
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        instagram_handle: instagramHandle.trim().replace(/^@/, ''),
        niche: niche.trim(),
        reels_count: currentReelsCount,
        initial_quoted_price: currentPrice,
        negotiated_price: isNegotiatingMode && proposedBudget ? Number(proposedBudget) : currentPrice,
        proposed_budget: isNegotiatingMode && proposedBudget ? Number(proposedBudget) : currentPrice,
        status: isNegotiatingMode ? 'negotiating' : 'approved',
        payment_status: 'unpaid',
        client_notes: clientNotes.trim()
      };

      const result = await saveCreatorOrder(orderPayload);
      if (result.error) {
        setFormError(result.error);
        setIsSubmitting(false);
        return;
      }

      setOrderSuccessData(result.data);
      setIsCreatorBookingOpen(false);
    } catch (err) {
      console.error("Order submit failed:", err);
      setFormError("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FadeSection className="py-24 sm:py-32 px-4 sm:px-6 lg:px-12 bg-section border-y border-themeborder relative overflow-hidden min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <span className="text-accent font-bold uppercase tracking-widest text-xs sm:text-sm mb-3 block">Pricing & Solutions</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-primary">Transparent Packages</h2>
            </div>

            {/* Category Switcher: Retainers vs Creator Reels Pack */}
            <div className="inline-flex p-1.5 rounded-2xl bg-[#121212] border border-[#222] self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('retainers')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'retainers'
                    ? 'bg-[#2d23c9] text-white shadow-md'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                Monthly Retainers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('creators')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'creators'
                    ? 'bg-[#2d23c9] text-white shadow-md'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Flame size={14} className={activeTab === 'creators' ? 'text-cyan-300' : 'text-[#888]'} />
                Creator Reels Pack
              </button>
            </div>
          </div>

          {/* VIEW 1: MONTHLY RETAINERS */}
          {activeTab === 'retainers' && (
            <div className="flex flex-col gap-8">
              {packages.map((pkg) => {
                const isSelected = pkg.id === selectedPlanId;
                return (
                  <div 
                    key={pkg.id} 
                    className={`grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 sm:p-10 lg:p-16 transition-all duration-300 rounded-3xl cursor-pointer ${
                      isSelected 
                        ? 'border-2 border-accent shadow-2xl transform hover:-translate-y-1' 
                        : 'border border-glass-border shadow-sm transform hover:-translate-y-1'
                    }`}
                    style={{
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(16px)'
                    }}
                    onClick={() => setSelectedPlanId(pkg.id)}
                  >
                    <div className="lg:col-span-3 flex flex-col justify-start">
                      <h3 className="text-3xl font-serif mb-2 text-primary">{pkg.name}</h3>
                      {pkg.id === "Growth" && (
                        <span className="text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2 px-3 py-1 rounded-full w-max" style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
                          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                          Most Selected
                        </span>
                      )}
                    </div>
                    
                    <div className="lg:col-span-3 flex flex-col justify-start">
                      <div className="text-4xl font-serif text-primary">{pkg.price}</div>
                      <div className="text-sm mt-1 font-medium text-muted">{pkg.frequency}</div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col justify-start">
                      <ul className="flex flex-col gap-4">
                        {pkg.features.map((feat, fIdx) => (
                          <li key={fIdx} className="border-b border-themeborder pb-3 text-sm font-medium flex items-start gap-3 text-body">
                            <span className={`text-lg leading-none font-bold ${isSelected ? 'text-white' : 'text-[#2d23c9]'}`}>+</span>
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="lg:col-span-2 flex items-start lg:justify-end mt-6 lg:mt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectClick(pkg.id);
                        }}
                        className={`px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 w-full lg:w-auto text-center rounded-2xl border-2 ${
                          isSelected 
                            ? 'bg-[#2d23c9] border-[#2d23c9] text-white hover:bg-transparent hover:text-[#2d23c9]' 
                            : 'bg-transparent border-[#2d23c9] text-[#2d23c9] hover:bg-[#2d23c9] hover:text-white'
                        }`}
                      >
                        Select Plan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 2: CREATOR REELS PACK */}
          {activeTab === 'creators' && (
            <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 sm:p-10 lg:p-14">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/30 text-xs font-bold uppercase tracking-widest mb-3">
                    <Video size={13} /> Influencer & Creator Marketing
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-serif text-white mb-3">
                    Buy Creator Reels For Your Brand
                  </h3>
                  <p className="text-sm sm:text-base text-[#888] max-w-2xl mx-auto">
                    Get authentic local creators to showcase your business. Choose a preset or customize the exact number of reels needed. Minimum 3 creator reels.
                  </p>
                </div>

                {/* Preset Reel Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                  {/* 3 Reels */}
                  <button
                    type="button"
                    onClick={() => setCreatorPreset(3)}
                    className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                      creatorPreset === 3
                        ? 'bg-[#181818] border-[#3428f8] text-white shadow-lg'
                        : 'bg-[#121212] border-[#242424] text-[#888] hover:text-white hover:border-[#383838]'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1">Starter Pack</span>
                    <span className="text-2xl sm:text-3xl font-serif font-bold text-white block">3 Reels</span>
                    <span className="text-base sm:text-lg font-mono font-bold text-[#3428f8] mt-2 block">₹5,000</span>
                    <span className="text-[10px] text-[#666] block mt-1">₹1,667 / reel</span>
                  </button>

                  {/* 5 Reels */}
                  <button
                    type="button"
                    onClick={() => setCreatorPreset(5)}
                    className={`p-5 rounded-2xl border text-center transition-all cursor-pointer relative ${
                      creatorPreset === 5
                        ? 'bg-[#181818] border-[#3428f8] text-white shadow-lg'
                        : 'bg-[#121212] border-[#242424] text-[#888] hover:text-white hover:border-[#383838]'
                    }`}
                  >
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#3428f8] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1">Growth Pack</span>
                    <span className="text-2xl sm:text-3xl font-serif font-bold text-white block">5 Reels</span>
                    <span className="text-base sm:text-lg font-mono font-bold text-[#3428f8] mt-2 block">₹8,000</span>
                    <span className="text-[10px] text-[#666] block mt-1">₹1,600 / reel</span>
                  </button>

                  {/* 10 Reels */}
                  <button
                    type="button"
                    onClick={() => setCreatorPreset(10)}
                    className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                      creatorPreset === 10
                        ? 'bg-[#181818] border-[#3428f8] text-white shadow-lg'
                        : 'bg-[#121212] border-[#242424] text-[#888] hover:text-white hover:border-[#383838]'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1">Scale Pack</span>
                    <span className="text-2xl sm:text-3xl font-serif font-bold text-white block">10 Reels</span>
                    <span className="text-base sm:text-lg font-mono font-bold text-[#3428f8] mt-2 block">₹15,000</span>
                    <span className="text-[10px] text-[#666] block mt-1">₹1,500 / reel</span>
                  </button>

                  {/* Custom */}
                  <button
                    type="button"
                    onClick={() => setCreatorPreset('custom')}
                    className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                      creatorPreset === 'custom'
                        ? 'bg-[#181818] border-[#3428f8] text-white shadow-lg'
                        : 'bg-[#121212] border-[#242424] text-[#888] hover:text-white hover:border-[#383838]'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1">Custom Pack</span>
                    <span className="text-2xl sm:text-3xl font-serif font-bold text-white block">Custom</span>
                    <span className="text-base sm:text-lg font-mono font-bold text-blue-400 mt-2 block">₹1,500/ea</span>
                    <span className="text-[10px] text-[#666] block mt-1">Min. 3 reels</span>
                  </button>
                </div>

                {/* Interactive Custom Selector if 'custom' is active */}
                {creatorPreset === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl bg-[#141414] border border-[#262626] mb-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-[#888] font-bold uppercase tracking-wider block mb-1">
                          Select Number of Creator Reels
                        </span>
                        <div className="text-2xl font-serif font-bold text-white">
                          {currentReelsCount} Creator Reels
                        </div>
                        <span className="text-xs text-[#666]">
                          Calculated at ₹1,500 per reel (Minimum 3 reels)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setCustomReels(prev => Math.max(3, prev - 1))}
                          className="w-10 h-10 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-mono text-xl font-bold w-12 text-center text-white">
                          {currentReelsCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomReels(prev => prev + 1)}
                          className="w-10 h-10 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#222]">
                      <input
                        type="range"
                        min="3"
                        max="25"
                        step="1"
                        value={currentReelsCount}
                        onChange={(e) => setCustomReels(parseInt(e.target.value))}
                        className="w-full accent-[#3428f8] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#666] font-mono mt-1">
                        <span>3 Reels</span>
                        <span>10 Reels</span>
                        <span>15 Reels</span>
                        <span>25+ Reels</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Summary Card with Features & CTAs */}
                <div className="p-8 rounded-3xl bg-[#121212] border border-[#222] flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-[#888] font-bold uppercase tracking-wider block mb-1">Selected Package</span>
                      <div className="text-3xl sm:text-4xl font-serif font-bold text-white flex items-baseline gap-3">
                        <span>₹{currentPrice.toLocaleString('en-IN')}</span>
                        <span className="text-sm font-sans text-[#777] font-normal">for {currentReelsCount} Creator Reels</span>
                      </div>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#bbb] pt-2">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#3428f8] shrink-0" />
                        <span>Niche-specific creators matching your target audience</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#3428f8] shrink-0" />
                        <span>Hook ideation, concept script & storyboarding</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#3428f8] shrink-0" />
                        <span>Full HD 9:16 vertical shoot with raw footage</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#3428f8] shrink-0" />
                        <span>Complete commercial usage & distribution rights</span>
                      </li>
                    </ul>
                  </div>

                  {/* Dual Actions: Instant Booking & Negotiate Custom Terms */}
                  <div className="flex flex-col gap-3 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => handleOpenCreatorAction(false)}
                      className="w-full py-4 px-6 rounded-2xl bg-[#3428f8] hover:bg-[#271bd4] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      Book Creator Pack
                      <ArrowRight size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCreatorAction(true)}
                      className="w-full py-3 px-6 rounded-2xl bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#555] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center"
                    >
                      Negotiate Price
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </FadeSection>

      {/* RETAINERS PLAN MODAL VIA PORTAL */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && selectedPlan && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3 }}
                className="bg-[#0f0f0f] border border-[#222] p-8 sm:p-10 rounded-3xl max-w-md w-full shadow-2xl relative"
                onClick={e => e.stopPropagation()}
              >
                <button 
                  className="absolute top-6 right-6 text-muted hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setIsModalOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <h3 className="text-3xl font-serif text-primary mb-2">{selectedPlan.name}</h3>
                <div className="text-2xl font-serif text-primary mb-6">{selectedPlan.price}<span className="text-sm text-muted font-sans">{selectedPlan.frequency}</span></div>
                <ul className="flex flex-col gap-3 mb-8">
                  {selectedPlan.features.map((feat, idx) => (
                    <li key={idx} className="text-sm font-medium flex items-start gap-3 text-body">
                      <span className="text-[#2d23c9] font-bold text-lg leading-none">+</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    if (isAdmin || isTester) {
                      navigate('/admin');
                    } else {
                      navigate(`/dashboard?plan=${selectedPlan.id.toLowerCase()}`);
                    }
                  }}
                  className="w-full bg-[#2d23c9] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#3c06cf] transition-colors text-sm cursor-pointer"
                >
                  Activate This Plan
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* CREATOR PACK BOOKING & NEGOTIATION MODAL VIA PORTAL */}
      {createPortal(
        <AnimatePresence>
          {isCreatorBookingOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsCreatorBookingOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0f0f0f] border border-[#222] p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-4 border-b border-[#222] mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3428f8] block">
                      {isNegotiatingMode ? 'Custom Proposal' : 'Direct Booking'}
                    </span>
                    <h3 className="text-xl font-serif text-white font-bold">
                      {isNegotiatingMode ? 'Negotiate Creator Pack' : 'Confirm Creator Pack'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatorBookingOpen(false)}
                    className="p-2 text-[#888] hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Package Recap */}
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#222] mb-5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#888] block text-[10px] uppercase font-bold">Selected Scope</span>
                    <span className="text-white font-bold">{currentReelsCount} Creator Reels</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#888] block text-[10px] uppercase font-bold">Standard Price</span>
                    <span className="text-[#3428f8] font-mono font-bold">₹{currentPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs mb-4">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreatorOrderSubmit} className="space-y-4">
                  {/* Business Name */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                      Business / Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                    />
                  </div>

                  {/* Contact Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                        Contact Person *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                      />
                    </div>
                  </div>

                  {/* Email & Instagram */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                        Instagram Handle
                      </label>
                      <input
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                      />
                    </div>
                  </div>

                  {/* Niche Category */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                      Brand Niche / Category
                    </label>
                    <select
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none"
                    >
                      <option value="Food & Cafes">Food, Cafes & Restaurants</option>
                      <option value="Fashion & Apparel">Fashion, Apparel & Footwear</option>
                      <option value="Fitness & Gym">Fitness, Gym & Wellness</option>
                      <option value="Real Estate & Interior">Real Estate & Interior Design</option>
                      <option value="Beauty & Salon">Beauty, Skin & Salon</option>
                      <option value="Nightlife & Events">Nightlife, Clubs & Events</option>
                      <option value="Tech & Services">Tech, Education & Services</option>
                      <option value="Other">Other Category</option>
                    </select>
                  </div>

                  {/* Proposed Budget if Negotiating */}
                  {isNegotiatingMode && (
                    <div className="p-3.5 rounded-xl bg-[#3428f8]/10 border border-[#3428f8]/25">
                      <label className="text-xs font-bold uppercase tracking-wider text-blue-300 block mb-1">
                        Your Proposed Budget (₹) *
                      </label>
                      <input
                        type="number"
                        min="1000"
                        value={proposedBudget}
                        onChange={(e) => setProposedBudget(e.target.value)}
                        className="w-full bg-[#161616] border border-[#3428f8]/30 rounded-xl p-3 text-sm text-white font-mono focus:border-[#3428f8] outline-none"
                      />
                      <span className="text-[11px] text-[#888] mt-1 block">
                        Enter your desired offer. Our team will review and respond with a finalized quote.
                      </span>
                    </div>
                  )}

                  {/* Client Notes / Special Instructions */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                      Campaign Instructions / Notes (Optional)
                    </label>
                    <textarea
                      rows="2"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white focus:border-[#3428f8] outline-none resize-none"
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatorBookingOpen(false)}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#181818] border border-[#282828] text-xs font-bold uppercase tracking-wider text-[#aaa] hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#3428f8] hover:bg-[#271bd4] text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : isNegotiatingMode ? 'Submit Proposal' : 'Confirm Order'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* SUCCESS CONFIRMATION MODAL VIA PORTAL */}
      {createPortal(
        <AnimatePresence>
          {orderSuccessData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
              onClick={() => setOrderSuccessData(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0f0f0f] border border-[#222] p-8 rounded-3xl max-w-md w-full shadow-2xl relative text-center"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} />
                </div>

                <h3 className="text-2xl font-serif text-white font-bold mb-1">
                  {orderSuccessData.status === 'negotiating' ? 'Proposal Received' : 'Order Placed Successfully'}
                </h3>
                <span className="text-xs font-mono text-[#3428f8] bg-[#3428f8]/10 px-3 py-1 rounded-full inline-block mb-4">
                  Order ID: {orderSuccessData.order_number}
                </span>

                <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 text-left text-xs mb-6 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#888]">Business:</span>
                    <span className="text-white font-bold">{orderSuccessData.business_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888]">Deliverables:</span>
                    <span className="text-white font-bold">{orderSuccessData.reels_count} Creator Reels</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888]">Amount:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      ₹{orderSuccessData.negotiated_price.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#888]">Status:</span>
                    <span className="text-amber-400 font-bold uppercase text-[10px]">
                      {orderSuccessData.status === 'negotiating' ? 'Review & Negotiation' : 'Confirmed'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#888] mb-6 leading-relaxed">
                  {orderSuccessData.status === 'negotiating'
                    ? "Our team is reviewing your requested proposal. We will finalize terms and update your client dashboard shortly."
                    : "Your Creator Pack has been enrolled. You can track progress and creator reel milestones in your dashboard."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setOrderSuccessData(null);
                    if (user) {
                      navigate('/dashboard');
                    }
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#3428f8] hover:bg-[#271bd4] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {user ? 'Go to Dashboard' : 'Done'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
