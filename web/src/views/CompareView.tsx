import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import { fetchJsonData } from '../utils/dataLoader';
import { SiteFullSchema, SiteFull } from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';

interface CompareViewProps {
  siteAId: string;
  siteBId: string;
}

interface MetricRow {
  metric: string;
  siteA: string | number;
  siteB: string | number;
  delta: string;
  advantage: 'A' | 'B' | 'Equal';
}

export const CompareView: React.FC<CompareViewProps> = ({ siteAId, siteBId }) => {
  const [siteA, setSiteA] = useState<SiteFull | null>(null);
  const [siteB, setSiteB] = useState<SiteFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/sites/${siteAId}.json`, SiteFullSchema),
      fetchJsonData(`./data/sites/${siteBId}.json`, SiteFullSchema),
    ])
      .then(([a, b]) => {
        setSiteA(a);
        setSiteB(b);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteAId, siteBId]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !siteA || !siteB) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading side-by-side comparative models...
      </div>
    );
  }

  const aSun = siteA.stats ? siteA.stats.sun.uptime_fraction * 100 : 0;
  const bSun = siteB.stats ? siteB.stats.sun.uptime_fraction * 100 : 0;
  const aDte = siteA.stats ? siteA.stats.dte.uptime_fraction * 100 : 0;
  const bDte = siteB.stats ? siteB.stats.dte.uptime_fraction * 100 : 0;
  const aJoint = siteA.stats ? siteA.stats.joint.uptime_fraction * 100 : 0;
  const bJoint = siteB.stats ? siteB.stats.joint.uptime_fraction * 100 : 0;
  const aDark = siteA.stats ? siteA.stats.sun.longest_outage_h : 0;
  const bDark = siteB.stats ? siteB.stats.sun.longest_outage_h : 0;

  const comparisonRows: MetricRow[] = [
    {
      metric: 'Continuous Sunlight Uptime',
      siteA: `${aSun.toFixed(1)}%`,
      siteB: `${bSun.toFixed(1)}%`,
      delta: `${Math.abs(aSun - bSun).toFixed(1)}%`,
      advantage: aSun > bSun ? 'A' : aSun < bSun ? 'B' : 'Equal',
    },
    {
      metric: 'Direct-to-Earth (DTE) Contact',
      siteA: `${aDte.toFixed(1)}%`,
      siteB: `${bDte.toFixed(1)}%`,
      delta: `${Math.abs(aDte - bDte).toFixed(1)}%`,
      advantage: aDte > bDte ? 'A' : aDte < bDte ? 'B' : 'Equal',
    },
    {
      metric: 'Joint Light & Link Window',
      siteA: `${aJoint.toFixed(1)}%`,
      siteB: `${bJoint.toFixed(1)}%`,
      delta: `${Math.abs(aJoint - bJoint).toFixed(1)}%`,
      advantage: aJoint > bJoint ? 'A' : aJoint < bJoint ? 'B' : 'Equal',
    },
    {
      metric: 'Longest Darkness Spell (Outage)',
      siteA: `${aDark} hours`,
      siteB: `${bDark} hours`,
      delta: `${Math.abs(aDark - bDark)} hours`,
      advantage: aDark < bDark ? 'A' : aDark > bDark ? 'B' : 'Equal',
    },
    {
      metric: 'Surface Elevation (m)',
      siteA: `${siteA.ground_elev_m} m`,
      siteB: `${siteB.ground_elev_m} m`,
      delta: `${Math.abs(siteA.ground_elev_m - siteB.ground_elev_m)} m`,
      advantage: siteA.ground_elev_m > siteB.ground_elev_m ? 'A' : 'B',
    },
  ];

  const columns: ColumnDef<MetricRow>[] = [
    { key: 'metric', header: 'Mission Planning Metric', sortable: true },
    { key: 'siteA', header: siteA.name, render: (r) => <strong className="mono">{r.siteA}</strong> },
    { key: 'siteB', header: siteB.name, render: (r) => <strong className="mono">{r.siteB}</strong> },
    { key: 'delta', header: 'Difference (Delta)', render: (r) => <span className="mono">{r.delta}</span> },
    {
      key: 'advantage',
      header: 'Advantage',
      render: (r) => (
        <Badge
          variant={r.advantage === 'Equal' ? 'neutral' : 'visible'}
          label={r.advantage === 'Equal' ? 'Parity' : `Favors ${r.advantage === 'A' ? siteA.name : siteB.name}`}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Badge variant="joint" label="SITE TRADE STUDY" />
          <Badge variant="synthetic" label="SYNTHETIC PROVING GROUND" />
        </div>
        <h1>Landing Site Trade Comparison</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
          Side-by-side analysis of sunlight availability, Earth line-of-sight, and battery survival outage durations.
        </p>
      </div>

      {/* Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <Card title={siteA.name} subtitle={`${siteA.lat_deg.toFixed(2)}° S, ${siteA.lon_deg.toFixed(2)}° E`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Stat label="Joint Availability" value={`${aJoint.toFixed(1)}%`} variant="joint" />
            <Stat label="Max Darkness Spell" value={`${aDark}h`} variant={aDark > 14 ? 'alert' : 'neutral'} />
          </div>
          <a href={`#/site/${siteA.id}`} className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
            View Full Profile for {siteA.name} →
          </a>
        </Card>

        <Card title={siteB.name} subtitle={`${siteB.lat_deg.toFixed(2)}° S, ${siteB.lon_deg.toFixed(2)}° E`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Stat label="Joint Availability" value={`${bJoint.toFixed(1)}%`} variant="joint" />
            <Stat label="Max Darkness Spell" value={`${bDark}h`} variant={bDark > 14 ? 'alert' : 'neutral'} />
          </div>
          <a href={`#/site/${siteB.id}`} className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
            View Full Profile for {siteB.name} →
          </a>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card
        title="Side-by-Side Trade Matrix"
        subtitle="Numbers behind the recommendations. Evaluated with identical 0.1° uncertainty margins and 50% disc fraction thresholds."
      >
        <DataTable columns={columns} data={comparisonRows} keyExtractor={(r) => r.metric} caption="Site A vs Site B Metrics" />
      </Card>
    </div>
  );
};
