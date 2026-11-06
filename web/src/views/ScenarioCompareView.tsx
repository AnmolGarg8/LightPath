import React, { useState } from 'react';
import { RouteResult, Scenario } from '../types';
import { Badge } from '../components/ui/Badge';
import { compareScenarios, decodeScenarioHash, importScenarioJson } from '../utils/scenarioCodec';
import { ArrowRightLeft, Upload } from 'lucide-react';

export const DEFAULT_PRESET_A: Scenario = {
  version: 'v1',
  site_id: 'shackleton-connecting-ridge',
  start_date: '2026-11-01',
  end_date: '2026-11-08',
  min_sun_frac: 0.5,
  min_earth_frac: 0.5,
  mast_height_m: 2.0,
  speed_m_s: 0.05,
  max_slope_deg: 15.0,
  allow_wait: true,
  mode: 'earliest-arrival',
  conservative: false,
  horizon_margin_deg: 0.0,
  start_coord: [10, 10],
  goal_coord: [20, 20],
  data_version_hash: '9f8e21a0',
};

export const DEFAULT_PRESET_B: Scenario = {
  version: 'v1',
  site_id: 'shackleton-connecting-ridge',
  start_date: '2026-11-01',
  end_date: '2026-11-08',
  min_sun_frac: 0.5,
  min_earth_frac: 0.5,
  mast_height_m: 3.5,
  speed_m_s: 0.05,
  max_slope_deg: 15.0,
  allow_wait: true,
  mode: 'earliest-arrival',
  conservative: true,
  horizon_margin_deg: 0.5,
  start_coord: [10, 10],
  goal_coord: [20, 20],
  data_version_hash: '9f8e21a0',
};

const NOMINAL_RESULT_A: RouteResult = {
  feasible: true,
  mode: 'rover',
  params: {
    start_coord: [10, 10],
    end_coord: [20, 20],
    start_time_idx: 0,
    speed_m_s: 0.05,
    max_slope_deg: 15.0,
    min_sun_frac: 0.5,
    min_earth_frac: 0.5,
  },
  path: [],
  metrics: {
    total_distance_m: 1414.2,
    duration_h: 7.86,
    average_slope_deg: 4.2,
    max_slope_deg: 9.1,
    dark_exposure_h: 0.0,
    wait_duration_h: 0.0,
    min_sun_frac_observed: 0.5,
    min_earth_frac_observed: 0.5,
  },
  alternatives: [],
  explanation: 'Nominal optimal path.',
};

const CONSERVATIVE_RESULT_B: RouteResult = {
  feasible: true,
  mode: 'rover',
  params: {
    start_coord: [10, 10],
    end_coord: [20, 20],
    start_time_idx: 0,
    speed_m_s: 0.05,
    max_slope_deg: 15.0,
    min_sun_frac: 0.5,
    min_earth_frac: 0.5,
  },
  path: [],
  metrics: {
    total_distance_m: 1650.0,
    duration_h: 10.42,
    average_slope_deg: 4.8,
    max_slope_deg: 11.2,
    dark_exposure_h: 0.0,
    wait_duration_h: 1.25,
    min_sun_frac_observed: 0.5,
    min_earth_frac_observed: 0.5,
  },
  alternatives: [],
  explanation: 'Conservative path with raised horizon margin.',
};

