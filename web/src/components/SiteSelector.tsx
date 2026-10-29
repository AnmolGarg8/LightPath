import React from 'react';
import { Site } from '../types';
import { MapPin, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  sites: Site[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

export const SiteSelector: React.FC<Props> = ({ sites, selectedSiteId, onSelectSite }) => {
  return (
    <div className="panel-card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} style={{ color: '#38bdf8' }} />
          CLPS Lunar South-Pole Target Site
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          LOLA Mean-Earth Frame (MOON_ME)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {sites.map((site) => {
          const isSelected = site.id === selectedSiteId;
          return (
            <button
              key={site.id}
              onClick={() => onSelectSite(site.id)}
              style={{
                textAlign: 'left',
                background: isSelected ? 'rgba(56, 189, 248, 0.1)' : '#1e293b',
                border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: isSelected ? '#38bdf8' : '#f8fafc', fontSize: '0.9rem' }}>
                  {site.name}
                </span>
                {site.verified ? (
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                    <ShieldCheck size={10} style={{ marginRight: '2px' }} /> Verified
                  </span>
                ) : (
                  <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
                    <AlertCircle size={10} style={{ marginRight: '2px' }} /> Synthetic
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>Lat: {site.lat_deg.toFixed(2)}°</span>
                <span>Lon: {site.lon_deg.toFixed(2)}°</span>
                <span>Elev: {site.ground_elev_m} m</span>
              </div>

              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {site.mission_ids.map((m) => (
                  <span
                    key={m}
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '0.25rem',
                      color: '#cbd5e1',
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
