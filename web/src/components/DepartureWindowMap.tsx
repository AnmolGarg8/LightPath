import React, { useState } from 'react';
import { DepartureMapResult, DepartureEntry } from '../types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Stat } from './ui/Stat';
import { SegmentedControl } from './ui/SegmentedControl';

interface DepartureWindowMapProps {
  data: DepartureMapResult;
  selectedDepartureIdx?: number;
  onSelectDeparture: (departureIdx: number) => void;
}

type MetricView = 'duration' | 'darkness';

export const DepartureWindowMap: React.FC<DepartureWindowMapProps> = ({
  data,
  selectedDepartureIdx,
  onSelectDeparture,
}) => {
  const [metricView, setMetricView] = useState<MetricView>('duration');
  const [hoveredEntry, setHoveredEntry] = useState<DepartureEntry | null>(null);

  const {
    departures,
    total_departures_evaluated,
    compute_time_s,
    earliest_feasible_idx,
    latest_safe_idx,
    lowest_dark_idx,
    earliest_feasible_utc,
    latest_safe_utc,
    lowest_dark_utc,
    plain_language_summary,
  } = data;

  const feasibleCount = departures.filter((d) => d.feasible).length;
  const feasiblePct = total_departures_evaluated > 0
    ? Math.round((feasibleCount / total_departures_evaluated) * 100)
    : 0;

  // Chart dimensions
  const svgWidth = 840;
  const svgHeight = 220;
  const padLeft = 55;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Max value calculation for vertical scale
  const maxVal = Math.max(
    1.0,
    ...departures.map((d) =>
      metricView === 'duration' ? (d.duration_h ?? 0) : (d.dark_duration_h ?? 0)
    )
  );
  const yUpper = Math.ceil(maxVal * 1.25 * 10) / 10;

  const getX = (idx: number) => {
    if (total_departures_evaluated <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (total_departures_evaluated - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - (val / yUpper) * plotHeight;
  };

  // Group contiguous infeasible spans for clear hatched gap rendering
  const infeasibleSpans: Array<{ startIdx: number; endIdx: number; reason: string }> = [];
  let curSpan: { startIdx: number; endIdx: number; reason: string } | null = null;

  departures.forEach((d, i) => {
    if (!d.feasible) {
      if (!curSpan) {
        curSpan = { startIdx: i, endIdx: i, reason: d.infeasible_reason || 'Infeasible' };
      } else {
        curSpan.endIdx = i;
      }
    } else {
      if (curSpan) {
        infeasibleSpans.push(curSpan);
        curSpan = null;
      }
    }
  });
  if (curSpan) {
    infeasibleSpans.push(curSpan);
  }

  const barWidth = Math.max(4, plotWidth / total_departures_evaluated - 2);

  return (
    <Card
      title="Departure Window Map"
      subtitle={`Feasibility and arrival metrics computed for every departure time step across the mission planning horizon.`}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Badge
            variant="neutral"
            label={`⚡ ${total_departures_evaluated} solves in ${compute_time_s}s`}
          />
          <SegmentedControl<MetricView>
            value={metricView}
            onChange={setMetricView}
            size="sm"
            options={[
              { value: 'duration', label: 'Transit Duration (h)' },
              { value: 'darkness', label: 'Dark Exposure (h)' },
            ]}
          />
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Plain-Language Summary Box */}
        <div
          data-testid="departure-summary-sentence"
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🧭</span>
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--accent-primary)', marginRight: '0.4rem' }}>
              DEPARTURE WINDOW ANALYSIS:
            </strong>
            <span style={{ color: 'var(--text-primary)' }}>{plain_language_summary}</span>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <Stat
            label="Earliest Feasible"
            value={earliest_feasible_idx !== null ? `Step ${earliest_feasible_idx}` : 'None'}
            variant="success"
            description={earliest_feasible_utc ? `${earliest_feasible_utc.slice(11, 19)} UTC` : 'No window'}
          />
          <Stat
            label="Latest Safe Departure"
            value={latest_safe_idx !== null ? `Step ${latest_safe_idx}` : 'None'}
            variant="neutral"
            description={latest_safe_utc ? `${latest_safe_utc.slice(11, 19)} UTC` : 'No window'}
          />
          <Stat
            label="Lowest Dark Exposure"
            value={lowest_dark_idx !== null ? `Step ${lowest_dark_idx}` : 'None'}
            variant="sun"
            description={
              lowest_dark_idx !== null
                ? `${lowest_dark_utc ? lowest_dark_utc.slice(11, 19) + ' UTC (' : ''}${(departures[lowest_dark_idx]?.dark_duration_h ?? 0).toFixed(2)}h dark${lowest_dark_utc ? ')' : ''}`
                : 'N/A'
            }
          />
          <Stat
            label="Window Availability"
            value={`${feasiblePct}%`}
            variant={feasiblePct > 50 ? 'joint' : 'alert'}
            description={`${feasibleCount} of ${total_departures_evaluated} departure times viable`}
          />
        </div>

        {/* SVG Departure Window Map Chart */}
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{
              width: '100%',
              height: 'auto',
              minWidth: '600px',
              backgroundColor: '#090d16',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
            data-testid="departure-map-svg"
          >
            <defs>
              {/* Hatch Pattern for Infeasible Gaps */}
              <pattern
                id="infeasibleHatch"
                width="10"
                height="10"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="10"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeOpacity="0.45"
                />
              </pattern>

              {/* Gradient for feasible duration bars */}
              <linearGradient id="durationBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.75" />
              </linearGradient>

              {/* Gradient for dark exposure bars */}
              <linearGradient id="darknessBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.7" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
              const y = padTop + plotHeight * (1 - frac);
              const val = (yUpper * frac).toFixed(1);
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {val}h
                  </text>
                </g>
              );
            })}

            {/* Infeasible Hatched Gaps */}
            {infeasibleSpans.map((span, sIdx) => {
              const xStart = Math.max(padLeft, getX(span.startIdx) - barWidth / 2);
              const xEnd = Math.min(padLeft + plotWidth, getX(span.endIdx) + barWidth / 2);
              const w = Math.max(8, xEnd - xStart);
              return (
                <g key={`gap-${sIdx}`} data-testid="infeasible-hatched-gap">
                  <rect
                    x={xStart}
                    y={padTop}
                    width={w}
                    height={plotHeight}
                    fill="url(#infeasibleHatch)"
                    stroke="rgba(239, 68, 68, 0.4)"
                    strokeDasharray="4,2"
                  />
                  <rect
                    x={xStart}
                    y={padTop}
                    width={w}
                    height={plotHeight}
                    fill="rgba(239, 68, 68, 0.08)"
                  />
                  {w > 50 && (
                    <text
                      x={xStart + w / 2}
                      y={padTop + plotHeight / 2}
                      fill="#ef4444"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ letterSpacing: '0.05em' }}
                    >
                      INFEASIBLE GAP
                    </text>
                  )}
                </g>
              );
            })}

            {/* Feasible Departure Bars / Points */}
            {departures.map((d) => {
              const x = getX(d.departure_idx);
              if (!d.feasible) return null;

              const val = metricView === 'duration' ? (d.duration_h ?? 0) : (d.dark_duration_h ?? 0);
              const y = getY(val);
              const h = Math.max(3, padTop + plotHeight - y);
              const isSelected = selectedDepartureIdx === d.departure_idx;
              const isHovered = hoveredEntry?.departure_idx === d.departure_idx;

              return (
                <g
                  key={d.departure_idx}
                  onClick={() => onSelectDeparture(d.departure_idx)}
                  onMouseEnter={() => setHoveredEntry(d)}
                  onMouseLeave={() => setHoveredEntry(null)}
                  style={{ cursor: 'pointer' }}
                  data-testid={`departure-bar-${d.departure_idx}`}
                >
                  <rect
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={2}
                    fill={metricView === 'duration' ? 'url(#durationBarGradient)' : 'url(#darknessBarGradient)'}
                    stroke={isSelected ? '#ffffff' : isHovered ? '#38bdf8' : 'none'}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={isSelected ? 1.0 : isHovered ? 0.9 : 0.8}
                  />
                  {/* Dot atop bar */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 4 : 2.5}
                    fill={isSelected ? '#ffffff' : metricView === 'duration' ? '#38bdf8' : '#f59e0b'}
                  />
                </g>
              );
            })}

            {/* Special Callout Markers */}
            {/* 1. Earliest Feasible */}
            {earliest_feasible_idx !== null && (
              <g data-testid="marker-earliest-feasible">
                <line
                  x1={getX(earliest_feasible_idx)}
                  y1={padTop}
                  x2={getX(earliest_feasible_idx)}
                  y2={padTop + plotHeight}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <circle cx={getX(earliest_feasible_idx)} cy={padTop - 8} r="5" fill="#10b981" />
                <text
                  x={getX(earliest_feasible_idx)}
                  y={padTop - 15}
                  fill="#10b981"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  🟢 EARLIEST (t={earliest_feasible_idx})
                </text>
              </g>
            )}

            {/* 2. Latest Safe Departure */}
            {latest_safe_idx !== null && (
              <g data-testid="marker-latest-safe">
                <line
                  x1={getX(latest_safe_idx)}
                  y1={padTop}
                  x2={getX(latest_safe_idx)}
                  y2={padTop + plotHeight}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <circle cx={getX(latest_safe_idx)} cy={padTop - 8} r="5" fill="#38bdf8" />
                <text
                  x={getX(latest_safe_idx)}
                  y={padTop - 15}
                  fill="#38bdf8"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  🏁 LATEST SAFE (t={latest_safe_idx})
                </text>
              </g>
            )}

            {/* 3. Lowest Darkness Exposure */}
            {lowest_dark_idx !== null && lowest_dark_idx !== earliest_feasible_idx && lowest_dark_idx !== latest_safe_idx && (
              <g data-testid="marker-lowest-dark">
                <line
                  x1={getX(lowest_dark_idx)}
                  y1={padTop}
                  x2={getX(lowest_dark_idx)}
                  y2={padTop + plotHeight}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <polygon
                  points={`${getX(lowest_dark_idx)},${padTop - 13} ${getX(lowest_dark_idx) - 4},${padTop - 5} ${getX(lowest_dark_idx) + 4},${padTop - 5}`}
                  fill="#f59e0b"
                />
                <text
                  x={getX(lowest_dark_idx)}
                  y={padTop - 15}
                  fill="#f59e0b"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ☀️ LOWEST DARK (t={lowest_dark_idx})
                </text>
              </g>
            )}

            {/* Active Selected Departure Indicator */}
            {selectedDepartureIdx !== undefined && (
              <g>
                <line
                  x1={getX(selectedDepartureIdx)}
                  y1={padTop}
                  x2={getX(selectedDepartureIdx)}
                  y2={padTop + plotHeight}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Bottom Horizontal Axis & Labels */}
            <line
              x1={padLeft}
              y1={padTop + plotHeight}
              x2={padLeft + plotWidth}
              y2={padTop + plotHeight}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
            />

            {/* Time Ticks */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((frac, i) => {
              const idx = Math.min(
                total_departures_evaluated - 1,
                Math.round(frac * (total_departures_evaluated - 1))
              );
              const x = getX(idx);
              const utcStr = departures[idx]?.departure_utc || '';
              const timeDisplay = utcStr.length >= 16 ? utcStr.slice(11, 16) : `t=${idx}`;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={padTop + plotHeight}
                    x2={x}
                    y2={padTop + plotHeight + 5}
                    stroke="rgba(255, 255, 255, 0.3)"
                  />
                  <text
                    x={x}
                    y={padTop + plotHeight + 18}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {timeDisplay}
                  </text>
                  <text
                    x={x}
                    y={padTop + plotHeight + 29}
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Step {idx}
                  </text>
                </g>
              );
            })}

            {/* Axis Title */}
            <text
              x={padLeft + plotWidth / 2}
              y={svgHeight - 4}
              fill="#cbd5e1"
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
            >
              Departure Time (Step & UTC Timeline)
            </text>
          </svg>

          {/* Interactive Tooltip Readout */}
          {hoveredEntry && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: 'var(--text-xs)',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
              }}
            >
              <div>
                Departure: <strong className="mono">Step {hoveredEntry.departure_idx}</strong> ({hoveredEntry.departure_utc.slice(0, 19)}Z)
              </div>
              <div>
                Status:{' '}
                {hoveredEntry.feasible ? (
                  <Badge variant="success" label="FEASIBLE" />
                ) : (
                  <Badge variant="blocked" label="INFEASIBLE" />
                )}
              </div>
              {hoveredEntry.feasible ? (
                <>
                  <div>
                    Arrival: <strong className="mono">Step {hoveredEntry.arrival_idx}</strong> ({hoveredEntry.arrival_utc?.slice(11, 19)}Z)
                  </div>
                  <div>
                    Duration: <strong className="mono">{hoveredEntry.duration_h} h</strong>
                  </div>
                  <div>
                    Dark Exposure: <strong className="mono">{hoveredEntry.dark_duration_h} h</strong>
                  </div>
                </>
              ) : (
                <div style={{ color: '#ef4444' }}>
                  Reason: <em>{hoveredEntry.infeasible_reason}</em>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          💡 <strong>Departure Interaction:</strong> Click on any departure point or step above to immediately load that specific traverse path into the 2D map. Hatched red spans denote infeasible departure intervals where shadows or terrain gradients obstruct the route.
        </div>
      </div>
    </Card>
  );
};
