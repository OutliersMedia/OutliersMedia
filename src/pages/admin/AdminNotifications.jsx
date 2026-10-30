import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  MessageCircle, Users, Flame, Search, ExternalLink, Send, 
  CheckCircle2, Clock, Phone, Building2, Check, RefreshCw
} from 'lucide-react';
import { fetchInfluencers } from '../../utils/influencerEngine';

const CLIENT_TEMPLATES = [
  {
    id: 'package_over',
    title: 'Package Expired / Renewal Notice',
    badge: 'Renewal',
    generate: (name) => 
      `Hi ${name || 'there'}, your monthly marketing package with Outliers Media has completed. We’d love to review this month’s performance and align on renewing your growth strategy for the next cycle. Let us know a convenient time to connect!`
  },
  {
    id: 'half_package',
    title: 'Half Package Done (50% Milestone Reached)',
    badge: 'Milestone',
    generate: (name) => 
      `Hi ${name || 'there'}, quick update from Outliers Media! We have successfully completed 50% of your campaign deliverables for this month. Our creative team is actively optimizing reach and engagement for the remaining deliverables.`
  },
  {
    id: 'strategy_session',
    title: 'Monthly Strategy & Review Call',
    badge: 'Strategy',
    generate: (name) => 
      `Hi ${name || 'there'}, hope you're having a productive week! It's time for our monthly strategy alignment. Please let us know a convenient time this week for a brief call to discuss our creative direction for next month.`
  },
  {
    id: 'payment_reminder',
    title: 'Payment / Installment Reminder',
    badge: 'Finance',
    generate: (name) => 
      `Hi ${name || 'there'}, this is a gentle reminder regarding the upcoming payment / milestone installment for your marketing package with Outliers Media. Please feel free to check your client dashboard or let us know if you need any assistance.`
  },
  {
    id: 'deliverables_review',
    title: 'Campaign Content Ready for Review',
    badge: 'Review',
    generate: (name) => 
      `Hi ${name || 'there'}, fresh creative deliverables have been uploaded to your Outliers Media dashboard! Please review them at your earliest convenience and let us know your feedback.`
  },
  {
    id: 'custom',
    title: 'Custom Message',
    badge: 'Custom',
    generate: (name) => `Hi ${name || 'there'}, `
  }
];

const INFLUENCER_TEMPLATES = [
  {
    id: 'contract_brief',
    title: 'Campaign Brief & Guidelines',
    badge: 'Brief',
    generate: (name) => 
      `Hi ${name || 'there'}, excited to collaborate with you! Please review your campaign brief and shoot guidelines for your upcoming reels with Outliers Media. Let us know once you've reviewed the concept hooks.`
  },
  {
    id: 'footage_checkin',
    title: 'Editing & Footage Status Check',
    badge: 'Editing',
    generate: (name) => 
      `Hi ${name || 'there'}, checking in from Outliers Media regarding your contracted reels. Please share the raw footage / draft at your earliest convenience so our editing team can finalize review.`
  },
  {
    id: 'live_upload',
    title: 'Reel Approved - Live Upload Confirmation',
    badge: 'Upload',
    generate: (name) => 
      `Hi ${name || 'there'}, your reel has been reviewed and approved! Please confirm once it is posted live on Instagram and share the live URL with us so we can feature it.`
  },
  {
    id: 'payout_settled',
    title: 'Commercial Fee / Payout Disbursed',
    badge: 'Payout',
    generate: (name) => 
      `Hi ${name || 'there'}, your creator payout has been processed and disbursed. Thank you for partnering with Outliers Media! Looking forward to our next collaboration.`
  },
  {
    id: 'barter_terms',
    title: 'Barter Delivery & Collaboration Agreement',
    badge: 'Barter',
    generate: (name) => 
      `Hi ${name || 'there'}, please confirm receipt of your barter items and terms for our upcoming campaign with Outliers Media. Let's make this collaboration viral!`
  },
  {
    id: 'custom',
    title: 'Custom Message',
    badge: 'Custom',
    generate: (name) => `Hi ${name || 'there'}, `
  }
];

