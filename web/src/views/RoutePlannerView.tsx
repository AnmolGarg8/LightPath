import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { Slider } from '../components/ui/Slider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { fetchBinaryCube, fetchJsonData } from '../utils/dataLoader';
import { DecodedVisibilityCube } from '../utils/cubeDecoder';
import {
  VisibilityCubeHeaderSchema,
  VisibilityCubeHeader,
  SiteSummarySchema,
  SiteSummary,
  StatsSchema,
  Stats,
} from '../types/schemas';
import { ValidationErrorPage } from '../components/ui/ValidationErrorPage';
import { DepartureWindowMap } from '../components/DepartureWindowMap';
import { MissionPlanner } from '../components/MissionPlanner';
import { RobustnessPanel } from '../components/RobustnessPanel';
import {
  runConservativeComparisonWorker,
  runDepartureMapWorker,
  runLandingDispersionWorker,
  runMissionPlanWorker,
} from '../workers/routeWorkerClient';
import {
  ConservativeComparisonResult,
  DepartureMapResult,
  LandingDispersionPoint,
  LandingDispersionResult,
  MissionPlanResult,
  MissionStop,
  RouteResult,
  Scenario,
  VisibilityCube,
} from '../types';
import { Share2, Download, Upload, FileText, ArrowRightLeft } from 'lucide-react';
import { RouteEvidenceCard } from '../components/RouteEvidenceCard';
import {
  buildRouteEvidenceData,
  encodeScenarioHash,
  exportScenarioJson,
  importScenarioJson,
  isHashTooLong,
} from '../utils/scenarioCodec';
import { generateScenarioStory } from '../utils/scenarioStory';
import { AssumptionsPanel } from '../components/AssumptionsPanel';
import { RelatedWorkPanel } from '../components/RelatedWorkPanel';
import { LimitationsPanel } from '../components/common/LimitationsPanel';

interface RoutePlannerViewProps {
  siteId: string;
  initialScenario?: Scenario | null;
}

type LayerMode = 'sun' | 'earth' | 'slope' | 'traversability';

