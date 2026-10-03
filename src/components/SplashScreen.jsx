import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../App';
import { useContext } from 'react';

export default function SplashScreen({ onStartExit }) {
  const { theme } = useContext(ThemeContext);
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let progressInterval;
    let fallbackTimeout;

    const startExit = () => {
      setIsExiting(true);
      if (onStartExit) onStartExit();
      sessionStorage.setItem('hasSeenSplash', 'true');
    };

    try {
      if (sessionStorage.getItem('hasSeenSplash')) {
        setIsVisible(false);
        if (onStartExit) onStartExit();
        document.body.style.overflow = 'auto';
        return;
      }
    } catch {
      // ignore
    }

    document.body.style.overflow = 'hidden';

    const handleLoad = () => {
      clearInterval(progressInterval);
      clearTimeout(fallbackTimeout);
      setProgress(100);
      setTimeout(startExit, 500);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + Math.random() * 15 : prev));
      }, 100);

      window.addEventListener('load', handleLoad);
      
      // Fallback: forcefully exit after 3 seconds no matter what
      fallbackTimeout = setTimeout(() => {
        window.removeEventListener('load', handleLoad);
        handleLoad();
      }, 3000);
    }

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fallbackTimeout);
      window.removeEventListener('load', handleLoad);
      document.body.style.overflow = 'auto';
    };
  }, [onStartExit]);

  const handleExitComplete = () => {
    setIsVisible(false);
    document.body.style.overflow = 'auto';
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Solid background fades out */}
          <motion.div 
            className="absolute inset-0 bg-base pointer-events-auto"
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          <div className="flex flex-col items-center w-full max-w-sm px-8 relative z-10 pointer-events-auto">
            {/* Logo unmounts with layoutId so it can fly to Navbar */}
            <motion.img
              layoutId="brand-logo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                layout: { duration: 1, ease: "easeInOut" },
                opacity: { duration: 0.5 },
                scale: { duration: 0.5 }
              }}
              src={theme === 'dark' ? "/logo-dark.png" : "/logo-light.png"}
              alt="Outliers Media"
              className="w-40 h-20 md:w-60 md:h-[5.5rem] mb-6 object-contain"
            />
            
            {/* Text and loader fade out quickly */}
            <motion.div
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center w-full"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-primary font-medium tracking-wide mb-8"
              >
                Building Your Audience...
              </motion.div>

              <div className="w-full h-1 bg-surface rounded-full overflow-hidden relative">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-[#3428f8] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
