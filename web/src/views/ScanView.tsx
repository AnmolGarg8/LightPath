/**
 * Area Scan Analysis View (/scan/:id)
 * 
 * Complies with docs/PROJECT_RULES.md:
 * - Reuses visibility cube (LPVC) across space and time.
 * - Heat map over the hillshade for:
 *   1) % of time with Sun above threshold
 *   2) % of time with Earth above threshold
 *   3) % of time with Sun plus direct-to-Earth contact
 * - Legend states active threshold and time window.
 * - Clicking a cell displays its Panorama and Timeline in a side panel.
 * - Generated sentence from data: "moving from the centre to the best nearby cell changes Earth visibility from X percent to Y percent."
 * - Cells whose difference from centre is smaller than terrain-data uncertainty are hatched and labelled not meaningful.
 * - Accessible top-five cells table as an alternative to the map.
 * - Prominent limitations panel: not landing-site selection; slopes, rocks and navigation excluded.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Slider } from '../components/ui/Slider';
import { fetchBinaryCube, fetchJsonData } from '../utils/dataLoader';
import { DecodedVisibilityCube } from '../utils/cubeDecoder';
import {
  VisibilityCubeHeaderSchema,
  VisibilityCubeHeader,
  SiteFullSchema,
  SiteFull,
  HorizonSchema,
  Horizon,
  SeriesSchema,
  Series,
} from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';
import {
  computeScanMap,
  ScanMetric,
  ScanCell,
  ScanSummary,
} from '../utils/scanCalculator';
import { Panorama } from './Panorama';
import { Timeline } from '../components/Timeline';
import { calculateDynamicStats } from '../utils/statsCalculator';
import { LimitationsPanel } from '../components/common/LimitationsPanel';
import {
  Layers,
  Compass,
  Award,
  ChevronRight,
  Crosshair,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ScanViewProps {
  siteId: string;
}

export const ScanView: React.FC<ScanViewProps> = ({ siteId }) => {
  const [siteData, setSiteData] = useState<SiteFull | null>(null);
  const [header, setHeader] = useState<VisibilityCubeHeader | null>(null);
  const [cube, setCube] = useState<DecodedVisibilityCube | null>(null);
  const [horizonData, setHorizonData] = useState<Horizon | null>(null);
  const [baseSeries, setBaseSeries] = useState<Series | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Scan Controls
  const [metric, setMetric] = useState<ScanMetric>(() => {
    const hash = window.location.hash;
    if (hash.includes('metric=sun')) return 'sun';
    if (hash.includes('metric=joint_dte')) return 'joint_dte';
    return 'earth';
  });
  const [threshold, setThreshold] = useState<number>(0.50);
  const [uncertaintyMarginPct, setUncertaintyMarginPct] = useState<number>(1.5);
  const [windowRange, setWindowRange] = useState<[number, number]>([0, 0]);

  // Selected cell for side panel inspection
  const [selectedCellCoord, setSelectedCellCoord] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<ScanCell | null>(null);

  // Synchronized time index for cell Panorama & Timeline inspection
  const [inspectTimeIndex, setInspectTimeIndex] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load all required data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/sites/${siteId}.json`, SiteFullSchema),
      fetchJsonData(`./data/cubes/${siteId}.json`, VisibilityCubeHeaderSchema),
      fetchBinaryCube(`./data/cubes/${siteId}.bin`),
      fetchJsonData(`./data/${siteId}/horizon.json`, HorizonSchema),
      fetchJsonData(`./data/${siteId}/series.json`, SeriesSchema),
    ])
      .then(([site, hdr, cb, horizon, series]) => {
        setSiteData(site);
        setHeader(hdr);
        setCube(cb);
        setHorizonData(horizon);
        setBaseSeries(series);

        // Default window range to entire cube
        const nt = hdr.time_utc.length;
        setWindowRange([0, Math.max(0, nt - 1)]);

        // Default selection to center cell
        const cx = Math.floor(hdr.grid.nx / 2);
        const cy = Math.floor(hdr.grid.ny / 2);
        setSelectedCellCoord({ x: cx, y: cy });

        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  // Compute scan summary and cell grid
  const scanSummary: ScanSummary | null = useMemo(() => {
    if (!cube || !header) return null;

    const dteLinkOk = baseSeries?.dte?.link_ok;

    return computeScanMap(cube, header, {
      metric,
      threshold,
      windowRange,
      dteLinkOk,
      uncertaintyMarginPct,
    });
  }, [cube, header, baseSeries, metric, threshold, windowRange, uncertaintyMarginPct]);

  // Current active selected cell
  const activeCell: ScanCell | null = useMemo(() => {
    if (!scanSummary || !selectedCellCoord) return null;
    const { x, y } = selectedCellCoord;
    const val = scanSummary.gridValues[y]?.[x] ?? 0;
    const centerVal = scanSummary.centerCell.valPct;
    const delta = val - centerVal;
    const spacingM = header?.grid.spacing_m ?? 40.0;
    const cx = scanSummary.centerCell.x;
    const cy = scanSummary.centerCell.y;
    const dx = (x - cx) * spacingM;
    const dy = (y - cy) * spacingM;

    return {
      x,
      y,
      valPct: val,
      deltaFromCenterPct: Number(delta.toFixed(2)),
      isMeaningful: Math.abs(delta) > uncertaintyMarginPct,
      offsetDxM: Math.round(dx),
      offsetDyM: Math.round(dy),
      distanceFromCenterM: Math.round(Math.hypot(dx, dy)),
      slopeDeg: Number((cube?.getSlopeDeg(y, x) ?? 0).toFixed(1)),
      isTraversable: cube?.isTraversable(y, x) ?? true,
    };
  }, [scanSummary, selectedCellCoord, header, uncertaintyMarginPct, cube]);

  // Synthesize cell time series for Panorama & Timeline side panel
  const cellSeries: Series | null = useMemo(() => {
    if (!baseSeries || !cube || !header || !selectedCellCoord) return null;
    const { x, y } = selectedCellCoord;
    const nt = header.time_utc.length;

    const sunFracs: number[] = [];
    const earthFracs: number[] = [];
    const sunStatuses: ('robust_visible' | 'marginal' | 'robust_blocked')[] = [];
    const earthStatuses: ('robust_visible' | 'marginal' | 'robust_blocked')[] = [];

    for (let t = 0; t < nt; t++) {
      const sf = cube.getSunFrac(t, y, x) / 100.0;
      const ef = cube.getEarthFrac(t, y, x) / 100.0;
      sunFracs.push(sf);
      earthFracs.push(ef);
      sunStatuses.push(sf >= threshold ? 'robust_visible' : sf > 0.05 ? 'marginal' : 'robust_blocked');
      earthStatuses.push(ef >= threshold ? 'robust_visible' : ef > 0.05 ? 'marginal' : 'robust_blocked');
    }

    return {
      time_utc: header.time_utc,
      sun: {
        az_deg: baseSeries.sun.az_deg,
        el_deg: baseSeries.sun.el_deg,
        radius_deg: baseSeries.sun.radius_deg,
        frac: sunFracs,
        status: sunStatuses,
      },
      earth: {
        az_deg: baseSeries.earth.az_deg,
        el_deg: baseSeries.earth.el_deg,
        radius_deg: baseSeries.earth.radius_deg,
        frac: earthFracs,
        status: earthStatuses,
        dist_km: baseSeries.earth.dist_km,
      },
      dte: {
        station_names: baseSeries.dte.station_names,
        station_visible: baseSeries.dte.station_visible,
        link_ok: earthFracs.map((ef, t) => ef >= threshold && (baseSeries.dte.link_ok[t] ?? true)),
      },
    };
  }, [baseSeries, cube, header, selectedCellCoord, threshold]);

  // Dynamic stats for inspected cell
  const cellStats = useMemo(() => {
    if (!cellSeries) return null;
    return calculateDynamicStats(cellSeries, threshold);
  }, [cellSeries, threshold]);

  // Canvas Drawing: Hillshade + Colormapped Heatmap + Diagonal Hatching Overlay + Markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cube || !scanSummary || !header) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nx = header.grid.nx;
    const ny = header.grid.ny;
    const cellW = canvas.width / nx;
    const cellH = canvas.height / ny;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const minVal = 0.0;
    const maxVal = 100.0;

    // Colormap color stops based on active metric
    const getColor = (pct: number): [number, number, number] => {
      const norm = Math.max(0.0, Math.min(1.0, (pct - minVal) / (maxVal - minVal)));
      if (metric === 'sun') {
        // Deep Obsidian (0%) -> Amber Rust (40%) -> Golden (70%) -> Brilliant Yellow (100%)
        if (norm < 0.4) {
          const t = norm / 0.4;
          return [Math.round(20 + t * 180), Math.round(15 + t * 75), Math.round(10 + t * 10)];
        } else if (norm < 0.75) {
          const t = (norm - 0.4) / 0.35;
          return [Math.round(200 + t * 45), Math.round(90 + t * 90), Math.round(20 + t * 10)];
        } else {
          const t = (norm - 0.75) / 0.25;
          return [Math.round(245 + t * 10), Math.round(180 + t * 65), Math.round(30 + t * 170)];
        }
      } else if (metric === 'earth') {
        // Midnight Navy (0%) -> Deep Azure (40%) -> Bright Cyan (75%) -> Electric White-Cyan (100%)
        if (norm < 0.4) {
          const t = norm / 0.4;
          return [Math.round(10 + t * 10), Math.round(20 + t * 60), Math.round(45 + t * 135)];
        } else if (norm < 0.75) {
          const t = (norm - 0.4) / 0.35;
          return [Math.round(20 + t * 10), Math.round(80 + t * 120), Math.round(180 + t * 65)];
        } else {
          const t = (norm - 0.75) / 0.25;
          return [Math.round(30 + t * 180), Math.round(200 + t * 50), Math.round(245 + t * 10)];
        }
      } else {
        // Dark Forest (0%) -> Emerald (40%) -> Lime (75%) -> Pale Gold (100%)
        if (norm < 0.4) {
          const t = norm / 0.4;
          return [Math.round(10 + t * 15), Math.round(30 + t * 100), Math.round(20 + t * 40)];
        } else if (norm < 0.75) {
          const t = (norm - 0.4) / 0.35;
          return [Math.round(25 + t * 85), Math.round(130 + t * 95), Math.round(60 + t * 10)];
        } else {
          const t = (norm - 0.75) / 0.25;
          return [Math.round(110 + t * 130), Math.round(225 + t * 25), Math.round(70 + t * 140)];
        }
      }
    };

    // 1. Draw base terrain hillshade + colored heatmap
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const val = scanSummary.gridValues[r][c];
        const slope = cube.getSlopeDeg(r, c);

        // Hillshade relief shading (light from az 315, alt 45)
        const hillshadeNorm = Math.max(0.2, Math.min(1.0, 0.6 + 0.35 * Math.cos((slope - 8) * (Math.PI / 180))));

        const [cr, cg, cb] = getColor(val);
        // Blend heatmap with hillshade relief
        const finalR = Math.round(cr * 0.75 * hillshadeNorm + 40 * (1 - 0.75) * hillshadeNorm);
        const finalG = Math.round(cg * 0.75 * hillshadeNorm + 40 * (1 - 0.75) * hillshadeNorm);
        const finalB = Math.round(cb * 0.75 * hillshadeNorm + 40 * (1 - 0.75) * hillshadeNorm);

        ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

        // Cell boundary grid
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      }
    }

    // 2. Diagonal Hatching on cells where difference from center <= terrain uncertainty (not meaningful)
    const centerVal = scanSummary.centerCell.valPct;
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const val = scanSummary.gridValues[r][c];
        const delta = Math.abs(val - centerVal);

        if (delta <= uncertaintyMarginPct) {
          const cellX = c * cellW;
          const cellY = r * cellH;

          ctx.save();
          ctx.beginPath();
          ctx.rect(cellX, cellY, cellW, cellH);
          ctx.clip();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;

          for (let offset = -cellH; offset < cellW + cellH; offset += 5.5) {
            ctx.beginPath();
            ctx.moveTo(cellX + offset, cellY);
            ctx.lineTo(cellX + offset + cellH, cellY + cellH);
            ctx.stroke();
          }

          ctx.restore();
        }
      }
    }

    // 3. Mark Center Cell (Reticle / White Crosshair)
    const cx = scanSummary.centerCell.x;
    const cy = scanSummary.centerCell.y;
    const centerPxX = (cx + 0.5) * cellW;
    const centerPxY = (cy + 0.5) * cellH;

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(centerPxX, centerPxY, Math.min(cellW, cellH) * 0.36, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerPxX, centerPxY, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Small "C" indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', centerPxX, centerPxY - cellH * 0.42);
    ctx.restore();

    // 4. Mark Best Cell (Gold Star / Diamond)
    const bx = scanSummary.bestCell.x;
    const by = scanSummary.bestCell.y;
    const bestPxX = (bx + 0.5) * cellW;
    const bestPxY = (by + 0.5) * cellH;

    ctx.save();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';

    // Diamond path
    const rad = Math.min(cellW, cellH) * 0.4;
    ctx.beginPath();
    ctx.moveTo(bestPxX, bestPxY - rad);
    ctx.lineTo(bestPxX + rad, bestPxY);
    ctx.lineTo(bestPxX, bestPxY + rad);
    ctx.lineTo(bestPxX - rad, bestPxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', bestPxX, bestPxY);
    ctx.restore();

    // 5. Selected Cell Highlight
    if (selectedCellCoord) {
      const sx = selectedCellCoord.x;
      const sy = selectedCellCoord.y;
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3.0;
      ctx.strokeRect(sx * cellW + 1, sy * cellH + 1, cellW - 2, cellH - 2);
      ctx.restore();
    }
  }, [cube, scanSummary, header, metric, uncertaintyMarginPct, selectedCellCoord]);

  // Handle canvas clicks to select cell
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !header) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nx = header.grid.nx;
    const ny = header.grid.ny;
    const cellW = rect.width / nx;
    const cellH = rect.height / ny;

    const c = Math.floor(clickX / cellW);
    const r = Math.floor(clickY / cellH);

    if (c >= 0 && c < nx && r >= 0 && r < ny) {
      setSelectedCellCoord({ x: c, y: r });
    }
  };

  // Handle canvas mouse move for hover tooltip
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !header || !scanSummary || !cube) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nx = header.grid.nx;
    const ny = header.grid.ny;
    const cellW = rect.width / nx;
    const cellH = rect.height / ny;

    const c = Math.floor(clickX / cellW);
    const r = Math.floor(clickY / cellH);

    if (c >= 0 && c < nx && r >= 0 && r < ny) {
      const val = scanSummary.gridValues[r][c];
      const centerVal = scanSummary.centerCell.valPct;
      const delta = val - centerVal;
      const spacingM = header.grid.spacing_m;
      const cx = scanSummary.centerCell.x;
      const cy = scanSummary.centerCell.y;
      const dx = (c - cx) * spacingM;
      const dy = (r - cy) * spacingM;

      setHoveredCell({
        x: c,
        y: r,
        valPct: val,
        deltaFromCenterPct: Number(delta.toFixed(2)),
        isMeaningful: Math.abs(delta) > uncertaintyMarginPct,
        offsetDxM: Math.round(dx),
        offsetDyM: Math.round(dy),
        distanceFromCenterM: Math.round(Math.hypot(dx, dy)),
        slopeDeg: Number(cube.getSlopeDeg(r, c).toFixed(1)),
        isTraversable: cube.isTraversable(r, c),
      });
    } else {
      setHoveredCell(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <Layers className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Spatio-Temporal Visibility Cube...</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Unpacking LPVC compressed binary grid for site <code>{siteId}</code>
        </p>
      </div>
    );
  }

  if (error || !siteData || !header || !cube || !scanSummary || !horizonData || !baseSeries) {
    return <ValidationErrorPage error={error || new Error('Failed to load visibility cube for area scan.')} />;
  }

  const nt = header.time_utc.length;
  const metricTitle =
    metric === 'sun'
      ? 'Sun Illumination Visibility'
      : metric === 'earth'
      ? 'Earth Line-of-Sight Visibility'
      : 'Joint Sun & Direct-to-Earth Contact';

  return (
    <div className="scan-view" style={{ paddingBottom: '4rem' }}>
      {/* Top Banner & Breadcrumb */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <a href="#/" style={{ color: 'inherit' }}>Missions</a>
              <ChevronRight size={14} />
              <a href={`#/site/${siteId}`} style={{ color: 'inherit' }}>{siteData.name}</a>
              <ChevronRight size={14} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Area Scan</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>Area Scan: {siteData.name}</span>
              {siteData.is_synthetic && <Badge variant="warning">SYNTHETIC PROVING GROUND</Badge>}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a
              href={`#/site/${siteId}`}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Compass size={14} /> View Horizon
            </a>
            <a
              href={`#/route/${siteId}`}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Crosshair size={14} /> Plan Traverse
            </a>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: '1.5rem' }}>
        {/* Controls Bar */}
        <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
            {/* Metric Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Scan Target Metric
              </label>
              <SegmentedControl
                options={[
                  { value: 'earth', label: 'Earth Visibility' },
                  { value: 'sun', label: 'Sun Visibility' },
                  { value: 'joint_dte', label: 'Sun + DTE' },
                ]}
                value={metric}
                onChange={(val) => setMetric(val as ScanMetric)}
              />
            </div>

            {/* Threshold Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Visibility Disc Threshold
                </label>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  ≥ {Math.round(threshold * 100)}% disc
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {[0.10, 0.50, 0.80].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setThreshold(preset)}
                    className={`btn ${threshold === preset ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', flex: 1 }}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Uncertainty Margin */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  DEM Uncertainty Band
                </label>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ±{uncertaintyMarginPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {[1.0, 1.5, 2.5, 5.0].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUncertaintyMarginPct(u)}
                    className={`btn ${uncertaintyMarginPct === u ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', flex: 1 }}
                  >
                    ±{u.toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Time Window Slider */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                Scanned Time Window:
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {scanSummary.windowStartUtc.replace('T', ' ').replace('Z', ' UTC')} to{' '}
                  {scanSummary.windowEndUtc.replace('T', ' ').replace('Z', ' UTC')}
                </span>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                {scanSummary.windowHours.toFixed(1)} Hours ({windowRange[1] - windowRange[0] + 1} steps)
              </span>
            </div>
            <Slider
              label="Scanned Duration Steps"
              min={0}
              max={nt - 1}
              step={1}
              value={windowRange[1]}
              onChange={(val) => setWindowRange([0, val])}
              unit=" steps"
            />
          </div>
        </Card>

        {/* Generated Sentence from Data (Requirement 3) */}
        <div
          style={{
            backgroundColor: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <Sparkles size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)', marginBottom: '0.2rem' }}>
              Surface Finding (Derived Deterministically from Data)
            </div>
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {scanSummary.generatedSentence}
            </p>
          </div>
        </div>

        {/* Main Grid: Heatmap Map Canvas on Left (or Top), Side Panel on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Canvas Map & Legend */}
          <div>
            <Card style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
                  {metricTitle} Map
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Grid: {header.grid.nx}×{header.grid.ny} ({header.grid.spacing_m}m spacing)
                </span>
              </div>

              {/* Canvas Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  backgroundColor: '#05070a',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  cursor: 'crosshair',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={560}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />

                {/* Hover Tooltip Overlay */}
                {hoveredCell && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      backgroundColor: 'rgba(10, 14, 23, 0.92)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      pointerEvents: 'none',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                      zIndex: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      Cell [{hoveredCell.x}, {hoveredCell.y}] ({hoveredCell.distanceFromCenterM}m from center)
                    </div>
                    <div>
                      {metric === 'sun' ? 'Sun' : metric === 'earth' ? 'Earth' : 'Sun+DTE'} Visibility:{' '}
                      <strong style={{ color: 'var(--accent-primary)' }}>{hoveredCell.valPct.toFixed(1)}%</strong>
                    </div>
                    <div>
                      Difference from Center:{' '}
                      <strong style={{ color: hoveredCell.deltaFromCenterPct >= 0 ? '#10b981' : '#ef4444' }}>
                        {hoveredCell.deltaFromCenterPct >= 0 ? '+' : ''}
                        {hoveredCell.deltaFromCenterPct.toFixed(1)}%
                      </strong>
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>
                      {hoveredCell.isMeaningful ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>● Statistically meaningful</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          ▨ Within uncertainty (not meaningful)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Legend with explicit threshold and window (Requirement 1 & 4) */}
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>Illumination / Line-of-Sight Gradient:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>0% (Dark/Blocked) → 100% (Continuous Line of Sight)</span>
                </div>

                {/* Color bar */}
                <div
                  style={{
                    height: '10px',
                    borderRadius: '4px',
                    marginBottom: '0.6rem',
                    background:
                      metric === 'sun'
                        ? 'linear-gradient(to right, #140f0a, #c85a14, #f5b41e, #fffaaa)'
                        : metric === 'earth'
                        ? 'linear-gradient(to right, #0a142d, #1450b4, #14c8f5, #b4f5ff)'
                        : 'linear-gradient(to right, #0a1e14, #19823c, #6ee146, #e6ffb4)',
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <strong>Threshold:</strong> ≥ {Math.round(threshold * 100)}% disc fraction
                  </div>
                  <div>
                    <strong>Window:</strong> {scanSummary.windowHours.toFixed(1)} hours
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        background:
                          'repeating-linear-gradient(45deg, rgba(255,255,255,0.3), rgba(255,255,255,0.3) 2px, transparent 2px, transparent 4px)',
                      }}
                    />
                    <span>Hatched: within ±{uncertaintyMarginPct.toFixed(1)}% uncertainty (not meaningful)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #fff' }} />
                    <span>[C] Centre marker</span>
                    <span style={{ marginLeft: '0.5rem', color: '#ffd700', fontWeight: 'bold' }}>★ Best cell</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top-Five Cells Table (Accessible Alternative - Requirement 5) */}
            <Card style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={18} style={{ color: '#ffd700' }} />
                  Top-Five Rated Cells (Accessible Alternative)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Ranked by {metric === 'sun' ? 'Sun' : metric === 'earth' ? 'Earth' : 'Joint DTE'} Uptime %
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}
                  aria-label="Top-five rated cells for the active area scan"
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem' }}>Rank</th>
                      <th style={{ padding: '0.5rem' }}>Coordinates</th>
                      <th style={{ padding: '0.5rem' }}>Offset from Centre</th>
                      <th style={{ padding: '0.5rem' }}>{metricTitle}</th>
                      <th style={{ padding: '0.5rem' }}>Δ vs Centre</th>
                      <th style={{ padding: '0.5rem' }}>Significance</th>
                      <th style={{ padding: '0.5rem' }}>Slope</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanSummary.top5Cells.map((cell) => {
                      const isSelected = selectedCellCoord?.x === cell.x && selectedCellCoord?.y === cell.y;
                      return (
                        <tr
                          key={cell.rank}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>
                            {cell.rank === 1 ? '🥇 #1' : `#${cell.rank}`}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace' }}>
                            [{cell.x}, {cell.y}]
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            {cell.offsetDxM >= 0 ? `+${cell.offsetDxM}` : cell.offsetDxM}m E,{' '}
                            {cell.offsetDyM >= 0 ? `+${cell.offsetDyM}` : cell.offsetDyM}m N ({cell.distanceFromCenterM}m)
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {cell.valPct.toFixed(1)}%
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: cell.deltaFromCenterPct >= 0 ? '#10b981' : '#ef4444' }}>
                            {cell.deltaFromCenterPct >= 0 ? `+` : ``}
                            {cell.deltaFromCenterPct.toFixed(1)}%
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            {cell.isMeaningful ? (
                              <Badge variant="success">Meaningful</Badge>
                            ) : (
                              <Badge variant="neutral">Not meaningful</Badge>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            {cell.slopeDeg}°
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedCellCoord({ x: cell.x, y: cell.y })}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right Column: Cell Side Panel (Panorama + Timeline) (Requirement 2) */}
          <div>
            <Card style={{ padding: '1.25rem', position: 'sticky', top: '80px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Crosshair size={18} style={{ color: 'var(--accent-primary)' }} />
                    Inspected Cell [{activeCell ? activeCell.x : 0}, {activeCell ? activeCell.y : 0}]
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {activeCell && activeCell.offsetDxM >= 0 ? `+` : ``}{activeCell?.offsetDxM ?? 0}m East,{' '}
                    {activeCell && activeCell.offsetDyM >= 0 ? `+` : ``}{activeCell?.offsetDyM ?? 0}m North (Ground Distance:{' '}
                    {activeCell?.distanceFromCenterM ?? 0}m)
                  </div>
                </div>

                {activeCell && activeCell.x === scanSummary.centerCell.x && activeCell.y === scanSummary.centerCell.y ? (
                  <Badge variant="info">CENTRE POINT</Badge>
                ) : activeCell && activeCell.x === scanSummary.bestCell.x && activeCell.y === scanSummary.bestCell.y ? (
                  <Badge variant="success">★ BEST CANDIDATE</Badge>
                ) : null}
              </div>

              {/* Cell Summary Metric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <Stat
                  label={metric === 'sun' ? 'Sun Uptime' : metric === 'earth' ? 'Earth Uptime' : 'Sun+DTE'}
                  value={`${activeCell?.valPct.toFixed(1) ?? '0.0'}%`}
                  description={`Threshold ≥ ${Math.round(threshold * 100)}%`}
                  variant={metric === 'sun' ? 'sun' : metric === 'earth' ? 'earth' : 'joint'}
                />
                <Stat
                  label="Δ vs Centre"
                  value={`${(activeCell?.deltaFromCenterPct ?? 0) >= 0 ? '+' : ''}${activeCell?.deltaFromCenterPct.toFixed(1) ?? '0.0'}%`}
                  description={activeCell?.isMeaningful ? 'Statistically meaningful' : 'Within uncertainty'}
                  variant={activeCell?.isMeaningful ? 'success' : 'neutral'}
                />
                <Stat
                  label="Local Slope"
                  value={`${activeCell?.slopeDeg ?? 0}°`}
                  description={activeCell?.isTraversable ? 'Traversable' : 'Exceeds limit'}
                  variant={activeCell?.isTraversable ? 'neutral' : 'alert'}
                />
              </div>

              {/* Side Panel Mini-Panorama (Requirement 2) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Compass size={14} style={{ color: 'var(--accent-primary)' }} />
                    Cell Horizon Skyline & Celestial Positions
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {header.time_utc[inspectTimeIndex]?.replace('T', ' ').replace('Z', ' UTC')}
                  </span>
                </div>

                {cellSeries && (
                  <Panorama
                    horizon={horizonData}
                    series={cellSeries}
                    mastHeightM={2.0}
                    timeIndex={inspectTimeIndex}
                    onTimeChange={setInspectTimeIndex}
                    threshold={threshold}
                  />
                )}
              </div>

              {/* Side Panel Mini-Timeline (Requirement 2) */}
              {cellSeries && cellStats && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                      Cell Multi-Lane Timeline
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Sun, Earth & DTE Link
                    </span>
                  </div>

                  <Timeline
                    series={cellSeries}
                    timeIndex={inspectTimeIndex}
                    onTimeChange={setInspectTimeIndex}
                    threshold={threshold}
                    sunStats={cellStats.sun}
                    earthStats={cellStats.earth}
                    events={cellStats.events}
                  />
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Prominent Limitations Panel (Requirement 6) */}
        <div style={{ marginTop: '2.5rem' }}>
          <LimitationsPanel />
        </div>
      </div>
    </div>
  );
};
