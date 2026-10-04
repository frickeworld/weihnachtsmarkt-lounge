import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HaendlerLogo } from './HaendlerLogo';

describe('HaendlerLogo', () => {
  it('zeigt das Händler-Logo mit Alternativtext', () => {
    render(<HaendlerLogo />);
    expect(screen.getByAltText(/Die Händler/)).toBeInTheDocument();
  });
});
