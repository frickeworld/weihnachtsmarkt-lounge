import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-4xl leading-tight font-semibold sm:text-5xl">{title}</h2>
      <div className="mx-auto mt-5 h-px w-16 bg-gold" aria-hidden="true" />
      {children && <div className="mt-6 text-lg leading-relaxed text-cream/80">{children}</div>}
    </Reveal>
  );
}
