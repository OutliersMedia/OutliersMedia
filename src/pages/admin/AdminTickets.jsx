import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabaseClient';
import { MessageSquare, Clock, CheckCircle, Search, Send, BellOff, ArrowLeft } from 'lucide-react';

export default function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [filter, setFilter] = useState('All');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchTickets();

    const subscription = supabase
      .channel('admin_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    // Fetch all tickets. 
    // Note: We also want the client profile info, so we'd join if possible, but since client_id references auth.users, 
    // we can fetch profiles separately or rely on a view. 
    // Since we can't join auth.users easily, we'll fetch tickets, then fetch profiles for those client_ids.
    const { data: ticketData, error: ticketErr } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: true });

    if (!ticketErr && ticketData) {
      // Group into threads by order_id + category
      const threadMap = {};
      ticketData.forEach(t => {
        const key = `${t.order_id}-${t.category}`;
        if (!threadMap[key]) {
          threadMap[key] = {
            id: key,
            order_id: t.order_id,
            client_id: t.client_id,
            category: t.category,
            messages: [],
            status: t.status,
            created_at: t.created_at,
            updated_at: t.created_at
          };
        }
        threadMap[key].messages.push(t);
        threadMap[key].updated_at = t.created_at;
        // The thread status is driven by the most recent action, but we'll prioritize any 'open' status in the thread.
        if (t.status !== 'resolved') {
          threadMap[key].status = t.status;
        }
      });
      
      const threads = Object.values(threadMap).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      
      // Get profiles for these clients
      const clientIds = [...new Set(threads.map(t => t.client_id))];
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('auth_id, name, business_type').in('auth_id', clientIds);
        const profileMap = {};
        if (profiles) {
          profiles.forEach(p => profileMap[p.auth_id] = p);
        }
        threads.forEach(t => {
          t.client = profileMap[t.client_id] || { name: 'Unknown Client', business_type: 'Unknown' };
        });
      }

      setTickets(threads);
      
      if (selectedThread) {
        const updatedSelected = threads.find(t => t.id === selectedThread.id);
        if (updatedSelected) setSelectedThread(updatedSelected);
      }
    }
    setLoading(false);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedThread) return;
    setReplying(true);

    const { error } = await supabase.from('support_tickets').insert({
      client_id: selectedThread.client_id,
      order_id: selectedThread.order_id,
      category: selectedThread.category,
      message: replyMessage.trim(),
      sender: 'admin',
      status: 'open'
    });

    if (!error) {
      setReplyMessage('');
      fetchTickets();
    } else {
      alert("Error sending message: " + error.message);
    }
    setReplying(false);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedThread) return;
    
    // Update all messages in this thread to the new status
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('order_id', selectedThread.order_id)
      .eq('category', selectedThread.category);

    if (!error) {
      fetchTickets();
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filter === 'All') return true;
    if (filter === 'Open') return t.status === 'open';
    if (filter === 'Snoozed') return t.status === 'snoozed';
    if (filter === 'Closed') return t.status === 'resolved';
    return true;
  });

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
      
      {/* Left Pane: Queue */}
      <div className={`w-full md:w-1/3 bg-[#0a0a0a] border-r border-[#222] flex flex-col ${selectedThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-[#222]">
          <h2 className="text-xl font-serif text-white mb-4 flex items-center justify-between">
            Ticket Queue
            <span className="bg-[#3428f8] text-white text-xs px-2 py-1 rounded-md">{tickets.filter(t => t.status === 'open').length}</span>
          </h2>
          
          <div className="flex gap-2 bg-[#111] p-1 rounded-xl mb-4">
            {['All', 'Open', 'Snoozed', 'Closed'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-2 rounded-lg transition-all ${filter === f ? 'bg-[#222] text-white shadow-sm' : 'text-[#666] hover:text-[#aaa]'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" 
              placeholder="Search ID, Client..."
              className="w-full bg-[#111] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          {filteredTickets.map(thread => {
            const lastMsg = thread.messages[thread.messages.length - 1];
            return (
              <div 
                key={thread.id} 
                onClick={() => setSelectedThread(thread)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedThread?.id === thread.id ? 'bg-[#3428f8]/10 border-[#3428f8] shadow-[0_0_15px_rgba(52,40,248,0.1)]' : 'bg-[#151515] border-[#222] hover:border-[#444]'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white bg-[#222] px-2 py-1 rounded-md uppercase tracking-wider">{thread.order_id}</span>
                  <span className="text-[10px] text-[#666] font-bold uppercase">{new Date(thread.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <h4 className="text-white text-sm font-semibold mb-1 truncate">{thread.client?.name || 'Client'}</h4>
                <p className="text-[#888] text-xs font-medium mb-3 truncate">{thread.category}</p>
                <div className="flex items-center gap-2">
                  {thread.status === 'open' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                  {thread.status === 'snoozed' && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                  {thread.status === 'resolved' && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                  <span className="text-[#666] text-xs truncate max-w-[180px]">{lastMsg.message}</span>
                </div>
              </div>
            );
          })}
          {filteredTickets.length === 0 && (
            <p className="text-[#666] text-center text-sm mt-10">No tickets found.</p>
          )}
        </div>
      </div>

      {/* Right Pane: Thread */}
      <div className={`w-full md:w-2/3 flex-col bg-[#0a0a0a] ${selectedThread ? 'flex' : 'hidden md:flex'}`}>
        {selectedThread ? (
          <>
            <div className="p-6 border-b border-[#222] bg-[#111] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedThread(null)} className="md:hidden text-[#888] hover:text-white">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 className="text-lg font-serif text-white">{selectedThread.category}</h3>
                  <p className="text-xs text-[#888] font-bold uppercase tracking-widest mt-1">
                    {selectedThread.order_id} • {selectedThread.client?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedThread.status !== 'resolved' && (
                  <>
                    <button onClick={() => handleStatusChange('snoozed')} className="p-2 bg-[#222] hover:bg-[#333] text-[#888] hover:text-yellow-400 rounded-lg transition-colors tooltip" title="Snooze">
                      <Clock size={16} />
                    </button>
                    <button onClick={() => handleStatusChange('resolved')} className="p-2 bg-[#222] hover:bg-[#333] text-[#888] hover:text-green-400 rounded-lg transition-colors tooltip" title="Mark Resolved">
                      <CheckCircle size={16} />
                    </button>
                  </>
                )}
                {selectedThread.status === 'resolved' && (
                  <button onClick={() => handleStatusChange('open')} className="p-2 bg-[#222] hover:bg-[#333] text-[#888] hover:text-red-400 rounded-lg transition-colors tooltip" title="Re-open">
                    <CheckCircle size={16} className="text-green-500" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-[#050505]">
              {selectedThread.messages.map(msg => (
                <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.sender === 'admin' ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-1 mx-1">
                    {msg.sender === 'admin' ? 'You' : 'Client'} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <div className={`p-4 rounded-2xl text-sm ${msg.sender === 'admin' ? 'bg-[#3428f8] text-white rounded-tr-sm' : 'bg-[#1a1a1a] border border-[#222] text-[#ddd] rounded-tl-sm'}`}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#222] bg-[#111]">
              <form onSubmit={handleReply} className="flex gap-3">
                <input 
                  type="text" 
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={selectedThread.status === 'resolved' ? "Ticket resolved. Type to re-open..." : "Type your reply..."}
                  className="flex-1 bg-[#0a0a0a] border border-[#222] p-4 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={replying || !replyMessage.trim()}
                  className="bg-[#3428f8] text-white p-4 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {replying ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block"></span> : <Send size={20} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-[#111] border border-[#222] rounded-full flex items-center justify-center text-[#444] mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-xl font-serif text-white mb-2">No Thread Selected</h3>
            <p className="text-[#666] text-sm max-w-xs">Select a ticket from the queue on the left to view the conversation and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
}
