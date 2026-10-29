"""Constants, reference frames, and status enumerations for LightPath.

All units and reference frames follow project conventions:
- Radii and distances in meters (_m) or kilometers (_km) as labeled in identifiers.
- Reference sphere: R_MOON_M = 1737400.0 m (LOLA reference datum).
- Coordinate frame: MOON_ME (Moon Mean Earth / Polar Axis frame).
"""

from typing import Final

# Lunar physical constants (LOLA datum)
R_MOON_M: Final[float] = 1737400.0  # meters
R_MOON_KM: Final[float] = 1737.4   # kilometers

# Solar and Terrestrial physical constants
R_SUN_KM: Final[float] = 695700.0   # Sun volumetric mean radius, km
R_EARTH_KM: Final[float] = 6371.0   # Earth mean volumetric radius, km
AU_KM: Final[float] = 149597870.7   # Astronomical Unit, km
MOON_EARTH_MEAN_DIST_KM: Final[float] = 384400.0  # Mean lunar distance, km

# Reference Frames
FRAME_MOON_ME: Final[str] = "MOON_ME"

# Visibility status values
STATUS_ROBUST_VISIBLE: Final[str] = "robust_visible"
STATUS_MARGINAL: Final[str] = "marginal"
STATUS_ROBUST_BLOCKED: Final[str] = "robust_blocked"

VALID_STATUSES = (STATUS_ROBUST_VISIBLE, STATUS_MARGINAL, STATUS_ROBUST_BLOCKED)

# Default operational thresholds
DEFAULT_MIN_SUN_FRAC: Final[float] = 0.50
DEFAULT_MIN_EARTH_FRAC: Final[float] = 0.50
DEFAULT_MAX_TRAVERSABLE_SLOPE_DEG: Final[float] = 15.0
DEFAULT_EARTH_GROUND_STATION_MASK_DEG: Final[float] = 10.0
