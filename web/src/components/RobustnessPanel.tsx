import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Stat } from './ui/Stat';
import {
  ConservativeComparisonResult,
  LandingDispersionPoint,
  LandingDispersionResult,
} from '../types';

interface RobustnessPanelProps {
  comparison: ConservativeComparisonResult | null;
  dispersion: LandingDispersionResult | null;
  isLoadingComparison: boolean;
  isLoadingDispersion: boolean;
  dispersionRadiusM: number;
  dispersionNumPoints: number;
  onUpdateDispersionParams: (radiusM: number, numPoints: number) => void;
  onRunDispersion: () => void;
  onSelectDispersionPoint?: (point: LandingDispersionPoint) => void;
  selectedPointId?: number | null;
}

export const RobustnessPanel: React.FC<RobustnessPanelProps> = ({
  comparison,
  dispersion,
  isLoadingComparison,
  isLoadingDispersion,
  dispersionRadiusM,
  dispersionNumPoints,
  onUpdateDispersionParams,
  onRunDispersion,
  onSelectDispersionPoint,
  selectedPointId,
}) => {
  const [activeTab, setActiveTab] = useState<'conservative' | 'dispersion'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('tab=dispersion')) {
      return 'dispersion';
    }
    return 'conservative';
  });

  const caution = comparison?.cost_of_caution;
  const nominal = comparison?.nominal;
  const conservative = comparison?.conservative;

  return (
    <Card
      title="Terrain Uncertainty & Landing Dispersion Robustness"
      subtitle="Evaluates route sensitivity to DEM vertical uncertainty (raised horizon margin) and landing targeting errors."
      data-testid="robustness-panel"
      action={
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setActiveTab('conservative')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              backgroundColor: activeTab === 'conservative' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'conservative' ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🛡️ Conservative Mode
          </button>
          <button
            onClick={() => setActiveTab('dispersion')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              backgroundColor: activeTab === 'dispersion' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'dispersion' ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🎯 Landing Dispersion ({dispersionRadiusM}m)
          </button>
        </div>
      }
    >
      {/* Tab 1: Conservative Mode & Cost of Caution */}
      {activeTab === 'conservative' && (
        <div
          data-testid="conservative-card"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-sm)' }}>
                CONSERVATIVE MODE (Horizon Raised by {caution?.horizon_margin_deg.toFixed(2) ?? '0.03'}°)
              </strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Marginal cells with solar fraction near threshold count as dark to protect against LOLA DEM elevation noise.
              </p>
            </div>
            <Badge
              variant={conservative?.feasible ? 'success' : 'blocked'}
              label={conservative?.feasible ? 'Conservative Viable' : 'Conservative Blocked'}
            />
          </div>

          {/* Cost of Caution Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <Stat
              label="Extra Caution Distance"
              value={caution ? `+${caution.extra_distance_m.toFixed(1)} m` : '--'}
              variant="neutral"
              description="Detour around marginal cells"
            />
            <Stat
              label="Extra Caution Duration"
              value={caution ? `+${caution.extra_duration_h.toFixed(2)} h` : '--'}
              variant="sun"
              description="Additional travel and wait time"
            />
            <Stat
              label="Extra Sunlight Waiting"
              value={caution ? `+${caution.extra_wait_h.toFixed(2)} h` : '--'}
              variant="neutral"
              description="Waiting for illumination to strengthen"
            />
            <Stat
              label="Nominal vs Conservative"
              value={
                nominal?.feasible
                  ? conservative?.feasible
                    ? 'BOTH VIABLE'
                    : 'NOMINAL ONLY'
                  : 'INFEASIBLE'
              }
              variant={conservative?.feasible ? 'success' : 'alert'}
              description={
                conservative?.feasible
                  ? 'Traverse safe with uncertainty margin'
                  : 'Corridor closed under conservative margin'
              }
            />
          </div>

          {/* Plain-Language Cost of Caution Synthesis */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
            }}
          >
            <strong style={{ color: '#f59e0b', marginRight: '0.4rem' }}>COST OF CAUTION:</strong>
            {isLoadingComparison ? (
              <span>Evaluating conservative route with raised horizon...</span>
            ) : caution?.explanation ? (
              caution.explanation
            ) : (
              'Solving nominal and conservative routes...'
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Landing Dispersion Analysis */}
      {activeTab === 'dispersion' && (
        <div
          data-testid="dispersion-card"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Controls & Assumptions */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Dispersion Radius (m) <span style={{ color: '#f59e0b' }}>(Assumption)</span>:
                </label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={dispersionRadiusM}
                  onChange={(e) =>
                    onUpdateDispersionParams(Number(e.target.value) || 250, dispersionNumPoints)
                  }
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                    width: '90px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Pattern Sample Points <span style={{ color: '#f59e0b' }}>(Fixed)</span>:
                </label>
                <input
                  type="number"
                  min="9"
                  max="49"
                  step="1"
                  value={dispersionNumPoints}
                  onChange={(e) =>
                    onUpdateDispersionParams(dispersionRadiusM, Number(e.target.value) || 25)
                  }
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                    width: '75px',
                  }}
                />
              </div>
            </div>

            <button
              onClick={onRunDispersion}
              disabled={isLoadingDispersion}
              data-testid="dispersion-run-btn"
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '5px',
                backgroundColor: 'var(--accent-primary)',
                color: '#000',
                border: 'none',
                fontWeight: 600,
                fontSize: 'var(--text-xs)',
                cursor: isLoadingDispersion ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {isLoadingDispersion ? '⚡ Solving...' : '⚡ Run Dispersion (25 Solves)'}
            </button>
          </div>

          {/* Results Summary */}
          {dispersion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <Stat
                  label="Viable Landing Share"
                  value={`${dispersion.success_count} / ${dispersion.num_points}`}
                  unit={`(${(dispersion.success_rate * 100).toFixed(0)}%)`}
                  variant={dispersion.success_rate >= 0.8 ? 'success' : 'alert'}
                  description="Starts with feasible route to goal"
                />
                <Stat
                  label="Arrival Time Range"
                  value={
                    dispersion.min_arrival_h !== null
                      ? `${dispersion.min_arrival_h.toFixed(1)}h – ${dispersion.max_arrival_h?.toFixed(1)}h`
                      : 'N/A'
                  }
                  variant="neutral"
                  description={`Nominal start: ${dispersion.nominal_arrival_h?.toFixed(1) ?? 'N/A'}h`}
                />
                <Stat
                  label="Dark Exposure Range"
                  value={
                    dispersion.min_dark_exposure_h !== null
                      ? `${dispersion.min_dark_exposure_h.toFixed(2)}h – ${dispersion.max_dark_exposure_h?.toFixed(2)}h`
                      : 'N/A'
                  }
                  variant="sun"
                  description="Across all viable landing starts"
                />
                <Stat
                  label="Worker Solve Time"
                  value={`${dispersion.solve_time_ms.toFixed(1)} ms`}
                  unit={`(${dispersion.num_points} solves)`}
                  variant="joint"
                  description="Batch Web Worker performance"
                />
              </div>

              {/* Plain-Language Summary Alert */}
              <div
                data-testid="dispersion-summary"
                style={{
                  padding: '0.8rem 1.1rem',
                  borderRadius: '6px',
                  backgroundColor:
                    dispersion.success_rate >= 0.8
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${
                    dispersion.success_rate >= 0.8
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'
                  }`,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>
                  {dispersion.success_rate >= 0.8 ? '✅' : '⚠️'}
                </span>
                <div>
                  <strong>{dispersion.plain_language_summary}</strong>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.2rem',
                    }}
                  >
                    {dispersion.assumption_note}
                  </div>
                </div>
              </div>

              {/* Sample Points Map / Matrix View */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Dispersion Sample Points Matrix ({dispersion.points.length} points)</span>
                  <span>Click point to inspect specific route</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '0.4rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '0.2rem',
                  }}
                >
                  {dispersion.points.map((pt) => {
                    const isSelected = selectedPointId === pt.point_id;
                    return (
                      <div
                        key={pt.point_id}
                        onClick={() => onSelectDispersionPoint?.(pt)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '4px',
                          border: isSelected
                            ? '1px solid var(--accent-primary)'
                            : '1px solid var(--border-color)',
                          backgroundColor: pt.feasible
                            ? isSelected
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'rgba(16, 185, 129, 0.08)'
                            : isSelected
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(239, 68, 68, 0.08)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="mono">
                            #{pt.point_id} {pt.point_id === 0 ? '(Nom)' : ''}
                          </span>
                          <span style={{ color: pt.feasible ? '#10b981' : '#ef4444' }}>
                            {pt.feasible ? 'VIABLE' : 'FAIL'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          [{pt.coord.join(',')}] ({pt.dist_from_center_m.toFixed(0)}m)
                        </div>
                        {pt.arrival_h !== null && (
                          <div style={{ color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                            ⏱️ {pt.arrival_h.toFixed(1)}h
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
