/**
 * Collapsible Limitations Panel
 * 
 * Required on every analysis page per PROJECT_RULES:
 * - Wording strictly uses "visible" not "powered", "in line of sight" not "connected".
 * - Clarifies boundaries between geometric terrain line-of-sight and physical electrical/link budgets.
 */

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface LimitationsPanelProps {
  defaultExpanded?: boolean;
}

export const LimitationsPanel: React.FC<LimitationsPanelProps> = ({ defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="limitations-card" style={{ marginTop: '2rem', border: '1px solid var(--border-color)' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="limitations-content"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          color: 'var(--text-main)',
          fontSize: '0.95rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-amber)' }} />
          <span>Operational Boundaries & Methodological Limitations</span>
          <Badge variant="neutral" size="sm">Notice</Badge>
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div
          id="limitations-content"
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          <div>
            <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              ☀️ Sunlight Visibility is NOT Electrical Power
            </h4>
            <p style={{ margin: 0 }}>
              Calculations report geometric optical line of sight and disc clearance above the lunar terrain skyline. Solar array incident angle, panel tilt mechanism, local surface albedo, dust degradation, photovoltaic cell efficiency, and thermal battery degradation are not modeled.
            </p>
          </div>

          <div>
            <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              📡 Earth Line of Sight is NOT a Link Budget
            </h4>
            <p style={{ margin: 0 }}>
              Direct-to-Earth (DTE) status evaluates line of sight from the lunar landing site to Earth and line of sight from NASA Deep Space Network (DSN) complexes to the Moon above a 6.0° local elevation mask. Radio frequency link margins, antenna gain patterns, RF transmit power, terrestrial weather attenuation, and data rates are not modeled.
            </p>
          </div>

          <div>
            <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
              🧭 Preliminary Planning & Education Tool
            </h4>
            <p style={{ margin: 0 }}>
              LightPath is designed for mission trade studies, comparative window analysis, and educational simulation. It does not certify touchdown safety, hazard avoidance, thermal survivability, or real-time flight operations.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
