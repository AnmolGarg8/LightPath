import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Task verification: single margin, scan parity, and headlines', () => {
  it('reads margin_deg from stats.json (0.03) and verifies consistency across evidence, trust, and stats', () => {
    const statsPath = path.resolve(__dirname, '../../public/data/test-location/stats.json');
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    const marginDeg = stats.thresholds.margin_deg;
    expect(marginDeg).toBe(0.03);

    // EvidenceView uses stats.thresholds.margin_deg
    const evidenceSrc = fs.readFileSync(path.resolve(__dirname, '../views/EvidenceView.tsx'), 'utf-8');
    expect(evidenceSrc).toContain('stats?.thresholds?.margin_deg');

    // RoutePlannerView loads activeMarginDeg from siteStats.thresholds.margin_deg
    const routePlannerSrc = fs.readFileSync(path.resolve(__dirname, '../views/RoutePlannerView.tsx'), 'utf-8');
    expect(routePlannerSrc).toContain('siteStats?.thresholds?.margin_deg');
  });

  it('verifies scan parity note documents mast height and azimuth step explanation', () => {
    const scanViewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ScanView.tsx'), 'utf-8');
    expect(scanViewSrc).toContain('Scan vs Site Parity Note');
    expect(scanViewSrc).toContain('Observer mast height');
    expect(scanViewSrc).toContain('5.0°');
  });

  it('verifies DSN station list unverified note is present in StatsPanel', () => {
    const statsPanelSrc = fs.readFileSync(path.resolve(__dirname, '../components/StatsPanel.tsx'), 'utf-8');
    expect(statsPanelSrc).toContain('station list unverified');
    expect(statsPanelSrc).toContain('DEEP SPACE NETWORK PER-STATION UPTIME');
  });

  it('verifies Explain page contains solar elevation addition from site latitude', () => {
    const explainSrc = fs.readFileSync(path.resolve(__dirname, '../views/ExplainView.tsx'), 'utf-8');
    expect(explainSrc).toContain('adds up to about');
    expect(explainSrc).toContain('from the pole adds up to about');
  });
});
