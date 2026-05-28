"""
Steps 6 & 7 – GIS Data Processing + Spatial Analysis
• Reads DEM/DSM GeoTIFF with rasterio
• Calculates stockpile volume above reference plane (TIN method)
• Calculates cut / fill from two DEMs if provided
• Generates contour lines as GeoJSON
• Returns DEM stats: min/max/mean elevation, resolution, CRS
"""
import os
import json
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
from typing import Optional


# ── DEM stats ──────────────────────────────────────────────────────────────

def dem_stats(dem_path: str) -> dict:
    """Read a GeoTIFF DEM and return basic metadata + stats."""
    with rasterio.open(dem_path) as src:
        data  = src.read(1, masked=True)
        nodata = src.nodata
        valid  = data.compressed() if hasattr(data, 'compressed') else data[data != nodata]

        pixel_width  = abs(src.transform.a)
        pixel_height = abs(src.transform.e)
        pixel_area   = _pixel_area_m2(src)   # handles geographic + projected CRS

        return {
            "crs":          str(src.crs) if src.crs else "unknown",
            "width_px":     src.width,
            "height_px":    src.height,
            "pixel_size_m": round(pixel_width, 4),
            "pixel_area_m2":round(pixel_area, 4),
            "elev_min":     round(float(valid.min()), 2),
            "elev_max":     round(float(valid.max()), 2),
            "elev_mean":    round(float(valid.mean()), 2),
            "elev_std":     round(float(valid.std()), 2),
            "bounds":       list(src.bounds),
            "valid_pixels": int(valid.size),
            "nodata":       nodata,
        }


# ── Volume calculation ──────────────────────────────────────────────────────

def calculate_volume(dem_path: str,
                     reference_elevation: Optional[float] = None,
                     percentile: float = 5.0) -> dict:
    """
    Compute stockpile volume above a reference plane using the TIN method:
      volume = Σ max(0, elevation - reference) × pixel_area

    reference_elevation:
      • If supplied by user → use it directly (e.g. design floor level)
      • If None → use the <percentile>th percentile of the DEM as base plane
    """
    with rasterio.open(dem_path) as src:
        raw   = src.read(1)
        nodata = src.nodata

        # Build valid mask
        if nodata is not None:
            valid_mask = raw != nodata
        else:
            valid_mask = np.isfinite(raw)

        elev = raw.copy().astype(np.float64)
        elev[~valid_mask] = np.nan

        pixel_area = _pixel_area_m2(src)      # handles both projected + geographic CRS

    valid_elev = elev[~np.isnan(elev)]
    if valid_elev.size == 0:
        return {"error": "DEM contains no valid data"}

    # Choose reference plane
    if reference_elevation is None:
        reference_elevation = float(np.percentile(valid_elev, percentile))

    diff = elev - reference_elevation
    diff[np.isnan(diff)] = 0.0

    above = np.where(diff > 0, diff, 0.0)   # stockpile (fill above base)
    below = np.where(diff < 0, diff, 0.0)   # pit / cut below base

    stockpile_vol = float(np.sum(above) * pixel_area)
    cut_vol       = float(np.sum(np.abs(below)) * pixel_area)
    net_change    = stockpile_vol - cut_vol

    total_area    = float(valid_mask.sum()) * pixel_area   # m²

    return {
        "stockpile_volume_m3":  round(stockpile_vol, 1),
        "cut_volume_m3":        round(cut_vol, 1),
        "net_change_m3":        round(net_change, 1),
        "reference_elevation_m":round(reference_elevation, 3),
        "pixel_area_m2":        round(pixel_area, 4),
        "total_area_m2":        round(total_area, 1),
        "total_area_km2":       round(total_area / 1e6, 4),
        "elev_min":             round(float(np.nanmin(elev)), 2),
        "elev_max":             round(float(np.nanmax(elev)), 2),
        "elev_mean":            round(float(np.nanmean(elev)), 2),
    }


