import { founderBio } from '../utils/data';
import FadeSection from './FadeSection';

export default function Stats() {
  return (
    <FadeSection className="py-24 px-6 lg:px-12 bg-section border-y border-themeborder flex items-center">
      <div className="max-w-7xl mx-auto w-full">
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
