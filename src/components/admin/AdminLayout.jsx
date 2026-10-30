import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth, checkIsAdmin, checkIsTester } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, ImagePlus, Landmark, LogOut, Menu, X, Globe, Plus, Flame, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import AddBusinessModal from './AddBusinessModal';

export default function AdminLayout() {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester, loading, signOut } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  const canAccessAdmin = isAdmin || isTester;
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addBusinessModalOpen, setAddBusinessModalOpen] = useState(false);

  // Close mobile menu automatically when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    { name: 'INFLUENCERS', path: '/admin/influencers', icon: Flame },
    { name: 'FINANCES', path: '/admin/finances', icon: Landmark },
    { name: 'WHATSAPP', path: '/admin/notifications', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#f8f9fa] flex flex-col font-sans selection:bg-[#3428f8] selection:text-white">
      {/* Admin Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 sm:h-20 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-[#1f1f1f] z-50 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 lg:gap-8 min-w-0">
          <Link to="/admin" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <img src="/icon.png" alt="Outliers Media" className="h-7 w-7 sm:h-8 sm:w-8 object-contain transition-transform group-hover:scale-110 shrink-0" />
            <span className="font-serif text-base sm:text-xl tracking-wide truncate">COMMAND CENTER</span>
            {isTester && (
              <span className="hidden sm:flex text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider items-center gap-1.5 shadow-sm shrink-0">
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
                      ? 'bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20' 
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

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setAddBusinessModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#3428f8] hover:bg-[#271bd4] text-white transition-all cursor-pointer"
            title="Enroll a new business or client"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Business</span>
            <span className="sm:hidden">Add</span>
          </button>

          <Link to="/" className="hidden sm:flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#888] hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors" title="View Live Website">
            <Globe size={15} />
            <span className="hidden xl:inline">Live Site</span>
          </Link>

          <div className="hidden lg:block h-6 w-px bg-[#1f1f1f]"></div>

          <button 
            onClick={() => signOut()}
            className="hidden lg:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#888] hover:text-red-500 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>

          {/* Three-Line Hamburger Menu Button for Phone & Tablet */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2.5 rounded-xl bg-[#141414] border border-[#262626] text-white hover:border-[#3428f8] transition-colors flex items-center justify-center"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="fixed top-16 sm:top-20 left-0 right-0 bg-[#0d0d0d] border-b border-[#222] z-40 lg:hidden px-4 py-5 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto"
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                        isActive
                          ? 'bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/30'
                          : 'text-[#aaa] hover:text-white hover:bg-[#181818] border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon size={16} />
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-[#1f1f1f] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAddBusinessModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#3428f8] text-white text-xs font-bold uppercase tracking-widest"
                >
                  <Plus size={16} />
                  Add Business / Client
                </button>

                <div className="flex items-center justify-between gap-3">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#161616] border border-[#262626] text-xs font-bold uppercase tracking-widest text-white hover:border-[#3428f8] transition-colors"
                  >
                    <Globe size={14} />
                    Live Site
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/25 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-grow pt-20 sm:pt-28 pb-24 lg:pb-12 px-3 sm:px-6 overflow-x-hidden">
        {isTester && (
          <div className="mb-4 sm:mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-400 text-xs">
            <div className="flex items-start sm:items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mt-1 sm:mt-0 shrink-0"></span>
              <div>
                <span className="font-bold uppercase tracking-wider mr-1">Tester Access:</span>
                <span>You are viewing Command Center with a Tester account.</span>
              </div>
            </div>
            <span className="self-start sm:self-auto font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 uppercase shrink-0">Role: Tester</span>
          </div>
        )}
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar for 1-Tap Tab Switching on Phones */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#1f1f1f] px-1 py-1.5 grid grid-cols-6 gap-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          const shortLabel =
            item.name === 'DELIVERABLES' ? 'Work' :
            item.name === 'INFLUENCERS' ? 'Creators' :
            item.name === 'WHATSAPP' ? 'WhatsApp' :
            item.name.charAt(0) + item.name.slice(1).toLowerCase();
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                isActive
                  ? 'bg-[#3428f8]/15 text-[#3428f8]'
                  : 'text-[#777] hover:text-white'
              }`}
            >
              <item.icon size={16} />
              <span className="text-[9px] font-bold tracking-tight mt-0.5 truncate max-w-full">
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Global Add Business Modal */}
      <AddBusinessModal 
        isOpen={addBusinessModalOpen} 
        onClose={() => setAddBusinessModalOpen(false)} 
      />
    </div>
  );
}
