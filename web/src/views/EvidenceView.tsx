import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import { fetchJsonData } from '../utils/dataLoader';
import { ProvenanceSchema, Provenance } from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';

interface EvidenceViewProps {
  siteId: string;
}

interface DatasetRow {
  name: string;
  version: string;
  source_url: string;
}

interface KernelRow {
  name: string;
  checksum: string;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ siteId }) => {
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJsonData(`./data/${siteId}/provenance.json`, ProvenanceSchema)
      .then((data) => {
        setProvenance(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !provenance) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading scientific evidence audit trail...
      </div>
    );
  }

  const datasetCols: ColumnDef<DatasetRow>[] = [
    { key: 'name', header: 'Dataset / Product Name', sortable: true },
    { key: 'version', header: 'Version / Release', render: (d) => <span className="mono">{d.version}</span> },
    {
      key: 'source_url',
      header: 'Primary Archive Source',
      render: (d) => (
        <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 'var(--text-xs)' }}>
          {d.source_url}
        </a>
      ),
    },
  ];

  const kernelCols: ColumnDef<KernelRow>[] = [
    { key: 'name', header: 'Kernel / Ephemeris Package', sortable: true },
    { key: 'checksum', header: 'Verification Integrity Checksum', render: (k) => <code className="mono">{k.checksum}</code> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Badge variant="joint" label="SCIENTIFIC PROVENANCE" />
          <Badge variant="neutral" label={`SITE: ${siteId}`} />
        </div>
        <h1>Dataset Evidence & Audit Trail</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
          Primary sources, mathematical tolerances, and SPICE ephemeris kernels backing all LightPath calculations.
        </p>
      </div>

      {/* Datasets Table */}
      <Card title="Primary Terrain & Elevation Products" subtitle="NASA Planetary Data System (PDS) and Geodesy Data Archive holdings.">
        <DataTable columns={datasetCols} data={provenance.datasets} keyExtractor={(d) => d.name} />
      </Card>

      {/* Kernels Table */}
      <Card title="Planetary Ephemeris & Attitude Kernels" subtitle="NASA NAIF SPICE kernel pool configuration for lunar orientation.">
        <DataTable columns={kernelCols} data={provenance.kernels} keyExtractor={(k) => k.name} />
      </Card>

      {/* Mathematical Tolerances & Verification Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <Card title="Mathematical Verification Tolerances" subtitle="Engineered test thresholds from docs/PROJECT_RULES.md.">
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
              <span>V1 Flat Sphere Horizon Dip:</span>
              <strong className="mono">±0.005° tolerance</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
              <span>V2 Wall Feature Elevation:</span>
              <strong className="mono">±0.01° tolerance</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
              <span>V3 Nested Multi-Resolution Seam:</span>
              <strong className="mono">±0.005° (No step)</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
              <span>V4 Topocentric Local-Up Tilt:</span>
              <strong className="mono">±0.01° (0.099° at 3km)</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>V5 Fibonacci Disc Quadrature:</span>
              <strong className="mono">≤ 0.005 area fraction</strong>
            </li>
          </ul>
        </Card>

        <Card title="Automated Test Suite Status" subtitle="Regression verification executed during data pipeline run.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Passing Tests:</span>
              <strong style={{ color: 'var(--color-visible)', fontSize: 'var(--text-xl)' }} className="mono">
                {provenance.tests_summary.tests_passed} / {provenance.tests_summary.tests_total}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Last Verification Run:</span>
              <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                {provenance.tests_summary.last_verified_utc}
              </span>
            </div>
            <a href="#/trust" className="btn btn-outline" style={{ marginTop: '0.5rem' }}>
              View Comprehensive Trust & Benchmark Matrix →
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};
