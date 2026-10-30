import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, Users, Video, Search, Plus, Filter, 
  CheckCircle2, XCircle, Clock, MessageSquare, ExternalLink, 
  Trash2, Edit3, Eye, ArrowRight, Phone, 
  IndianRupee, Gift, Scissors, Link as LinkIcon, Check, 
  AlertCircle, ChevronDown, CheckCheck 
} from 'lucide-react';
import { 
  fetchInfluencers, saveInfluencer, deleteInfluencer, 
  generateDefaultReels, computeCreatorFinances, recordCreatorPayout 
} from '../../utils/influencerEngine';

const InstagramIcon = ({ size = 14, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export default function AdminInfluencers() {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'negotiating' | 'approved' | 'active' | 'completed' | 'rejected'
  
  // Selected Influencer for detailed editing
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Screenshot Zoom Modal
  const [zoomScreenshotUrl, setZoomScreenshotUrl] = useState(null);

  // Form State for Active Edit
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Rate Approval Modal State
  const [rateApprovalCreator, setRateApprovalCreator] = useState(null);
  const [rateApprovalInput, setRateApprovalInput] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Payout Settlement Modal State
  const [payoutModalCreator, setPayoutModalCreator] = useState(null);
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [payoutMethodInput, setPayoutMethodInput] = useState('UPI');
  const [payoutRefInput, setPayoutRefInput] = useState('');
  const [payoutNotesInput, setPayoutNotesInput] = useState('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  useEffect(() => {
    loadData();

    const handleCustomChange = () => {
      loadData();
    };
    window.addEventListener('om_influencer_changed', handleCustomChange);
    return () => window.removeEventListener('om_influencer_changed', handleCustomChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const list = await fetchInfluencers();
    setInfluencers(list);
    setLoading(false);
  };

  const handleOpenRateApproval = (inf) => {
    setRateApprovalCreator(inf);
    const suggestedRate = Number(inf.final_rate_per_reel || inf.rate_per_reel || 0);
    setRateApprovalInput(String(suggestedRate));
  };

  const handleConfirmRateApproval = async (e) => {
    if (e) e.preventDefault();
    if (!rateApprovalCreator) return;
    const finalRate = Number(rateApprovalInput || 0);

    setIsSubmittingApproval(true);
    try {
      const reelsCount = parseInt(rateApprovalCreator.reels_count) || 3;
      const updatedReels = (rateApprovalCreator.reels || generateDefaultReels(reelsCount, finalRate)).map(r => ({
        ...r,
        is_paid: finalRate > 0,
        paid_amount: finalRate > 0 ? finalRate : 0,
        final_rate_per_reel: finalRate
      }));

      await saveInfluencer({
        ...rateApprovalCreator,
        status: 'approved',
        contract_type: finalRate > 0 ? (rateApprovalCreator.contract_type === 'barter' ? 'paid' : rateApprovalCreator.contract_type) : rateApprovalCreator.contract_type,
        final_rate_per_reel: finalRate,
        total_price: finalRate * reelsCount,
        apply_to_all_reels: true,
        reels: updatedReels
      });
      setRateApprovalCreator(null);
      await loadData();
    } catch (err) {
      alert("Error approving rate: " + err.message);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleOpenEdit = (inf) => {
    setSelectedInfluencer(inf);
    const parsed = JSON.parse(JSON.stringify(inf));
    parsed.rate_per_reel = Number(parsed.rate_per_reel !== undefined ? parsed.rate_per_reel : (parsed.reels?.[0]?.rate_per_reel || 0));
    parsed.final_rate_per_reel = Number(parsed.final_rate_per_reel !== undefined ? parsed.final_rate_per_reel : (parsed.reels?.[0]?.final_rate_per_reel || 0));
    setEditForm(parsed);
    setIsEditingModalOpen(true);
  };

  const handleOpenNew = () => {
    const blank = {
      name: '',
      instagram_id: '',
      phone: '',
      email: '',
      city: '',
      niche: 'Food & Cafes',
      follower_count: '',
      reels_count: 3,
      contract_type: 'paid',
      rate_per_reel: 0,
      final_rate_per_reel: 0,
      total_price: 0,
      status: 'pending',
      notes: '',
      reels: generateDefaultReels(3)
    };
    setEditForm(blank);
    setIsNewModalOpen(true);
  };

  const handleApplyFinalRateToAllReels = () => {
    if (!editForm) return;
    const finalRate = Number(editForm.final_rate_per_reel || 0);
    const updatedReels = (editForm.reels || []).map(r => ({
      ...r,
      paid_amount: finalRate,
      final_rate_per_reel: finalRate,
      is_paid: finalRate > 0
    }));
    setEditForm(prev => ({
      ...prev,
      reels: updatedReels,
      total_price: finalRate * (parseInt(prev.reels_count) || 3)
    }));
  };

  const handleApproveContractInModal = () => {
    if (!editForm) return;
    const finalRate = Number(editForm.final_rate_per_reel !== undefined && editForm.final_rate_per_reel > 0 
      ? editForm.final_rate_per_reel 
      : (editForm.rate_per_reel || 0)
    );
    const updatedReels = (editForm.reels || []).map(r => ({
      ...r,
      paid_amount: finalRate > 0 ? finalRate : r.paid_amount,
      final_rate_per_reel: finalRate,
      is_paid: finalRate > 0 ? true : r.is_paid
    }));
    setEditForm(prev => ({
      ...prev,
      status: 'approved',
      final_rate_per_reel: finalRate,
      reels: updatedReels,
      total_price: finalRate * (parseInt(prev.reels_count) || 3)
    }));
  };

  const handleSaveForm = async (e) => {
    if (e) e.preventDefault();
    if (!editForm.name.trim() || !editForm.instagram_id.trim()) {
      alert("Please provide at least Creator Name and Instagram Handle.");
      return;
    }

    setIsSaving(true);
    try {
      await saveInfluencer(editForm);
      setIsEditingModalOpen(false);
      setIsNewModalOpen(false);
      setSelectedInfluencer(null);
      await loadData();
    } catch (err) {
      alert("Error saving influencer: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove creator "${name}"?`)) return;
    await deleteInfluencer(id);
    await loadData();
  };

  const handleOpenPayout = (inf) => {
    const fin = computeCreatorFinances(inf);
    setPayoutModalCreator(inf);
    setPayoutAmountInput(String(fin.pending || 0));
    setPayoutMethodInput('UPI');
    setPayoutRefInput('');
    setPayoutNotesInput('');
  };

  const handleConfirmPayout = async (e) => {
    if (e) e.preventDefault();
    if (!payoutModalCreator) return;
    setIsSubmittingPayout(true);
    try {
      await recordCreatorPayout(payoutModalCreator.id, {
        amount: Number(payoutAmountInput || 0),
        payout_method: payoutMethodInput,
        payout_reference: payoutRefInput.trim(),
        notes: payoutNotesInput.trim()
      });
      setPayoutModalCreator(null);
      await loadData();
    } catch (err) {
      alert("Error recording payout: " + err.message);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleReelsCountChange = (newCount) => {
    const count = Math.max(3, Math.min(10, parseInt(newCount) || 3));
    const currentReels = editForm.reels || [];
    let updatedReels = [...currentReels];

    if (currentReels.length < count) {
      for (let i = currentReels.length + 1; i <= count; i++) {
        updatedReels.push({
          reel_number: i,
          title: `Reel #${i}`,
          is_barter: editForm.contract_type === 'barter' || editForm.contract_type === 'hybrid',
          barter_item: '',
          barter_price: 0,
          is_paid: editForm.contract_type === 'paid' || editForm.contract_type === 'hybrid',
          paid_amount: 0,
          editor: 'me',
          final_reel_url: '',
          status: 'pending',
          notes: ''
        });
      }
    } else if (currentReels.length > count) {
      updatedReels = updatedReels.slice(0, count);
    }

    setEditForm(prev => ({
      ...prev,
      reels_count: count,
      reels: updatedReels
    }));
  };

  const handleUpdateReelItem = (index, field, value) => {
    const updatedReels = [...(editForm.reels || [])];
    if (updatedReels[index]) {
      updatedReels[index] = {
        ...updatedReels[index],
        [field]: value
      };
      setEditForm(prev => ({
        ...prev,
        reels: updatedReels
      }));
    }
  };

  // Metrics Calculation
  const totalCount = influencers.length;
  const pendingCount = influencers.filter(i => i.status === 'pending').length;
  const negotiatingCount = influencers.filter(i => i.status === 'negotiating').length;
  const activeCount = influencers.filter(i => i.status === 'approved' || i.status === 'active').length;
  const creatorFinances = computeCreatorFinances(influencers);

  let totalContractedReels = 0;
  let totalUploadedReels = 0;
  let totalBarterValue = 0;
  let totalPaidSpend = 0;

  influencers.forEach(inf => {
    totalContractedReels += parseInt(inf.reels_count) || 0;
    if (Array.isArray(inf.reels)) {
      inf.reels.forEach(r => {
        if (r.final_reel_url || r.status === 'uploaded' || r.status === 'completed') {
          totalUploadedReels++;
        }
        if (r.is_barter) {
          totalBarterValue += Number(r.barter_price || 0);
        }
        if (r.is_paid) {
          totalPaidSpend += Number(r.paid_amount || 0);
        }
      });
    }
  });

  // Filtered List
  const filteredInfluencers = influencers.filter(inf => {
    const matchesSearch = 
      (inf.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inf.instagram_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inf.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inf.niche || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return inf.status === 'approved' || inf.status === 'active';
    if (statusFilter === 'pending_payout') {
      const fin = computeCreatorFinances(inf);
      return fin.pending > 0;
    }
    if (statusFilter === 'paid_full') {
      const fin = computeCreatorFinances(inf);
      return fin.committed > 0 && fin.pending === 0;
    }
    return inf.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header Banner & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111] border border-[#222] p-5 sm:p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#3428f8]/15 text-blue-400 border border-[#3428f8]/30 rounded-2xl">
            <Flame size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-2">
              Influencer Network & Contracts
            </h1>
            <p className="text-xs text-[#888]">
              Manage creator onboarding, contracts (3-10 reels), barter items, editing rights & live reel links.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="bg-[#3428f8] hover:bg-[#2d23c9] text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus size={15} /> Add Creator Manually
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
            Total Creators
          </span>
          <span className="text-2xl font-bold font-mono text-white">{totalCount}</span>
          <span className="text-[10px] text-blue-400 block mt-0.5">{activeCount} Active Contracts</span>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
            Pending Review
          </span>
          <span className="text-2xl font-bold font-mono text-amber-400">{pendingCount}</span>
          <span className="text-[10px] text-[#777] block mt-0.5">{negotiatingCount} In Negotiation</span>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
            Contracted Reels
          </span>
          <span className="text-2xl font-bold font-mono text-cyan-400">
            {totalUploadedReels} / {totalContractedReels}
          </span>
          <span className="text-[10px] text-[#777] block mt-0.5">Live Uploaded / Total Signed</span>
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block mb-1">
            Creator Payout Status
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            ₹{creatorFinances.totalPaid.toLocaleString()}
          </span>
          <span className="text-[10px] text-amber-400 block mt-0.5">
            ₹{creatorFinances.totalPending.toLocaleString()} Pending ({creatorFinances.pendingCreatorsCount} creators)
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'pending_payout', label: `Pending Payout (${creatorFinances.pendingCreatorsCount})` },
            { id: 'paid_full', label: 'Paid in Full' },
            { id: 'pending', label: `Pending Review (${pendingCount})` },
            { id: 'negotiating', label: `Negotiating (${negotiatingCount})` },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'completed', label: 'Completed' },
            { id: 'rejected', label: 'Rejected' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#3428f8] text-white'
                  : 'bg-[#141414] text-[#888] hover:text-white hover:bg-[#1a1a1a] border border-[#222]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:border-[#3428f8] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Creator Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : filteredInfluencers.length === 0 ? (
        <div className="bg-[#111] border border-[#222] border-dashed rounded-3xl p-12 text-center">
          <Flame size={36} className="text-blue-400 mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-serif text-white mb-1">No Creators Found</h3>
          <p className="text-xs text-[#777] max-w-md mx-auto mb-5">
            No influencers match your current filter. You can add one manually or share the public connection link with creators.
          </p>
          <button
            type="button"
            onClick={handleOpenNew}
            className="bg-[#3428f8] hover:bg-[#2d23c9] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            + Add First Influencer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInfluencers.map((inf) => {
            const reels = inf.reels || [];
            const uploadedCount = reels.filter(r => r.final_reel_url || r.status === 'uploaded' || r.status === 'completed').length;
            const reelsCount = parseInt(inf.reels_count) || reels.length || 3;
            const fin = computeCreatorFinances(inf);

            return (
              <div
                key={inf.id}
                className="bg-[#111] border border-[#222] hover:border-[#333] p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all"
              >
                <div>
                  {/* Top Header: Status & Screenshot icon */}
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                      inf.status === 'approved' || inf.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : inf.status === 'negotiating'
                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        : inf.status === 'rejected'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : inf.status === 'completed'
                        ? 'bg-[#3428f8]/15 text-blue-300 border-[#3428f8]/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                      {inf.status}
                    </span>

                    {inf.dashboard_screenshot_url && (
                      <button
                        type="button"
                        onClick={() => setZoomScreenshotUrl(inf.dashboard_screenshot_url)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase flex items-center gap-1 bg-[#3428f8]/10 border border-[#3428f8]/20 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <Eye size={11} /> Screenshot
                      </button>
                    )}
                  </div>

                  {/* Creator Info */}
                  <h3 className="text-white text-base font-bold truncate mb-0.5">{inf.name}</h3>
                  <a
                    href={`https://instagram.com/${inf.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline mb-3"
                  >
                    <InstagramIcon size={12} /> @{inf.instagram_id}
                    <ExternalLink size={10} />
                  </a>

                  {/* Badges / Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#161616] p-3 rounded-xl border border-[#222] mb-3">
                    <div>
                      <span className="text-[#666] block text-[9px] uppercase font-bold">Niche</span>
                      <span className="text-[#ddd] truncate block">{inf.niche || 'Lifestyle'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block text-[9px] uppercase font-bold">Followers</span>
                      <span className="text-white font-mono font-bold">{inf.follower_count || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block text-[9px] uppercase font-bold">Location</span>
                      <span className="text-[#ddd] truncate block">{inf.city || 'Tricity'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block text-[9px] uppercase font-bold">Model</span>
                      <span className="text-blue-400 font-bold capitalize">{inf.contract_type || 'Barter'}</span>
                    </div>
                  </div>

                  {/* Per-Reel Pricing & Final Rate Approval Box */}
                  <div className="bg-[#121212] border border-[#242424] p-3 rounded-xl mb-3 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#777] font-medium">Influencer Quoted:</span>
                      <span className="font-mono font-bold text-white">
                        {inf.rate_per_reel > 0 ? `₹${Number(inf.rate_per_reel).toLocaleString()} / reel` : 'Barter / Free'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
                      <div>
                        <span className="text-[9px] text-[#777] uppercase font-bold block">Final Per-Reel Rate:</span>
                        {inf.final_rate_per_reel > 0 ? (
                          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                            ₹{Number(inf.final_rate_per_reel).toLocaleString()} / reel ✓
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            Pending Approval
                          </span>
                        )}
                      </div>

                      {inf.final_rate_per_reel > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRateApproval(inf)}
                          className="text-[10px] text-blue-400 hover:text-white font-bold uppercase px-2.5 py-1 rounded bg-[#181818] hover:bg-[#252525] border border-[#2c2c2c] transition-all cursor-pointer"
                        >
                          Edit Rate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenRateApproval(inf)}
                          className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <CheckCircle2 size={11} /> Approve Rate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reels Progress Tracker */}
                  <div className="bg-[#0a0a0a] p-2.5 rounded-xl border border-[#1f1f1f]">
                    <div className="flex justify-between items-center text-[10px] mb-1.5 font-bold uppercase">
                      <span className="text-[#888]">Reels Contract</span>
                      <span className="text-cyan-400 font-mono">{uploadedCount} / {reelsCount} Uploaded</span>
                    </div>
                    <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((uploadedCount / reelsCount) * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Creator Payout Status */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-[#0c0c0c] border border-[#1e1e1e] flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-[#666] block text-[9px] uppercase font-bold">Creator Payout</span>
                      {fin.committed === 0 ? (
                        <span className="text-[#888] font-medium">Barter Model Only</span>
                      ) : fin.payoutStatus === 'paid' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                          <Check size={11} /> ₹{fin.paid.toLocaleString()} Paid in Full
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold font-mono">
                          ₹{fin.pending.toLocaleString()} Pending (₹{fin.paid.toLocaleString()} Paid)
                        </span>
                      )}
                    </div>

                    {fin.committed > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPayout(inf)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30"
                      >
                        <IndianRupee size={10} /> Settle
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#1f1f1f]">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(inf)}
                    className="flex-1 bg-[#3428f8]/15 hover:bg-[#3428f8] text-blue-300 hover:text-white border border-[#3428f8]/30 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={13} /> Manage Reels
                  </button>

                  {inf.phone && (
                    <a
                      href={`https://wa.me/${inf.phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(inf.name)},%20reaching%20out%20from%20Outliers%20Media%20regarding%20your%20influencer%20contract.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/30 transition-all cursor-pointer"
                      title="Chat on WhatsApp"
                    >
                      <MessageSquare size={15} />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(inf.id, inf.name)}
                    className="p-2 rounded-xl text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Delete Creator"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Full Contract & Reel Manager (Edit & New) */}
      {(isEditingModalOpen || isNewModalOpen) && editForm && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={() => {
            setIsEditingModalOpen(false);
            setIsNewModalOpen(false);
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#111] border border-[#2c2c2c] rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[#222]">
              <div>
                <h3 className="text-lg sm:text-xl font-serif text-white flex items-center gap-2">
                  <Flame size={20} className="text-blue-400" />
                  {isNewModalOpen ? 'Add New Influencer Contract' : `Manage Creator: ${editForm.name}`}
                </h3>
                <p className="text-xs text-[#888]">
                  Set contract terms (3-10 reels), barter item details, editor assignment & live reel links.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEditingModalOpen(false);
                  setIsNewModalOpen(false);
                }}
                className="text-[#666] hover:text-white p-2 rounded-full bg-[#181818] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-6 custom-scrollbar">
              
              {/* Top Row: Basic Info & Approval Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#141414] p-4 rounded-2xl border border-[#222]">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Real Creator Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Instagram Handle (@) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.instagram_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, instagram_id: e.target.value.replace(/^@/, '') }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Approval / Contract Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none font-bold capitalize"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="negotiating">Negotiating Terms</option>
                    <option value="approved">Approved</option>
                    <option value="active">Active In Progress</option>
                    <option value="completed">Contract Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                    Follower Count
                  </label>
                  <input
                    type="text"
                    value={editForm.follower_count}
                    onChange={(e) => setEditForm(prev => ({ ...prev, follower_count: e.target.value }))}
                    className="w-full bg-[#0c0c0c] border border-[#2c2c2c] rounded-xl p-2.5 text-xs text-white focus:border-[#3428f8] outline-none"
                  />
                </div>
              </div>

              {/* Contract Range Control: 3 to 10 Reels */}
              <div className="bg-[#141414] p-4 rounded-2xl border border-[#222]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Video size={14} /> Contract Reels Quantity (Range: 3 to 10)
                    </h4>
                    <p className="text-[11px] text-[#777]">
                      Changing this count adds or trims the reel slots below automatically.
                    </p>
                  </div>

                  {/* Buttons 3 to 10 */}
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleReelsCountChange(n)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          editForm.reels_count === n
                            ? 'bg-[#3428f8] text-white'
                            : 'bg-[#222] text-[#888] hover:text-white'
                        }`}
                      >
                        {n} Reels
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* PER-REEL PRICING & FINAL RATE APPROVAL PANEL */}
              <div className="bg-[#121212] border border-[#2b2b2b] rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#222]">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <IndianRupee size={14} /> Final Per-Reel Pricing & Rate Approval
                    </h4>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      Influencer enters their quote; Admin approves the final money per reel.
                    </p>
                  </div>
                  {editForm.status === 'approved' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={12} /> Rate Approved
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
                      Pending Approval
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  {/* Creator's Quoted Rate */}
                  <div className="bg-[#0b0c10] border border-[#222] rounded-xl p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] block mb-1">
                      Influencer Quoted Cost / Reel
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono font-bold text-white">
                        ₹{Number(editForm.rate_per_reel || 0).toLocaleString()} <span className="text-xs text-[#777]">/ reel</span>
                      </span>
                      {Number(editForm.rate_per_reel || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(prev => ({
                              ...prev,
                              final_rate_per_reel: prev.rate_per_reel
                            }));
                          }}
                          className="text-[10px] font-bold text-blue-400 hover:text-white px-2 py-1 rounded bg-[#161616] hover:bg-[#222] border border-[#333] transition-colors cursor-pointer"
                        >
                          Use Quoted Rate
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-[#555] block mt-1">
                      Estimated quote: ₹{(Number(editForm.rate_per_reel || 0) * (parseInt(editForm.reels_count) || 3)).toLocaleString()} for {editForm.reels_count} reels
                    </span>
                  </div>

                  {/* Final Approved Rate Input */}
                  <div className="bg-[#0b0c10] border border-emerald-500/30 rounded-xl p-3.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Final Approved Money Per Reel (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#777] font-mono">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={editForm.final_rate_per_reel !== undefined ? editForm.final_rate_per_reel : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setEditForm(prev => ({
                            ...prev,
                            final_rate_per_reel: val,
                            total_price: Number(val || 0) * (parseInt(prev.reels_count) || 3)
                          }));
                        }}
                        className="w-full bg-[#161616] border border-[#333] focus:border-emerald-500 text-white pl-8 pr-3 py-2 rounded-lg text-sm font-mono font-bold outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[10px]">
                      <span className="text-[#888]">Total Payout ({editForm.reels_count} reels):</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        ₹{(Number(editForm.final_rate_per_reel || 0) * (parseInt(editForm.reels_count) || 3)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions for Rate */}
                <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-[#1e1e1e]">
                  <button
                    type="button"
                    onClick={handleApplyFinalRateToAllReels}
                    className="text-[11px] font-bold text-blue-400 hover:text-white px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#252525] border border-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    Apply Rate to All Reel Slots
                  </button>

                  <button
                    type="button"
                    onClick={handleApproveContractInModal}
                    className="text-[11px] font-bold uppercase tracking-wider text-black bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} /> Approve Contract with This Rate
                  </button>
                </div>
              </div>

              {/* INDIVIDUAL REEL BREAKDOWN (Reels 1 to N) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-1.5">
                  <CheckCheck size={14} /> Individual Reels Breakdown & Live Links ({editForm.reels?.length || 0} Reels)
                </h4>

                <div className="space-y-4">
                  {(editForm.reels || []).map((reel, idx) => (
                    <div 
                      key={idx}
                      className="bg-[#131313] border border-[#252525] rounded-2xl p-4 flex flex-col gap-3"
                    >
                      {/* Reel Header */}
                      <div className="flex flex-wrap justify-between items-center gap-2 pb-2.5 border-b border-[#202020]">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#3428f8]/20 text-blue-400 font-bold font-mono text-xs flex items-center justify-center border border-[#3428f8]/30">
                            #{reel.reel_number}
                          </span>
                          <span className="text-xs font-bold text-white">Reel #{reel.reel_number}</span>
                        </div>

                        {/* Status Select */}
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-[#777] uppercase font-bold">Status:</label>
                          <select
                            value={reel.status || 'pending'}
                            onChange={(e) => handleUpdateReelItem(idx, 'status', e.target.value)}
                            className="bg-[#1c1c1c] border border-[#333] text-white text-[11px] rounded-lg px-2.5 py-1 outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="shooting">Shooting</option>
                            <option value="editing">Editing</option>
                            <option value="uploaded">Uploaded / Live</option>
                          </select>
                        </div>
                      </div>

                      {/* Barter vs Paid Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0c0c0c] p-3 rounded-xl border border-[#1c1c1c]">
                        {/* Compensation Mode */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                            Compensation Model
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateReelItem(idx, 'is_barter', true);
                                handleUpdateReelItem(idx, 'is_paid', false);
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                reel.is_barter && !reel.is_paid
                                  ? 'bg-[#3428f8] text-white'
                                  : 'bg-[#181818] text-[#777]'
                              }`}
                            >
                              Barter System
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateReelItem(idx, 'is_barter', false);
                                handleUpdateReelItem(idx, 'is_paid', true);
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                reel.is_paid && !reel.is_barter
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#181818] text-[#777]'
                              }`}
                            >
                              Paid Cash
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateReelItem(idx, 'is_barter', true);
                                handleUpdateReelItem(idx, 'is_paid', true);
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                reel.is_barter && reel.is_paid
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-[#181818] text-[#777]'
                              }`}
                            >
                              Both
                            </button>
                          </div>
                        </div>

                        {/* Who Edited the Reel: Me vs They */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                            Who Edited the Reel?
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateReelItem(idx, 'editor', 'me')}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                reel.editor === 'me'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-[#181818] text-[#777]'
                              }`}
                            >
                              <Scissors size={11} /> Me (Outliers Media)
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateReelItem(idx, 'editor', 'they')}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                reel.editor === 'they'
                                  ? 'bg-[#3428f8] text-white'
                                  : 'bg-[#181818] text-[#777]'
                              }`}
                            >
                              <InstagramIcon size={11} /> They (Creator)
                            </button>
                          </div>
                        </div>

                        {/* Barter Item & Price (if barter enabled) */}
                        {reel.is_barter && (
                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1a1a1a]">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                                Item in Barter (What was given?)
                              </label>
                              <input
                                type="text"
                                value={reel.barter_item || ''}
                                onChange={(e) => handleUpdateReelItem(idx, 'barter_item', e.target.value)}
                                className="w-full bg-[#161616] border border-[#282828] rounded-lg p-2 text-xs text-white focus:border-[#3428f8] outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                                Barter Item Price / Worth (₹)
                              </label>
                              <input
                                type="number"
                                value={reel.barter_price || ''}
                                onChange={(e) => handleUpdateReelItem(idx, 'barter_price', Number(e.target.value || 0))}
                                className="w-full bg-[#161616] border border-[#282828] rounded-lg p-2 text-xs text-white font-mono focus:border-[#3428f8] outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Paid Amount (if paid enabled) */}
                        {reel.is_paid && (
                          <div className="sm:col-span-2 pt-2 border-t border-[#1a1a1a] space-y-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                                Commercial Payment to Creator (₹)
                              </label>
                              <input
                                type="number"
                                value={reel.paid_amount || ''}
                                onChange={(e) => handleUpdateReelItem(idx, 'paid_amount', Number(e.target.value || 0))}
                                className="w-full bg-[#161616] border border-[#282828] rounded-lg p-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121212] p-2.5 rounded-lg border border-[#202020]">
                              <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                                  Payout Status
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateReelItem(idx, 'payout_status', 'unpaid')}
                                    className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                      reel.payout_status !== 'paid'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-[#181818] text-[#777]'
                                    }`}
                                  >
                                    Unpaid
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateReelItem(idx, 'payout_status', 'paid');
                                      if (!reel.payout_amount) {
                                        handleUpdateReelItem(idx, 'payout_amount', reel.paid_amount || 0);
                                      }
                                      if (!reel.payout_date) {
                                        handleUpdateReelItem(idx, 'payout_date', new Date().toISOString());
                                      }
                                    }}
                                    className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                      reel.payout_status === 'paid'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-[#181818] text-[#777]'
                                    }`}
                                  >
                                    Paid
                                  </button>
                                </div>
                              </div>

                              {reel.payout_status === 'paid' && (
                                <div>
                                  <label className="text-[9px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                                    Method
                                  </label>
                                  <select
                                    value={reel.payout_method || 'UPI'}
                                    onChange={(e) => handleUpdateReelItem(idx, 'payout_method', e.target.value)}
                                    className="w-full bg-[#181818] border border-[#282828] rounded p-1 text-[11px] text-white focus:border-emerald-500 outline-none"
                                  >
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Barter Settled">Barter Settled</option>
                                  </select>
                                </div>
                              )}

                              {reel.payout_status === 'paid' && (
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] font-bold uppercase tracking-wider text-[#888] block mb-1">
                                    UTR / Reference ID
                                  </label>
                                  <input
                                    type="text"
                                    value={reel.payout_reference || ''}
                                    onChange={(e) => handleUpdateReelItem(idx, 'payout_reference', e.target.value)}
                                    className="w-full bg-[#181818] border border-[#282828] rounded p-1 text-[11px] text-white font-mono focus:border-emerald-500 outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Final Uploaded Reel Link */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                            <LinkIcon size={11} /> Uploaded Final Reel Link (Instagram URL)
                          </label>
                          {reel.final_reel_url && (
                            <a
                              href={reel.final_reel_url.startsWith('http') ? reel.final_reel_url : `https://${reel.final_reel_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                            >
                              Open Live Reel <ExternalLink size={10} />
                            </a>
                          )}
                        </div>

                        <input
                          type="text"
                          value={reel.final_reel_url || ''}
                          onChange={(e) => handleUpdateReelItem(idx, 'final_reel_url', e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#282828] rounded-xl p-2.5 text-xs text-white font-mono focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Screenshot Preview */}
              {editForm.dashboard_screenshot_url && (
                <div className="bg-[#141414] p-4 rounded-2xl border border-[#222]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Creator Instagram Insights / Dashboard Screenshot
                  </span>
                  <div className="flex items-center gap-4">
                    <img
                      src={editForm.dashboard_screenshot_url}
                      alt="Insights Screenshot"
                      className="w-24 h-24 object-cover rounded-xl border border-[#333] cursor-pointer"
                      onClick={() => setZoomScreenshotUrl(editForm.dashboard_screenshot_url)}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => setZoomScreenshotUrl(editForm.dashboard_screenshot_url)}
                        className="text-xs bg-[#3428f8]/20 text-blue-300 border border-[#3428f8]/30 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={12} /> View Full Screenshot
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#222] flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditingModalOpen(false);
                  setIsNewModalOpen(false);
                }}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#252525] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={isSaving}
                className="flex-1 bg-[#3428f8] hover:bg-[#2d23c9] disabled:bg-[#3428f8]/50 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                ) : (
                  <>
                    <Check size={15} /> Save Contract & Reels
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Settlement Modal */}
      {payoutModalCreator && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setPayoutModalCreator(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#101010] border border-[#2a2a2a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex justify-between items-center pb-4 border-b border-[#222] mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Disbursement Tracker
                </span>
                <h3 className="text-xl font-serif text-white font-bold">
                  Settle Creator Payout
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModalCreator(null)}
                className="text-[#888] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Creator Info Recap */}
            <div className="p-3.5 rounded-xl bg-[#161616] border border-[#252525] mb-5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#888]">Creator:</span>
                <span className="text-white font-bold">{payoutModalCreator.name} (@{payoutModalCreator.instagram_id})</span>
              </div>
              {(() => {
                const fin = computeCreatorFinances(payoutModalCreator);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#888]">Total Committed:</span>
                      <span className="text-white font-mono font-bold">₹{fin.committed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888]">Already Paid:</span>
                      <span className="text-emerald-400 font-mono font-bold">₹{fin.paid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#222]">
                      <span className="text-amber-400 font-bold">Balance Owed:</span>
                      <span className="text-amber-400 font-mono font-bold text-sm">₹{fin.pending.toLocaleString()}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <form onSubmit={handleConfirmPayout} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Disbursement Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payoutAmountInput}
                  onChange={(e) => setPayoutAmountInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Payment Method *
                </label>
                <select
                  value={payoutMethodInput}
                  onChange={(e) => setPayoutMethodInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer (IMPS / NEFT / RTGS)</option>
                  <option value="Cash">Cash in Hand</option>
                  <option value="Barter Settled">Barter Settled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Transaction Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={payoutRefInput}
                  onChange={(e) => setPayoutRefInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1">
                  Disbursement Notes / Receipt Reference
                </label>
                <input
                  type="text"
                  value={payoutNotesInput}
                  onChange={(e) => setPayoutNotesInput(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutModalCreator(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#181818] border border-[#282828] text-xs font-bold uppercase tracking-wider text-[#aaa] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPayout ? 'Recording...' : 'Mark as Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Rate Approval Modal */}
      {rateApprovalCreator && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setRateApprovalCreator(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#111] border border-[#333] rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex justify-between items-center pb-4 border-b border-[#222]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Rate Approval</span>
                <h3 className="text-base font-bold text-white mt-0.5">Approve Final Money Per Reel</h3>
              </div>
              <button
                onClick={() => setRateApprovalCreator(null)}
                className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRateApproval} className="space-y-4 pt-4">
              <div className="bg-[#0b0c10] p-3 rounded-xl border border-[#222] text-xs space-y-1.5">
                <div className="flex justify-between text-[#888]">
                  <span>Creator:</span>
                  <span className="font-bold text-white">{rateApprovalCreator.name} (@{rateApprovalCreator.instagram_id})</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Reels Signed:</span>
                  <span className="font-mono font-bold text-white">{rateApprovalCreator.reels_count} reels</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Quoted by Creator:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {rateApprovalCreator.rate_per_reel > 0 ? `₹${Number(rateApprovalCreator.rate_per_reel).toLocaleString()} / reel` : 'Barter / Free'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Final Approved Money Per Reel (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#777] font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={rateApprovalInput}
                    onChange={(e) => setRateApprovalInput(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-emerald-500 rounded-xl pl-8 pr-4 py-3 text-sm text-white font-mono font-bold outline-none"
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-[11px] text-[#777]">
                  <span>Total Final Payout:</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    ₹{(Number(rateApprovalInput || 0) * (parseInt(rateApprovalCreator.reels_count) || 3)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRateApprovalCreator(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#181818] border border-[#282828] text-xs font-bold uppercase tracking-wider text-[#aaa] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval || !rateApprovalInput}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold uppercase tracking-wider text-black transition-colors cursor-pointer disabled:opacity-50 font-bold"
                >
                  {isSubmittingApproval ? 'Approving...' : 'Lock & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot Zoom Modal */}
      {zoomScreenshotUrl && (
        <div 
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setZoomScreenshotUrl(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#111] border border-[#333] rounded-3xl p-4 max-w-2xl w-full max-h-[90vh] flex flex-col relative"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#222]">
              <span className="text-white text-xs font-bold uppercase tracking-wider">Creator Dashboard Screenshot</span>
              <button
                onClick={() => setZoomScreenshotUrl(null)}
                className="text-[#666] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto flex items-center justify-center p-2 mt-2">
              <img 
                src={zoomScreenshotUrl} 
                alt="Zoomed Screenshot" 
                className="max-h-[75vh] w-auto rounded-xl object-contain border border-[#222]" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
