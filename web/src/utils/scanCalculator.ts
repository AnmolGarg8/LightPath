/**
 * Spatial Scan & Area Illumination Calculator
 * 
 * Complies with docs/PROJECT_RULES.md:
 * - Reuses LPVC binary visibility cube.
 * - Strict wording: "visible", "in line of sight", never "powered" or "connected".
 * - Flags differences smaller than terrain-data uncertainty as not meaningful.
 * - Deterministic, fast in-browser computation across space and time.
 */

import { DecodedVisibilityCube } from './cubeDecoder';
import { VisibilityCubeHeader } from '../types/schemas';

export type ScanMetric = 'sun' | 'earth' | 'joint_dte';

export interface ScanCell {
  x: number;
  y: number;
  valPct: number;
  deltaFromCenterPct: number;
  isMeaningful: boolean;
  offsetDxM: number;
  offsetDyM: number;
  distanceFromCenterM: number;
  slopeDeg: number;
  isTraversable: boolean;
}

export interface ScanOptions {
  metric: ScanMetric;
  threshold?: number; // Disc fraction [0.0, 1.0], default 0.50
  windowRange?: [number, number]; // [startIdx, endIdx] inclusive
  dteLinkOk?: boolean[]; // Array of length nt, or undefined
  uncertaintyMarginPct?: number; // default 1.5%
}

export interface ScanSummary {
  metric: ScanMetric;
  threshold: number;
  windowRange: [number, number];
  windowStartUtc: string;
  windowEndUtc: string;
  windowHours: number;
  uncertaintyMarginPct: number;
  centerCell: ScanCell;
  bestCell: ScanCell;
  generatedSentence: string;
  top5Cells: (ScanCell & { rank: number })[];
  gridValues: number[][]; // [y][x]
}

/**
 * Formats the exact generated sentence mandated by project rules and prompt:
 * 'Moving from the centre to the best nearby cell changes Earth visibility from X percent to Y percent.'
 */
export function generateScanSentence(
  centerVal: number,
  bestVal: number,
  metric: ScanMetric,
  threshold: number = 0.50,
  uncertaintyMarginPct: number = 1.5
): string {
  const metricLabels: Record<ScanMetric, string> = {
    sun: 'Sun visibility',
    earth: 'Earth visibility',
    joint_dte: 'Sun plus direct-to-Earth contact',
  };
  const label = metricLabels[metric] || `${metric} visibility`;
  const xStr = centerVal.toFixed(1);
  const yStr = bestVal.toFixed(1);
  const delta = bestVal - centerVal;
  const deltaStr = (delta >= 0 ? `+` : ``) + delta.toFixed(1);
  const thresholdPct = Math.round(threshold * 100);

  const baseSentence = `Moving from the centre to the best nearby cell changes ${label} from ${xStr} percent to ${yStr} percent.`;

  if (Math.abs(delta) <= uncertaintyMarginPct) {
    return `${baseSentence} (Difference of ${deltaStr}% is within terrain-data uncertainty of ±${uncertaintyMarginPct.toFixed(1)}%; not meaningful).`;
  }

  return `${baseSentence} (A meaningful difference of ${deltaStr}%; threshold ≥ ${thresholdPct}% disc).`;
}

/**
 * Calculates spatial scan grid and statistics from the visibility cube.
 */
