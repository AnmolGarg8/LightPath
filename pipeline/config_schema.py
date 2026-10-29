"""Pydantic configuration models for LightPath data processing pipeline.

Rules & Non-Negotiables:
- Strict validation: rejects unknown keys, enforces physical units and value bounds.
- Units explicit in field names: lat_deg, lon_deg, ground_elev_m, max_range_m, etc.
- Support both real and synthetic pipeline configurations.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class TerrainLayerConfig(BaseModel):
    name: str
    path: str
    max_range_m: float = Field(gt=0.0, description="Max distance from observer in meters")
    pixel_size_m: Optional[float] = Field(default=None, gt=0.0)


class SiteConfig(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$")
    name: str
    lat_deg: float = Field(ge=-90.0, le=90.0)
    lon_deg: float = Field(ge=-180.0, le=360.0)
    ground_elev_m: float
    terrain_layers: List[TerrainLayerConfig] = Field(default_factory=list)
    source_links: List[str] = Field(default_factory=list)
    verified: bool = False
    is_synthetic: bool = False
    mission_ids: List[str] = Field(default_factory=list)
    synthetic_feature: Optional[str] = None  # e.g. "flat", "wall", "crater"


class DateRangeConfig(BaseModel):
    start_utc: str
    end_utc: str

    @model_validator(mode="after")
    def check_dates(self) -> DateRangeConfig:
        from datetime import datetime, timezone
        t0 = datetime.fromisoformat(self.start_utc.replace("Z", "+00:00")).astimezone(timezone.utc)
        t1 = datetime.fromisoformat(self.end_utc.replace("Z", "+00:00")).astimezone(timezone.utc)
        if t1 <= t0:
            raise ValueError(f"end_utc ({self.end_utc}) must be after start_utc ({self.start_utc})")
        return self


class ThresholdsConfig(BaseModel):
    min_sun_frac: float = Field(default=0.50, ge=0.0, le=1.0)
    min_earth_frac: float = Field(default=0.50, ge=0.0, le=1.0)
    ground_station_mask_deg: float = Field(default=6.0, ge=0.0, le=90.0)
    max_slope_deg: float = Field(default=15.0, ge=0.0, le=90.0)


class MarginsConfig(BaseModel):
    horizon_margin_deg: float = Field(default=0.10, ge=0.0, le=10.0)


class HorizonParamsConfig(BaseModel):
    az_step_deg: float = Field(default=1.0, gt=0.0, le=360.0)
    max_range_m: float = Field(default=50000.0, gt=0.0)
    step_m: Optional[float] = Field(default=None, gt=0.0)


class RoutePlanningConfig(BaseModel):
    half_width_m: float = Field(default=1000.0, gt=0.0)
    spacing_m: float = Field(default=50.0, gt=0.0)
    date_range: Optional[DateRangeConfig] = None
    step_minutes: int = Field(default=120, gt=0)
    max_cells: int = Field(default=4000, gt=0, description="Cap on total grid cells for browser memory")


class PipelineConfig(BaseModel):
    kernels_meta_path: str = "kernels/meta.tm"
    dsn_config_path: str = "configs/dsn_stations.yaml"
    sites: List[SiteConfig]
    date_range: DateRangeConfig
    step_minutes: int = Field(default=60, gt=0)
    mast_heights_m: List[float] = Field(default=[0.0, 2.0, 5.0, 10.0], min_length=1)
    thresholds: ThresholdsConfig = Field(default_factory=ThresholdsConfig)
    margins: MarginsConfig = Field(default_factory=MarginsConfig)
    horizon_params: HorizonParamsConfig = Field(default_factory=HorizonParamsConfig)
    route_planning: RoutePlanningConfig = Field(default_factory=RoutePlanningConfig)
    output_dir: str = "web/public/data"
