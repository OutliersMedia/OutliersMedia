import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Video, Image as ImageIcon, Sparkles, Globe, Star, 
  Check, Calendar, IndianRupee, Link as LinkIcon, Upload, 
  Trash2, Eye, ExternalLink, Briefcase, Plus, AlertCircle 
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { saveSpecialDeliverable } from '../../utils/scheduleEngine';
import { dispatchPushNotification, triggerLocalNotification } from '../../utils/pushManager';

export const SPECIAL_TYPES = [
  { id: 'reel', label: 'Reel / Short', icon: Video, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  { id: 'static', label: 'Static Post', icon: ImageIcon, color: 'text-[#3428f8]', border: 'border-[#3428f8]/30', bg: 'bg-[#3428f8]/10' },
  { id: 'story', label: 'Story', icon: Sparkles, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  { id: 'website', label: 'Website / App', icon: Globe, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  { id: 'other', label: 'Something Else', icon: Star, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
];

export default function AddSpecialDeliverableModal({ 
  isOpen, 
  onClose, 
  initialClient = null, 
  initialOrder = null, 
  onSuccess 
}) {
  const [clientsList, setClientsList] = useState([]);
  const [selectedOrderKey, setSelectedOrderKey] = useState('');
  
  // Deliverable Form State
  const [deliverableType, setDeliverableType] = useState('website'); // 'reel' | 'static' | 'story' | 'website' | 'other'
  const [customTypeName, setCustomTypeName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliverableStatus, setDeliverableStatus] = useState('delivered'); // 'delivered' | 'in_progress'
  
  // Payment State
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [priceInput, setPriceInput] = useState('3500');
  const [paymentStatus, setPaymentStatus] = useState('paid'); // 'paid' | 'pending'
  const [paymentId, setPaymentId] = useState('');
  const [receiptFiles, setReceiptFiles] = useState([]); // { id, file, previewUrl, name }
  const [zoomReceiptUrl, setZoomReceiptUrl] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch client orders when modal opens
  useEffect(() => {
    if (isOpen) {
      loadClients();
      setErrorMsg('');
      setReceiptFiles([]);
      setZoomReceiptUrl(null);
      
      // Defaults
      if (initialOrder) {
        setSelectedOrderKey(initialOrder.order_id);
      }
    }
  }, [isOpen, initialOrder]);

  const loadClients = async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, client:client_id(auth_id, name, email, phone, business_type, instagram_handle)')
        .order('created_at', { ascending: false });

      if (ordersData) {
        setClientsList(ordersData);
        if (!selectedOrderKey && ordersData.length > 0) {
          setSelectedOrderKey(initialOrder?.order_id || ordersData[0].order_id);
        }
      }
    } catch (err) {
      console.warn("Client list fetch notice:", err);
    }
  };

  const handleAttachReceipts = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files).map(file => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const targetOrder = initialOrder || clientsList.find(o => o.order_id === selectedOrderKey);
    if (!targetOrder) {
      setErrorMsg("Please select a valid client and brand.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("Please enter a deliverable title (e.g. Spin the Wheel Interactive Website).");
      return;
    }

    if (deliverableType === 'other' && !customTypeName.trim()) {
      setErrorMsg("Please specify the custom deliverable type name.");
      return;
    }

    const price = isComplimentary ? 0 : Number(priceInput || 0);
    if (!isComplimentary && (isNaN(price) || price < 0)) {
      setErrorMsg("Please enter a valid price amount in ₹.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload proof screenshots if attached
      const uploadedReceiptUrls = [];
      if (receiptFiles.length > 0) {
        for (let i = 0; i < receiptFiles.length; i++) {
          const item = receiptFiles[i];
          const ext = item.file.name.split('.').pop() || 'png';
          const fileName = `special_receipt_${targetOrder.order_id}_${Date.now()}_${i}.${ext}`;
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

      // Determine category display
      let categoryDisplay = 'Website / Web App';
      if (deliverableType === 'reel') categoryDisplay = 'Special Reel';
      else if (deliverableType === 'static') categoryDisplay = 'Special Static Post';
      else if (deliverableType === 'story') categoryDisplay = 'Special Story';
      else if (deliverableType === 'website') categoryDisplay = 'Website / Web App';
      else if (deliverableType === 'other') categoryDisplay = customTypeName.trim();

      const deliverablePayload = {
        title: title.trim(),
        deliverable_type: deliverableType,
        custom_type_name: deliverableType === 'other' ? customTypeName.trim() : null,
        category: categoryDisplay,
        description: description.trim(),
        project_url: projectUrl.trim() || null,
        status: deliverableStatus,
        price,
        payment_status: isComplimentary ? 'complimentary' : paymentStatus,
        payment_id: paymentId.trim() || (paymentStatus === 'paid' && price > 0 ? `TXN-SPECIAL-${Date.now().toString().slice(-6)}` : null),
        payment_receipt_url: uploadedReceiptUrls[0] || null,
        receipt_urls: uploadedReceiptUrls,
        delivered_at: deliveryDate || new Date().toISOString().split('T')[0],
        scheduled_date: deliveryDate
      };

      const result = await saveSpecialDeliverable(targetOrder, deliverablePayload);
      if (result.error) {
        throw result.error;
      }

      // Send Push and Local Notification to Client
      const targetUserId = targetOrder.client_id || targetOrder.client?.auth_id;
      if (targetUserId) {
        try {
          await dispatchPushNotification({
            userId: targetUserId,
            title: `🎉 Special Deliverable: ${title.trim()}`,
            body: `Your custom ${categoryDisplay} has been delivered and is live on your Outliers Media dashboard!`,
            url: '/dashboard'
          });
        } catch {}
      }

      triggerLocalNotification(`Special Deliverable Created: ${title.trim()}`, {
        body: `Delivered for ${targetOrder.client?.name || targetOrder.order_id} • ₹${price.toLocaleString()}`
      });

      if (onSuccess) {
        onSuccess(result.data);
      }
      onClose();
    } catch (err) {
      setErrorMsg("Error saving deliverable: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentOrder = initialOrder || clientsList.find(o => o.order_id === selectedOrderKey);
  const brandName = currentOrder?.business_name || currentOrder?.schedule_config?.business_name || currentOrder?.client?.business_type || 'Main Brand';

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
          className="bg-[#111] border border-[#2a2a2a] rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative my-auto max-h-[94vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <Star size={22} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-serif text-white flex items-center gap-2">
                  Add Special Deliverable
                </h3>
                <p className="text-xs text-[#888]">
                  Log custom websites, extra reels, landing pages, or event campaigns.
                </p>
              </div>
            </div>
            <button
              onClick={() => !submitting && onClose()}
              className="text-[#666] hover:text-white p-2 rounded-full bg-[#181818] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-4 pt-4">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Client / Brand Selection */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
              <label className="text-[11px] text-[#888] font-bold uppercase tracking-wider block mb-1.5">
                Client & Business Brand
              </label>
              {initialOrder ? (
                <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl">
                  <div>
                    <span className="text-white font-bold text-sm block">
                      {initialClient?.name || initialOrder.client?.name || 'Selected Client'}
                    </span>
                    <span className="text-[#3428f8] text-xs font-semibold flex items-center gap-1">
                      <Briefcase size={11} /> {brandName}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#777] bg-[#141414] px-2.5 py-1 rounded-lg border border-[#222]">
                    {initialOrder.order_id}
                  </span>
                </div>
              ) : (
                <select
                  value={selectedOrderKey}
                  onChange={(e) => setSelectedOrderKey(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 rounded-xl outline-none font-bold"
                >
                  {clientsList.map(ord => {
                    const cName = ord.client?.name || 'Client';
                    const bName = ord.business_name || ord.schedule_config?.business_name || ord.client?.business_type || 'Brand';
                    return (
                      <option key={ord.order_id} value={ord.order_id}>
                        {cName} ({bName}) • {ord.order_id}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* 2. Deliverable Type */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
              <label className="text-[11px] text-[#888] font-bold uppercase tracking-wider block mb-2">
                Deliverable Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SPECIAL_TYPES.map(t => {
                  const Icon = t.icon;
                  const isSelected = deliverableType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDeliverableType(t.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected 
                          ? `${t.bg} ${t.border} ${t.color} shadow-[0_0_12px_rgba(52,40,248,0.2)]` 
                          : 'bg-[#0a0a0a] border-[#222] text-[#777] hover:text-white'
                      }`}
                    >
                      <Icon size={18} className="mb-1" />
                      <span className="text-[11px] text-center">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {deliverableType === 'other' && (
                <div className="mt-3">
                  <label className="text-[11px] text-[#aaa] font-medium block mb-1">
                    Enter Custom Deliverable Name <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="e.g. Spin the Wheel Web App, Influencer Campaign, Menu Redesign..."
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-purple-500 text-white text-xs p-3 rounded-xl outline-none"
                  />
                </div>
              )}
            </div>

            {/* 3. Deliverable Details (Title, Link, Date) */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#aaa] block">
                Deliverable Scope & Live Link
              </span>

              <div>
                <label className="text-[11px] text-[#888] font-medium block mb-1">
                  Deliverable Title / Heading <span className="text-[#3428f8]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Spin the Wheel Interactive Website, Festive Reel #1..."
                  className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-sm font-bold p-3 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#888] font-medium block mb-1">
                  Project / Live Website / Asset Link (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]">
                    <LinkIcon size={14} />
                  </span>
                  <input
                    type="url"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    placeholder="https://cravory-spin.web.app or Google Drive asset link"
                    className="w-full bg-[#0a0a0a] border border-[#333] focus:border-[#3428f8] text-white text-xs p-3 pl-9 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">
                    Delivery / Calendar Date
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs font-mono p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#888] font-medium block mb-1">
                    Deliverable Status
                  </label>
                  <select
                    value={deliverableStatus}
                    onChange={(e) => setDeliverableStatus(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs p-2.5 rounded-xl outline-none font-bold"
                  >
                    <option value="delivered">Delivered / Live ✓</option>
                    <option value="in_progress">In Progress / Development ⏳</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#888] font-medium block mb-1">
                  Scope Notes / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional specifications, coupon rules, or deliverable details..."
                  className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs p-2.5 rounded-xl outline-none resize-none"
                />
              </div>
            </div>

            {/* 4. Payment & Billing Management */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#aaa]">
                  Payment & Fee Management
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#888] hover:text-white">
                  <input
                    type="checkbox"
                    checked={isComplimentary}
                    onChange={(e) => setIsComplimentary(e.target.checked)}
                    className="rounded bg-[#0a0a0a] border-[#333] text-[#3428f8] focus:ring-0 cursor-pointer"
                  />
                  <span>Complimentary (₹0 / Included)</span>
                </label>
              </div>

              {!isComplimentary && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#888] font-medium block mb-1">
                        Add-on Fee (₹) <span className="text-[#3428f8]">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#333] focus:border-green-500 text-white font-mono text-base font-bold p-2.5 pl-8 rounded-xl outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#888] font-medium block mb-1">
                        Payment Status
                      </label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#333] text-white text-xs p-3 rounded-xl outline-none font-bold"
                      >
                        <option value="paid">Paid (Payment Received ✓)</option>
                        <option value="pending">Pending / Payment Due ⚠️</option>
                      </select>
                    </div>
                  </div>

                  {paymentStatus === 'paid' && (
                    <div className="space-y-3 pt-2 border-t border-[#1f1f1f]">
                      <div>
                        <label className="text-[11px] text-[#888] font-medium block mb-1">
                          Payment Reference / UTR Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentId}
                          onChange={(e) => setPaymentId(e.target.value)}
                          placeholder="e.g. UPI-92847192841"
                          className="w-full bg-[#0a0a0a] border border-[#333] text-white font-mono text-xs p-2.5 rounded-xl outline-none"
                        />
                      </div>

                      {/* Payment Proof Screenshots */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] text-[#888] font-medium">
                            Payment Proof Screenshots ({receiptFiles.length})
                          </label>
                          <label className="text-[10px] text-[#3428f8] font-bold hover:underline cursor-pointer">
                            + Add Proof Screenshot
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={handleAttachReceipts}
                            />
                          </label>
                        </div>

                        {receiptFiles.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {receiptFiles.map((item, idx) => (
                              <div
                                key={item.id}
                                className="relative group rounded-xl overflow-hidden border border-[#333] bg-[#0a0a0a] w-20 h-16 shrink-0"
                              >
                                <img 
                                  src={item.previewUrl} 
                                  alt={`Proof ${idx + 1}`} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                                  onClick={() => setZoomReceiptUrl(item.previewUrl)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReceipt(item.id)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                                  title="Remove screenshot"
                                >
                                  <Trash2 size={10} />
                                </button>
                                <div 
                                  onClick={() => setZoomReceiptUrl(item.previewUrl)}
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
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-2.5 bg-[#0a0a0a] hover:bg-[#141414] border border-dashed border-[#333] hover:border-[#3428f8] rounded-xl text-xs text-[#888] hover:text-white transition-all cursor-pointer">
                            <Upload size={14} className="text-[#3428f8]" />
                            <span>Attach payment transaction screenshot (Optional)</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={handleAttachReceipts}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions */}
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
                    <Plus size={15} /> Save & Add Deliverable
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Zoom Receipt Modal */}
        {zoomReceiptUrl && (
          <div 
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setZoomReceiptUrl(null)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-[#333] rounded-3xl p-4 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#222]">
                <span className="text-white text-xs font-bold uppercase tracking-wider">Payment Proof Screenshot</span>
                <button
                  onClick={() => setZoomReceiptUrl(null)}
                  className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-auto flex items-center justify-center p-2 mt-2">
                <img 
                  src={zoomReceiptUrl} 
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
