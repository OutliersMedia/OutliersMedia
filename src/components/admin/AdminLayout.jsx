import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth, checkIsAdmin, checkIsTester } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, ImagePlus, Landmark, Ticket, Bell, LogOut, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function AdminLayout() {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester, loading, signOut } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  const canAccessAdmin = isAdmin || isTester;
  const location = useLocation();
  const [openTicketsCount, setOpenTicketsCount] = useState(0);

  useEffect(() => {
    if (canAccessAdmin) {
      fetchTicketCount();
      
      // Subscribe to new tickets to update the badge live
      const subscription = supabase
        .channel('support_tickets_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
          fetchTicketCount();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [canAccessAdmin]);

  const fetchTicketCount = async () => {
    const { count } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    setOpenTicketsCount(count || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3428f8]"></span>
      </div>
    );
  }

  if (!user || !canAccessAdmin) {
    return <Navigate to="/auth" replace />;
  }

  const navItems = [
    { name: 'OVERVIEW', path: '/admin', icon: LayoutDashboard },
    { name: 'CLIENTS', path: '/admin/clients', icon: Users },
    { name: 'DELIVERABLES', path: '/admin/deliverables', icon: ImagePlus },
    { name: 'FINANCES', path: '/admin/finances', icon: Landmark },
    { name: 'TICKETS', path: '/admin/tickets', icon: Ticket },
    { name: 'NOTIFICATIONS', path: '/admin/notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#f8f9fa] flex flex-col font-sans selection:bg-[#3428f8] selection:text-white">
      {/* Admin Navbar */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-[#1f1f1f] z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/admin" className="flex items-center gap-3 group">
            <img src="/icon.png" alt="Outliers Media" className="h-8 w-8 object-contain transition-transform group-hover:scale-110" />
            <span className="font-serif text-xl tracking-wide">COMMAND CENTER</span>
            {isTester && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Tester Mode
              </span>
            )}
          </Link>
          
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                    isActive 
                      ? 'bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20 shadow-[0_0_15px_rgba(52,40,248,0.15)]' 
                      : 'text-[#888] hover:text-white hover:bg-[#1f1f1f]'
                  }`}
                >
                  <item.icon size={14} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/admin/tickets" className="relative p-2 text-[#888] hover:text-white transition-colors">
            <MessageSquare size={20} />
            {openTicketsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[#0a0a0a]"></span>
            )}
          </Link>
          <div className="h-6 w-px bg-[#1f1f1f]"></div>
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#888] hover:text-red-500 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-28 pb-12 px-6">
        {isTester && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between text-amber-400 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span className="font-bold uppercase tracking-wider">Tester Access:</span>
              <span>You are viewing Command Center with a Tester account. Use this environment to test admin and operational workflows.</span>
            </div>
            <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 uppercase">Role: Tester</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
