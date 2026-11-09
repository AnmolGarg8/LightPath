import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from '../components/layout/Header';

describe('Navigation Header & Menu Item Status Enforcement', () => {
  it('disables Mission Replay menu item with explanatory tooltip when no sourced backtest case exists', () => {
    const html = renderToString(React.createElement(Header, { currentRoute: '/' }));

    // Must contain Mission Replay
    expect(html).toContain('Mission Replay');

    // Must be disabled (aria-disabled="true")
    expect(html).toContain('aria-disabled="true"');

    // Must contain explanatory tooltip explaining why
    expect(html).toContain(
      'title="Mission Replay is disabled: no verified historical mission telemetry backtest case is available (Rule 2)"'
    );

    // Must display visual disabled indicator
    expect(html).toContain('(no sourced case)');
  });
});
