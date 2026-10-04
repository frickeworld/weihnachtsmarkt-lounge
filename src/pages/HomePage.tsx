import { useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MobileBookingBar } from '@/components/MobileBookingBar';
import { Booking } from '@/sections/Booking';
import { Directions } from '@/sections/Directions';
import { Experience } from '@/sections/Experience';
import { Faq } from '@/sections/Faq';
import { Gallery } from '@/sections/Gallery';
import { Hero } from '@/sections/Hero';
import { Highlights } from '@/sections/Highlights';
import { HowItWorks } from '@/sections/HowItWorks';
import { Market } from '@/sections/Market';
import { Occasions } from '@/sections/Occasions';
import { Pricing } from '@/sections/Pricing';
import { trackPageView } from '@/lib/track';

export function HomePage() {
  useEffect(trackPageView, []);

  // Direktlinks wie /#buchen: Der Browser springt vor dem Rendern ins Leere, daher hier nachholen.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }),
    );
  }, []);

  return (
    <>
      <a
        href="#buchen"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
      >
        Direkt zur Buchung
      </a>
      <Header />
      <main>
        <Hero />
        <Highlights />
        <Experience />
        <Gallery />
        <Occasions />
        <Pricing />
        <HowItWorks />
        <Booking />
        <Market />
        <Faq />
        <Directions />
      </main>
      <Footer />
      <MobileBookingBar />
    </>
  );
}
