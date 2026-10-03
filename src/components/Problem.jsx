import FadeSection from './FadeSection';

export default function Problem() {
  const problems = [
    {
      title: "Random Posting",
      desc: "They post randomly, follow irrelevant trends, and get zero measurable business results."
    },
    {
      title: "Overpriced Agencies",
      desc: "Big agencies charge ₹30,000+ for basic graphic templates that look like everyone else."
    },
    {
      title: "Zero Analytics",
      desc: "No one tracks what's actually working to drive footfall to your physical location."
    }
  ];

  return (
    <FadeSection className="py-32 px-6 lg:px-12 border-y border-themeborder min-h-screen flex items-center" style={{ background: 'var(--bg-section)' }}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div>
          <span className="text-accent font-bold uppercase tracking-widest text-sm mb-6 block">The Reality</span>
          <h2 className="text-4xl lg:text-6xl font-serif text-primary mb-8 leading-[1.1]">
            Most local businesses are invisible online.
          </h2>
          <p className="text-xl text-body max-w-md leading-relaxed">
            You have a great product, but your social media looks exactly like your competitors. You're wasting time on content that doesn't convert into actual footfall.
          </p>
        </div>
        
        <div className="flex flex-col gap-6">
          {problems.map((prob, idx) => (
            <div 
              key={idx} 
              className="p-8 border rounded-2xl transition-all duration-200 hover:scale-[1.02]"
              style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
            >
              <h3 className="text-2xl font-serif text-primary mb-3 flex items-center gap-3">
                <span className="text-accent opacity-50">0{idx + 1}</span>
                {prob.title}
              </h3>
              <p className="text-muted leading-relaxed pl-10">{prob.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </FadeSection>
  );
}
