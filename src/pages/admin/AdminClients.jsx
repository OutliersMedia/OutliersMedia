import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Search, Copy, Check, Clock, Image as ImageIcon, Video, Layout, AlertTriangle } from 'lucide-react';

// --- COPY BUTTON COMPONENT ---
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="p-0.5 rounded hover:bg-[#333] transition-colors ml-1 inline-flex items-center" title="Copy">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#555] hover:text-[#aaa]" />}
    </button>
  );
}

import { generateUploadSchedule, getNextUpload, TYPE_CONFIG } from '../../utils/scheduleEngine';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: posts } = await supabase
      .from('posts_log')
      .select('*')
      .order('published_at', { ascending: false });

    if (profiles) {
      const ordersList = orders || [];
      const postsList = posts || [];

      const merged = profiles.map(profile => {
        const clientOrders = ordersList.filter(o => o.client_id === profile.auth_id);
        const activeOrPending = clientOrders.find(o => ['active', 'pending', 'paused'].includes(o.status));
        const latestOrder = activeOrPending || clientOrders[0] || null;

        let calculatedStatus = 'lead';
        if (latestOrder) {
          calculatedStatus = latestOrder.status;
          if (calculatedStatus === 'active' && latestOrder.created_at) {
            const expiryDate = new Date(latestOrder.created_at);
            expiryDate.setDate(expiryDate.getDate() + 30);
            if (new Date() > expiryDate) calculatedStatus = 'expired';
          }
        }

        // Build intelligent schedule for active clients
        let scheduleInfo = null;
        if (latestOrder && calculatedStatus === 'active') {
          const orderPosts = postsList.filter(p => p.order_id === latestOrder.order_id);
          const staticDone = orderPosts.filter(p => p.post_type === 'static').length;
          const reelsDone = orderPosts.filter(p => p.post_type === 'reel').length;
          const postersDone = orderPosts.filter(p => p.post_type === 'poster').length;
          const totalDone = staticDone + reelsDone + postersDone;
          const totalQuota = latestOrder.static_posts_total + latestOrder.reels_total + latestOrder.posters_total;

          const schedule = generateUploadSchedule(
            latestOrder.created_at,
            latestOrder.plan_name,
            latestOrder.static_posts_total,
            latestOrder.reels_total,
            latestOrder.posters_total
          );

          const nextSlot = getNextUpload(schedule, staticDone, reelsDone, postersDone);

          const deadline = new Date(latestOrder.created_at);
          deadline.setDate(deadline.getDate() + 30);
          const daysLeftCycle = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)));

          scheduleInfo = {
            totalDone,
            totalQuota,
            daysLeftCycle,
            nextSlot,
            allDone: totalDone >= totalQuota
          };
        }

        return { ...profile, latestOrder, calculatedStatus, scheduleInfo };
      });
      setClients(merged);
    }
    setLoading(false);
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
                          c.email?.toLowerCase().includes(search.toLowerCase()) ||
                          c.latestOrder?.order_id?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'All') return true;
    if (filter === 'Active') return c.calculatedStatus === 'active';
    if (filter === 'Pending') return c.calculatedStatus === 'pending';
    if (filter === 'Paused') return c.calculatedStatus === 'paused';
    if (filter === 'Expired') return c.calculatedStatus === 'expired';
    if (filter === 'Leads') return c.calculatedStatus === 'lead';
    if (filter === 'Inactive') return c.calculatedStatus === 'cancelled';
    return true;
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 min-h-[calc(100vh-140px)] shadow-2xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Client Management</h2>
          <p className="text-[#888] text-sm">Track all signed-up profiles, monitor plans, and upcoming deliverables.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-[#0a0a0a] p-1 rounded-xl mb-6 inline-flex border border-[#222]">
        {['All', 'Leads', 'Pending', 'Active', 'Expired', 'Paused', 'Inactive'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 text-xs uppercase font-bold tracking-widest rounded-lg transition-all ${filter === f ? 'bg-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.3)]' : 'text-[#666] hover:text-[#aaa]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#222]">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#222]">
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Client / Contact</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Plan / Order ID</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Next Upload</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const order = client.latestOrder;
                const si = client.scheduleInfo;

                return (
                  <tr key={client.auth_id} className="border-b border-[#222] bg-[#111] hover:bg-[#151515] transition-colors">
                    {/* Client / Contact */}
                    <td className="p-4 min-w-[280px]">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-medium">{client.name || 'Unknown'}</p>
                        {client.role === 'admin' && <span className="text-[9px] bg-[#3428f8] px-1 py-0.5 rounded text-white uppercase">Admin</span>}
                        {client.user_id && <span className="text-[9px] text-[#666] font-mono border border-[#333] px-1 py-0.5 rounded">{client.user_id}</span>}
                      </div>
                      <div className="flex items-center gap-0 mb-0.5">
                        <p className="text-[#888] text-xs">{client.email}</p>
                        {client.email && <CopyButton text={client.email} />}
                      </div>
                      <div className="flex items-center gap-0 mb-1">
                        <p className="text-[#555] text-xs font-mono">{client.phone || 'No Phone'}</p>
                        {client.phone && <CopyButton text={client.phone} />}
                      </div>
                      <p className="text-[#444] text-[10px] uppercase font-bold tracking-widest mb-2">Joined: {new Date(client.created_at).toLocaleDateString()}</p>
                      {(client.business_type || client.instagram_handle) && (
                        <div className="bg-[#0a0a0a] p-2 rounded-lg border border-[#222] flex flex-col gap-1">
                          {client.business_type && (
                            <p className="text-[#aaa] text-[10px] uppercase font-bold tracking-wider">
                              Business: <span className="text-white font-normal capitalize tracking-normal">{client.business_type}</span>
                            </p>
                          )}
                          {client.instagram_handle && (
                            <p className="text-[#aaa] text-[10px] uppercase font-bold tracking-wider">
                              IG: <a href={`https://instagram.com/${client.instagram_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-pink-500 hover:text-pink-400 font-normal tracking-normal lowercase">{client.instagram_handle}</a>
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Plan / Order ID */}
                    <td className="p-4">
                      {order ? (
                        <>
                          <p className="text-[#3428f8] font-bold text-sm mb-1">{order.plan_name}</p>
                          <p className="text-[#666] text-xs font-mono">{order.order_id}</p>
                        </>
                      ) : (
                        <span className="text-[#555] text-sm italic">No Plan Selected</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      {client.calculatedStatus === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Active</span>}
                      {client.calculatedStatus === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">Pending</span>}
                      {client.calculatedStatus === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Paused</span>}
                      {client.calculatedStatus === 'expired' && <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Expired</span>}
                      {client.calculatedStatus === 'cancelled' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Cancelled</span>}
                      {client.calculatedStatus === 'lead' && <span className="bg-[#222] text-[#888] border border-[#333] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Lead</span>}
                    </td>

                    {/* Next Upload — Intelligent Schedule */}
                    <td className="p-4 min-w-[280px]">
                      {si ? (
                        si.allDone ? (
                          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">✓ All Delivered</p>
                            <p className="text-[#666] text-[10px]">{si.totalDone}/{si.totalQuota} posts completed this cycle</p>
                          </div>
                        ) : si.nextSlot ? (() => {
                          const cfg = TYPE_CONFIG[si.nextSlot.type];
                          const Icon = cfg.icon;
                          const uploadDate = si.nextSlot.date;
                          const now = new Date();
                          const diffMs = uploadDate - now;
                          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                          const isOverdue = diffDays < 0;
                          const isToday = diffDays === 0;
                          const isTomorrow = diffDays === 1;

                          return (
                            <div className={`rounded-xl p-3 border ${isOverdue ? 'bg-red-500/5 border-red-500/20' : isToday ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-[#0a0a0a] border-[#222]'}`}>
                              {/* What to upload */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-lg ${cfg.bg}/20`}>
                                  <Icon size={14} className={cfg.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs font-bold truncate">
                                    Upload 1 {cfg.label} {si.nextSlot.time ? `@ ${si.nextSlot.time}` : ''}
                                  </p>
                                  <p className="text-[#666] text-[10px] font-mono">
                                    {uploadDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                  {si.nextSlot.note && (
                                    <span className="text-[9px] text-[#3428f8] font-medium block truncate mt-0.5">
                                      🎯 {si.nextSlot.note}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Time status */}
                              <div className="flex items-center gap-1.5 mb-2">
                                {isOverdue ? (
                                  <>
                                    <AlertTriangle size={12} className="text-red-500" />
                                    <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider">
                                      Overdue by {Math.abs(diffDays)} day{Math.abs(diffDays) !== 1 ? 's' : ''}
                                    </span>
                                  </>
                                ) : isToday ? (
                                  <>
                                    <Clock size={12} className="text-yellow-500" />
                                    <span className="text-yellow-500 text-[10px] font-bold uppercase tracking-wider">Due Today</span>
                                  </>
                                ) : isTomorrow ? (
                                  <>
                                    <Clock size={12} className="text-yellow-500" />
                                    <span className="text-yellow-500 text-[10px] font-bold uppercase tracking-wider">Due Tomorrow</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={12} className="text-[#555]" />
                                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider">
                                      In {diffDays} day{diffDays !== 1 ? 's' : ''}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Progress */}
                              <div className="w-full bg-[#222] h-1 rounded-full overflow-hidden">
                                <div className="bg-[#3428f8] h-full transition-all" style={{ width: `${(si.totalDone / si.totalQuota) * 100}%` }}></div>
                              </div>
                              <p className="text-[#555] text-[9px] font-bold uppercase tracking-wider mt-1">{si.totalDone}/{si.totalQuota} done • {si.daysLeftCycle}d left in cycle</p>
                            </div>
                          );
                        })() : null
                      ) : (
                        <span className="text-[#444] text-xs italic">
                          {client.calculatedStatus === 'lead' ? 'No plan yet' :
                           client.calculatedStatus === 'pending' ? 'Awaiting approval' :
                           client.calculatedStatus === 'paused' ? 'Plan paused' :
                           client.calculatedStatus === 'expired' ? 'Plan expired' :
                           client.calculatedStatus === 'cancelled' ? 'Plan cancelled' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-[#666]">
                    No clients match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
