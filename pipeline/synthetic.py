"""Deterministic synthetic lunar DEM generator.

Rules & Non-Negotiables:
- Always flagged synthetic: is_synthetic=True in metadata and GeoTIFF tags (Rule 3).
- Evaluates elevation from lat/lon of each pixel through inverse projection,
  so that features (walls, cones, craters) follow true great-circle distance and azimuth.
- Lunar South Polar Stereographic CRS:
    '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs'
- Lunar Sphere Geographic CRS:
    '+proj=longlat +R=1737400 +no_defs'
- Generates: flat, wall, cone, crater, and nested multi-resolution layers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

import affine
import numpy as np
import pyproj
import rasterio

from pipeline.constants import (
    LUNAR_GEOGRAPHIC_CRS,
    LUNAR_SOUTH_POLE_STEREO_CRS,
    R_MOON_M,
)

LUNAR_GEO_CRS_OBJ = pyproj.CRS.from_string(LUNAR_GEOGRAPHIC_CRS)
LUNAR_STEREO_CRS_OBJ = pyproj.CRS.from_string(LUNAR_SOUTH_POLE_STEREO_CRS)
GEOD_LUNAR = pyproj.Geod(a=R_MOON_M, b=R_MOON_M)


def _geod_inv_grid(
    lon1: float,
    lat1: float,
    lons2: np.ndarray,
    lats2: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Evaluate geodetic inverse between scalar point (lon1, lat1) and 2D grid (lons2, lats2)."""
    orig_shape = lons2.shape
    lons2_flat = lons2.ravel()
    lats2_flat = lats2.ravel()
    lons1_flat = np.full(lons2.size, float(lon1), dtype=np.float64)
    lats1_flat = np.full(lats2.size, float(lat1), dtype=np.float64)

    az1, az2, dist = GEOD_LUNAR.inv(lons1_flat, lats1_flat, lons2_flat, lats2_flat)
    return az1.reshape(orig_shape), az2.reshape(orig_shape), dist.reshape(orig_shape)


def _build_pixel_grid_lat_lon(
    center_x_m: float,
    center_y_m: float,
    width_m: float,
    height_m: float,
    pixel_size_m: float,
) -> Tuple[np.ndarray, np.ndarray, affine.Affine, Tuple[int, int]]:
    """Build pixel center geographic coordinates (lons_deg, lats_deg) and transform."""
    ncols = int(round(width_m / pixel_size_m))
    nrows = int(round(height_m / pixel_size_m))

    min_x = center_x_m - (ncols * pixel_size_m) / 2.0
    max_y = center_y_m + (nrows * pixel_size_m) / 2.0

    transform = affine.Affine.translation(min_x, max_y) @ affine.Affine.scale(pixel_size_m, -pixel_size_m)

    # Pixel center coordinates in projected stereographic space
    col_coords = min_x + (np.arange(ncols) + 0.5) * pixel_size_m
    row_coords = max_y - (np.arange(nrows) + 0.5) * pixel_size_m

    X, Y = np.meshgrid(col_coords, row_coords)

    # Inverse projection to lunar geographic (lon, lat)
    transformer = pyproj.Transformer.from_crs(LUNAR_STEREO_CRS_OBJ, LUNAR_GEO_CRS_OBJ, always_xy=True)
    lons_deg, lats_deg = transformer.transform(X, Y)

    return lons_deg, lats_deg, transform, (nrows, ncols)


def _write_synthetic_geotiff(
    out_path: Union[str, Path],
    data: np.ndarray,
    transform: affine.Affine,
    feature_name: str,
    params: Dict[str, Any],
    nodata_val: float = -9999.0,
) -> Dict[str, Any]:
    """Write synthetic elevation grid to GeoTIFF with mandatory provenance tags."""
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    nrows, ncols = data.shape
    created_utc = datetime.now(timezone.utc).isoformat()

    tags = {
        "is_synthetic": "true",
        "synthetic_feature": feature_name,
        "created_utc": created_utc,
        "reference_sphere_radius_m": str(R_MOON_M),
        "generator": "pipeline.synthetic",
    }
    for k, v in params.items():
        tags[f"param_{k}"] = str(v)

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=nrows,
        width=ncols,
        count=1,
        dtype=rasterio.float32,
        crs=LUNAR_SOUTH_POLE_STEREO_CRS,
        transform=transform,
        nodata=nodata_val,
    ) as dst:
        dst.write(data.astype(np.float32), 1)
        dst.update_tags(**tags)

    return {
        "path": str(path),
        "is_synthetic": True,
        "feature": feature_name,
        "shape": [nrows, ncols],
        "params": params,
        "created_utc": created_utc,
    }


