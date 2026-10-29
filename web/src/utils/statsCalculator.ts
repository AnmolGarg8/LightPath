/**
 * Dynamic stats and window calculator based on user-selected threshold.
 * 
 * Complies with PROJECT_RULES:
 * - Wording: strictly "visible" not "powered", "in line of sight" not "connected".
 * - Every calculated stat preserves its threshold.
 * - Extracts sunrise, sunset, Earthrise, and Earthset crossings.
 */

import { Series } from '../types/schemas';

export interface WindowEntry {
  start_utc: string;
  end_utc: string;
  duration_h: number;
}

export interface DynamicCategoryStats {
  threshold: number;
  uptime_fraction: number;
  total_uptime_h: number;
  windows_count: number;
  windows: WindowEntry[];
  longest_window_h: number;
  longest_outage_h: number;
  longest_outage_window: { start_utc: string; end_utc: string } | null;
}

export interface CelestialEvent {
  type: 'sunrise' | 'sunset' | 'earthrise' | 'earthset';
  time_utc: string;
  az_deg: number;
  el_deg: number;
  fraction: number;
  index: number;
}

export interface DynamicStatsReport {
  threshold: number;
  sun: DynamicCategoryStats;
  earth: DynamicCategoryStats;
  dte: DynamicCategoryStats;
  joint_sun_earth: DynamicCategoryStats;
  joint_sun_dte: DynamicCategoryStats;
  events: CelestialEvent[];
  total_duration_h: number;
}

/**
 * Parses ISO UTC timestamps into step hours.
 */
function getStepHours(timeUtc: string[]): number {
  if (timeUtc.length < 2) return 1.0;
  const t0 = new Date(timeUtc[0]).getTime();
  const t1 = new Date(timeUtc[1]).getTime();
  const diffH = (t1 - t0) / (1000 * 3600);
  return diffH > 0 ? diffH : 1.0;
}

/**
 * Computes uptime, continuous windows, and outages for a boolean series.
 */
function computeCategoryWindows(
  boolSeries: boolean[],
  timeUtc: string[],
  stepH: number,
  threshold: number
): DynamicCategoryStats {
  const n = boolSeries.length;
  if (n === 0) {
    return {
      threshold,
      uptime_fraction: 0,
      total_uptime_h: 0,
      windows_count: 0,
      windows: [],
      longest_window_h: 0,
      longest_outage_h: 0,
      longest_outage_window: null,
    };
  }

  let trueCount = 0;
  const windows: WindowEntry[] = [];
  let inWindow = false;
  let winStartIdx = 0;

  let inOutage = false;
  let outageStartIdx = 0;
  let longestOutageSteps = 0;
  let longestOutageWindow: { start_utc: string; end_utc: string } | null = null;

  for (let i = 0; i < n; i++) {
    const val = boolSeries[i];
    if (val) trueCount++;

    // Window tracking
    if (val && !inWindow) {
      inWindow = true;
      winStartIdx = i;
    } else if (!val && inWindow) {
      inWindow = false;
      const duration = (i - winStartIdx) * stepH;
      windows.push({
        start_utc: timeUtc[winStartIdx],
        end_utc: timeUtc[i - 1],
        duration_h: Number(duration.toFixed(2)),
      });
    }

    // Outage tracking
    if (!val && !inOutage) {
      inOutage = true;
      outageStartIdx = i;
    } else if (val && inOutage) {
      inOutage = false;
      const steps = i - outageStartIdx;
      if (steps > longestOutageSteps) {
        longestOutageSteps = steps;
        longestOutageWindow = {
          start_utc: timeUtc[outageStartIdx],
          end_utc: timeUtc[i - 1],
        };
      }
    }
  }

  // Handle open window at end
  if (inWindow) {
    const duration = (n - winStartIdx) * stepH;
    windows.push({
      start_utc: timeUtc[winStartIdx],
      end_utc: timeUtc[n - 1],
      duration_h: Number(duration.toFixed(2)),
    });
  }

  // Handle open outage at end
  if (inOutage) {
    const steps = n - outageStartIdx;
    if (steps > longestOutageSteps) {
      longestOutageSteps = steps;
      longestOutageWindow = {
        start_utc: timeUtc[outageStartIdx],
        end_utc: timeUtc[n - 1],
      };
    }
  }

  const uptimeFraction = Number((trueCount / n).toFixed(4));
  const totalUptimeH = Number((trueCount * stepH).toFixed(2));
  const longestWindowH = windows.length > 0 ? Math.max(...windows.map((w) => w.duration_h)) : 0;
  const longestOutageH = Number((longestOutageSteps * stepH).toFixed(2));

  return {
    threshold,
    uptime_fraction: uptimeFraction,
    total_uptime_h: totalUptimeH,
    windows_count: windows.length,
    windows,
    longest_window_h: longestWindowH,
    longest_outage_h: longestOutageH,
    longest_outage_window: longestOutageWindow,
  };
}

