import studioFLogo from '@/assets/studiof-logo.svg';

/** „Powered by STUDIO/F“ im Footer (dunkler Grund) – gut sichtbar (Wunsch Louis, 04.10.2026). */
export function StudioFBadge() {
  return (
    <a
      href="https://www.studio-f.club"
      target="_blank"
      rel="noopener"
      className="inline-flex flex-col items-center gap-3 text-sm tracking-widest text-on-dark/70 uppercase transition-colors hover:text-on-dark sm:flex-row sm:gap-4"
    >
      <span>Powered by</span>
      <img src={studioFLogo} alt="STUDIO/F" className="h-14 w-auto sm:h-16" />
    </a>
  );
}
