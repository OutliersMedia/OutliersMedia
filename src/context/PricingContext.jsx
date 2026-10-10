import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth, checkIsAdmin, checkIsTester } from './AuthContext';
import { packages as defaultPackages } from '../utils/data';

const PricingContext = createContext();

const STORAGE_KEY = 'outliers_live_pricing_v1';

export const DEFAULT_PRICING_STATE = {
  starter: 3500,
  growth: 6000,
  premium: 6000,
  websiteAddon: 5000,
  activePitchClient: '',
  updatedAt: new Date().toISOString(),
  pitchHistory: [
    {
      id: 'pitch_cravory_init',
      clientName: 'The Cravory',
      planName: 'Starter Plan',
      planId: 'starter',
      pitchedPrice: 3000,
      standardPrice: 3500,
      status: 'sold',
      date: '2026-10-08T10:00:00.000Z',
      notes: 'Closed at ₹3,000 (₹1,500 advance paid)'
    }
  ]
};

export const DEFAULT_LIVE_PRICING = DEFAULT_PRICING_STATE;

let pricingChannel = null;

function getPricingChannel() {
  if (!pricingChannel) {
    pricingChannel = supabase.channel('outliers-live-pricing', {
      config: {
        broadcast: { self: true }
      }
    });
  }
  return pricingChannel;
}

