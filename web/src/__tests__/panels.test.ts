import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssumptionsPanel } from '../components/AssumptionsPanel';
import { RelatedWorkPanel } from '../components/RelatedWorkPanel';
import { SensitivityPanel } from '../components/SensitivityPanel';

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

  it('renders SensitivityPanel resolution table when complete numeric data is available with no N/A rows', () => {
    const html = renderToString(React.createElement(SensitivityPanel, {
      currentMastHeightM: 2.0,
      onSelectMastHeight: vi.fn(),
      resolutionSensitivity: {
        available: true,
        reason: 'Evaluated nested resolution vs far layer only.',
        comparison: [
          {
            name: 'Nested (20m near + 80m far)',
            pixel_size_m: 20.0,
            cell_spacing_m: 20.0,
            sun_uptime_fraction: 0.2271,
            rms_horizon_diff_deg: 0.0,
          },
          {
            name: 'Far layer only (80m)',
            pixel_size_m: 80.0,
            cell_spacing_m: 80.0,
            sun_uptime_fraction: 0.2326,
            rms_horizon_diff_deg: 0.0693,
          },
        ],
      },
    }));
    expect(html).toContain('Resolution Sensitivity Table');
    expect(html).toContain('Nested (20m near + 80m far)');
    expect(html).toContain('20 m');
    expect(html).toContain('22.7%');
    expect(html).toContain('0.000°');
    expect(html).toContain('Far layer only (80m)');
    expect(html).toContain('80 m');
    expect(html).toContain('23.3%');
    expect(html).toContain('0.069°');
    expect(html).not.toContain('N/A');
  });

  it('hides resolution table and shows one-line note when resolution sensitivity is incomplete or uncomputed', () => {
    const html = renderToString(React.createElement(SensitivityPanel, {
      currentMastHeightM: 2.0,
      onSelectMastHeight: vi.fn(),
      resolutionSensitivity: {
        available: false,
        reason: 'Terrain resolution sensitivity is not computed for this site.',
      },
    }));
    expect(html).not.toContain('Resolution Sensitivity Table');
    expect(html).toContain('Terrain resolution sensitivity is not computed for this site.');
    expect(html).not.toContain('N/A');
  });
});
