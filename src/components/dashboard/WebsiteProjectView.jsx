import { motion } from 'framer-motion';
import {
  Globe, Clock, CheckCircle2, ExternalLink, Calendar,
  IndianRupee, Phone, FileText, Link as LinkIcon, XCircle,
  Download, Plus
} from 'lucide-react';
import { normalizeWebsiteUrl, OPEN_WEBSITE_STATUSES } from '../../utils/websiteEngine';
import { generateSingleInvoicePDF } from '../../utils/invoiceGenerator';

const STATUS_STYLE = {
  Requested: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    stepIndex: 0
  },
  'In Progress': {
    badge: 'bg-[#3428f8]/20 text-blue-300 border-[#3428f8]/40',
    stepIndex: 1
  },
  Delivered: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    stepIndex: 2
  },
  Cancelled: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    stepIndex: -1
  }
};

export default function WebsiteProjectView({
  websites = [],
  websiteOrders = [],
  profile,
  hasSocialPlan = false,
  onOpenActivatePlan,
  onOpenBuildWebsite
}) {
  if (!Array.isArray(websites) || websites.length === 0) return null;

  const latestWebsite = websites[0];
  const pastWebsites = websites.slice(1);
  const hasOpenRequest = websites.some((w) => OPEN_WEBSITE_STATUSES.includes(w.status));

  const findLinkedOrder = (website) => {
    if (!website) return null;
    return (
      websiteOrders.find((o) => website.order_id && o.order_id === website.order_id) ||
      websiteOrders.find((o) => o?.schedule_config?.website_id === website.id) ||
      null
    );
  };

  const linkedOrder = findLinkedOrder(latestWebsite);
  const statusMeta = STATUS_STYLE[latestWebsite.status] || STATUS_STYLE.Requested;
  const agreedAmount = Number(
    latestWebsite.agreed_amount || linkedOrder?.total_agreed_amount || 0
  );
  const isOrderPaid =
    linkedOrder &&
    (linkedOrder.payment_status === 'paid' ||
      (Number(linkedOrder.amount_paid || 0) >= agreedAmount && agreedAmount > 0));

  const liveHref = normalizeWebsiteUrl(latestWebsite.live_url);

  const steps = [
    { label: 'Requested', desc: 'Brief received' },
    { label: 'In Progress', desc: 'Design & development active' },
    { label: 'Delivered', desc: 'Live website ready' }
  ];

  const extractLinks = (raw) => {
    if (!raw) return [];
    return String(raw)
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('.'));
  };

  const refLinkList = extractLinks(latestWebsite.reference_links);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Top Website Project Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-themeborder rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#3428f8] flex items-center gap-1.5">
              <Globe size={14} />
              Website Project
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${statusMeta.badge}`}>
              {latestWebsite.status}
            </span>
            <span className="text-xs text-muted font-mono">
              {latestWebsite.website_type}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif text-primary capitalize">
            {latestWebsite.business_name}
          </h2>
          <p className="text-xs text-muted">
            Submitted on{' '}
            {new Date(latestWebsite.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
            {latestWebsite.order_id && (
              <span className="ml-2 font-mono text-[#888]">• Ref: {latestWebsite.order_id}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {liveHref && latestWebsite.status === 'Delivered' && (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#3428f8] hover:bg-[#271dd8] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            >
              <ExternalLink size={14} /> Visit Live Website
            </a>
          )}

          {linkedOrder && (
            <button
              type="button"
              onClick={() => generateSingleInvoicePDF(linkedOrder, profile)}
              className="flex items-center gap-2 bg-raised border border-themeborder hover:border-accent text-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
            >
              <Download size={14} /> Project Invoice PDF
            </button>
          )}

          {!hasOpenRequest && onOpenBuildWebsite && (
            <button
              type="button"
              onClick={onOpenBuildWebsite}
              className="flex items-center gap-2 bg-[#161616] hover:bg-[#222] border border-[#2c2c2c] text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
            >
              <Plus size={14} /> New Website Request
            </button>
          )}
        </div>
      </motion.div>

      {/* Progress Tracker (Shown for Requested / In Progress / Delivered) */}
      {latestWebsite.status !== 'Cancelled' ? (
        <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-5">
            Project Delivery Progress
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step, idx) => {
              const isCompletedOrCurrent = idx <= statusMeta.stepIndex;
              const isCurrent = idx === statusMeta.stepIndex;
              return (
                <div
                  key={step.label}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-[#3428f8]/15 border-[#3428f8]/40'
                      : isCompletedOrCurrent
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-[#141414] border-[#222]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-[#888]">STEP 0{idx + 1}</span>
                    {idx < statusMeta.stepIndex ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Clock size={16} className="text-[#3428f8]" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">{step.label}</p>
                  <p className="text-xs text-[#888] mt-0.5">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-red-300">
          <XCircle size={18} className="text-red-400 shrink-0" />
          <span>This website project request was cancelled. You can submit a new request anytime.</span>
        </div>
      )}

      {/* Delivered Live URL Showcase */}
      {latestWebsite.status === 'Delivered' && (
        <div className="bg-[#3428f8]/10 border border-[#3428f8]/30 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-1">
              Website Delivered
            </p>
            <h3 className="text-xl font-serif text-white mb-1">
              {liveHref || 'Deployment Complete'}
            </h3>
            <p className="text-xs text-[#bbb]">
              Delivered on{' '}
              {latestWebsite.delivered_at
                ? new Date(latestWebsite.delivered_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : 'Completed'}
            </p>
          </div>
          {liveHref && (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#3428f8] hover:bg-[#271dd8] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shrink-0"
            >
              <ExternalLink size={14} /> Open Live Website
            </a>
          )}
        </div>
      )}

      {/* Details & Pricing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Brief Details */}
        <div className="lg:col-span-2 bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[#1f1f1f] pb-3">
            <FileText size={16} className="text-[#3428f8]" />
            <h3 className="text-lg font-serif text-white">Submitted Website Brief</h3>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#777] mb-1.5">
              Project Requirements
            </p>
            <p className="text-sm text-[#ddd] leading-relaxed whitespace-pre-wrap bg-[#141414] border border-[#222] rounded-2xl p-4">
              {latestWebsite.description}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#777] mb-1 flex items-center gap-1.5">
                <Calendar size={12} className="text-[#3428f8]" /> Preferred Deadline
              </p>
              <p className="text-sm font-bold text-white font-mono">
                {latestWebsite.preferred_deadline
                  ? new Date(latestWebsite.preferred_deadline).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Flexible'}
              </p>
            </div>

            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#777] mb-1 flex items-center gap-1.5">
                <Phone size={12} className="text-[#3428f8]" /> Contact Number
              </p>
              <p className="text-sm font-bold text-white font-mono">
                {latestWebsite.contact_number || profile?.phone || 'Not provided'}
              </p>
            </div>
          </div>

          {latestWebsite.reference_links && (
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#777] mb-2 flex items-center gap-1.5">
                <LinkIcon size={12} className="text-[#3428f8]" /> Reference Websites / Links
              </p>
              {refLinkList.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {refLinkList.map((lnk, idx) => (
                    <a
                      key={idx}
                      href={normalizeWebsiteUrl(lnk)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-[#1c1c1c] border border-[#2c2c2c] px-3 py-1.5 rounded-lg"
                    >
                      <ExternalLink size={12} /> {lnk}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#ccc]">{latestWebsite.reference_links}</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: One-Time Project Commercials & Optional Plan Upgrade */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-serif text-white border-b border-[#1f1f1f] pb-3">
              One-Time Project Fee
            </h3>

            <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#888]">Estimated Budget</span>
                <span className="text-white font-mono font-bold">
                  {latestWebsite.budget
                    ? `₹${Number(latestWebsite.budget).toLocaleString('en-IN')}`
                    : 'Not specified'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#888]">Agreed Amount</span>
                <span className="text-emerald-400 font-mono font-bold text-base flex items-center">
                  {agreedAmount > 0 ? (
                    <>
                      <IndianRupee size={14} />
                      {agreedAmount.toLocaleString('en-IN')}
                    </>
                  ) : (
                    <span className="text-xs text-[#888] font-normal">Pending confirmation</span>
                  )}
                </span>
              </div>

              {agreedAmount > 0 && (
                <div className="pt-2 border-t border-[#222] flex justify-between items-center text-xs">
                  <span className="text-[#888]">Payment Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] border ${
                      isOrderPaid
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isOrderPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#777] leading-relaxed">
              Website builds are one-time projects with no recurring monthly renewal charges.
            </p>
          </div>

          {!hasSocialPlan && onOpenActivatePlan && (
            <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#3428f8]">
                Optional Add-On
              </p>
              <h4 className="text-base font-serif text-white">
                Need Social Media Growth Too?
              </h4>
              <p className="text-xs text-[#888] leading-relaxed">
                Whenever you are ready for Reels, static posts, and a content calendar, you can activate a monthly retainer plan independently.
              </p>
              <button
                type="button"
                onClick={onOpenActivatePlan}
                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#171717] hover:bg-[#3428f8] text-white border border-[#2a2a2a] hover:border-[#3428f8] transition-all cursor-pointer"
              >
                Activate Plan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Previous Website Requests (if client has more than 1 historical website project) */}
      {pastWebsites.length > 0 && (
        <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-[#888] mb-4">
            Past Website Requests ({pastWebsites.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastWebsites.map((item) => (
              <div
                key={item.id}
                className="bg-[#141414] border border-[#222] rounded-2xl p-4 flex justify-between items-center gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">{item.business_name}</p>
                  <p className="text-xs text-[#888]">
                    {item.website_type} •{' '}
                    {new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-[#2c2c2c] text-[#ccc]">
                    {item.status}
                  </span>
                  {item.live_url && (
                    <a
                      href={normalizeWebsiteUrl(item.live_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-blue-400 hover:underline mt-1"
                    >
                      Live Site ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
