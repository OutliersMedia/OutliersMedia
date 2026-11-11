import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Clock, CheckCircle2, XCircle, ExternalLink,
  IndianRupee, Calendar, Phone, Mail, Link as LinkIcon,
  X, Check, AlertCircle, Send, RefreshCw
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import {
  WEBSITE_STATUSES,
  WEBSITE_EVENT_NAME,
  fetchAllWebsites,
  updateWebsiteRequestByAdmin,
  normalizeWebsiteUrl
} from '../../utils/websiteEngine';

const STATUS_BADGES = {
  Requested: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'In Progress': 'bg-[#3428f8]/20 text-blue-300 border-[#3428f8]/40',
  Delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Cancelled: 'bg-red-500/15 text-red-400 border-red-500/30'
};

export default function AdminWebsites() {
  const [websites, setWebsites] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [ordersMap, setOrdersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [toast, setToast] = useState(null);

  // Detail & management modal state
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [formStatus, setFormStatus] = useState('Requested');
  const [formAgreedAmount, setFormAgreedAmount] = useState('');
  const [formLiveUrl, setFormLiveUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const showToastMessage = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [webList, { data: profData }, { data: ordData }] = await Promise.all([
        fetchAllWebsites(),
        supabase.from('profiles').select('auth_id, name, email, phone, business_type, instagram_handle'),
        supabase.from('orders').select('*')
      ]);

      const pMap = {};
      (profData || []).forEach((p) => {
        if (p?.auth_id) pMap[p.auth_id] = p;
      });
      setProfilesMap(pMap);

      const oMap = {};
      (ordData || []).forEach((o) => {
        if (o?.order_id) oMap[o.order_id] = o;
      });
      setOrdersMap(oMap);

      setWebsites(webList || []);
    } catch (err) {
      console.error('Error loading websites:', err);
      showToastMessage('Failed to load website requests.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => fetchData();
    window.addEventListener(WEBSITE_EVENT_NAME, handleSync);
    window.addEventListener('om_business_added', handleSync);

    const ch = supabase
      .channel('admin-websites-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'websites' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      window.removeEventListener(WEBSITE_EVENT_NAME, handleSync);
      window.removeEventListener('om_business_added', handleSync);
      supabase.removeChannel(ch);
    };
  }, []);

  const openManageModal = (item) => {
    setSelectedWebsite(item);
    setFormStatus(item.status || 'Requested');
    setFormAgreedAmount(
      item.agreed_amount !== null && item.agreed_amount !== undefined
        ? String(item.agreed_amount)
        : ''
    );
    setFormLiveUrl(item.live_url || '');
    setModalError('');
  };

  const handleSaveChanges = async (overrideStatus = null) => {
    if (!selectedWebsite) return;
    setModalError('');
    setSaving(true);

    const targetStatus = overrideStatus || formStatus;
    const clientProfile = profilesMap[selectedWebsite.client_id] || null;

    try {
      const result = await updateWebsiteRequestByAdmin({
        website: selectedWebsite,
        updates: {
          status: targetStatus,
          agreed_amount: formAgreedAmount,
          live_url: formLiveUrl
        },
        clientProfile
      });

      await fetchData();
      setSelectedWebsite(null);

      let msg = `Website project "${result.website.business_name}" updated to ${result.website.status}.`;
      if (result.order) {
        msg += ` Finance entry (${result.order.order_id}) synced at ₹${Number(result.order.total_agreed_amount).toLocaleString('en-IN')}.`;
      }
      if (result.emailSent) {
        msg += ` Client notified via email.`;
      }
      showToastMessage(msg, false);
    } catch (err) {
      setModalError(err?.message || 'Unable to save website updates.');
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const res = {
      All: websites.length,
      Requested: 0,
      'In Progress': 0,
      Delivered: 0,
      Cancelled: 0
    };
    websites.forEach((w) => {
      if (res[w.status] !== undefined) res[w.status] += 1;
    });
    return res;
  }, [websites]);

  const filteredWebsites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return websites.filter((w) => {
      if (statusFilter !== 'All' && w.status !== statusFilter) return false;
      if (!q) return true;
      const client = profilesMap[w.client_id] || {};
      return (
        w.business_name?.toLowerCase().includes(q) ||
        w.website_type?.toLowerCase().includes(q) ||
        w.contact_number?.toLowerCase().includes(q) ||
        client.name?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q)
      );
    });
  }, [websites, statusFilter, search, profilesMap]);

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 min-h-[calc(100vh-140px)] shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif text-white mb-1 flex items-center gap-2.5">
            <Globe className="text-[#3428f8]" size={26} />
            Website Requests
          </h2>
          <p className="text-[#888] text-xs sm:text-sm">
            Review website-only client briefs, set agreed project quotes, sync one-time Finance entries, and publish live URLs.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              aria-label="Search website requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="p-3 rounded-xl bg-[#0a0a0a] border border-[#222] hover:border-[#3428f8] text-[#888] hover:text-white transition-colors cursor-pointer"
            title="Refresh website requests"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mb-5 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
              toast.isError
                ? 'bg-red-500/15 border-red-500/40 text-red-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {toast.isError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
              {toast.msg}
            </span>
            <button type="button" onClick={() => setToast(null)} className="text-current hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-6 border-b border-[#222]">
        {['All', ...WEBSITE_STATUSES].map((tab) => {
          const active = statusFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                active ? 'bg-[#3428f8] text-white' : 'bg-[#0a0a0a] text-[#777] hover:text-white border border-[#222]'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-[#181818] text-[#888]'}`}>
                {counts[tab] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : filteredWebsites.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-10 text-center text-[#777] text-sm">
          No website requests found matching the current filter.
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredWebsites.map((item) => {
              const client = profilesMap[item.client_id] || {};
              const linkedOrd = item.order_id ? ordersMap[item.order_id] : null;
              const isPaid = linkedOrd?.payment_status === 'paid';
              return (
                <div key={item.id} className="bg-[#0b0b0b] border border-[#222] rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{item.business_name}</p>
                      <p className="text-xs text-[#888] truncate">
                        {client.name || 'Client'} • {item.website_type}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${STATUS_BADGES[item.status] || STATUS_BADGES.Requested}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#121212] border border-[#1f1f1f] rounded-xl p-3">
                    <div>
                      <span className="text-[10px] text-[#666] uppercase block">Budget</span>
                      <span className="text-white font-mono font-bold">
                        {item.budget ? `₹${Number(item.budget).toLocaleString('en-IN')}` : 'Flexible'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#666] uppercase block">Agreed Amount</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {item.agreed_amount ? `₹${Number(item.agreed_amount).toLocaleString('en-IN')}` : 'Not set'}
                      </span>
                      {linkedOrd && (
                        <span className={`block text-[10px] font-bold ${isPaid ? 'text-emerald-400' : 'text-amber-300'}`}>
                          {isPaid ? 'Paid' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-[#777]">
                    <span>
                      Deadline: {item.preferred_deadline ? new Date(item.preferred_deadline).toLocaleDateString('en-IN') : 'Flexible'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openManageModal(item)}
                      className="px-3.5 py-2 rounded-xl bg-[#3428f8] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#222]">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-[#0a0a0a] border-b border-[#222] text-[11px] font-bold uppercase tracking-widest text-[#666]">
                  <th className="p-4">Client & Business</th>
                  <th className="p-4">Website Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Client Budget</th>
                  <th className="p-4">Agreed Quote</th>
                  <th className="p-4">Deadline & Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWebsites.map((item) => {
                  const client = profilesMap[item.client_id] || {};
                  const linkedOrd = item.order_id ? ordersMap[item.order_id] : null;
                  const isPaid = linkedOrd?.payment_status === 'paid';

                  return (
                    <tr key={item.id} className="border-b border-[#1d1d1d] bg-[#111] hover:bg-[#151515] transition-colors">
                      <td className="p-4">
                        <p className="text-white font-bold text-sm">{item.business_name}</p>
                        <p className="text-xs text-[#888]">
                          {client.name || 'Client'} • {client.email || '—'}
                        </p>
                        {item.contact_number && (
                          <p className="text-[11px] text-[#666] font-mono mt-0.5">{item.contact_number}</p>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="text-xs font-medium text-[#ddd] bg-[#181818] border border-[#2a2a2a] px-2.5 py-1 rounded-lg">
                          {item.website_type}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase border inline-block ${STATUS_BADGES[item.status] || STATUS_BADGES.Requested}`}>
                          {item.status}
                        </span>
                        {item.live_url && (
                          <a
                            href={normalizeWebsiteUrl(item.live_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11px] text-blue-400 hover:underline mt-1"
                          >
                            Live URL ↗
                          </a>
                        )}
                      </td>

                      <td className="p-4 text-xs font-mono text-[#ccc]">
                        {item.budget ? `₹${Number(item.budget).toLocaleString('en-IN')}` : 'Flexible'}
                      </td>

                      <td className="p-4">
                        {item.agreed_amount ? (
                          <div>
                            <p className="text-sm font-mono font-bold text-emerald-400">
                              ₹{Number(item.agreed_amount).toLocaleString('en-IN')}
                            </p>
                            {linkedOrd && (
                              <span className={`text-[10px] font-bold uppercase ${isPaid ? 'text-emerald-400' : 'text-amber-300'}`}>
                                Finance: {isPaid ? 'Paid' : 'Pending'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#666]">Not finalized</span>
                        )}
                      </td>

                      <td className="p-4 text-xs">
                        <p className="text-white font-mono">
                          Due: {item.preferred_deadline ? new Date(item.preferred_deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Flexible'}
                        </p>
                        <p className="text-[#666] mt-0.5">
                          Req: {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => openManageModal(item)}
                          className="px-4 py-2 rounded-xl bg-[#181818] hover:bg-[#3428f8] text-white border border-[#2c2c2c] hover:border-[#3428f8] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Open & Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Website Detail & Admin Management Modal */}
      <AnimatePresence>
        {selectedWebsite && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedWebsite(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-[#0e0e0e] border border-[#242424] rounded-3xl shadow-2xl relative z-10 w-full max-w-2xl p-6 sm:p-8 my-auto"
            >
              <button
                type="button"
                onClick={() => setSelectedWebsite(null)}
                className="absolute top-5 right-5 text-[#888] hover:text-white bg-[#181818] border border-[#262626] rounded-full p-2 cursor-pointer"
              >
                <X size={18} />
              </button>

              <p className="text-[10px] font-bold uppercase tracking-widest text-[#3428f8] mb-1">
                Website Project Management
              </p>
              <h3 className="text-2xl font-serif text-white mb-1">
                {selectedWebsite.business_name}
              </h3>
              <p className="text-xs text-[#888] mb-5">
                {profilesMap[selectedWebsite.client_id]?.name || 'Client'} •{' '}
                {profilesMap[selectedWebsite.client_id]?.email || 'No email'} •{' '}
                {selectedWebsite.website_type}
              </p>

              {modalError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Client Brief Details Box */}
              <div className="bg-[#141414] border border-[#222] rounded-2xl p-4 space-y-3 mb-5 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] block mb-1">
                    Project Description
                  </span>
                  <p className="text-[#ddd] leading-relaxed whitespace-pre-wrap">
                    {selectedWebsite.description}
                  </p>
                </div>

                {selectedWebsite.reference_links && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] block mb-1">
                      Reference Links
                    </span>
                    <p className="text-blue-400 break-all">{selectedWebsite.reference_links}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[#222]">
                  <div>
                    <span className="text-[10px] text-[#666] uppercase block">Client Budget</span>
                    <span className="text-white font-mono font-bold">
                      {selectedWebsite.budget ? `₹${Number(selectedWebsite.budget).toLocaleString('en-IN')}` : 'Flexible'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#666] uppercase block">Preferred Deadline</span>
                    <span className="text-white font-mono">
                      {selectedWebsite.preferred_deadline || 'Flexible'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#666] uppercase block">Contact Number</span>
                    <span className="text-white font-mono">
                      {selectedWebsite.contact_number || profilesMap[selectedWebsite.client_id]?.phone || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Action Controls */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                      Project Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                    >
                      {WEBSITE_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <span className="block text-[10px] text-[#666] mt-1">
                      Changing to In Progress or Delivered emails the client
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                      Agreed Amount (₹)
                    </label>
                    <div className="relative">
                      <IndianRupee size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" />
                      <input
                        type="number"
                        min="0"
                        value={formAgreedAmount}
                        onChange={(e) => setFormAgreedAmount(e.target.value)}
                        className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono outline-none"
                      />
                    </div>
                    <span className="block text-[10px] text-[#666] mt-1">
                      Setting an amount creates a Pending Finance entry labeled Website
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#ccc] mb-1.5">
                    Live Website URL
                  </label>
                  <div className="relative">
                    <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" />
                    <input
                      type="text"
                      value={formLiveUrl}
                      onChange={(e) => setFormLiveUrl(e.target.value)}
                      className="w-full bg-[#151515] border border-[#282828] focus:border-[#3428f8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono outline-none"
                    />
                  </div>
                  <span className="block text-[10px] text-[#666] mt-1">
                    Visible on Client Dashboard and included in Delivered email
                  </span>
                </div>

                <div className="pt-4 border-t border-[#202020] flex flex-wrap justify-between items-center gap-3">
                  {selectedWebsite.status !== 'Delivered' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveChanges('Delivered')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Check size={14} /> Mark Delivered
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Delivered on{' '}
                      {selectedWebsite.delivered_at
                        ? new Date(selectedWebsite.delivered_at).toLocaleDateString('en-IN')
                        : 'record'}
                    </span>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedWebsite(null)}
                      className="px-4 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222] text-[#ccc] border border-[#2c2c2c] text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveChanges(null)}
                      className="px-5 py-2.5 rounded-xl bg-[#3428f8] hover:bg-[#271dd8] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Send size={13} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
