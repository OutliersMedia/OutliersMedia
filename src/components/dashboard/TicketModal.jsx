import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const ticketCategories = [
  "⏰ Posting Delay / Schedule Query",
  "🎨 Design / Graphics Revision",
  "🎬 Reel Editing Feedback",
  "🌐 Website Update Request",
  "💬 WhatsApp / Content Request",
  "Other"
];

export default function TicketModal({ isOpen, onClose, order, onTicketCreated }) {
  const { user } = useAuth();
  const [category, setCategory] = useState(ticketCategories[0]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        client_id: user.id,
        order_id: order.order_id,
        category,
        message
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setLoading(false);
      onTicketCreated(data);
      setMessage('');
      onClose();
      // Optional: Add webhook/email notification logic to outliersmedia22@gmail.com here
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-20 pb-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        ></motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-base border border-themeborder rounded-3xl shadow-2xl relative z-10 w-full max-w-lg p-6 md:p-8"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-muted hover:text-primary transition-colors"
          >
            <X size={24} />
          </button>

          <h2 className="text-2xl font-serif text-primary mb-6">Raise a Ticket</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger text-danger text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Issue Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl appearance-none"
              >
                {ticketCategories.map((cat, i) => (
                  <option key={i} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Details</label>
              <textarea 
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or feedback..."
                className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl resize-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !message.trim()}
              className="w-full bg-[#3428f8] text-[#EEF2FF] p-4 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-[1.02] rounded-xl shadow-[0_0_20px_var(--accent-glow)] mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
              Submit Ticket
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
