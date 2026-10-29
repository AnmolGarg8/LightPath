import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Badge } from '../components/ui/Badge';

describe('Badge Component Rendering & Accessibility', () => {
  it('renders visible status badge with label and symbol', () => {
    const html = renderToString(React.createElement(Badge, { variant: 'visible', label: 'ROBUST VISIBLE' }));
    expect(html).toContain('ROBUST VISIBLE');
    expect(html).toContain('●');
    expect(html).toContain('data-testid="badge"');
  });

  it('renders marginal status badge', () => {
    const html = renderToString(React.createElement(Badge, { variant: 'marginal', label: 'MARGINAL (±0.1°)' }));
    expect(html).toContain('MARGINAL (±0.1°)');
    expect(html).toContain('▲');
  });

  it('renders blocked status badge', () => {
    const html = renderToString(React.createElement(Badge, { variant: 'blocked', label: 'BLOCKED' }));
    expect(html).toContain('BLOCKED');
    expect(html).toContain('■');
  });

  it('renders synthetic flag badge', () => {
    const html = renderToString(React.createElement(Badge, { variant: 'synthetic', label: 'SYNTHETIC' }));
    expect(html).toContain('SYNTHETIC');
    expect(html).toContain('✦');
  });

  it('renders children node when provided', () => {
    const html = renderToString(
      React.createElement(Badge, { variant: 'sun' }, React.createElement('span', null, 'Solar Flux Active'))
    );
    expect(html).toContain('Solar Flux Active');
    expect(html).toContain('☼');
  });
});
