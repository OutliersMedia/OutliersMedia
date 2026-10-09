import { useEffect, useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
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
import { AuthProvider, useAuth, checkIsAdmin, checkIsTester } from './context/AuthContext';

export const ThemeContext = createContext();
export const SplashContext = createContext();

import GlobalPhoneLock from './components/GlobalPhoneLock';
import GlobalNotificationLock from './components/GlobalNotificationLock';
import AdminTickets from './pages/admin/AdminTickets';
import AdminClients from './pages/admin/AdminClients';
import AdminFinances from './pages/admin/AdminFinances';
import AdminDeliverables from './pages/admin/AdminDeliverables';
import AdminNotifications from './pages/admin/AdminNotifications';

// This component acts as a global lock for clients missing phone or notification permissions.
function GlobalOnboardingGuard({ children }) {
  return (
    <>
      {children}
      <GlobalPhoneLock />
      <GlobalNotificationLock />
    </>
  );
}

// This component guards /admin routes so only authorized admins and testers can access them,
// and ensures admins/testers are directed to Command Center, not client dashboard
function AdminEnforcer({ children }) {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester, loading } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));
  const canAccessAdmin = isAdmin || isTester;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    
    // Protect /admin routes from unauthorized access
    if (location.pathname.startsWith('/admin')) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (!canAccessAdmin) {
        navigate('/dashboard', { replace: true });
      }
    } else if (location.pathname === '/dashboard' && (isAdmin || isTester)) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, isTester, canAccessAdmin, loading, location.pathname, navigate]);

  return <>{children}</>;
}

function SmoothScrollWrapper({ children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) return;

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

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    const handleScrollToTop = () => {
      lenis.scrollTo(0, { duration: 1.2 });
    };
    window.addEventListener('scrollToTop', handleScrollToTop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scrollToTop', handleScrollToTop);
      lenis.destroy();
    };
  }, [isAdmin]);

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
                        <Route path="notifications" element={<AdminNotifications />} />
                        <Route path="email" element={<Navigate to="/admin/notifications" replace />} />
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
