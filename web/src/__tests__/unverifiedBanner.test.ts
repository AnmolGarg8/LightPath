import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DisclaimerBanner } from '../components/layout/DisclaimerBanner';
import { Footer } from '../components/layout/Footer';
import { SiteSelector } from '../components/SiteSelector';
import { TimelineSeriesViewer } from '../components/TimelineSeriesViewer';
import type { SiteSummary } from '../types/schemas';
import type { Series, Stats } from '../types';

describe('Unverified & Synthetic Banner & Badge Compliance', () => {
  it('renders permanent disclaimer banner when isSynthetic is true', () => {
    const html = renderToString(React.createElement(DisclaimerBanner, { isSynthetic: true }));
    expect(html).toContain('data-testid="permanent-disclaimer-banner"');
    expect(html).toContain('PERMANENT NOTICE — SYNTHETIC / UNVERIFIED DATA ACTIVE');
    expect(html).toContain('synthetic demo proving-ground data');
    expect(html).toContain('Sun visibility is not electrical power');
  });

  it('renders permanent disclaimer banner when isUnverified is true', () => {
    const html = renderToString(React.createElement(DisclaimerBanner, { isSynthetic: false, isUnverified: true }));
    expect(html).toContain('data-testid="permanent-disclaimer-banner"');
    expect(html).toContain('PERMANENT NOTICE — SYNTHETIC / UNVERIFIED DATA ACTIVE');
    expect(html).toContain('preliminary simulation data');
  });

  it('does not render disclaimer banner when both isSynthetic and isUnverified are false', () => {
    const html = renderToString(React.createElement(DisclaimerBanner, { isSynthetic: false, isUnverified: false }));
    expect(html).toBe('');
  });

  it('renders unverified badge for unverified sites in SiteSelector', () => {
    const mockSites: SiteSummary[] = [
      {
        id: 'test-unverified-site',
        name: 'Test Unverified Site',
        lat_deg: -89.5,
        lon_deg: 120.0,
        ground_elev_m: -100,
        is_synthetic: true,
        verified: false,
        mission_ids: ['test-m1'],
        source_links: [],
      },
    ];

    const html = renderToString(
      React.createElement(SiteSelector, {
        sites: mockSites,
        selectedSiteId: 'test-unverified-site',
        onSelectSite: () => {},
      })
    );
    expect(html).toContain('data-testid="unverified-site-badge"');
    expect(html).toContain('Unverified');
  });

  it('renders unverified DSN station badge in TimelineSeriesViewer', () => {
    const mockSeries: Series = {
      time_utc: ['2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'],
      sun: {
        az_deg: [0.0, 1.0],
        el_deg: [-0.1, 0.2],
        radius_deg: [0.26, 0.26],
        frac: [0.0, 0.5],
        status: ['robust_blocked', 'robust_visible'],
      },
      earth: {
        az_deg: [180.0, 181.0],
        el_deg: [1.0, 1.1],
        radius_deg: [0.95, 0.95],
        frac: [1.0, 1.0],
        status: ['robust_visible', 'robust_visible'],
        dist_km: [384400, 384400],
      },
      dte: {
        station_names: ['Goldstone (DSS 14)', 'Madrid (DSS 63)', 'Canberra (DSS 43)'],
        station_visible: [
          [true, false, false],
          [false, true, false],
        ],
        link_ok: [true, true],
      },
    };

    const mockStats: Stats = {
      thresholds: {
        min_sun_frac: 0.1,
        min_earth_frac: 0.1,
        ground_station_mask_deg: 6.0,
      },
      sun: { uptime_fraction: 0.5, total_uptime_h: 12.0, longest_window_h: 6.0, longest_outage_h: 6.0, windows: [] },
      earth: { uptime_fraction: 1.0, total_uptime_h: 24.0, longest_window_h: 24.0, longest_outage_h: 0.0, windows: [] },
      dte: { uptime_fraction: 0.8, total_uptime_h: 19.2, longest_window_h: 10.0, longest_outage_h: 2.0, windows: [] },
      joint: { uptime_fraction: 0.4, total_uptime_h: 9.6, longest_window_h: 5.0, longest_outage_h: 7.0, windows: [] },
    };

    const html = renderToString(
      React.createElement(TimelineSeriesViewer, {
        series: mockSeries,
        stats: mockStats,
        currentTimeIdx: 0,
        onSelectTimeIdx: () => {},
      })
    );
    expect(html).toContain('data-testid="unverified-dsn-badge"');
    expect(html).toContain('Unverified');
  });

  it('renders unverified entries count in Footer with link to HUMAN_TODO.md', () => {
    const html = renderToString(React.createElement(Footer));
    expect(html).toContain('data-testid="footer-provenance-status"');
    expect(html).toContain('all entries currently unverified');
    expect(html).toContain('Human Verification Checklist');
    expect(html).toContain('HUMAN_TODO.md');
  });
});
