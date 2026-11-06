import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HomeView } from '../views/HomeView';
import fs from 'fs';
import path from 'path';

describe('First Screen & Demo Polish Acceptance Tests', () => {
  it('renders exact one-sentence purpose on the Home screen', () => {
    const html = renderToString(React.createElement(HomeView));
    const expectedSentence =
      'Every tool tells you when a lunar site has light; LightPath tells you whether you can still get there before it goes.';
    expect(html).toContain(expectedSentence);
  });

  it('contains one primary "Try the demo" action button leading to prepared route scenario', () => {
    const html = renderToString(React.createElement(HomeView));
    expect(html).toContain('data-testid="try-the-demo-btn"');
    expect(html).toContain('href="#/route/shackleton-connecting-ridge"');
    expect(html).toContain('Try the demo');
    expect(html).toContain('Prepared scenario: 1.4 km rover traverse under moving South Pole crater shadows');
  });

  it('enforces consistency of wording across app: visible not powered; in line of sight not connected', () => {
    const homeHtml = renderToString(React.createElement(HomeView));
    // Check that home screen does not claim power or connection
    expect(homeHtml.toLowerCase()).not.toContain('electrically powered');
    expect(homeHtml.toLowerCase()).not.toContain('network connected');

    // Read index.css to verify print and mobile rules
    const cssPath = path.resolve(__dirname, '..', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Print stylesheet
    expect(cssContent).toContain('@media print');
    expect(cssContent).toContain('#route-evidence-printable-card');
    expect(cssContent).toContain('page-break-inside: avoid');

    // Responsive layout at 360px
    expect(cssContent).toContain('.planner-workspace-grid');
    expect(cssContent).toContain('.light-budget-strip-container');
    expect(cssContent).toContain('min-height: 44px');
  });
});
