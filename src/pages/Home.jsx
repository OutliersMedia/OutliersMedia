import Hero from '../components/Hero';
import Problem from '../components/Problem';
import Solution from '../components/Solution';
import Packages from '../components/Packages';
import Stats from '../components/Stats';
import ContactForm from '../components/ContactForm';

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <Packages />
      <Stats />
      <ContactForm />
    </>
  );
}
