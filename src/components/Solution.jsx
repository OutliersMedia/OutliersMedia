import { useState } from 'react';
import { motion } from 'framer-motion';
import FadeSection from './FadeSection';

export default function Solution() {
  const [flipped, setFlipped] = useState({});

  const solutions = [
    {
      title: "Content that converts",
      desc: "Reels, posts, and stories built specifically for your local audience, not vanity metrics.",
      details: "We analyze local trends, utilize professional filming and editing techniques, and structure every piece of content to maximize audience retention and lead generation."
    },
    {
      title: "Designs that stop the scroll",
      desc: "Posters, graphics, and gamified stories that command attention and build brand loyalty.",
      details: "Our design team creates visually stunning static posts and interactive stories that establish your brand identity and encourage sharing among the community."
    },
    {
      title: "Strategy that scales",
      desc: "Google Maps, WhatsApp, website integration — establishing a full-stack digital presence.",
      details: "Beyond Instagram, we optimize your Google Business Profile for local SEO and build automated WhatsApp funnels to turn digital interactions into real-world customers."
    }
  ];

  const handleFlip = (idx) => {
    setFlipped(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <FadeSection className="py-32 px-6 lg:px-12 bg-base min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center mb-24 text-center">
          <span className="text-accent font-bold uppercase tracking-widest text-sm mb-4 block">The Outliers Approach</span>
          <h2 className="text-4xl lg:text-6xl font-serif text-primary max-w-3xl leading-[1.1]">
            We turn your social media into your best salesperson.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {solutions.map((sol, idx) => (
            <div 
              key={idx} 
              className="relative w-full aspect-square cursor-pointer group"
              onClick={() => handleFlip(idx)}
              style={{ perspective: 1000 }}
            >
              <motion.div 
                className="w-full h-full relative"
                initial={false}
                animate={{ rotateY: flipped[idx] ? 180 : 0 }}
                transition={{ duration: 0.8, type: "tween", ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Front Side */}
                <div 
                  className="absolute inset-0 p-10 lg:p-14 flex flex-col justify-between bg-glass backdrop-blur-md border border-glass-border rounded-3xl shadow-lg transition-all duration-300 hover:border-accent hover:-translate-y-2"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-5xl font-serif text-muted group-hover:text-accent transition-colors duration-300">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif text-primary mb-4 leading-snug group-hover:text-accent transition-colors">{sol.title}</h3>
                    <p className="text-body leading-relaxed">{sol.desc}</p>
                  </div>
                </div>

                {/* Back Side */}
                <div 
                  className="absolute inset-0 p-10 lg:p-14 flex flex-col justify-center bg-glass backdrop-blur-md border border-accent rounded-3xl shadow-lg"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <h3 className="text-2xl font-serif text-accent mb-4 leading-snug">{sol.title}</h3>
                  <p className="text-body leading-relaxed">{sol.details}</p>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </FadeSection>
  );
}