export function PricingProvider({ children }) {
  const { user, profile, isAdmin: authIsAdmin, isTester: authIsTester } = useAuth();
  const isAdmin = Boolean(authIsAdmin || checkIsAdmin(user, profile));
  const isTester = Boolean(authIsTester || checkIsTester(user, profile));

  const [livePricing, setLivePricing] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_PRICING_STATE,
          ...parsed,
          pitchHistory: Array.isArray(parsed.pitchHistory) && parsed.pitchHistory.length > 0
            ? parsed.pitchHistory
            : DEFAULT_PRICING_STATE.pitchHistory
        };
      }
    } catch (e) {
      console.warn('Could not read cached live pricing:', e);
    }
    return DEFAULT_PRICING_STATE;
  });

  const [clientLockedOrder, setClientLockedOrder] = useState(null);
  const [isSyncingPricing, setIsSyncingPricing] = useState(false);

  // Save to localStorage helper
  const cachePricingLocally = (nextState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.warn('Could not cache live pricing locally:', e);
    }
  };

  // Fetch latest cloud pricing config from public Supabase storage bucket
  const fetchCloudPricing = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('receipts')
        .list('', {
          search: 'pricing_config_',
          sortBy: { column: 'name', order: 'desc' },
          limit: 1
        });

      if (!error && files && files.length > 0) {
        const latestFile = files[0];
        const { data: pubData } = supabase.storage
          .from('receipts')
          .getPublicUrl(latestFile.name);

        if (pubData?.publicUrl) {
          const res = await fetch(`${pubData.publicUrl}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const cloudConfig = await res.json();
            if (cloudConfig && typeof cloudConfig.starter === 'number') {
              setLivePricing(prev => {
                // Only overwrite if cloud is newer or has data
                const merged = {
                  ...DEFAULT_PRICING_STATE,
                  ...prev,
                  ...cloudConfig,
                  pitchHistory: Array.isArray(cloudConfig.pitchHistory) && cloudConfig.pitchHistory.length > 0
                    ? cloudConfig.pitchHistory
                    : prev.pitchHistory
                };
                cachePricingLocally(merged);
                return merged;
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Cloud pricing fetch notice:', err);
    }
  };

  // Initial fetch + Realtime subscription for instant cross-device updates
  useEffect(() => {
    fetchCloudPricing();

    const channel = getPricingChannel();
    channel.on('broadcast', { event: 'pricing-updated' }, (event) => {
      const incoming = event?.payload;
      if (incoming && typeof incoming.starter === 'number') {
        setLivePricing(prev => {
          const next = {
            ...prev,
            ...incoming,
            pitchHistory: Array.isArray(incoming.pitchHistory)
              ? incoming.pitchHistory
              : prev.pitchHistory
          };
          cachePricingLocally(next);
          return next;
        });
      }
    });

    if (channel.state !== 'joined') {
      channel.subscribe();
    }
  }, []);

  // Smart Client Protection: Fetch logged-in client's existing order to lock their pitched/purchased price
  useEffect(() => {
    if (!user || isAdmin || isTester) {
      setClientLockedOrder(null);
      return;
    }

    const fetchClientOrder = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('order_id, plan_name, amount_paid, original_amount, total_agreed_amount, status, schedule_config')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setClientLockedOrder(data);
        }
      } catch (e) {
        // Client may not have an order yet
      }
    };

    fetchClientOrder();
  }, [user?.id, isAdmin, isTester]);

  // Persist new pricing config to Cloud Storage + Realtime Broadcast + LocalStorage
  const persistPricingState = async (nextState) => {
    setIsSyncingPricing(true);
    setLivePricing(nextState);
    cachePricingLocally(nextState);

    // 1. Broadcast via Supabase Realtime for instant live update on open tabs
    try {
      const channel = getPricingChannel();
      const sendBroadcast = async () => {
        await channel.send({
          type: 'broadcast',
          event: 'pricing-updated',
          payload: nextState
        });
      };

      if (channel.state === 'joined') {
        await sendBroadcast();
      } else {
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await sendBroadcast();
          }
        });
      }
    } catch (rtErr) {
      console.warn('Realtime pricing broadcast warning:', rtErr);
    }

    // 2. Upload timestamped config JSON to public bucket so new/incognito devices get it
    try {
      const fileName = `pricing_config_${Date.now()}.json`;
      const blob = new Blob([JSON.stringify(nextState)], { type: 'application/json' });
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, {
          contentType: 'application/json',
          cacheControl: '0'
        });

      if (upErr) {
        console.warn('Cloud pricing storage warning:', upErr.message);
      } else {
        // Best-effort cleanup of older config files (keep latest 3)
        const { data: oldFiles } = await supabase.storage
          .from('receipts')
          .list('', {
            search: 'pricing_config_',
            sortBy: { column: 'name', order: 'desc' },
            limit: 15
          });
        if (oldFiles && oldFiles.length > 3) {
          const toDelete = oldFiles.slice(3).map(f => f.name);
          await supabase.storage.from('receipts').remove(toDelete);
        }
      }
    } catch (storageErr) {
      console.warn('Could not upload pricing config to storage:', storageErr);
    } finally {
      setIsSyncingPricing(false);
    }

    return { success: true };
  };

  // Update live prices and optionally record a pitch entry
  const updateLivePricing = async (priceUpdates, pitchEntry = null) => {
    const nextHistory = [...(livePricing.pitchHistory || [])];
    if (pitchEntry && pitchEntry.clientName) {
      nextHistory.unshift({
        id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        clientName: pitchEntry.clientName.trim(),
        planName: pitchEntry.planName || 'Starter Plan',
        planId: pitchEntry.planId || 'starter',
        pitchedPrice: Number(pitchEntry.pitchedPrice || priceUpdates.starter || livePricing.starter),
        standardPrice: 3500,
        status: pitchEntry.status || 'Pitched / Quoted',
        date: new Date().toISOString(),
        notes: pitchEntry.notes || ''
      });
    }

    const nextState = {
      ...livePricing,
      starter: Number(priceUpdates.starter ?? livePricing.starter),
      growth: Number(priceUpdates.growth ?? livePricing.growth),
      premium: Number(priceUpdates.premium ?? livePricing.premium),
      websiteAddon: Number(priceUpdates.websiteAddon ?? livePricing.websiteAddon),
      activePitchClient: priceUpdates.activePitchClient !== undefined
        ? priceUpdates.activePitchClient
        : livePricing.activePitchClient,
      updatedAt: new Date().toISOString(),
      pitchHistory: nextHistory
    };

    return await persistPricingState(nextState);
  };

  // Add a pitch entry and optionally set the pitched price live on the website
  const addPitchMemoryEntry = async (entry) => {
    const pLower = (entry.planName || entry.planId || 'starter').toLowerCase();
    const numericPrice = Number(entry.pitchedPrice || livePricing.starter);
    const newItem = {
      id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clientName: entry.clientName.trim(),
      planName: entry.planName || 'Starter Plan',
      planId: entry.planId || (pLower.includes('growth') ? 'growth' : pLower.includes('premium') ? 'premium' : 'starter'),
      pitchedPrice: numericPrice,
      standardPrice: entry.standardPrice || (pLower.includes('growth') ? 6000 : pLower.includes('premium') ? 11000 : 3500),
      status: entry.status || 'pitched',
      date: entry.date || new Date().toISOString(),
      notes: entry.notes || ''
    };

    const livePatch = {};
    if (entry.alsoSetLive) {
      livePatch.activePitchClient = entry.clientName.trim();
      if (pLower.includes('starter')) {
        livePatch.starter = numericPrice;
      } else if (pLower.includes('growth')) {
        livePatch.growth = numericPrice;
      } else if (pLower.includes('premium')) {
        livePatch.premium = Math.max(1000, numericPrice - Number(livePricing.websiteAddon || 5000));
      }
    }

    const nextState = {
      ...livePricing,
      ...livePatch,
      updatedAt: new Date().toISOString(),
      pitchHistory: [newItem, ...(livePricing.pitchHistory || [])]
    };

    return await persistPricingState(nextState);
  };

  const updatePitchEntryStatus = async (pitchId, newStatus) => {
    const nextHistory = (livePricing.pitchHistory || []).map(item =>
      item.id === pitchId ? { ...item, status: newStatus } : item
    );
    const nextState = {
      ...livePricing,
      updatedAt: new Date().toISOString(),
      pitchHistory: nextHistory
    };
    return await persistPricingState(nextState);
  };

  const deletePitchEntry = async (pitchId) => {
    const nextHistory = (livePricing.pitchHistory || []).filter(item => item.id !== pitchId);
    const nextState = {
      ...livePricing,
      updatedAt: new Date().toISOString(),
      pitchHistory: nextHistory
    };
    return await persistPricingState(nextState);
  };

  // Compute effective prices for the current viewer (Smart Client Protection)
  const effectivePrices = useMemo(() => {
    let starter = Number(livePricing.starter || 3500);
    let growth = Number(livePricing.growth || 6000);
    let premium = Number(livePricing.premium || 6000);
    let websiteAddon = Number(livePricing.websiteAddon || 5000);

    // If a regular client is logged in, protect their view with their own agreed/pitched price
    if (user && !isAdmin && !isTester) {
      // 1. Check if client matches a pitch history entry by name or email
      const clientNameLower = (profile?.name || '').toLowerCase().trim();
      const clientEmailLower = (user?.email || '').toLowerCase().trim();

      if (clientNameLower || clientEmailLower) {
        const matchedPitch = (livePricing.pitchHistory || []).find(p => {
          const pName = (p.clientName || '').toLowerCase().trim();
          return pName && (
            (clientNameLower && (pName.includes(clientNameLower) || clientNameLower.includes(pName))) ||
            (clientEmailLower && pName.includes(clientEmailLower))
          );
        });

        if (matchedPitch && matchedPitch.pitchedPrice) {
          const pPlan = (matchedPitch.planName || matchedPitch.planId || '').toLowerCase();
          if (pPlan.includes('starter')) starter = Number(matchedPitch.pitchedPrice);
          else if (pPlan.includes('growth')) growth = Number(matchedPitch.pitchedPrice);
          else if (pPlan.includes('premium')) premium = Number(matchedPitch.pitchedPrice);
        }
      }

      // 2. Check if client already has an order in the database
      if (clientLockedOrder) {
        const ordPlan = (clientLockedOrder.plan_name || '').toLowerCase();
        const lockedPrice = Number(
          clientLockedOrder.total_agreed_amount ||
          clientLockedOrder.original_amount ||
          clientLockedOrder.amount_paid ||
          0
        );
        if (lockedPrice > 0) {
          if (ordPlan.includes('starter')) starter = lockedPrice;
          else if (ordPlan.includes('growth')) growth = lockedPrice;
          else if (ordPlan.includes('premium')) {
            // If lockedPrice includes website addon, keep monthly portion sensible
            premium = lockedPrice > websiteAddon ? lockedPrice - websiteAddon : lockedPrice;
          }
        }
      }
    }

    return {
      starter,
      growth,
      premium,
      websiteAddon,
      premiumFirstMonthTotal: premium + websiteAddon
    };
  }, [livePricing, user, profile, isAdmin, isTester, clientLockedOrder]);

  // Formatted packages for Home Page (Packages.jsx) & Services Page (Services.jsx)
  const dynamicPackages = useMemo(() => {
    return defaultPackages.map(pkg => {
      if (pkg.id === 'Starter') {
        return {
          ...pkg,
          price: `₹${effectivePrices.starter.toLocaleString('en-IN')}`,
          numericPrice: effectivePrices.starter
        };
      }
      if (pkg.id === 'Growth') {
        return {
          ...pkg,
          price: `₹${effectivePrices.growth.toLocaleString('en-IN')}`,
          numericPrice: effectivePrices.growth
        };
      }
      if (pkg.id === 'Premium') {
        return {
          ...pkg,
          price: `₹${effectivePrices.premium.toLocaleString('en-IN')}`,
          frequency: `/month + ₹${effectivePrices.websiteAddon.toLocaleString('en-IN')} (only once for website)`,
          numericPrice: effectivePrices.premium,
          websiteAddon: effectivePrices.websiteAddon
        };
      }
      return pkg;
    });
  }, [effectivePrices]);

  // Formatted plans for Dashboard PlanModal.jsx
  const dynamicModalPlans = useMemo(() => {
    return [
      {
        id: 'starter',
        name: 'Starter Plan',
        price: effectivePrices.starter,
        period: 'mo',
        features: [
          '12 Static Posts / Month',
          '8 Reels / Month',
          '15 Stories / Month',
          'Instagram Setup + Profile Optimization',
          'Google Business Profile Setup',
          'Content Calendar + Captions',
          'Basic Hashtag Research'
        ],
        highlight: false
      },
      {
        id: 'growth',
        name: 'Growth Plan',
        price: effectivePrices.growth,
        period: 'mo',
        features: [
          '15 Static Posts / Month',
          '12 Reels / Month',
          '15 Stories / Month',
          '1–2 Offline Events / Month',
          'Google Maps Daily Optimization',
          'Weekly Interactive Games',
          'Monthly Performance Summary'
        ],
        highlight: true,
        badge: 'MOST SELECTED'
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: effectivePrices.premiumFirstMonthTotal,
        period: 'first mo',
        subtext: `(₹${effectivePrices.premium.toLocaleString('en-IN')}/mo + ₹${effectivePrices.websiteAddon.toLocaleString('en-IN')} Setup only once for website)`,
        features: [
          'Everything in Growth',
          '5-Page Website',
          'Local SEO Optimization',
          'Influencer Collaboration (3–5)',
          'Monthly Analytics Video Report',
          'Monthly In-Store Event Planning'
        ],
        highlight: false
      }
    ];
  }, [effectivePrices]);

  return (
    <PricingContext.Provider
      value={{
        livePricing,
        effectivePrices,
        dynamicPackages,
        dynamicModalPlans,
        isSyncingPricing,
        savingPricing: isSyncingPricing,
        updateLivePricing,
        addPitchMemoryEntry,
        updatePitchEntryStatus,
        deletePitchEntry,
        refreshCloudPricing: fetchCloudPricing
      }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
}
