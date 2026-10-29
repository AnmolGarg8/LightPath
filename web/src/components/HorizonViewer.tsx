import React, { useState } from 'react';
import { Horizon } from '../types';
import { Eye, Sun, Globe } from 'lucide-react';

interface Props {
  horizon: Horizon;
  sunAzDeg: number;
  sunElDeg: number;
  sunRadiusDeg: number;
  sunFrac: number;
  earthAzDeg: number;
  earthElDeg: number;
  earthRadiusDeg: number;
  earthFrac: number;
}

export const HorizonViewer: React.FC<Props> = ({
  horizon,
  sunAzDeg,
  sunElDeg,
  sunRadiusDeg,
  sunFrac,
  earthAzDeg,
  earthElDeg,
  earthRadiusDeg,
  earthFrac,
}) => {
  const [selectedHeightIdx, setSelectedHeightIdx] = useState<number>(1); // Default 2.0m

  const heights = horizon.heights_m;
  const currentHeight = heights[selectedHeightIdx] ?? heights[0];
  const elRow = horizon.el_deg[selectedHeightIdx] ?? horizon.el_deg[0];
  const azStep = horizon.az_step_deg;

  // SVG coordinate mapping
  // Width 800, Height 260
  // Azimuth 0..360 -> X 40..760
  // Elevation -4..+8 deg -> Y 230..30
  const width = 800;
  const height = 260;
  const padX = 50;
  const padY = 25;
  const plotW = width - 2 * padX;
  const plotH = height - 2 * padY;

  const minEl = -4.0;
  const maxEl = 8.0;

  const mapX = (az: number) => padX + (Math.max(0, Math.min(360, az)) / 360.0) * plotW;
  const mapY = (el: number) => padY + plotH - ((el - minEl) / (maxEl - minEl)) * plotH;

  // Build SVG path for terrain
  const points = elRow.map((el, i) => {
    const az = i * azStep;
    return `${mapX(az)},${mapY(el)}`;
  });
  const pathD = `M ${padX},${height - padY} L ${points.join(' L ')} L ${width - padX},${height - padY} Z`;

  return (
    <div className="panel-card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={18} style={{ color: '#38bdf8' }} />
            360° Topocentric Horizon Profile & Celestial Positions
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Exact spherical curvature (<span className="mono">el = atan2((R+z)cosθ - (R+z0), (R+z)sinθ)</span>)
          </span>
        </div>

        {/* Mast Height Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.25rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Observer Mast Height:</span>
          {heights.map((h, idx) => (
            <button
              key={h}
              onClick={() => setSelectedHeightIdx(idx)}
              className="btn"
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                background: idx === selectedHeightIdx ? '#0284c7' : 'transparent',
                color: idx === selectedHeightIdx ? '#fff' : '#94a3b8',
                border: 'none',
              }}
            >
              {h} m
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#090d16', borderRadius: '0.5rem' }}>
          {/* Elevation Grid Lines */}
          {[-2, 0, 2, 4, 6].map((el) => {
            const y = mapY(el);
            return (
              <g key={el}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke={el === 0 ? '#475569' : '#1e293b'}
                  strokeDasharray={el === 0 ? '4,4' : undefined}
                />
                <text x={padX - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                  {el}°
                </text>
              </g>
            );
          })}

          {/* Azimuth Cardinal Lines */}
          {[
            { az: 0, label: '0° N' },
            { az: 90, label: '90° E' },
            { az: 180, label: '180° S' },
            { az: 270, label: '270° W' },
            { az: 360, label: '360° N' },
          ].map(({ az, label }) => {
            const x = mapX(az);
            return (
              <g key={az}>
                <line x1={x} y1={padY} x2={x} y2={height - padY} stroke="#1e293b" />
                <text x={x} y={height - padY + 16} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Terrain Silhouette */}
          <path d={pathD} fill="rgba(30, 41, 59, 0.85)" stroke="#64748b" strokeWidth="1.5" />

          {/* Sun Disc */}
          <g transform={`translate(${mapX(sunAzDeg)}, ${mapY(sunElDeg)})`}>
            <circle
              r={Math.max(6, sunRadiusDeg * (plotH / (maxEl - minEl)) * 2)}
              fill="rgba(250, 204, 21, 0.4)"
              stroke="#facc15"
              strokeWidth="2"
            />
            <text x={0} y={-14} fill="#facc15" fontSize="10" fontWeight="bold" textAnchor="middle">
              Sun ({(sunFrac * 100).toFixed(0)}%)
            </text>
          </g>

          {/* Earth Disc */}
          <g transform={`translate(${mapX(earthAzDeg)}, ${mapY(earthElDeg)})`}>
            <circle
              r={Math.max(10, earthRadiusDeg * (plotH / (maxEl - minEl)) * 2)}
              fill="rgba(56, 189, 248, 0.3)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <text x={0} y={-16} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
              Earth ({(earthFrac * 100).toFixed(0)}%)
            </text>
          </g>
        </svg>
      </div>

      {/* Legend & Details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.8rem', color: '#cbd5e1', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#facc15' }}>
            <Sun size={14} /> Sun: Az {sunAzDeg.toFixed(1)}°, El {sunElDeg.toFixed(2)}° (Frac: {(sunFrac * 100).toFixed(1)}%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#38bdf8' }}>
            <Globe size={14} /> Earth: Az {earthAzDeg.toFixed(1)}°, El {earthElDeg.toFixed(2)}° (Frac: {(earthFrac * 100).toFixed(1)}%)
          </span>
        </div>
        <div style={{ color: '#94a3b8' }}>
          Selected Mast: <strong style={{ color: '#f8fafc' }}>{currentHeight} m</strong> (higher mast lowers terrain horizon)
        </div>
      </div>
    </div>
  );
};
