import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useContext } from 'react';
import { SplashContext } from '../App';
import FadeSection from './FadeSection';
import LiveGraph from './LiveGraph';

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const { isSplashActive } = useContext(SplashContext);
  const animState = isSplashActive ? "hidden" : "visible";

  const headlineVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.2,
        duration: 0.8,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
    },
  };

  return (
    <FadeSection className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-6 lg:px-12 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
      
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left: Copy */}
        <div className="flex flex-col items-start z-10">
          
          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-serif text-primary leading-[1.1] mb-8 tracking-tight"
            initial="hidden"
            animate={animState}
            variants={headlineVariants}
          >
            <motion.span variants={wordVariants} className="block">Your Brand.</motion.span>
            <motion.span variants={wordVariants} className="block italic text-accent mt-2">Louder.</motion.span>
          </motion.h1>
          <motion.p 
            className="text-lg md:text-xl text-body max-w-lg mb-12 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: isSplashActive ? 0 : 1 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            We help local businesses in Chandigarh, Panchkula, and Mohali dominate their market on Instagram. No cookie-cutter templates, just pure engagement.
          </motion.p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: isSplashActive ? 0 : 1 }}
            transition={{ delay: 0.8, duration: 1 }}
          >
            <Link
              to="/contact"
              className="bg-[#3428f8] text-[#EEF2FF] px-8 py-4 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-105 text-center shadow-lg rounded-2xl"
              style={{ boxShadow: '0 0 24px var(--accent-glow)' }}
            >
              Get a Free Audit
            </Link>
            <Link
              to="/work"
              className="bg-surface border border-themeborder text-primary px-8 py-4 text-sm font-bold uppercase tracking-widest hover:border-themeborder-hover transition-all duration-300 hover:scale-105 text-center shadow-sm rounded-2xl"
            >
              See Our Work
            </Link>
          </motion.div>
        </div>

        {/* Right: Abstract/Mockup Frame */}
        <div className="flex items-center justify-center w-full">
          <motion.div 
            className="relative w-full max-w-[80%] lg:max-w-[70%] xl:max-w-[65%] h-[420px] border border-themeborder bg-transparent shadow-xl p-5 flex flex-col gap-4 overflow-hidden rounded-3xl mx-auto"
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 50 }}
            animate={{ opacity: isSplashActive ? 0 : 1, x: isSplashActive ? (shouldReduceMotion ? 0 : 50) : 0 }}
            transition={{ delay: 0.4, duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-accent"></div>
            {/* Skeleton UI for Instagram Post */}
            <div className="flex items-center gap-3 border-b border-themeborder pb-4 mt-2">
              <div className="w-10 h-10 bg-raised border border-accent-border rounded-full" />
              <div className="flex flex-col gap-2">
                <div className="w-24 h-3 bg-raised border border-themeborder rounded-md" />
                <div className="w-16 h-2 bg-raised border border-themeborder rounded-md" />
              </div>
            </div>
            <div className="w-full flex-grow bg-transparent border border-themeborder relative overflow-hidden flex items-center justify-center rounded-xl p-2">
              <LiveGraph />
            </div>
            <div className="flex flex-col gap-3 pt-4 border-t border-themeborder">
              <div className="w-full h-3 bg-raised border border-themeborder rounded-md" />
              <div className="w-3/4 h-3 bg-raised border border-themeborder rounded-md" />
              <div className="w-1/2 h-3 bg-raised border border-themeborder rounded-md" />
            </div>
            <div className="absolute -bottom-12 -right-12 pointer-events-none transform rotate-12" style={{ opacity: 0.06 }}>
              <img src="/icon.png" alt="Outliers Media 3D Icon" className="w-[300px] h-[300px] object-contain" />
            </div>
          </motion.div>
        </div>
      </div>
    </FadeSection>
  );
}
