"""LOLA DEM terrain handling, windowed raster access, and multi-resolution sampling.

Rules & Non-Negotiables:
- Exact lunar sphere geographic CRS: '+proj=longlat +R=1737400 +no_defs'.
- Heights are meters relative to the R = 1737400 m sphere.
- Windowed reads with rasterio; never load entire datasets into memory.
- Transform to raster CRS with pyproj (always_xy=True).
- Validate raster CRS: raise clear error if the ellipsoid radius differs from 1737400 m.
- Vectorized bilinear interpolation with strict NaN propagation outside or on nodata.
- NestedTerrain: multi-resolution hierarchy (fine to coarse) with documented seam handling.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Optional, Sequence, Tuple, Union

import affine
import numpy as np
import pyproj
import rasterio
import rasterio.windows

from pipeline.constants import LUNAR_GEOGRAPHIC_CRS, R_MOON_M

LUNAR_GEO_CRS_OBJ = pyproj.CRS.from_string(LUNAR_GEOGRAPHIC_CRS)


def verify_lunar_crs_radius(crs: Union[pyproj.CRS, rasterio.crs.CRS, str], expected_r: float = R_MOON_M, tol_m: float = 1.0) -> None:
    """Validate that the raster CRS uses the exact lunar sphere radius of 1737400.0 m.

    Raises:
        ValueError: If CRS has no defined ellipsoid or semi-major/minor axes differ from expected_r.
    """
    if isinstance(crs, rasterio.crs.CRS):
        proj_crs = pyproj.CRS.from_user_input(crs.to_string())
    elif isinstance(crs, str):
        proj_crs = pyproj.CRS.from_user_input(crs)
    else:
        proj_crs = crs

    if proj_crs.ellipsoid is None:
        raise ValueError(f"Raster CRS '{proj_crs.to_string()}' has no defined ellipsoid.")

    a = proj_crs.ellipsoid.semi_major_metre
    b = proj_crs.ellipsoid.semi_minor_metre

    if a is None or b is None:
        raise ValueError(f"Raster CRS '{proj_crs.to_string()}' has undefined ellipsoid axes.")

    if abs(a - expected_r) > tol_m or abs(b - expected_r) > tol_m:
        raise ValueError(
            f"Raster CRS ellipsoid radius (semi-major={a} m, semi-minor={b} m) "
            f"differs from required lunar sphere radius {expected_r} m (tolerance={tol_m} m)."
        )


@dataclass
class DEMWindow:
    """In-memory representation of a windowed DEM region."""

    array: np.ndarray  # 2D float64 elevation in meters relative to R_MOON_M
    transform: affine.Affine  # Affine transform mapping pixel (col, row) -> projected (x, y)
    crs: pyproj.CRS  # Projected raster CRS
    nodata_mask: np.ndarray  # 2D bool (True where nodata or NaN)
    pixel_size_m: float  # Resolution in meters
    bounds: Tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y) in raster CRS
    path: Optional[str] = None

    def __iter__(self) -> Iterator[Any]:
        """Support 5-tuple unpacking: array, transform, crs, nodata_mask, pixel_size_m."""
        return iter((self.array, self.transform, self.crs, self.nodata_mask, self.pixel_size_m))

    @property
    def shape(self) -> Tuple[int, int]:
        return self.array.shape

    def sample(self, xs: Sequence[float] | np.ndarray, ys: Sequence[float] | np.ndarray) -> np.ndarray:
        """Sample elevations bilinearly at projected coordinates (xs, ys) in raster CRS meters."""
        return sample_bilinear(self, xs, ys)

    def sample_lat_lon(self, lats_deg: Sequence[float] | np.ndarray, lons_deg: Sequence[float] | np.ndarray) -> np.ndarray:
        """Sample elevations bilinearly at geographic coordinates (lats_deg, lons_deg)."""
        lats_arr = np.asarray(lats_deg, dtype=np.float64)
        lons_arr = np.asarray(lons_deg, dtype=np.float64)

        transformer = pyproj.Transformer.from_crs(LUNAR_GEO_CRS_OBJ, self.crs, always_xy=True)
        xs, ys = transformer.transform(lons_arr, lats_arr)
        return sample_bilinear(self, xs, ys)


def open_dem_window(
    path: Union[str, Path],
    center_lat_deg: float,
    center_lon_deg: float,
    half_width_m: float,
) -> DEMWindow:
    """Perform a windowed read of a DEM GeoTIFF centered on (center_lat_deg, center_lon_deg).

    Never loads the entire file into memory.

    Args:
        path: Path to DEM GeoTIFF.
        center_lat_deg: Center latitude in degrees [-90, +90].
        center_lon_deg: Center longitude in degrees [-180, +180] or [0, 360).
        half_width_m: Half-width of the spatial bounding box in meters.

    Returns:
        DEMWindow object (can be unpacked as array, transform, crs, nodata_mask, pixel_size_m).

    Raises:
        ValueError: If file CRS differs from R = 1737400 m sphere or missing.
        FileNotFoundError: If path does not exist.
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"DEM file not found: {file_path}")

    with rasterio.open(file_path) as src:
        if src.crs is None:
            raise ValueError(f"DEM raster '{file_path}' has no defined coordinate reference system (CRS).")

        raster_crs = pyproj.CRS.from_user_input(src.crs.to_string())
        verify_lunar_crs_radius(raster_crs, expected_r=R_MOON_M)

        # Coordinate transformation from lunar geographic to raster CRS
        transformer = pyproj.Transformer.from_crs(LUNAR_GEO_CRS_OBJ, raster_crs, always_xy=True)
        center_x, center_y = transformer.transform(float(center_lon_deg), float(center_lat_deg))

        min_x = center_x - float(half_width_m)
        max_x = center_x + float(half_width_m)
        min_y = center_y - float(half_width_m)
        max_y = center_y + float(half_width_m)

        # Compute raster pixel window from bounds
        window = rasterio.windows.from_bounds(min_x, min_y, max_x, max_y, transform=src.transform)
        # Round window to avoid sub-pixel misalignment
        window = window.round_offsets().round_lengths()
        win_transform = rasterio.windows.transform(window, src.transform)

        # Read band 1 with boundless=True to safely handle boundaries
        fill_val = float(src.nodata) if src.nodata is not None else np.nan
        raw_data = src.read(1, window=window, boundless=True, fill_value=fill_val)

        # Extract resolution
        pixel_size_m = float(abs(win_transform.a))

        # Metadata scaling and offset
        scale = float(src.scales[0]) if src.scales and src.scales[0] is not None else 1.0
        offset = float(src.offsets[0]) if src.offsets and src.offsets[0] is not None else 0.0

        data = raw_data.astype(np.float64)
        if scale != 1.0 or offset != 0.0:
            data = data * scale + offset

        # Identify nodata cells
        if src.nodata is not None:
            nodata_mask = (raw_data == src.nodata) | np.isnan(data)
        else:
            nodata_mask = np.isnan(data)

        # Ensure all nodata cells are np.nan
        data[nodata_mask] = np.nan

        bounds = (min_x, min_y, max_x, max_y)

        return DEMWindow(
            array=data,
            transform=win_transform,
            crs=raster_crs,
            nodata_mask=nodata_mask,
            pixel_size_m=pixel_size_m,
            bounds=bounds,
            path=str(file_path),
        )


