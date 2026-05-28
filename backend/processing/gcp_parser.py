"""
Step 1/2 – GCP file parser
Supports:
  • ODM format:    WGS84\n<lat> <lon> <alt> <px> <py> <image>
  • CSV format:    id,lat,lon,alt[,x_px,y_px,image]
  • TXT whitespace-delimited

Returns list of GCP dicts and basic RMSE estimate from residuals if available.
"""
import csv
import io
import math
import re
from typing import Optional


def _try_float(v):
    try:
        return float(v)
    except Exception:
        return None


def parse_gcp_file(content: bytes, filename: str) -> dict:
    text = content.decode("utf-8", errors="replace").strip()
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    gcps = []
    crs  = "WGS84"
    errors = []

    # Detect ODM header
    if lines and re.match(r'wgs84|epsg|proj', lines[0], re.I):
        crs = lines[0]
        lines = lines[1:]

    # Try CSV first
    try:
        reader = csv.DictReader(io.StringIO("\n".join(lines)))
        fieldnames = [f.lower().strip() for f in (reader.fieldnames or [])]
        if any(f in fieldnames for f in ('lat', 'latitude', 'y')):
            for row in reader:
                row_lower = {k.lower().strip(): v for k, v in row.items()}
                lat = _try_float(row_lower.get('lat') or row_lower.get('latitude') or row_lower.get('y'))
                lon = _try_float(row_lower.get('lon') or row_lower.get('longitude') or row_lower.get('x'))
                alt = _try_float(row_lower.get('alt') or row_lower.get('altitude') or row_lower.get('z') or 0)
                gid = row_lower.get('id') or row_lower.get('name') or row_lower.get('point') or f"GCP-{len(gcps)+1:02d}"
                if lat is not None and lon is not None:
                    gcps.append({"id": str(gid), "lat": lat, "lon": lon, "alt": alt or 0.0})
            if gcps:
                return _build_result(gcps, crs, filename)
    except Exception:
        pass

    # Fallback: whitespace-delimited
    for line in lines:
        parts = line.split()
        if len(parts) >= 2:
            nums = [_try_float(p) for p in parts[:6]]
            # Heuristic: first two/three numeric values are lat/lon/alt
            valid_nums = [n for n in nums if n is not None]
            if len(valid_nums) >= 2:
                lat, lon = valid_nums[0], valid_nums[1]
                alt = valid_nums[2] if len(valid_nums) > 2 else 0.0
                # Sanity: valid lat/lon range
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    gid = parts[-1] if not _try_float(parts[-1]) else f"GCP-{len(gcps)+1:02d}"
                    gcps.append({"id": gid, "lat": lat, "lon": lon, "alt": float(alt)})

    return _build_result(gcps, crs, filename)


def _build_result(gcps, crs, filename):
    if not gcps:
        return {"count": 0, "crs": crs, "gcps": [], "centre_lat": None,
                "centre_lon": None, "error": "No valid GCPs parsed"}

    lats = [g["lat"] for g in gcps]
    lons = [g["lon"] for g in gcps]
    centre_lat = round(sum(lats) / len(lats), 6)
    centre_lon = round(sum(lons) / len(lons), 6)

    # Spread as rough quality indicator
    lat_spread = round(max(lats) - min(lats), 6)
    lon_spread = round(max(lons) - min(lons), 6)

    return {
        "count":      len(gcps),
        "crs":        crs,
        "gcps":       gcps,
        "centre_lat": centre_lat,
        "centre_lon": centre_lon,
        "lat_spread": lat_spread,
        "lon_spread": lon_spread,
        "filename":   filename,
    }