export const ScenarioCompareView: React.FC = () => {
  const [scenA, setScenA] = useState<Scenario>(DEFAULT_PRESET_A);
  const [scenB, setScenB] = useState<Scenario>(DEFAULT_PRESET_B);
  const [resA] = useState<RouteResult | null>(NOMINAL_RESULT_A);
  const [resB] = useState<RouteResult | null>(CONSERVATIVE_RESULT_B);
  const [warningA, setWarningA] = useState<string | null>(null);
  const [warningB, setWarningB] = useState<string | null>(null);

  const [inputHashA, setInputHashA] = useState('');
  const [inputHashB, setInputHashB] = useState('');

  const comparison = compareScenarios(scenA, scenB, resA, resB);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { scenario, warning, error } = importScenarioJson(content);
      if (error) {
        alert(error);
        return;
      }
      if (scenario) {
        if (target === 'A') {
          setScenA(scenario);
          setWarningA(warning);
        } else {
          setScenB(scenario);
          setWarningB(warning);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleApplyHash = (target: 'A' | 'B') => {
    const hash = target === 'A' ? inputHashA : inputHashB;
    const { scenario, error } = decodeScenarioHash(hash);
    if (error) {
      alert(error);
      return;
    }
    if (scenario) {
      if (target === 'A') {
        setScenA(scenario);
        setInputHashA('');
      } else {
        setScenB(scenario);
        setInputHashB('');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* View Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
            Side-by-Side Scenario Comparison
          </h1>
          <Badge variant="info">REPRODUCIBILITY &amp; TRADE-OFFS</Badge>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Compare operational parameters, horizon margins, and traverse feasibility between two reproducible scenarios.
        </p>
      </div>

      {/* Two Scenario Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Scenario A */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Scenario A (Baseline)</h2>
            <Badge variant="neutral">{scenA.mode}</Badge>
          </div>

          {warningA && (
            <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '0.8rem' }}>
              {warningA}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Site:</span> <strong>{scenA.site_id}</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Dates:</span> {scenA.start_date} &rarr; {scenA.end_date}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Mast Height:</span> {scenA.mast_height_m} m</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Speed:</span> {scenA.speed_m_s} m/s</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Max Slope:</span> {scenA.max_slope_deg}°</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Margin:</span> {scenA.conservative ? `${scenA.horizon_margin_deg}°` : 'None'}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Start:</span> [{scenA.start_coord.join(', ')}]</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Goal:</span> [{scenA.goal_coord.join(', ')}]</div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Paste URL hash slug (v1-...)"
                value={inputHashA}
                onChange={(e) => setInputHashA(e.target.value)}
                style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
              />
              <button onClick={() => handleApplyHash('A')} style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--accent-primary)', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>
                Load
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer' }}>
              <Upload size={14} />
              Import Scenario A JSON file
              <input type="file" accept=".json" onChange={(e) => handleFileUpload(e, 'A')} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Scenario B */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Scenario B (Comparison)</h2>
            <Badge variant={scenB.conservative ? 'warning' : 'neutral'}>
              {scenB.conservative ? 'CONSERVATIVE' : scenB.mode}
            </Badge>
          </div>

          {warningB && (
            <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '0.8rem' }}>
              {warningB}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Site:</span> <strong>{scenB.site_id}</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Dates:</span> {scenB.start_date} &rarr; {scenB.end_date}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Mast Height:</span> {scenB.mast_height_m} m</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Speed:</span> {scenB.speed_m_s} m/s</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Max Slope:</span> {scenB.max_slope_deg}°</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Margin:</span> {scenB.conservative ? `${scenB.horizon_margin_deg}°` : 'None'}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Start:</span> [{scenB.start_coord.join(', ')}]</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Goal:</span> [{scenB.goal_coord.join(', ')}]</div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Paste URL hash slug (v1-...)"
                value={inputHashB}
                onChange={(e) => setInputHashB(e.target.value)}
                style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
              />
              <button onClick={() => handleApplyHash('B')} style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--accent-primary)', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>
                Load
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer' }}>
              <Upload size={14} />
              Import Scenario B JSON file
              <input type="file" accept=".json" onChange={(e) => handleFileUpload(e, 'B')} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* Comparison Analysis Section */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowRightLeft size={18} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Deltas and Trade-Off Summary</h2>
        </div>

        {/* Trade-Off Summary Box */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderLeft: '4px solid var(--accent-primary)',
            borderRadius: '4px',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Summary:</strong> {comparison.metric_deltas.summary}
        </div>

        {/* Parameter Differences List */}
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Operational Differences ({comparison.parameter_differences.length})
          </h3>
          {comparison.parameter_differences.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Scenarios A and B have identical configuration parameters.
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {comparison.parameter_differences.map((diff, idx) => (
                <li key={idx}><strong>{diff}</strong></li>
              ))}
            </ul>
          )}
        </div>

        {/* Metric Delta Grid */}
        {comparison.metric_deltas.delta_distance_m !== undefined && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Extra Distance (B - A)</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: comparison.metric_deltas.delta_distance_m > 0 ? '#f59e0b' : '#22c55e' }}>
                {comparison.metric_deltas.delta_distance_m > 0 ? '+' : ''}{comparison.metric_deltas.delta_distance_m} m
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Transit Duration Delta</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: (comparison.metric_deltas.delta_duration_h ?? 0) > 0 ? '#f59e0b' : '#22c55e' }}>
                {(comparison.metric_deltas.delta_duration_h ?? 0) > 0 ? '+' : ''}{comparison.metric_deltas.delta_duration_h} h
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dark Exposure Delta</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: (comparison.metric_deltas.delta_dark_h ?? 0) > 0 ? '#ef4444' : '#22c55e' }}>
                {(comparison.metric_deltas.delta_dark_h ?? 0) > 0 ? '+' : ''}{comparison.metric_deltas.delta_dark_h} h
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sunlight Waiting Delta</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                {(comparison.metric_deltas.delta_wait_h ?? 0) > 0 ? '+' : ''}{comparison.metric_deltas.delta_wait_h} h
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
