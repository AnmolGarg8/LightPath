/**
 * Compare Sites View
 * 
 * Requirement 7:
 * - Two sites, same dates and scales, differences highlighted.
 * - One-line comparison generated from templates using the numbers.
 * - Synchronised threshold controls.
 * - Overlaid comparative horizon skyline visualization.
 * - Collapsible limitations panel.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchJsonData } from '../utils/dataLoader';
import {
  SiteFullSchema,
  HorizonSchema,
  SeriesSchema,
  SiteFull,
  Horizon,
  Series,
} from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';
import { LimitationsPanel } from '../components/common/LimitationsPanel';
import { calculateDynamicStats } from '../utils/statsCalculator';
import { generateSiteComparison } from '../utils/comparisonTemplate';
import { createPanoramaScales, COMPASS_POINTS } from '../utils/scales';
import { ArrowRightLeft, Sliders } from 'lucide-react';

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
  description: string;
}

export const CompareView: React.FC<CompareViewProps> = ({ siteAId, siteBId }) => {
  const [siteA, setSiteA] = useState<SiteFull | null>(null);
  const [siteB, setSiteB] = useState<SiteFull | null>(null);
  const [horizonA, setHorizonA] = useState<Horizon | null>(null);
  const [horizonB, setHorizonB] = useState<Horizon | null>(null);
  const [seriesA, setSeriesA] = useState<Series | null>(null);
  const [seriesB, setSeriesB] = useState<Series | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [threshold, setThreshold] = useState<number>(0.50);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/sites/${siteAId}.json`, SiteFullSchema),
      fetchJsonData(`./data/sites/${siteBId}.json`, SiteFullSchema),
      fetchJsonData(`./data/${siteAId}/horizon.json`, HorizonSchema),
      fetchJsonData(`./data/${siteBId}/horizon.json`, HorizonSchema),
      fetchJsonData(`./data/${siteAId}/series.json`, SeriesSchema),
      fetchJsonData(`./data/${siteBId}/series.json`, SeriesSchema),
    ])
      .then(([a, b, hA, hB, sA, sB]) => {
        setSiteA(a);
        setSiteB(b);
        setHorizonA(hA);
        setHorizonB(hB);
        setSeriesA(sA);
        setSeriesB(sB);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteAId, siteBId]);

  // Dynamic stats recomputed for both sites
  const statsA = useMemo(() => {
    if (!seriesA) return null;
    return calculateDynamicStats(seriesA, threshold);
  }, [seriesA, threshold]);

  const statsB = useMemo(() => {
    if (!seriesB) return null;
    return calculateDynamicStats(seriesB, threshold);
  }, [seriesB, threshold]);

  // One-line comparative summary generated from template
  const comparativeSummary = useMemo(() => {
    if (!siteA || !siteB || !statsA || !statsB) return '';
    return generateSiteComparison(
      {
        name: siteA.name,
        sunUptimeFraction: statsA.sun.uptime_fraction,
        earthUptimeFraction: statsA.earth.uptime_fraction,
        dteUptimeFraction: statsA.dte.uptime_fraction,
        jointUptimeFraction: statsA.joint_sun_dte.uptime_fraction,
        longestDarknessH: statsA.sun.longest_outage_h,
        longestEarthOutageH: statsA.earth.longest_outage_h,
        groundElevM: siteA.ground_elev_m,
      },
      {
        name: siteB.name,
        sunUptimeFraction: statsB.sun.uptime_fraction,
        earthUptimeFraction: statsB.earth.uptime_fraction,
        dteUptimeFraction: statsB.dte.uptime_fraction,
        jointUptimeFraction: statsB.joint_sun_dte.uptime_fraction,
        longestDarknessH: statsB.sun.longest_outage_h,
        longestEarthOutageH: statsB.earth.longest_outage_h,
        groundElevM: siteB.ground_elev_m,
      },
      threshold
    );
  }, [siteA, siteB, statsA, statsB, threshold]);

  // Draw Overlaid Dual Horizon Skyline Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !horizonA || !horizonB) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const elA = horizonA.el_deg[1] || horizonA.el_deg[0] || [];
    const elB = horizonB.el_deg[1] || horizonB.el_deg[0] || [];

    const maxEl = Math.max(6.0, Math.max(...elA, ...elB) + 1.0);
    const minEl = -1.5;

    const scales = createPanoramaScales({
      width: w,
      height: h,
      minElevationDeg: minEl,
      maxElevationDeg: maxEl,
    });
    const { scaleX, scaleY } = scales;

    // Clear
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.lineWidth = 1;
    for (let el = Math.floor(minEl); el <= maxEl; el += 1.0) {
      const y = scaleY(el);
      ctx.strokeStyle = el === 0 ? '#475569' : '#1e293b';
      ctx.setLineDash(el === 0 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = el === 0 ? '#94a3b8' : '#334155';
      ctx.font = '10px monospace';
      ctx.fillText(`${el > 0 ? '+' : ''}${el}°`, 6, y - 3);
    }

    COMPASS_POINTS.forEach((pt) => {
      const x = scaleX(pt.azimuthDeg);
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt.label, x, 14);
    });

    // Draw Skyline A (Blue line & translucent fill)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < elA.length; i++) {
      const az = i * horizonA.az_step_deg;
      ctx.lineTo(scaleX(az), scaleY(elA[i]));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Draw Skyline B (Amber dashed line & translucent fill)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < elB.length; i++) {
      const az = i * horizonB.az_step_deg;
      ctx.lineTo(scaleX(az), scaleY(elB[i]));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [horizonA, horizonB]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !siteA || !siteB || !statsA || !statsB) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading side-by-side comparative models...
      </div>
    );
  }

  const thresholdPct = Math.round(threshold * 100);

  const aSun = statsA.sun.uptime_fraction * 100;
  const bSun = statsB.sun.uptime_fraction * 100;
  const aEarth = statsA.earth.uptime_fraction * 100;
  const bEarth = statsB.earth.uptime_fraction * 100;
  const aDte = statsA.dte.uptime_fraction * 100;
  const bDte = statsB.dte.uptime_fraction * 100;
  const aJoint = statsA.joint_sun_dte.uptime_fraction * 100;
  const bJoint = statsB.joint_sun_dte.uptime_fraction * 100;
  const aDark = statsA.sun.longest_outage_h;
  const bDark = statsB.sun.longest_outage_h;
  const aEarthOut = statsA.earth.longest_outage_h;
  const bEarthOut = statsB.earth.longest_outage_h;

  const comparisonRows: MetricRow[] = [
    {
      metric: 'Sunlight Visibility Uptime',
      siteA: `${aSun.toFixed(1)}%`,
      siteB: `${bSun.toFixed(1)}%`,
      delta: `${Math.abs(aSun - bSun).toFixed(1)}%`,
      advantage: aSun > bSun ? 'A' : aSun < bSun ? 'B' : 'Equal',
      description: `Percentage of window with solar disc fraction ≥ ${thresholdPct}%.`,
    },
    {
      metric: 'Earth Line-of-Sight Uptime',
      siteA: `${aEarth.toFixed(1)}%`,
      siteB: `${bEarth.toFixed(1)}%`,
      delta: `${Math.abs(aEarth - bEarth).toFixed(1)}%`,
      advantage: aEarth > bEarth ? 'A' : aEarth < bEarth ? 'B' : 'Equal',
      description: `Geometric line of sight to Earth disc fraction ≥ ${thresholdPct}%.`,
    },
    {
      metric: 'Direct-to-Earth Contact (DTE)',
      siteA: `${aDte.toFixed(1)}%`,
      siteB: `${bDte.toFixed(1)}%`,
      delta: `${Math.abs(aDte - bDte).toFixed(1)}%`,
      advantage: aDte > bDte ? 'A' : aDte < bDte ? 'B' : 'Equal',
      description: 'Simultaneous line of sight to Earth and DSN stations above 6.0° mask.',
    },
    {
      metric: 'Joint Sun + DTE Line of Sight',
      siteA: `${aJoint.toFixed(1)}%`,
      siteB: `${bJoint.toFixed(1)}%`,
      delta: `${Math.abs(aJoint - bJoint).toFixed(1)}%`,
      advantage: aJoint > bJoint ? 'A' : aJoint < bJoint ? 'B' : 'Equal',
      description: 'Golden mission window with both solar illumination and DSN contact.',
    },
    {
      metric: 'Longest Darkness Outage',
      siteA: `${aDark.toFixed(1)}h`,
      siteB: `${bDark.toFixed(1)}h`,
      delta: `${Math.abs(aDark - bDark).toFixed(1)}h`,
      advantage: aDark < bDark ? 'A' : aDark > bDark ? 'B' : 'Equal',
      description: 'Longest continuous spell with sunlight below threshold.',
    },
    {
      metric: 'Longest Earth Sight Outage',
      siteA: `${aEarthOut.toFixed(1)}h`,
      siteB: `${bEarthOut.toFixed(1)}h`,
      delta: `${Math.abs(aEarthOut - bEarthOut).toFixed(1)}h`,
      advantage: aEarthOut < bEarthOut ? 'A' : aEarthOut > bEarthOut ? 'B' : 'Equal',
      description: 'Longest continuous period without geometric line of sight to Earth.',
    },
    {
      metric: 'Surface Elevation',
      siteA: `${siteA.ground_elev_m.toFixed(1)}m`,
      siteB: `${siteB.ground_elev_m.toFixed(1)}m`,
      delta: `${Math.abs(siteA.ground_elev_m - siteB.ground_elev_m).toFixed(1)}m`,
      advantage: siteA.ground_elev_m > siteB.ground_elev_m ? 'A' : siteA.ground_elev_m < siteB.ground_elev_m ? 'B' : 'Equal',
      description: 'Topographic elevation relative to 1737.4 km reference sphere.',
    },
  ];

  return (
    <div className="compare-container" style={{ padding: '1rem 0' }}>
      {/* Title & One-Line Comparison Banner */}
      <Card style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ArrowRightLeft size={22} style={{ color: 'var(--color-blue)' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            Side-by-Side Landing Site Trade Study
          </h1>
        </div>

        {/* Generated One-Line Template Statement */}
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid var(--color-blue)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            color: 'var(--text-main)',
            fontWeight: 500,
          }}
        >
          {comparativeSummary}
        </div>

        {/* Threshold Adjustment Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '1rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--background-secondary, #0f172a)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
          }}
        >
          <Sliders size={16} style={{ color: 'var(--color-blue)' }} />
          <span>Evaluation Threshold:</span>
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={thresholdPct}
            onChange={(e) => setThreshold(Number(e.target.value) / 100)}
            aria-label="Comparative Threshold Slider"
            style={{ flex: 1, accentColor: 'var(--color-blue)', cursor: 'pointer' }}
          />
          <strong>≥ {thresholdPct}% disc fraction</strong>
        </div>
      </Card>

      {/* Overlaid Comparative Horizon Skyline View */}
      <Card style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Comparative Horizon Profiles (Azimuth 0° – 360°)
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 14, height: 3, background: '#38bdf8', display: 'inline-block' }} />
              <strong>{siteA.name}</strong> (Blue Solid)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 14, height: 3, background: '#f59e0b', borderTop: '2px dashed #f59e0b', display: 'inline-block' }} />
              <strong>{siteB.name}</strong> (Amber Dashed)
            </span>
          </div>
        </div>

        <div style={{ width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <canvas ref={canvasRef} width={960} height={260} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </Card>

      {/* Side-by-Side Trade Matrix Table */}
      <Card style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
          Quantitative Trade Study Comparison Table
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table
            className="data-table"
            aria-label="Comparative Trade Study Table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
          >
            <thead>
              <tr style={{ background: 'var(--background-secondary, #0f172a)', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Metric</th>
                <th style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-color)', color: '#38bdf8' }}>
                  Site A: {siteA.name}
                </th>
                <th style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-color)', color: '#f59e0b' }}>
                  Site B: {siteB.name}
                </th>
                <th style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Delta</th>
                <th style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Advantage</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{row.metric}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.description}</div>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{row.siteA}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{row.siteB}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{row.delta}</td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    {row.advantage === 'A' && (
                      <Badge variant="info" size="sm">
                        {siteA.name.split(' ')[0]} +
                      </Badge>
                    )}
                    {row.advantage === 'B' && (
                      <Badge variant="warning" size="sm">
                        {siteB.name.split(' ')[0]} +
                      </Badge>
                    )}
                    {row.advantage === 'Equal' && (
                      <Badge variant="neutral" size="sm">
                        Comparable
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Limitations Panel */}
      <LimitationsPanel defaultExpanded={false} />
    </div>
  );
};
