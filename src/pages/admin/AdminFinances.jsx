import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import { IndianRupee, TrendingUp, Clock, Search, ExternalLink, CheckCircle, PauseCircle, PlayCircle, XCircle, History, X, FileDown } from 'lucide-react';
import { generateSingleInvoicePDF, generateLifetimeStatementPDF } from '../../utils/invoiceGenerator';

export default function AdminFinances() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [metrics, setMetrics] = useState({ totalRevenue: 0, pendingRevenue: 0, totalTransactions: 0 });
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);

  useEffect(() => {
    fetchFinances();
  }, []);

  const fetchFinances = async () => {
    setLoading(true);
    
    // Fetch all profiles (don't filter by role so even admin test accounts show names)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_id, name, email, phone, business_type, instagram_handle');

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.auth_id] = p;
      });
    }

    // Fetch all orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (orders) {
      let totalRev = 0;
      let pendingRev = 0;

      const mapped = orders.map(order => {
        if (order.status === 'active' || order.status === 'paused' || order.status === 'cancelled') {
          totalRev += Number(order.amount_paid || 0);
        } else if (order.status === 'pending') {
          pendingRev += Number(order.amount_paid || 0);
        }

        return {
          ...order,
          client: profileMap[order.client_id] || { name: 'Unknown Client', email: 'Unknown' }
        };
      });

      setTransactions(mapped);
      setMetrics({
        totalRevenue: totalRev,
        pendingRevenue: pendingRev,
        totalTransactions: orders.length
      });
    }
    setLoading(false);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert("Error updating status: " + error.message);
    } else {
      // Refresh to update metrics and UI
      fetchFinances();
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.payment_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.client.name?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    if (filter === 'Pending') return t.status === 'pending';
    if (filter === 'Approved') return ['active', 'paused', 'cancelled'].includes(t.status);
    
    return true;
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 min-h-[calc(100vh-140px)] shadow-2xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Financial Overview</h2>
          <p className="text-[#888] text-sm">Track payments, review receipts, and monitor agency revenue.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" 
              placeholder="Search TXN ID, Client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-green-500">
            <TrendingUp size={64} />
          </div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-2">Total Verified Revenue</p>
          <h3 className="text-3xl font-serif text-white flex items-center gap-2">
            <IndianRupee size={24} className="text-green-500" />
            {metrics.totalRevenue.toLocaleString()}
          </h3>
        </div>
        
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-yellow-500">
            <Clock size={64} />
          </div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-2">Pending Approval</p>
          <h3 className="text-3xl font-serif text-white flex items-center gap-2">
            <IndianRupee size={24} className="text-yellow-500" />
            {metrics.pendingRevenue.toLocaleString()}
          </h3>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6">
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-2">Total Transactions</p>
          <h3 className="text-3xl font-serif text-white">{metrics.totalTransactions}</h3>
        </div>
      </div>

      <div className="flex gap-2 bg-[#0a0a0a] p-1 rounded-xl mb-6 inline-flex border border-[#222]">
        {['All', 'Pending', 'Approved'].map(f => (
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
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Date</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Payment ID</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Client / Order ID</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Amount</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666]">Invoice / Receipt</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-[#666] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((txn) => {
                const isApproved = ['active', 'paused', 'cancelled'].includes(txn.status);
                
                return (
                  <tr key={txn.id} className="border-b border-[#222] bg-[#111] hover:bg-[#151515] transition-colors">
                    <td className="p-4 text-[#aaa] text-sm">
                      {new Date(txn.created_at).toLocaleDateString()}<br/>
                      <span className="text-[10px] text-[#555]">{new Date(txn.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="p-4">
                      <p className="text-white font-mono text-sm">{txn.payment_id || 'Legacy-N/A'}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-white font-medium mb-1">{txn.client.name}</p>
                      <p className="text-[#666] text-xs font-mono mb-2">{txn.order_id} • {txn.plan_name}</p>
                      <button
                        onClick={() => setSelectedClientHistory(txn.client_id)}
                        className="inline-flex items-center gap-1.5 text-[10px] text-[#3428f8] hover:text-white font-bold uppercase tracking-wider bg-[#3428f8]/10 hover:bg-[#3428f8] px-2.5 py-1 rounded-lg border border-[#3428f8]/20 transition-all cursor-pointer shadow-sm"
                        title="View all lifetime transactions for this client"
                      >
                        <History size={12} />
                        Lifetime History
                      </button>
                    </td>
                    <td className="p-4">
                      <p className="text-white font-bold text-sm">₹{Number(txn.amount_paid).toLocaleString()}</p>
                    </td>
                    <td className="p-4">
                      {txn.status === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>}
                      {txn.status === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">Pending</span>}
                      {txn.status === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Paused</span>}
                      {txn.status === 'cancelled' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Cancelled</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <button
                          onClick={() => generateSingleInvoicePDF(txn, txn.client)}
                          className="inline-flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-[#3428f8] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                          title="Generate & download shareable official PDF invoice"
                        >
                          <FileDown size={12} className="text-[#3428f8]" />
                          PDF Invoice
                        </button>
                        {txn.payment_receipt_url ? (
                          <a 
                            href={txn.payment_receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#888] hover:text-white text-[10px] font-medium tracking-wider transition-colors ml-0.5"
                          >
                            Receipt Proof <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-[#444] text-[9px] font-mono ml-0.5">No receipt proof</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {txn.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'active')}
                            className="bg-green-500/10 hover:bg-green-500/20 text-green-400 p-2 rounded-lg transition-colors tooltip" title="Approve Payment"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {txn.status === 'active' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'paused')}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 p-2 rounded-lg transition-colors tooltip" title="Pause Plan"
                          >
                            <PauseCircle size={16} />
                          </button>
                        )}
                        {txn.status === 'paused' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'active')}
                            className="bg-[#3428f8]/10 hover:bg-[#3428f8]/20 text-[#3428f8] p-2 rounded-lg transition-colors tooltip" title="Resume Plan"
                          >
                            <PlayCircle size={16} />
                          </button>
                        )}
                        {['active', 'paused', 'pending'].includes(txn.status) && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(txn.id, 'cancelled')}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors tooltip" title="Cancel Plan"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#666]">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Lifetime Transaction History Modal */}
      <AnimatePresence>
        {selectedClientHistory && (() => {
          const clientTxns = transactions.filter(t => t.client_id === selectedClientHistory);
          const clientInfo = clientTxns[0]?.client || { name: 'Client', email: '' };
          const approvedSpent = clientTxns
            .filter(t => ['active', 'paused', 'cancelled'].includes(t.status))
            .reduce((sum, t) => sum + Number(t.amount_paid || 0), 0);

          return (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedClientHistory(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-[#222]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#3428f8]/10 text-[#3428f8]">
                      <History size={22} />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-serif">{clientInfo.name}</h3>
                      <p className="text-[#666] text-xs font-mono">{clientInfo.email || 'Lifetime Financial History'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generateLifetimeStatementPDF(clientInfo, clientTxns)}
                      className="inline-flex items-center gap-1.5 bg-[#3428f8] hover:bg-[#2a1fd1] text-white px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
                      title="Download complete lifetime statement PDF with structured filename"
                    >
                      <FileDown size={14} />
                      Statement PDF
                    </button>

                    <button 
                      onClick={() => setSelectedClientHistory(null)}
                      className="text-[#666] hover:text-white p-1 rounded-lg hover:bg-[#222] transition-colors"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Lifetime Summary */}
                <div className="grid grid-cols-3 gap-3 my-4">
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Total Lifetime Paid</span>
                    <span className="text-green-400 font-serif text-xl font-bold">₹{approvedSpent.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Total Orders</span>
                    <span className="text-white font-serif text-xl font-bold">{clientTxns.length}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl">
                    <span className="text-[#666] text-[10px] font-bold uppercase tracking-wider block mb-1">Account Standing</span>
                    <span className="text-[#3428f8] font-bold text-xs uppercase tracking-wider block mt-1">Verified Client</span>
                  </div>
                </div>

                {/* Transactions List */}
                <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-3 custom-scrollbar">
                  {clientTxns.map((t, idx) => (
                    <div key={idx} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-[#333] transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-sm">{t.plan_name}</span>
                          {t.status === 'active' && <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Active</span>}
                          {t.status === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Pending</span>}
                          {t.status === 'paused' && <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Paused</span>}
                          {t.status === 'cancelled' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Cancelled</span>}
                        </div>
                        <p className="text-[#666] text-xs font-mono">
                          Order: {t.order_id} • TXN: {t.payment_id || 'N/A'}
                        </p>
                        <p className="text-[#555] text-[10px] mt-0.5">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(t.created_at).toLocaleTimeString()}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#1a1a1a]">
                        <span className="text-white font-serif font-bold text-base">₹{Number(t.amount_paid).toLocaleString()}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => generateSingleInvoicePDF(t, clientInfo)}
                            className="inline-flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-[#3428f8] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            title="Download PDF invoice for this transaction"
                          >
                            <FileDown size={11} className="text-[#3428f8]" />
                            Invoice
                          </button>
                          {t.payment_receipt_url && (
                            <a 
                              href={t.payment_receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Receipt <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-[#222] flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedClientHistory(null)}
                    className="bg-[#1a1a1a] hover:bg-[#252525] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-[#222]"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