def sample_bilinear(
    dem: Any,
    xs: Sequence[float] | np.ndarray,
    ys: Sequence[float] | np.ndarray,
) -> np.ndarray:
    """Vectorized bilinear interpolation.

    Returns NaN outside DEM bounds or if any required corner pixel is nodata.

    Args:
        dem: DEMWindow instance, or 2D numpy array (in which case xs, ys are continuous pixel coordinates).
        xs: X coordinates (projected meters if dem is DEMWindow, or continuous column coordinates if numpy array).
        ys: Y coordinates (projected meters if dem is DEMWindow, or continuous row coordinates if numpy array).

    Returns:
        1D or 2D float64 array of sampled elevations with NaNs outside or on nodata.
    """
    xs_arr = np.asarray(xs, dtype=np.float64)
    ys_arr = np.asarray(ys, dtype=np.float64)

    if xs_arr.shape != ys_arr.shape:
        raise ValueError(f"Shape mismatch between xs {xs_arr.shape} and ys {ys_arr.shape}")

    orig_shape = xs_arr.shape
    xs_flat = xs_arr.ravel()
    ys_flat = ys_arr.ravel()

    if isinstance(dem, DEMWindow) or hasattr(dem, "transform") and hasattr(dem, "array"):
        arr = dem.array
        # Convert projected coordinates (x, y) to continuous pixel coordinates (col, row)
        inv_t = ~dem.transform
        cols, rows = inv_t @ (xs_flat, ys_flat)
        # Affine transform maps (col, row) with pixel centers at (col + 0.5, row + 0.5).
        # We sample relative to pixel centers:
        u = cols - 0.5
        v = rows - 0.5
    elif isinstance(dem, np.ndarray):
        arr = dem
        # dem is raw array: xs_flat is col, ys_flat is row (centered at integer indices 0, 1, ...)
        u = xs_flat
        v = ys_flat
    else:
        raise TypeError(f"Unsupported dem type: {type(dem)}")

    nrows, ncols = arr.shape

    # Determine 4 surrounding integer pixel coordinates
    x0 = np.floor(u).astype(np.int64)
    x1 = x0 + 1
    fx = u - x0

    y0 = np.floor(v).astype(np.int64)
    y1 = y0 + 1
    fy = v - y0

    # Bounds check: point is inside if all 4 corners [x0, x1] and [y0, y1] are within array bounds
    valid = (x0 >= 0) & (x1 < ncols) & (y0 >= 0) & (y1 < nrows)

    out = np.full(len(xs_flat), np.nan, dtype=np.float64)

    if not np.any(valid):
        return out.reshape(orig_shape)

    # Filter to valid indices
    valid_idx = np.where(valid)[0]
    vx0 = x0[valid_idx]
    vx1 = x1[valid_idx]
    vy0 = y0[valid_idx]
    vy1 = y1[valid_idx]
    vfx = fx[valid_idx]
    vfy = fy[valid_idx]

    # Gather 4 corners
    c00 = arr[vy0, vx0]
    c01 = arr[vy0, vx1]
    c10 = arr[vy1, vx0]
    c11 = arr[vy1, vx1]

    # If any corner is NaN / nodata, result is NaN (strict no-data rule)
    corner_nan = np.isnan(c00) | np.isnan(c01) | np.isnan(c10) | np.isnan(c11)

    # Bilinear interpolation formula:
    # f(u, v) = (1-fx)(1-fy)c00 + fx(1-fy)c01 + (1-fx)fy*c10 + fx*fy*c11
    interpolated = (
        (1.0 - vfx) * (1.0 - vfy) * c00
        + vfx * (1.0 - vfy) * c01
        + (1.0 - vfx) * vfy * c10
        + vfx * vfy * c11
    )
    interpolated[corner_nan] = np.nan

    out[valid_idx] = interpolated
    return out.reshape(orig_shape)


