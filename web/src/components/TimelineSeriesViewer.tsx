import React from 'react';
import { Series, Stats } from '../types';
import { Clock, Sun, Radio, Globe, Activity, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  series: Series;
  stats: Stats;
  currentTimeIdx: number;
  onSelectTimeIdx: (idx: number) => void;
}

export const TimelineSeriesViewer: React.FC<Props> = ({
  series,
  stats,
  currentTimeIdx,
  onSelectTimeIdx,
}) => {
  const times = series.time_utc;
  const numSteps = times.length;
  const currentTs = times[currentTimeIdx] || times[0];

  const currentSunStatus = series.sun.status[currentTimeIdx] || 'robust_blocked';
  const currentSunFrac = series.sun.frac[currentTimeIdx] ?? 0;
  const currentEarthStatus = series.earth.status[currentTimeIdx] || 'robust_blocked';
  const currentEarthFrac = series.earth.frac[currentTimeIdx] ?? 0;
  const currentLinkOk = series.dte.link_ok[currentTimeIdx] ?? false;
  const currentStationsVis = series.dte.station_visible[currentTimeIdx] || [false, false, false];
  const stationNames = series.dte.station_names || ['Goldstone (DSS 14)', 'Madrid (DSS 63)', 'Canberra (DSS 43)'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'robust_visible':
        return <span className="badge badge-green">Robust Visible</span>;
      case 'marginal':
        return <span className="badge badge-amber">Marginal</span>;
      case 'robust_blocked':
      default:
        return <span className="badge badge-red">Robust Blocked</span>;
    }
  };

  return (
    <div className="panel-card" style={{ marginBottom: '1.25rem' }}>
      {/* Header & Stats Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: '#38bdf8' }} />
            Mission Time Series & Window Statistics
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Deterministic lunar ephemeris and topocentric line-of-sight tracking
          </span>
        </div>

        {/* Current Time Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <Activity size={14} style={{ color: '#38bdf8' }} />
          <span className="mono" style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
            {currentTs}
          </span>
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Sun Stats */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#facc15', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Sun size={14} /> Solar Illumination
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
            {(stats.sun.uptime_fraction * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.25rem' }}>
            <span>Uptime: {stats.sun.total_uptime_h} h</span>
            <span>Longest Light: {stats.sun.longest_window_h} h</span>
            <span>Longest Outage: {stats.sun.longest_outage_h} h</span>
          </div>
        </div>

        {/* Earth Stats */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Globe size={14} /> Earth Visibility
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
            {(stats.earth.uptime_fraction * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.25rem' }}>
            <span>Uptime: {stats.earth.total_uptime_h} h</span>
            <span>Longest Window: {stats.earth.longest_window_h} h</span>
            <span>Longest Outage: {stats.earth.longest_outage_h} h</span>
          </div>
        </div>

        {/* DTE Link Stats */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4ade80', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Radio size={14} /> DTE Link Contact
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
            {(stats.dte.uptime_fraction * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.25rem' }}>
            <span>Uptime: {stats.dte.total_uptime_h} h</span>
            <span>Longest Window: {stats.dte.longest_window_h} h</span>
            <span>DSN Handover: Goldstone/Madrid/Canberra</span>
          </div>
        </div>

        {/* Joint Light & Link */}
        <div style={{ background: '#1e293b', border: '1px solid #0284c7', borderRadius: '0.5rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Activity size={14} /> Joint Light & Link
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8' }}>
            {(stats.joint.uptime_fraction * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.25rem' }}>
            <span>Joint Uptime: {stats.joint.total_uptime_h} h</span>
            <span>Longest Window: {stats.joint.longest_window_h} h</span>
            <span>Total Windows: {stats.joint.windows.length}</span>
          </div>
        </div>
      </div>

      {/* Scrubbable Time Slider */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
          <span>Start: {times[0]}</span>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>Scrub Time Slider: Step {currentTimeIdx + 1} / {numSteps}</span>
          <span>End: {times[numSteps - 1]}</span>
        </div>
        <input
          type="range"
          min={0}
          max={numSteps - 1}
          value={currentTimeIdx}
          onChange={(e) => onSelectTimeIdx(parseInt(e.target.value, 10))}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#38bdf8' }}
        />
      </div>

      {/* Visual Timeline Strips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {/* Sun Strip */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
            <span>Sun Illumination Track</span>
            <span>Current: {(currentSunFrac * 100).toFixed(1)}% ({currentSunStatus})</span>
          </div>
          <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #334155' }}>
            {series.sun.status.map((st, i) => {
              let bg = '#ef4444';
              if (st === 'robust_visible') bg = '#eab308';
              else if (st === 'marginal') bg = '#ca8a04';
              const isCurr = i === currentTimeIdx;
              return (
                <div
                  key={i}
                  onClick={() => onSelectTimeIdx(i)}
                  style={{
                    flex: 1,
                    background: bg,
                    opacity: isCurr ? 1.0 : 0.6,
                    borderBottom: isCurr ? '3px solid #fff' : undefined,
                    cursor: 'pointer',
                  }}
                  title={`${times[i]}: Sun ${(series.sun.frac[i] * 100).toFixed(0)}% (${st})`}
                />
              );
            })}
          </div>
        </div>

        {/* DTE Link Strip */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
            <span>DTE Link Track</span>
            <span>Current: {currentLinkOk ? 'LINK ACTIVE' : 'NO CONTACT'}</span>
          </div>
          <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #334155' }}>
            {series.dte.link_ok.map((ok, i) => {
              const bg = ok ? '#22c55e' : '#475569';
              const isCurr = i === currentTimeIdx;
              return (
                <div
                  key={i}
                  onClick={() => onSelectTimeIdx(i)}
                  style={{
                    flex: 1,
                    background: bg,
                    opacity: isCurr ? 1.0 : 0.6,
                    borderBottom: isCurr ? '3px solid #fff' : undefined,
                    cursor: 'pointer',
                  }}
                  title={`${times[i]}: DTE Link ${ok ? 'OK' : 'DOWN'}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Step Detailed Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', background: '#090d16', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Solar Disc Condition
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            {getStatusBadge(currentSunStatus)}
            <span style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
              {(currentSunFrac * 100).toFixed(1)}% Disc Visible
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Earth Disc Condition
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            {getStatusBadge(currentEarthStatus)}
            <span style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
              {(currentEarthFrac * 100).toFixed(1)}% Disc Visible
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Earth Ground Stations (DSN)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            {stationNames.map((name, idx) => {
              const vis = currentStationsVis[idx];
              return (
                <span
                  key={name}
                  style={{
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    color: vis ? '#4ade80' : '#64748b',
                  }}
                >
                  {vis ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {name.split(' ')[0]}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
