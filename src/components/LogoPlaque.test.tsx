import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoPlaque } from './LogoPlaque';

describe('LogoPlaque', () => {
  it('zeigt das Händler-Logo mit Alternativtext', () => {
    render(<LogoPlaque />);
    expect(screen.getByAltText(/Die Händler/)).toBeInTheDocument();
  });
});