export const RoutePlannerView: React.FC<RoutePlannerViewProps> = ({ siteId, initialScenario = null }) => {
  const [header, setHeader] = useState<VisibilityCubeHeader | null>(null);
  const [cube, setCube] = useState<DecodedVisibilityCube | null>(null);
  const [siteMeta, setSiteMeta] = useState<SiteSummary | null>(null);
  const [siteStats, setSiteStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [timeStep, setTimeStep] = useState<number>(0);
  const [mode, setMode] = useState<LayerMode>('sun');

  // Planner Mode: Single Traverse vs Multi-Stop Mission Plan
  const [plannerMode, setPlannerMode] = useState<'single' | 'mission'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('planner=mission')) {
      return 'mission';
    }
    return 'single';
  });

  // Waypoints for traverse from A to B
  const [startPoint, setStartPoint] = useState<[number, number]>(() => initialScenario?.start_coord || [3, 3]);
  const [endPoint, setEndPoint] = useState<[number, number]>(() => initialScenario?.goal_coord || [20, 20]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  // Active space-time route and departure window map
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [departureMap, setDepartureMap] = useState<DepartureMapResult | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedDepIdx, setSelectedDepIdx] = useState<number>(0);

  // Reproducibility, Evidence Card, & Sharing State
  const [showEvidenceCard, setShowEvidenceCard] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [scenarioWarning, setScenarioWarning] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Onboarding Hint (appears once, dismissible)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('lightpath_onboarding_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('lightpath_onboarding_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // Terrain uncertainty & Landing dispersion robustness
  const [conservativeComparison, setConservativeComparison] = useState<ConservativeComparisonResult | null>(null);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [dispersionResult, setDispersionResult] = useState<LandingDispersionResult | null>(null);
  const [dispersionLoading, setDispersionLoading] = useState<boolean>(false);
  const [dispersionRadiusM, setDispersionRadiusM] = useState<number>(250);
  const [dispersionNumPoints, setDispersionNumPoints] = useState<number>(25);
  const [selectedDispersionPt, setSelectedDispersionPt] = useState<LandingDispersionPoint | null>(null);

  // Multi-stop mission plan state (up to 5 stops)
  const [stops, setStops] = useState<MissionStop[]>([
    {
      stop_id: 'station_1',
      name: 'Station 1 - PSR Rim',
      coord: [10, 10],
      dwell_time_h: 1.5,
      min_sun_frac: 0.5,
      min_earth_duration_h: 1.0,
    },
    {
      stop_id: 'station_2',
      name: 'Station 2 - Solar Peak',
      coord: [20, 20],
      dwell_time_h: 2.0,
      min_sun_frac: 0.5,
    },
  ]);
  const [missionPlan, setMissionPlan] = useState<MissionPlanResult | null>(null);
  const [missionLoading, setMissionLoading] = useState<boolean>(false);

  // Solver parameters
  const [speedMs, setSpeedMs] = useState<number>(() => initialScenario?.speed_m_s ?? 0.05); // 0.05 m/s = 180 m/h
  const [maxSlopeDeg, setMaxSlopeDeg] = useState<number>(() => initialScenario?.max_slope_deg ?? 15.0);
  const [darkBudgetH, setDarkBudgetH] = useState<number>(0.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Fetch visibility cube JSON header, compressed binary, and site metadata
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJsonData(`./data/cubes/${siteId}.json`, VisibilityCubeHeaderSchema),
      fetchBinaryCube(`./data/cubes/${siteId}.bin`),
      fetchJsonData<SiteSummary>(`./data/sites/${siteId}.json`, SiteSummarySchema)
        .catch(() => fetchJsonData<SiteSummary>(`./data/${siteId}/site.json`, SiteSummarySchema))
        .catch(() => null),
      fetchJsonData<Stats>(`./data/${siteId}/stats.json`, StatsSchema)
        .catch(() => null),
    ])
      .then(([hdr, cb, meta, stats]) => {
        setHeader(hdr);
        setCube(cb);
        if (meta) setSiteMeta(meta);
        if (stats) setSiteStats(stats);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [siteId]);

  const activeMarginDeg = siteStats?.thresholds?.margin_deg ?? 0.03;

  // 2. Compute Departure Window Map and Active Route whenever parameters or endpoints change
  useEffect(() => {
    if (!header) return;

    let cancelled = false;
    setMapLoading(true);

    const cubePayload: VisibilityCube = {
      grid: header.grid,
      time_utc: header.time_utc,
      sun_frac: header.sun_frac,
      earth_frac: header.earth_frac,
      slope_deg: header.slope_deg,
      traversable: header.traversable,
      flags: header.flags,
    };

    // Run Departure Window Map worker across active departure horizon
    const maxDep = Math.min(cubePayload.time_utc.length - 1, 96);
    runDepartureMapWorker(cubePayload, startPoint, endPoint, {
      speed_m_s: speedMs,
      max_slope_deg: maxSlopeDeg,
      dark_budget_h: darkBudgetH,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      max_departure_idx: maxDep,
    })
      .then((depMap) => {
        if (cancelled) return;
        setDepartureMap(depMap);
        setMapLoading(false);

        // Initial selected departure: start at Step 0 (departure now)
        const chosenDepIdx = 0;
        setSelectedDepIdx(chosenDepIdx);
        setTimeStep(chosenDepIdx);

        // Load route for the chosen departure
        const depEntry = depMap.departures[chosenDepIdx];
        if (depEntry && depEntry.feasible && depEntry.path) {
          setCompLoading(true);
          runConservativeComparisonWorker(cubePayload, startPoint, endPoint, {
            startTimeIdx: chosenDepIdx,
            speed_m_s: speedMs,
            max_slope_deg: maxSlopeDeg,
            dark_budget_h: darkBudgetH,
            horizon_margin_deg: activeMarginDeg,
          })
            .then((comp) => {
              if (!cancelled) {
                setConservativeComparison(comp);
                setActiveRoute(comp.nominal);
                setCompLoading(false);
              }
            })
            .catch(() => {
              if (!cancelled) setCompLoading(false);
            });
        } else if (depEntry) {
          setActiveRoute({
            mode: 'rover',
            params: {
              start_coord: startPoint,
              end_coord: endPoint,
              start_time_idx: chosenDepIdx,
              speed_m_s: speedMs,
              max_slope_deg: maxSlopeDeg,
              min_sun_frac: 0.5,
              min_earth_frac: 0.5,
            },
            feasible: false,
            path: [],
            explanation: depEntry.infeasible_reason || 'Departure at this timestep is blocked by shadow or slope.',
            metrics: {
              total_distance_m: 0,
              duration_h: 0,
              average_slope_deg: 0,
              max_slope_deg: 0,
              min_sun_frac_observed: 0,
              min_earth_frac_observed: 0,
            },
            alternatives: [],
          });
          setConservativeComparison(null);
        } else {
          setActiveRoute(null);
          setConservativeComparison(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Departure map worker error:', err);
          setMapLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [header, startPoint, endPoint, speedMs, maxSlopeDeg, darkBudgetH]);

  // 3. Handle user clicking a specific departure step in DepartureWindowMap
  const handleSelectDeparture = (depIdx: number) => {
    setSelectedDepIdx(depIdx);
    setTimeStep(depIdx);

    if (!header) return;
    const cubePayload: VisibilityCube = {
      grid: header.grid,
      time_utc: header.time_utc,
      sun_frac: header.sun_frac,
      earth_frac: header.earth_frac,
      slope_deg: header.slope_deg,
      traversable: header.traversable,
      flags: header.flags,
    };

    setCompLoading(true);
    runConservativeComparisonWorker(cubePayload, startPoint, endPoint, {
      startTimeIdx: depIdx,
      speed_m_s: speedMs,
      max_slope_deg: maxSlopeDeg,
      dark_budget_h: darkBudgetH,
      horizon_margin_deg: activeMarginDeg,
    })
      .then((comp) => {
        setConservativeComparison(comp);
        setActiveRoute(comp.nominal);
        setCompLoading(false);
      })
      .catch((err) => {
        console.error('Route solve error:', err);
        setCompLoading(false);
      });
  };

  const handleRunDispersion = () => {
    if (!header) return;
    setDispersionLoading(true);
    const cubePayload: VisibilityCube = {
      grid: header.grid,
      time_utc: header.time_utc,
      sun_frac: header.sun_frac,
      earth_frac: header.earth_frac,
      slope_deg: header.slope_deg,
      traversable: header.traversable,
      flags: header.flags,
    };

    runLandingDispersionWorker(cubePayload, startPoint, endPoint, {
      radius_m: dispersionRadiusM,
      num_points: dispersionNumPoints,
      startTimeIdx: selectedDepIdx,
      speed_m_s: speedMs,
      max_slope_deg: maxSlopeDeg,
      dark_budget_h: darkBudgetH,
      horizon_margin_deg: activeMarginDeg,
    })
      .then((res) => {
        setDispersionResult(res);
        setDispersionLoading(false);
      })
      .catch((err) => {
        console.error('Landing dispersion worker error:', err);
        setDispersionLoading(false);
      });
  };

  // Auto-run dispersion if requested in URL hash (e.g. for headless screenshots)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.hash.includes('auto=dispersion') &&
      header &&
      !dispersionResult &&
      !dispersionLoading
    ) {
      handleRunDispersion();
    }
  }, [header]);

  // Auto-open Route Evidence Card if requested in URL hash (e.g. for headless screenshots)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('evidence=1') && activeRoute) {
      setShowEvidenceCard(true);
    }
  }, [activeRoute]);

  // 3b. Compute Multi-Stop Mission Plan whenever stops or solver parameters change
  useEffect(() => {
    if (!header || !cube) return;
    let cancelled = false;
    setMissionLoading(true);

    const cubePayload: VisibilityCube = {
      grid: header.grid,
      time_utc: header.time_utc,
      sun_frac: header.sun_frac,
      earth_frac: header.earth_frac,
      slope_deg: header.slope_deg,
      traversable: header.traversable,
      flags: header.flags,
    };

    runMissionPlanWorker(cubePayload, startPoint, selectedDepIdx, stops, {
      speed_m_s: speedMs,
      max_slope_deg: maxSlopeDeg,
      dark_budget_h: darkBudgetH,
      allow_wait: true,
      mission_name: `${siteId || 'Lunar'} Sortie Plan`,
    })
      .then((res) => {
        if (!cancelled) {
          setMissionPlan(res);
          setMissionLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Mission planner worker error:', err);
          setMissionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [header, cube, startPoint, selectedDepIdx, stops, speedMs, maxSlopeDeg, darkBudgetH]);

  const handleApplyFix = (patch: Record<string, unknown>) => {
    if (patch.new_stop_order && Array.isArray(patch.new_stop_order)) {
      const orderIds = patch.new_stop_order as string[];
      const reordered: MissionStop[] = [];
      for (const id of orderIds) {
        const found = stops.find((s) => s.stop_id === id);
        if (found) reordered.push(found);
      }
      for (const s of stops) {
        if (!reordered.some((r) => r.stop_id === s.stop_id)) reordered.push(s);
      }
      setStops(reordered);
    } else if (patch.start_time_idx !== undefined) {
      setSelectedDepIdx(patch.start_time_idx as number);
      setTimeStep(patch.start_time_idx as number);
    } else if (patch.stop_index !== undefined && patch.new_dwell_time_h !== undefined) {
      const sIdx = patch.stop_index as number;
      const updated = stops.map((s, idx) =>
        idx === sIdx ? { ...s, dwell_time_h: patch.new_dwell_time_h as number } : s
      );
      setStops(updated);
    }
  };

  // 4. Render 2D Traversability & Visibility Grid with Route Waypoints
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nx = cube.nx;
    const ny = cube.ny;
    const cellW = canvas.width / nx;
    const cellH = canvas.height / ny;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (mode === 'sun') {
          const val = cube.getSunFrac(timeStep, r, c);
          ctx.fillStyle = `rgb(${Math.round(val * 2.45)}, ${Math.round(val * 1.58)}, ${Math.round(val * 0.11)})`;
        } else if (mode === 'earth') {
          const val = cube.getEarthFrac(timeStep, r, c);
          ctx.fillStyle = `rgb(${Math.round(val * 0.06)}, ${Math.round(val * 1.82)}, ${Math.round(val * 2.48)})`;
        } else if (mode === 'slope') {
          const s = cube.getSlopeDeg(r, c);
          const norm = Math.min(1.0, s / 30.0);
          ctx.fillStyle = `rgb(${Math.round(norm * 240)}, ${Math.round((1 - norm) * 200)}, 40)`;
        } else {
          const trav = cube.isTraversable(r, c);
          ctx.fillStyle = trav ? '#059669' : '#dc2626';
        }

        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      }
    }

    // Draw planned space-time route if available
    if (plannerMode === 'mission' && missionPlan) {
      // Draw Multi-Stop Mission Plan legs
      missionPlan.legs.forEach((leg, lIdx) => {
        if (!leg.feasible || leg.path.length < 2) return;
        ctx.strokeStyle = lIdx % 2 === 0 ? '#38bdf8' : '#60a5fa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        leg.path.forEach((wp, wIdx) => {
          const px = (wp.x + 0.5) * cellW;
          const py = (wp.y + 0.5) * cellH;
          if (wIdx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        leg.path.forEach((wp) => {
          const px = (wp.x + 0.5) * cellW;
          const py = (wp.y + 0.5) * cellH;
          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Start Marker (Base Lander)
      const sx = (startPoint[0] + 0.5) * cellW;
      const sy = (startPoint[1] + 0.5) * cellH;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Stops Markers (1..5)
      stops.forEach((st, sIdx) => {
        const px = (st.coord[0] + 0.5) * cellW;
        const py = (st.coord[1] + 0.5) * cellH;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${sIdx + 1}`, px, py);
      });
    } else if (activeRoute && activeRoute.feasible && activeRoute.path.length > 1) {
      // 1. Conservative Route (if feasible, rendered in dashed amber beside nominal route)
      if (
        conservativeComparison?.conservative?.feasible &&
        conservativeComparison.conservative.path.length > 1
      ) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        conservativeComparison.conservative.path.forEach((wp, idx) => {
          const px = (wp.x + 0.5) * cellW;
          const py = (wp.y + 0.5) * cellH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Nominal Route (rendered in solid cyan)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      activeRoute.path.forEach((wp, idx) => {
        const px = (wp.x + 0.5) * cellW;
        const py = (wp.y + 0.5) * cellH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Waypoint dots
      activeRoute.path.forEach((wp) => {
        const px = (wp.x + 0.5) * cellW;
        const py = (wp.y + 0.5) * cellH;
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Smooth & Honest Rover Marker: tracks rover location as time slider is dragged
      let activeRoverPos = activeRoute.path[0];
      for (const wp of activeRoute.path) {
        if (wp.t <= timeStep) {
          activeRoverPos = wp;
        } else {
          break;
        }
      }

      if (activeRoverPos) {
        const rx = (activeRoverPos.x + 0.5) * cellW;
        const ry = (activeRoverPos.y + 0.5) * cellH;

        // Outer beacon glow
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Rover chassis core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Crosshair wheels/solar panels
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx - 7, ry);
        ctx.lineTo(rx + 7, ry);
        ctx.moveTo(rx, ry - 7);
        ctx.lineTo(rx, ry + 7);
        ctx.stroke();
      }
    } else if (startPoint && endPoint) {
      // Fallback straight dashed guide line
      const sx = (startPoint[0] + 0.5) * cellW;
      const sy = (startPoint[1] + 0.5) * cellH;
      const ex = (endPoint[0] + 0.5) * cellW;
      const ey = (endPoint[1] + 0.5) * cellH;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (plannerMode === 'single') {
      // Landing Dispersion Overlay (if computed)
      if (dispersionResult && header) {
        const spacingM = header.grid.spacing_m;
        const radiusCells = dispersionRadiusM / spacingM;
        const cx = (startPoint[0] + 0.5) * cellW;
        const cy = (startPoint[1] + 0.5) * cellH;

        // Dispersion boundary circle
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, radiusCells * cellW, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sample points
        dispersionResult.points.forEach((pt) => {
          const px = (pt.coord[0] + 0.5) * cellW;
          const py = (pt.coord[1] + 0.5) * cellH;
          const isSelected = selectedDispersionPt?.point_id === pt.point_id;

          ctx.fillStyle = pt.feasible ? '#10b981' : '#ef4444';
          ctx.beginPath();
          ctx.arc(px, py, isSelected ? 5.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Start Marker (A)
      const sx = (startPoint[0] + 0.5) * cellW;
      const sy = (startPoint[1] + 0.5) * cellH;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // End Marker (B)
      const ex = (endPoint[0] + 0.5) * cellW;
      const ey = (endPoint[1] + 0.5) * cellH;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(ex, ey, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [
    cube,
    timeStep,
    mode,
    startPoint,
    endPoint,
    activeRoute,
    plannerMode,
    missionPlan,
    stops,
    conservativeComparison,
    dispersionResult,
    selectedDispersionPt,
    dispersionRadiusM,
    header,
  ]);

  if (error) {
    return <ValidationErrorPage error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading || !cube || !header) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading binary visibility cube ({siteId}.bin)...
      </div>
    );
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * cube.nx);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * cube.ny);

    if (x >= 0 && x < cube.nx && y >= 0 && y < cube.ny) {
      if (Math.abs(x - startPoint[0]) + Math.abs(y - startPoint[1]) < 3) {
        setStartPoint([x, y]);
      } else {
        setEndPoint([x, y]);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cube) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * cube.nx);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * cube.ny);
    if (x >= 0 && x < cube.nx && y >= 0 && y < cube.ny) {
      setHoverCell({ x, y });
    }
  };

  const traverseDistM = activeRoute?.metrics?.total_distance_m ?? Math.round(
    Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]) * header.grid.spacing_m
  );
  const traverseDurationH = activeRoute?.metrics?.duration_h ?? (traverseDistM / (speedMs * 3600)).toFixed(1);

  const getCurrentScenario = (): Scenario => ({
    version: 'v1',
    site_id: siteId,
    start_date: header?.time_utc?.[0]?.split('T')[0] || '2026-11-01',
    end_date: header?.time_utc?.[header.time_utc.length - 1]?.split('T')[0] || '2026-11-08',
    min_sun_frac: 0.5,
    min_earth_frac: 0.5,
    mast_height_m: 2.0,
    speed_m_s: speedMs,
    max_slope_deg: maxSlopeDeg,
    allow_wait: true,
    mode: 'earliest-arrival',
    conservative: false,
    horizon_margin_deg: 0.0,
    start_coord: startPoint,
    goal_coord: endPoint,
    data_version_hash: '9f8e21a0',
  });

  const handleShareScenario = () => {
    const scen = getCurrentScenario();
    const slug = encodeScenarioHash(scen);
    if (isHashTooLong(slug)) {
      alert('Scenario parameters exceed URL length budget (220 characters). Please download the scenario file (.json) instead.');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#/scenario/${slug}`;
    navigator.clipboard.writeText(url);
    setShareNotice('Reproducible link copied to clipboard! (Plain letters, digits, and hyphens only)');
    setTimeout(() => setShareNotice(null), 4000);
  };

  const handleExportScenario = () => {
    const scen = getCurrentScenario();
    const jsonStr = exportScenarioJson(scen, '9f8e21a0', `Traverse ${siteId}`);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario-${siteId}-${startPoint.join('-')}-to-${endPoint.join('-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { scenario, warning, error: parseError } = importScenarioJson(content, '9f8e21a0');
      if (parseError) {
        alert(parseError);
        return;
      }
      if (scenario) {
        setStartPoint(scenario.start_coord);
        setEndPoint(scenario.goal_coord);
        setSpeedMs(scenario.speed_m_s);
        setMaxSlopeDeg(scenario.max_slope_deg);
        if (warning) {
          setScenarioWarning(warning);
        } else {
          setScenarioWarning(null);
        }
      }
    };
    reader.readAsText(file);
  };

  const resolvedSiteName = siteMeta?.name || siteId;

  const resolvedSiteCoords = {
    lat_deg: siteMeta?.lat_deg ?? header?.grid.origin[1] ?? -89.9,
    lon_deg: siteMeta?.lon_deg ?? header?.grid.origin[0] ?? 0.0,
    ground_elev_m: siteMeta?.ground_elev_m ?? 0.0,
  };

  const evidenceData = activeRoute
    ? buildRouteEvidenceData(
        getCurrentScenario(),
        activeRoute,
        resolvedSiteName,
        resolvedSiteCoords,
        conservativeComparison?.cost_of_caution
          ? {
              extra_distance_m: conservativeComparison.cost_of_caution.extra_distance_m,
              extra_duration_h: conservativeComparison.cost_of_caution.extra_duration_h,
            }
          : undefined,
        departureMap
          ? {
              earliest_utc: departureMap.earliest_feasible_utc || undefined,
              latest_safe_utc: departureMap.latest_safe_utc || undefined,
            }
          : undefined
      )
    : null;

  const scenarioStory = cube
    ? generateScenarioStory({
        departureMap,
        activeRoute,
        selectedDepIdx,
        startPoint,
        endPoint,
        speedMs,
        maxSlopeDeg,
        darkBudgetH,
        timeStep,
        cube,
      })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
          <Badge variant="joint" label="SPATIO-TEMPORAL ROUTE PLANNER" />
          <Badge variant="neutral" label="DYNAMIC SOLAR ILLUMINATION" />
          {mapLoading && (
            <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', marginLeft: '0.5rem' }}>
              ⚡ Updating departure map...
            </span>
          )}
        </div>
        <h1>Rover & Crew Traverse Planner</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', marginBottom: '1rem' }}>
          Calculate dynamic traverse paths across moving polar shadows and compute full departure feasibility windows.
        </p>

        {/* Three-Step Onboarding Hint (appears once, dismissible) */}
        {showOnboarding && (
          <div
            data-testid="onboarding-hint"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-focus)',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🚀</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  How to Plan a Lunar Traverse (3 Steps)
                </strong>
              </div>
              <button
                onClick={handleDismissOnboarding}
                data-testid="dismiss-onboarding-btn"
                className="btn btn-outline touch-target-44"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                aria-label="Dismiss guide"
              >
                Dismiss [×]
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.825rem', marginBottom: '0.2rem' }}>
                  1. Set Start & Goal
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Click anywhere on the terrain map to place Goal Point B. Green marker A indicates the landing site.
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.825rem', marginBottom: '0.2rem' }}>
                  2. Press Solve
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Configure speed (0.05 m/s) and max slope (15°), then press Solve Traverse to compute the safest path.
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.825rem', marginBottom: '0.2rem' }}>
                  3. Drag the Time Slider
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Drag the timeline scrubber below to watch polar crater shadows sweep across the terrain and see the rover move.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scenario Version Warning */}
        {scenarioWarning && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef3c7',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '4px',
              fontSize: '0.85rem',
              color: '#92400e',
              marginBottom: '0.75rem',
            }}
          >
            <strong>Version Warning:</strong> {scenarioWarning}
          </div>
        )}

        {/* Share Link Notification Toast */}
        {shareNotice && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderLeft: '4px solid #22c55e',
              borderRadius: '4px',
              fontSize: '0.85rem',
              color: '#16a34a',
              marginBottom: '0.75rem',
            }}
          >
            {shareNotice}
          </div>
        )}

        {/* Reproducibility & Sharing Action Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleShareScenario}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Share2 size={14} />
            Share Link (Plain Hash)
          </button>
          <button
            onClick={handleExportScenario}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Download size={14} />
            Export Scenario (.json)
          </button>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Upload size={14} />
            Import Scenario (.json)
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </label>
          {activeRoute && (
            <button
              onClick={() => setShowEvidenceCard(true)}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.82rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <FileText size={14} />
              Route Evidence Card (1-Page Print)
            </button>
          )}
          <a
            href="#/compare-scenarios"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'var(--accent-primary)',
              fontWeight: 600,
            }}
          >
            <ArrowRightLeft size={14} />
            Compare Scenarios &rarr;
          </a>
        </div>
      </div>

      {/* Route Evidence Card Printable Modal */}
      {showEvidenceCard && evidenceData && (
        <div
          className="route-evidence-modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            overflowY: 'auto',
          }}
        >
          <div className="route-evidence-modal-content" style={{ maxHeight: '95vh', overflowY: 'auto', width: '100%', maxWidth: '960px' }}>
            <RouteEvidenceCard
              data={evidenceData}
              onClose={() => setShowEvidenceCard(false)}
            />
          </div>
        </div>
      )}

      {/* Scenario Story Caption */}
      <div
        data-testid="route-story-caption"
        style={{
          backgroundColor: activeRoute?.feasible ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderLeft: activeRoute?.feasible ? '4px solid #22c55e' : '4px solid #ef4444',
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: 'var(--text-primary)',
        }}
      >
        <strong style={{ color: activeRoute?.feasible ? '#22c55e' : '#f87171' }}>
          Scenario Story:
        </strong>{' '}
        {scenarioStory?.caption}
      </div>

      {/* Departure Feasibility & Suggested Relaxation Banner */}
      {departureMap && !departureMap.departures[selectedDepIdx]?.feasible && scenarioStory?.relaxationBanner && (
        <div
          data-testid="departure-relaxation-banner"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 700, fontSize: '0.95rem' }}>
            <span>⚠️</span>
            <span>{scenarioStory.relaxationBanner.infeasibleSentence}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {scenarioStory.relaxationBanner.suggestedRelaxationSentence}
          </div>
          {departureMap.earliest_feasible_idx !== null && (
            <div style={{ marginTop: '0.25rem' }}>
              <button
                className="btn btn-sm btn-primary"
                data-testid="apply-relaxation-btn"
                onClick={() => handleSelectDeparture(departureMap.earliest_feasible_idx!)}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
              >
                {scenarioStory.relaxationBanner.buttonLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Departure Window Map (Positioned above canvas so it is visible without scrolling) */}
      {plannerMode === 'single' && departureMap && (
        <div className="light-budget-strip-container" style={{ marginBottom: '1rem' }}>
          <DepartureWindowMap
            data={departureMap}
            selectedDepartureIdx={selectedDepIdx}
            onSelectDeparture={handleSelectDeparture}
          />
        </div>
      )}

      {/* Traverse Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Stat
          label="Traverse Distance"
          value={traverseDistM}
          unit="meters"
          variant="neutral"
          description={`From Point A [${startPoint.join(',')}] to Point B [${endPoint.join(',')}].`}
        />
        <Stat
          label="Traverse Duration"
          value={traverseDurationH}
          unit="hours"
          variant="sun"
          description={`At ${(speedMs * 3600).toFixed(0)} m/h (${speedMs} m/s) nominal surface speed.`}
        />
        <Stat
          label="Corridor Feasibility"
          value={activeRoute ? (activeRoute.feasible ? 'FEASIBLE' : 'INFEASIBLE') : 'COMPUTING...'}
          variant={activeRoute?.feasible ? 'success' : 'alert'}
          description={
            activeRoute
              ? activeRoute.feasible
                ? 'Valid route: rover reaches destination before dark within slope limits.'
                : (activeRoute.explanation || 'No route found: darkness limit or slope threshold exceeded. Try increasing speed or slope limit.')
              : 'Solving space-time A* route...'
          }
        />
        <Stat
          label="Destination Sunlight"
          value={`${cube.getSunFrac(timeStep, endPoint[1], endPoint[0])}%`}
          unit="sunlit"
          variant="joint"
          description="Solar fraction at Point B at scrubbed time."
        />
      </div>

      {/* Explain this route Button and Panel */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          data-testid="explain-route-btn"
          onClick={() => setShowExplanation(!showExplanation)}
          className="btn btn-outline touch-target-44"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.95rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <span>ℹ️ {showExplanation ? 'Hide route explanation' : 'Explain this route'}</span>
        </button>
      </div>

      {showExplanation && (
        <div
          data-testid="route-explanation-panel"
          style={{
            backgroundColor: 'var(--bg-secondary, #0f172a)',
            border: '1px solid var(--border-color)',
            borderLeft: activeRoute?.feasible ? '4px solid #22c55e' : '4px solid #ef4444',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                margin: 0,
                color: activeRoute?.feasible ? '#22c55e' : '#ef4444',
              }}
            >
              Route Solver Explanation: {activeRoute?.feasible ? 'FEASIBLE ROUTE' : 'INFEASIBLE ROUTE'}
            </h3>
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
              Step {selectedDepIdx} ({departureMap?.departures[selectedDepIdx]?.departure_utc?.slice(11, 19) || '00:00:00'}Z)
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
            {scenarioStory?.explanation}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.5rem',
              fontSize: '0.775rem',
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.5rem',
            }}
          >
            <div>• Distance: {activeRoute?.metrics?.total_distance_m ?? traverseDistM} m</div>
            <div>• Duration: {activeRoute?.metrics?.duration_h ?? traverseDurationH} h</div>
            <div>• Max Slope: {(activeRoute?.metrics?.max_slope_deg ?? 0).toFixed(1)}° (limit: {maxSlopeDeg}°)</div>
            <div>• Dark Exposure: {(activeRoute?.metrics?.dark_exposure_h ?? 0).toFixed(1)} h (limit: {darkBudgetH} h)</div>
          </div>
        </div>
      )}

      {/* Planner Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
        <SegmentedControl<'single' | 'mission'>
          value={plannerMode}
          onChange={setPlannerMode}
          size="md"
          options={[
            { value: 'single', label: 'Single Point-to-Point Traverse' },
            { value: 'mission', label: `Small Mission Plan (${stops.length} Stops)` },
          ]}
        />
        {plannerMode === 'mission' && missionLoading && (
          <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>
            ⚡ Solving multi-stop mission plan...
          </span>
        )}
      </div>

      {/* Main Interactive Canvas & Controls */}
      <Card
        title="Surface Visibility & Terrain Traversability Grid"
        subtitle={`Grid size: ${cube.nx} x ${cube.ny} cells (${cube.nx * cube.ny} total), cell spacing: ${header.grid.spacing_m}m.`}
        action={
          <SegmentedControl<LayerMode>
            value={mode}
            onChange={setMode}
            size="sm"
            options={[
              { value: 'sun', label: 'Sunlight Frac' },
              { value: 'earth', label: 'Earth Contact' },
              { value: 'slope', label: 'Slope (°)' },
              { value: 'traversability', label: 'Traversable' },
            ]}
          />
        }
      >
        <div className="planner-workspace-grid">
          <div>
            <canvas
              ref={canvasRef}
              width={500}
              height={500}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverCell(null)}
              aria-label="Interactive 2D lunar surface traversability grid"
              style={{
                width: '100%',
                maxWidth: '500px',
                aspectRatio: '1/1',
                borderRadius: '6px',
                border: '2px solid var(--border-color)',
                cursor: 'crosshair',
              }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Click map to set target Point B (Gold). Green dot is Start Point A. Solid cyan line is the optimal space-time traverse.
            </p>
          </div>

          {/* Readout side panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                CELL INSPECTION READOUT
              </span>
              {hoverCell ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 'var(--text-xs)' }}>
                  <div>Cell Coordinate: <strong className="mono">[{hoverCell.x}, {hoverCell.y}]</strong></div>
                  <div>Sun Fraction: <strong className="mono">{cube.getSunFrac(timeStep, hoverCell.y, hoverCell.x)}%</strong></div>
                  <div>Earth Fraction: <strong className="mono">{cube.getEarthFrac(timeStep, hoverCell.y, hoverCell.x)}%</strong></div>
                  <div>Slope: <strong className="mono">{cube.getSlopeDeg(hoverCell.y, hoverCell.x)}°</strong></div>
                  <div>
                    Traversable:{' '}
                    <strong style={{ color: cube.isTraversable(hoverCell.y, hoverCell.x) ? 'var(--color-visible)' : 'var(--color-blocked)' }}>
                      {cube.isTraversable(hoverCell.y, hoverCell.x) ? 'YES (Slope <= 15°)' : 'NO (Excessive Slope)'}
                    </strong>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Hover over any grid cell to view instantaneous elevation, slope, and solar disc fraction.
                </p>
              )}
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                SOLVER CONSTRAINTS
              </span>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: 'var(--text-xs)' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    Speed: <strong>{(speedMs * 3600).toFixed(0)} m/h</strong> ({speedMs} m/s)
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.20"
                    step="0.01"
                    value={speedMs}
                    onChange={(e) => setSpeedMs(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    Max Slope: <strong>{maxSlopeDeg}°</strong>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    step="1"
                    value={maxSlopeDeg}
                    onChange={(e) => setMaxSlopeDeg(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    Dark Budget: <strong>{darkBudgetH} h</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={darkBudgetH}
                    onChange={(e) => setDarkBudgetH(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Discretisation error bound: &lt; {header && header.time_utc.length >= 2 ? (((new Date(header.time_utc[1]).getTime() - new Date(header.time_utc[0]).getTime()) / 3600000)).toFixed(1) : '0.5'} h (&lt; 1 time step)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!header) return;
                    const cubePayload: VisibilityCube = {
                      grid: header.grid,
                      time_utc: header.time_utc,
                      sun_frac: header.sun_frac,
                      earth_frac: header.earth_frac,
                      slope_deg: header.slope_deg,
                      traversable: header.traversable,
                      flags: header.flags,
                    };
                    setCompLoading(true);
                    runConservativeComparisonWorker(cubePayload, startPoint, endPoint, {
                      startTimeIdx: selectedDepIdx,
                      speed_m_s: speedMs,
                      max_slope_deg: maxSlopeDeg,
                      dark_budget_h: darkBudgetH,
                      horizon_margin_deg: activeMarginDeg,
                    })
                      .then((comp) => {
                        setConservativeComparison(comp);
                        setActiveRoute(comp.nominal);
                        setCompLoading(false);
                      })
                      .catch((err) => {
                        console.error('Manual solve error:', err);
                        setCompLoading(false);
                      });
                  }}
                  className="btn btn-primary touch-target-44"
                  data-testid="solve-traverse-btn"
                  style={{ width: '100%', marginTop: '0.5rem', fontWeight: 700 }}
                >
                  {compLoading ? 'Solving...' : 'Solve Traverse (A*)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Time Scrub Slider wrapped in scrollable light-budget strip container */}
        <div className="light-budget-strip-container" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Slider
            label={`Timeline Step ${timeStep + 1} of ${cube.nt}: ${header.time_utc[timeStep] || ''}`}
            value={timeStep}
            min={0}
            max={cube.nt - 1}
            step={1}
            onChange={setTimeStep}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
            Scrub forward in time to watch the dynamic lunar shadow sweep across the terrain corridor. White ring denotes rover position at current step.
          </span>
        </div>
      </Card>

      {/* 5b. Terrain Uncertainty & Landing Dispersion Robustness Panel */}
      {plannerMode === 'single' && (
        <RobustnessPanel
          comparison={conservativeComparison}
          dispersion={dispersionResult}
          isLoadingComparison={compLoading}
          isLoadingDispersion={dispersionLoading}
          dispersionRadiusM={dispersionRadiusM}
          dispersionNumPoints={dispersionNumPoints}
          onUpdateDispersionParams={(r, n) => {
            setDispersionRadiusM(r);
            setDispersionNumPoints(n);
          }}
          onRunDispersion={handleRunDispersion}
          onSelectDispersionPoint={(pt) => {
            setSelectedDispersionPt(pt);
          }}
          selectedPointId={selectedDispersionPt?.point_id}
        />
      )}

      {plannerMode === 'mission' && (
        <MissionPlanner
          cube={{
            grid: header.grid,
            time_utc: header.time_utc,
            sun_frac: header.sun_frac,
            earth_frac: header.earth_frac,
            slope_deg: header.slope_deg,
            traversable: header.traversable,
            flags: header.flags,
          }}
          startPoint={startPoint}
          plan={missionPlan}
          stops={stops}
          onUpdateStops={setStops}
          onApplyFix={handleApplyFix}
          isLoading={missionLoading}
          onSelectTimeStep={(step) => {
            setSelectedDepIdx(step);
            setTimeStep(step);
          }}
        />
      )}

      {/* 6. Solver Parameters & Physical Assumptions Panel */}
      <AssumptionsPanel />

      {/* 7. Related Work & Prior Art Panel */}
      <RelatedWorkPanel />

      {/* 8. Operational Boundaries & Methodological Limitations Panel */}
      <LimitationsPanel defaultExpanded={false} />
    </div>
  );
};
