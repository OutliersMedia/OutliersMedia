import ContactForm from '../components/ContactForm';

export default function Contact() {
  return (
    <div className="bg-base overflow-hidden relative">
      <ContactForm />
      
      {/* Map Section */}
      <section className="pb-32 px-6 lg:px-12 bg-base pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="border border-glass-border p-4 bg-glass backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden">
            <h2 className="text-2xl font-serif text-primary mb-6 px-4 pt-4">Our Local Footprint</h2>
            <div className="w-full h-[500px] bg-transparent relative overflow-hidden rounded-2xl">
              <iframe
                title="Tricity Area Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src="https://www.openstreetmap.org/export/embed.html?bbox=76.69006347656251%2C30.600000000000000%2C77.01000000000000%2C30.85000000000000&amp;layer=mapnik&amp;marker=30.7333%2C76.7794"
                style={{ filter: "grayscale(1) contrast(1.2) opacity(0.8) hue-rotate(180deg)" }}
              ></iframe>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
