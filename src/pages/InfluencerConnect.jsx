import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, UploadCloud, CheckCircle2, 
  MessageSquare, Video, ArrowRight, ShieldCheck, 
  Star, FileText, Check, AlertCircle 
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { saveInfluencer, generateDefaultReels } from '../utils/influencerEngine';

export default function InfluencerConnect() {
  const [name, setName] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [niche, setNiche] = useState('Food & Cafes');
  const [followerCount, setFollowerCount] = useState('');
  const [reelsCount, setReelsCount] = useState(3); // 3 to 10
  const [contractType, setContractType] = useState('barter'); // 'barter' | 'paid' | 'hybrid'
  const [ratePerReel, setRatePerReel] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [portfolioLinks, setPortfolioLinks] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleScreenshotChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg("Please enter your real full name.");
      return;
    }
    if (!instagramId.trim()) {
      setErrorMsg("Please enter your Instagram handle.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Please enter your active WhatsApp / contact phone number.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedScreenshotUrl = null;

      // Upload dashboard screenshot if provided
      if (screenshotFile) {
        try {
          const fileExt = screenshotFile.name.split('.').pop() || 'png';
          const fileName = `inf_proof_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, screenshotFile, { upsert: true });

          if (!uploadError) {
            const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(fileName);
            uploadedScreenshotUrl = pubData?.publicUrl || null;
          }
        } catch (uploadErr) {
          console.warn("Screenshot storage notice:", uploadErr);
        }
      }

      const costPerReel = Number(ratePerReel || 0);
      const calculatedTotal = costPerReel * reelsCount;

      const defaultReels = generateDefaultReels(reelsCount, costPerReel);
      // Pre-set barter vs paid preferences on reels
      const customizedReels = defaultReels.map((r) => ({
        ...r,
        is_barter: contractType === 'barter' || contractType === 'hybrid',
        is_paid: contractType === 'paid' || contractType === 'hybrid',
        paid_amount: (contractType === 'paid' || contractType === 'hybrid') ? costPerReel : 0,
        rate_per_reel: costPerReel,
        final_rate_per_reel: 0
      }));

      const payload = {
        name: name.trim(),
        instagram_id: instagramId.trim().replace(/^@/, ''),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        niche: niche.trim(),
        follower_count: followerCount.trim(),
        reels_count: parseInt(reelsCount) || 3,
        dashboard_screenshot_url: uploadedScreenshotUrl,
        contract_type: contractType,
        rate_per_reel: costPerReel,
        final_rate_per_reel: 0,
        total_price: calculatedTotal,
        status: 'pending',
        notes: [
          portfolioLinks ? `Portfolio: ${portfolioLinks.trim()}` : '',
          notes ? `Bio/Notes: ${notes.trim()}` : ''
        ].filter(Boolean).join('\n\n'),
        reels: customizedReels
      };

      await saveInfluencer(payload);
      setSubmitted(true);
    } catch (err) {
      setErrorMsg("Error submitting application: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-base text-primary relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40" 
        style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px' }}
      ></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Header Banner */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3428f8]/15 border border-[#3428f8]/30 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Flame size={14} /> Creator Partnerships • Outliers Media
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif text-primary mb-4 leading-tight">
            Connect as an Influencer
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Collaborate with top cafes, restaurants, brands, and businesses across Tricity & North India. We sign contracts from <strong>3 to 10 reels</strong> under guaranteed barter and paid partnerships.
          </p>
        </div>

        {submitted ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#101010] border border-[#3428f8]/40 rounded-3xl p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-2xl"
          >
            <div className="w-20 h-20 bg-[#3428f8]/15 border border-[#3428f8]/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-serif text-white mb-3">Application Received!</h2>
            <p className="text-[#aaa] text-sm leading-relaxed mb-8">
              Thank you, <strong className="text-white">{name}</strong> (@{instagramId}). Our creative team is reviewing your profile and analytics. We will message you on WhatsApp shortly to discuss matching brand campaigns.
            </p>

            <div className="bg-[#161616] border border-[#262626] rounded-2xl p-4 text-left mb-8 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#777]">Contract Scope:</span>
                <span className="text-white font-bold">{reelsCount} Reels in Contract</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777]">Collaboration Model:</span>
                <span className="text-blue-400 font-bold capitalize">{contractType} Partnership</span>
              </div>
              {Number(ratePerReel) > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#777]">Quoted Per Reel:</span>
                    <span className="text-emerald-400 font-mono font-bold">₹{Number(ratePerReel).toLocaleString()} / reel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777]">Total Proposed Payout:</span>
                    <span className="text-white font-mono font-bold">₹{(Number(ratePerReel) * reelsCount).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-[#777]">Compensation:</span>
                  <span className="text-emerald-400 font-bold">Barter Exchange (₹0 cash)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#777]">Contact WhatsApp:</span>
                <span className="text-white font-mono">{phone}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://wa.me/919729714352?text=Hello%20Outliers%20Media,%20I%20have%20submitted%20my%20creator%20profile%20@${encodeURIComponent(instagramId)}%20for%20${reelsCount}%20reels.`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#20ba59] text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare size={16} /> Chat Directly on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setName('');
                  setInstagramId('');
                  setPhone('');
                  setEmail('');
                  setScreenshotFile(null);
                  setScreenshotPreview(null);
                }}
                className="bg-[#1f1f1f] hover:bg-[#282828] text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
              >
                Submit Another Profile
              </button>
            </div>
          </motion.div>
        ) : (
          <form 
            onSubmit={handleSubmit}
            className="bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col gap-6"
          >
            {errorMsg && (
              <div className="p-4 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section 1: Creator Identity */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                <Star size={14} /> 1. Creator Profile & Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Real Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Instagram Handle / ID *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={instagramId}
                      onChange={(e) => setInstagramId(e.target.value.replace(/^@/, ''))}
                      className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 pl-8 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Active WhatsApp / Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    City / Base Location
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Primary Content Niche
                  </label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  >
                    <option value="Food & Cafes">Food & Cafes</option>
                    <option value="Fashion & Lifestyle">Fashion & Lifestyle</option>
                    <option value="Travel & Hospitality">Travel & Hospitality</option>
                    <option value="Fitness & Health">Fitness & Health</option>
                    <option value="Beauty & Makeup">Beauty & Makeup</option>
                    <option value="Nightlife & Events">Nightlife & Events</option>
                    <option value="Tech & Gadgets">Tech & Gadgets</option>
                    <option value="Other">Other Category</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Contract Range (3 to 10 Reels) */}
            <div className="pt-2 border-t border-[#222]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-2">
                <Video size={14} /> 2. Contract Reel Package (Range: 3 to 10 Reels)
              </h3>
              <p className="text-xs text-[#888] mb-4">
                Select how many reels you are willing to sign with Outliers Media in a single contract.
              </p>

              {/* Range Selector: 3 to 10 */}
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-[#aaa] uppercase font-bold tracking-wider">Number of Reels</span>
                  <span className="text-2xl font-bold font-mono text-blue-400">{reelsCount} Reels</span>
                </div>

                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={reelsCount}
                  onChange={(e) => setReelsCount(parseInt(e.target.value))}
                  className="w-full accent-[#3428f8] cursor-pointer h-2 bg-[#222] rounded-lg appearance-none"
                />

                <div className="flex justify-between text-[11px] text-[#666] font-mono mt-2">
                  <span>3 Reels (Min)</span>
                  <span>5 Reels</span>
                  <span>7 Reels</span>
                  <span>10 Reels (Max)</span>
                </div>

                {/* Quick Selection Buttons */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4">
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReelsCount(num)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        reelsCount === num
                          ? 'bg-[#3428f8] text-white'
                          : 'bg-[#1e1e1e] text-[#888] hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Compensation & Barter Preferences */}
            <div className="pt-2 border-t border-[#222]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-2">
                <FileText size={14} /> 3. Collaboration & Compensation Preferences
              </h3>
              <p className="text-xs text-[#888] mb-4">
                Specify your openness to barter products/services and your expected fee.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setContractType('barter')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    contractType === 'barter'
                      ? 'bg-[#3428f8]/20 border-[#3428f8] text-white'
                      : 'bg-[#141414] border-[#262626] text-[#888] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1">Barter System</span>
                  <span className="text-[11px] text-[#aaa]">Open to complimentary meals, hotel stays, clothes, and products.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContractType('hybrid')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    contractType === 'hybrid'
                      ? 'bg-[#3428f8]/20 border-[#3428f8] text-white'
                      : 'bg-[#141414] border-[#262626] text-[#888] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1">Hybrid (Barter + Cash)</span>
                  <span className="text-[11px] text-[#aaa]">Combination of free brand perks plus a partial production fee.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContractType('paid')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    contractType === 'paid'
                      ? 'bg-[#3428f8]/20 border-[#3428f8] text-white'
                      : 'bg-[#141414] border-[#262626] text-[#888] hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1">Paid Commercial</span>
                  <span className="text-[11px] text-[#aaa]">Fixed monetary fee per reel or contract package.</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Approximate Follower Count
                  </label>
                  <input
                    type="text"
                    value={followerCount}
                    onChange={(e) => setFollowerCount(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white focus:border-[#3428f8] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Your Cost Per Reel (₹) {contractType === 'barter' ? '(Optional for Barter)' : '*'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required={contractType === 'paid'}
                    value={ratePerReel}
                    onChange={(e) => setRatePerReel(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-sm text-white font-mono focus:border-[#3428f8] outline-none transition-colors"
                  />
                  {Number(ratePerReel) > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-[#0f0f0f] border border-[#3428f8]/30 flex items-center justify-between text-xs">
                      <span className="text-[#888]">
                        Quote: <strong className="text-white">₹{Number(ratePerReel).toLocaleString()}</strong> × <strong className="text-white">{reelsCount} reels</strong>
                      </span>
                      <span className="font-mono font-bold text-blue-400">
                        = ₹{(Number(ratePerReel) * reelsCount).toLocaleString()} Total
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Dashboard Screenshot (Optional) */}
            <div className="pt-2 border-t border-[#222]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-2">
                <UploadCloud size={14} /> 4. Instagram Insights / Analytics Screenshot (Optional)
              </h3>
              <p className="text-xs text-[#888] mb-4">
                Upload a screenshot of your Instagram Professional Dashboard (Accounts Reached, Engagement, or Audience Demographics).
              </p>

              <div className="relative border-2 border-dashed border-[#333] hover:border-[#3428f8] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#131313]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <UploadCloud size={28} className={`mx-auto mb-2 ${screenshotPreview ? 'text-blue-400' : 'text-[#666]'}`} />
                <p className="text-xs font-medium text-white">
                  {screenshotFile ? screenshotFile.name : 'Click to select or drag dashboard screenshot here'}
                </p>
                <p className="text-[10px] text-[#666] mt-1">PNG, JPG, JPEG up to 10MB</p>
              </div>

              {screenshotPreview && (
                <div className="mt-3 flex items-center gap-3 bg-[#161616] p-3 rounded-xl border border-[#262626]">
                  <img 
                    src={screenshotPreview} 
                    alt="Dashboard Preview" 
                    className="w-16 h-16 rounded-lg object-cover border border-[#333]" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{screenshotFile?.name}</p>
                    <span className="text-[10px] text-green-400 font-bold">Screenshot Attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotFile(null);
                      setScreenshotPreview(null);
                    }}
                    className="text-xs text-red-400 hover:underline p-1"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Section 5: Past Work Links & Bio */}
            <div className="pt-2 border-t border-[#222]">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Past Best Performing Reel Links (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={portfolioLinks}
                    onChange={(e) => setPortfolioLinks(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-xs text-white focus:border-[#3428f8] outline-none transition-colors resize-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#aaa] block mb-2">
                    Any Additional Notes / Message for Our Team
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#161616] border border-[#2c2c2c] rounded-xl p-3.5 text-xs text-white focus:border-[#3428f8] outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-[#222]">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#3428f8] hover:bg-[#2d23c9] disabled:bg-[#3428f8]/50 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                ) : (
                  <>
                    <Flame size={16} /> Submit Creator Partnership Application
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
