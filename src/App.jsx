import { useEffect, useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BackToTop from './components/BackToTop';
import SplashScreen from './components/SplashScreen';
import { LayoutGroup } from 'framer-motion';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

import Home from './pages/Home';
import Services from './pages/Services';
import Work from './pages/Work';
import Contact from './pages/Contact';

// Auth pages
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

export const ThemeContext = createContext();
export const SplashContext = createContext();

import GlobalPhoneLock from './components/GlobalPhoneLock';
import AdminTickets from './pages/admin/AdminTickets';
import AdminClients from './pages/admin/AdminClients';
import AdminFinances from './pages/admin/AdminFinances';
import AdminDeliverables from './pages/admin/AdminDeliverables';

// This component acts as a global lock for clients missing their phone number.
function GlobalOnboardingGuard({ children }) {
  // We no longer redirect to /onboarding.
  // Instead, we render the GlobalPhoneLock which overlays a mandatory modal on ANY screen.
  return (
    <>
      {children}
      <GlobalPhoneLock />
    </>
  );
}

// This component guards /admin routes so only authorized admins can access them
function AdminEnforcer({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    
    // Protect /admin routes from unauthorized access
    if (location.pathname.startsWith('/admin')) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (!isAdmin) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, loading, location.pathname, navigate]);

  return <>{children}</>;
}

function SmoothScrollWrapper({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    const handleScrollToTop = () => {
      lenis.scrollTo(0, { duration: 1.2 });
    };
    window.addEventListener('scrollToTop', handleScrollToTop);

    return () => {
      window.removeEventListener('scrollToTop', handleScrollToTop);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

import AdminLayout from './components/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [isSplashActive, setIsSplashActive] = useState(() => {
    try {
      return !sessionStorage.getItem('hasSeenSplash');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <SplashContext.Provider value={{ isSplashActive }}>
        <AuthProvider>
          <LayoutGroup>
            <SplashScreen onStartExit={() => setIsSplashActive(false)} />
            <Router>
              <GlobalOnboardingGuard>
                <ScrollToTop />
                <SmoothScrollWrapper>
                  <AdminEnforcer>
                    <Routes>
                      {/* Admin Routes (No standard Navbar/Footer) */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminOverview />} />
                        <Route path="clients" element={<AdminClients />} />
                        <Route path="deliverables" element={<AdminDeliverables />} />
                        <Route path="finances" element={<AdminFinances />} />
                        <Route path="tickets" element={<AdminTickets />} />
                        <Route path="email" element={<div className="text-white text-center p-20 text-2xl font-serif">Email Broadcaster <br/><span className="text-[#3428f8] text-sm font-sans uppercase tracking-widest">Under Construction</span></div>} />
                      </Route>

                      {/* Standard Marketing & App Routes */}
                      <Route
                        path="*"
                        element={
                          <div className="flex flex-col min-h-screen">
                            <Navbar />
                            <main className="flex-grow">
                              <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/services" element={<Services />} />
                                <Route path="/work" element={<Work />} />
                                <Route path="/contact" element={<Contact />} />
                                
                                <Route path="/auth" element={<Auth />} />
                                <Route path="/onboarding" element={<Onboarding />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                              </Routes>
                            </main>
                            <Footer />
                            <BackToTop />
                          </div>
                        }
                      />
                    </Routes>
                  </AdminEnforcer>
                </SmoothScrollWrapper>
              </GlobalOnboardingGuard>
            </Router>
          </LayoutGroup>
        </AuthProvider>
      </SplashContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
