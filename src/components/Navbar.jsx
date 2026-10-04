import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext, SplashContext } from '../App';
import { useAuth, checkIsAdmin } from '../context/AuthContext';

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
    <path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
    <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/>
  </svg>
);

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useContext(ThemeContext);
  const { isSplashActive } = useContext(SplashContext);
  const { user, profile, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Services', path: '/services' },
    { name: 'Work', path: '/work' },
  ];

  return (
    <>
      <nav
        className={`fixed z-[100] transition-all duration-700 ease-in-out left-1/2 -translate-x-1/2 ${
          isScrolled 
            ? 'top-4 w-[95%] max-w-[850px] py-2 rounded-3xl shadow-2xl' 
            : 'top-0 w-full max-w-[100vw] py-3 rounded-none'
        }`}
        style={isScrolled ? {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)'
        } : {}}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center gap-6">
          {/* Logo */}
          <Link to="/" className={`flex items-center justify-start z-50 relative transition-all duration-700 ease-in-out ${isScrolled ? 'w-10 h-10 md:w-12 md:h-12' : 'w-40 h-20 md:w-60 md:h-[5.5rem]'}`} onClick={() => setMobileMenuOpen(false)}>
            {/* Full Text Logo */}
            <motion.img 
              layoutId="brand-logo"
              src={theme === 'dark' ? "/logo-dark.png" : "/logo-light.png"} 
              alt="Outliers Media" 
              className="absolute left-0 w-full h-full object-contain origin-left"
              animate={{ opacity: isScrolled ? 0 : 1, scale: isScrolled ? 0.75 : 1 }}
              transition={{ 
                layout: { duration: 1, ease: "easeInOut" },
                opacity: { duration: 0.7 },
                scale: { duration: 0.7 }
              }}
            />
            {/* Icon Logo */}
            <img 
              src="/logo-icon.png" 
              alt="Outliers Media Icon" 
              className={`absolute left-0 w-full h-full object-contain transition-all duration-700 ease-in-out origin-left ${isScrolled ? 'opacity-100 scale-100' : 'opacity-0 scale-125'}`}
            />
          </Link>

          {/* Desktop Links */}
          <motion.div 
            className="hidden md:flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: isSplashActive ? 0 : 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <div className="flex gap-6 items-center mr-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`text-sm tracking-wide uppercase transition-colors hover:text-accent ${
                    location.pathname === link.path ? 'text-primary font-bold' : 'text-muted font-semibold'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {user ? (
              isAdmin ? (
                <Link
                  to="/admin"
                  className="bg-accent text-[#EEF2FF] px-5 py-2.5 text-xs tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 shadow-[0_0_15px_var(--accent-glow)] rounded-2xl flex items-center gap-2 border-2 border-transparent"
                >
                  Command Center
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="bg-[#3428f8] text-[#EEF2FF] px-5 py-2.5 text-xs tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 shadow-[0_0_15px_var(--accent-glow)] rounded-2xl flex items-center gap-2"
                >
                  Dashboard
                </Link>
              )
            ) : (
              <Link
                to="/auth"
                className="bg-[#3428f8] text-[#EEF2FF] px-5 py-2.5 text-xs tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 shadow-[0_0_15px_var(--accent-glow)] rounded-2xl"
              >
                Sign In
              </Link>
            )}

            {/* Theme Toggle Button */}
            {theme === 'dark'
              ? <button className="theme-toggle flex items-center justify-center ml-2" onClick={() => setTheme('light')}><SunIcon /></button>
              : <button className="theme-toggle flex items-center justify-center ml-2" onClick={() => setTheme('dark')}><MoonIcon /></button>
            }
          </motion.div>

          {/* Mobile Hamburger (Text Based) */}
          <motion.button
            className="md:hidden z-50 text-primary font-semibold text-sm uppercase tracking-wide hover:text-accent transition-colors flex items-center justify-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            initial={{ opacity: 0 }}
            animate={{ opacity: isSplashActive ? 0 : 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            {mobileMenuOpen ? <CloseIcon /> : 'Menu'}
          </motion.button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center gap-8 md:hidden" 
            style={{ zIndex: 90, backgroundColor: theme === 'dark' ? 'rgba(8, 7, 15, 0.95)' : 'rgba(255, 255, 255, 0.95)' }}
          >
            {/* Decorative Background Grid */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
            
            <div className="relative z-10 flex flex-col items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-3xl font-serif text-primary hover:text-accent transition-all duration-300 hover:scale-105"
                >
                  {link.name}
                </Link>
              ))}
              
              {user ? (
                isAdmin ? (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-accent text-[#EEF2FF] px-8 py-4 text-sm tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 rounded-2xl"
                  >
                    Command Center
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-[#3428f8] text-[#EEF2FF] px-8 py-4 text-sm tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 rounded-2xl"
                  >
                    Go to Dashboard
                  </Link>
                )
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-[#3428f8] text-[#EEF2FF] px-8 py-4 text-sm tracking-wide uppercase font-bold hover:opacity-80 transition-all duration-300 hover:scale-105 rounded-2xl"
                >
                  Sign In
                </Link>
              )}

              <button 
                className="theme-toggle flex items-center justify-center mt-2" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
