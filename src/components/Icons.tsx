import type { SVGProps } from 'react';

/** Feine goldene Linien-Icons (24×24, Strichstärke 1.25). */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const IconPeople = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <circle cx="17" cy="9" r="2.3" />
    <path d="M15.6 14.2c2.5.1 4.3 1.7 4.9 4.8" />
  </Icon>
);

export const IconHut = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.5 11 12 4l9.5 7" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M10 20v-5h4v5" />
    <path d="M7 12.5h2M15 12.5h2" />
  </Icon>
);

export const IconCoin = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
    <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </Icon>
);

export const IconService = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 17h18" />
    <path d="M5 17a7 7 0 0 1 14 0" />
    <path d="M12 8V6.5M10.5 6.5h3" />
    <path d="M7 20h10" />
  </Icon>
);

export const IconBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="7.5" width="18" height="12" rx="1.5" />
    <path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2" />
    <path d="M3 12.5h18" />
  </Icon>
);

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Icon>
);

export const IconGlasses = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 3h5l-.5 5a2 2 0 0 1-4 0Z" />
    <path d="M8.5 10v8M6 18h5" />
    <path d="M13 3h5l-.5 5a2 2 0 0 1-4 0Z" />
    <path d="M15.5 10v8M13 18h5" />
  </Icon>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);
