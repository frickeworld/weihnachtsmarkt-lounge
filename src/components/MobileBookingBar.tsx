import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { formatCents } from '@/lib/money';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

/** Feste Leiste unten (nur mobil): erscheint, sobald der Hero weg ist, verschwindet bei #buchen. */
export function MobileBookingBar() {
  const settings = useSettings();
  const [heroVisible, setHeroVisible] = useState(true);
  const [bookingVisible, setBookingVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('start');
    const booking = document.getElementById('buchen');
    if (!hero || !booking) return;
    const ioHero = new IntersectionObserver(([e]) => setHeroVisible(e!.isIntersecting), {
      threshold: 0.05,
    });
    const ioBooking = new IntersectionObserver(([e]) => setBookingVisible(e!.isIntersecting), {
      threshold: 0,
    });
    ioHero.observe(hero);
    ioBooking.observe(booking);
    return () => {
      ioHero.disconnect();
      ioBooking.disconnect();
    };
  }, []);

  const show = !heroVisible && !bookingVisible;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 z-40 bg-brown/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
        >
          <a href="#buchen" onClick={trackBookClick} className="btn-gold w-full">
            Lounge buchen · {formatCents(totalCents(settings))}
          </a>
        </m.div>
      )}
    </AnimatePresence>
  );
}
