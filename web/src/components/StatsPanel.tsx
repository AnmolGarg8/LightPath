/**
 * Stats Panel with Dynamic Threshold Presets & Accessible Table Toggle
 * 
 * Requirement 5:
 * - Percentage of time above chosen threshold.
 * - Number of windows, longest outage, joint availability.
 * - Threshold control with presets (10%, 50%, 80%, custom).
 * - Every number shows its threshold.
 * - Table version for accessibility.
 */

import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Stat } from './ui/Stat';
import { Badge } from './ui/Badge';
import { DynamicStatsReport } from '../utils/statsCalculator';
import { Sliders, Table as TableIcon, LayoutGrid } from 'lucide-react';

interface StatsPanelProps {
  statsReport: DynamicStatsReport;
  threshold: number;
  onThresholdChange: (newThreshold: number) => void;
}

const THRESHOLD_PRESETS = [
  { label: 'Grazing (≥ 10%)', value: 0.10 },
  { label: 'Half-Disc (≥ 50%)', value: 0.50 },
  { label: 'Robust (≥ 80%)', value: 0.80 },
];

export const StatsPanel: React.FC<StatsPanelProps> = ({
  statsReport,
  threshold,
  onThresholdChange,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const thresholdPct = Math.round(threshold * 100);

  const { sun, earth, dte, joint_sun_earth, joint_sun_dte } = statsReport;

  return (
    <Card className="stats-panel-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      {/* Header & Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Site Illumination & Line-of-Sight Statistics
          </h3>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            All statistics recomputed dynamically for active threshold: <strong>≥ {thresholdPct}% disc fraction</strong>
          </div>
        </div>

        {/* Threshold Presets & View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Presets:</span>
            {THRESHOLD_PRESETS.map((preset) => {
              const active = Math.abs(preset.value - threshold) < 0.01;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onThresholdChange(preset.value)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    border: active ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                    background: active ? 'rgba(56, 189, 248, 0.2)' : 'var(--card-bg)',
                    color: active ? 'var(--color-blue)' : 'var(--text-main)',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'cards' ? 'table' : 'cards'))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
            title={viewMode === 'cards' ? 'Switch to accessible table' : 'Switch to cards view'}
          >
            {viewMode === 'cards' ? <TableIcon size={14} /> : <LayoutGrid size={14} />}
            <span>{viewMode === 'cards' ? 'Table View' : 'Card View'}</span>
          </button>
        </div>
      </div>

      {/* Threshold Slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 0.75rem',
          marginBottom: '1rem',
          background: 'var(--background-secondary, #0f172a)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
        }}
      >
        <Sliders size={16} style={{ color: 'var(--color-blue)' }} />
        <span>Custom Disc Threshold:</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={thresholdPct}
          onChange={(e) => onThresholdChange(Number(e.target.value) / 100)}
          aria-label="Disc Visibility Threshold Slider"
          style={{ flex: 1, accentColor: 'var(--color-blue)', cursor: 'pointer' }}
        />
        <strong style={{ minWidth: '45px', textAlign: 'right' }}>≥ {thresholdPct}%</strong>
      </div>

      {/* Render Mode: CARDS */}
      {viewMode === 'cards' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Sun Uptime */}
          <Stat
            label="Sunlight Visibility"
            value={`${(sun.uptime_fraction * 100).toFixed(1)}%`}
            description={`${sun.total_uptime_h}h total (threshold ≥ ${thresholdPct}%)`}
            badge={<Badge variant="success" size="sm">Illumination</Badge>}
          />

          {/* Earth Uptime */}
          <Stat
            label="Earth Line of Sight"
            value={`${(earth.uptime_fraction * 100).toFixed(1)}%`}
            description={`${earth.total_uptime_h}h total (threshold ≥ ${thresholdPct}%)`}
            badge={<Badge variant="info" size="sm">Line of Sight</Badge>}
          />

          {/* DTE Contact */}
          <Stat
            label="Direct-to-Earth Contact"
            value={`${(dte.uptime_fraction * 100).toFixed(1)}%`}
            description={`${dte.total_uptime_h}h with DSN (mask ≥ 6.0°)`}
            badge={<Badge variant="info" size="sm">DSN Visible</Badge>}
          />

          {/* Joint Sun + Earth */}
          <Stat
            label="Joint Sun & Earth Sight"
            value={`${(joint_sun_earth.uptime_fraction * 100).toFixed(1)}%`}
            description={`${joint_sun_earth.total_uptime_h}h combined (threshold ≥ ${thresholdPct}%)`}
            badge={<Badge variant="neutral" size="sm">Simultaneous</Badge>}
          />

          {/* Joint Sun + DTE Contact */}
          <Stat
            label="Joint Sun + DTE Contact"
            value={`${(joint_sun_dte.uptime_fraction * 100).toFixed(1)}%`}
            description={`${joint_sun_dte.total_uptime_h}h optical + RF (threshold ≥ ${thresholdPct}%)`}
            badge={<Badge variant="success" size="sm">Mission Window</Badge>}
          />

          {/* Longest Darkness Outage */}
          <Stat
            label="Longest Darkness Spell"
            value={`${sun.longest_outage_h}h`}
            description={`Max continuous sub-threshold (threshold < ${thresholdPct}%)`}
            badge={<Badge variant="warning" size="sm">Outage</Badge>}
          />

          {/* Continuous Windows Count */}
          <Stat
            label="Sunlight Windows Count"
            value={sun.windows_count}
            description={`Longest window: ${sun.longest_window_h}h (threshold ≥ ${thresholdPct}%)`}
            badge={<Badge variant="neutral" size="sm">Windows</Badge>}
          />

          {/* Longest Earth Outage */}
          <Stat
            label="Longest Earth Sight Outage"
            value={`${earth.longest_outage_h}h`}
            description={`Max continuous blockage (threshold < ${thresholdPct}%)`}
            badge={<Badge variant="neutral" size="sm">Outage</Badge>}
          />
        </div>
      ) : (
        /* Render Mode: ACCESSIBLE SEMANTIC TABLE */
        <div style={{ overflowX: 'auto' }}>
          <table
            className="data-table"
            aria-label="Visibility and Line of Sight Statistics Table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
          >
            <thead>
              <tr style={{ background: 'var(--background-secondary, #0f172a)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Category</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Uptime %</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Total Uptime</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Windows Count</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Longest Window</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Longest Outage</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Applied Threshold</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>☀️ Sunlight Visibility</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{(sun.uptime_fraction * 100).toFixed(1)}%</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{sun.total_uptime_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{sun.windows_count}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{sun.longest_window_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{sun.longest_outage_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>≥ {thresholdPct}% disc fraction</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>🌍 Earth Line of Sight</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{(earth.uptime_fraction * 100).toFixed(1)}%</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{earth.total_uptime_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{earth.windows_count}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{earth.longest_window_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{earth.longest_outage_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>≥ {thresholdPct}% disc fraction</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>📡 Direct-to-Earth Contact (DTE)</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{(dte.uptime_fraction * 100).toFixed(1)}%</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{dte.total_uptime_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{dte.windows_count}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{dte.longest_window_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{dte.longest_outage_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>≥ 6.0° DSN mask + ≥ {thresholdPct}% Earth</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>⚡ Joint Sun & Earth Sight</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{(joint_sun_earth.uptime_fraction * 100).toFixed(1)}%</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_earth.total_uptime_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_earth.windows_count}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_earth.longest_window_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_earth.longest_outage_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>≥ {thresholdPct}% disc fraction</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>🚀 Joint Sun + DTE Line of Sight</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{(joint_sun_dte.uptime_fraction * 100).toFixed(1)}%</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_dte.total_uptime_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_dte.windows_count}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_dte.longest_window_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{joint_sun_dte.longest_outage_h}h</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>≥ {thresholdPct}% disc fraction</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
