import React, { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import {
  BacktestCase,
  BacktestComparisonResult,
  Series,
} from '../types';
import {
  compareBacktestEvents,
  DEMO_BACKTEST_FIXTURE,
} from '../utils/backtestComparator';

interface ReplayViewProps {
  initialCase?: BacktestCase | null;
  initialSeries?: Series | null;
}

export const ReplayView: React.FC<ReplayViewProps> = ({
  initialCase = null,
  initialSeries = null,
}) => {
  // In production, docs/BACKTEST_CASE.md is absent until a human provides it.
  // Allow toggling test fixture to view interactive comparison or via ?fixture=1 in URL.
  const hasFixtureParam = typeof window !== 'undefined' && (window.location.hash.includes('fixture=1') || window.location.search.includes('fixture=1'));
  const [activeCase, setActiveCase] = useState<BacktestCase | null>(
    initialCase || (hasFixtureParam ? DEMO_BACKTEST_FIXTURE.case : null)
  );
  const [activeSeries, setActiveSeries] = useState<Series | null>(
    initialSeries || (hasFixtureParam ? DEMO_BACKTEST_FIXTURE.series : null)
  );
  const [isFixtureMode, setIsFixtureMode] = useState<boolean>(hasFixtureParam || false);

  const toggleFixtureMode = () => {
    if (isFixtureMode) {
      setActiveCase(null);
      setActiveSeries(null);
      setIsFixtureMode(false);
    } else {
      setActiveCase(DEMO_BACKTEST_FIXTURE.case);
      setActiveSeries(DEMO_BACKTEST_FIXTURE.series);
      setIsFixtureMode(true);
    }
  };

  const comparisonResults: BacktestComparisonResult[] =
    activeCase && activeSeries ? compareBacktestEvents(activeCase, activeSeries) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Title & Sourced Precondition Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
              Historical Mission Replay & Backtest
            </h1>
            {!activeCase ? (
              <Badge variant="blocked">NOT AVAILABLE</Badge>
            ) : isFixtureMode ? (
              <Badge variant="warning">TEST FIXTURE MODE</Badge>
            ) : (
              <Badge variant="success">VERIFIED REAL CASE</Badge>
            )}
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Compare reported historical south-polar surface telemetry (sunset, end of operations, comms loss) against
            LightPath topocentric line-of-sight geometry.
          </p>
        </div>

        <button
          onClick={toggleFixtureMode}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isFixtureMode ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
            color: '#fff',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isFixtureMode ? 'Unload Test Fixture (Show Production)' : 'Preview Verification Fixture (Test Mode)'}
        </button>
      </div>

      {/* Production Missing Case State (NOT AVAILABLE) */}
      {!activeCase ? (
        <div
          data-testid="backtest-not-available"
          style={{
            padding: '2rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⏳</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
              Sourced Historical Backtest Case Not Supplied
            </h2>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
              borderRadius: '4px',
              fontSize: '0.9rem',
              lineHeight: 1.6,
            }}
          >
            <strong>PRECONDITION HALTED:</strong> No verified historical backtest case file (
            <code>docs/BACKTEST_CASE.md</code>) has been supplied by human operators.
            <br />
            In strict adherence to <strong>Project Rule 2</strong> (<em>Never invent facts, coordinates, mission names, dates, or citations</em>),
            LightPath halts execution of real-mode backtesting and displays <strong>NOT AVAILABLE</strong> rather than generating synthetic mission outcomes.
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              How to enable historical replay:
            </h3>
            <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>
                Review <code>docs/HUMAN_TODO.md</code> Section 9 for required checklist fields.
              </li>
              <li>
                Create <code>docs/BACKTEST_CASE.md</code> with verified telemetry timestamps, landing coordinates, and official mission sources.
              </li>
              <li>
                Place corresponding SPICE kernels in <code>kernels/</code> and LOLA DEM rasters in <code>data/raw/</code>.
              </li>
            </ol>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={toggleFixtureMode}
              style={{
                background: 'none',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Load Controlled Verification Fixture to inspect the comparison engine &rarr;
            </button>
          </div>
        </div>
      ) : (
        /* Loaded Backtest Case View (Fixture or Sourced Case) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Metadata Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Mission Name
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{activeCase.mission_name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Target Site ID
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{activeCase.site_id}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Touchdown Time (UTC)
              </span>
              <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{activeCase.landing_time_utc}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Touchdown Coordinate
              </span>
              <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                {activeCase.landing_coord.lat_deg.toFixed(4)}°, {activeCase.landing_coord.lon_deg.toFixed(4)}°
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Landing Uncertainty (Assumption)
              </span>
              <div style={{ fontSize: '0.9rem' }}>±{activeCase.landing_uncertainty_m} m radius</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                DEM Pixel Resolution
              </span>
              <div style={{ fontSize: '0.9rem' }}>{activeCase.dem_resolution_m} m/pixel</div>
            </div>
          </div>

          {/* Uncertainty Budget Callout */}
          {comparisonResults.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Terrain Resolution Uncertainty (DEM)
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                  ±{comparisonResults[0].uncertainty.terrain_resolution_h.toFixed(2)} hours
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Landing Location Uncertainty (Dispersion)
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                  ±{comparisonResults[0].uncertainty.landing_location_h.toFixed(2)} hours
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Combined Geometric Uncertainty Limit
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>
                  ±{comparisonResults[0].uncertainty.total_uncertainty_h.toFixed(2)} hours
                </div>
              </div>
            </div>
          )}

          {/* Timeline Event Overview */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
              Timeline Comparison: Reported Telemetry vs. Geometric Horizon
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Reported Event</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Reported UTC</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>LightPath Predicted UTC</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Difference (Hours)</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResults.map((res) => {
                    const badgeVariant =
                      res.status === 'MATCH_WITHIN_UNCERTAINTY'
                        ? 'success'
                        : res.status === 'DISCREPANCY_EXPLAINED_BY_TERRAIN'
                        ? 'warning'
                        : 'blocked';

                    const badgeLabel =
                      res.status === 'MATCH_WITHIN_UNCERTAINTY'
                        ? 'Matches Geometry'
                        : res.status === 'DISCREPANCY_EXPLAINED_BY_TERRAIN'
                        ? 'Explained by Terrain'
                        : res.status === 'UNEXPLAINED_BY_GEOMETRY'
                        ? 'Unexplained by Geometry Alone'
                        : 'No Event';

                    return (
                      <React.Fragment key={res.event_id}>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{res.event_name}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{res.reported_time_utc}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>
                            {res.predicted_time_utc || 'N/A (Line-of-Sight Clear)'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>
                            {res.delta_hours !== null ? `${res.delta_hours > 0 ? '+' : ''}${res.delta_hours.toFixed(2)} h` : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                          <td colSpan={5} style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            <strong>Analysis:</strong> {res.geometry_explanation}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mandatory Non-Causality Disclaimer Alert */}
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              borderLeft: '4px solid var(--accent-primary)',
              borderRadius: '6px',
              fontSize: '0.88rem',
              lineHeight: 1.6,
            }}
          >
            <strong>Project Rule 8 & Non-Causality Disclosure:</strong>
            <br />
            LightPath computes <em>topocentric celestial and terrain line-of-sight geometry only</em>.
            It does not model spacecraft thermal storage, battery depth-of-discharge, solar array orientation/tilt, or DSN ground station scheduling.
            Events marked as <strong>Unexplained by Geometry Alone</strong> indicate that clear, unobstructed line of sight existed at the reported timestamp.
            The tool makes no claims to explain mission outcomes or system failures beyond line-of-sight geometry.
          </div>
        </div>
      )}
    </div>
  );
};
