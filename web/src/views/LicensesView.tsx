import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ShieldCheck, AlertCircle, FileText, ExternalLink, Code } from 'lucide-react';

export const LicensesView: React.FC = () => {
  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <Badge variant="info">NASA Space Apps Challenge 2026</Badge>
          <Badge variant="success">OSI Licence Audit</Badge>
          <Badge variant="neutral">MIT Project Licence</Badge>
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
          Third-Party Licences &amp; Open Source Compliance
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
          Under Rule 11 of <code>docs/PROJECT_RULES.md</code> and Section 6 of the NASA Space Apps Challenge Participant Terms, all direct and transitive third-party dependencies used in the offline pipeline and web application are audited for licence permissiveness.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <Card style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary, #38bdf8)' }}>336</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Total Packages Audited
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Direct &amp; Transitive Dependencies
          </div>
        </Card>

        <Card style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>36</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Python Pipeline Dependencies
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Audited via <code>importlib.metadata</code>
          </div>
        </Card>

        <Card style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7' }}>300</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Web Client Dependencies
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Audited via <code>package-lock.json</code>
          </div>
        </Card>

        <Card style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>3</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Flagged for Human Review
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Permissive / CC / Custom Models
          </div>
        </Card>
      </div>

      {/* Flagged Licences Review Box */}
      <Card style={{ marginBottom: '2rem', padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
          <AlertCircle size={20} />
          Flagged Non-Standard / Model Licences (Documented in docs/QUESTIONS.md)
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          The automated audit generator <code>scripts/make_third_party_licenses.py</code> flags any package whose declared licence is not in the standard OSI SPDX approval list. The 3 flagged items are evaluated below:
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Ecosystem</th>
                <th style={{ padding: '0.5rem' }}>Package</th>
                <th style={{ padding: '0.5rem' }}>Version</th>
                <th style={{ padding: '0.5rem' }}>Declared Licence</th>
                <th style={{ padding: '0.5rem' }}>Permissiveness Assessment &amp; Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.6rem 0.5rem' }}>Python / PyPI</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}><code>pillow</code></td>
                <td style={{ padding: '0.6rem 0.5rem' }}>11.3.0</td>
                <td style={{ padding: '0.6rem 0.5rem' }}><Badge variant="neutral">MIT-CMU</Badge></td>
                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Historical CMU-style permissive license; OSI-compatible historical open source licence.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.6rem 0.5rem' }}>Node / npm</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}><code>caniuse-lite</code></td>
                <td style={{ padding: '0.6rem 0.5rem' }}>1.0.30001820</td>
                <td style={{ padding: '0.6rem 0.5rem' }}><Badge variant="neutral">CC-BY-4.0</Badge></td>
                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Creative Commons Attribution 4.0; open content/dataset license for browser feature tables.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.6rem 0.5rem' }}>Node / npm</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}><code>minimatch</code></td>
                <td style={{ padding: '0.6rem 0.5rem' }}>10.2.6</td>
                <td style={{ padding: '0.6rem 0.5rem' }}><Badge variant="neutral">BlueOak-1.0.0</Badge></td>
                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Blue Oak Model License 1.0.0; modern attorney-drafted permissive open-source license.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Primary Open-Source Stacks */}
      <Card style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code size={20} style={{ color: 'var(--accent-primary, #38bdf8)' }} />
          Primary Open-Source Core Libraries
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>SpiceyPy</span>
              <Badge variant="success">MIT</Badge>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Pythonic wrapper for NAIF SPICE celestial mechanics toolkit.
            </div>
          </div>

          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Rasterio &amp; GDAL</span>
              <Badge variant="success">BSD-3-Clause</Badge>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Geospatial raster I/O for LOLA DEM GeoTIFF elevation models.
            </div>
          </div>

          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>React &amp; Lucide Icons</span>
              <Badge variant="success">MIT / ISC</Badge>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Interactive client-side user interface and visualization components.
            </div>
          </div>

          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PyArrow</span>
              <Badge variant="success">Apache-2.0</Badge>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Columnar data export for Parquet scientific datasets.
            </div>
          </div>
        </div>
      </Card>

      {/* Links to Full Markdown Manifests */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <a
          href="https://github.com/AnmolGarg8/Lunar/blob/main/docs/THIRD_PARTY_LICENSES.md"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <FileText size={16} />
          View Full docs/THIRD_PARTY_LICENSES.md (336 packages) <ExternalLink size={12} />
        </a>
        <a
          href="#/credits"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <ShieldCheck size={16} />
          View Scientific Credits &amp; Citations
        </a>
      </div>
    </div>
  );
};
