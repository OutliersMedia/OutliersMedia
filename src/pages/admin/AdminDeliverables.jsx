import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Search, Image as ImageIcon, Video, Layout, Plus, CheckCircle, Clock } from 'lucide-react';

export default function AdminDeliverables() {
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  
  // Form State
  const [postType, setPostType] = useState('static');
  const [postTitle, setPostTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Ensure postType is always valid for the selected client's plan
  useEffect(() => {
    if (selectedClient?.latestOrder) {
      if (postType === 'poster' && selectedClient.latestOrder.posters_total === 0) {
        setPostType('static');
      }
    }
  }, [selectedClient, postType]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all profiles EXCEPT admins (Outliers)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    // Fetch all orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch all post logs
    const { data: posts } = await supabase
      .from('posts_log')
      .select('*')
      .order('published_at', { ascending: false });

    if (profiles) {
      const enrichedClients = profiles.map(profile => {
        // Find most recent order for this client
        const clientOrders = orders ? orders.filter(o => o.client_id === profile.auth_id) : [];
        const activeOrPending = clientOrders.find(o => ['active', 'pending', 'paused'].includes(o.status));
        const latestOrder = activeOrPending || clientOrders[0] || null;
        
        let calculatedStatus = 'lead'; // Default for users with 0 orders
        
        if (latestOrder) {
          calculatedStatus = latestOrder.status; // 'active', 'pending', 'paused', 'cancelled'
          
          // Check for expired if it's active
          if (calculatedStatus === 'active' && latestOrder.created_at) {
            const createdDate = new Date(latestOrder.created_at);
            const expiryDate = new Date(createdDate);
            expiryDate.setDate(expiryDate.getDate() + 30);
            
            if (new Date() > expiryDate) {
              calculatedStatus = 'expired';
            }
          }
        }

        // Calculate Deliverables Progress
        let progress = { static: 0, reels: 0, posters: 0, total_delivered: 0, total_quota: 0 };
        let clientPosts = [];

        if (latestOrder) {
          clientPosts = posts ? posts.filter(p => p.order_id === latestOrder.order_id) : [];
          const staticDelivered = clientPosts.filter(p => p.post_type === 'static').length;
          const reelsDelivered = clientPosts.filter(p => p.post_type === 'reel').length;
          const postersDelivered = clientPosts.filter(p => p.post_type === 'poster').length;

          progress = {
            static: staticDelivered,
            reels: reelsDelivered,
            posters: postersDelivered,
            total_delivered: staticDelivered + reelsDelivered + postersDelivered,
            total_quota: latestOrder.static_posts_total + latestOrder.reels_total + latestOrder.posters_total
          };
        }

        return {
          ...profile,
          latestOrder,
          calculatedStatus,
          posts: clientPosts,
          progress
        };
      });

      setClientsList(enrichedClients);
      
      // If a client is already selected, update their data to reflect new posts
      if (selectedClient) {
        const updated = enrichedClients.find(c => c.auth_id === selectedClient.auth_id);
        if (updated) setSelectedClient(updated);
      }
    }
    setLoading(false);
  };

  const handleAddDeliverable = async (e) => {
    e.preventDefault();
    if (!selectedClient?.latestOrder || !postTitle) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('posts_log')
      .insert([
        {
          order_id: selectedClient.latestOrder.order_id,
          post_type: postType,
          title: postTitle
        }
      ]);

    if (error) {
      alert("Error saving deliverable: " + error.message);
    } else {
      setPostTitle('');
      await fetchData(); // Refresh everything
    }
    
    setIsSubmitting(false);
  };

  const filteredClients = clientsList.filter(c => {
    return c.name?.toLowerCase().includes(search.toLowerCase()) ||
           c.email?.toLowerCase().includes(search.toLowerCase()) ||
           (c.latestOrder && c.latestOrder.order_id.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 min-h-[calc(100vh-140px)] shadow-2xl flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Deliverables</h2>
          <p className="text-[#888] text-sm">Track monthly quotas and log published posts for all clients.</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input 
            type="text" 
            placeholder="Search clients or orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-10 text-white text-sm rounded-xl focus:border-[#3428f8] outline-none transition-colors"
          />
        </div>
      </div>

      {loading && clientsList.length === 0 ? (
        <div className="flex justify-center items-center flex-1">
          <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          
          {/* Left Panel: All Clients List */}
          <div className="w-full lg:w-1/3 flex flex-col gap-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredClients.length === 0 ? (
              <div className="text-[#666] text-sm p-4 text-center bg-[#0a0a0a] rounded-xl border border-[#222]">
                No clients found.
              </div>
            ) : (
              filteredClients.map(client => (
                <button
                  key={client.auth_id}
                  onClick={() => setSelectedClient(client)}
                  className={`text-left p-4 rounded-xl border transition-all ${selectedClient?.auth_id === client.auth_id ? 'bg-[#3428f8]/10 border-[#3428f8] shadow-[0_0_15px_rgba(52,40,248,0.2)]' : 'bg-[#0a0a0a] border-[#222] hover:border-[#444]'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-white font-bold text-sm">{client.name || 'Unknown'}</h4>
                      <p className="text-[#666] text-[10px] font-mono">{client.latestOrder?.order_id || 'No Order ID'}</p>
                    </div>
                    <div>
                      {client.calculatedStatus === 'active' && <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Active</span>}
                      {client.calculatedStatus === 'pending' && <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Pending</span>}
                      {client.calculatedStatus === 'paused' && <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Paused</span>}
                      {client.calculatedStatus === 'expired' && <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Expired</span>}
                      {client.calculatedStatus === 'cancelled' && <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Cancelled</span>}
                      {client.calculatedStatus === 'lead' && <span className="bg-[#222] text-[#888] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Lead</span>}
                    </div>
                  </div>
                  
                  {client.latestOrder ? (
                    <>
                      <p className="text-[#888] text-xs mb-3">{client.latestOrder.plan_name}</p>
                      
                      {/* Mini Progress Bar */}
                      <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#3428f8] h-full" 
                          style={{ width: `${client.progress.total_quota > 0 ? (client.progress.total_delivered / client.progress.total_quota) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 text-[#555] uppercase font-bold tracking-wider">
                        <span>{client.progress.total_delivered} Delivered</span>
                        <span>{client.progress.total_quota} Quota</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[#555] text-xs italic mt-2">No Plan Selected</p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Right Panel: Deliverable Management */}
          <div className="w-full lg:w-2/3 bg-[#0a0a0a] border border-[#222] rounded-xl flex flex-col h-[600px]">
            {selectedClient ? (
              selectedClient.latestOrder ? (
                <>
                  <div className="p-6 border-b border-[#222]">
                    <h3 className="text-xl font-serif text-white mb-1">Deliverables for {selectedClient.name}</h3>
                    <p className="text-[#888] text-xs font-mono">{selectedClient.latestOrder.order_id} • {selectedClient.latestOrder.plan_name}</p>
                    
                    {/* Quota Progress */}
                    <div className={`grid gap-4 mt-6 ${selectedClient.latestOrder.posters_total > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      
                      <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon size={14} className="text-[#3428f8]" />
                          <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Static Posts</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-serif text-white">{selectedClient.progress.static}</span>
                          <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.static_posts_total}</span>
                        </div>
                      </div>
                      
                      <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                        <div className="flex items-center gap-2 mb-2">
                          <Video size={14} className="text-pink-500" />
                          <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Reels</span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-serif text-white">{selectedClient.progress.reels}</span>
                          <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.reels_total}</span>
                        </div>
                      </div>
                      
                      {selectedClient.latestOrder.posters_total > 0 && (
                        <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                          <div className="flex items-center gap-2 mb-2">
                            <Layout size={14} className="text-green-500" />
                            <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Posters</span>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-2xl font-serif text-white">{selectedClient.progress.posters}</span>
                            <span className="text-[#555] text-sm mb-1">/ {selectedClient.latestOrder.posters_total}</span>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    
                    {/* Form */}
                    <div className="w-full md:w-1/2 p-6 border-r border-[#222] flex flex-col">
                      <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-4">Log New Delivery</h4>
                      
                      <form onSubmit={handleAddDeliverable} className="flex flex-col gap-4 flex-1">
                        <div>
                          <label className="block text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2">Post Type</label>
                          <select 
                            value={postType}
                            onChange={(e) => setPostType(e.target.value)}
                            className="w-full bg-[#111] border border-[#333] text-white p-3 rounded-xl outline-none focus:border-[#3428f8] text-sm transition-colors"
                          >
                            <option value="static">Static Post</option>
                            <option value="reel">Reel / Short</option>
                            {selectedClient.latestOrder.posters_total > 0 && <option value="poster">Poster</option>}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2">Title / Description</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Diwali Promotion Design"
                            value={postTitle}
                            onChange={(e) => setPostTitle(e.target.value)}
                            required
                            className="w-full bg-[#111] border border-[#333] text-white p-3 rounded-xl outline-none focus:border-[#3428f8] text-sm transition-colors"
                          />
                        </div>

                        <div className="mt-auto pt-4">
                          <button 
                            type="submit"
                            disabled={isSubmitting || !postTitle}
                            className="w-full bg-[#3428f8] hover:bg-[#2a1fd1] disabled:bg-[#3428f8]/50 text-white p-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(52,40,248,0.3)] flex justify-center items-center gap-2"
                          >
                            {isSubmitting ? (
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            ) : (
                              <><Plus size={16} /> Log Deliverable</>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* History */}
                    <div className="w-full md:w-1/2 p-6 overflow-y-auto custom-scrollbar">
                      <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-4">Delivery History</h4>
                      
                      <div className="flex flex-col gap-3">
                        {selectedClient.posts.length === 0 ? (
                          <div className="text-center p-6 text-[#555] text-xs">
                            No posts logged yet for this billing cycle.
                          </div>
                        ) : (
                          selectedClient.posts.map(post => (
                            <div key={post.id} className="bg-[#111] border border-[#222] p-3 rounded-xl flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${post.post_type === 'static' ? 'bg-[#3428f8]/10 text-[#3428f8]' : post.post_type === 'reel' ? 'bg-pink-500/10 text-pink-500' : 'bg-green-500/10 text-green-500'}`}>
                                {post.post_type === 'static' && <ImageIcon size={16} />}
                                {post.post_type === 'reel' && <Video size={16} />}
                                {post.post_type === 'poster' && <Layout size={16} />}
                              </div>
                              <div>
                                <p className="text-white text-sm">{post.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[#666] text-[9px] font-bold uppercase tracking-widest">{post.post_type}</span>
                                  <span className="text-[#444] text-[9px] flex items-center gap-1"><Clock size={10} /> {new Date(post.published_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-12">
                  <CheckCircle size={48} className="text-[#333] mb-4" />
                  <h3 className="text-white font-serif text-2xl mb-2">{selectedClient.name} has no plan.</h3>
                  <p className="text-[#666] text-sm">This client is a lead and has not activated a subscription plan yet.</p>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-12">
                <CheckCircle size={48} className="text-[#222] mb-4" />
                <h3 className="text-white font-serif text-2xl mb-2">Select a Client</h3>
                <p className="text-[#666] text-sm">Choose a client from the sidebar to manage and log their deliverables.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
