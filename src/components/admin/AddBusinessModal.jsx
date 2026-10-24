import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Briefcase, Plus, UserPlus, UserCheck, CheckCircle, 
  Upload, Image as ImageIcon, Calendar, IndianRupee, Tag, AlertCircle,
  Trash2, Eye
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { usePricing } from '../../context/PricingContext';
import { isEmailAdmin } from '../../context/AuthContext';

export default function AddBusinessModal({ isOpen, onClose, onSuccess }) {
  const { livePricing } = usePricing();

  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [existingProfiles, setExistingProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Cafe & Restaurant');
  const [instagramHandle, setInstagramHandle] = useState('');

  const [selectedPlan, setSelectedPlan] = useState('Starter Plan');
  const [agreedPrice, setAgreedPrice] = useState(String(livePricing?.starter || 3500));
  const [orderStatus, setOrderStatus] = useState('active'); // 'active' | 'pending'
  const [firstUploadDate, setFirstUploadDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().split('T')[0];
  });

  const [receiptFiles, setReceiptFiles] = useState([]); // array of { id, file, previewUrl, name }
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch existing non-admin clients when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      setErrorMsg('');
      receiptFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setReceiptFiles([]);
      setPreviewReceiptUrl(null);
    }
  }, [isOpen]);

  const handleAttachReceipts = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files).map(file => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name
      }));
      setReceiptFiles(prev => [...prev, ...added]);
      e.target.value = '';
    }
  };

  const handleRemoveReceipt = (id) => {
    setReceiptFiles(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(item => item.id !== id);
    });
  };

  // Adjust price when plan changes
  useEffect(() => {
    if (selectedPlan === 'Starter Plan') {
      setAgreedPrice(String(livePricing?.starter || 3500));
    } else if (selectedPlan === 'Growth Plan') {
      setAgreedPrice(String(livePricing?.growth || 6000));
    } else if (selectedPlan === 'Premium Plan') {
      setAgreedPrice(String(livePricing?.premium || 8000));
    }
  }, [selectedPlan, livePricing]);

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    const { data } = await supabase
      .from('profiles')
      .select('auth_id, name, email, phone, business_type, instagram_handle, role')
      .order('name', { ascending: true });

    if (data) {
      // Filter out admins
      const nonAdmins = data.filter(p => p.role !== 'admin' && !isEmailAdmin(p.email));
      setExistingProfiles(nonAdmins);
      if (nonAdmins.length > 0 && !selectedClientId) {
        setSelectedClientId(nonAdmins[0].auth_id);
      }
    }
    setLoadingProfiles(false);
  };

  const filteredExistingClients = existingProfiles.filter(p => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!businessName.trim()) {
      setErrorMsg('Please enter a business name.');
      return;
    }

    if (mode === 'new') {
      if (!clientName.trim() || !clientEmail.trim()) {
        setErrorMsg('Please provide client name and email address.');
        return;
      }
    } else if (mode === 'existing') {
      if (!selectedClientId) {
        setErrorMsg('Please select an existing client.');
        return;
      }
    }

    const priceNum = Number(agreedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid agreed price.');
      return;
    }

    setSubmitting(true);
    try {
      let targetClientId = selectedClientId;
      let targetClientProfile = existingProfiles.find(p => p.auth_id === selectedClientId);

      // 1. If Brand New Client, create profile or check if email exists
      if (mode === 'new') {
        const cleanEmail = clientEmail.trim().toLowerCase();
        // Check if profile exists with this email
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingUser) {
          targetClientId = existingUser.auth_id;
          targetClientProfile = existingUser;
        } else {
          const newAuthId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`;
          const newProfile = {
            auth_id: newAuthId,
            name: clientName.trim(),
            email: cleanEmail,
            phone: clientPhone.trim() || null,
            business_type: businessType,
            instagram_handle: instagramHandle.trim() || null,
            role: 'client',
            created_at: new Date().toISOString()
          };

          const { error: profError } = await supabase.from('profiles').insert([newProfile]);
          if (profError) {
            console.warn("Profile creation note:", profError.message);
          }
          targetClientId = newAuthId;
          targetClientProfile = newProfile;
        }
      }

      // 2. Generate Next OMxxxx Order ID
      const { data: allOrders } = await supabase
        .from('orders')
        .select('order_id')
        .order('created_at', { ascending: false });

      let nextOrderNum = 1002;
      if (allOrders && allOrders.length > 0) {
        const numbers = allOrders
          .map(o => parseInt((o.order_id || '').replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        if (numbers.length > 0) {
          nextOrderNum = Math.max(...numbers) + 1;
        }
      }
      const newOrderId = `OM${nextOrderNum}`;

      // 3. Upload screenshot(s) if selected
      const uploadedReceiptUrls = [];
      if (receiptFiles.length > 0) {
        for (let i = 0; i < receiptFiles.length; i++) {
          const item = receiptFiles[i];
          const ext = item.file.name.split('.').pop() || 'png';
          const fileName = `receipt_${newOrderId}_${Date.now()}_${i}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('receipts')
            .upload(fileName, item.file, { upsert: true });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(fileName);
            if (pubData?.publicUrl) {
              uploadedReceiptUrls.push(pubData.publicUrl);
            }
          }
        }
      }
      const primaryReceiptUrl = uploadedReceiptUrls.length > 0 ? uploadedReceiptUrls[0] : null;

      // 4. Determine Plan Quotas
      const isStarter = selectedPlan.includes('Starter');
      const isGrowth = selectedPlan.includes('Growth');
      const isPremium = selectedPlan.includes('Premium');

      const staticQuota = isStarter ? 12 : (isGrowth ? 15 : 15);
      const reelsQuota = isStarter ? 8 : (isGrowth ? 12 : 12);
      const storiesQuota = 15;
      const postersQuota = isStarter ? 0 : 0;
      const hasWebsite = isPremium;

      const paidAmount = orderStatus === 'active' ? priceNum : 0;
      const balanceDue = orderStatus === 'active' ? 0 : priceNum;

      // 5. Build Initial Installment Plan
      const initialInstallments = [
        {
          installment_number: 1,
          amount: priceNum,
          due_date: firstUploadDate,
          status: orderStatus === 'active' ? 'paid' : 'pending',
          paid_at: orderStatus === 'active' ? new Date().toISOString() : null,
          payment_id: `TXN-${newOrderId}-${Date.now().toString().slice(-4)}`,
          notes: orderStatus === 'active' ? 'Payment Confirmed on Enrollment' : 'Initial Retainer',
          receipt_url: primaryReceiptUrl,
          receipt_urls: uploadedReceiptUrls
        }
      ];

      const scheduleConfig = {
        business_name: businessName.trim(),
        business_type: businessType,
        instagram_handle: instagramHandle.trim(),
        firstUploadDate: firstUploadDate,
        staticPerWeek: isStarter ? 3 : 4,
        staticInterval: 2,
        reelsPerWeek: isStarter ? 2 : 3,
        reelsInterval: 3,
        storiesPerWeek: 4,
        storiesInterval: 2,
        totalStories: storiesQuota,
        installments: initialInstallments,
        receipt_urls: uploadedReceiptUrls
      };

      // 6. Insert Order into Supabase
      const newOrderPayload = {
        order_id: newOrderId,
        client_id: targetClientId,
        plan_name: selectedPlan,
        amount_paid: paidAmount,
        original_amount: priceNum,
        total_agreed_amount: priceNum,
        balance_due: balanceDue,
        static_posts_total: staticQuota,
        reels_total: reelsQuota,
        stories_total: storiesQuota,
        posters_total: postersQuota,
        has_website: hasWebsite,
        status: orderStatus,
        payment_receipt_url: primaryReceiptUrl,
        payment_id: `TXN-${newOrderId}`,
        first_upload_date: firstUploadDate,
        schedule_config: scheduleConfig,
        installments: initialInstallments,
        business_name: businessName.trim(),
        business_type: businessType,
        instagram_handle: instagramHandle.trim(),
        created_at: new Date().toISOString()
      };

      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([newOrderPayload])
        .select()
        .single();

      if (orderErr) {
        throw new Error(orderErr.message);
      }

      // Broadcast sync event so open tabs refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('om_business_added', { detail: createdOrder }));
      }

      alert(`✓ Successfully created business "${businessName.trim()}" (Order ${newOrderId})!`);
      if (onSuccess) onSuccess(createdOrder);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to create business.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        onClick={() => !submitting && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
                <Briefcase size={22} />
              </div>
              <div>
                <h3 className="text-xl font-serif text-white">Enroll Business / Add Client</h3>
                <p className="text-xs text-[#888]">
                  Add a new business brand to an existing client, or onboard a new client completely.
                </p>
              </div>
            </div>

            <button
              onClick={() => !submitting && onClose()}
              className="text-[#666] hover:text-white p-2 rounded-full bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#0a0a0a] border border-[#222] rounded-2xl my-4">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === 'existing'
                  ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.3)]'
                  : 'text-[#777] hover:text-white'
              }`}
            >
              <UserCheck size={14} /> Add to Existing Client
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === 'new'
                  ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.3)]'
                  : 'text-[#777] hover:text-white'
              }`}
            >
              <UserPlus size={14} /> New Client & Business
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Body - Scrollable */}
          <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 flex flex-col gap-5 py-2 custom-scrollbar">
            
            {/* Mode A: Select Existing Client */}
            {mode === 'existing' && (
              <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
                <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                  Select Existing Client <span className="text-[#3428f8]">*</span>
                </label>

                <div className="mb-3">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search client by name, email, or phone..."
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                  />
                </div>

                {loadingProfiles ? (
                  <p className="text-xs text-[#666]">Loading clients...</p>
                ) : filteredExistingClients.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar">
                    {filteredExistingClients.map(c => (
                      <div
                        key={c.auth_id}
                        onClick={() => setSelectedClientId(c.auth_id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex justify-between items-center ${
                          selectedClientId === c.auth_id
                            ? 'bg-[#3428f8]/15 border-[#3428f8] text-white font-bold'
                            : 'bg-[#0e0e0e] border-[#222] text-[#aaa] hover:bg-[#181818]'
                        }`}
                      >
                        <div>
                          <p className="text-white font-medium">{c.name || 'Unnamed Client'}</p>
                          <p className="text-[11px] text-[#777] font-mono">{c.email} {c.phone ? `• ${c.phone}` : ''}</p>
                        </div>
                        {selectedClientId === c.auth_id && (
                          <CheckCircle size={14} className="text-[#3428f8]" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#777] italic">No clients found matching search.</p>
                )}
              </div>
            )}

            {/* Mode B: Brand New Client Inputs */}
            {mode === 'new' && (
              <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 flex flex-col gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#aaa] block">
                  Client Information <span className="text-[#3428f8]">*</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#888] font-medium block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#888] font-medium block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="e.g. rahul@brand.com"
                      className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">Phone Number (WhatsApp)</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                  />
                </div>
              </div>
            )}

            {/* Business Brand Details */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#aaa] block">
                New Business Brand Details
              </span>

              <div>
                <label className="text-[11px] text-[#888] font-medium block mb-1">
                  Business / Brand Name <span className="text-[#3428f8]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Cravory Cafe, Zenith Apparel..."
                  className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-sm font-bold p-3 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">Business Category</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                  >
                    <option value="Cafe & Restaurant">Cafe & Restaurant</option>
                    <option value="Ecommerce & Retail">Ecommerce & Retail</option>
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Tech & SaaS">Tech & SaaS</option>
                    <option value="Beauty & Salon">Beauty & Salon</option>
                    <option value="Agency / Services">Agency / Services</option>
                    <option value="Other">Other Business</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="e.g. @cravorycafe"
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Plan, Pricing & Schedule */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#aaa] block">
                Retainer Plan & Agreed Contract Price
              </span>

              <div className="grid grid-cols-3 gap-2">
                {['Starter Plan', 'Growth Plan', 'Premium Plan'].map(plan => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      selectedPlan === plan
                        ? 'bg-[#3428f8]/15 border-[#3428f8] text-white shadow-[0_0_10px_rgba(52,40,248,0.2)]'
                        : 'bg-[#0a0a0a] border-[#252525] text-[#888] hover:text-white'
                    }`}
                  >
                    {plan.replace(' Plan', '')}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">
                    Agreed Price (₹) <span className="text-[#3428f8]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min="100"
                      step="100"
                      value={agreedPrice}
                      onChange={(e) => setAgreedPrice(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] focus:border-green-500 text-white font-mono text-base font-bold p-2.5 pl-8 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">First Deliverable Date</label>
                  <input
                    type="date"
                    value={firstUploadDate}
                    onChange={(e) => setFirstUploadDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs font-mono p-2.5 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">Enrollment Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs p-2.5 rounded-xl outline-none font-bold"
                  >
                    <option value="active">Active (Payment Received / Ready to Start)</option>
                    <option value="pending">Pending (Awaiting Initial Payment Approval)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-[#888] font-medium">Payment Proof Screenshots</label>
                    {receiptFiles.length > 0 && (
                      <span className="text-[10px] text-purple-400 font-mono font-bold">
                        {receiptFiles.length} attached
                      </span>
                    )}
                  </div>
                  <label className="flex items-center justify-center gap-2 p-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-dashed border-[#333] hover:border-[#3428f8] rounded-xl text-xs text-[#aaa] hover:text-white transition-all cursor-pointer">
                    <Upload size={13} className="text-[#3428f8]" />
                    <span className="truncate">
                      {receiptFiles.length > 0 ? `+ Add More Screenshots (${receiptFiles.length})` : 'Attach Screenshot(s)'}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleAttachReceipts}
                    />
                  </label>
                </div>
              </div>

              {/* Multi-Screenshot Thumbnails Preview */}
              {receiptFiles.length > 0 && (
                <div className="pt-2 border-t border-[#1e1e1e]">
                  <span className="text-[10px] text-[#888] font-bold uppercase tracking-wider block mb-2">
                    Attached Proofs ({receiptFiles.length})
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {receiptFiles.map((item, idx) => (
                      <div
                        key={item.id}
                        className="relative group rounded-xl overflow-hidden border border-[#333] bg-[#0a0a0a] w-20 h-16 shrink-0"
                      >
                        <img 
                          src={item.previewUrl} 
                          alt={`Proof ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => setPreviewReceiptUrl(item.previewUrl)}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveReceipt(item.id);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                          title="Remove screenshot"
                        >
                          <Trash2 size={10} />
                        </button>
                        <div 
                          onClick={() => setPreviewReceiptUrl(item.previewUrl)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold pointer-events-none"
                        >
                          <Eye size={11} className="mr-0.5" /> Zoom
                        </div>
                      </div>
                    ))}

                    <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#333] hover:border-[#3428f8] bg-[#0d0d0d] hover:bg-[#161616] text-[#777] hover:text-white transition-all cursor-pointer w-20 h-16 shrink-0">
                      <Plus size={14} className="text-[#3428f8]" />
                      <span className="text-[10px] font-bold">+ Add</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleAttachReceipts}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#252525] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#3428f8] hover:bg-[#281cd4] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(52,40,248,0.35)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                ) : (
                  <>
                    <Plus size={15} /> Enroll Business
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Fullscreen Zoom Preview for attached screenshots */}
        {previewReceiptUrl && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#333] rounded-3xl p-4 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#222]">
                <span className="text-white text-xs font-bold uppercase tracking-wider">Screenshot Preview</span>
                <button
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-auto flex items-center justify-center p-2 mt-2">
                <img 
                  src={previewReceiptUrl} 
                  alt="Receipt Zoom" 
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
