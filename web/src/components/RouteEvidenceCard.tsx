import React from 'react';
import { RouteEvidenceData } from '../types';
import { Printer, X } from 'lucide-react';

interface RouteEvidenceCardProps {
  data: RouteEvidenceData;
  onClose?: () => void;
}

export const RouteEvidenceCard: React.FC<RouteEvidenceCardProps> = ({ data, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Action Header (Hidden in Print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>One-Page Route Evidence Card</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Print / Export PDF ready)</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handlePrint}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Printer size={15} />
            Print / Save as PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.4rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Close Card"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* The Printable Card Layout (A4/Letter friendly) */}
      <div
        id="route-evidence-printable-card"
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '2.5rem',
          borderRadius: '8px',
          border: '2px solid #cbd5e1',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          lineHeight: 1.45,
        }}
      >
        {/* Card Header */}
        <div
          style={{
            borderBottom: '2px solid #0f172a',
            paddingBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: '#64748b' }}>
              LIGHTPATH — VERIFIED TRAVERSE EVIDENCE CARD
            </div>
            <h1 style={{ margin: '0.25rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              {data.title}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
              Target Site: <strong>{data.site_name}</strong> ({data.site_id}) | Lat: {data.coordinates.lat_deg.toFixed(4)}°, Lon: {data.coordinates.lon_deg.toFixed(4)}° | Base Elev: {data.coordinates.ground_elev_m.toFixed(1)} m
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
              HASH: {data.short_provenance_hash}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              {data.timestamp_utc}
            </div>
          </div>
        </div>

        {/* Primary Outputs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Feasibility
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: data.outputs.feasible ? '#16a34a' : '#dc2626' }}>
              {data.outputs.feasible ? 'FEASIBLE' : 'INFEASIBLE'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Distance
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              {data.outputs.total_distance_m.toLocaleString()} m
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Duration
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              {data.outputs.duration_h.toFixed(2)} h
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Dark Exposure
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              {data.outputs.dark_exposure_h.toFixed(2)} h
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Sun Wait
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              {data.outputs.wait_duration_h.toFixed(2)} h
            </div>
          </div>
        </div>

        {/* Two-Column Details: Assumptions & Provenance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.82rem' }}>
          {/* Assumptions */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.85rem', backgroundColor: '#fafafa' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e293b' }}>
              1. Assumptions & Route Parameters
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li><strong>Rover Speed:</strong> {data.assumptions.speed_m_s.toFixed(3)} m/s ({(data.assumptions.speed_m_s * 3.6).toFixed(2)} km/h)</li>
              <li><strong>Max Traversable Slope:</strong> {data.assumptions.max_slope_deg.toFixed(1)}°</li>
              <li><strong>Observer Mast Height:</strong> {data.assumptions.mast_height_m.toFixed(1)} m above local DEM surface</li>
              <li><strong>Solar Disc Threshold:</strong> {(data.assumptions.min_sun_frac * 100).toFixed(0)}% visible area</li>
              <li><strong>Earth Disc Threshold:</strong> {(data.assumptions.min_earth_frac * 100).toFixed(0)}% visible area</li>
              <li><strong>Conservative Horizon Margin:</strong> {data.assumptions.conservative_mode ? `${data.assumptions.horizon_margin_deg.toFixed(1)}° (Active)` : 'None (Nominal)'}</li>
              <li><strong>Touchdown Dispersion Radius:</strong> ±{data.assumptions.landing_dispersion_m} m (Assumption & Parameter)</li>
            </ul>
          </div>

          {/* Data & Kernel Provenance */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.85rem', backgroundColor: '#fafafa' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e293b' }}>
              2. Data & Kernel Provenance
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li><strong>Elevation Model:</strong> {data.data_and_kernels.dem_dataset} ({data.data_and_kernels.dem_resolution_m} m/pixel)</li>
              <li><strong>Reference Frame:</strong> {data.data_and_kernels.reference_frame} (Moon Mean Earth / Polar Axis)</li>
              <li><strong>Topocentric Elevation:</strong> Exact spherical curvature per-point local up (Rule 6, 7)</li>
              <li><strong>Ephemeris Kernels:</strong> {data.data_and_kernels.kernel_set}</li>
              <li><strong>Engine Version:</strong> {data.software_version}</li>
              <li><strong>Departure Window:</strong> {data.outputs.start_time_utc} &rarr; {data.outputs.arrival_time_utc}</li>
            </ul>
          </div>
        </div>

        {/* Alternatives Section */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.85rem', fontSize: '0.82rem', backgroundColor: '#ffffff' }}>
          <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e293b' }}>
            3. Alternatives & Sensitivity Analysis
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <strong>Conservative Mode (Cost of Caution):</strong>
              <div style={{ color: '#475569', marginTop: '0.15rem' }}>
                {data.alternatives.conservative_caution_distance_m !== undefined
                  ? `Extra driving: +${data.alternatives.conservative_caution_distance_m} m | Extra waiting: +${data.alternatives.conservative_caution_duration_h?.toFixed(2)} h`
                  : 'Computed under nominal horizon criteria.'}
              </div>
            </div>
            <div>
              <strong>Departure Window Flexibility:</strong>
              <div style={{ color: '#475569', marginTop: '0.15rem' }}>
                Earliest feasible: {data.alternatives.earliest_departure_utc || 'N/A'} | Latest safe departure: {data.alternatives.latest_safe_departure_utc || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Limitations & Caveats */}
        <div
          style={{
            borderLeft: '4px solid #f59e0b',
            backgroundColor: '#fffbeb',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#78350f',
            lineHeight: 1.45,
          }}
        >
          <strong>OPERATIONAL LIMITATIONS (Project Rule 8 & Non-Causality Disclosures):</strong>
          <br />
          LightPath evaluates celestial and terrain line-of-sight geometry only. It does not model rover battery capacity, depth-of-discharge, thermal state-of-charge, soil wheel slip, or boulder obstacles smaller than the {data.data_and_kernels.dem_resolution_m} m DEM resolution. Sun visibility is not electrical power; Earth visibility is not a communications link budget. This card is an engineering decision aid and is not certified for flight operations.
        </div>
      </div>
    </div>
  );
};
