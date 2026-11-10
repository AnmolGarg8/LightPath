import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { ChevronDown, ChevronUp, Sliders, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const AssumptionsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div data-testid="assumptions-panel">
      <Card
        className="assumptions-card"
        style={{
          marginTop: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          color: 'var(--text-main)',
          fontSize: '0.95rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={18} style={{ color: 'var(--color-amber)' }} />
          <span>Solver Parameters & Physical Assumptions</span>
          <Badge variant="neutral">Assumptions</Badge>
        </span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isOpen && (
        <div
          data-testid="assumptions-content"
          style={{
            padding: '0 1.25rem 1.25rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {/* 1. Modelled Assumption Parameters Table */}
          <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} style={{ color: '#22c55e' }} />
              <span>Modelled Parameters & Numerical Baselines</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Parameter</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Value</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Engineering Rationale / Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Rover Speed</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>0.05 m/s (180 m/h)</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Nominal exploration drive speed for robotic lunar rovers.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Slope Limit</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>15.0°</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Mechanical traversability threshold; derived from DEM gradient via Horn (1981) 8-neighbourhood method.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Visibility Thresholds</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>Sun ≥ 50%, Earth ≥ 50%</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Illuminated disc fraction threshold integrated over 256-point Fibonacci spiral; DSN ground station elevation mask ≥ 6.0°.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Grid Spacing</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>50.0 m / cell</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Spatial discretization spacing on 25×25 node grid spanning 1.2 km × 1.2 km traversal domain.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Terrain Resolution</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>20.0 m/pixel near-field</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Derived from LOLA DEM <code>LDEM_80S_20MPP_ADJ.TIF</code>, nested with 80.0 m/pixel far-field layer.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Time Step</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>30 minutes (0.5 h)</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Temporal resolution between successive 4D visibility cube time slices.</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Interval-Check Mode</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><code>Ceiling Round-Up</code></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>Conservative discrete temporal evaluation: time index is derived from accumulated transit time <code>ceil(g / step)</code>.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Items NOT Modelled Alert Box */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertTriangle size={14} />
              <span>Items That Are NOT Modelled (Operational Boundaries)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>
                <strong>Sub-Pixel Micro-Topography:</strong> Local surface boulders, small craters (&lt; 20 m), and rover-scale rock hazards are unresolvable at 20 m/pixel DEM spacing.
              </li>
              <li>
                <strong>Terramechanics &amp; Slip:</strong> Wheel-soil sinkage, regolith compaction, motor torque limits, and wheel slip are not simulated.
              </li>
              <li>
                <strong>Battery Thermal &amp; Panel Orientation:</strong> Solar panel gimbal angle relative to grazing sun rays, solar cell temperature efficiency curves, and cryogenic heater draw during darkness are not modelled.
              </li>
              <li>
                <strong>Dynamic RF Multipath:</strong> Regolith radio wave attenuation, surface scattering, and non-rigid antenna pointing tracking are not computed.
              </li>
              <li>
                <strong>Acceleration Dynamics:</strong> Assumes instantaneous constant drive speed between node centers (zero acceleration/deceleration transition costs).
              </li>
            </ul>
          </div>
        </div>
      )}
      </Card>
    </div>
  );
};
