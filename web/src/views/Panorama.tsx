/**
 * Horizon Panorama View
 * 
 * Requirement 3:
 * - Azimuth 0 to 360 with compass labels on the horizontal axis.
 * - Elevation on the vertical axis, zoomed to useful range (-1° to +6°, expanding if skyline is higher).
 * - Terrain skyline as a filled shape for chosen mast height.
 * - Sun and Earth discs drawn at true angular size (Sun ~0.53°, Earth ~1.9° read from data), clipped by the skyline (hidden part dimmed, visible fraction shown as text).
 * - Tracks for chosen dates coloured by status with patterns for colour-blind users.
 * - Time slider with play, pause, speed, step and keyboard control (arrows step, space plays).
 * - Reduced-motion respected.
 * - D3 scales with Canvas drawing for high performance (reports frame rate).
 * - Tooltips and a text summary for screen readers.
 * - Vertical-exaggeration toggle (off by default; permanent label when active).
 * - PNG export.
 * - Hatched azimuths where the horizon is poorly constrained.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Horizon, Series } from '../types/schemas';
import { COMPASS_POINTS, createPanoramaScales, discRadiusInPixels, verifyAngularDiameter } from '../utils/scales';
import { Play, Pause, SkipBack, SkipForward, Camera, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface PanoramaProps {
  horizon: Horizon;
  series: Series;
  mastHeightM: number;
  timeIndex: number;
  onTimeChange: (newIndex: number) => void;
  threshold?: number;
}

export const Panorama: React.FC<PanoramaProps> = ({
  horizon,
  series,
  mastHeightM,
  timeIndex,
  onTimeChange,
  threshold = 0.50,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [fps, setFps] = useState<number>(60);
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(1.0); // 1.0 = off, 2.5 = on
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [hoverInfo, setHoverInfo] = useState<{ az: number; el: number; horizonEl: number } | null>(null);

  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Find mast height index in horizon dataset
  let mastIndex = 0;
  let minDiff = Infinity;
  horizon.heights_m.forEach((h, idx) => {
    const diff = Math.abs(h - mastHeightM);
    if (diff < minDiff) {
      minDiff = diff;
      mastIndex = idx;
    }
  });

  const skylineElevations = horizon.el_deg[mastIndex] || [];
  const nanFractions = horizon.nan_fraction[mastIndex] || [];
  const maxSkylineEl = skylineElevations.length > 0 ? Math.max(...skylineElevations) : 4.0;
  const maxElRange = Math.max(6.0, Math.ceil(maxSkylineEl + 1.0));
  const minElRange = -1.5;

  // Verify angular sizes from data
  const sunR = series.sun.radius_deg[timeIndex] ?? 0.265;
  const earthR = series.earth.radius_deg[timeIndex] ?? 0.95;
  const diameterInfo = verifyAngularDiameter(sunR, earthR);

  // Keyboard navigation: Left/Right arrows to step, Space to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        onTimeChange(Math.min(series.time_utc.length - 1, timeIndex + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        onTimeChange(Math.max(0, timeIndex - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timeIndex, series.time_utc.length, onTimeChange]);

  // Animation Loop with FPS counter
  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;

    let animId: number;
    let accumulatedMs = 0;
    const stepDurationMs = 200 / playbackSpeed;

    const loop = (timestamp: number) => {
      const delta = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;
      accumulatedMs += delta;

      // Update FPS counter every 500ms
      frameCountRef.current++;
      if (timestamp - fpsTimerRef.current >= 500) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / (timestamp - fpsTimerRef.current));
        setFps(measuredFps);
        frameCountRef.current = 0;
        fpsTimerRef.current = timestamp;
      }

      if (accumulatedMs >= stepDurationMs) {
        const stepsToAdvance = Math.floor(accumulatedMs / stepDurationMs);
        accumulatedMs %= stepDurationMs;
        onTimeChange((timeIndex + stepsToAdvance) % series.time_utc.length);
      }

      animId = requestAnimationFrame(loop);
    };

    lastFrameTimeRef.current = performance.now();
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed, prefersReducedMotion, timeIndex, series.time_utc.length, onTimeChange]);

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create D3 Scales
    const scales = createPanoramaScales({
      width,
      height,
      minElevationDeg: minElRange,
      maxElevationDeg: maxElRange,
      verticalExaggeration,
    });
    const { scaleX, scaleY } = scales;

    // 1. Clear Background (Lunar Sky)
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Elevation Grid Lines & Labels
    ctx.lineWidth = 1;
    for (let el = Math.floor(minElRange); el <= maxElRange; el += 1.0) {
      const y = scaleY(el * verticalExaggeration);
      if (y < 0 || y > height) continue;

      ctx.strokeStyle = el === 0 ? '#475569' : '#1e293b';
      ctx.setLineDash(el === 0 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = el === 0 ? '#94a3b8' : '#475569';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${el > 0 ? '+' : ''}${el}°`, 8, y - 4);
    }

    // 3. Draw Compass Azimuth Grid Lines & Labels
    COMPASS_POINTS.forEach((pt) => {
      const x = scaleX(pt.azimuthDeg);
      ctx.strokeStyle = pt.isCardinal ? '#334155' : '#1e293b';
      ctx.lineWidth = pt.isCardinal ? 1.5 : 1;
      ctx.setLineDash(pt.isCardinal ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top Compass Label
      ctx.fillStyle = pt.isCardinal ? '#e2e8f0' : '#64748b';
      ctx.font = pt.isCardinal ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt.label, x, 14);
    });

    // 4. Draw Celestial Trajectory Tracks (for full series)
    // Sun Track
    ctx.lineWidth = 2;
    for (let i = 0; i < series.time_utc.length - 1; i++) {
      const az1 = series.sun.az_deg[i];
      const el1 = series.sun.el_deg[i];
      const az2 = series.sun.az_deg[i + 1];
      const el2 = series.sun.el_deg[i + 1];

      // Avoid drawing across the 0/360 wrap seam
      if (Math.abs(az2 - az1) > 180) continue;

      const st = series.sun.status[i];
      // Color & Dash Pattern by Status (Color-blind safe)
      if (st === 'robust_visible') {
        ctx.strokeStyle = '#38bdf8'; // Blue solid
        ctx.setLineDash([]);
      } else if (st === 'marginal') {
        ctx.strokeStyle = '#f59e0b'; // Amber dashed
        ctx.setLineDash([6, 4]);
      } else {
        ctx.strokeStyle = '#475569'; // Muted dotted
        ctx.setLineDash([2, 4]);
      }

      ctx.beginPath();
      ctx.moveTo(scaleX(az1), scaleY(el1 * verticalExaggeration));
      ctx.lineTo(scaleX(az2), scaleY(el2 * verticalExaggeration));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Earth Track
    ctx.lineWidth = 1.5;
    for (let i = 0; i < series.time_utc.length - 1; i++) {
      const az1 = series.earth.az_deg[i];
      const el1 = series.earth.el_deg[i];
      const az2 = series.earth.az_deg[i + 1];
      const el2 = series.earth.el_deg[i + 1];

      if (Math.abs(az2 - az1) > 180) continue;

      const st = series.earth.status[i];
      if (st === 'robust_visible') {
        ctx.strokeStyle = '#a855f7'; // Purple solid
        ctx.setLineDash([]);
      } else if (st === 'marginal') {
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = '#334155';
        ctx.setLineDash([2, 2]);
      }

      ctx.beginPath();
      ctx.moveTo(scaleX(az1), scaleY(el1 * verticalExaggeration));
      ctx.lineTo(scaleX(az2), scaleY(el2 * verticalExaggeration));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 5. Draw Celestial Discs at Current Time Step
    const currentSunAz = series.sun.az_deg[timeIndex];
    const currentSunEl = series.sun.el_deg[timeIndex];
    const currentSunFrac = series.sun.frac[timeIndex];
    const { rx: sunRx, ry: sunRy } = discRadiusInPixels(sunR, scales);

    const currentEarthAz = series.earth.az_deg[timeIndex];
    const currentEarthEl = series.earth.el_deg[timeIndex];
    const currentEarthFrac = series.earth.frac[timeIndex];
    const { rx: earthRx, ry: earthRy } = discRadiusInPixels(earthR, scales);

    // Draw Sun Glow
    const sunX = scaleX(currentSunAz);
    const sunY = scaleY(currentSunEl * verticalExaggeration);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRx, sunX, sunY, sunRx * 3.5);
    sunGlow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
    sunGlow.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.ellipse(sunX, sunY, sunRx * 3.5, sunRy * 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Sun Disc (Unclipped Base)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(sunX, sunY, sunRx, sunRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Earth Disc
    const earthX = scaleX(currentEarthAz);
    const earthY = scaleY(currentEarthEl * verticalExaggeration);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(earthX, earthY, earthRx, earthRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Earth atmosphere rim
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(earthX, earthY, earthRx, earthRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 6. Draw Terrain Skyline as a Solid Filled Shape
    const numPoints = skylineElevations.length;
    const azStep = horizon.az_step_deg;

    ctx.save();
    ctx.beginPath();
    // Start at bottom left
    ctx.moveTo(0, height);

    for (let i = 0; i < numPoints; i++) {
      const az = i * azStep;
      const el = skylineElevations[i];
      const x = scaleX(az);
      const y = scaleY(el * verticalExaggeration);
      ctx.lineTo(x, y);
    }
    // End at bottom right and close polygon
    ctx.lineTo(width, height);
    ctx.closePath();

    // Gradient fill for terrain
    const terrainGrad = ctx.createLinearGradient(0, scaleY(maxSkylineEl * verticalExaggeration), 0, height);
    terrainGrad.addColorStop(0, '#151c2e');
    terrainGrad.addColorStop(0.3, '#0e1422');
    terrainGrad.addColorStop(1, '#070a12');
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // Skyline outline
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 7. Draw Hatched Azimuths for Poorly Constrained Horizon (NaNs or Coarse Data)
    for (let i = 0; i < numPoints; i++) {
      const nanFrac = nanFractions[i] ?? 0;
      if (nanFrac > 0) {
        const azStart = i * azStep;
        const azEnd = (i + 1) * azStep;
        const xStart = scaleX(azStart);
        const xEnd = scaleX(azEnd);

        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(xStart, 0, xEnd - xStart, height);

        // Diagonal hatching
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let hy = -20; hy < height + 20; hy += 12) {
          ctx.moveTo(xStart, hy);
          ctx.lineTo(xEnd, hy + (xEnd - xStart));
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 8. Re-render Dimmed/Clipped Portions of Discs Below Skyline
    // Find horizon elevation at Sun azimuth
    const sunAzIdx = Math.round(currentSunAz / azStep) % numPoints;
    const sunHorizonEl = skylineElevations[sunAzIdx] ?? 0;

    // Find horizon elevation at Earth azimuth
    const earthAzIdx = Math.round(currentEarthAz / azStep) % numPoints;
    const earthHorizonEl = skylineElevations[earthAzIdx] ?? 0;

    // Dimmed overlay if disc is partially or fully below skyline
    if (currentSunEl < sunHorizonEl + sunR) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 23, 0.75)';
      ctx.beginPath();
      ctx.ellipse(sunX, sunY, sunRx + 1, sunRy + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (currentEarthEl < earthHorizonEl + earthR) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 23, 0.75)';
      ctx.beginPath();
      ctx.ellipse(earthX, earthY, earthRx + 1, earthRy + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Disc Visible Fraction Text Callouts
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';

    // Sun Callout
    ctx.fillStyle = currentSunFrac >= threshold ? '#fbbf24' : '#94a3b8';
    ctx.fillText(
      `Sun: ${Math.round(currentSunFrac * 100)}% visible`,
      Math.min(width - 160, Math.max(10, sunX + sunRx + 8)),
      Math.max(25, sunY - 6)
    );

    // Earth Callout
    ctx.fillStyle = currentEarthFrac >= threshold ? '#38bdf8' : '#94a3b8';
    ctx.fillText(
      `Earth: ${Math.round(currentEarthFrac * 100)}% in line of sight`,
      Math.min(width - 210, Math.max(10, earthX + earthRx + 8)),
      Math.max(45, earthY - 6)
    );

    // 10. Draw Hover Crosshair if mouse is over canvas
    if (hoverInfo) {
      const hx = scaleX(hoverInfo.az);
      const hy = scaleY(hoverInfo.el * verticalExaggeration);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.moveTo(0, hy);
      ctx.lineTo(width, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    horizon,
    series,
    mastIndex,
    skylineElevations,
    nanFractions,
    timeIndex,
    verticalExaggeration,
    threshold,
    hoverInfo,
    maxSkylineEl,
    maxElRange,
    minElRange,
    sunR,
    earthR,
  ]);

  // Handle Resize & Re-render
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(340, Math.min(520, Math.round(rect.width * 0.42)));
      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Mouse Move for Tooltips
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scales = createPanoramaScales({
      width: canvas.width,
      height: canvas.height,
      minElevationDeg: minElRange,
      maxElevationDeg: maxElRange,
      verticalExaggeration,
    });

    const az = Number(scales.scaleX.invert(x).toFixed(1));
    const el = Number((scales.scaleY.invert(y) / verticalExaggeration).toFixed(2));

    const azIdx = Math.round(az / horizon.az_step_deg) % skylineElevations.length;
    const horizonEl = skylineElevations[azIdx] ?? 0;

    setHoverInfo({ az, el, horizonEl: Number(horizonEl.toFixed(2)) });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  // Export Canvas as PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `horizon_panorama_mast_${mastHeightM}m_step_${timeIndex}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const currentTimeUtc = series.time_utc[timeIndex] || 'N/A';
  const currentSunFrac = series.sun.frac[timeIndex] ?? 0;
  const currentEarthFrac = series.earth.frac[timeIndex] ?? 0;

  return (
    <Card className="panorama-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      {/* Top Header & Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Horizon Panorama (360° Cylindrical View)
          </h2>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Mast Height: <strong>{mastHeightM.toFixed(1)}m</strong> · Skyline Peak:{' '}
            <strong>+{maxSkylineEl.toFixed(1)}°</strong> · Sun Disc: <strong>{diameterInfo.sunDiameterDeg.toFixed(2)}°</strong> · Earth Disc: <strong>{diameterInfo.earthDiameterDeg.toFixed(2)}°</strong>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Vertical Exaggeration Toggle */}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVerticalExaggeration((v) => (v === 1.0 ? 2.5 : 1.0))}
            title="Toggle vertical elevation exaggeration"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.65rem',
              fontSize: '0.825rem',
              borderRadius: 'var(--radius-sm)',
              border: verticalExaggeration > 1 ? '1px solid var(--color-amber)' : '1px solid var(--border-color)',
              background: verticalExaggeration > 1 ? 'rgba(245, 158, 11, 0.15)' : 'var(--card-bg)',
              color: verticalExaggeration > 1 ? 'var(--color-amber)' : 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            {verticalExaggeration > 1 ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>Vert. Exaggeration: {verticalExaggeration > 1 ? '2.5×' : 'Off'}</span>
          </button>

          {/* Export PNG Button */}
          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportPng}
            title="Export high-resolution PNG snapshot"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.65rem',
              fontSize: '0.825rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            <Camera size={14} />
            <span>Export PNG</span>
          </button>

          {/* Live FPS Badge */}
          <Badge variant="neutral" size="sm">
            {fps} FPS (Canvas D3 Engine)
          </Badge>
        </div>
      </div>

      {/* Exaggeration Warning Banner if active */}
      {verticalExaggeration > 1.0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.75rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid var(--color-amber)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--color-amber)',
          }}
        >
          <AlertCircle size={15} />
          <span>
            <strong>VERTICAL EXAGGERATION ACTIVE (2.5×):</strong> Elevation angles and disc aspects are expanded vertically for skyline inspection.
          </span>
        </div>
      )}

      {/* Screen Reader Live Region */}
      <div className="sr-only" role="region" aria-live="polite">
        Current step {timeIndex + 1} of {series.time_utc.length}, date {currentTimeUtc}. Sun is {Math.round(currentSunFrac * 100)} percent visible. Earth is {Math.round(currentEarthFrac * 100)} percent in line of sight.
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          background: '#060913',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
        />

        {/* Hover Coordinate Overlay */}
        {hoverInfo && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              padding: '0.35rem 0.65rem',
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text-main)',
              pointerEvents: 'none',
            }}
          >
            Az: {hoverInfo.az.toFixed(1)}° · El: {hoverInfo.el.toFixed(2)}° · Horizon: {hoverInfo.horizonEl.toFixed(2)}°
          </div>
        )}
      </div>

      {/* Time & Playback Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'var(--background-secondary, #0f172a)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Playback Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setIsPlaying(false);
              onTimeChange(Math.max(0, timeIndex - 1));
            }}
            disabled={timeIndex === 0}
            title="Step backward (Left Arrow)"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <SkipBack size={16} />
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause (Space)' : 'Play simulation (Space)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-blue)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setIsPlaying(false);
              onTimeChange(Math.min(series.time_utc.length - 1, timeIndex + 1));
            }}
            disabled={timeIndex === series.time_utc.length - 1}
            title="Step forward (Right Arrow)"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <SkipForward size={16} />
          </button>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(spd)}
                style={{
                  padding: '0.25rem 0.45rem',
                  fontSize: '0.75rem',
                  fontWeight: playbackSpeed === spd ? 700 : 400,
                  borderRadius: 'var(--radius-xs)',
                  border: playbackSpeed === spd ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                  background: playbackSpeed === spd ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: playbackSpeed === spd ? 'var(--color-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>

        {/* Time Slider */}
        <div style={{ flex: '1 1 240px', minWidth: '180px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="range"
            min={0}
            max={series.time_utc.length - 1}
            value={timeIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onTimeChange(Number(e.target.value));
            }}
            aria-label="Simulation Time Slider"
            style={{ flex: 1, accentColor: 'var(--color-blue)', cursor: 'pointer' }}
          />
        </div>

        {/* Timestamp Readout */}
        <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
          {currentTimeUtc} ({timeIndex + 1}/{series.time_utc.length})
        </div>
      </div>
    </Card>
  );
};
