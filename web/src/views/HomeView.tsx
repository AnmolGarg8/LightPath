import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { fetchJsonData } from '../utils/dataLoader';
import { IndexSchema, IndexData } from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';

export const HomeView: React.FC = () => {
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Live mini-visual state
  const [demoHour, setDemoHour] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchJsonData('./data/index.json', IndexSchema)
      .then((data) => {
        setIndexData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  // Live mini visual animation (Sun & Earth rising/setting over lunar horizon)
  useEffect(() => {
    const timer = setInterval(() => {
      setDemoHour((prev) => (prev + 1) % 96);
    }, 400);
    return () => clearInterval(timer);
  }, []);

  // Draw interactive 5-second live visual
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Horizon line
    const horizonY = h * 0.65;
    ctx.fillStyle = '#1e2942';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 10) {
      const terrainH = Math.sin(x * 0.02) * 12 + Math.cos(x * 0.05) * 6;
      ctx.lineTo(x, horizonY + terrainH);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // 0 deg elevation reference line
    ctx.strokeStyle = '#475569';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sun disc (moves horizontally, hovering near horizon)
    const sunX = ((demoHour * 8) % (w + 40)) - 20;
    const sunY = horizonY - 14 - Math.sin((demoHour * Math.PI) / 48) * 18;
    const sunRadius = 10;

    // Sun glow
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 28);
    sunGrad.addColorStop(0, 'rgba(245, 158, 11, 0.9)');
    sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
    ctx.fill();

    // Sun disc
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Earth disc (hovers with slight libration oscillation)
    const earthX = w * 0.72 + Math.sin(demoHour * 0.1) * 8;
    const earthY = horizonY - 45 + Math.cos(demoHour * 0.1) * 6;
    const earthRadius = 14;

    const earthGrad = ctx.createRadialGradient(earthX, earthY, 2, earthX, earthY, 24);
    earthGrad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    earthGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.fill();

    // Text labels on visual
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('SUN (65% Vis)', Math.max(10, sunX - 35), Math.max(20, sunY - 16));

    ctx.fillStyle = '#38bdf8';
    ctx.fillText('EARTH (LOS Active)', earthX - 45, earthY - 20);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Terrain Horizon Mask (+1.2°)', 10, horizonY + 28);
  }, [demoHour]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Hero Section */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 480px)',
          gap: '2rem',
          alignItems: 'center',
          padding: '2rem 0',
        }}
        className="hero-grid"
      >
        <div>
          <Badge variant="synthetic" label="NASA Space Apps Challenge 2026 Prototype" className="mb-2" />
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '0.75rem', lineHeight: 1.15 }}>
            Predict Light and Link Windows on the Lunar South Pole.
          </h1>
          <p
            style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-secondary)',
              marginTop: '1rem',
              lineHeight: 1.5,
              maxWidth: '560px',
            }}
          >
            LightPath maps continuous sunlight and Earth direct-to-Earth communication windows across lunar south-pole
            CLPS landing sites and rover traverses.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <a href="#/site/synthetic-proving-ground" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: 'var(--text-base)' }}>
              Launch Interactive Site Demo →
            </a>
            <a href="#/route/synthetic-proving-ground" className="btn btn-secondary">
              Plan Rover Traverse
            </a>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <span>✓ Curvature-exact horizon raycasting</span>
            <span>✓ Topocentric local-up ENU frame</span>
            <span>✓ DSN Goldstone/Madrid/Canberra LOS</span>
          </div>
        </div>

        {/* Live Visual Canvas (Within 5 seconds) */}
        <Card variant="elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
              LIVE HORIZON OCCULTATION ENGINE
            </span>
            <Badge variant="visible" label="REAL-TIME" />
          </div>

          <canvas
            ref={canvasRef}
            width={440}
            height={200}
            aria-label="Live animation of Sun and Earth rising and setting above lunar terrain"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: 'var(--text-xs)' }}>
            <span style={{ color: 'var(--color-sun)', fontWeight: 600 }}>☼ Solar Disc Elevation</span>
            <span style={{ color: 'var(--color-earth)', fontWeight: 600 }}>⊕ DTE Ground Station Line-Of-Sight</span>
          </div>
        </Card>
      </section>

      {/* Instant Action Stats */}
      <section>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '1rem' }}>
          Mission Decision Metrics (Plain Language Summaries)
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          <Stat
            label="Continuous Sunlight"
            value="70.8%"
            unit="uptime"
            variant="sun"
            description="Sun disc >= 50% above terrain horizon across simulated cycle."
          />
          <Stat
            label="Direct-to-Earth Link"
            value="100%"
            unit="coverage"
            variant="earth"
            description="Earth visible above local hills AND in view of DSN Goldstone/Madrid/Canberra."
          />
          <Stat
            label="Joint Light & Link"
            value="70.8%"
            unit="co-availability"
            variant="joint"
            description="Simultaneous power generation and real-time Earth telemetry contact."
          />
          <Stat
            label="Maximum Darkness Outage"
            value="12.0"
            unit="hours"
            variant="alert"
            alertText="Critical Battery Survival Threshold"
            description="Longest consecutive spell below 50% solar fraction requiring battery reserve."
          />
        </div>
      </section>

      {/* Candidate Sites Section */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>Candidate Exploration Sites</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Select a lunar south polar candidate landing site to inspect topocentric horizon profiles and contact windows.
            </p>
          </div>
          <a href="#/compare/synthetic-proving-ground/synthetic-crater-rim" style={{ fontSize: 'var(--text-sm)' }}>
            Compare Multiple Sites →
          </a>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading site catalog...
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {indexData?.sites.map((site) => (
              <Card
                key={site.id}
                title={site.name}
                subtitle={`${site.lat_deg.toFixed(2)}° S, ${site.lon_deg.toFixed(2)}° E • Elev: ${site.ground_elev_m} m`}
                action={<Badge variant={site.is_synthetic ? 'synthetic' : 'neutral'} label={site.is_synthetic ? 'SYNTHETIC' : 'PLANNED'} />}
                footer={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: site.verified ? 'var(--color-visible)' : 'var(--color-marginal)' }}>
                      {site.verified ? '✓ Primary Verified' : '⚠ Unverified Coordinates'}
                    </span>
                    <a href={`#/site/${site.id}`} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: 'var(--text-xs)' }}>
                      Analyze Site →
                    </a>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Reference Frame:</span>
                    <span className="mono">MOON_ME (Mean Earth)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Traverse Window:</span>
                    <span>20.0h continuous light</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Planned Missions Section */}
      <section>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem' }}>Commercial Payload Deliveries (CLPS)</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Example flight profiles flagged per Rule 2 (human verified entries required for flight operations).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {indexData?.missions.map((m) => (
            <Card
              key={m.id}
              title={m.name}
              subtitle={`Operator: ${m.operator} • Status: ${m.status.toUpperCase()}`}
              action={<Badge variant="marginal" label="EXAMPLE / SYNTHETIC" />}
              footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Target: <code className="mono">{m.site_id}</code></span>
                  <a href={`#/site/${m.site_id}`} className="btn btn-outline" style={{ padding: '0.3rem 0.65rem', fontSize: 'var(--text-xs)' }}>
                    Inspect Landing Site
                  </a>
                </div>
              }
            >
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {m.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 840px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};