export function computeScanMap(
  cube: DecodedVisibilityCube,
  header: VisibilityCubeHeader,
  options: ScanOptions
): ScanSummary {
  const metric = options.metric;
  const threshold = options.threshold ?? 0.50;
  const uncertaintyMarginPct = options.uncertaintyMarginPct ?? 1.5;
  const nt = header.time_utc.length;
  const nx = header.grid.nx;
  const ny = header.grid.ny;
  const spacingM = header.grid.spacing_m;

  const startIdx = Math.max(0, options.windowRange ? options.windowRange[0] : 0);
  const endIdx = Math.min(nt - 1, options.windowRange ? options.windowRange[1] : nt - 1);
  const timeSliceLen = Math.max(1, endIdx - startIdx + 1);

  // Time window timestamps and duration
  const windowStartUtc = header.time_utc[startIdx] || '';
  const windowEndUtc = header.time_utc[endIdx] || '';
  const t0 = new Date(windowStartUtc).getTime();
  const t1 = new Date(windowEndUtc).getTime();
  const windowHours = t1 > t0 ? (t1 - t0) / (1000 * 3600) : timeSliceLen * 1.0;

  const threshVal = Math.round(threshold * 100); // [0, 100]

  const gridValues: number[][] = Array.from({ length: ny }, () => new Array<number>(nx).fill(0));
  const centerCol = Math.floor(nx / 2);
  const centerRow = Math.floor(ny / 2);

  // Step 1: Compute percentage per cell across the time slice
  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      let count = 0;

      for (let t = startIdx; t <= endIdx; t++) {
        if (metric === 'sun') {
          if (cube.getSunFrac(t, r, c) >= threshVal) {
            count++;
          }
        } else if (metric === 'earth') {
          if (cube.getEarthFrac(t, r, c) >= threshVal) {
            count++;
          }
        } else if (metric === 'joint_dte') {
          const sunOk = cube.getSunFrac(t, r, c) >= threshVal;
          const earthOk = cube.getEarthFrac(t, r, c) >= threshVal;
          const dteOk = options.dteLinkOk ? (options.dteLinkOk[t] ?? true) : true;
          if (sunOk && earthOk && dteOk) {
            count++;
          }
        }
      }

      gridValues[r][c] = Number(((count / timeSliceLen) * 100).toFixed(2));
    }
  }

  const centerVal = gridValues[centerRow][centerCol];

  // Step 2: Build cell details and rank
  const allCells: ScanCell[] = [];
  let bestCellCoord = { x: centerCol, y: centerRow };
  let bestVal = centerVal;

  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const val = gridValues[r][c];
      const delta = val - centerVal;
      const dx = (c - centerCol) * spacingM;
      const dy = (r - centerRow) * spacingM;
      const dist = Math.hypot(dx, dy);
      const isMeaningful = Math.abs(delta) > uncertaintyMarginPct;
      const slope = cube.getSlopeDeg(r, c);
      const traversable = cube.isTraversable(r, c);

      const cell: ScanCell = {
        x: c,
        y: r,
        valPct: val,
        deltaFromCenterPct: Number(delta.toFixed(2)),
        isMeaningful,
        offsetDxM: Math.round(dx),
        offsetDyM: Math.round(dy),
        distanceFromCenterM: Math.round(dist),
        slopeDeg: Number(slope.toFixed(1)),
        isTraversable: traversable,
      };

      allCells.push(cell);

      // Best cell selection (highest value, then lower slope, then closer to center)
      if (
        val > bestVal ||
        (Math.abs(val - bestVal) < 1e-4 &&
          dist < Math.hypot((bestCellCoord.x - centerCol) * spacingM, (bestCellCoord.y - centerRow) * spacingM))
      ) {
        bestVal = val;
        bestCellCoord = { x: c, y: r };
      }
    }
  }

  const centerCell: ScanCell = {
    x: centerCol,
    y: centerRow,
    valPct: centerVal,
    deltaFromCenterPct: 0.0,
    isMeaningful: false,
    offsetDxM: 0,
    offsetDyM: 0,
    distanceFromCenterM: 0,
    slopeDeg: Number(cube.getSlopeDeg(centerRow, centerCol).toFixed(1)),
    isTraversable: cube.isTraversable(centerRow, centerCol),
  };

  const bestCell = allCells.find((c) => c.x === bestCellCoord.x && c.y === bestCellCoord.y) || centerCell;

  // Sort descending by valPct, break ties by slope and distance
  const sortedCells = [...allCells].sort((a, b) => {
    if (Math.abs(b.valPct - a.valPct) > 1e-4) {
      return b.valPct - a.valPct;
    }
    if (Math.abs(a.slopeDeg - b.slopeDeg) > 0.1) {
      return a.slopeDeg - b.slopeDeg;
    }
    return a.distanceFromCenterM - b.distanceFromCenterM;
  });

  const top5Cells = sortedCells.slice(0, 5).map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));

  const generatedSentence = generateScanSentence(
    centerVal,
    bestVal,
    metric,
    threshold,
    uncertaintyMarginPct
  );

  return {
    metric,
    threshold,
    windowRange: [startIdx, endIdx],
    windowStartUtc,
    windowEndUtc,
    windowHours: Number(windowHours.toFixed(1)),
    uncertaintyMarginPct,
    centerCell,
    bestCell,
    generatedSentence,
    top5Cells,
    gridValues,
  };
}
