import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { Slider } from '../components/ui/Slider';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import { fetchJsonData } from '../utils/dataLoader';
import {
  SiteFullSchema,
  HorizonSchema,
  SeriesSchema,
  SiteFull,
  Horizon,
  Series,
  MastHeightSensitivity,
} from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';

interface SiteDetailViewProps {
  siteId: string;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({ siteId }) => {
  const [siteData, setSiteData] = useState<SiteFull | null>(null);
  const [horizonData, setHorizonData] = useState<Horizon | null>(null);
  const [seriesData, setSeriesData] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [mastHeightM, setMastHeightM] = useState<number>(2.0);
  const [timeIndex, setTimeIndex] = useState<number>(0);

  const horizonCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/sites/${siteId}.json`, SiteFullSchema),
      fetchJsonData(`./data/${siteId}/horizon.json`, HorizonSchema),
      fetchJsonData(`./data/${siteId}/series.json`, SeriesSchema),
    ])
      .then(([site, horizon, series]) => {
        setSiteData(site);
        setHorizonData(horizon);
        setSeriesData(series);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  // Render Horizon Profile Canvas
  useEffect(() => {
    const canvas = horizonCanvasRef.current;
    if (!canvas || !horizonData || !seriesData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    // Grid lines for elevation (-2° to +6°)
    const minEl = -2.0;
    const maxEl = 6.0;
    const elToY = (el: number) => h - ((el - minEl) / (maxEl - minEl)) * h;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    for (let el = minEl; el <= maxEl; el += 1.0) {
      const y = elToY(el);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = el === 0 ? '#64748b' : '#334155';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${el > 0 ? '+' : ''}${el}°`, 6, y - 3);
    }

    // 0° elevation reference line
    const zeroY = elToY(0.0);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Find closest mast height index
    let hIdx = 0;
    let minDiff = Infinity;
    horizonData.heights_m.forEach((hm, idx) => {
      const diff = Math.abs(hm - mastHeightM);
      if (diff < minDiff) {
        minDiff = diff;
        hIdx = idx;
      }
    });

    const elRow = horizonData.el_deg[hIdx] || horizonData.el_deg[0];
    const nAz = elRow.length;

    // Draw Terrain Horizon
    ctx.fillStyle = 'rgba(30, 41, 66, 0.75)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < nAz; i++) {
      const x = (i / (nAz - 1)) * w;
      const y = elToY(elRow[i]);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < nAz; i++) {
      const x = (i / (nAz - 1)) * w;
      const y = elToY(elRow[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot Sun position at current timeIndex
    if (seriesData.sun.az_deg[timeIndex] !== undefined) {
      const sAz = seriesData.sun.az_deg[timeIndex];
      const sEl = seriesData.sun.el_deg[timeIndex];
      const sX = (sAz / 360) * w;
      const sY = elToY(sEl);

      // Sun halo & disc
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(sX, sY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 11px JetBrains Mono, monospace';
      ctx.fillText(`SUN (${seriesData.sun.frac[timeIndex] * 100}%)`, Math.min(w - 90, sX + 12), sY + 4);
    }

    // Plot Earth position at current timeIndex
    if (seriesData.earth.az_deg[timeIndex] !== undefined) {
      const eAz = seriesData.earth.az_deg[timeIndex];
      const eEl = seriesData.earth.el_deg[timeIndex];
      const eX = (eAz / 360) * w;
      const eY = elToY(eEl);

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(eX, eY, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 11px JetBrains Mono, monospace';
      ctx.fillText('EARTH', Math.min(w - 60, eX + 14), eY + 4);
    }
  }, [horizonData, seriesData, mastHeightM, timeIndex]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !siteData || !seriesData || !horizonData) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading high-resolution topocentric site models...
      </div>
    );
  }

  const stats = siteData.stats;
  const sensCols: ColumnDef<MastHeightSensitivity>[] = [
    { key: 'mast_height_m', header: 'Mast (m)', sortable: true, render: (s) => <strong className="mono">{s.mast_height_m}m</strong> },
    { key: 'sun_uptime_fraction', header: 'Sun Uptime', sortable: true, render: (s) => `${(s.sun_uptime_fraction * 100).toFixed(1)}%` },
    { key: 'dte_uptime_fraction', header: 'DTE Contact', sortable: true, render: (s) => `${(s.dte_uptime_fraction * 100).toFixed(1)}%` },
    { key: 'joint_uptime_fraction', header: 'Joint Light & Link', sortable: true, render: (s) => <strong style={{ color: 'var(--color-joint)' }}>{(s.joint_uptime_fraction * 100).toFixed(1)}%</strong> },
    { key: 'longest_darkness_h', header: 'Max Darkness', sortable: true, render: (s) => `${s.longest_darkness_h}h` },
  ];

  const currentTime = seriesData.time_utc[timeIndex] || '2026-11-01T00:00:00Z';
  const currentSunFrac = Math.round((seriesData.sun.frac[timeIndex] || 0) * 100);
  const currentEarthFrac = Math.round((seriesData.earth.frac[timeIndex] || 0) * 100);
  const currentLink = seriesData.dte.link_ok[timeIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Site Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Badge variant={siteData.is_synthetic ? 'synthetic' : 'visible'} label={siteData.is_synthetic ? 'SYNTHETIC' : 'PLANNED'} />
            <Badge variant={siteData.verified ? 'visible' : 'marginal'} label={siteData.verified ? 'Primary Verified' : 'Unverified Coordinates'} />
          </div>
          <h1 style={{ margin: 0 }}>{siteData.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '0.2rem' }}>
            Coordinates: {siteData.lat_deg.toFixed(4)}° S, {siteData.lon_deg.toFixed(4)}° E • Surface Elevation: {siteData.ground_elev_m} m (MOON_ME reference sphere)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href={`#/route/${siteId}`} className="btn btn-primary">
            Plan Rover Traverse →
          </a>
          <a href={`#/compare/${siteId}/synthetic-crater-rim`} className="btn btn-secondary">
            Compare With Ridge
          </a>
          <a href={`#/evidence/${siteId}`} className="btn btn-outline">
            Audit Science Evidence
          </a>
        </div>
      </div>

      {/* Decision Summary Output Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Stat
          label="Sun Availability"
          value={stats ? `${(stats.sun.uptime_fraction * 100).toFixed(1)}%` : '--'}
          variant="sun"
          description="Total continuous sunlight above 50% threshold."
        />
        <Stat
          label="Direct-to-Earth Link"
          value={stats ? `${(stats.dte.uptime_fraction * 100).toFixed(1)}%` : '--'}
          variant="earth"
          description="Direct LOS to Goldstone, Madrid, or Canberra."
        />
        <Stat
          label="Joint Power & Link"
          value={stats ? `${(stats.joint.uptime_fraction * 100).toFixed(1)}%` : '--'}
          variant="joint"
          description="Simultaneous rover solar generation and teleoperation."
        />
        <Stat
          label="Longest Darkness Outage"
          value={stats ? `${stats.sun.longest_outage_h}` : '--'}
          unit="hours"
          variant="alert"
          alertText="Battery Survival Deadline"
          description="Continuous darkness requiring survival power."
        />
      </div>

      {/* Horizon Profile & Mast Height Controller */}
      <Card
        title="Topocentric Terrain Horizon Profile & Ephemeris Occlusion"
        subtitle="Horizon elevation profile evaluated across 360° azimuth. Exact curved lunar sphere raycasting against digital elevation models."
        action={
          <div style={{ minWidth: '220px' }}>
            <Slider
              label="Observer Mast Height"
              value={mastHeightM}
              min={0.5}
              max={5.0}
              step={0.5}
              unit="m"
              ticks={[0.5, 1.0, 2.0, 3.0, 5.0]}
              onChange={setMastHeightM}
            />
          </div>
        }
      >
        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
          <canvas
            ref={horizonCanvasRef}
            width={900}
            height={260}
            style={{ width: '100%', height: 'auto', borderRadius: '6px', border: '1px solid var(--border-color)' }}
            aria-label="Horizon elevation profile canvas"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: 'var(--text-xs)' }}>
            <span style={{ color: 'var(--text-muted)' }}>0° (North)</span>
            <span style={{ color: 'var(--text-muted)' }}>90° (East)</span>
            <span style={{ color: 'var(--text-muted)' }}>180° (South)</span>
            <span style={{ color: 'var(--text-muted)' }}>270° (West)</span>
            <span style={{ color: 'var(--text-muted)' }}>360° (North)</span>
          </div>
        </div>

        {/* Time Slider */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Slider
            label={`Timeline Step: ${currentTime}`}
            value={timeIndex}
            min={0}
            max={seriesData.time_utc.length - 1}
            step={1}
            onChange={setTimeIndex}
          />
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: 'var(--text-xs)' }}>
            <span>
              Solar Disc: <strong>{currentSunFrac}%</strong> ({seriesData.sun.status[timeIndex]})
            </span>
            <span>
              Earth Disc: <strong>{currentEarthFrac}%</strong> ({seriesData.earth.status[timeIndex]})
            </span>
            <span>
              DTE Contact:{' '}
              <strong style={{ color: currentLink ? 'var(--color-visible)' : 'var(--color-blocked)' }}>
                {currentLink ? 'ACTIVE (LINK OK)' : 'BLOCKED'}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Sensitivity by Mast Height Table */}
      <Card
        title="Mast Height Sensitivity Trade Study"
        subtitle="Evaluates how elevating solar panels and communication antennas alters continuous sunlight and darkness spells."
      >
        <DataTable
          columns={sensCols}
          data={siteData.sensitivities?.mast_height || []}
          keyExtractor={(item) => String(item.mast_height_m)}
          caption="Uptime and Outage Duration by Mast Height"
        />
      </Card>
    </div>
  );
};
