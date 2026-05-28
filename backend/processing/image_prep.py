"""
Step 4 – Image Preprocessing
• Blur detection via Laplacian variance
• EXIF GPS geotag extraction
• Camera calibration check (focal length / sensor size from EXIF)
• Returns per-image quality report
"""
import os
import struct
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ImageQC:
    filename: str
    path: str
    width: int = 0
    height: int = 0
    file_size_mb: float = 0.0
    blur_score: float = 0.0      # Laplacian variance — higher = sharper
    is_blurry: bool = False
    is_geotagged: bool = False
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_alt: Optional[float] = None
    focal_length_mm: Optional[float] = None
    make: Optional[str] = None
    model: Optional[str] = None
    passed: bool = False
    reason: str = ""


def _laplacian_variance(img_gray: np.ndarray) -> float:
    """
    Compute variance of Laplacian — standard sharpness metric.
    Threshold: < 100 → blurry for typical drone JPEGs.
    """
    # Manual 3x3 Laplacian kernel
    kernel = np.array([[0, 1, 0],
                       [1,-4, 1],
                       [0, 1, 0]], dtype=np.float32)
    from scipy.signal import convolve2d
    lap = convolve2d(img_gray.astype(np.float32), kernel, mode='valid')
    return float(np.var(lap))


def _dms_to_decimal(dms, ref: str) -> Optional[float]:
    """Convert EXIF DMS tuple to decimal degrees."""
    try:
        d = float(dms[0])
        m = float(dms[1])
        s = float(dms[2])
        dec = d + m / 60 + s / 3600
        if ref in ('S', 'W'):
            dec = -dec
        return round(dec, 7)
    except Exception:
        return None


def _extract_exif(img: Image.Image) -> dict:
    """Pull GPS, camera model, focal length from EXIF."""
    result = {}
    try:
        raw = img._getexif()
        if not raw:
            return result
        exif = {TAGS.get(k, k): v for k, v in raw.items()}

        result['make']  = exif.get('Make', '').strip()
        result['model'] = exif.get('Model', '').strip()

        fl = exif.get('FocalLength')
        if fl:
            try:
                result['focal_length_mm'] = float(fl)
            except Exception:
                pass

        gps_raw = exif.get('GPSInfo')
        if gps_raw:
            gps = {GPSTAGS.get(k, k): v for k, v in gps_raw.items()}
            lat = _dms_to_decimal(gps.get('GPSLatitude'), gps.get('GPSLatitudeRef', 'N'))
            lon = _dms_to_decimal(gps.get('GPSLongitude'), gps.get('GPSLongitudeRef', 'E'))
            alt_raw = gps.get('GPSAltitude')
            alt = float(alt_raw) if alt_raw else None
            if lat is not None and lon is not None:
                result['gps_lat'] = lat
                result['gps_lon'] = lon
                result['gps_alt'] = alt
    except Exception:
        pass
    return result


def check_image(path: str, blur_threshold: float = 100.0) -> ImageQC:
    filename = os.path.basename(path)
    qc = ImageQC(filename=filename, path=path)
    try:
        qc.file_size_mb = round(os.path.getsize(path) / 1024 / 1024, 2)
        img = Image.open(path)
        qc.width, qc.height = img.size

        # ── Blur detection ──
        gray = np.array(img.convert('L'))
        # Downsample large images for speed
        if max(gray.shape) > 2000:
            scale = 2000 / max(gray.shape)
            new_h = int(gray.shape[0] * scale)
            new_w = int(gray.shape[1] * scale)
            gray_small = np.array(img.convert('L').resize((new_w, new_h), Image.LANCZOS))
        else:
            gray_small = gray
        qc.blur_score = round(_laplacian_variance(gray_small), 2)
        qc.is_blurry  = qc.blur_score < blur_threshold

        # ── EXIF / GPS ──
        exif = _extract_exif(img)
        qc.make             = exif.get('make')
        qc.model            = exif.get('model')
        qc.focal_length_mm  = exif.get('focal_length_mm')
        qc.gps_lat          = exif.get('gps_lat')
        qc.gps_lon          = exif.get('gps_lon')
        qc.gps_alt          = exif.get('gps_alt')
        qc.is_geotagged     = qc.gps_lat is not None

        # ── Pass / fail ──
        if qc.is_blurry:
            qc.reason = f"Blurry (score {qc.blur_score:.0f} < {blur_threshold})"
        elif not qc.is_geotagged:
            qc.reason = "No GPS geotag in EXIF"
            qc.passed = True   # warn but don't reject — GCPs can compensate
        else:
            qc.passed = True
            qc.reason = "OK"

        if qc.is_blurry:
            qc.passed = False

    except Exception as e:
        qc.reason  = f"Cannot open: {e}"
        qc.passed  = False

    return qc


def preprocess_batch(paths: list[str], blur_threshold: float = 100.0) -> dict:
    """Run QC on every image in the batch, return summary."""
    results = [check_image(p, blur_threshold) for p in paths]
    passed   = [r for r in results if r.passed]
    rejected = [r for r in results if not r.passed]
    geotagged = [r for r in passed if r.is_geotagged]

    lats = [r.gps_lat for r in geotagged if r.gps_lat]
    lons = [r.gps_lon for r in geotagged if r.gps_lon]

    centre_lat = round(sum(lats) / len(lats), 6) if lats else None
    centre_lon = round(sum(lons) / len(lons), 6) if lons else None

    cameras = list({f"{r.make} {r.model}".strip() for r in results if r.make})

    return {
        "total":        len(results),
        "passed":       len(passed),
        "rejected":     len(rejected),
        "geotagged":    len(geotagged),
        "centre_lat":   centre_lat,
        "centre_lon":   centre_lon,
        "cameras":      cameras,
        "blur_threshold": blur_threshold,
        "images":       [vars(r) for r in results],
    }
