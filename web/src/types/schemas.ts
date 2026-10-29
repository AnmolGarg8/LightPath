/**
 * LightPath Zod Schemas & TypeScript Types
 * 
 * Maps 1:1 with JSON schemas in schemas/*.schema.json.
 * Enforces runtime contract validation at load time with detailed field-path diagnostics.
 */

import { z } from 'zod';

export const CategoryStatsSchema = z.object({
  uptime_fraction: z.number().min(0.0).max(1.0),
  total_uptime_h: z.number().min(0.0),
  windows: z.array(
    z.object({
      start_utc: z.string(),
      end_utc: z.string(),
      duration_h: z.number().min(0.0),
    })
  ),
  longest_window_h: z.number().min(0.0),
  longest_outage_h: z.number().min(0.0),
});

export type CategoryStats = z.infer<typeof CategoryStatsSchema>;

export const StatsThresholdsSchema = z.object({
  min_sun_frac: z.number().min(0.0).max(1.0),
  min_earth_frac: z.number().min(0.0).max(1.0),
  ground_station_mask_deg: z.number(),
});

export const StatsSchema = z.object({
  thresholds: StatsThresholdsSchema,
  sun: CategoryStatsSchema,
  earth: CategoryStatsSchema,
  dte: CategoryStatsSchema,
  joint: CategoryStatsSchema,
});

export type Stats = z.infer<typeof StatsSchema>;

export const MastHeightSensitivitySchema = z.object({
  mast_height_m: z.number(),
  sun_uptime_fraction: z.number(),
  earth_uptime_fraction: z.number(),
  dte_uptime_fraction: z.number(),
  joint_uptime_fraction: z.number(),
  longest_darkness_h: z.number(),
});

export type MastHeightSensitivity = z.infer<typeof MastHeightSensitivitySchema>;

export const ResolutionSensitivitySchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  comparison: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ResolutionSensitivity = z.infer<typeof ResolutionSensitivitySchema>;

export const SiteSummarySchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string(),
  mission_ids: z.array(z.string()),
  lat_deg: z.number().min(-90.0).max(90.0),
  lon_deg: z.number().min(-180.0).max(360.0),
  ground_elev_m: z.number(),
  source_links: z.array(z.string()),
  verified: z.boolean(),
  is_synthetic: z.boolean(),
});

export type SiteSummary = z.infer<typeof SiteSummarySchema>;

export const SiteFullSchema = SiteSummarySchema.extend({
  stats: StatsSchema.optional(),
  sensitivities: z
    .object({
      mast_height: z.array(MastHeightSensitivitySchema).optional(),
      resolution: ResolutionSensitivitySchema.optional(),
    })
    .optional(),
});

export type SiteFull = z.infer<typeof SiteFullSchema>;

export const MissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  operator: z.string(),
  site_id: z.string(),
  planned_window_start: z.string(),
  planned_window_end: z.string(),
  status: z.string(),
  description: z.string(),
  source_links: z.array(
    z.object({
      label: z.string(),
      url: z.string(),
    })
  ),
  verified: z.boolean(),
  is_synthetic: z.boolean().optional(),
  is_example: z.boolean().optional(),
});

export type Mission = z.infer<typeof MissionSchema>;

export const HorizonSchema = z.object({
  az_step_deg: z.number().positive().max(360.0),
  heights_m: z.array(z.number().min(0.0)).min(1),
  el_deg: z.array(z.array(z.number())),
  nan_fraction: z.array(z.array(z.number().min(0.0).max(1.0))),
  flags: z.array(z.string()),
});

export type Horizon = z.infer<typeof HorizonSchema>;

export const SeriesSchema = z.object({
  time_utc: z.array(z.string()),
  sun: z.object({
    az_deg: z.array(z.number()),
    el_deg: z.array(z.number()),
    radius_deg: z.array(z.number()),
    frac: z.array(z.number().min(0.0).max(1.0)),
    status: z.array(z.enum(['robust_visible', 'marginal', 'robust_blocked'])),
  }),
  earth: z.object({
    az_deg: z.array(z.number()),
    el_deg: z.array(z.number()),
    radius_deg: z.array(z.number()),
    frac: z.array(z.number().min(0.0).max(1.0)),
    status: z.array(z.enum(['robust_visible', 'marginal', 'robust_blocked'])),
    dist_km: z.array(z.number()),
  }),
  dte: z.object({
    station_names: z.array(z.string()).optional(),
    station_visible: z.array(z.array(z.boolean())),
    link_ok: z.array(z.boolean()),
  }),
});

