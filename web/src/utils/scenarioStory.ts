import type { DepartureMapResult, RouteResult, VisibilityCube } from '../types';
import type { DecodedVisibilityCube } from './cubeDecoder';

export type InfeasibleCauseCategory =
  | 'start in shadow'
  | 'goal in shadow'
  | 'corridor shadow'
  | 'slope barrier'
  | 'deadline';

export interface RelaxationBannerContent {
  infeasibleSentence: string;
  suggestedRelaxationSentence: string;
  buttonLabel: string;
}

export interface ScenarioStoryResult {
  feasible: boolean;
  cause: InfeasibleCauseCategory | null;
  caption: string;
  relaxationBanner: RelaxationBannerContent | null;
  explanation: string;
}

export interface GenerateScenarioStoryParams {
  departureMap: DepartureMapResult | null;
  activeRoute: RouteResult | null;
  selectedDepIdx: number;
  startPoint: [number, number];
  endPoint: [number, number];
  speedMs: number;
  maxSlopeDeg: number;
  darkBudgetH: number;
  timeStep: number;
  cube: VisibilityCube | DecodedVisibilityCube;
}

/**
 * Classifies the infeasibility reason into one of the 5 canonical cause categories:
 * - 'start in shadow'
 * - 'goal in shadow'
 * - 'corridor shadow'
 * - 'slope barrier'
 * - 'deadline'
 */
export function classifyInfeasibleCause(reason?: string | null): InfeasibleCauseCategory {
  if (!reason) return 'corridor shadow';
  const lower = reason.toLowerCase();
  if (
    lower.includes('start in shadow') ||
    (lower.includes('start') && (lower.includes('shadow') || lower.includes('sunlit') || lower.includes('illumination')))
  ) {
    return 'start in shadow';
  }
  if (
    lower.includes('goal in shadow') ||
    (lower.includes('destination') && (lower.includes('shadow') || lower.includes('sunlit') || lower.includes('dark'))) ||
    (lower.includes('goal') && (lower.includes('shadow') || lower.includes('sunlit') || lower.includes('dark')))
  ) {
    return 'goal in shadow';
  }
  if (
    lower.includes('slope barrier') ||
    lower.includes('slope') ||
    lower.includes('steep') ||
    lower.includes('barrier') ||
    lower.includes('traversab')
  ) {
    return 'slope barrier';
  }
  if (
    lower.includes('deadline') ||
    lower.includes('horizon') ||
    lower.includes('insufficient time') ||
    lower.includes('exhaust')
  ) {
    return 'deadline';
  }
  return 'corridor shadow';
}

/**
 * Generates every sentence of the Scenario Story, relaxation banner, and route explanation
 * dynamically from the solver's infeasible_reason and departure map fields.
 * No fixed cause text.
 */
