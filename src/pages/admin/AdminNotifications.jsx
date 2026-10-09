import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, BellRing, Send, Users, User, Sparkles, CheckCircle, Clock, 
  ExternalLink, Eye, AlertCircle, RefreshCw, Layers, ShieldCheck, Tag, Lock
} from 'lucide-react';
import { 
  dispatchPushNotification, 
  triggerLocalNotification, 
  subscribeClientToPush, 
  getNotificationPermission 
} from '../../utils/pushManager';

export default function AdminNotifications() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Device Permission State
  const [devicePermission, setDevicePermission] = useState('default');
  const [deviceRegistering, setDeviceRegistering] = useState(false);

  // Form State
  const [targetType, setTargetType] = useState('global'); // 'global' | 'client'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [notifCategory, setNotifCategory] = useState('offer'); // 'offer' | 'upload' | 'account' | 'general'
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('/dashboard');

  // Status State
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [sentHistory, setSentHistory] = useState([]);

  const checkDevicePermission = () => {
    if (typeof Notification !== 'undefined') {
      setDevicePermission(Notification.permission);
    }
  };

  useEffect(() => {
    fetchClients();
    loadSentHistory();
    checkDevicePermission();

    const handleFocus = () => checkDevicePermission();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_id, name, email, phone, business_type, role')
        .order('name', { ascending: true });

      if (profiles) {
        setClients(profiles);
        if (profiles.length > 0 && !selectedClientId) {
          setSelectedClientId(profiles[0].auth_id);
        }
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadSentHistory = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('outliers_sent_notifications') || '[]');
      setSentHistory(logs);
    } catch (e) {
      setSentHistory([]);
    }
  };

  const applyPreset = (presetTitle, presetBody, category = 'offer') => {
    setTitle(presetTitle);
    setBody(presetBody);
    setNotifCategory(category);
  };

  const handleEnableDevicePush = async () => {
    setDeviceRegistering(true);
    const res = await subscribeClientToPush(user);
    checkDevicePermission();
    setDeviceRegistering(false);

    if (res.success) {
      alert("✓ Browser notifications enabled! Your device is now active and will receive push notifications.");
    }
  };

  const handleTestLocal = async () => {
    const testTitle = title.trim() || '🎉 Outliers Media Test Alert';
    const testBody = body.trim() || 'This is how notifications appear on your screen and mobile device!';
    
    const sent = await triggerLocalNotification(testTitle, {
      body: testBody,
      url: targetUrl || '/dashboard'
    });
    
    checkDevicePermission();
    if (sent) {
      setSuccessMsg('✓ Test notification popped up on your screen!');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert("Please fill in both a notification title and message body.");
      return;
    }

    const isGlobal = targetType === 'global';
    let targetUserId = null;
    let targetClientName = 'All Clients';

    if (!isGlobal) {
      if (!selectedClientId) {
        alert("Please select a target client.");
        return;
      }
      targetUserId = selectedClientId;
      const targetClient = clients.find(c => c.auth_id === selectedClientId);
      targetClientName = targetClient?.name || targetClient?.email || 'Specific Client';
    }

    setSending(true);
    setSuccessMsg('');

    const res = await dispatchPushNotification({
      targetUserId,
      targetClientName,
      title: title.trim(),
      body: body.trim(),
      url: targetUrl.trim() || '/dashboard',
      isGlobal
    });

    setSending(false);

    if (res.success) {
      setSuccessMsg(
        isGlobal 
          ? `✓ Global Notification broadcasted successfully to all active clients!`
          : `✓ Targeted notification dispatched directly to ${targetClientName}!`
      );
      loadSentHistory();

      // If the admin broadcasted globally or sent to their own account, trigger immediate test preview
      const targetClient = clients.find(c => c.auth_id === selectedClientId);
      const isTargetingMe = isGlobal || 
        targetUserId === user?.id || 
        targetUserId === user?.email || 
        (targetClient && user?.email && targetClient.email === user.email);

      if (isTargetingMe && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await triggerLocalNotification(title.trim(), {
          body: body.trim(),
          url: targetUrl || '/dashboard'
        });
      }

      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      alert(`Error sending notification: ${res.error}`);
    }
  };

  const selectedClientObj = clients.find(c => c.auth_id === selectedClientId);

  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-6 md:p-8 min-h-[calc(100vh-140px)] shadow-2xl flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-[#3428f8]/10 text-[#3428f8] border border-[#3428f8]/20">
              <BellRing size={20} />
            </div>
            <h2 className="text-3xl font-serif text-white">Push Notification Broadcaster</h2>
          </div>
          <p className="text-[#888] text-sm">
            Send instant desktop and mobile notifications to all clients for offers, or send targeted alerts to specific accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTestLocal}
          className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#333] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
        >
          <Eye size={14} className="text-[#3428f8]" />
          Test Notification on My Screen
        </button>
      </div>

      {/* Device Notification Status Card */}
      <div className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
        devicePermission === 'granted'
          ? 'bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
          : devicePermission === 'denied'
          ? 'bg-red-950/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.06)]'
          : 'bg-amber-950/20 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-xl border ${
            devicePermission === 'granted'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : devicePermission === 'denied'
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <BellRing size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">This Device Notification Status:</h4>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                devicePermission === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : devicePermission === 'denied'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {devicePermission === 'granted' ? 'Active & Ready ✓' : devicePermission === 'denied' ? 'Blocked in Browser ❌' : 'Not Enabled Yet ⚠️'}
              </span>
            </div>
            <p className="text-xs text-[#888] mt-0.5">
              {devicePermission === 'granted' 
                ? 'This device is listening for live broadcasts and deliverable upload alerts.'
                : devicePermission === 'denied'
                ? 'Notifications are blocked in this browser. Click the lock icon 🔒 next to the website URL to Allow.'
                : 'To test and receive notifications on this device, click Enable Notifications below.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {devicePermission !== 'granted' && (
            <button
              type="button"
              onClick={handleEnableDevicePush}
              disabled={deviceRegistering}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#3428f8] hover:bg-[#281fe0] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              {deviceRegistering ? <RefreshCw size={13} className="animate-spin" /> : <Bell size={13} />}
              Enable on This Device
            </button>
          )}
          <button
            type="button"
            onClick={handleTestLocal}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-white border border-[#333] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Eye size={13} className="text-[#3428f8]" />
            Test Screen Popup
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl relative overflow-hidden">
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-1">Broadcast Channels</p>
          <h3 className="text-2xl font-serif text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
            Realtime Push Active
          </h3>
          <p className="text-[#666] text-xs mt-2">Zero-latency background delivery</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl relative overflow-hidden">
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-1">Registered Clients</p>
          <h3 className="text-2xl font-serif text-white flex items-center gap-2">
            <Users size={20} className="text-[#3428f8]" />
            {clients.length} Clients
          </h3>
          <p className="text-[#666] text-xs mt-2">Eligible for global broadcasts</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl relative overflow-hidden">
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-1">Total Dispatched</p>
          <h3 className="text-2xl font-serif text-white flex items-center gap-2">
            <Clock size={20} className="text-amber-400" />
            {sentHistory.length} Alerts Sent
          </h3>
          <p className="text-[#666] text-xs mt-2">Historical push logs recorded</p>
        </div>
      </div>

      {/* Main Broadcaster Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: 7 Columns */}
        <div className="lg:col-span-7 bg-[#0a0a0a] border border-[#222] rounded-3xl p-6 md:p-8 flex flex-col gap-6">
          <h3 className="text-lg font-serif text-white flex items-center gap-2">
            <Send size={18} className="text-[#3428f8]" /> Compose Notification
          </h3>

          <form onSubmit={handleSendNotification} className="flex flex-col gap-5">
            {/* 1. Target Audience Selection */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                1. Select Recipient Audience
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetType('global')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetType === 'global'
                      ? 'bg-[#3428f8]/15 border-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.2)]'
                      : 'bg-[#141414] border-[#222] text-[#888] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                    <Users size={16} className={targetType === 'global' ? 'text-[#3428f8]' : 'text-[#666]'} />
                    All Clients (Global)
                  </div>
                  <p className="text-[11px] text-[#777]">
                    Broadcast offers, announcements, and discounts to all clients at once.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('client')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetType === 'client'
                      ? 'bg-[#3428f8]/15 border-[#3428f8] text-white shadow-[0_0_15px_rgba(52,40,248,0.2)]'
                      : 'bg-[#141414] border-[#222] text-[#888] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                    <User size={16} className={targetType === 'client' ? 'text-[#3428f8]' : 'text-[#666]'} />
                    Specific Client
                  </div>
                  <p className="text-[11px] text-[#777]">
                    Target only one client account (e.g. Cravory or personal update).
                  </p>
                </button>
              </div>

              {/* Specific Client Dropdown */}
              {targetType === 'client' && (
                <div className="mt-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#888] block mb-1.5">
                    Choose Client Account:
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-[#141414] border border-[#333] text-white p-3 rounded-xl text-xs font-bold outline-none focus:border-[#3428f8]"
                  >
                    {clients.map(c => (
                      <option key={c.auth_id} value={c.auth_id}>
                        {c.name || 'Unnamed'} ({c.email}) {c.business_type ? `• ${c.business_type}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                Quick Notification Templates
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(
                    "🎉 Special Offer: 20% Off Extra Reels This Weekend!",
                    "Upgrade your schedule or add extra reels with an exclusive 20% discount. Limited slots available!",
                    "offer"
                  )}
                  className="bg-[#161616] hover:bg-[#222] text-[#ccc] border border-[#262626] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  🏷️ Weekend Special Offer
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(
                    "🚀 Fresh Content Live on Your Dashboard!",
                    "Your new content deliverable has been uploaded and is ready for review.",
                    "upload"
                  )}
                  className="bg-[#161616] hover:bg-[#222] text-[#ccc] border border-[#262626] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  🎬 Upload Alert
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(
                    "⏰ Monthly Retainer Renewal Reminder",
                    "Your monthly content plan renewal is approaching. Check your schedule to ensure uninterrupted uploads.",
                    "account"
                  )}
                  className="bg-[#161616] hover:bg-[#222] text-[#ccc] border border-[#262626] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  💳 Plan Renewal Reminder
                </button>
              </div>
            </div>

            {/* 2. Notification Title */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                2. Notification Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🎉 Special Offer: 20% Off Video Editing!"
                className="w-full bg-[#141414] border border-[#333] text-white p-3.5 rounded-xl text-sm font-bold outline-none focus:border-[#3428f8] transition-colors"
              />
            </div>

            {/* 3. Notification Message Body */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-2">
                3. Notification Message Body
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the message that will pop up on the client's screen/phone..."
                className="w-full bg-[#141414] border border-[#333] text-white p-3.5 rounded-xl text-sm outline-none focus:border-[#3428f8] transition-colors resize-none"
              />
            </div>

            {/* Destination URL */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#aaa] block mb-1.5">
                Destination URL on Click
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="/dashboard"
                className="w-full bg-[#141414] border border-[#333] text-white font-mono p-3 rounded-xl text-xs outline-none focus:border-[#3428f8]"
              />
            </div>

            {/* Success Feedback Alert */}
            {successMsg && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-[#3428f8] hover:bg-[#281fe0] text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(52,40,248,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {sending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={16} />
                  {targetType === 'global' ? 'Send Global Push Broadcast' : 'Dispatch Client Notification'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Preview & Live Cards: 5 Columns */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Live Screen Preview */}
          <div className="bg-[#0a0a0a] border border-[#222] rounded-3xl p-6">
            <span className="text-xs font-bold uppercase tracking-widest text-[#888] block mb-4 flex items-center gap-2">
              <Eye size={14} className="text-[#3428f8]" /> Live Notification Preview
            </span>

            {/* Simulated Windows/Android Notification Banner */}
            <div className="bg-[#181818] border border-[#333] rounded-2xl p-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-start gap-3">
                <img src="/icon.png" alt="App Icon" className="w-10 h-10 rounded-xl bg-black p-1 object-contain border border-[#333]" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] font-bold text-[#888] uppercase tracking-wider">OUTLIERS MEDIA</span>
                    <span className="text-[10px] text-[#666]">Just now</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {title || "🎉 Notification Title Preview"}
                  </h4>
                  <p className="text-xs text-[#bbb] leading-relaxed line-clamp-3">
                    {body || "Your notification message will appear here in the system action center and lock screen."}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#262626] flex justify-between items-center text-[10px] text-[#777]">
                <span className="flex items-center gap-1 font-mono">
                  Target: {targetType === 'global' ? 'All Clients' : (selectedClientObj?.name || 'Client')}
                </span>
                <span className="text-[#3428f8] font-bold">Click to open</span>
              </div>
            </div>
          </div>

          {/* Recent Dispatches Feed */}
          <div className="bg-[#0a0a0a] border border-[#222] rounded-3xl p-6 flex-1 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-3 flex items-center justify-between">
              <span>Recent Dispatches</span>
              <span className="text-[10px] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#262626]">
                {sentHistory.length} Total
              </span>
            </h4>

            {sentHistory.length === 0 ? (
              <div className="p-8 text-center text-[#555] text-xs flex-1 flex items-center justify-center">
                No notifications sent in this session yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                {sentHistory.slice(0, 10).map((log, idx) => (
                  <div key={idx} className="bg-[#141414] border border-[#222] rounded-xl p-3 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-[11px] truncate max-w-[200px]">
                        {log.title}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        log.isGlobal 
                          ? 'bg-[#3428f8]/15 text-[#3428f8] border border-[#3428f8]/25' 
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      }`}>
                        {log.isGlobal ? 'Global' : 'Client'}
                      </span>
                    </div>
                    <p className="text-[#888] text-[10px] line-clamp-2">{log.body}</p>
                    <span className="text-[#555] text-[9px] font-mono mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • {log.targetClientName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
