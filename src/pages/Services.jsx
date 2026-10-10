import { useState } from 'react';
import { Link } from 'react-router-dom';
import { faqs } from '../utils/data';
import { usePricing } from '../context/PricingContext';

export default function Services() {
  const [openFaq, setOpenFaq] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState('Growth');
  const { dynamicPackages: packages, effectivePrices } = usePricing();

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="pt-32 min-h-screen bg-base relative overflow-hidden">
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 relative z-10">
        
        {/* Header */}
        <div className="mb-24 max-w-3xl">
          <span className="text-accent font-bold uppercase tracking-widest text-sm mb-6 block">Our Capabilities</span>
          <h1 className="text-5xl md:text-7xl font-serif text-primary leading-[1.1] mb-8">
            Everything you need to scale locally.
          </h1>
          <p className="text-xl text-body leading-relaxed">
            We don't offer 50 different services. We offer one core ecosystem designed specifically to drive footfall and brand authority for local businesses.
          </p>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-32 overflow-x-auto bg-transparent border border-themeborder shadow-sm rounded-3xl">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="p-8 border-b border-themeborder font-serif text-2xl text-primary w-1/4 bg-transparent select-none">
                  <span className="text-sm font-bold uppercase tracking-widest text-muted block mb-2">Compare</span>
                  Features
                </th>
                {packages.map(pkg => {
                  const isSelected = pkg.id === selectedPlanId;
                  return (
                    <th 
                      key={pkg.id} 
                      onClick={() => setSelectedPlanId(pkg.id)}
                      className={`p-8 border-b border-l border-themeborder w-1/4 align-top cursor-pointer transition-all duration-500 ease-in-out relative select-none ${
                        isSelected 
                          ? 'bg-white/[0.08] backdrop-blur-md opacity-100 z-10 shadow-[0_0_30px_rgba(37,99,235,0.1)]' 
                          : 'bg-transparent opacity-60 hover:opacity-90'
                      }`}
                    >
                      <div className={`transition-all duration-500 ease-out origin-top-left ${isSelected ? 'scale-[1.04]' : 'scale-100'}`}>
                        <div className={`font-serif text-primary transition-all duration-500 ${isSelected ? 'text-3xl font-bold' : 'text-2xl'}`}>
                          {pkg.name}
                        </div>
                        <div className={`text-xs font-bold uppercase tracking-widest mt-2 transition-colors duration-500 ${isSelected ? 'text-blue-400' : 'text-accent'}`}>
                          {pkg.id === 'Premium' ? `${pkg.price} + ₹${effectivePrices.websiteAddon.toLocaleString('en-IN')} (only once for website)` : pkg.price}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Instagram Page Setup", starter: "Included", growth: "Included", premium: "Included" },
                { label: "Monthly Static Posts", starter: "12 / month", growth: "15 / month", premium: "15 / month" },
                { label: "Monthly Reels", starter: "8 / month", growth: "12 / month", premium: "12 / month" },
                { label: "Monthly Stories", starter: "15 / month", growth: "15 / month", premium: "15 / month" },
                { label: "Google Maps Optimization", starter: "Included", growth: "Daily Optimization", premium: "Daily + Local SEO" },
                { label: "Offline Events", starter: null, growth: "1–2 Events / month", premium: "1–2 Events / month" },
                { label: "Custom 5-Page Website", starter: null, growth: null, premium: "Included" },
              ].map((row, idx) => (
                <tr key={idx} className="border-b border-themeborder hover:bg-white/[0.02] transition-colors duration-300">
                  <td className="p-6 px-8 text-primary font-medium bg-transparent select-none">{row.label}</td>
                  {packages.map((pkg) => {
                    const isSelected = pkg.id === selectedPlanId;
                    const value = pkg.id === 'Starter' ? row.starter : pkg.id === 'Growth' ? row.growth : row.premium;

                    return (
                      <td 
                        key={pkg.id} 
                        onClick={() => setSelectedPlanId(pkg.id)}
                        className={`p-6 border-l border-themeborder text-center transition-all duration-500 ease-in-out cursor-pointer select-none ${
                          isSelected 
                            ? 'bg-white/[0.08] backdrop-blur-md opacity-100 z-10' 
                            : 'bg-transparent opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className={`transition-all duration-500 ease-out origin-center ${isSelected ? 'scale-110 font-bold' : 'scale-100'}`}>
                          {value ? (
                            <span className={isSelected ? 'text-white' : 'text-accent'}>{value}</span>
                          ) : (
                            <span className="text-muted opacity-30 select-none">—</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-6 bg-transparent"></td>
                {packages.map(pkg => {
                  const isSelected = pkg.id === selectedPlanId;
                  return (
                    <td 
                      key={pkg.id} 
                      className={`p-6 border-l border-themeborder text-center transition-all duration-500 ease-in-out ${
                        isSelected 
                          ? 'bg-white/[0.08] backdrop-blur-md opacity-100 z-10' 
                          : 'bg-transparent opacity-60 hover:opacity-90'
                      }`}
                    >
                      <div className={`transition-all duration-500 ease-out origin-center ${isSelected ? 'scale-105' : 'scale-100'}`}>
                        <Link
                          to={`/dashboard?plan=${pkg.id.toLowerCase()}`}
                          onClick={() => setSelectedPlanId(pkg.id)}
                          className={`inline-block px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-500 ease-out w-full rounded-2xl border-2 transform active:scale-95 ${
                            isSelected 
                              ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:bg-[#1d4ed8] hover:border-[#1d4ed8]' 
                              : 'bg-transparent border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb]/10'
                          }`}
                        >
                          Select Plan
                        </Link>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-32 pb-20">
          <div className="lg:col-span-4">
            <h2 className="text-4xl font-serif text-primary mb-6">Common Questions</h2>
            <p className="text-body">Everything you need to know about how we work and what you can expect.</p>
          </div>
          <div className="lg:col-span-8 flex flex-col border-t border-themeborder">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-themeborder">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left py-8 flex justify-between items-center focus:outline-none group"
                >
                  <span className="text-xl md:text-2xl font-serif text-primary pr-8 group-hover:text-accent transition-colors">{faq.question}</span>
                  <span className="text-2xl font-serif text-muted group-hover:text-accent flex-shrink-0 transition-colors">
                    {openFaq === idx ? "—" : "+"}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="pb-10 pr-12">
                    <p className="text-body text-lg leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Bottom CTA */}
      <div className="p-16 md:p-32 text-center border-t border-themeborder" style={{ background: 'var(--bg-section)' }}>
        <h2 className="text-4xl md:text-6xl font-serif text-primary mb-10">Ready to dominate Tricity?</h2>
        <Link
          to="/contact"
          className="inline-block bg-[#3428f8] text-[#EEF2FF] px-10 py-5 text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-all duration-300 hover:scale-105 shadow-xl rounded-2xl"
          style={{ boxShadow: '0 0 24px var(--accent-glow)' }}
        >
          Get Your Free Audit
        </Link>
      </div>
    </div>
  );
}
