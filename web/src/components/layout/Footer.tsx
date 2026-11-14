import React, { useEffect, useState } from 'react';
import { fetchJsonData } from '../../utils/dataLoader';
import { DataStatusSchema, type DataStatus } from '../../types/schemas';

export const Footer: React.FC = () => {
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);

  useEffect(() => {
    fetchJsonData('./data/data_status.json', DataStatusSchema)
      .then(setDataStatus)
      .catch(() => null);
  }, []);
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

          <nav aria-label="Footer links" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <a href="#/credits">Credits &amp; Citations</a>
            <a href="#/licenses">Licences</a>
            <a href="#/data">Reusable Data</a>
            <a href="#/explain">Operational Limitations</a>
            <a href="#/trust">Verification Benchmarks</a>
            <a href="https://github.com/AnmolGarg8/Lunar.git" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </nav>
        </div>

        <div
          data-testid="footer-provenance-status"
          style={{
            padding: '0.6rem 0.85rem',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-amber)' }}>
            <span aria-hidden="true" style={{ fontSize: '1rem' }}>⚠️</span>
            <span>
              <strong>Data Provenance & Traceability:</strong> All entries fully sourced (sites, missions, DSN stations) — <strong style={{ color: '#fbbf24' }}>all entries currently unverified</strong> pending human verification against NASA PDS / NAIF / JPL records.
            </span>
          </div>
          <a
            href="https://github.com/AnmolGarg8/LightPath/blob/main/docs/HUMAN_TODO.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-blue)', textDecoration: 'underline', fontWeight: 600 }}
          >
            Human Verification Checklist →
          </a>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', opacity: 0.6 }} />

        {/* NASA Credit lines */}
        <div style={{ lineHeight: 1.6 }}>
          <p style={{ marginBottom: '0.4rem' }}>
            <strong>Credits:</strong> Ephemeris DE421 (JPL), Topography LOLA LDEM (NASA GSFC / Barker et al. 2023, 2021), SPICE / SpiceyPy, DSN 810-005, Horn 1981.
          </p>
          <p>
            <strong>Citations &amp; Primary Data Sources:</strong>{' '}
            {dataStatus?.has_lola_dem
              ? 'Terrain elevation models use NASA LOLA Digital Elevation Models (PDS / PGDA).'
              : 'Terrain elevation models use synthetic benchmark topography.'}{' '}
            {dataStatus?.has_spice_kernels
              ? 'Planetary ephemerides use NAIF SPICE kernels (DE421, MOON_ME frame).'
              : 'Planetary ephemerides use an unverified approximate model.'}{' '}
            Deep Space Network (DSN) ground station geometry adapted from JPL 810-005.
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