export type Series = z.infer<typeof SeriesSchema>;

export const VisibilityCubeHeaderSchema = z.object({
  grid: z.object({
    origin: z.tuple([z.number(), z.number()]),
    spacing_m: z.number().positive(),
    nx: z.number().int().positive(),
    ny: z.number().int().positive(),
  }),
  time_utc: z.array(z.string()),
  sun_frac: z.array(z.array(z.array(z.number().int().min(0).max(100)))),
  earth_frac: z.array(z.array(z.array(z.number().int().min(0).max(100)))),
  slope_deg: z.array(z.array(z.number().min(0.0).max(90.0))),
  traversable: z.array(z.array(z.boolean())),
  flags: z.array(z.string()),
  cell_cap_explanation: z.string().optional(),
  runtime_seconds: z.number().optional(),
  binary_file: z.string().optional(),
  binary_size_bytes: z.number().int().optional(),
});

export type VisibilityCubeHeader = z.infer<typeof VisibilityCubeHeaderSchema>;

export const IndexSchema = z.object({
  sites: z.array(SiteSummarySchema),
  missions: z.array(MissionSchema),
  mode: z.enum(['real', 'synthetic']),
  is_synthetic: z.boolean(),
});

export type IndexData = z.infer<typeof IndexSchema>;

export const ManifestSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      size_bytes: z.number().int().min(0),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
  ),
  run_configuration: z.record(z.string(), z.unknown()),
  date_range: z.object({
    start_utc: z.string(),
    end_utc: z.string(),
  }),
  timestamp: z.string().nullable().optional(),
  code_commit: z.string().nullable().optional(),
  is_synthetic: z.boolean(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export const ProvenanceSchema = z.object({
  datasets: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      source_url: z.string(),
    })
  ),
  kernels: z.array(
    z.object({
      name: z.string(),
      checksum: z.string(),
    })
  ),
  parameters: z.record(z.string(), z.unknown()),
  tolerances: z.record(z.string(), z.number()),
  tests_summary: z.object({
    tests_passed: z.number().int().min(0),
    tests_total: z.number().int().min(0),
    last_verified_utc: z.string(),
  }),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

export const CheckResultSchema = z.object({
  name: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  tolerance: z.string().nullable(),
  measured_value: z.string().nullable(),
  skipped_reason: z.string().nullable(),
});

export const TestResultsSchema = z.object({
  status: z.enum(['passed', 'failed']),
  counts: z.object({
    total: z.number().int().min(0),
    passed: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  failures: z.array(z.unknown()),
  timestamp: z.string(),
  checks: z.array(CheckResultSchema),
});

export type TestResults = z.infer<typeof TestResultsSchema>;

// Detailed validation error handling
export interface ValidationErrorDetail {
  fieldPath: string;
  code: string;
  message: string;
}

export class DataValidationError extends Error {
  public details: ValidationErrorDetail[];
  public sourceFile: string;

  constructor(sourceFile: string, details: ValidationErrorDetail[]) {
    const summary = details.map((d) => `Field '${d.fieldPath}': ${d.message}`).join('; ');
    super(`Schema Validation Failure in '${sourceFile}': ${summary}`);
    this.name = 'DataValidationError';
    this.sourceFile = sourceFile;
    this.details = details;
  }
}

export function validatePayload<T>(schema: z.ZodSchema<T>, data: unknown, sourceFile: string): T {
  const res = schema.safeParse(data);
  if (!res.success) {
    const details: ValidationErrorDetail[] = res.error.issues.map((issue) => ({
      fieldPath: issue.path.join('.') || 'root',
      code: issue.code,
      message: issue.message,
    }));
    throw new DataValidationError(sourceFile, details);
  }
  return res.data;
}
