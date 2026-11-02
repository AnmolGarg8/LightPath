import React, { useState } from 'react';
import { MissionPlanResult, MissionStop, VisibilityCube } from '../types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Stat } from './ui/Stat';
import {
  generateMissionPlanCsv,
  generateMissionPlanIcs,
} from '../utils/missionPlanExporter';

interface MissionPlannerProps {
  cube: VisibilityCube;
  startPoint: [number, number];
  plan: MissionPlanResult | null;
  stops: MissionStop[];
  onUpdateStops: (stops: MissionStop[]) => void;
  onApplyFix?: (patch: Record<string, unknown>) => void;
  isLoading: boolean;
  onSelectTimeStep?: (step: number) => void;
}

export const MissionPlanner: React.FC<MissionPlannerProps> = ({
  cube,
  startPoint,
  plan,
  stops,
  onUpdateStops,
  onApplyFix,
  isLoading,
  onSelectTimeStep,
}) => {
  const [showPlanCard, setShowPlanCard] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'stops'>('timeline');

  const LIMITS_NOTE = 'Geometric Sun and Earth visibility only; no power or link budget.';

  // Stop management
  const handleAddStop = () => {
    if (stops.length >= 5) return;
    const nextIdx = stops.length + 1;
    // Offset slightly from last stop or start
    const lastCoord = stops.length > 0 ? stops[stops.length - 1].coord : startPoint;
    const newX = Math.min(cube.grid.nx - 1, Math.max(0, lastCoord[0] + 2));
    const newY = Math.min(cube.grid.ny - 1, Math.max(0, lastCoord[1] + 2));

    const newStop: MissionStop = {
      stop_id: `stop_${Date.now()}`,
      name: `Station ${nextIdx}`,
      coord: [newX, newY],
      dwell_time_h: 1.0,
      min_sun_frac: 0.5,
    };
    onUpdateStops([...stops, newStop]);
  };

  const handleRemoveStop = (idx: number) => {
    if (stops.length <= 1) return;
    onUpdateStops(stops.filter((_, i) => i !== idx));
  };

  const handleUpdateStop = (idx: number, patch: Partial<MissionStop>) => {
    const updated = stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdateStops(updated);
  };

  const handleMoveStop = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= stops.length) return;
    const reordered = [...stops];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    onUpdateStops(reordered);
  };

  // Export handlers
  const handleDownloadCsv = () => {
    if (!plan) return;
    const csvContent = generateMissionPlanCsv(plan);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${plan.mission_name.toLowerCase().replace(/\s+/g, '_')}_plan.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIcs = () => {
    if (!plan) return;
    const icsContent = generateMissionPlanIcs(plan);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${plan.mission_name.toLowerCase().replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dimensions for Timeline SVG
  const svgWidth = 840;
  const svgHeight = 240;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const numT = cube.time_utc.length;

  const getX = (t: number) => {
    if (numT <= 1) return padLeft + plotWidth / 2;
    return padLeft + (Math.max(0, Math.min(numT - 1, t)) / (numT - 1)) * plotWidth;
  };

  return (
    <Card
      title="Multi-Stop Lunar Mission Plan"
      subtitle="Chain sequential legs across up to 5 stops with dwell times, solar thresholds, Earth data uploads, and deadlines."
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isLoading && <Badge variant="neutral" label="⚡ Solving..." />}
          <button
            onClick={() => setShowPlanCard(true)}
            disabled={!plan}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              cursor: plan ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            📋 Plan Card
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={!plan}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: plan ? 'pointer' : 'not-allowed',
            }}
          >
            ⬇️ CSV
          </button>
          <button
            onClick={handleDownloadIcs}
            disabled={!plan}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: plan ? 'pointer' : 'not-allowed',
            }}
          >
            📅 ICS
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Prominent Operational Boundary Notice */}
        <div
          data-testid="mission-limits-notice"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: 'var(--text-xs)',
            color: '#f59e0b',
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>OPERATIONAL LIMIT:</strong> {LIMITS_NOTE}
          </span>
        </div>

        {/* Feasibility & Violations Banner */}
        {plan && (
          <div
            data-testid="mission-status-banner"
            style={{
              padding: '0.85rem 1.15rem',
              borderRadius: '6px',
              backgroundColor: plan.feasible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${plan.feasible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{plan.feasible ? '✅' : '❌'}</span>
                <div>
                  <strong style={{ color: plan.feasible ? '#10b981' : '#ef4444', fontSize: 'var(--text-sm)' }}>
                    {plan.feasible
                      ? 'MISSION PLAN FEASIBLE — ALL CONSTRAINTS MET'
                      : `MISSION PLAN INFEASIBLE (${plan.violations.length} VIOLATION${plan.violations.length > 1 ? 'S' : ''})`}
                  </strong>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {plan.feasible
                      ? `Successfully chained ${plan.legs.length} transit legs and ${plan.dwells.length} science dwells.`
                      : plan.violations.map((v) => `${v.stop_name}: ${v.details}`).join(' | ')}
                  </div>
                </div>
              </div>
              <Badge
                variant={plan.feasible ? 'success' : 'unverified'}
                label={plan.feasible ? '100% Viable' : 'Constraints Violated'}
              />
            </div>

            {/* Smallest Change Fix Recommendation */}
            {!plan.feasible && plan.fix_recommendation && (
              <div
                data-testid="mission-fix-recommendation"
                style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                  <strong style={{ color: 'var(--accent-primary)', marginRight: '0.4rem' }}>
                    SMALLEST CHANGE FIX:
                  </strong>
                  {plan.fix_recommendation.description}
                </div>
                {onApplyFix && plan.fix_recommendation.suggested_patch && (
                  <button
                    onClick={() => onApplyFix(plan.fix_recommendation!.suggested_patch!)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#000',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      marginLeft: '0.75rem',
                    }}
                  >
                    Apply Fix
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4 Summary Stats */}
        {plan && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <Stat
              label="Mission Duration"
              value={`${plan.metrics.total_duration_h.toFixed(1)} h`}
              variant="neutral"
              description={`Transit: ${plan.metrics.transit_duration_h.toFixed(1)}h | Dwell: ${plan.metrics.dwell_duration_h.toFixed(1)}h`}
            />
            <Stat
              label="Total Distance"
              value={`${Math.round(plan.metrics.total_distance_m)} m`}
              variant="neutral"
              description={`Across ${plan.stops.length} designated stations`}
            />
            <Stat
              label="Darkness Exposure"
              value={`${plan.metrics.total_dark_duration_h.toFixed(2)} h`}
              variant={plan.metrics.total_dark_duration_h === 0 ? 'success' : 'sun'}
              description={plan.metrics.total_dark_duration_h === 0 ? 'Continuous sunlight' : 'Traverses shadow boundary'}
            />
            <Stat
              label="Science Stops"
              value={`${plan.stops.length} / 5`}
              variant="joint"
              description={`${plan.dwells.filter((d) => d.sun_satisfied && d.earth_satisfied && d.deadline_satisfied).length} stops fully satisfied`}
            />
          </div>
        )}

        {/* Tab Selector: Timeline vs Stop Configurator */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '4px',
              fontSize: 'var(--text-sm)',
              backgroundColor: activeTab === 'timeline' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'timeline' ? '#000' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📊 Mission Timeline
          </button>
          <button
            onClick={() => setActiveTab('stops')}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '4px',
              fontSize: 'var(--text-sm)',
              backgroundColor: activeTab === 'stops' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'stops' ? '#000' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📍 Edit Stops ({stops.length}/5)
          </button>
        </div>

        {/* Tab 1: Timeline View */}
        {activeTab === 'timeline' && plan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  minWidth: '650px',
                  backgroundColor: '#090d16',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
                data-testid="mission-timeline-svg"
              >
                <defs>
                  <pattern
                    id="violationHatch"
                    width="8"
                    height="8"
                    patternTransform="rotate(45 0 0)"
                    patternUnits="userSpaceOnUse"
                  >
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2" strokeOpacity="0.6" />
                  </pattern>
                </defs>

                {/* Lane Labels */}
                <text x={12} y={padTop + 24} fill="#94a3b8" fontSize="11" fontWeight="bold">
                  Legs & Dwells
                </text>
                <text x={12} y={padTop + 85} fill="#facc15" fontSize="11" fontWeight="bold">
                  Sun Illumination
                </text>
                <text x={12} y={padTop + 145} fill="#38bdf8" fontSize="11" fontWeight="bold">
                  Earth Direct Link
                </text>

                {/* Horizontal dividing guidelines */}
                <line x1={padLeft} y1={padTop + 55} x2={padLeft + plotWidth} y2={padTop + 55} stroke="rgba(255,255,255,0.08)" />
                <line x1={padLeft} y1={padTop + 115} x2={padLeft + plotWidth} y2={padTop + 115} stroke="rgba(255,255,255,0.08)" />
                <line x1={padLeft} y1={padTop + 175} x2={padLeft + plotWidth} y2={padTop + 175} stroke="rgba(255,255,255,0.08)" />

                {/* Timeline Events: Transit Legs & Dwell Blocks */}
                {plan.timeline.map((ev, idx) => {
                  const x1 = getX(ev.start_time_idx);
                  const x2 = getX(ev.end_time_idx);
                  const w = Math.max(6, x2 - x1);
                  const isViolation = ev.violations.length > 0;

                  return (
                    <g
                      key={`ev-${idx}`}
                      onClick={() => onSelectTimeStep && onSelectTimeStep(ev.start_time_idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x={x1}
                        y={padTop + 8}
                        width={w}
                        height={32}
                        rx={3}
                        fill={
                          isViolation
                            ? 'url(#violationHatch)'
                            : ev.type === 'transit'
                            ? '#0284c7'
                            : '#d97706'
                        }
                        stroke={isViolation ? '#ef4444' : ev.type === 'transit' ? '#38bdf8' : '#f59e0b'}
                        strokeWidth="1.5"
                      />
                      {w > 35 && (
                        <text
                          x={x1 + w / 2}
                          y={padTop + 28}
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {ev.type === 'transit' ? '🚗 LEG' : '🔬 DWELL'}
                        </text>
                      )}

                      {/* Sun Lane Segment */}
                      <rect
                        x={x1}
                        y={padTop + 68}
                        width={w}
                        height={24}
                        rx={2}
                        fill={`rgba(250, 204, 21, ${(ev.sun_frac_avg ?? 100) / 100})`}
                        stroke="rgba(250, 204, 21, 0.4)"
                      />
                      {w > 30 && (
                        <text
                          x={x1 + w / 2}
                          y={padTop + 84}
                          fill="#0f172a"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {Math.round(ev.sun_frac_avg ?? 0)}%
                        </text>
                      )}

                      {/* Earth Lane Segment */}
                      <rect
                        x={x1}
                        y={padTop + 128}
                        width={w}
                        height={24}
                        rx={2}
                        fill={`rgba(56, 189, 248, ${(ev.earth_frac_avg ?? 100) / 100})`}
                        stroke="rgba(56, 189, 248, 0.4)"
                      />
                      {w > 30 && (
                        <text
                          x={x1 + w / 2}
                          y={padTop + 144}
                          fill="#0f172a"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {Math.round(ev.earth_frac_avg ?? 0)}%
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Time Axis at bottom */}
                <line x1={padLeft} y1={padTop + 175} x2={padLeft + plotWidth} y2={padTop + 175} stroke="rgba(255,255,255,0.3)" />
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
                  const step = Math.min(numT - 1, Math.round(frac * (numT - 1)));
                  const x = getX(step);
                  const utc = cube.time_utc[step] || '';
                  return (
                    <g key={i}>
                      <line x1={x} y1={padTop + 175} x2={x} y2={padTop + 180} stroke="#94a3b8" />
                      <text x={x} y={padTop + 195} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                        {utc.length >= 16 ? utc.slice(11, 16) : `t=${step}`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Tab 2: Stop Configurator */}
        {activeTab === 'stops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Configure up to 5 science stops. Reorder using arrow buttons.
              </span>
              <button
                onClick={handleAddStop}
                disabled={stops.length >= 5}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  backgroundColor: stops.length < 5 ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: stops.length < 5 ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: stops.length < 5 ? 'pointer' : 'not-allowed',
                }}
              >
                + Add Stop ({stops.length}/5)
              </button>
            </div>

            {stops.map((stop, sIdx) => (
              <div
                key={stop.stop_id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: 'var(--text-sm)' }}>
                      #{sIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={stop.name}
                      onChange={(e) => handleUpdateStop(sIdx, { name: e.target.value })}
                      style={{
                        padding: '0.2rem 0.5rem',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      [{stop.coord[0]}, {stop.coord[1]}]
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={() => handleMoveStop(sIdx, 'up')}
                      disabled={sIdx === 0}
                      title="Move earlier"
                      style={{ padding: '0.15rem 0.4rem', fontSize: 'var(--text-xs)', cursor: sIdx > 0 ? 'pointer' : 'default' }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveStop(sIdx, 'down')}
                      disabled={sIdx === stops.length - 1}
                      title="Move later"
                      style={{ padding: '0.15rem 0.4rem', fontSize: 'var(--text-xs)', cursor: sIdx < stops.length - 1 ? 'pointer' : 'default' }}
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handleRemoveStop(sIdx)}
                      disabled={stops.length <= 1}
                      title="Remove Stop"
                      style={{
                        padding: '0.15rem 0.4rem',
                        fontSize: 'var(--text-xs)',
                        color: '#ef4444',
                        cursor: stops.length > 1 ? 'pointer' : 'default',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Stop Constraint Inputs */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                      Dwell Time (h)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={stop.dwell_time_h}
                      onChange={(e) => handleUpdateStop(sIdx, { dwell_time_h: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '0.2rem 0.4rem',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                      Min Sun (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="10"
                      value={Math.round((stop.min_sun_frac ?? 0.5) * 100)}
                      onChange={(e) => handleUpdateStop(sIdx, { min_sun_frac: (parseFloat(e.target.value) || 0) / 100 })}
                      style={{
                        width: '100%',
                        padding: '0.2rem 0.4rem',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                      Earth Upload (h)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={stop.min_earth_duration_h ?? 0}
                      onChange={(e) => handleUpdateStop(sIdx, { min_earth_duration_h: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '0.2rem 0.4rem',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                      Deadline (Step)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={numT - 1}
                      placeholder="None"
                      value={stop.deadline_idx ?? ''}
                      onChange={(e) =>
                        handleUpdateStop(sIdx, {
                          deadline_idx: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '0.2rem 0.4rem',
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: One-Page Plan Card */}
        {showPlanCard && plan && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '750px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: '#0c1220',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1.5rem',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--accent-primary)' }}>
                    {plan.mission_name} — Mission Plan Card
                  </h3>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Origin: [{plan.start_coord[0]}, {plan.start_coord[1]}] | Departure: {plan.start_time_utc}
                  </div>
                </div>
                <button
                  onClick={() => setShowPlanCard(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Disclaimer */}
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', fontSize: 'var(--text-xs)', color: '#f59e0b', marginBottom: '1rem' }}>
                LIMITATION: {plan.limits_disclaimer}
              </div>

              {/* Table of Events */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Event</th>
                    <th style={{ padding: '0.5rem' }}>Type</th>
                    <th style={{ padding: '0.5rem' }}>Start UTC</th>
                    <th style={{ padding: '0.5rem' }}>End UTC</th>
                    <th style={{ padding: '0.5rem' }}>Duration</th>
                    <th style={{ padding: '0.5rem' }}>Sun %</th>
                    <th style={{ padding: '0.5rem' }}>Earth %</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.timeline.map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.45rem', fontWeight: 600 }}>{ev.label}</td>
                      <td style={{ padding: '0.45rem', textTransform: 'uppercase', color: ev.type === 'transit' ? '#38bdf8' : '#f59e0b' }}>{ev.type}</td>
                      <td style={{ padding: '0.45rem', fontFamily: 'monospace' }}>{ev.start_time_utc.slice(11, 16)}</td>
                      <td style={{ padding: '0.45rem', fontFamily: 'monospace' }}>{ev.end_time_utc.slice(11, 16)}</td>
                      <td style={{ padding: '0.45rem' }}>{ev.duration_h.toFixed(1)}h</td>
                      <td style={{ padding: '0.45rem' }}>{Math.round(ev.sun_frac_avg ?? 0)}%</td>
                      <td style={{ padding: '0.45rem' }}>{Math.round(ev.earth_frac_avg ?? 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  onClick={() => window.print()}
                  style={{ padding: '0.4rem 0.85rem', backgroundColor: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: '#000', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                >
                  🖨️ Print Card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
