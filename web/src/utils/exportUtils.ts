/**
 * LightPath Scientific Data & Calendar Export Utilities
 * 
 * Complies with docs/PROJECT_RULES.md:
 * - Deterministic, browser-side file generation (no network calls).
 * - Exports visibility windows as RFC 4180 CSV (start, end, duration, kind).
 * - Exports key astronomical events as RFC 5545 iCalendar (.ics).
 * - Strictly uses 'visible' / 'in line of sight', never 'power' / 'connected'.
 */

import { CelestialEvent, DynamicStatsReport } from './statsCalculator';
import { SiteFull, SiteSummary, RunInfo } from '../types/schemas';

/**
 * Converts ISO 8601 UTC string (e.g. "2026-11-01T12:00:00Z") to iCalendar UTC format ("20261101T120000Z").
 */
export function formatIcsDate(isoUtc: string): string {
  const clean = isoUtc.replace(/[-:]/g, '').split('.')[0];
  if (!clean.endsWith('Z')) {
    return `${clean}Z`;
  }
  return clean;
}

/**
 * Generates an RFC 4180 compliant CSV of all visibility windows and outages.
 */
export function generateWindowsCsv(stats: DynamicStatsReport): string {
  const lines: string[] = [];
  lines.push('start_utc,end_utc,duration_hours,kind,threshold_fraction');

  const threshold = stats.threshold;

  // 1. Sun Visibility Windows
  for (const win of stats.sun.windows) {
    lines.push(`${win.start_utc},${win.end_utc},${win.duration_h.toFixed(2)},sun_visible,${threshold}`);
  }

  // 2. Earth Line-of-Sight Windows
  for (const win of stats.earth.windows) {
    lines.push(`${win.start_utc},${win.end_utc},${win.duration_h.toFixed(2)},earth_line_of_sight,${threshold}`);
  }

  // 3. Direct-to-Earth Contact Windows
  for (const win of stats.dte.windows) {
    lines.push(`${win.start_utc},${win.end_utc},${win.duration_h.toFixed(2)},direct_to_earth_contact,${threshold}`);
  }

  // 4. Joint Sun and DTE Windows
  for (const win of stats.joint_sun_dte.windows) {
    lines.push(`${win.start_utc},${win.end_utc},${win.duration_h.toFixed(2)},joint_sun_and_dte_contact,${threshold}`);
  }

  // 5. Darkness Outage Windows
  if (stats.sun.longest_outage_window) {
    lines.push(
      `${stats.sun.longest_outage_window.start_utc},${stats.sun.longest_outage_window.end_utc},${stats.sun.longest_outage_h.toFixed(2)},longest_darkness_spell,${threshold}`
    );
  }

  // 6. Earth Outage Windows
  if (stats.earth.longest_outage_window) {
    lines.push(
      `${stats.earth.longest_outage_window.start_utc},${stats.earth.longest_outage_window.end_utc},${stats.earth.longest_outage_h.toFixed(2)},longest_earth_outage,${threshold}`
    );
  }

  return lines.join('\r\n');
}

/**
 * Generates an RFC 5545 standard iCalendar (.ics) file with key lunar celestial events.
 */
export function generateEventsIcs(
  siteName: string,
  events: CelestialEvent[],
  stats: DynamicStatsReport
): string {
  const lines: string[] = [];
  const nowStamp = formatIcsDate(new Date().toISOString());

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//NASA Space Apps 2026//LightPath Mission Browser//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:LightPath - ${siteName} Lunar Events`);
  lines.push(`X-WR-TIMEZONE:UTC`);

  // Event titles mapping
  const eventTitleMap: Record<string, string> = {
    sunrise: 'Lunar Sunrise Event',
    sunset: 'Lunar Sunset Event',
    earthrise: 'Earthrise Event',
    earthset: 'Earthset Event',
  };

  events.forEach((ev, idx) => {
    const dtStart = formatIcsDate(ev.time_utc);
    // 1-hour nominal event block
    const endDate = new Date(new Date(ev.time_utc).getTime() + 3600 * 1000).toISOString();
    const dtEnd = formatIcsDate(endDate);
    const title = eventTitleMap[ev.type] || 'Celestial Event';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:lightpath-${siteName}-${ev.type}-${idx}@spaceapps2026`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${title} at ${siteName}`);
    lines.push(
      `DESCRIPTION:${title} crossing at Azimuth ${ev.az_deg.toFixed(1)} deg, Elevation ${ev.el_deg.toFixed(2)} deg. Threshold >= ${Math.round(stats.threshold * 100)}% disc fraction. Wording notice: Sun visibility is not electrical power.`
    );
    lines.push(`LOCATION:${siteName} (Moon South Pole)`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  // Longest Darkness Outage as a dedicated calendar block
  if (stats.sun.longest_outage_window && stats.sun.longest_outage_h > 0) {
    const dStart = formatIcsDate(stats.sun.longest_outage_window.start_utc);
    const dEnd = formatIcsDate(stats.sun.longest_outage_window.end_utc);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:lightpath-${siteName}-longest-darkness@spaceapps2026`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dStart}`);
    lines.push(`DTEND:${dEnd}`);
    lines.push(`SUMMARY:Longest Continuous Darkness Spell (${stats.sun.longest_outage_h.toFixed(1)}h) at ${siteName}`);
    lines.push(
      `DESCRIPTION:Critical darkness interval lasting ${stats.sun.longest_outage_h.toFixed(1)} hours. Sun disc fraction remains strictly below ${Math.round(stats.threshold * 100)}%. Battery storage and survival heating planning required.`
    );
    lines.push(`LOCATION:${siteName} (Moon South Pole)`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a native browser file download for a generated text string.
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an academic / mission planning BibTeX citation string.
 */
export function generateCitationText(
  site: SiteSummary | SiteFull,
  runInfo?: RunInfo | null
): string {
  const commit = runInfo?.git_commit ? runInfo.git_commit.slice(0, 8) : '2026';
  const year = '2026';

  return `@misc{lightpath_${site.id}_${year},
  author = {NASA Space Apps Challenge 2026 Team LightPath},
  title = {LightPath: Topocentric Illumination and Direct-to-Earth Line-of-Sight Analysis for ${site.name}},
  year = {${year}},
  howpublished = {\\url{https://github.com/AnmolGarg8/LightPath}},
  note = {Site Coordinates: ${site.lat_deg.toFixed(3)} deg Lat, ${site.lon_deg.toFixed(3)} deg Lon (MOON_ME). Commit: ${commit}. LOLA Datum R=1737.4 km}
}`;
}
