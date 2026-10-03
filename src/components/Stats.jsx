import { useEffect, useRef } from 'react';
import { founderBio } from '../utils/data';
import { useInView, useReducedMotion, animate } from 'framer-motion';
import FadeSection from './FadeSection';

function Counter({ from, to, duration = 2 }) {
  const nodeRef = useRef();
  const inView = useInView(nodeRef, { once: true, margin: "-100px" });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (inView) {
      if (shouldReduceMotion) {
        nodeRef.current.textContent = to;
        return;
      }
      
      const controls = animate(from, to, {
        duration,
        ease: "easeOut",
        onUpdate(value) {
          if (nodeRef.current) {
            nodeRef.current.textContent = Math.floor(value);
          }
        }
      });
      return () => controls.stop();
    }
  }, [from, to, duration, inView, shouldReduceMotion]);

  return <span ref={nodeRef}>{from}</span>;
}

export default function Stats() {
  return (
    <FadeSection className="py-32 px-6 lg:px-12 bg-section border-y border-themeborder min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32 border-b border-themeborder pb-20">
          <div className="flex flex-col items-center text-center">
            <div className="mb-2" style={{ color: 'var(--accent)', fontSize: '3.5rem', fontWeight: '700' }}>
              <Counter from={0} to={5} duration={1.5} />M+
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-muted">Organic Reach</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-2" style={{ color: 'var(--accent)', fontSize: '3.5rem', fontWeight: '700' }}>
              <Counter from={0} to={30} duration={2} />+
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-muted">Local Brands Scaled</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-2" style={{ color: 'var(--accent)', fontSize: '3.5rem', fontWeight: '700' }}>
              <Counter from={0} to={400} duration={2.5} />%
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-muted">Avg. Engagement Jump</div>
          </div>
        </div>

        {/* Founder Bio */}
        <div className="bg-surface p-10 lg:p-16 border border-themeborder shadow-sm rounded-3xl">
          <div className="max-w-4xl">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4">About The Founder</h2>
            <h3 className="text-3xl md:text-4xl font-serif text-primary mb-6">Pashvinder Dhiman</h3>
            <div className="w-12 h-1 bg-accent mb-8 rounded-full"></div>
            <p className="text-lg md:text-xl text-body leading-relaxed font-medium">
              {founderBio}
            </p>
          </div>
        </div>
      </div>
    </FadeSection>
  );
}
