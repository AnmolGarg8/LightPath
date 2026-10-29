import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        padding: '2.5rem 0 3rem 0',
        marginTop: 'auto',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '1rem',
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              LightPath — CLPS Lunar Mission Browser
            </strong>
            <p style={{ marginTop: '0.25rem' }}>
              NASA Space Apps Challenge 2026 preliminary planning and education platform.
            </p>
          </div>

          <nav aria-label="Footer links" style={{ display: 'flex', gap: '1.25rem' }}>
            <a href="#/explain">Operational Limitations</a>
            <a href="#/trust">Verification Benchmarks</a>
            <a href="https://github.com/AnmolGarg8/Lunar.git" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </nav>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', opacity: 0.6 }} />

        {/* NASA Credit lines (Placeholders for human to fill exact official citations per Rule 2) */}
        <div style={{ lineHeight: 1.6 }}>
          <p>
            <strong>Citations & Primary Data Sources:</strong> Topography derived from Lunar Orbiter Laser Altimeter
            (LOLA) elevation products via the NASA Planetary Data System (PDS) Geosciences Node and GSFC Planetary
            Geodesy Data Archive. Planetary ephemerides computed via NASA NAIF SPICE system (DE440 planetary ephemeris,
            MOON_ME polar axis body-fixed frame). Deep Space Network (DSN) ground station geometry adapted from JPL
            810-005.
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--color-blocked)' }}>
            <strong>Operational Boundary:</strong> LightPath is a preliminary planning and education tool. Sun visibility
            is not electrical power. Earth visibility is not a link budget. It is not for flight operations and does
            not certify landing or traverse safety.
          </p>
        </div>
      </div>
    </footer>
  );
};
