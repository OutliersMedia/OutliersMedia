import { supabase } from './supabaseClient';

// Public VAPID Key for Web Push encryption
export const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/**
 * Converts a base64 VAPID string into a Uint8Array for PushManager
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if browser supports Notifications and Service Workers
 */
export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
}

/**
 * Returns current permission status ('granted', 'denied', 'default', or 'unsupported')
 */
export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Registers the background service worker
 */
export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Requests browser permission and saves the subscription to Supabase
 */
export async function subscribeClientToPush(user) {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    const reg = await registerPushServiceWorker();
    if (!reg) return { success: false, reason: 'sw_failed' };

    // Request native browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, permission, reason: 'permission_denied' };
    }

    // Attempt push subscription with PushManager
    let subJson = null;
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      if (sub) {
        subJson = sub.toJSON();
      }
    } catch (subErr) {
      console.warn('PushManager subscription warning:', subErr);
    }

    // Save subscription in Supabase if user exists
    if (user && user.id && subJson && subJson.endpoint) {
      try {
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          client_id: user.email || user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
          user_agent: navigator.userAgent
        }, { onConflict: 'endpoint' });
      } catch (dbErr) {
        console.warn('Could not save push subscription to DB:', dbErr);
      }
    }

    // Cache granted status in localStorage
    try {
      localStorage.setItem('outliers_push_granted', 'true');
    } catch (e) {}

    return { success: true, permission: 'granted' };
  } catch (err) {
    console.error('Error during push subscription:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Triggers a native system OS notification via the Service Worker
 */
export async function triggerLocalNotification(title, options = {}) {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body || '',
          icon: options.icon || '/icon.png',
          badge: '/icon.png',
          vibrate: [200, 100, 200],
          data: { url: options.url || '/dashboard' }
        });
        return true;
      }
    }

    // Fallback to Notification constructor if available
    new Notification(title, {
      body: options.body || '',
      icon: options.icon || '/icon.png'
    });
    return true;
  } catch (err) {
    console.warn('Could not trigger notification:', err);
    return false;
  }
}

/**
 * Dispatches a push notification via Supabase Realtime broadcast
 * Supports:
 * 1. Single Client Upload Alert: { targetUserId: client_id, isGlobal: false, title, body, url }
 * 2. Global Offer/Announcement: { isGlobal: true, title, body, url }
 */
export async function dispatchPushNotification({
  targetUserId = null,
  targetClientName = null,
  title,
  body,
  url = '/dashboard',
  isGlobal = false,
  postType = null
}) {
  if (!title || !body) return { success: false, error: 'Title and body are required' };

  const payload = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    targetUserId: targetUserId || 'all',
    targetClientName: targetClientName || (isGlobal ? 'All Clients' : 'Client'),
    isGlobal: Boolean(isGlobal),
    title,
    body,
    url: url || '/dashboard',
    postType: postType || null,
    timestamp: new Date().toISOString()
  };

  try {
    // Broadcast across Supabase channel
    const channel = supabase.channel('outliers-alerts');
    await channel.subscribe();
    
    await channel.send({
      type: 'broadcast',
      event: 'new-notification',
      payload
    });

    // Save to local dispatch log
    try {
      const existingLogs = JSON.parse(localStorage.getItem('outliers_sent_notifications') || '[]');
      existingLogs.unshift(payload);
      localStorage.setItem('outliers_sent_notifications', JSON.stringify(existingLogs.slice(0, 50)));
    } catch (e) {}

    return { success: true, payload };
  } catch (err) {
    console.error('Failed to dispatch notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Listens on Supabase Realtime channel for incoming push alerts and triggers OS notification
 */
export function setupNotificationListener(userId, onNotificationReceived) {
  if (!userId) return () => {};

  const channel = supabase.channel('outliers-alerts')
    .on('broadcast', { event: 'new-notification' }, async (event) => {
      const payload = event.payload;
      if (!payload) return;

      // Check if message is intended for this user
      const isForMe = payload.isGlobal === true || payload.targetUserId === userId || payload.targetUserId === 'all';

      if (isForMe) {
        // Trigger system notification if granted
        if (Notification.permission === 'granted') {
          await triggerLocalNotification(payload.title, {
            body: payload.body,
            url: payload.url,
            icon: '/icon.png'
          });
        }

        if (typeof onNotificationReceived === 'function') {
          onNotificationReceived(payload);
        }
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