def calculate_cut_fill(dem_before_path: str, dem_after_path: str) -> dict:
    """Compare two DEMs to get cut and fill volumes between surveys."""
    with rasterio.open(dem_before_path) as b, rasterio.open(dem_after_path) as a:
        before = b.read(1).astype(np.float64)
        after  = a.read(1).astype(np.float64)
        nd_b   = b.nodata
        nd_a   = a.nodata
        pixel_area = abs(b.transform.a * b.transform.e)

    if nd_b is not None: before[before == nd_b] = np.nan
    if nd_a is not None: after[after  == nd_a] = np.nan

    diff = after - before
    cut  = diff[diff < 0]
    fill = diff[diff > 0]

    return {
        "cut_volume_m3":  round(float(np.sum(np.abs(cut)))  * pixel_area, 1),
        "fill_volume_m3": round(float(np.sum(fill)) * pixel_area, 1),
        "net_change_m3":  round(float(np.sum(diff[~np.isnan(diff)])) * pixel_area, 1),
    }


# ── Contour generation ─────────────────────────────────────────────────────

def generate_contours(dem_path: str,
                      interval: float = 1.0,
                      output_path: Optional[str] = None) -> dict:
    """
    Generate contour lines from DEM using matplotlib.
    Returns GeoJSON FeatureCollection (lat/lon coordinates).
    Also saves to output_path if given.
    """
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    with rasterio.open(dem_path) as src:
        data      = src.read(1, masked=True)
        bounds    = src.bounds
        transform = src.transform
        nodata    = src.nodata

    arr = np.ma.masked_equal(data, nodata) if nodata is not None else np.ma.array(data)
    filled = arr.filled(np.nan)

    vmin = np.nanmin(filled)
    vmax = np.nanmax(filled)
    if np.isnan(vmin) or vmin == vmax:
        return {"error": "DEM has no elevation range for contours"}

    levels = np.arange(
        np.ceil(vmin / interval) * interval,
        np.floor(vmax / interval) * interval + interval,
        interval
    )
    if len(levels) > 500:        # cap for very large DEMs
        levels = np.linspace(vmin, vmax, 200)
        interval = round((vmax - vmin) / 200, 2)

    # Build row/col coordinate arrays → geographic
    rows = np.arange(filled.shape[0])
    cols = np.arange(filled.shape[1])
    xs = bounds.left   + (cols + 0.5) * transform.a
    ys = bounds.top    + (rows + 0.5) * transform.e   # e is negative

    fig, ax = plt.subplots()
    cs = ax.contour(xs, ys, filled, levels=levels)

    features = []
    for level, paths in zip(cs.levels, cs.get_paths() if hasattr(cs, 'get_paths') else []):
        pass

    # Use allsegs which works across matplotlib versions
    for i, level in enumerate(cs.levels):
        segs = cs.allsegs[i]
        for seg in segs:
            if len(seg) < 2:
                continue
            coords = [[round(float(x), 6), round(float(y), 6)] for x, y in seg]
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {"elevation": round(float(level), 2), "interval": interval}
            })
    plt.close(fig)

    geojson = {"type": "FeatureCollection", "features": features}

    if output_path:
        with open(output_path, "w") as f:
            json.dump(geojson, f)

    return {
        "contour_count": len(features),
        "interval_m":    interval,
        "elev_min":      round(float(vmin), 2),
        "elev_max":      round(float(vmax), 2),
        "geojson":       geojson if len(features) < 2000 else None,   # don't send huge payloads
        "geojson_path":  output_path,
    }


def _pixel_area_m2(src) -> float:
    """
    Return pixel area in m² regardless of whether the CRS is projected or geographic.
    For geographic CRS (degrees) we approximate using the haversine formula at the
    centre latitude of the raster.
    """
    from pyproj import CRS as ProjCRS
    import math

    crs = src.crs
    t   = src.transform
    pixel_w = abs(t.a)
    pixel_h = abs(t.e)

    if crs is None:
        # Assume already in metres (no CRS info)
        return pixel_w * pixel_h

    proj_crs = ProjCRS.from_user_input(str(crs))

    if proj_crs.is_geographic:
        # degrees → metres using mid-latitude approximation
        bounds   = src.bounds
        mid_lat  = math.radians((bounds.top + bounds.bottom) / 2)
        m_per_deg_lat = 111_132.92 - 559.82 * math.cos(2*mid_lat) + 1.175 * math.cos(4*mid_lat)
        m_per_deg_lon = 111_412.84 * math.cos(mid_lat) - 93.5 * math.cos(3*mid_lat)
        return (pixel_w * m_per_deg_lon) * (pixel_h * m_per_deg_lat)
    else:
        # Projected CRS — units already in metres
        return pixel_w * pixel_h
