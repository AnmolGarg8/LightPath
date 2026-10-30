/**
 * Sensitivity Panel
 * 
 * Requirement 6:
 * - Statistic versus mast height (0.5m, 1.0m, 2.0m, 3.0m, 5.0m).
 * - By resolution only if available, otherwise exact required explanation note.
 */

import React from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { MastHeightSensitivity, ResolutionSensitivity } from '../types/schemas';
import { Info, BarChart3 } from 'lucide-react';

interface SensitivityPanelProps {
  mastSensitivities?: MastHeightSensitivity[];
  resolutionSensitivity?: ResolutionSensitivity;
  currentMastHeightM: number;
  onSelectMastHeight: (heightM: number) => void;
}

export const SensitivityPanel: React.FC<SensitivityPanelProps> = ({
  mastSensitivities = [],
  resolutionSensitivity,
  currentMastHeightM,
  onSelectMastHeight,
}) => {
  return (
    <Card className="sensitivity-panel-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} style={{ color: 'var(--color-blue)' }} />
          <span>Sensitivity Trade Studies</span>
        </h3>
        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Evaluating impact of observer elevation and terrain sampling fidelity on mission uptime.
        </div>
      </div>

      {/* 1. SENSITIVITY VERSUS MAST HEIGHT */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
            Observer Mast Height Trade Study (0.5m – 5.0m)
          </h4>
          <Badge variant="neutral" size="sm">
            Resolution-Limited (20m DEM)
          </Badge>
        </div>
        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          Note (Knowledge Guide Sec. 9 &amp; 12): Sensitivity to observer height is meaningful only where terrain is resolved. A 20m grid cannot resolve metre-scale rocks; statistics reflect macro-skyline depression.
        </div>

        {mastSensitivities.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-table"
              aria-label="Mast Height Sensitivity Table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}
            >
              <thead>
                <tr style={{ background: 'var(--background-secondary, #0f172a)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Mast Height</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Sunlight Uptime %</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Earth Line of Sight %</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>DTE Contact %</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Joint Sun+DTE %</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Longest Darkness (h)</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mastSensitivities.map((row) => {
                  const isSelected = Math.abs(row.mast_height_m - currentMastHeightM) < 0.1;
                  return (
                    <tr
                      key={row.mast_height_m}
                      style={{
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <strong>{row.mast_height_m.toFixed(1)}m</strong>{' '}
                        {isSelected && <Badge variant="info" size="sm">Active</Badge>}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{(row.sun_uptime_fraction * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{(row.earth_uptime_fraction * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{(row.dte_uptime_fraction * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{(row.joint_uptime_fraction * 100).toFixed(1)}%</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{row.longest_darkness_h.toFixed(1)}h</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {!isSelected ? (
                          <button
                            type="button"
                            onClick={() => onSelectMastHeight(row.mast_height_m)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.75rem',
                              borderRadius: 'var(--radius-xs)',
                              background: 'var(--card-bg)',
                              border: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              color: 'var(--color-blue)',
                            }}
                          >
                            Select
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Viewing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Mast height trade study metrics are unavailable for this site.
          </div>
        )}
      </div>

      {/* 2. SENSITIVITY BY RESOLUTION */}
      <div>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
          Sensitivity by Terrain Resolution
        </h4>

        {resolutionSensitivity && resolutionSensitivity.available && resolutionSensitivity.comparison && resolutionSensitivity.comparison.length > 1 ? (
          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-table"
              aria-label="Resolution Sensitivity Table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}
            >
              <thead>
                <tr style={{ background: 'var(--background-secondary, #0f172a)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Resolution Layer</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Cell Spacing</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Sunlight Uptime %</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Horizon Delta (RMS)</th>
                </tr>
              </thead>
              <tbody>
                {resolutionSensitivity.comparison.map((layer: Record<string, unknown>, idx: number) => (
                  <tr key={idx}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{String(layer.name || `Layer ${idx + 1}`)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{String(layer.pixel_size_m || 'N/A')}m</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{String(layer.sun_uptime_fraction || 'N/A')}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{String(layer.rms_horizon_diff_deg || '0.000')}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Required fallback explanation when multi-resolution is unavailable */
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'var(--background-secondary, #0f172a)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              fontSize: '0.825rem',
              color: 'var(--text-muted)',
            }}
          >
            <Info size={16} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong>Resolution Sensitivity Unavailable:</strong> Sensitivity by terrain resolution is unavailable: only a single 20m LOLA DEM layer set is currently configured for this site.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
