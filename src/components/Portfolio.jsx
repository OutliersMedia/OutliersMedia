import { portfolioLinks } from '../utils/data';
import FadeSection from './FadeSection';

export default function Portfolio() {
  return (
    <FadeSection className="py-32 px-6 lg:px-12 bg-base min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-20 flex flex-col md:flex-row md:justify-between md:items-end border-b border-themeborder pb-12">
          <div>
            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-4 block">Our Work</span>
            <h2 className="text-4xl md:text-5xl font-serif text-primary">Live Campaigns</h2>
          </div>
          <p className="text-body max-w-md mt-6 md:mt-0">
            We don't just design; we execute. Here is a selection of recent campaigns currently active on Instagram.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-themeborder rounded-3xl overflow-hidden shadow-sm">
          {portfolioLinks.map(link => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group border-b border-r border-themeborder p-10 bg-surface hover:bg-raised transition-all duration-300 flex flex-col justify-between aspect-square"
              style={{ borderLeft: '3px solid transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderLeft = '3px solid var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderLeft = '3px solid transparent' }}
            >
              <div className="text-xs font-bold uppercase tracking-widest text-muted group-hover:text-accent transition-colors">
                Instagram Campaign
              </div>
              <div>
                <h3 className="text-3xl font-serif text-primary group-hover:text-accent transition-colors mb-4">
                  {link.title}
                </h3>
                <span className="text-sm font-medium text-primary underline group-hover:text-accent transition-colors">
                  View Live Post
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </FadeSection>
  );
}
