import studioFLogo from '@/assets/studiof-logo.svg';

/** „Powered by STUDIO/F“ – erscheint ausschließlich im Footer (dunkler Grund). */
export function StudioFBadge() {
  return (
    <a
      href="https://www.studio-f.club"
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-2 text-xs text-on-dark/60 transition-colors hover:text-on-dark"
    >
      <span>Powered by</span>
      <img src={studioFLogo} alt="STUDIO/F" className="h-5 w-auto opacity-80" />
    </a>
  );
}
