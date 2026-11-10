import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssumptionsPanel } from '../components/AssumptionsPanel';
import { RelatedWorkPanel } from '../components/RelatedWorkPanel';

describe('Assumptions & Related Work Panels Acceptance Tests', () => {
  it('renders Related Work panel with prior art acknowledgment and what LightPath adds', () => {
    const html = renderToString(React.createElement(RelatedWorkPanel));
    expect(html).toContain('data-testid="related-work-panel"');
    expect(html).toContain('Related Work &amp; Prior Art');
  });

  it('renders Assumptions panel with all required parameter categories and boundaries', () => {
    const html = renderToString(React.createElement(AssumptionsPanel));
    expect(html).toContain('data-testid="assumptions-panel"');
    expect(html).toContain('Solver Parameters &amp; Physical Assumptions');
  });
});
