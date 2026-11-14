import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export const RelatedWorkPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div data-testid="related-work-panel">
      <Card
        className="related-work-card"
        style={{
          marginTop: '1.5rem',
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
          <BookOpen size={18} style={{ color: 'var(--color-blue)' }} />
          <span>Related Work & Prior Art</span>
          <Badge variant="neutral">Context</Badge>
        </span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isOpen && (
        <div
          data-testid="related-work-content"
          style={{
            padding: '0 1.25rem 1.25rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>Prior Art Acknowledgement:</strong> Lunar south-pole visibility tools and traverse planners with sun and shadow
              constraints already exist in aerospace engineering, NASA mission operations, and planetary science literature.
              High-performance computing pipelines simulate polar illumination and obstacle avoidance for lunar surface operations.
            </p>
            <p style={{ margin: '0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
              In accordance with Project Rule 2 (Never invent facts or citations), verified names, publications, and repository links
              for existing prior tools are curated by human investigators in{' '}
              <code>docs/RELATED_WORK_SOURCES.md</code>.
            </p>
          </div>

          <div
            style={{
              padding: '0.85rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginTop: '0.75rem',
            }}
          >
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={14} />
              <span>What LightPath Adds</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>
                <strong>Client-Side 4D Space-Time Solver:</strong> Zero-install, pure in-browser A* pathfinding over moving shadow fields
                in under 1 second via background Web Workers.
              </li>
              <li>
                <strong>Topocentric Curvature & Disc Clipping:</strong> Per-cell local vertical accounting for lunar surface curvature tilt
                (0.033°/km) with 256-point uniform Fibonacci-spiral quadrature for true solar (0.53°) and distance-varying Earth (~1.80° to 2.03°) discs.
              </li>
              <li>
                <strong>Interactive Mast Sensitivity:</strong> Real-time horizon depression scrubbing (1.0m to 10.0m) quantifying recovered sunlight hours across observer heights.
              </li>
              <li>
                <strong>Multi-Lane DSN Contact:</strong> Simultaneous timeline intersecting lunar topocentric line-of-sight with Earth-fixed NASA DSN stations (Goldstone, Madrid, Canberra) above elevation masks.
              </li>
              <li>
                <strong>Deterministic Open Data:</strong> SHA-256 verified CSV and Apache Parquet exports with full provenance manifests and automated validation suite.
              </li>
            </ul>
          </div>
        </div>
      )}
      </Card>
    </div>
  );
};
