import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, AlertCircle, CheckCircle2, Calendar, IndianRupee, Phone, Link as LinkIcon } from 'lucide-react';
import { WEBSITE_TYPES, OPEN_WEBSITE_STATUSES, createWebsiteRequest } from '../../utils/websiteEngine';

export default function BuildWebsiteModal({
  isOpen,
  onClose,
  user,
  profile,
  existingWebsites = [],
  onSuccess
}) {
  const openRequest = (existingWebsites || []).find((w) =>
    OPEN_WEBSITE_STATUSES.includes(w.status)
  );

  const [businessName, setBusinessName] = useState('');
  const [websiteType, setWebsiteType] = useState('Business site');
  const [description, setDescription] = useState('');
  const [referenceLinks, setReferenceLinks] = useState('');
  const [preferredDeadline, setPreferredDeadline] = useState('');
  const [budget, setBudget] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setBusinessName(profile?.business_type || profile?.name || '');
    setWebsiteType('Business site');
    setDescription('');
    setReferenceLinks('');
    setPreferredDeadline('');
    setBudget('');
    setContactNumber(profile?.phone || user?.user_metadata?.phone || '');
  }, [isOpen, profile, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (openRequest) {
      setErrorMsg(
        `You already have an open request (${openRequest.business_name} — ${openRequest.status}). Wait for delivery before submitting a new request.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createWebsiteRequest({
        user,
        profile,
        formData: {
          business_name: businessName,
          website_type: websiteType,
          description,
          reference_links: referenceLinks,
          preferred_deadline: preferredDeadline,
          budget,
          contact_number: contactNumber
        }
      });

      if (onSuccess) {
        await onSuccess(result);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit website request. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayMinDate = new Date().toISOString().split('T')[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pt-16 pb-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="bg-[#0e0e0e] border border-[#242424] rounded-3xl shadow-2xl relative z-10 w-full max-w-2xl p-6 sm:p-8 my-auto text-left"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-[#888] hover:text-white bg-[#171717] border border-[#262626] rounded-full p-2 transition-colors cursor-pointer"
            aria-label="Close website request modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#3428f8]/15 border border-[#3428f8]/30 text-[#3428f8] flex items-center justify-center shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#3428f8]">
                Custom Web Development
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif text-white">
                Build a Website
              </h2>
            </div>
          </div>

          <p className="text-[#888] text-xs sm:text-sm mb-6 leading-relaxed">
            Share your website goals below. No monthly social media plan is required — our team will review your brief, confirm the one-time project quote, and begin building.
          </p>

          {errorMsg && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {openRequest ? (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 size={32} className="text-[#3428f8] mx-auto" />
              <h3 className="text-lg font-serif text-white">
                Open Request Already Exists ({openRequest.status})
              </h3>
              <p className="text-xs text-[#999] max-w-md mx-auto leading-relaxed">
                Your project <strong className="text-white">{openRequest.business_name}</strong> ({openRequest.website_type}) is currently <strong className="text-blue-400">{openRequest.status}</strong>. Duplicate requests cannot be submitted while one is open.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-[#3428f8] text-white text-xs font-bold uppercase tracking-widest rounded-xl cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Business Name & Contact Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                  />
                  <span className="block text-[10px] text-[#666] mt-1">
                    Brand, cafe, clinic, store, or personal name
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" />
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                    />
                  </div>
                  <span className="block text-[10px] text-[#666] mt-1">
                    WhatsApp or phone number for quick coordination
                  </span>
                </div>
              </div>

              {/* Row 2: Type of Website */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-2">
                  Type of Website <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {WEBSITE_TYPES.map((typeOption) => {
                    const active = websiteType === typeOption;
                    return (
                      <button
                        key={typeOption}
                        type="button"
                        onClick={() => setWebsiteType(typeOption)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#3428f8] text-white border-[#3428f8]'
                            : 'bg-[#151515] text-[#aaa] border-[#262626] hover:border-[#444] hover:text-white'
                        }`}
                      >
                        {typeOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Short Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                  Short Description of What You Need <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors resize-none"
                />
                <span className="block text-[10px] text-[#666] mt-1">
                  Mention pages needed, features (booking form, WhatsApp ordering, gallery), and audience
                </span>
              </div>

              {/* Row 4: Reference Links */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                  Reference Websites or Links (Optional)
                </label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3.5 top-3.5 text-[#666]" />
                  <textarea
                    rows={2}
                    value={referenceLinks}
                    onChange={(e) => setReferenceLinks(e.target.value)}
                    className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white outline-none transition-colors resize-none"
                  />
                </div>
                <span className="block text-[10px] text-[#666] mt-1">
                  Share any design inspiration links or existing website URLs
                </span>
              </div>

              {/* Row 5: Preferred Deadline & Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                    Preferred Deadline (Optional)
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" />
                    <input
                      type="date"
                      min={todayMinDate}
                      value={preferredDeadline}
                      onChange={(e) => setPreferredDeadline(e.target.value)}
                      className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                    Estimated Budget in ₹ (Optional)
                  </label>
                  <div className="relative">
                    <IndianRupee size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" />
                    <input
                      type="number"
                      min="1"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white outline-none transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-[#202020]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#171717] hover:bg-[#222] text-[#ccc] border border-[#2a2a2a] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#3428f8] hover:bg-[#271dd8] text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Submitting Request...' : 'Submit Website Request'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