export default function AdminNotifications() {
  const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'influencers'
  
  // Data states
  const [clients, setClients] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Recipient & Composer State
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('half_package');
  const [messageText, setMessageText] = useState('');
  const [sentLog, setSentLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('outliers_wa_sent_log') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Clients
      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_id, name, email, phone, business_type, instagram_handle, role')
        .order('name', { ascending: true });

      const { data: orders } = await supabase
        .from('orders')
        .select('client_id, plan_name, status, created_at')
        .order('created_at', { ascending: false });

      const clientList = (profiles || [])
        .filter(p => p.role !== 'admin' && p.role !== 'tester')
        .map(p => {
          const clientOrders = (orders || []).filter(o => o.client_id === p.auth_id);
          const latestOrder = clientOrders[0];
          return {
            id: p.auth_id,
            name: p.name || 'Client',
            business_name: p.business_type || 'Local Business',
            phone: p.phone || '',
            email: p.email || '',
            instagram: p.instagram_handle || '',
            plan: latestOrder?.plan_name || 'Active Client',
            status: latestOrder?.status || 'active',
            type: 'client'
          };
        });

      setClients(clientList);

      // 2. Fetch Influencers
      const infList = await fetchInfluencers();
      const formattedInf = (infList || []).map(inf => ({
        id: inf.id,
        name: inf.name || 'Creator',
        business_name: `@${inf.instagram_id || 'creator'}`,
        phone: inf.phone || '',
        email: inf.email || '',
        instagram: inf.instagram_id || '',
        niche: inf.niche || 'Lifestyle',
        reels_count: inf.reels_count || 3,
        status: inf.status || 'active',
        type: 'influencer'
      }));

      setInfluencers(formattedInf);

      // Default select first available
      if (clientList.length > 0 && !selectedRecipient) {
        selectRecipient(clientList[0], 'clients');
      }
    } catch (err) {
      console.error("Error loading messaging data:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectRecipient = (recipient, tab = activeTab) => {
    setSelectedRecipient(recipient);
    const templates = tab === 'clients' ? CLIENT_TEMPLATES : INFLUENCER_TEMPLATES;
    const defaultTpl = templates[0];
    setSelectedTemplateId(defaultTpl.id);
    setMessageText(defaultTpl.generate(recipient.name));
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    const templates = activeTab === 'clients' ? CLIENT_TEMPLATES : INFLUENCER_TEMPLATES;
    const tpl = templates.find(t => t.id === templateId);
    if (tpl && selectedRecipient) {
      setMessageText(tpl.generate(selectedRecipient.name));
    }
  };

  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  };

  const handleOpenWhatsApp = (recipient = selectedRecipient, text = messageText) => {
    if (!recipient?.phone) {
      alert(`No phone number recorded for ${recipient?.name || 'this recipient'}. Please update their profile.`);
      return;
    }

    const cleanedPhone = cleanPhoneNumber(recipient.phone);
    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/${cleanedPhone}?text=${encoded}`;
    
    // Log transmission
    const logItem = {
      id: `wa_${Date.now()}`,
      recipient_name: recipient.name,
      recipient_type: recipient.type,
      phone: recipient.phone,
      timestamp: new Date().toISOString(),
      template: selectedTemplateId
    };

    const updatedLog = [logItem, ...sentLog.slice(0, 19)];
    setSentLog(updatedLog);
    try {
      localStorage.setItem('outliers_wa_sent_log', JSON.stringify(updatedLog));
    } catch (e) {
      console.warn("Could not save sent log:", e);
    }

    window.open(waUrl, '_blank');
  };

  // Quick 1-click sender from table
  const handleQuickSend = (recipient, templateKey) => {
    const templates = recipient.type === 'client' ? CLIENT_TEMPLATES : INFLUENCER_TEMPLATES;
    const tpl = templates.find(t => t.id === templateKey) || templates[0];
    const text = tpl.generate(recipient.name);
    handleOpenWhatsApp(recipient, text);
  };

  // Search filtered lists
  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.instagram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.phone.includes(searchTerm)
    );
  }, [influencers, searchTerm]);

  const activeTemplates = activeTab === 'clients' ? CLIENT_TEMPLATES : INFLUENCER_TEMPLATES;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111] border border-[#222] p-5 sm:p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/30 rounded-2xl">
            <MessageCircle size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-2">
              WhatsApp Communication Hub
            </h1>
            <p className="text-xs text-[#888]">
              Connect directly with clients and creators on WhatsApp using verified agency message templates.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          className="bg-[#181818] hover:bg-[#222] border border-[#2a2a2a] text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Contacts
        </button>
      </div>

      {/* Main Tabs: Clients vs Influencers */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-[#0e0e0e] border border-[#222] self-start">
        <button
          type="button"
          onClick={() => {
            setActiveTab('clients');
            if (clients.length > 0) selectRecipient(clients[0], 'clients');
          }}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'clients'
              ? 'bg-[#3428f8] text-white shadow-md'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>Clients Directory ({clients.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('influencers');
            if (influencers.length > 0) selectRecipient(influencers[0], 'influencers');
          }}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'influencers'
              ? 'bg-[#3428f8] text-white shadow-md'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Flame size={14} />
          <span>Influencers & Creators ({influencers.length})</span>
        </button>
      </div>

      {/* Workspace: Left List + Right Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Directory Table / List */}
        <div className="lg:col-span-7 bg-[#0f0f0f] border border-[#222] rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              {activeTab === 'clients' ? 'Select Client' : 'Select Creator'}
            </h2>
            
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#161616] border border-[#282828] rounded-xl py-1.5 pl-8 pr-3 text-xs text-white focus:border-[#3428f8] outline-none"
              />
            </div>
          </div>

          {/* Contact Cards List */}
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {activeTab === 'clients' ? (
              filteredClients.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#666]">No clients found matching search.</div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedRecipient?.id === client.id;
                  return (
                    <div
                      key={client.id}
                      onClick={() => selectRecipient(client, 'clients')}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#181818] border-[#3428f8] text-white shadow-md'
                          : 'bg-[#121212] border-[#222] text-[#aaa] hover:border-[#333] hover:text-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm text-white truncate">{client.name}</h3>
                          <span className="text-[10px] bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/30 px-2 py-0.2 rounded-full font-bold uppercase">
                            {client.plan}
                          </span>
                        </div>
                        <p className="text-xs text-[#777] truncate">
                          {client.business_name} • {client.phone || 'No phone'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {client.phone ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickSend(client, 'half_package');
                            }}
                            className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
                            title="Quick Send 50% Milestone via WhatsApp"
                          >
                            <Send size={13} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#666]">No Phone</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              filteredInfluencers.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#666]">No creators found matching search.</div>
              ) : (
                filteredInfluencers.map((inf) => {
                  const isSelected = selectedRecipient?.id === inf.id;
                  return (
                    <div
                      key={inf.id}
                      onClick={() => selectRecipient(inf, 'influencers')}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#181818] border-[#3428f8] text-white shadow-md'
                          : 'bg-[#121212] border-[#222] text-[#aaa] hover:border-[#333] hover:text-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm text-white truncate">{inf.name}</h3>
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.2 rounded-full font-bold font-mono">
                            @{inf.instagram}
                          </span>
                        </div>
                        <p className="text-xs text-[#777] truncate">
                          {inf.niche} • {inf.reels_count} Reels Contract • {inf.phone || 'No phone'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {inf.phone ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickSend(inf, 'footage_checkin');
                            }}
                            className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
                            title="Quick Send Footage Status via WhatsApp"
                          >
                            <Send size={13} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#666]">No Phone</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Right Side: WhatsApp Message Composer */}
        <div className="lg:col-span-5 bg-[#0f0f0f] border border-[#222] rounded-3xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#222]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3428f8] block mb-0.5">
                Active Recipient
              </span>
              {selectedRecipient ? (
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    {selectedRecipient.name}
                  </h3>
                  <p className="text-xs text-[#888]">
                    {selectedRecipient.business_name} • Phone: <span className="text-white font-mono">{selectedRecipient.phone || 'Not recorded'}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#666]">Select a recipient from the left list.</p>
              )}
            </div>

            {/* Template Selector Dropdown */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-1.5">
                Choose Message Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 text-xs text-white focus:border-[#3428f8] outline-none"
              >
                {activeTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    [{tpl.badge}] {tpl.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Message Textarea */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#aaa]">
                  WhatsApp Message Text
                </label>
                <span className="text-[10px] text-[#666]">Editable before sending</span>
              </div>
              <textarea
                rows="7"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-3.5 text-xs text-white focus:border-[#3428f8] outline-none resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Action Button: Send to WhatsApp */}
          <div>
            <button
              type="button"
              disabled={!selectedRecipient || !selectedRecipient.phone || !messageText.trim()}
              onClick={() => handleOpenWhatsApp()}
              className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] disabled:opacity-40 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg font-sans"
            >
              <MessageCircle size={16} />
              Open In WhatsApp Chat
              <ExternalLink size={14} />
            </button>
            <p className="text-[10px] text-[#666] text-center mt-2">
              Opens WhatsApp directly with the pre-written message formatted and ready to deliver.
            </p>
          </div>
        </div>

      </div>

      {/* Sent Transmission History */}
      {sentLog.length > 0 && (
        <div className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#222] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#888] flex items-center gap-1.5">
              <Clock size={13} /> Recent WhatsApp Dispatches
            </span>
            <button
              type="button"
              onClick={() => {
                setSentLog([]);
                localStorage.removeItem('outliers_wa_sent_log');
              }}
              className="text-[10px] text-[#666] hover:text-white uppercase font-bold"
            >
              Clear Log
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {sentLog.slice(0, 4).map(item => (
              <div key={item.id} className="p-2.5 rounded-xl bg-[#141414] border border-[#222] text-xs">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-white truncate">{item.recipient_name}</span>
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 rounded">
                    Sent
                  </span>
                </div>
                <span className="text-[10px] text-[#777] block font-mono">{item.phone}</span>
                <span className="text-[9px] text-[#555] block mt-1">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