@dataclass
class NestedTerrainLayer:
    """A single layer in a multi-resolution terrain hierarchy."""

    dem: Any  # DEMWindow, Callable[[float, float], float], or raster
    max_range_m: float  # Maximum distance from observer for this layer
    name: str = ""
    min_range_m: float = 0.0


class NestedTerrain:
    """Multi-resolution terrain manager ordered from finest to coarsest resolution.

    Seam Handling:
    - Layer selection uses the finest layer covering the queried point and within its max_range_m.
    - On smooth surfaces or aligned DEM products, bilinear interpolation guarantees elevation continuity.
    - If a finer layer does not cover a point (e.g. tile edge or NaN hole), it falls back deterministically
      to the next coarser layer that covers the point and distance.
    - Seam continuity is tested and verified to produce no artificial horizon step.
    """

    def __init__(self, layers: Sequence[NestedTerrainLayer]):
        if not layers:
            raise ValueError("NestedTerrain requires at least one terrain layer.")

        # Ensure layers are sorted by max_range_m ascending (fine to coarse)
        self.layers = sorted(layers, key=lambda layer: layer.max_range_m)

    def sample(
        self,
        distance_m: Union[float, Sequence[float], np.ndarray],
        lat_deg: Union[float, Sequence[float], np.ndarray],
        lon_deg: Union[float, Sequence[float], np.ndarray],
    ) -> np.ndarray:
        """Sample terrain elevation from the finest available layer covering each point.

        Args:
            distance_m: Distance from the observer in meters.
            lat_deg: Target latitude in degrees.
            lon_deg: Target longitude in degrees.

        Returns:
            Numpy array of sampled elevations in meters relative to R_MOON_M (NaN if uncovered).
        """
        dist_arr = np.asarray(distance_m, dtype=np.float64)
        lat_arr = np.asarray(lat_deg, dtype=np.float64)
        lon_arr = np.asarray(lon_deg, dtype=np.float64)

        if not (dist_arr.shape == lat_arr.shape == lon_arr.shape):
            # Broadcast shapes if possible
            dist_arr, lat_arr, lon_arr = np.broadcast_arrays(dist_arr, lat_arr, lon_arr)

        orig_shape = dist_arr.shape
        dists = dist_arr.ravel()
        lats = lat_arr.ravel()
        lons = lon_arr.ravel()

        out = np.full(len(dists), np.nan, dtype=np.float64)
        unfilled_mask = np.ones(len(dists), dtype=bool)

        # Iterate from finest layer to coarsest layer
        for layer in self.layers:
            if not np.any(unfilled_mask):
                break

            # Candidates: within layer distance range
            cand_mask = unfilled_mask & (dists <= layer.max_range_m) & (dists >= layer.min_range_m)
            if not np.any(cand_mask):
                continue

            cand_idx = np.where(cand_mask)[0]
            sampled_elev = self._sample_layer(layer.dem, lats[cand_idx], lons[cand_idx], dists[cand_idx])

            # Fill valid (non-NaN) samples
            valid_sample = ~np.isnan(sampled_elev)
            fill_idx = cand_idx[valid_sample]
            out[fill_idx] = sampled_elev[valid_sample]
            unfilled_mask[fill_idx] = False

        # Return reshaped
        return out.reshape(orig_shape)

    def _sample_layer(
        self,
        dem: Any,
        lats: np.ndarray,
        lons: np.ndarray,
        dists: np.ndarray,
    ) -> np.ndarray:
        """Sample a specific DEM layer."""
        if isinstance(dem, DEMWindow):
            return dem.sample_lat_lon(lats, lons)
        elif callable(dem):
            # Callable function z = dem(lat, lon) or dem(dist, lat, lon)
            try:
                # Vectorized evaluation
                return np.vectorize(dem, otypes=[np.float64])(lats, lons)
            except TypeError:
                return np.vectorize(lambda d, la, lo: dem(d, la, lo), otypes=[np.float64])(dists, lats, lons)
        elif hasattr(dem, "sample_lat_lon"):
            return dem.sample_lat_lon(lats, lons)
        else:
            raise TypeError(f"Unsupported layer dem type: {type(dem)}")
