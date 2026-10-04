import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, checkIsAdmin } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { packages } from '../utils/data';
import FadeSection from './FadeSection';

export default function Packages() {
  const [selectedPlanId, setSelectedPlanId] = useState("Growth");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, profile, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const navigate = useNavigate();

  const handleSelectClick = (id) => {
    setSelectedPlanId(id);
    setIsModalOpen(true);
  };

  const selectedPlan = packages.find(p => p.id === selectedPlanId);

  return (
    <>
      <FadeSection className="py-32 px-6 lg:px-12 bg-section border-y border-themeborder relative overflow-hidden min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="mb-20">
            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-4 block">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-serif text-primary">Transparent Packages</h2>
          </div>

          <div className="flex flex-col gap-8">
            {packages.map((pkg) => {
              const isSelected = pkg.id === selectedPlanId;
              return (
                <div 
                  key={pkg.id} 
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-8 p-10 lg:p-16 transition-all duration-300 rounded-3xl cursor-pointer ${
                    isSelected 
                      ? 'border-2 border-accent shadow-2xl transform hover:-translate-y-2' 
                      : 'border border-glass-border shadow-sm transform hover:-translate-y-1'
                  }`}
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(16px)'
                  }}
                  onClick={() => setSelectedPlanId(pkg.id)}
                >
                  <div className="lg:col-span-3 flex flex-col justify-start">
                    <h3 className="text-3xl font-serif mb-2 text-primary">{pkg.name}</h3>
                    {pkg.id === "Growth" && (
                      <span className="text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2 px-3 py-1 rounded-full w-max" style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                        Most Selected
                      </span>
                    )}
                  </div>
                  
                  <div className="lg:col-span-3 flex flex-col justify-start">
                    <div className="text-4xl font-serif text-primary">{pkg.price}</div>
                    <div className="text-sm mt-1 font-medium text-muted">{pkg.frequency}</div>
                  </div>

                  <div className="lg:col-span-4 flex flex-col justify-start">
                    <ul className="flex flex-col gap-4">
                      {pkg.features.map((feat, fIdx) => (
                        <li key={fIdx} className="border-b border-themeborder pb-3 text-sm font-medium flex items-start gap-3 text-body">
                          <span className={`text-lg leading-none font-bold ${isSelected ? 'text-white' : 'text-[#2d23c9]'}`}>+</span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="lg:col-span-2 flex items-start lg:justify-end mt-6 lg:mt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectClick(pkg.id);
                      }}
                      className={`px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 w-full lg:w-auto text-center rounded-2xl border-2 ${
                        isSelected 
                          ? 'bg-[#2d23c9] border-[#2d23c9] text-white hover:bg-transparent hover:text-[#2d23c9]' 
                          : 'bg-transparent border-[#2d23c9] text-[#2d23c9] hover:bg-[#2d23c9] hover:text-white'
                      }`}
                    >
                      Select Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeSection>

      {/* Selection Modal via Portal to escape stacking context */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && selectedPlan && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
                className="bg-glass border border-glass-border backdrop-blur-xl p-10 rounded-3xl max-w-md w-full shadow-2xl relative"
                onClick={e => e.stopPropagation()}
              >
                <button 
                  className="absolute top-6 right-6 text-muted hover:text-primary transition-colors"
                  onClick={() => setIsModalOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <h3 className="text-3xl font-serif text-primary mb-2">{selectedPlan.name}</h3>
                <div className="text-2xl font-serif text-primary mb-6">{selectedPlan.price}<span className="text-sm text-muted font-sans">{selectedPlan.frequency}</span></div>
                <ul className="flex flex-col gap-3 mb-8">
                  {selectedPlan.features.map((feat, idx) => (
                    <li key={idx} className="text-sm font-medium flex items-start gap-3 text-body">
                      <span className="text-[#2d23c9] font-bold text-lg leading-none">+</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    if (isAdmin) {
                      navigate('/admin');
                    } else {
                      navigate(`/dashboard?plan=${selectedPlan.id.toLowerCase()}`);
                    }
                  }}
                  className="w-full bg-[#2d23c9] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#3c06cf] transition-colors text-sm"
                >
                  Activate This Plan
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
