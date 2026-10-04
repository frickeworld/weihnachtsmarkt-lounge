import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { groupPhotos } from '@/content/gallery';
import { Gallery } from './Gallery';

describe('groupPhotos', () => {
  it('fasst 800/1600-Versionen zusammen und sortiert nach Dateiname', () => {
    const photos = groupPhotos({
      '../assets/lounge/02-tisch-800.webp': '/a/02s.webp',
      '../assets/lounge/02-tisch-1600.webp': '/a/02l.webp',
      '../assets/lounge/01-abends-1600.webp': '/a/01l.webp',
      '../assets/lounge/01-abends-800.webp': '/a/01s.webp',
      '../assets/lounge/fremd.webp': '/a/x.webp',
    });
    expect(photos.map((p) => [p.name, p.small, p.large])).toEqual([
      ['01-abends', '/a/01s.webp', '/a/01l.webp'],
      ['02-tisch', '/a/02s.webp', '/a/02l.webp'],
    ]);
    expect(photos[0]!.alt).toMatch(/Lounge/);
  });
});

describe('Gallery', () => {
  const photos = groupPhotos({
    'x/01-a-800.webp': '/1s.webp',
    'x/01-a-1600.webp': '/1l.webp',
    'x/02-b-800.webp': '/2s.webp',
    'x/02-b-1600.webp': '/2l.webp',
  });

  it('ist ohne Fotos unsichtbar', () => {
    const { container } = render(<Gallery photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt Fotos und öffnet die Großansicht', () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    render(<Gallery photos={photos} />);
    expect(screen.getByRole('heading', { name: 'So sieht die Lounge aus' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Foto 2 von 2/ }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Foto' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
});
