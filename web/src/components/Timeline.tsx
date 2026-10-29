/**
 * Timeline Multi-Lane Viewer
 * 
 * Requirement 4:
 * - Two lanes (Sun, Earth) plus a third lane for direct-to-Earth contact.
 * - Visible fraction over time.
 * - Marginal intervals shaded with a pattern.
 * - Sunrise, sunset, Earthrise and Earthset markers.
 * - Longest outage annotated.
 * - Synchronised time cursor with the panorama.
 * - Date-range brush for window zooming.
 */

import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Series } from '../types/schemas';
import { CelestialEvent, DynamicCategoryStats } from '../utils/statsCalculator';

interface TimelineProps {
  series: Series;
  timeIndex: number;
  onTimeChange: (newIndex: number) => void;
  threshold: number;
  sunStats: DynamicCategoryStats;
  earthStats: DynamicCategoryStats;
  events: CelestialEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({
  series,
  timeIndex,
  onTimeChange,
  threshold,
  sunStats,
  earthStats,
  events,
}) => {
  const n = series.time_utc.length;

  // Date-range brush state [startIndex, endIndex]
  const [brushRange, setBrushRange] = useState<[number, number]>([0, Math.max(1, n - 1)]);

  const [brushStart, brushEnd] = brushRange;
  const visibleSteps = Math.max(2, brushEnd - brushStart + 1);

  // SVG Geometry Dimensions
  const svgWidth = 1000;
  const laneHeight = 65;
  const laneSpacing = 16;
  const headerHeight = 24;
  const brushHeight = 32;
  const totalSvgHeight = headerHeight + laneHeight * 3 + laneSpacing * 2 + brushHeight + 40;

  // Coordinate mapping for visible brushed window
  const getX = (idx: number) => {
    if (idx < brushStart) return 0;
    if (idx > brushEnd) return svgWidth;
    return ((idx - brushStart) / (visibleSteps - 1)) * svgWidth;
  };

  // Full timeline coordinate mapping (for the mini-brush at the bottom)
  const getBrushX = (idx: number) => (idx / (n - 1)) * svgWidth;

  // Build SVG Paths for Lane 1 (Sun) and Lane 2 (Earth)
  const sunPoints = useMemo(() => {
    const pts: { x: number; y: number; frac: number; status: string }[] = [];
    for (let i = brushStart; i <= brushEnd; i++) {
      const frac = series.sun.frac[i] ?? 0;
      const x = getX(i);
      // y is inverted within the lane (0 at bottom, 1 at top)
      const y = laneHeight - frac * (laneHeight - 12) - 4;
      pts.push({ x, y, frac, status: series.sun.status[i] });
    }
    return pts;
  }, [series, brushStart, brushEnd, visibleSteps]);

  const earthPoints = useMemo(() => {
    const pts: { x: number; y: number; frac: number; status: string }[] = [];
    for (let i = brushStart; i <= brushEnd; i++) {
      const frac = series.earth.frac[i] ?? 0;
      const x = getX(i);
      const y = laneHeight - frac * (laneHeight - 12) - 4;
      pts.push({ x, y, frac, status: series.earth.status[i] });
    }
    return pts;
  }, [series, brushStart, brushEnd, visibleSteps]);

  // Construct SVG Area and Line Paths
  const buildAreaPath = (pts: { x: number; y: number }[], baseLaneY: number) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${baseLaneY + laneHeight}`;
    pts.forEach((p) => {
      d += ` L ${p.x} ${baseLaneY + p.y}`;
    });
    d += ` L ${pts[pts.length - 1].x} ${baseLaneY + laneHeight} Z`;
    return d;
  };

  const buildLinePath = (pts: { x: number; y: number }[], baseLaneY: number) => {
    if (pts.length === 0) return '';
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${baseLaneY + p.y}`, '');
  };

  const sunBaseY = headerHeight;
  const earthBaseY = sunBaseY + laneHeight + laneSpacing;
  const dteBaseY = earthBaseY + laneHeight + laneSpacing;
  const miniBrushBaseY = dteBaseY + laneHeight + laneSpacing;

  // Handle timeline click to jump time
  const handleTimelineClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetIdx = Math.round(brushStart + ratio * (visibleSteps - 1));
    onTimeChange(Math.max(0, Math.min(n - 1, targetIdx)));
  };

  // Threshold Y positions inside lanes
  const sunThresholdY = sunBaseY + (laneHeight - threshold * (laneHeight - 12) - 4);
  const earthThresholdY = earthBaseY + (laneHeight - threshold * (laneHeight - 12) - 4);

  // Synchronised cursor position
  const cursorX = getX(timeIndex);
  const isCursorVisible = timeIndex >= brushStart && timeIndex <= brushEnd;

  return (
    <Card className="timeline-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Multi-Lane Illumination & Line-of-Sight Timeline
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Threshold: <strong>≥ {Math.round(threshold * 100)}% disc fraction</strong> · Drag brush below to zoom · Click lane to scrub time
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, background: '#fbbf24', borderRadius: 2 }} />
            Sun Visible
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, background: '#38bdf8', borderRadius: 2 }} />
            Earth In Line of Sight
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} />
            DSN DTE Contact
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span
              style={{
                width: 10,
                height: 10,
                backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0, #f59e0b 2px, transparent 2px, transparent 6px)',
                borderRadius: 2,
              }}
            />
            Marginal Interval
          </span>
        </div>
      </div>

      {/* SVG Multi-Lane Timeline Canvas */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
          onClick={handleTimelineClick}
        >
          <defs>
            {/* Diagonal Striped Pattern for Marginal Intervals */}
            <pattern id="marginal-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="2.5" opacity="0.65" />
            </pattern>

            {/* Sun Area Gradient */}
            <linearGradient id="sun-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.1" />
            </linearGradient>

            {/* Earth Area Gradient */}
            <linearGradient id="earth-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* LANE 1: SUN VISIBILITY FRACTION */}
          <g className="lane-sun">
            {/* Lane Background */}
            <rect x="0" y={sunBaseY} width={svgWidth} height={laneHeight} fill="#0b1120" rx="4" />
            <text x="8" y={sunBaseY + 16} fill="#fbbf24" fontSize="11" fontWeight="bold">
              ☀️ LANE 1: SUN VISIBLE FRACTION (0.0 – 1.0)
            </text>

            {/* Marginal Intervals Shading */}
            {sunPoints.map((pt, i) => {
              if (pt.status === 'marginal') {
                const nextX = i < sunPoints.length - 1 ? sunPoints[i + 1].x : svgWidth;
                return (
                  <rect
                    key={`sun-marg-${i}`}
                    x={pt.x}
                    y={sunBaseY}
                    width={Math.max(1, nextX - pt.x)}
                    height={laneHeight}
                    fill="url(#marginal-hatch)"
                  />
                );
              }
              return null;
            })}

            {/* Sun Area & Line */}
            <path d={buildAreaPath(sunPoints, sunBaseY)} fill="url(#sun-gradient)" />
            <path d={buildLinePath(sunPoints, sunBaseY)} fill="none" stroke="#fbbf24" strokeWidth="2" />

            {/* Threshold Reference Line */}
            <line x1="0" y1={sunThresholdY} x2={svgWidth} y2={sunThresholdY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,4" />
            <text x={svgWidth - 110} y={sunThresholdY - 3} fill="#f59e0b" fontSize="9" fontWeight="600">
              Threshold ≥ {Math.round(threshold * 100)}%
            </text>
          </g>

          {/* LANE 2: EARTH LINE-OF-SIGHT FRACTION */}
          <g className="lane-earth">
            <rect x="0" y={earthBaseY} width={svgWidth} height={laneHeight} fill="#0b1120" rx="4" />
            <text x="8" y={earthBaseY + 16} fill="#38bdf8" fontSize="11" fontWeight="bold">
              🌍 LANE 2: EARTH IN LINE OF SIGHT FRACTION (0.0 – 1.0)
            </text>

            {/* Marginal Intervals Shading */}
            {earthPoints.map((pt, i) => {
              if (pt.status === 'marginal') {
                const nextX = i < earthPoints.length - 1 ? earthPoints[i + 1].x : svgWidth;
                return (
                  <rect
                    key={`earth-marg-${i}`}
                    x={pt.x}
                    y={earthBaseY}
                    width={Math.max(1, nextX - pt.x)}
                    height={laneHeight}
                    fill="url(#marginal-hatch)"
                  />
                );
              }
              return null;
            })}

            {/* Earth Area & Line */}
            <path d={buildAreaPath(earthPoints, earthBaseY)} fill="url(#earth-gradient)" />
            <path d={buildLinePath(earthPoints, earthBaseY)} fill="none" stroke="#38bdf8" strokeWidth="2" />

            {/* Threshold Reference Line */}
            <line x1="0" y1={earthThresholdY} x2={svgWidth} y2={earthThresholdY} stroke="#0284c7" strokeWidth="1" strokeDasharray="4,4" />
            <text x={svgWidth - 110} y={earthThresholdY - 3} fill="#38bdf8" fontSize="9" fontWeight="600">
              Threshold ≥ {Math.round(threshold * 100)}%
            </text>
          </g>

          {/* LANE 3: DIRECT-TO-EARTH CONTACT (DTE) */}
          <g className="lane-dte">
            <rect x="0" y={dteBaseY} width={svgWidth} height={laneHeight} fill="#0b1120" rx="4" />
            <text x="8" y={dteBaseY + 16} fill="#10b981" fontSize="11" fontWeight="bold">
              📡 LANE 3: DIRECT-TO-EARTH (DTE) CONTACT (SITE + DSN LINE OF SIGHT)
            </text>

            {/* Render DTE Bars */}
            {Array.from({ length: visibleSteps }).map((_, stepOffset) => {
              const idx = brushStart + stepOffset;
              const ok = series.dte.link_ok[idx];
              const x1 = getX(idx);
              const x2 = idx < brushEnd ? getX(idx + 1) : svgWidth;
              const barWidth = Math.max(1, x2 - x1);

              return (
                <rect
                  key={`dte-${idx}`}
                  x={x1}
                  y={dteBaseY + 24}
                  width={barWidth}
                  height={laneHeight - 32}
                  fill={ok ? '#10b981' : '#1e293b'}
                  opacity={ok ? 0.9 : 0.4}
                />
              );
            })}
          </g>

          {/* CELESTIAL EVENT MARKERS (Sunrise, Sunset, Earthrise, Earthset) */}
          {events.map((ev, i) => {
            if (ev.index < brushStart || ev.index > brushEnd) return null;
            const evX = getX(ev.index);
            const isSun = ev.type === 'sunrise' || ev.type === 'sunset';
            const baseY = isSun ? sunBaseY : earthBaseY;
            const icon =
              ev.type === 'sunrise' ? '☀️ Rise' : ev.type === 'sunset' ? '🌑 Set' : ev.type === 'earthrise' ? '🌍 Rise' : '🪐 Set';
            const color = isSun ? '#fbbf24' : '#38bdf8';

            return (
              <g key={`event-${i}`} transform={`translate(${evX}, ${baseY})`}>
                <line x1="0" y1="0" x2="0" y2={laneHeight} stroke={color} strokeWidth="1.5" strokeDasharray="2,2" />
                <rect x="-24" y={laneHeight - 16} width="48" height="14" rx="3" fill="#0f172a" stroke={color} strokeWidth="1" />
                <text x="0" y={laneHeight - 5} fill={color} fontSize="8" fontWeight="bold" textAnchor="middle">
                  {icon}
                </text>
              </g>
            );
          })}

          {/* LONGEST OUTAGE ANNOTATION */}
          {sunStats.longest_outage_window && (
            (() => {
              const outStart = series.time_utc.indexOf(sunStats.longest_outage_window.start_utc);
              const outEnd = series.time_utc.indexOf(sunStats.longest_outage_window.end_utc);
              if (outStart !== -1 && outEnd !== -1 && outEnd >= brushStart && outStart <= brushEnd) {
                const ox1 = getX(Math.max(brushStart, outStart));
                const ox2 = getX(Math.min(brushEnd, outEnd));
                const oWidth = Math.max(10, ox2 - ox1);

                return (
                  <g className="longest-outage-annotation">
                    <rect
                      x={ox1}
                      y={sunBaseY + 20}
                      width={oWidth}
                      height={laneHeight - 24}
                      fill="rgba(239, 68, 68, 0.2)"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      rx="3"
                    />
                    <text
                      x={ox1 + oWidth / 2}
                      y={sunBaseY + laneHeight / 2 + 10}
                      fill="#fca5a5"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Longest Darkness Outage: {sunStats.longest_outage_h}h
                    </text>
                  </g>
                );
              }
              return null;
            })()
          )}

          {/* LONGEST EARTH OUTAGE ANNOTATION */}
          {earthStats.longest_outage_window && (
            (() => {
              const outStart = series.time_utc.indexOf(earthStats.longest_outage_window.start_utc);
              const outEnd = series.time_utc.indexOf(earthStats.longest_outage_window.end_utc);
              if (outStart !== -1 && outEnd !== -1 && outEnd >= brushStart && outStart <= brushEnd) {
                const ox1 = getX(Math.max(brushStart, outStart));
                const ox2 = getX(Math.min(brushEnd, outEnd));
                const oWidth = Math.max(10, ox2 - ox1);

                return (
                  <g className="longest-earth-outage-annotation">
                    <rect
                      x={ox1}
                      y={earthBaseY + 20}
                      width={oWidth}
                      height={laneHeight - 24}
                      fill="rgba(239, 68, 68, 0.2)"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      rx="3"
                    />
                    <text
                      x={ox1 + oWidth / 2}
                      y={earthBaseY + laneHeight / 2 + 10}
                      fill="#fca5a5"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Longest Earth Outage: {earthStats.longest_outage_h}h
                    </text>
                  </g>
                );
              }
              return null;
            })()
          )}

          {/* SYNCHRONISED TIME CURSOR */}
          {isCursorVisible && (
            <g className="sync-cursor" transform={`translate(${cursorX}, 0)`}>
              <line x1="0" y1="0" x2="0" y2={dteBaseY + laneHeight} stroke="#ffffff" strokeWidth="2" />
              <polygon points="-5,0 5,0 0,8" fill="#ffffff" />
            </g>
          )}

          {/* DATE-RANGE MINI BRUSH AT BOTTOM */}
          <g className="mini-brush" transform={`translate(0, ${miniBrushBaseY})`}>
            <text x="0" y="-4" fill="#94a3b8" fontSize="10" fontWeight="600">
              DATE-RANGE BRUSH: Zoom Sub-Window ({series.time_utc[brushStart].slice(0, 10)} to {series.time_utc[brushEnd].slice(0, 10)})
            </text>
            {/* Background strip */}
            <rect x="0" y="2" width={svgWidth} height={20} fill="#1e293b" rx="3" />

            {/* Sun activity overview inside brush */}
            {series.sun.frac.map((f, i) => {
              const bx = getBrushX(i);
              const bw = Math.max(1, svgWidth / n);
              return (
                <rect
                  key={`brush-bg-${i}`}
                  x={bx}
                  y={2}
                  width={bw}
                  height={20}
                  fill={f >= threshold ? '#fbbf24' : '#334155'}
                  opacity={0.6}
                />
              );
            })}

            {/* Active Window Selection Box */}
            <rect
              x={getBrushX(brushStart)}
              y="0"
              width={Math.max(12, getBrushX(brushEnd) - getBrushX(brushStart))}
              height="24"
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth="2"
              rx="3"
            />
          </g>
        </svg>
      </div>

      {/* Date Range Brush Slider Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '0.75rem',
          padding: '0.5rem',
          background: 'var(--background-secondary, #0f172a)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Window Start:</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, brushEnd - 2)}
            value={brushStart}
            onChange={(e) => setBrushRange([Number(e.target.value), brushEnd])}
            aria-label="Brush Start Step"
            style={{ flex: 1, accentColor: 'var(--color-blue)', cursor: 'pointer' }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Window End:</span>
          <input
            type="range"
            min={Math.min(n - 1, brushStart + 2)}
            max={n - 1}
            value={brushEnd}
            onChange={(e) => setBrushRange([brushStart, Number(e.target.value)])}
            aria-label="Brush End Step"
            style={{ flex: 1, accentColor: 'var(--color-blue)', cursor: 'pointer' }}
          />
        </div>

        <button
          type="button"
          onClick={() => setBrushRange([0, n - 1])}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          Reset Zoom
        </button>
      </div>
    </Card>
  );
};
