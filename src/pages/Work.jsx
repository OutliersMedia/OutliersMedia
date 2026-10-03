import { useEffect } from 'react';
import { portfolioLinks } from '../utils/data';

export default function Work() {
  useEffect(() => {
    // Trigger Instagram's embed script to render everything into interactive players
    if (window.instgrm) {
        window.instgrm.Embeds.process();
    } else {
        const script = document.createElement('script');
        script.id = 'insta-embed-script';
        script.async = true;
        script.src = "https://www.instagram.com/embed.js"; // Forced HTTPS for local dev
        document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="pt-32 min-h-screen bg-base relative overflow-hidden">
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--hero-bg)', backgroundSize: '40px 40px', opacity: 0.5 }}></div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 relative z-10">
        
        {/* Header */}
        <div className="mb-24 max-w-3xl">
          <span className="text-accent font-bold uppercase tracking-widest text-sm mb-6 block">Portfolio</span>
          <h1 className="text-5xl md:text-7xl font-serif text-primary leading-[1.1] mb-8">
            Proof is in the performance.
          </h1>
          <p className="text-xl text-body leading-relaxed">
            Take a look at the live campaigns we are currently managing. No mockups, no fake data—just real engagement from real local customers.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-themeborder mb-32 bg-surface shadow-sm rounded-3xl overflow-hidden">
          {portfolioLinks.map(link => (
            <div
              key={link.id}
              className="instagram-card group border-b border-r border-themeborder p-10 lg:p-14 bg-surface hover:bg-raised transition-all duration-300 flex flex-col justify-between"
              style={{ borderLeft: '3px solid transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderLeft = '3px solid var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderLeft = '3px solid transparent' }}
            >
              {/* The embedded preview */}
              <div className="instagram-preview-space flex-grow w-full mb-6 rounded-xl overflow-hidden relative flex items-center justify-center min-h-[300px]">
                {link.url.includes("instagram.com") && (
                  <blockquote 
                      className="instagram-media" 
                      data-instgrm-permalink={`${link.url.split('?')[0]}?utm_source=ig_embed&amp;utm_campaign=loading`}
                      data-instgrm-version="14"
                      style={{ width: '100%', margin: '0 auto', background: '#FFF', border: 0, borderRadius: '3px', boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)', minWidth: '326px', maxWidth: '540px' }}
                  >
                  </blockquote>
                )}
              </div>
              
              <div>
                <span className="campaign-tag text-xs font-bold uppercase tracking-widest text-muted group-hover:text-accent transition-colors block mb-2">
                  Instagram Campaign
                </span>
                <h3 className="text-2xl lg:text-3xl font-serif text-primary group-hover:text-accent transition-colors mb-4">
                  {link.title}
                </h3>
                
                {/* Your normal link at the bottom */}
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="live-post-link text-sm font-medium text-primary underline group-hover:text-accent transition-colors">
                  View Live Post
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canva Banner */}
      <div className="p-12 lg:p-24 flex flex-col md:flex-row items-center justify-between gap-10 border-t border-themeborder" style={{ background: 'var(--bg-section)' }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-4 block">Physical Assets</span>
            <h2 className="text-3xl lg:text-5xl font-serif text-primary mb-6">Print & Graphic Work</h2>
            <p className="text-body text-lg max-w-xl">
              Beyond social media, we design physical posters, menus, and robust brand identities that people actually remember.
            </p>
          </div>
          <a
            href="https://pashvinderphotoshop.my.canva.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-5 text-sm font-bold uppercase tracking-widest transition-all duration-300 rounded-2xl border-2 bg-[#3c06cf] border-[#3c06cf] text-white hover:bg-transparent hover:text-[#3c06cf] whitespace-nowrap"
          >
            View Design Portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