def create_flat_dem(
    out_path: Union[str, Path],
    width_m: float = 20000.0,
    height_m: float = 20000.0,
    pixel_size_m: float = 10.0,
    center_x_m: float = 0.0,
    center_y_m: float = 0.0,
    base_elev_m: float = 0.0,
) -> Dict[str, Any]:
    """Generate a perfectly flat synthetic DEM at a constant elevation."""
    _, _, transform, shape = _build_pixel_grid_lat_lon(
        center_x_m=center_x_m,
        center_y_m=center_y_m,
        width_m=width_m,
        height_m=height_m,
        pixel_size_m=pixel_size_m,
    )

    data = np.full(shape, float(base_elev_m), dtype=np.float64)

    return _write_synthetic_geotiff(
        out_path=out_path,
        data=data,
        transform=transform,
        feature_name="flat",
        params={
            "base_elev_m": base_elev_m,
            "width_m": width_m,
            "height_m": height_m,
            "pixel_size_m": pixel_size_m,
        },
    )


def create_wall_dem(
    out_path: Union[str, Path],
    distance_m: float = 10000.0,
    height_m: float = 100.0,
    az_start_deg: float = 30.0,
    az_end_deg: float = 60.0,
    thickness_m: float = 50.0,
    width_m: float = 25000.0,
    height_grid_m: float = 25000.0,
    pixel_size_m: float = 10.0,
    center_x_m: float = 0.0,
    center_y_m: float = 0.0,
    site_lat_deg: float = -89.9,
    site_lon_deg: float = 0.0,
    base_elev_m: float = 0.0,
) -> Dict[str, Any]:
    """Generate a synthetic DEM with a curved wall following a true great-circle distance arc.

    Inside the azimuth range [az_start_deg, az_end_deg] and distance band
    [distance_m - thickness/2, distance_m + thickness/2], the elevation is base_elev_m + height_m.
    """
    lons_deg, lats_deg, transform, _ = _build_pixel_grid_lat_lon(
        center_x_m=center_x_m,
        center_y_m=center_y_m,
        width_m=width_m,
        height_m=height_grid_m,
        pixel_size_m=pixel_size_m,
    )

    # Calculate true great-circle distance and forward azimuth from observer site
    az_fwd, _, dist_m = _geod_inv_grid(site_lon_deg, site_lat_deg, lons_deg, lats_deg)
    az_deg = az_fwd % 360.0

    # Distance band check
    in_dist = np.abs(dist_m - float(distance_m)) <= (float(thickness_m) / 2.0)

    # Azimuth range check (handling 0/360 boundary)
    az1 = float(az_start_deg) % 360.0
    az2 = float(az_end_deg) % 360.0
    if az1 <= az2:
        in_az = (az_deg >= az1) & (az_deg <= az2)
    else:
        in_az = (az_deg >= az1) | (az_deg <= az2)

    data = np.full(dist_m.shape, float(base_elev_m), dtype=np.float64)
    data[in_dist & in_az] = float(base_elev_m + height_m)

    return _write_synthetic_geotiff(
        out_path=out_path,
        data=data,
        transform=transform,
        feature_name="wall",
        params={
            "distance_m": distance_m,
            "height_m": height_m,
            "az_start_deg": az_start_deg,
            "az_end_deg": az_end_deg,
            "thickness_m": thickness_m,
            "site_lat_deg": site_lat_deg,
            "site_lon_deg": site_lon_deg,
            "base_elev_m": base_elev_m,
        },
    )


def create_cone_dem(
    out_path: Union[str, Path],
    center_distance_m: float = 8000.0,
    center_az_deg: float = 45.0,
    radius_m: float = 2000.0,
    height_m: float = 300.0,
    width_m: float = 25000.0,
    height_grid_m: float = 25000.0,
    pixel_size_m: float = 10.0,
    center_x_m: float = 0.0,
    center_y_m: float = 0.0,
    site_lat_deg: float = -89.9,
    site_lon_deg: float = 0.0,
    base_elev_m: float = 0.0,
) -> Dict[str, Any]:
    """Generate a synthetic DEM with a conical peak."""
    lons_deg, lats_deg, transform, _ = _build_pixel_grid_lat_lon(
        center_x_m=center_x_m,
        center_y_m=center_y_m,
        width_m=width_m,
        height_m=height_grid_m,
        pixel_size_m=pixel_size_m,
    )

    # Compute peak coordinates from site
    peak_lon, peak_lat, _ = GEOD_LUNAR.fwd(site_lon_deg, site_lat_deg, center_az_deg, center_distance_m)

    # Distance from peak to each pixel
    _, _, d_peak_m = _geod_inv_grid(peak_lon, peak_lat, lons_deg, lats_deg)

    cone_profile = np.maximum(0.0, float(height_m) * (1.0 - d_peak_m / float(radius_m)))
    data = float(base_elev_m) + cone_profile

    return _write_synthetic_geotiff(
        out_path=out_path,
        data=data,
        transform=transform,
        feature_name="cone",
        params={
            "center_distance_m": center_distance_m,
            "center_az_deg": center_az_deg,
            "radius_m": radius_m,
            "height_m": height_m,
            "site_lat_deg": site_lat_deg,
            "site_lon_deg": site_lon_deg,
            "base_elev_m": base_elev_m,
        },
    )


