import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { formatCents } from '@/lib/money';
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
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {/* Ohne Balken (Louis, 04.10.2026): Der Button schwebt mit Schatten über der Seite. */}
          <a
            href="#buchen"
            onClick={trackBookClick}
            className="btn-gold pointer-events-auto w-full shadow-[0_12px_32px_-8px_rgba(36,34,30,0.55)]"
          >
            Lounge buchen · {formatCents(settings.priceCents)}
          </a>
        </m.div>
      )}
    </AnimatePresence>
  );
}
