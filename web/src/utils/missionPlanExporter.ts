/**
 * Export helpers for Multi-Stop Mission Plans (CSV and ICS).
 */

import { MissionPlanResult } from '../types';

export function generateMissionPlanCsv(plan: MissionPlanResult): string {
  const lines = [
    '# LightPath Lunar Mission Plan Export',
    `# Mission: ${plan.mission_name || 'Lunar Sortie'}`,
    `# Feasible: ${plan.feasible}`,
    `# Total Duration: ${plan.metrics.total_duration_h} h | Total Distance: ${plan.metrics.total_distance_m} m`,
    `# Limits: ${plan.limits_disclaimer || 'Geometric Sun and Earth visibility only; no power or link budget.'}`,
    'Event_ID,Type,Label,Start_Step,End_Step,Start_UTC,End_UTC,Duration_h,Min_Sun_Pct,Avg_Sun_Pct,Min_Earth_Pct,Avg_Earth_Pct,Violations',
  ];

  for (const ev of plan.timeline) {
    const vStr = ev.violations.length > 0 ? ev.violations.join('; ') : 'None';
    const vEsc = vStr.includes(',') || vStr.includes(';') ? `"${vStr}"` : vStr;
    lines.push(
      `${ev.event_id},${ev.type},${ev.label},${ev.start_time_idx},${ev.end_time_idx},${ev.start_time_utc},${ev.end_time_utc},${ev.duration_h},${ev.sun_frac_min ?? 0},${ev.sun_frac_avg ?? 0},${ev.earth_frac_min ?? 0},${ev.earth_frac_avg ?? 0},${vEsc}`
    );
  }

  return lines.join('\n') + '\n';
}

export function generateMissionPlanIcs(plan: MissionPlanResult): string {
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LightPath//NASA Space Apps Lunar Mission Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:LightPath - ${plan.mission_name || 'Lunar Sortie'}`,
    'X-LIMITS:Geometric Sun and Earth visibility only; no power or link budget.',
  ];

  const toIcsDate = (iso: string): string => {
    return iso.replace(/[-:]/g, '').split('.')[0] + (iso.endsWith('Z') ? '' : 'Z');
  };

  for (const ev of plan.timeline) {
    let dtstart = toIcsDate(ev.start_time_utc);
    let dtend = toIcsDate(ev.end_time_utc);
    if (dtstart === dtend) {
      const d = new Date(ev.end_time_utc);
      d.setMinutes(d.getMinutes() + 1);
      dtend = toIcsDate(d.toISOString());
    }

    const uid = `${ev.event_id}-${dtstart}@lightpath.lunar`;
    const summary = `[LightPath] ${ev.label}`;
    const desc =
      `Event: ${ev.label}\\n` +
      `Duration: ${ev.duration_h} h\\n` +
      `Sun Illumination: min ${ev.sun_frac_min ?? 0}%, avg ${ev.sun_frac_avg ?? 0}%\\n` +
      `Earth Contact: min ${ev.earth_frac_min ?? 0}%, avg ${ev.earth_frac_avg ?? 0}%\\n` +
      `NOTE: Geometric Sun and Earth visibility only; no power or link budget.` +
      (ev.violations.length > 0 ? `\\nVIOLATIONS: ${ev.violations.join('; ')}` : '');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `STATUS:${ev.violations.length === 0 ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
