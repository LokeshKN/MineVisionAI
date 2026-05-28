from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, MineSite, VolumeHistory, Survey, UploadedFile
from routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
import json, os

router = APIRouter(prefix="/sites", tags=["sites"])


class SiteCreate(BaseModel):
    name:        str
    location:    str
    state:       str
    mine_type:   str
    latitude:    Optional[float] = None
    longitude:   Optional[float] = None
    area_km2:    Optional[float] = None
    max_depth_m: Optional[float] = None


@router.get("/")
def list_sites(db: Session = Depends(get_db), user=Depends(get_current_user)):
    sites = db.query(MineSite).filter(MineSite.owner_id == user.id).all()
    result = []
    for s in sites:
        latest = (db.query(Survey)
                    .filter(Survey.site_id == s.id, Survey.status == "complete")
                    .order_by(Survey.id.desc()).first())
        survey_count = db.query(Survey).filter(Survey.site_id == s.id).count()
        # dem_available = any completed survey that has a DEM file on disk
        dem_available = False
        if latest:
            dem_file = (db.query(UploadedFile)
                          .filter(UploadedFile.survey_id == latest.id,
                                  UploadedFile.file_type.in_(["dem","dsm"]))
                          .first())
            if dem_file and dem_file.path and os.path.exists(dem_file.path):
                dem_available = True

        result.append({
            "id":               s.id,
            "name":             s.name,
            "location":         s.location,
            "state":            s.state,
            "mine_type":        s.mine_type,
            "latitude":         s.latitude,
            "longitude":        s.longitude,
            "area_km2":         s.area_km2,
            "max_depth_m":      s.max_depth_m,
            "elevation_min":    s.elevation_min,
            "elevation_max":    s.elevation_max,
            "status":           s.status,
            "stockpile_volume": latest.stockpile_volume if latest else None,
            "latest_survey_id": latest.id if latest else None,
            "survey_count":     survey_count,
            "dem_available":    dem_available,
        })
    return result


@router.get("/{site_id}")
def get_site(site_id: int, db: Session = Depends(get_db),
             user=Depends(get_current_user)):
    site = db.query(MineSite).filter(
        MineSite.id == site_id, MineSite.owner_id == user.id).first()
    if not site:
        raise HTTPException(404, "Site not found")

    surveys = (db.query(Survey)
                 .filter(Survey.site_id == site_id)
                 .order_by(Survey.id.desc()).all())

    vol_history = (db.query(VolumeHistory)
                     .filter(VolumeHistory.site_id == site_id)
                     .order_by(VolumeHistory.id).all())

    # Contour GeoJSON path from most recent complete survey
    contour_geojson = None
    for sv in surveys:
        if sv.status == "complete":
            cpath = os.path.join(
                os.path.dirname(__file__), "..", "uploads",
                f"survey_{sv.id}", "outputs", "contours.geojson")
            if os.path.exists(cpath):
                with open(cpath) as f:
                    import json as _json
                    contour_geojson = _json.load(f)
                break

    return {
        "id":            site.id,
        "name":          site.name,
        "location":      site.location,
        "state":         site.state,
        "mine_type":     site.mine_type,
        "latitude":      site.latitude,
        "longitude":     site.longitude,
        "area_km2":      site.area_km2,
        "max_depth_m":   site.max_depth_m,
        "elevation_min": site.elevation_min,
        "elevation_max": site.elevation_max,
        "status":        site.status,
        "surveys": [
            {
                "id":                sv.id,
                "name":              sv.name,
                "status":            sv.status,
                "progress":          sv.progress,
                "image_count":       sv.image_count,
                "images_passed":     sv.images_passed,
                "images_rejected":   sv.images_rejected,
                "gcp_count":         sv.gcp_count,
                "gcp_rmse":          sv.gcp_rmse,
                "stockpile_volume":  sv.stockpile_volume,
                "cut_volume":        sv.cut_volume,
                "fill_volume":       sv.fill_volume,
                "net_change":        sv.net_change,
                "reference_elev":    sv.reference_elev,
                "dem_resolution":    sv.dem_resolution,
                "dem_crs":           sv.dem_crs,
                "drone_model":       sv.drone_model,
                "flying_height_m":   sv.flying_height_m,
                "pipeline_steps":    json.loads(sv.pipeline_steps) if sv.pipeline_steps else [],
                "created_at":        sv.created_at.isoformat() if sv.created_at else None,
                "completed_at":      sv.completed_at.isoformat() if sv.completed_at else None,
            }
            for sv in surveys
        ],
        "volume_history": [
            {"month": v.month_label, "volume": v.volume_m3}
            for v in vol_history
        ],
        "contour_geojson": contour_geojson,
    }


@router.post("/")
def create_site(data: SiteCreate, db: Session = Depends(get_db),
                user=Depends(get_current_user)):
    site = MineSite(**data.dict(), owner_id=user.id)
    db.add(site)
    db.commit()
    db.refresh(site)
    return {"id": site.id, "name": site.name}


@router.delete("/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db),
                user=Depends(get_current_user)):
    site = db.query(MineSite).filter(
        MineSite.id == site_id, MineSite.owner_id == user.id).first()
    if not site:
        raise HTTPException(404, "Site not found")
    db.delete(site)
    db.commit()
    return {"deleted": site_id}
