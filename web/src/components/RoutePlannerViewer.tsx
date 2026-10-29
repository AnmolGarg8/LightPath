import React from 'react';
import { VisibilityCube, RouteResult } from '../types';
import { Compass, Navigation, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  cube: VisibilityCube;
  routeResult: RouteResult;
  currentTimeIdx: number;
}

export const RoutePlannerViewer: React.FC<Props> = ({
  cube,
  routeResult,
  currentTimeIdx,
}) => {
  const { grid, slope_deg, traversable, sun_frac } = cube;
  const { nx, ny, spacing_m } = grid;

  // Clamp time index for cube
  const clampedTimeIdx = Math.min(sun_frac.length - 1, currentTimeIdx);

  // Path set for fast lookup
  const pathCells = new Map<string, number>();
  if (routeResult.feasible && routeResult.path) {
    routeResult.path.forEach((p, idx) => {
      pathCells.set(`${p.x},${p.y}`, idx);
    });
  }

  const startCoord = routeResult.params.start_coord;
  const endCoord = routeResult.params.end_coord;

  // Cell color helper
  const getCellStyle = (x: number, y: number) => {
    const isTraversable = traversable[y]?.[x] ?? true;
    const slope = slope_deg[y]?.[x] ?? 0;
    const sun = sun_frac[clampedTimeIdx]?.[y]?.[x] ?? 100;
    const isPath = pathCells.has(`${x},${y}`);
    const isStart = x === startCoord[0] && y === startCoord[1];
    const isEnd = x === endCoord[0] && y === endCoord[1];

    let bg = '#1e293b';
    if (!isTraversable) {
      bg = '#450a0a'; // Dark red for untraversable
    } else if (sun < 20) {
      bg = '#0f172a'; // Deep shadow
    } else if (sun < 50) {
      bg = '#1c1917'; // Penumbra
    } else {
      // Illuminated terrain colored slightly by slope
      if (slope > 12) bg = '#362b10';
      else if (slope > 8) bg = '#1e3a2b';
      else bg = '#134e4a';
    }

    let border = '1px solid #334155';
    if (isStart) border = '2px solid #4ade80';
    else if (isEnd) border = '2px solid #38bdf8';
    else if (isPath) border = '2px solid #facc15';

    return { bg, border, isStart, isEnd, isPath, slope, sun };
  };

  return (
    <div className="panel-card" style={{ marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={18} style={{ color: '#38bdf8' }} />
            Signature Feature: Space-Time Route & Motion Planner
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Evaluates whether a rover or crew can traverse from A to B while light & link remain continuously available
          </span>
        </div>

        {/* Feasibility Status Badge */}
        <div>
          {routeResult.feasible ? (
            <span className="badge badge-green" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
              <CheckCircle2 size={14} style={{ marginRight: '4px' }} /> Continuous Light & Link Feasible
            </span>
          ) : (
            <span className="badge badge-red" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
              <XCircle size={14} style={{ marginRight: '4px' }} /> Traverse Infeasible (Shadow/Slope Blocked)
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
        {/* 2D Interactive Grid Map */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${nx}, 1fr)`,
              gap: '4px',
              padding: '8px',
              background: '#090d16',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              maxWidth: '380px',
              width: '100%',
              aspectRatio: '1 / 1',
            }}
          >
            {Array.from({ length: ny }).map((_, rowIdx) => {
              // Y=0 at bottom or top: standard cartesian row (ny-1 - rowIdx)
              const y = ny - 1 - rowIdx;
              return Array.from({ length: nx }).map((__, x) => {
                const cell = getCellStyle(x, y);
                return (
                  <div
                    key={`${x},${y}`}
                    style={{
                      background: cell.bg,
                      border: cell.border,
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      fontSize: '0.65rem',
                      color: '#cbd5e1',
                      transition: 'background 0.2s ease',
                      cursor: 'default',
                    }}
                    title={`Cell (${x}, ${y})\nSlope: ${cell.slope.toFixed(1)}°\nSun: ${cell.sun}% illumination`}
                  >
                    {cell.isStart && (
                      <span style={{ color: '#4ade80', fontWeight: 'bold' }}>A</span>
                    )}
                    {cell.isEnd && (
                      <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>B</span>
                    )}
                    {cell.isPath && !cell.isStart && !cell.isEnd && (
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#facc15',
                        }}
                      />
                    )}
                  </div>
                );
              });
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '2px' }} /> Start A
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} /> Goal B
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#facc15', borderRadius: '50%' }} /> Waypoint
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#450a0a', borderRadius: '2px' }} /> Cliff &gt;15°
            </span>
          </div>
        </div>

        {/* Traverse Metrics & Explanation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Navigation size={14} style={{ color: '#38bdf8' }} />
              Traverse Parameters & Metrics ({routeResult.mode.toUpperCase()})
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Grid Spacing:</span>{' '}
                <strong style={{ color: '#f8fafc' }}>{spacing_m} m</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Rover Speed:</span>{' '}
                <strong style={{ color: '#f8fafc' }}>{routeResult.params.speed_m_s} m/s</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Total Distance:</span>{' '}
                <strong style={{ color: '#4ade80' }}>{routeResult.metrics.total_distance_m} m</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Traverse Duration:</span>{' '}
                <strong style={{ color: '#38bdf8' }}>{routeResult.metrics.duration_h} hours</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Max Slope:</span>{' '}
                <strong style={{ color: routeResult.metrics.max_slope_deg > 12 ? '#fbbf24' : '#4ade80' }}>
                  {routeResult.metrics.max_slope_deg}°
                </strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Min Illumination:</span>{' '}
                <strong style={{ color: '#facc15' }}>
                  {(routeResult.metrics.min_sun_frac_observed * 100).toFixed(0)}%
                </strong>
              </div>
            </div>
          </div>

          {/* Planner Explanation Box */}
          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <span style={{ fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '0.25rem' }}>
              Space-Time Planning Reasoning:
            </span>
            {routeResult.explanation}
          </div>
        </div>
      </div>
    </div>
  );
};
