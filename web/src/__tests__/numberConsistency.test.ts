// Portions of this code were generated with AI assistance (see docs/AI_DISCLOSURE.md)
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Cross-artifact Number Consistency Unit Tests', () => {
  it('Earth LOS, Sun, Joint, and Outage statistics agree across stats.json and pitch numbers', () => {
    const statsPath = path.resolve(__dirname, '../../public/data/test-location/stats.json');
    const pitchPath = path.resolve(__dirname, '../../../docs/pitch_numbers.json');

    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    const pitch = JSON.parse(fs.readFileSync(pitchPath, 'utf-8'));

    // Sun uptime fraction: 0.2271 -> 22.7%
    expect(pitch.sun_uptime_fraction).toBeCloseTo(stats.sun.uptime_fraction, 4);
    expect(pitch.sun_uptime_pct).toBe(`${(stats.sun.uptime_fraction * 100).toFixed(1)}%`);

    // Earth LOS fraction: 0.3646 -> 36.5% (cause of 36.4% was earlier truncation vs rounding 36.46%)
    expect(pitch.earth_uptime_fraction).toBeCloseTo(stats.earth.uptime_fraction, 4);
    expect(pitch.earth_uptime_pct).toBe('36.5%');
    expect(pitch.earth_uptime_pct).toBe(`${(stats.earth.uptime_fraction * 100).toFixed(1)}%`);

    // Joint uptime fraction: 0.1514 -> 15.1%
    expect(pitch.joint_uptime_fraction).toBeCloseTo(stats.joint.uptime_fraction, 4);
    expect(pitch.joint_uptime_pct).toBe(`${(stats.joint.uptime_fraction * 100).toFixed(1)}%`);

    // Longest darkness and Earth outage
    expect(pitch.longest_darkness_h).toBeCloseTo(stats.sun.longest_outage_h, 1);
    expect(pitch.longest_earth_outage_h).toBeCloseTo(stats.earth.longest_outage_h, 1);
  });

  it('no stale 36.4% hardcoded string exists in web views', () => {
    const viewsDir = path.resolve(__dirname, '../views');
    const files = fs.readdirSync(viewsDir);

    for (const file of files) {
      if (file.endsWith('.tsx')) {
        const content = fs.readFileSync(path.join(viewsDir, file), 'utf-8');
        expect(content).not.toContain('36.4%');
      }
    }
  });
});
