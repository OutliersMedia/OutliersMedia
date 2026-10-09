import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Video, Image as ImageIcon, Layout, Sparkles, Clock, X, ChevronRight } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

export default function NotificationBell({ user, order }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications from both `notifications` table and `posts_log`
  const fetchAllNotifications = async () => {
    setLoading(true);
    const combined = [];

    // 1. Fetch from notifications table (custom alerts & broadcasts)
    try {
      if (user?.id) {
        const { data: dbNotifs } = await supabase
          .from('notifications')
          .select('*')
          .or(`user_id.eq.${user.id},is_global.eq.true`)
          .order('created_at', { ascending: false })
          .limit(30);

        if (dbNotifs) {
          dbNotifs.forEach(n => {
            combined.push({
              id: `db_${n.id}`,
              title: n.title,
              body: n.body,
              type: n.post_type || (n.is_global ? 'broadcast' : 'system'),
              url: n.url || '/dashboard',
              created_at: n.created_at,
              isGlobal: n.is_global
            });
          });
        }
      }
    } catch (e) {
      console.warn("Notifications table query:", e);
    }

    // 2. Fetch deliverable uploads from posts_log (always persistent)
    try {
      if (order?.order_id) {
        const { data: posts } = await supabase
          .from('posts_log')
          .select('*')
          .eq('order_id', order.order_id)
          .order('published_at', { ascending: false })
          .limit(30);

        if (posts) {
          posts.forEach(p => {
            const formattedType = (p.post_type || 'post').toUpperCase();
            combined.push({
              id: `post_${p.id}`,
              title: p.title,
              body: `🚀 New ${formattedType} deliverable is live on your dashboard.`,
              type: p.post_type || 'post',
              url: '/dashboard',
              created_at: p.published_at || p.created_at,
              isGlobal: false
            });
          });
        }
      }
    } catch (e) {
      console.warn("Posts log query:", e);
    }

    // Sort newest first & remove duplicates
    const seen = new Set();
    const sorted = combined
      .filter(item => {
        const key = `${item.title}_${item.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(sorted);

    // Calculate unread count based on last seen timestamp
    const storageKey = `outliers_notif_last_seen_${user?.id || 'guest'}`;
    const lastSeenTime = localStorage.getItem(storageKey);
    if (!lastSeenTime) {
      setUnreadCount(sorted.length > 0 ? sorted.length : 0);
    } else {
      const count = sorted.filter(n => new Date(n.created_at).getTime() > new Date(lastSeenTime).getTime()).length;
      setUnreadCount(count);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllNotifications();
  }, [user?.id, order?.order_id]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      // Mark as seen
      const storageKey = `outliers_notif_last_seen_${user?.id || 'guest'}`;
      localStorage.setItem(storageKey, new Date().toISOString());
      setUnreadCount(0);
    }
  };

  const handleMarkAllRead = () => {
    const storageKey = `outliers_notif_last_seen_${user?.id || 'guest'}`;
    localStorage.setItem(storageKey, new Date().toISOString());
    setUnreadCount(0);
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'reel':
        return { label: 'Reel', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: Video };
      case 'static':
        return { label: 'Static Post', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: ImageIcon };
      case 'story':
        return { label: 'Story', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Layout };
      case 'poster':
        return { label: 'Poster', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20', icon: Sparkles };
      case 'broadcast':
        return { label: 'Announcement', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: Sparkles };
      default:
        return { label: 'Update', color: 'text-[#3428f8] bg-[#3428f8]/10 border-[#3428f8]/20', icon: Bell };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2.5 rounded-xl bg-surface/50 hover:bg-surface border border-themeborder hover:border-accent/40 text-primary transition-all flex items-center justify-center focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell size={18} className="text-muted hover:text-primary transition-colors" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#3428f8] text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(52,40,248,0.6)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#111] border border-[#222] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#222] flex items-center justify-between bg-[#0c0c0c]">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#3428f8]" />
                <h4 className="text-sm font-bold text-white tracking-wide">Notifications</h4>
                {notifications.length > 0 && (
                  <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded-full font-mono font-bold">
                    {notifications.length}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[#888] hover:text-white font-medium flex items-center gap-1 transition-colors"
                >
                  <CheckCheck size={13} /> Mark read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-[#1a1a1a] custom-scrollbar">
              {loading ? (
                <div className="p-8 text-center text-xs text-[#666]">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3428f8] inline-block mb-2"></span>
                  <p>Loading notification history...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#555] mb-3">
                    <Bell size={20} />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">No notifications yet</p>
                  <p className="text-xs text-[#666] max-w-xs">
                    Uploaded deliverables, campaign announcements, and progress updates will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const badge = getTypeBadge(item.type);
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-[#161616] transition-colors flex gap-3 items-start cursor-pointer group"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${badge.color}`}>
                        <BadgeIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-mono text-[#666] flex items-center gap-1 shrink-0">
                            <Clock size={10} />
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-white group-hover:text-[#3428f8] transition-colors truncate">
                          {item.title}
                        </h5>
                        <p className="text-[11px] text-[#888] line-clamp-2 mt-0.5 leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-[#0c0c0c] border-t border-[#222] text-center">
                <span className="text-[10px] text-[#666] uppercase font-bold tracking-widest">
                  Showing all notifications sent to your account
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