def create_crater_dem(
    out_path: Union[str, Path],
    center_distance_m: float = 12000.0,
    center_az_deg: float = 90.0,
    radius_m: float = 4000.0,
    depth_m: float = 400.0,
    rim_height_m: float = 120.0,
    width_m: float = 35000.0,
    height_grid_m: float = 35000.0,
    pixel_size_m: float = 20.0,
    center_x_m: float = 0.0,
    center_y_m: float = 0.0,
    site_lat_deg: float = -89.9,
    site_lon_deg: float = 0.0,
    base_elev_m: float = 0.0,
) -> Dict[str, Any]:
    """Generate a realistic lunar impact crater profile with a parabolic bowl and raised rim."""
    lons_deg, lats_deg, transform, _ = _build_pixel_grid_lat_lon(
        center_x_m=center_x_m,
        center_y_m=center_y_m,
        width_m=width_m,
        height_m=height_grid_m,
        pixel_size_m=pixel_size_m,
    )

    # Crater center
    crater_lon, crater_lat, _ = GEOD_LUNAR.fwd(site_lon_deg, site_lat_deg, center_az_deg, center_distance_m)
    _, _, r_m = _geod_inv_grid(crater_lon, crater_lat, lons_deg, lats_deg)

    r_norm = r_m / float(radius_m)
    data = np.full(r_m.shape, float(base_elev_m), dtype=np.float64)

    # Inside crater rim: parabolic bowl transition to rim
    inside = r_norm <= 1.0
    data[inside] = (
        float(base_elev_m)
        - float(depth_m) * (1.0 - r_norm[inside] ** 2)
        + float(rim_height_m) * (r_norm[inside] ** 2)
    )

    # Outside crater rim: exponential decay of ejecta / rim uplift
    outside = ~inside
    decay = np.exp(-0.5 * ((r_m[outside] - float(radius_m)) / (0.3 * float(radius_m))) ** 2)
    data[outside] = float(base_elev_m) + float(rim_height_m) * decay

    return _write_synthetic_geotiff(
        out_path=out_path,
        data=data,
        transform=transform,
        feature_name="crater",
        params={
            "center_distance_m": center_distance_m,
            "center_az_deg": center_az_deg,
            "radius_m": radius_m,
            "depth_m": depth_m,
            "rim_height_m": rim_height_m,
            "site_lat_deg": site_lat_deg,
            "site_lon_deg": site_lon_deg,
            "base_elev_m": base_elev_m,
        },
    )


def create_nested_synthetic_layers(
    base_dir: Union[str, Path],
    feature_type: str = "crater",
    site_lat_deg: float = -89.9,
    site_lon_deg: float = 0.0,
    base_elev_m: float = 0.0,
) -> List[Dict[str, Any]]:
    """Generate a multi-resolution hierarchy of nested GeoTIFFs evaluating the same synthetic feature.

    Produces:
    - Fine layer: 10 m pixel size, 12 km width, max_range 5 km.
    - Medium layer: 50 m pixel size, 70 km width, max_range 30 km.
    - Coarse layer: 200 m pixel size, 220 km width, max_range 100 km.
    """
    out_dir = Path(base_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    configs = [
        {"name": "fine", "pixel_size_m": 10.0, "width_m": 12000.0, "max_range_m": 5000.0},
        {"name": "medium", "pixel_size_m": 50.0, "width_m": 70000.0, "max_range_m": 30000.0},
        {"name": "coarse", "pixel_size_m": 200.0, "width_m": 220000.0, "max_range_m": 100000.0},
    ]

    results = []
    for cfg in configs:
        file_path = out_dir / f"dem_{feature_type}_{cfg['name']}.tif"
        if feature_type == "flat":
            info = create_flat_dem(
                out_path=file_path,
                width_m=cfg["width_m"],
                height_m=cfg["width_m"],
                pixel_size_m=cfg["pixel_size_m"],
                base_elev_m=base_elev_m,
            )
        elif feature_type == "crater":
            info = create_crater_dem(
                out_path=file_path,
                center_distance_m=10000.0,
                center_az_deg=45.0,
                radius_m=3000.0,
                depth_m=300.0,
                rim_height_m=100.0,
                width_m=cfg["width_m"],
                height_grid_m=cfg["width_m"],
                pixel_size_m=cfg["pixel_size_m"],
                site_lat_deg=site_lat_deg,
                site_lon_deg=site_lon_deg,
                base_elev_m=base_elev_m,
            )
        else:
            raise ValueError(f"Unsupported feature_type: {feature_type}")

        info["name"] = cfg["name"]
        info["max_range_m"] = cfg["max_range_m"]
        info["pixel_size_m"] = cfg["pixel_size_m"]
        results.append(info)

    return results
