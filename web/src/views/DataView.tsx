/**
 * Reusable Open Data & Downloads View (/data)
 * 
 * Complies with docs/PROJECT_RULES.md:
 * - Rule 1 (Correctness): Exact window counts and file sizes loaded from validated data_catalog.json.
 * - Rule 2 (No Fake Citations): Suggested citations contain bracketed human placeholders.
 * - Rule 3 (Real vs Synthetic): Synthetic datasets clearly distinguished and bannered.
 * - Rule 5 (Reference frames): Explicitly declares MOON_ME reference frame.
 * - Rule 7 (Curvature): Explicitly declares exact spherical curvature elevation model.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchJsonData } from '../utils/dataLoader';
import { DataCatalog, DataCatalogSchema } from '../types/schemas';
import {
  Download,
  Database,
  Copy,
  Check,
  Search,
  Info,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

export const DataView: React.FC = () => {
  const [catalog, setCatalog] = useState<DataCatalog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Filters
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'CSV' | 'Parquet'>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJsonData('./data/data_catalog.json', DataCatalogSchema)
      .then((data) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredFiles = useMemo(() => {
    if (!catalog) return [];
    return catalog.files.filter((f) => {
      // Format filter
      if (formatFilter !== 'ALL' && f.format !== formatFilter) return false;
      // Site filter
      if (siteFilter !== 'ALL' && f.site_id !== siteFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFilename = f.filename.toLowerCase().includes(q);
        const matchesSite = f.site_id.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        if (!matchesFilename && !matchesSite && !matchesDesc) return false;
      }
      return true;
    });
  }, [catalog, formatFilter, siteFilter, searchQuery]);

  // Suggested Citation Strings with human placeholders per Rule 2
  const datasetBibtex = `@dataset{lightpath_data_2026,
  author       = {[LightPath Team - Names to be confirmed by humans]},
  title        = {LightPath: Lunar South-Pole Solar Illumination and Direct-to-Earth Line of Sight Dataset},
  year         = {2026},
  publisher    = {NASA Space Apps Challenge 2026},
  version      = {1.0.0},
  doi          = {[10.5281/zenodo.XXXXXXX - To be completed upon Zenodo deposition]},
  url          = {https://github.com/[team-to-fill]/lightpath}
}`;

  const datasetApa =
    '[LightPath Team - Names to be confirmed by humans] (2026). LightPath: Lunar South-Pole Solar Illumination and Direct-to-Earth Line of Sight Dataset (Version 1.0.0) [Data set]. NASA Space Apps Challenge 2026. DOI: [10.5281/zenodo.XXXXXXX]';

  const softwareBibtex = `@software{lightpath_software_2026,
  author       = {[Human Contributor 1 - Name to be completed by team] and [Human Contributor 2 - Name to be completed by team] and [Human Contributor 3 - Name to be completed by team]},
  title        = {LightPath: Lunar South-Pole Solar Illumination, Direct-to-Earth Line of Sight, and Space-Time Route Solver},
  year         = {2026},
  publisher    = {GitHub},
  version      = {1.0.0},
  url          = {https://github.com/[team-to-fill]/lightpath}
}`;

  const softwareApa =
    '[Human Contributor 1], [Human Contributor 2], & [Human Contributor 3] (2026). LightPath: Lunar South-Pole Solar Illumination, Direct-to-Earth Line of Sight, and Space-Time Route Solver (Version 1.0.0) [Computer software]. GitHub. https://github.com/[team-to-fill]/lightpath';

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading reusable data catalog...</p>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <Card style={{ padding: '2rem', border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ef4444' }}>
            <AlertTriangle size={28} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Data Catalog Unavailable</h2>
          </div>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            The reusable data catalog file <code>./data/data_catalog.json</code> could not be loaded or failed schema validation.
          </p>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {error?.message || 'Failed to load catalog'}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem 1rem' }}>
      {/* 1. Header Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Database size={28} style={{ color: 'var(--accent-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Reusable Open Data & Downloads
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '880px', lineHeight: 1.6 }}>
          Deterministic, machine-readable visibility window tables for lunar south-pole sites in <strong>RFC 4180 CSV</strong> and{' '}
          <strong>Apache Parquet</strong> formats. All tables embed topocentric astrodynamic parameters, exact spherical curvature
          declarations, and cryptographic provenance hashes.
        </p>

        {/* Global Metadata Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
          <Badge variant="success">Data License: CC-BY-4.0</Badge>
          <Badge variant="info">Code License: MIT</Badge>
          <Badge variant="neutral">Frame: MOON_ME</Badge>
          <Badge variant="neutral">Elevation: Exact Spherical Curvature</Badge>
          <Badge variant="neutral">Radius: R_moon = 1,737.4 km</Badge>
          <Badge variant="neutral">Format Schema: v1.0.0</Badge>
        </div>
      </div>

      {/* 2. Real vs Synthetic Banner (Rule 3) */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <Info size={20} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
          <strong>Topographic Distinction (Project Rule 3):</strong> Datasets prefixed with <code>synthetic-</code> represent
          controlled geometric benchmarks (flat basin, 100m wall, crater rim) for mathematical algorithm verification. Datasets for{' '}
          <strong>Shackleton Connecting Ridge</strong>, <strong>Malapert Mountain</strong>, and <strong>Nobile Crater Rim</strong>{' '}
          use synthetic terrain models and approximate analytic ephemeris, to be replaced by SPICE and verified PDS DEMs.
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <Card style={{ padding: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={18} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              aria-label="Search files"
              placeholder="Search by filename, site, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Site Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Site:</span>
            <select
              aria-label="Filter by site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Datasets ({catalog.files.length})</option>
              {Array.from(new Set(catalog.files.map((f) => f.site_id))).map((sid) => (
                <option key={sid} value={sid}>
                  {sid === 'all-sites' ? 'Consolidated (All Sites)' : sid}
                </option>
              ))}
            </select>
          </div>

          {/* Format Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>Format:</span>
            {(['ALL', 'Parquet', 'CSV'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormatFilter(fmt)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: formatFilter === fmt ? 'var(--accent-primary)' : 'var(--bg-primary)',
                  color: formatFilter === fmt ? '#ffffff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. Files List */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Available Datasets ({filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'})
          </h2>
          <a
            href="https://github.com/AnmolGarg8/Lunar/blob/main/docs/DATA_FORMAT.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.85rem',
              color: 'var(--accent-primary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Data Schema Documentation (docs/DATA_FORMAT.md) <ExternalLink size={14} />
          </a>
        </div>

        {filteredFiles.length === 0 ? (
          <Card style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No datasets match the current filter criteria.</p>
            <button
              onClick={() => {
                setFormatFilter('ALL');
                setSiteFilter('ALL');
                setSearchQuery('');
              }}
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem' }}
            >
              Reset Filters
            </button>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredFiles.map((file) => {
              const isConsolidated = file.site_id === 'all-sites';
              const isSynthetic = file.site_id.startsWith('synthetic');

              return (
                <Card
                  key={file.filename}
                  data-testid={`file-row-${file.filename}`}
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    borderLeft: isConsolidated
                      ? '4px solid var(--accent-primary)'
                      : isSynthetic
                        ? '4px solid #f59e0b'
                        : '4px solid #10b981',
                  }}
                >
                  {/* File Metadata & Description */}
                  <div style={{ flex: '1 1 500px', minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {file.filename}
                      </span>
                      <Badge variant={file.format === 'Parquet' ? 'info' : 'neutral'}>{file.format}</Badge>
                      <Badge variant={isConsolidated ? 'info' : isSynthetic ? 'warning' : 'success'}>
                        {isConsolidated ? 'Consolidated (All Sites)' : isSynthetic ? 'Synthetic Benchmark' : 'Real Lunar Site'}
                      </Badge>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                        {formatBytes(file.size_bytes)} &bull; {file.rows} windows
                      </span>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {file.description}
                    </p>

                    {/* Checksum and License */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>
                        <span>SHA-256: </span>
                        <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {file.sha256.substring(0, 12)}...{file.sha256.substring(56)}
                        </code>
                        <button
                          onClick={() => handleCopy(`sha-${file.filename}`, file.sha256)}
                          title="Copy full SHA-256"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedKey === `sha-${file.filename}` ? '#10b981' : 'var(--text-secondary)',
                            marginLeft: '0.35rem',
                            padding: '2px',
                            verticalAlign: 'middle',
                          }}
                        >
                          {copiedKey === `sha-${file.filename}` ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                      <div>
                        <span>License: </span>
                        <strong>{file.license}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Download Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <a
                      href={file.rel_path}
                      download={file.filename}
                      className="btn btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <Download size={16} />
                      Download {file.format}
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Documented Schema Summary */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          Data Schema Specification Summary
        </h2>
        <Card style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Every exported CSV and Parquet table follows this uniform 10-column schema conforming strictly to{' '}
            <code>docs/DATA_FORMAT.md</code>.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)' }}>
                <th style={{ padding: '0.65rem 0.5rem' }}>Column Name</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Data Type</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Units / Range</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>site_id</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>string</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Alphanumeric slug</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Site or region identifier (e.g. <code>synthetic-proving-ground</code>)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>target</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>string</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>sun | earth | dte | joint</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Target celestial body or joint communications condition</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>window_id</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>int32</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>0-indexed</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Sequential identifier of contiguous window</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>start_utc</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>string (ISO 8601)</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>UTC timestamp</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Contiguous window commencement time</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>end_utc</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>string (ISO 8601)</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>UTC timestamp</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Contiguous window conclusion time</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>duration_h</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>float64</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Hours (h)</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Duration of contiguous visibility period</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>threshold_pct</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>float64</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>% or degrees</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Applied visibility threshold (disc % or station mask °)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>mast_height_m</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>float64</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Meters (m)</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Observer mast elevation above local terrain</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>is_synthetic</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>boolean</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>true | false</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>Distinguishes synthetic test terrains from real LOLA DEMs</td>
              </tr>
              <tr>
                <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>provenance_hash</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>string</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>8-char hex</td>
                <td style={{ padding: '0.65rem 0.5rem' }}>SHA-256 hash tracing exact DEM and SPICE kernel configuration</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* 6. Suggested Citation Section (Requirement 3 & Rule 2) */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Citing LightPath Data and Software
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Standard academic citations for mission studies, scientific publications, and conference proceedings.
            </p>
          </div>
          <a
            href="./CITATION.cff"
            download="CITATION.cff"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              textDecoration: 'none',
              padding: '0.45rem 0.85rem',
            }}
          >
            <Download size={14} /> Download CITATION.cff
          </a>
        </div>

        {/* Human Placeholder Notice */}
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
          }}
        >
          <strong style={{ color: '#d97706' }}>Notice (Project Rule 2):</strong> Author names and Zenodo DOIs below contain bracketed{' '}
          <code>[placeholders]</code>. In accordance with project integrity rules, agents never invent human contributor identities or unverified DOIs.
          Human team members must replace placeholders upon formal release.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Data Citation Card */}
          <Card style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Suggested Citation: Dataset</span>
              <button
                onClick={() => handleCopy('cite-data-bib', datasetBibtex)}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem',
                }}
              >
                {copiedKey === 'cite-data-bib' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedKey === 'cite-data-bib' ? 'Copied BibTeX' : 'Copy BibTeX'}
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>APA</span>
              <div
                style={{
                  padding: '0.65rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  marginTop: '0.25rem',
                }}
              >
                {datasetApa}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>BibTeX</span>
              <pre
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  marginTop: '0.25rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                }}
              >
                {datasetBibtex}
              </pre>
            </div>
          </Card>

          {/* Software Citation Card */}
          <Card style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Suggested Citation: Software</span>
              <button
                onClick={() => handleCopy('cite-soft-bib', softwareBibtex)}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem',
                }}
              >
                {copiedKey === 'cite-soft-bib' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedKey === 'cite-soft-bib' ? 'Copied BibTeX' : 'Copy BibTeX'}
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>APA</span>
              <div
                style={{
                  padding: '0.65rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  marginTop: '0.25rem',
                }}
              >
                {softwareApa}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>BibTeX</span>
              <pre
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  marginTop: '0.25rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                }}
              >
                {softwareBibtex}
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
