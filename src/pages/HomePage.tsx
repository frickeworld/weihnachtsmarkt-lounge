import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LightString } from '@/components/LightString';
import { MobileBookingBar } from '@/components/MobileBookingBar';
import { Snowfall } from '@/components/Snowfall';
import { Booking } from '@/sections/Booking';
import { Directions } from '@/sections/Directions';
import { Experience } from '@/sections/Experience';
import { Faq } from '@/sections/Faq';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Occasions } from '@/sections/Occasions';
import { Pricing } from '@/sections/Pricing';

const Divider = () => <LightString variant="divider" className="opacity-80" />;

export function HomePage() {
  return (
    <>
      <a
        href="#buchen"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:text-night"
      >
        Direkt zur Buchung
      </a>
      <Snowfall />
      <Header />
      <main>
        <Hero />
        <Experience />
        <Occasions />
        <Divider />
        <Pricing />
        <Booking />
        <Divider />
        <HowItWorks />
        <Faq />
        <Directions />
      </main>
      <Footer />
      <MobileBookingBar />
    </>
  );
}