export function generateScenarioStory(params: GenerateScenarioStoryParams): ScenarioStoryResult {
  const {
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
  } = params;

  const dep = departureMap?.departures?.[selectedDepIdx];
  const cubeTimeUtc = 'time_utc' in cube ? (cube as VisibilityCube).time_utc : undefined;
  const depUtc = dep?.departure_utc || cubeTimeUtc?.[selectedDepIdx] || '00:00:00Z';
  const depTimeStr = depUtc.includes('T') ? depUtc.slice(11, 19) : depUtc;
  const isFeasible = activeRoute?.feasible ?? (dep?.feasible ?? false);

  const speedMh = Math.round(speedMs * 3600);
  const traverseDistM = activeRoute?.metrics?.total_distance_m ?? 0;
  const traverseDurationH = activeRoute?.metrics?.duration_h ?? 0;
  const darkExposureH = activeRoute?.metrics?.dark_exposure_h ?? 0;
  const maxSlopeTraversed = activeRoute?.metrics?.max_slope_deg ?? 0;
  const goalSunFrac = 'getSunFrac' in cube
    ? cube.getSunFrac(timeStep, endPoint[1], endPoint[0])
    : (('sun_frac' in cube && cube.sun_frac?.[timeStep]?.[endPoint[1]]?.[endPoint[0]]) ?? 0);

  if (isFeasible) {
    return {
      feasible: true,
      cause: null,
      caption: `Leaving at T=${selectedDepIdx} (${depTimeStr}Z) works! The illuminated corridor remains open and the rover safely reaches Destination B in ${traverseDurationH} h without exceeding darkness (${darkBudgetH} h) or slope (${maxSlopeDeg}°) limits.`,
      relaxationBanner: null,
      explanation: `The planned traverse from Point A [${startPoint.join(', ')}] to Point B [${endPoint.join(', ')}] is feasible. The rover travels a ground distance of ${traverseDistM} meters in ${traverseDurationH} hours at a speed of ${speedMs} m/s (${speedMh} m/h). During this window, the rover encounters ${darkExposureH.toFixed(1)} hours of darkness, which does not exceed the allowable limit of ${darkBudgetH} hours. The maximum terrain slope traversed is ${maxSlopeTraversed.toFixed(1)}°, staying safely below the vehicle limit of ${maxSlopeDeg}°. Destination solar illumination at arrival is ${goalSunFrac}%.`,
    };
  }

  // Route is infeasible
  const rawReason = dep?.infeasible_reason || activeRoute?.explanation || 'corridor shadow: Moving lunar shadows obstruct the corridor.';
  const cause = classifyInfeasibleCause(rawReason);

  // Clean detail message from raw reason
  let reasonDetail = rawReason;
  const colonIdx = rawReason.indexOf(':');
  if (colonIdx > 0 && colonIdx < 25) {
    reasonDetail = rawReason.slice(colonIdx + 1).trim();
  }

  const hasAlternative = departureMap?.earliest_feasible_idx !== null && departureMap?.earliest_feasible_idx !== undefined;
  const altIdx = departureMap?.earliest_feasible_idx ?? null;
  const altUtc = departureMap?.earliest_feasible_utc ?? null;
  const altTimeStr = altUtc && altUtc.includes('T') ? altUtc.slice(11, 19) : (altIdx !== null ? `Step ${altIdx}` : '');

  // Build cause-specific text
  let causeNameText: InfeasibleCauseCategory;
  let causeSpecificAdvice = '';

  switch (cause) {
    case 'start in shadow':
      causeNameText = 'start in shadow';
      causeSpecificAdvice = hasAlternative
        ? `Wait until ${altUtc} (Step ${altIdx}) when the start site rotates into solar illumination.`
        : `Start location remains in shadow across the evaluation window; wait for solar elevation to rise at Point A [${startPoint.join(', ')}].`;
      break;

    case 'goal in shadow':
      causeNameText = 'goal in shadow';
      causeSpecificAdvice = hasAlternative
        ? `Wait until ${altUtc} (Step ${altIdx}) when the destination receives sunlight upon arrival.`
        : `Destination Point B [${endPoint.join(', ')}] remains in shadow for all reachable arrival times; choose an illuminated waypoint or wait for local sunrise.`;
      break;

    case 'slope barrier':
      causeNameText = 'slope barrier';
      causeSpecificAdvice = `Terrain slopes exceed the maximum limit of ${maxSlopeDeg}°. Relax the vehicle slope threshold or add intermediate route waypoints around steep terrain.`;
      break;

    case 'deadline':
      causeNameText = 'deadline';
      causeSpecificAdvice = `The time remaining before the analysis horizon is shorter than the minimum geometric transit time. Increase rover speed above ${speedMh} m/h (${speedMs} m/s) or extend the planning horizon.`;
      break;

    case 'corridor shadow':
    default:
      causeNameText = 'corridor shadow';
      causeSpecificAdvice = hasAlternative
        ? `Wait until ${altUtc} (Step ${altIdx}) for the illuminated corridor to open across the ridge. Alternatively, increase dark budget above ${darkBudgetH} h.`
        : `Moving lunar shadows obstruct the corridor across this window; increase allowable dark budget above ${darkBudgetH} h or increase rover speed above ${speedMh} m/h.`;
      break;
  }

  // 1. Scenario Story Caption
  const captionAlternative = hasAlternative
    ? `Leaving at the suggested time (${altTimeStr}Z) works!`
    : `No feasible departure window found across the evaluated timeline.`;
  const caption = `Leaving now (T=${selectedDepIdx}) is blocked by ${causeNameText}: ${reasonDetail}. ${captionAlternative}`;

  // 2. Relaxation Banner
  const relaxationBanner: RelaxationBannerContent = {
    infeasibleSentence: `Departure at T=${selectedDepIdx} (${depTimeStr}Z) is infeasible due to ${causeNameText}: ${reasonDetail}.`,
    suggestedRelaxationSentence: `💡 Suggested Relaxation: ${causeSpecificAdvice}`,
    buttonLabel: hasAlternative
      ? `Apply Suggested Relaxation: Depart at Step ${altIdx} (${altTimeStr}Z) →`
      : 'No Alternative Feasible Departure',
  };

  // 3. Route Explanation Panel
  const explanationAlternative = hasAlternative
    ? `Suggested relaxation: depart at ${altUtc || 'Step ' + altIdx} when conditions permit safe traversal.`
    : `Suggested relaxation: ${causeSpecificAdvice}`;
  const explanation = `The planned traverse from Point A [${startPoint.join(', ')}] to Point B [${endPoint.join(', ')}] is infeasible due to ${causeNameText}: leaving at Step ${selectedDepIdx} (${depTimeStr}Z) is blocked (${reasonDetail}). ${explanationAlternative}`;

  return {
    feasible: false,
    cause,
    caption,
    relaxationBanner,
    explanation,
  };
}
