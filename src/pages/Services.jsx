import { useState } from 'react';
import { Link } from 'react-router-dom';
import { packages, faqs } from '../utils/data';

export default function Services() {
  const [openFaq, setOpenFaq] = useState(0);

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
        <div className="mb-32 overflow-x-auto bg-surface border border-themeborder shadow-sm rounded-3xl">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="p-8 border-b border-themeborder font-serif text-2xl text-primary w-1/4 bg-section">
                  <span className="text-sm font-bold uppercase tracking-widest text-muted block mb-2">Compare</span>
                  Features
                </th>
                {packages.map(pkg => (
                  <th key={pkg.id} className="p-8 border-b border-l border-themeborder w-1/4 align-top" style={{ background: pkg.isPopular ? 'var(--bg-raised)' : 'var(--bg-surface)' }}>
                    <div className="text-2xl font-serif text-primary">{pkg.name}</div>
                    <div className={`text-xs font-bold uppercase tracking-widest mt-2 ${pkg.isPopular ? 'text-accent' : 'text-accent'}`}>{pkg.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "Instagram Page Setup",
                "Monthly Static Posts",
                "Monthly Reels",
                "Gamified Stories",
                "Google Maps Optimization",
                "WhatsApp Content",
                "Custom Website",
              ].map((feature, idx) => (
                <tr key={idx} className="border-b border-themeborder hover:bg-raised transition-colors">
                  <td className="p-6 px-8 text-primary font-medium bg-section">{feature}</td>
                  <td className="p-6 border-l border-themeborder text-center text-primary font-medium">
                    {idx === 0 || idx === 1 || idx === 2 || idx === 4 ? <span className="text-accent">Included</span> : <span className="text-muted opacity-30">—</span>}
                  </td>
                  <td className="p-6 border-l border-themeborder text-center font-bold" style={{ background: 'var(--bg-raised)' }}>
                    {idx !== 6 ? <span className="text-success">Included</span> : <span className="text-muted opacity-30">—</span>}
                  </td>
                  <td className="p-6 border-l border-themeborder text-center text-primary font-medium">
                    <span className="text-accent">Included</span>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="p-6 bg-section"></td>
                {packages.map(pkg => (
                  <td key={pkg.id} className="p-6 border-l border-themeborder text-center" style={{ background: pkg.isPopular ? 'var(--bg-raised)' : 'transparent' }}>
                    <Link
                      to={`/contact?package=${pkg.id}`}
                      className={`inline-block px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 w-full rounded-2xl border-2 ${pkg.isPopular ? 'bg-[#3c06cf] border-[#3c06cf] text-white hover:bg-transparent hover:text-[#3c06cf]' : 'bg-transparent border-[#3c06cf] text-[#3c06cf] hover:bg-[#3c06cf] hover:text-white'}`}
                    >
                      Select Plan
                    </Link>
                  </td>
                ))}
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
