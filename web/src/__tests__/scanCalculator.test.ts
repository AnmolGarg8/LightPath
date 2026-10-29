import { describe, it, expect } from 'vitest';
import {
  computeScanMap,
  generateScanSentence,
} from '../utils/scanCalculator';
import { DecodedVisibilityCube } from '../utils/cubeDecoder';
import { VisibilityCubeHeader } from '../types/schemas';

describe('scanCalculator Unit Tests', () => {
  const nx = 5;
  const ny = 5;
  const nt = 4;

  const mockHeader: VisibilityCubeHeader = {
    grid: {
      origin: [0, 0],
      spacing_m: 40.0,
      nx,
      ny,
    },
    time_utc: [
      '2026-11-01T00:00:00Z',
      '2026-11-01T01:00:00Z',
      '2026-11-01T02:00:00Z',
      '2026-11-01T03:00:00Z',
    ],
    sun_frac: [],
    earth_frac: [],
    slope_deg: [],
    traversable: [],
    flags: ['SYNTHETIC_TEST'],
  };

  // Mock DecodedVisibilityCube with controlled cell patterns
  // Center is (2, 2).
  // Cell (2, 2) has Sun: [100, 100, 0, 0] -> 50%
  // Cell (0, 0) has Sun: [100, 100, 100, 0] -> 75% (+25% meaningful gain)
  // Cell (1, 1) has Sun: [100, 100, 0, 0] -> 50% (0% delta, not meaningful)
  // Cell (4, 4) has Sun: [100, 100, 100, 100] -> 100% (+50% best)
  const mockCube: DecodedVisibilityCube = {
    version: 1,
    nx,
    ny,
    nt,
    sunFrac: new Uint8Array(nt * ny * nx),
    earthFrac: new Uint8Array(nt * ny * nx),
    slopeDeg: new Uint8Array(ny * nx),
    traversable: new Uint8Array(ny * nx),
    getSunFrac: (t: number, y: number, x: number) => {
      if (x === 4 && y === 4) return 100; // 100% across all t
      if (x === 0 && y === 0) return t < 3 ? 100 : 0; // 75%
      if (x === 2 && y === 2) return t < 2 ? 100 : 0; // 50%
      if (x === 1 && y === 1) return t < 2 ? 100 : 0; // 50%
      return 20; // 0% >= 50 threshold
    },
    getEarthFrac: (t: number, y: number, x: number) => {
      if (x === 2 && y === 2) return 80; // center = 100% above 50%
      if (x === 3 && y === 3) return 90; // best nearby = 100% above 50%
      if (x === 0 && y === 0) return t < 1 ? 80 : 10; // 25% above 50%
      return 70;
    },
    getSlopeDeg: (y: number, x: number) => (x === 4 && y === 4 ? 8.5 : 4.0),
    isTraversable: (_y: number, _x: number) => true,
  };

  it('computes spatial scan map and identifies center and best cells correctly', () => {
    const summary = computeScanMap(mockCube, mockHeader, {
      metric: 'sun',
      threshold: 0.50,
      uncertaintyMarginPct: 1.5,
    });

    expect(summary.metric).toBe('sun');
    expect(summary.threshold).toBe(0.50);

    // Center cell (2, 2)
    expect(summary.centerCell.x).toBe(2);
    expect(summary.centerCell.y).toBe(2);
    expect(summary.centerCell.valPct).toBe(50.0);

    // Best cell (4, 4) with 100%
    expect(summary.bestCell.x).toBe(4);
    expect(summary.bestCell.y).toBe(4);
    expect(summary.bestCell.valPct).toBe(100.0);
    expect(summary.bestCell.deltaFromCenterPct).toBe(50.0);
    expect(summary.bestCell.isMeaningful).toBe(true);

    // Grid dimensions
    expect(summary.gridValues.length).toBe(ny);
    expect(summary.gridValues[0].length).toBe(nx);
  });

  it('flags cells within the terrain-data uncertainty band as not meaningful', () => {
    const summary = computeScanMap(mockCube, mockHeader, {
      metric: 'sun',
      threshold: 0.50,
      uncertaintyMarginPct: 2.0,
    });

    // Cell (1, 1) has delta 0.0% from center (50% - 50%) -> not meaningful
    const cell11 = summary.top5Cells.find((c) => c.x === 1 && c.y === 1);
    if (cell11) {
      expect(cell11.isMeaningful).toBe(false);
    }

    // Cell (0, 0) has delta +25.0% -> meaningful
    const cell00 = summary.top5Cells.find((c) => c.x === 0 && c.y === 0);
    expect(cell00).toBeDefined();
    expect(cell00!.isMeaningful).toBe(true);
  });

  it('generates the exact required sentence matching template with data numbers', () => {
    const sentence = generateScanSentence(64.2, 81.5, 'earth', 0.50, 1.5);

    expect(sentence).toContain(
      'Moving from the centre to the best nearby cell changes Earth visibility from 64.2 percent to 81.5 percent.'
    );
    expect(sentence).toContain('meaningful difference');
    expect(sentence).toContain('threshold ≥ 50% disc');

    // Insignificant difference
    const sentenceInsignif = generateScanSentence(64.2, 65.0, 'earth', 0.50, 1.5);
    expect(sentenceInsignif).toContain(
      'Moving from the centre to the best nearby cell changes Earth visibility from 64.2 percent to 65.0 percent.'
    );
    expect(sentenceInsignif).toContain('not meaningful');
    expect(sentenceInsignif).toContain('within terrain-data uncertainty');
  });

  it('computes joint Sun plus direct-to-Earth contact incorporating DSN link', () => {
    // DTE link ok for first 2 time steps, down for last 2
    const dteLinkOk = [true, true, false, false];

    const summary = computeScanMap(mockCube, mockHeader, {
      metric: 'joint_dte',
      threshold: 0.50,
      dteLinkOk,
    });

    expect(summary.metric).toBe('joint_dte');
    // For cell (4, 4), sun is 100% (all 4 steps), earth is 70% (all 4 steps),
    // but DTE link is only active for steps 0 and 1 -> 2 / 4 = 50.0%
    expect(summary.gridValues[4][4]).toBe(50.0);
  });

  it('produces an accessible top-five ranked table sorted descending', () => {
    const summary = computeScanMap(mockCube, mockHeader, {
      metric: 'sun',
      threshold: 0.50,
    });

    expect(summary.top5Cells.length).toBe(5);
    // Rank 1 must be cell (4, 4) with 100%
    expect(summary.top5Cells[0].rank).toBe(1);
    expect(summary.top5Cells[0].valPct).toBe(100.0);

    // Rank 2 must be cell (0, 0) with 75%
    expect(summary.top5Cells[1].rank).toBe(2);
    expect(summary.top5Cells[1].valPct).toBe(75.0);

    // Monotonic descent of values
    for (let i = 0; i < summary.top5Cells.length - 1; i++) {
      expect(summary.top5Cells[i].valPct).toBeGreaterThanOrEqual(summary.top5Cells[i + 1].valPct);
    }
  });
});
