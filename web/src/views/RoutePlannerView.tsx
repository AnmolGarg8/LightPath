import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { Slider } from '../components/ui/Slider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { fetchBinaryCube, fetchJsonData } from '../utils/dataLoader';
import { DecodedVisibilityCube } from '../utils/cubeDecoder';
import { VisibilityCubeHeaderSchema, VisibilityCubeHeader } from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';

interface RoutePlannerViewProps {
  siteId: string;
}

type LayerMode = 'sun' | 'earth' | 'slope' | 'traversability';

export const RoutePlannerView: React.FC<RoutePlannerViewProps> = ({ siteId }) => {
  const [header, setHeader] = useState<VisibilityCubeHeader | null>(null);
  const [cube, setCube] = useState<DecodedVisibilityCube | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [timeStep, setTimeStep] = useState<number>(0);
  const [mode, setMode] = useState<LayerMode>('sun');

  // Waypoints for traverse from A to B
  const [startPoint, setStartPoint] = useState<[number, number]>([3, 3]);
  const [endPoint, setEndPoint] = useState<[number, number]>([20, 20]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/cubes/${siteId}.json`, VisibilityCubeHeaderSchema),
      fetchBinaryCube(`./data/cubes/${siteId}.bin`),
    ])
      .then(([hdr, cb]) => {
        setHeader(hdr);
        setCube(cb);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  // Render 2D Traversability and Visibility Grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nx = cube.nx;
    const ny = cube.ny;
    const cellW = canvas.width / nx;
    const cellH = canvas.height / ny;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (mode === 'sun') {
          const val = cube.getSunFrac(timeStep, r, c);
          // Solar gradient: black (0%) to amber (100%)
          ctx.fillStyle = `rgb(${Math.round(val * 2.45)}, ${Math.round(val * 1.58)}, ${Math.round(val * 0.11)})`;
        } else if (mode === 'earth') {
          const val = cube.getEarthFrac(timeStep, r, c);
          // Earth gradient: black (0%) to cyan (100%)
          ctx.fillStyle = `rgb(${Math.round(val * 0.06)}, ${Math.round(val * 1.82)}, ${Math.round(val * 2.48)})`;
        } else if (mode === 'slope') {
          const s = cube.getSlopeDeg(r, c);
          // Green (<15 deg traversable) to Red (>25 deg steep)
          const norm = Math.min(1.0, s / 30.0);
          ctx.fillStyle = `rgb(${Math.round(norm * 240)}, ${Math.round((1 - norm) * 200)}, 40)`;
        } else {
          // Traversability binary
          const trav = cube.isTraversable(r, c);
          ctx.fillStyle = trav ? '#059669' : '#dc2626';
        }

        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

        // Thin cell grid lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      }
    }

    // Draw planned traverse path line between startPoint and endPoint
    if (startPoint && endPoint) {
      const sx = (startPoint[0] + 0.5) * cellW;
      const sy = (startPoint[1] + 0.5) * cellH;
      const ex = (endPoint[0] + 0.5) * cellW;
      const ey = (endPoint[1] + 0.5) * cellH;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start Marker (A)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // End Marker (B)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(ex, ey, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [cube, timeStep, mode, startPoint, endPoint]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !cube || !header) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading binary visibility cube ({siteId}.bin)...
      </div>
    );
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * cube.nx);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * cube.ny);

    if (x >= 0 && x < cube.nx && y >= 0 && y < cube.ny) {
      // Toggle start or end point
      if (Math.abs(x - startPoint[0]) + Math.abs(y - startPoint[1]) < 3) {
        setStartPoint([x, y]);
      } else {
        setEndPoint([x, y]);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * cube.nx);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * cube.ny);
    if (x >= 0 && x < cube.nx && y >= 0 && y < cube.ny) {
      setHoverCell({ x, y });
    }
  };

  // Traverse calculation
  const dxCells = endPoint[0] - startPoint[0];
  const dyCells = endPoint[1] - startPoint[1];
  const distM = Math.round(Math.hypot(dxCells, dyCells) * header.grid.spacing_m);
  const estTraverseHours = (distM / 300.0).toFixed(1); // 300 m/h nominal rover speed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Badge variant="joint" label="SPATIO-TEMPORAL ROUTE PLANNER" />
          <Badge variant="synthetic" label="MOVING ILLUMINATION SHADOW" />
        </div>
        <h1>Rover & Crew Traverse Planner</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
          Whether a rover can travel from A to B while continuous light and direct-to-Earth link are available.
        </p>
      </div>

      {/* Traverse Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Stat
          label="Traverse Distance"
          value={distM}
          unit="meters"
          variant="neutral"
          description={`From Point A [${startPoint.join(',')}] to Point B [${endPoint.join(',')}].`}
        />
        <Stat
          label="Estimated Traverse Time"
          value={estTraverseHours}
          unit="hours"
          variant="sun"
          description="At nominal 300 m/h lunar surface speed."
        />
        <Stat
          label="Corridor Traversability"
          value={cube.isTraversable(endPoint[1], endPoint[0]) ? 'GO' : 'NO-GO'}
          variant={cube.isTraversable(endPoint[1], endPoint[0]) ? 'success' : 'alert'}
          description="Mechanical slope <= 15° along traverse endpoint."
        />
        <Stat
          label="Moving Shadow Margin"
          value={`${cube.getSunFrac(timeStep, endPoint[1], endPoint[0])}%`}
          unit="sunlit"
          variant="joint"
          description="Sunlight fraction at destination at scrubbed time."
        />
      </div>

      {/* Main Interactive Canvas & Controls */}
      <Card
        title="Surface Visibility & Terrain Traversability Cube"
        subtitle={`Grid size: ${cube.nx} x ${cube.ny} cells (${cube.nx * cube.ny} total), cell spacing: ${header.grid.spacing_m}m.`}
        action={
          <SegmentedControl<LayerMode>
            value={mode}
            onChange={setMode}
            size="sm"
            options={[
              { value: 'sun', label: 'Sunlight Frac' },
              { value: 'earth', label: 'Earth Contact' },
              { value: 'slope', label: 'Slope (°)' },
              { value: 'traversability', label: 'Traversable' },
            ]}
          />
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 280px', gap: '1.5rem' }}>
          <div>
            <canvas
              ref={canvasRef}
              width={500}
              height={500}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverCell(null)}
              aria-label="Interactive 2D lunar surface traversability grid"
              style={{
                width: '100%',
                maxWidth: '500px',
                aspectRatio: '1/1',
                borderRadius: '6px',
                border: '2px solid var(--border-color)',
                cursor: 'crosshair',
              }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Click anywhere on the map to set waypoint B. Green dot: Start Point A. Gold dot: Target Point B.
            </p>
          </div>

          {/* Readout side panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                CELL INSPECTION READOUT
              </span>
              {hoverCell ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 'var(--text-xs)' }}>
                  <div>Cell Coordinate: <strong className="mono">[{hoverCell.x}, {hoverCell.y}]</strong></div>
                  <div>Sun Fraction: <strong className="mono">{cube.getSunFrac(timeStep, hoverCell.y, hoverCell.x)}%</strong></div>
                  <div>Earth Fraction: <strong className="mono">{cube.getEarthFrac(timeStep, hoverCell.y, hoverCell.x)}%</strong></div>
                  <div>Slope: <strong className="mono">{cube.getSlopeDeg(hoverCell.y, hoverCell.x)}°</strong></div>
                  <div>
                    Traversable:{' '}
                    <strong style={{ color: cube.isTraversable(hoverCell.y, hoverCell.x) ? 'var(--color-visible)' : 'var(--color-blocked)' }}>
                      {cube.isTraversable(hoverCell.y, hoverCell.x) ? 'YES (Slope <= 15°)' : 'NO (Excessive Slope)'}
                    </strong>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Hover over any grid cell to view instantaneous elevation, slope, and solar disc fraction.
                </p>
              )}
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                CUBE SPECIFICATION
              </span>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <li>Binary Format: <strong className="mono">LPVC (v1, Gzip)</strong></li>
                <li>Grid Spacing: <strong className="mono">{header.grid.spacing_m} m</strong></li>
                <li>Time Steps: <strong className="mono">{cube.nt} steps</strong></li>
                <li>Compressed Size: <strong className="mono">{header.binary_size_bytes} bytes</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Time Scrub Slider */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Slider
            label={`Timeline Step ${timeStep + 1} of ${cube.nt}: ${header.time_utc[timeStep] || ''}`}
            value={timeStep}
            min={0}
            max={cube.nt - 1}
            step={1}
            onChange={setTimeStep}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
            Scrub forward in time to watch the dynamic lunar shadow sweep across the terrain corridor.
          </span>
        </div>
      </Card>
    </div>
  );
};