/**
 * Recomputes all stats across Sun, Earth, DTE and Joint line-of-sight for a given threshold.
 */
export function calculateDynamicStats(series: Series, threshold: number): DynamicStatsReport {
  const stepH = getStepHours(series.time_utc);
  const n = series.time_utc.length;
  const totalDurationH = n * stepH;

  // Boolean availability masks
  const sunAvailable = series.sun.frac.map((f) => f >= threshold);
  const earthAvailable = series.earth.frac.map((f) => f >= threshold);
  const dteAvailable = series.dte.link_ok;
  const jointSunEarth = sunAvailable.map((s, i) => s && earthAvailable[i]);
  const jointSunDte = sunAvailable.map((s, i) => s && dteAvailable[i]);

  const sunStats = computeCategoryWindows(sunAvailable, series.time_utc, stepH, threshold);
  const earthStats = computeCategoryWindows(earthAvailable, series.time_utc, stepH, threshold);
  const dteStats = computeCategoryWindows(dteAvailable, series.time_utc, stepH, threshold);
  const jointSunEarthStats = computeCategoryWindows(jointSunEarth, series.time_utc, stepH, threshold);
  const jointSunDteStats = computeCategoryWindows(jointSunDte, series.time_utc, stepH, threshold);

  // Extract events (crossings)
  const events: CelestialEvent[] = [];
  for (let i = 1; i < n; i++) {
    // Sun events
    const prevSun = series.sun.frac[i - 1] >= threshold;
    const currSun = series.sun.frac[i] >= threshold;
    if (!prevSun && currSun) {
      events.push({
        type: 'sunrise',
        time_utc: series.time_utc[i],
        az_deg: series.sun.az_deg[i],
        el_deg: series.sun.el_deg[i],
        fraction: series.sun.frac[i],
        index: i,
      });
    } else if (prevSun && !currSun) {
      events.push({
        type: 'sunset',
        time_utc: series.time_utc[i],
        az_deg: series.sun.az_deg[i],
        el_deg: series.sun.el_deg[i],
        fraction: series.sun.frac[i],
        index: i,
      });
    }

    // Earth events
    const prevEarth = series.earth.frac[i - 1] >= threshold;
    const currEarth = series.earth.frac[i] >= threshold;
    if (!prevEarth && currEarth) {
      events.push({
        type: 'earthrise',
        time_utc: series.time_utc[i],
        az_deg: series.earth.az_deg[i],
        el_deg: series.earth.el_deg[i],
        fraction: series.earth.frac[i],
        index: i,
      });
    } else if (prevEarth && !currEarth) {
      events.push({
        type: 'earthset',
        time_utc: series.time_utc[i],
        az_deg: series.earth.az_deg[i],
        el_deg: series.earth.el_deg[i],
        fraction: series.earth.frac[i],
        index: i,
      });
    }
  }

  return {
    threshold,
    sun: sunStats,
    earth: earthStats,
    dte: dteStats,
    joint_sun_earth: jointSunEarthStats,
    joint_sun_dte: jointSunDteStats,
    events,
    total_duration_h: totalDurationH,
  };
}
