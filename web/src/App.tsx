import React, { useState } from 'react';
import { Moon, Cpu, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { runRouteSolverWorker } from './workers/routeWorkerClient';
import { VisibilityCube } from './types';

export const App: React.FC = () => {
  const [workerStatus, setWorkerStatus] = useState<string>('Ready (idle)');
  const [workerResult, setWorkerResult] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Test route worker with a mini sample cube
  const handleTestWorker = async () => {
    setIsSolving(true);
    setWorkerStatus('Solving traverse in Web Worker...');
    setWorkerResult(null);

    const dummyCube: VisibilityCube = {
      grid: { origin: [137.5, -89.44], spacing_m: 40.0, nx: 4, ny: 4 },
      time_utc: ['2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z', '2026-11-01T02:00:00Z'],
      sun_frac: [
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
      ],
      earth_frac: [
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
        [[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100]],
      ],
      slope_deg: [
        [3, 4, 5, 4],
        [4, 5, 6, 5],
        [5, 6, 5, 4],
        [4, 5, 4, 3],
      ],
      traversable: [
        [true, true, true, true],
        [true, true, true, true],
        [true, true, true, true],
        [true, true, true, true],
      ],
      flags: ['scaffold_test'],
    };

    try {
      const res = await runRouteSolverWorker(dummyCube, [0, 0], [3, 3]);
      setWorkerStatus('Success (completed)');
      setWorkerResult(res.explanation);
    } catch (err: unknown) {
      setWorkerStatus('Error');
      setWorkerResult(String(err));
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.25rem' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #38bdf8, #0f172a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)',
          }}
        >
          <Moon size={26} style={{ color: '#f8fafc' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              LightPath
            </h1>
            <span className="badge badge-cyan">NASA Space Apps Challenge 2026</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            CLPS Lunar Mission Browser — Terrain Horizon, Solar Illumination & Space-Time Traverse Planning
          </p>
        </div>
      </header>

      {/* Mandatory Non-Negotiable Disclaimer */}
      <DisclaimerBanner isSynthetic={false} />

      {/* Scaffold Overview Card */}
      <div className="panel-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} style={{ color: '#38bdf8' }} />
          Repository Scaffold Active
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1rem' }}>
          This is the scaffold placeholder page for <strong>LightPath</strong>. All core mathematical
          foundations, deterministic topocentric ephemeris routines, exact curvature algorithms, JSON
          schemas, and tests are established.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Datum Frame</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>MOON_ME</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>R = 1,737,400.0 m (LOLA)</div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Curvature Model</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>Exact Spherical</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>No flat-Moon approximation</div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Runtime Mode</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>100% Offline</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Zero network calls in web app</div>
          </div>
        </div>
      </div>

      {/* Web Worker Test Panel */}
      <div className="panel-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={18} style={{ color: '#facc15' }} />
          Web Worker Route Solver Setup
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          Space-time pathfinding (A* across 3D cells (x, y, t) under moving solar shadow and slope constraints)
          is offloaded to a dedicated Web Worker to maintain smooth 60 FPS UI performance.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleTestWorker}
            disabled={isSolving}
            className="btn btn-primary"
          >
            {isSolving ? 'Solving...' : 'Test Web Worker Solver'}
          </button>
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
            Worker Status: <strong className="mono" style={{ color: workerStatus.includes('Success') ? '#4ade80' : '#38bdf8' }}>{workerStatus}</strong>
          </span>
        </div>

        {workerResult && (
          <div style={{ marginTop: '0.75rem', background: '#090d16', border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} />
            {workerResult}
          </div>
        )}
      </div>

      {/* Documentation Links */}
      <div className="panel-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} style={{ color: '#38bdf8' }} />
          Project Documentation
        </h3>
        <ul style={{ listStyleType: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
          <li style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
            <strong style={{ color: '#f8fafc' }}>docs/PROJECT_RULES.md</strong>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Prompt 0 rules and contracts</p>
          </li>
          <li style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
            <strong style={{ color: '#f8fafc' }}>docs/QUESTIONS.md</strong>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Open questions & TODOs</p>
          </li>
          <li style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
            <strong style={{ color: '#f8fafc' }}>docs/DECISIONS.md</strong>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Architecture Decision Records</p>
          </li>
          <li style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '0.375rem' }}>
            <strong style={{ color: '#f8fafc' }}>docs/CREDITS.md</strong>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Third-party datasets & credits</p>
          </li>
        </ul>
      </div>
    </div>
  );
};
