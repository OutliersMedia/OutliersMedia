import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import FadeSection from './FadeSection';

export default function ContactForm() {
  const [formValues, setFormValues] = useState({
    name: "",
    business_name: "",
    phone: "",
    email: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [locationText, setLocationText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchParams] = useSearchParams();
  const [packageInterest, setPackageInterest] = useState("growth");
  
  // Edit logic states
  const [submittedLeadId, setSubmittedLeadId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTimer, setEditTimer] = useState(0);

  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (submittedLeadId) {
      navigator.clipboard.writeText(submittedLeadId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleInputChange = (e) => {
    setFormValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const pkg = searchParams.get('package');
    if (pkg) {
      setPackageInterest(pkg);
    }
  }, [searchParams]);

  useEffect(() => {
    let interval;
    if (submitted && editTimer > 0 && !isEditing) {
      interval = setInterval(() => {
        setEditTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [submitted, editTimer, isEditing]);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json')
      .then(res => res.json())
      .then(data => {
        const list = [];
        data.states.forEach(stateObj => {
          if (Array.isArray(stateObj.districts)) {
            stateObj.districts.forEach(dist => {
              list.push(`${dist}, ${stateObj.state}`);
            });
          }
        });
        setDistricts(list.sort());
      })
      .catch(console.error);
  }, []);

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        
        const exactCity = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
        const district = data.address.state_district || data.address.county || "";
        const state = data.address.state || "";

        let parts = [];
        if (exactCity) parts.push(exactCity);
        if (district && district !== exactCity && !exactCity.includes(district)) parts.push(district);
        if (state) parts.push(state);

        const finalLocation = parts.join(", ");
        setLocationText(finalLocation || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } catch (err) {
        console.error(err);
        setLocationText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error(error);
      alert("Unable to retrieve your location.");
      setIsLocating(false);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    
    const leadData = {
      name: formValues.name,
      business_name: formValues.business_name,
      phone: formValues.phone,
      email: formValues.email,
      location: locationText,
      package_interest: packageInterest,
      message: formValues.message
    };

    let result;
    if (submittedLeadId) {
      // It's an edit
      result = await supabase.rpc('update_lead', {
        p_id: submittedLeadId,
        p_name: formValues.name,
        p_business_name: formValues.business_name,
        p_phone: formValues.phone,
        p_email: formValues.email,
        p_location: locationText,
        p_package_interest: packageInterest,
        p_message: formValues.message
      });
    } else {
      // New insert
      result = await supabase.rpc('submit_lead', {
        p_name: formValues.name,
        p_business_name: formValues.business_name,
        p_phone: formValues.phone,
        p_email: formValues.email,
        p_location: locationText,
        p_package_interest: packageInterest,
        p_message: formValues.message
      });
    }

    setIsSubmitting(false);

    if (result.error) {
      console.error("Supabase error:", result.error);
      setErrorMsg("Something went wrong. Please try again or contact us directly.");
    } else {
      if (!submittedLeadId && result.data) {
        setSubmittedLeadId(result.data);
        setEditTimer(60);
      }
      setIsEditing(false);
      setSubmitted(true);
    }
  };

  return (
    <FadeSection id="contact" className="py-32 px-6 lg:px-12 bg-base border-t border-themeborder min-h-screen flex items-center relative overflow-hidden">
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 w-full relative z-10">
        
        {/* Left: Form */}
        <div className="flex flex-col justify-center">
          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-serif text-primary mb-4">Let's build your audience.</h2>
            <p className="text-body text-lg">Drop your details below for a completely free audit of your current social media presence.</p>
          </div>

          {submitted && !isEditing ? (
            <div className="flex flex-col gap-8">
              <div className="bg-glass backdrop-blur-md border border-glass-border p-12 rounded-3xl text-center shadow-xl relative overflow-hidden">
                <div className="w-16 h-16 bg-success/10 border border-success/30 text-success rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(22,163,74,0.3)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
                  </svg>
                </div>
                <h3 className="text-3xl font-serif text-primary mb-2">Audit Request Received</h3>
                
                {submittedLeadId && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <p className="text-muted text-xs font-bold uppercase tracking-widest border border-themeborder px-3 py-1 rounded-full bg-raised">
                      ID: <span className="text-primary">{submittedLeadId}</span>
                    </p>
                    <button 
                      onClick={handleCopyId}
                      className="text-muted hover:text-accent transition-colors p-1 relative group"
                      aria-label="Copy ID"
                    >
                      {copiedId ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-success" viewBox="0 0 16 16">
                          <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
                        </svg>
                      )}
                      {copiedId && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-themeborder whitespace-nowrap">
                          Copied
                        </span>
                      )}
                    </button>
                  </div>
                )}
                <p className="text-body mb-8">We'll review your details and get back to you within 24 hours.</p>
                
                {editTimer > 0 ? (
                  <div className="flex flex-col items-center gap-3">
                    <button onClick={() => setIsEditing(true)} className="text-accent font-bold uppercase tracking-widest text-sm hover:underline transition-colors">
                      Edit Response ({editTimer}s)
                    </button>
                    <div className="w-full max-w-[200px] h-1 bg-surface border border-themeborder rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: editTimer, ease: "linear" }}
                        className="h-full bg-accent"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-bold uppercase tracking-widest text-success border-t border-themeborder pt-6">Submission Finalized</p>
                )}
              </div>

              {/* Connect Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-glass backdrop-blur-md border border-glass-border p-8 rounded-3xl shadow-xl flex flex-col items-center text-center"
              >
                <h4 className="text-xl font-serif text-primary mb-2">While you wait, let's connect</h4>
                <p className="text-sm text-body mb-6">Reach out to us directly through our official channels.</p>
                <div className="flex gap-4">
                  <a href="mailto:outliersmedia22@gmail.com" className="w-12 h-12 bg-surface hover:bg-raised border border-themeborder hover:border-accent text-primary hover:text-accent rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-sm" aria-label="Email">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                    </svg>
                  </a>
                  <a href="https://instagram.com/outliersmedia22" target="_blank" rel="noreferrer" className="w-12 h-12 bg-surface hover:bg-raised border border-themeborder hover:border-accent text-primary hover:text-accent rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-sm" aria-label="Instagram">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.036 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                    </svg>
                  </a>
                  <a href="https://wa.me/919729714352" target="_blank" rel="noreferrer" className="w-12 h-12 bg-surface hover:bg-raised border border-themeborder hover:border-accent text-primary hover:text-accent rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-sm" aria-label="WhatsApp">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c.003-3.625 2.952-6.57 6.577-6.57a6.59 6.59 0 0 1 4.646 1.93 6.6 6.6 0 0 1 1.928 4.651c-.004 3.625-2.953 6.569-6.578 6.569zM11.603 9.61c-.198-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                    </svg>
                  </a>
                </div>
              </motion.div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8 relative">
              {errorMsg && (
                <div className="p-4 bg-danger/10 border border-danger text-danger rounded-xl text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Name</label>
                  <input required name="name" type="text" value={formValues.name} onChange={handleInputChange} className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl" />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Business Name</label>
                  <input required name="business_name" type="text" value={formValues.business_name} onChange={handleInputChange} className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Phone</label>
                  <input required name="phone" type="tel" value={formValues.phone} onChange={handleInputChange} className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl" />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">Email</label>
                  <input required name="email" type="email" value={formValues.email} onChange={handleInputChange} className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">City / District / State</label>
                  <button type="button" onClick={handleLiveLocation} disabled={isLocating} className="text-xs font-bold text-accent hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLocating ? (
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                      </svg>
                    )}
                    {isLocating ? 'Locating...' : 'Share Live Location'}
                  </button>
                </div>
                <div className="relative w-full">
                  <input 
                    required 
                    type="text" 
                    value={locationText} 
                    onChange={e => {
                      setLocationText(e.target.value);
                      setShowDropdown(true);
                    }} 
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    className="w-full bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl" 
                  />
                  {showDropdown && (
                    <ul className="absolute z-[999] top-full left-0 mt-2 w-full bg-glass backdrop-blur-md border border-glass-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {districts
                        .filter(d => d.toLowerCase().includes(locationText.toLowerCase()))
                        .slice(0, 50)
                        .map(d => (
                          <li 
                            key={d} 
                            className="px-4 py-3 text-sm text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                            onClick={() => {
                              setLocationText(d);
                              setShowDropdown(false);
                            }}
                          >
                            {d}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Package Interest</label>
                <select 
                  name="package_interest"
                  value={packageInterest}
                  onChange={(e) => setPackageInterest(e.target.value)}
                  className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 rounded-xl w-full appearance-none">
                  <option value="basic">Basic (₹3,000/month)</option>
                  <option value="growth">Growth (₹6,000/month)</option>
                  <option value="premium">Premium (₹6,000/mo + ₹4,000 once)</option>
                  <option value="unsure">Not Sure Yet</option>
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Message (Optional)</label>
                <textarea name="message" rows="4" value={formValues.message} onChange={handleInputChange} className="bg-surface dark:bg-raised border border-themeborder p-4 text-primary focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none transition-all duration-200 resize-none rounded-xl"></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-[#3428f8] text-[#EEF2FF] px-8 py-5 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-105 mt-4 self-start rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3" 
                style={{ boxShadow: '0 0 24px var(--accent-glow)' }}
              >
                {isSubmitting && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                {isSubmitting ? (isEditing ? 'Updating...' : 'Sending...') : (isEditing ? 'Update Response' : 'Get My Free Audit')}
              </button>
              {isEditing && (
                 <button 
                  type="button" 
                  onClick={() => setIsEditing(false)}
                  className="absolute bottom-6 right-8 text-sm font-bold text-muted hover:text-danger uppercase tracking-widest"
                 >
                   Cancel Edit
                 </button>
              )}
            </form>
          )}
        </div>

        {/* Right: Direct Contact */}
        <div className="flex flex-col justify-center lg:pl-12">
          <div className="bg-glass border border-glass-border backdrop-blur-md p-12 lg:p-16 rounded-3xl shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-accent mb-12 border-b border-themeborder pb-4">Direct Channels</h3>
            
            <div className="flex flex-col gap-10">
              <div className="flex items-start gap-6 group">
                <div className="w-12 h-12 bg-raised border border-themeborder flex items-center justify-center rounded-xl group-hover:border-accent transition-colors">
                  <svg className="text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-muted uppercase tracking-widest mb-1">Email</div>
                  <a href="mailto:outliersmedia22@gmail.com" className="text-lg text-primary hover:text-accent transition-colors font-medium">outliersmedia22@gmail.com</a>
                </div>
              </div>

              <div className="flex items-start gap-6 group">
                <div className="w-12 h-12 bg-raised border border-themeborder flex items-center justify-center rounded-xl group-hover:border-accent transition-colors">
                  <svg className="text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.036 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-muted uppercase tracking-widest mb-1">Instagram</div>
                  <a href="https://instagram.com/outliersmedia22" target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:text-accent transition-colors font-medium">@outliersmedia22</a>
                </div>
              </div>

              <div className="flex items-start gap-6 group">
                <div className="w-12 h-12 bg-raised border border-themeborder flex items-center justify-center rounded-xl group-hover:border-accent transition-colors">
                  <svg className="text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-muted uppercase tracking-widest mb-1">WhatsApp</div>
                  <a href="https://wa.me/919729714352" target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:text-accent transition-colors font-medium">Available for clients</a>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </FadeSection>
  );
}
