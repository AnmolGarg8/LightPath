/**
 * Site Detail Analysis View
 * 
 * Requirement 2:
 * - Horizon Panorama on top, timeline and stats below.
 * - Changing mast height or threshold updates every panel consistently.
 * - Collapsible limitations panel at the bottom.
 * - Strict adherence to non-negotiable rules and wording ("visible", "in line of sight").
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchJsonData } from '../utils/dataLoader';
import {
  SiteFullSchema,
  HorizonSchema,
  SeriesSchema,
  SiteFull,
  Horizon,
  Series,
} from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';
import { Panorama } from './Panorama';
import { Timeline } from '../components/Timeline';
import { StatsPanel } from '../components/StatsPanel';
import { SensitivityPanel } from '../components/SensitivityPanel';
import { LimitationsPanel } from '../components/common/LimitationsPanel';
import { calculateDynamicStats } from '../utils/statsCalculator';
import { Compass, Mountain, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface SiteDetailViewProps {
  siteId: string;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({ siteId }) => {
  const [siteData, setSiteData] = useState<SiteFull | null>(null);
  const [horizonData, setHorizonData] = useState<Horizon | null>(null);
  const [seriesData, setSeriesData] = useState<Series | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Synchronized analysis state
  const [mastHeightM, setMastHeightM] = useState<number>(2.0);
  const [threshold, setThreshold] = useState<number>(0.50);
  const [timeIndex, setTimeIndex] = useState<number>(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/sites/${siteId}.json`, SiteFullSchema),
      fetchJsonData(`./data/${siteId}/horizon.json`, HorizonSchema),
      fetchJsonData(`./data/${siteId}/series.json`, SeriesSchema),
    ])
      .then(([site, horizon, series]) => {
        setSiteData(site);
        setHorizonData(horizon);
        setSeriesData(series);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  // Dynamic stats recomputed across all panels whenever series or threshold changes
  const dynamicStatsReport = useMemo(() => {
    if (!seriesData) return null;
    return calculateDynamicStats(seriesData, threshold);
  }, [seriesData, threshold]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !siteData || !horizonData || !seriesData || !dynamicStatsReport) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading high-resolution terrain horizon and illumination models...
      </div>
    );
  }

  return (
    <div className="site-detail-container" style={{ padding: '1rem 0' }}>
      {/* Site Header */}
      <Card style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{siteData.name}</h1>
              {siteData.verified ? (
                <Badge variant="success" size="sm" icon={<CheckCircle2 size={12} />}>
                  Verified Site
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" icon={<AlertTriangle size={12} />}>
                  Unverified / Synthetic
                </Badge>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Compass size={15} />
                <span>
                  {siteData.lat_deg.toFixed(3)}° Lat, {siteData.lon_deg.toFixed(3)}° Lon (MOON_ME)
                </span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mountain size={15} />
                <span>Elevation: {siteData.ground_elev_m.toFixed(1)}m (rel. 1737.4 km sphere)</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={15} />
                <span>Azimuth Step: {horizonData.az_step_deg}°</span>
              </span>
            </div>
          </div>

          {/* Observer Mast Height Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--background-secondary, #0f172a)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mast Height:</span>
            {horizonData.heights_m.map((h) => {
              const active = Math.abs(h - mastHeightM) < 0.1;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setMastHeightM(h)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-xs)',
                    border: active ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                    background: active ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    color: active ? 'var(--color-blue)' : 'var(--text-main)',
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {h.toFixed(1)}m
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 1. HORIZON PANORAMA (ON TOP) */}
      <Panorama
        horizon={horizonData}
        series={seriesData}
        mastHeightM={mastHeightM}
        timeIndex={timeIndex}
        onTimeChange={setTimeIndex}
        threshold={threshold}
      />

      {/* 2. TIMELINE MULTI-LANE VIEWER (BELOW PANORAMA) */}
      <Timeline
        series={seriesData}
        timeIndex={timeIndex}
        onTimeChange={setTimeIndex}
        threshold={threshold}
        sunStats={dynamicStatsReport.sun}
        earthStats={dynamicStatsReport.earth}
        events={dynamicStatsReport.events}
      />

      {/* 3. STATS PANEL WITH THRESHOLD CONTROLS (BELOW TIMELINE) */}
      <StatsPanel
        statsReport={dynamicStatsReport}
        threshold={threshold}
        onThresholdChange={setThreshold}
      />

      {/* 4. SENSITIVITY TRADE STUDY PANEL */}
      <SensitivityPanel
        mastSensitivities={siteData.sensitivities?.mast_height}
        resolutionSensitivity={siteData.sensitivities?.resolution}
        currentMastHeightM={mastHeightM}
        onSelectMastHeight={setMastHeightM}
      />

      {/* 5. COLLAPSIBLE LIMITATIONS PANEL */}
      <LimitationsPanel defaultExpanded={false} />
    </div>
  );
};
