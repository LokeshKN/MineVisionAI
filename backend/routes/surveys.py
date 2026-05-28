"""
Survey upload + processing routes.
Pipeline follows the 10-step workflow from the Drone Processing doc:
  1  Flight Planning         — site metadata saved at site creation
  2  Drone Data Collection   — images + GPS data uploaded here
  3  Data Transfer           — organised into per-survey folders
  4  Image Preprocessing     — blur detection, geotag extraction (image_prep.py)
  5  Photogrammetry          — NodeODM (if running) OR DEM uploaded directly
  6  GIS Data Processing     — rasterio: import DEM, CRS, contours (volume_calc.py)
  7  Spatial Analysis        — volume, cut/fill, pit depth (volume_calc.py)
  8  Map Production          — contour GeoJSON written to disk
  9  Output & Reporting      — PDF + Excel generated (report_gen.py)
 10  Sharing                 — download endpoints in reports.py
"""
import json, os, uuid, time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from database import (get_db, SessionLocal, Survey, UploadedFile,
                      MineSite, VolumeHistory, Report)
from routes.auth import get_current_user
from datetime import datetime, timezone
import aiofiles

router = APIRouter(prefix="/surveys", tags=["surveys"])

UPLOAD_BASE = os.path.join(os.path.dirname(__file__), "..", "uploads")

INITIAL_STEPS = [
    {"id": "preprocessing",  "name": "Image Preprocessing",          "status": "pending", "detail": ""},
    {"id": "odm",            "name": "Photogrammetry (ODM)",          "status": "pending", "detail": ""},
    {"id": "gis",            "name": "GIS Data Processing",           "status": "pending", "detail": ""},
    {"id": "volume",         "name": "Spatial Analysis & Volumes",    "status": "pending", "detail": ""},
    {"id": "map_production", "name": "Map Production (Contours)",     "status": "pending", "detail": ""},
    {"id": "reporting",      "name": "Output & Report Generation",    "status": "pending", "detail": ""},
]


# ── helpers ────────────────────────────────────────────────────────────────

def survey_dir(survey_id: int, sub: str) -> str:
    d = os.path.join(UPLOAD_BASE, f"survey_{survey_id}", sub)
    os.makedirs(d, exist_ok=True)
    return d


def _set_step(db, survey, idx: int, status: str, detail: str, progress: int):
    steps = json.loads(survey.pipeline_steps)
    steps[idx]["status"] = status
    steps[idx]["detail"] = detail
    survey.pipeline_steps = json.dumps(steps)
    survey.progress = progress
    db.commit()


# ── Create survey ──────────────────────────────────────────────────────────

@router.post("/")
def create_survey(site_id: int,
                  drone_model: str = "",
                  flying_height_m: float = None,
                  db: Session = Depends(get_db),
                  user=Depends(get_current_user)):
    site = db.query(MineSite).filter(
        MineSite.id == site_id, MineSite.owner_id == user.id).first()
    if not site:
        raise HTTPException(404, "Site not found")

    survey = Survey(
        site_id=site_id,
        name=f"{site.name} — {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M')} UTC",
        status="pending",
        progress=0,
        drone_model=drone_model or None,
        flying_height_m=flying_height_m,
        pipeline_steps=json.dumps(INITIAL_STEPS),
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"survey_id": survey.id, "name": survey.name}


# ── Upload files ───────────────────────────────────────────────────────────

@router.post("/{survey_id}/upload")
async def upload_files(
    survey_id: int,
    files: list[UploadFile] = File(...),
    file_type: str = Form("image"),   # image | gcp | dem | dsm
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")

    subdir = {"image": "images", "gcp": "gcp",
              "dem": "dem", "dsm": "dem"}.get(file_type, "misc")
    dest_dir = survey_dir(survey_id, subdir)
    saved = []

    for f in files:
        safe_name = f"{uuid.uuid4().hex}_{f.filename}"
        path = os.path.join(dest_dir, safe_name)
        content = await f.read()
        async with aiofiles.open(path, "wb") as out:
            await out.write(content)

        uf = UploadedFile(
            survey_id=survey_id,
            filename=f.filename,
            file_type=file_type,
            file_size=len(content),
            path=path,
        )
        db.add(uf)
        saved.append({"filename": f.filename, "size": len(content), "path": path})

    if file_type == "image":
        survey.image_count = (survey.image_count or 0) + len(files)
    elif file_type == "gcp":
        survey.gcp_count = (survey.gcp_count or 0) + len(files)

    db.commit()
    return {"uploaded": len(saved), "files": saved}


# ── Start processing ───────────────────────────────────────────────────────

@router.post("/{survey_id}/process")
def start_processing(
    survey_id: int,
    background_tasks: BackgroundTasks,
    reference_elevation: float = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")
    if survey.status == "processing":
        return {"message": "Already processing"}

    survey.status = "processing"
    survey.progress = 0
    db.commit()
    background_tasks.add_task(run_pipeline, survey_id, reference_elevation)
    return {"message": "Processing started", "survey_id": survey_id}


# ── Status poll ────────────────────────────────────────────────────────────

@router.get("/{survey_id}/status")
def survey_status(survey_id: int, db: Session = Depends(get_db)):
    s = db.query(Survey).filter(Survey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Not found")
    return {
        "id":                 s.id,
        "status":             s.status,
        "progress":           s.progress,
        "pipeline_steps":     json.loads(s.pipeline_steps) if s.pipeline_steps else [],
        "stockpile_volume":   s.stockpile_volume,
        "cut_volume":         s.cut_volume,
        "fill_volume":        s.fill_volume,
        "net_change":         s.net_change,
        "reference_elev":     s.reference_elev,
        "dem_resolution":     s.dem_resolution,
        "dem_crs":            s.dem_crs,
        "images_passed":      s.images_passed,
        "images_rejected":    s.images_rejected,
        "gcp_rmse":           s.gcp_rmse,
    }


# ── Processing pipeline ────────────────────────────────────────────────────

def run_pipeline(survey_id: int, user_reference_elev=None):
    from processing.image_prep  import preprocess_batch
    from processing.gcp_parser  import parse_gcp_file
    from processing.volume_calc import dem_stats, calculate_volume, generate_contours
    from processing.odm_client  import is_available as odm_available, create_task, wait_for_completion, download_outputs
    from processing.report_gen  import generate_pdf, generate_excel

    db = SessionLocal()
    try:
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            return
        site = db.query(MineSite).filter(MineSite.id == survey.site_id).first()

        def step(idx, status, detail, pct):
            _set_step(db, survey, idx, status, detail, pct)

        # ── Collect uploaded paths ─────────────────────────────────────────
        files = db.query(UploadedFile).filter(UploadedFile.survey_id == survey_id).all()
        image_paths = [f.path for f in files if f.file_type == "image" and os.path.exists(f.path)]
        gcp_files   = [f      for f in files if f.file_type == "gcp"   and os.path.exists(f.path)]
        dem_files   = [f      for f in files if f.file_type in ("dem","dsm") and os.path.exists(f.path)]

        # ══════════════════════════════════════════════════════════════════
        # STEP 4 — Image Preprocessing
        # ══════════════════════════════════════════════════════════════════
        step(0, "running", f"Checking {len(image_paths)} images…", 5)

        if image_paths:
            qc = preprocess_batch(image_paths, blur_threshold=survey.blur_threshold or 100.0)
            survey.images_passed  = qc["passed"]
            survey.images_rejected = qc["rejected"]
            survey.geotag_count   = qc["geotagged"]

            # Update each UploadedFile row with QC results
            qc_map = {r["filename"]: r for r in qc["images"]}
            for uf in [f for f in files if f.file_type == "image"]:
                r = qc_map.get(uf.filename) or qc_map.get(os.path.basename(uf.path))
                if r:
                    uf.blur_score   = r.get("blur_score")
                    uf.passed_qc    = r.get("passed")
                    uf.is_geotagged = r.get("is_geotagged")
                    uf.gps_lat      = r.get("gps_lat")
                    uf.gps_lon      = r.get("gps_lon")
                    uf.gps_alt      = r.get("gps_alt")

            # Update site centre from image GPS if not already set
            if qc["centre_lat"] and not site.latitude:
                site.latitude  = qc["centre_lat"]
                site.longitude = qc["centre_lon"]

            # Remove rejected images from processing list
            good_paths = [image_paths[i] for i, r in enumerate(qc["images"]) if r.get("passed")]
            cameras = ", ".join(qc["cameras"]) if qc["cameras"] else "unknown"
            detail = (f"{qc['passed']}/{qc['total']} passed QC · "
                      f"{qc['rejected']} blurry/unreadable · "
                      f"{qc['geotagged']} geotagged · {cameras}")
            step(0, "complete", detail, 18)
            db.commit()
        else:
            step(0, "skipped", "No drone images uploaded — using DEM directly", 18)
            good_paths = []

        # Parse GCP
        gcp_data = None
        if gcp_files:
            gf = gcp_files[0]
            with open(gf.path, "rb") as fh:
                gcp_data = parse_gcp_file(fh.read(), gf.filename)
            survey.gcp_count = gcp_data.get("count", 0)
            # Update site centre from GCPs if not yet set
            if gcp_data.get("centre_lat") and not site.latitude:
                site.latitude  = gcp_data["centre_lat"]
                site.longitude = gcp_data["centre_lon"]
            db.commit()

        # ══════════════════════════════════════════════════════════════════
        # STEP 5 — Photogrammetry (NodeODM)
        # ══════════════════════════════════════════════════════════════════
        odm_dem_path = None

        if dem_files:
            # User uploaded a DEM directly — skip ODM
            step(1, "skipped",
                 f"DEM uploaded directly ({len(dem_files)} file(s)) — ODM not needed",
                 35)
            odm_dem_path = dem_files[0].path

        elif good_paths and odm_available():
            step(1, "running",
                 f"Uploading {len(good_paths)} images to NodeODM…", 22)
            gcp_path = gcp_files[0].path if gcp_files else None
            task = create_task(good_paths, gcp_path=gcp_path,
                               name=survey.name)
            if "error" in task:
                step(1, "failed", task["error"], 22)
            else:
                task_id = task["task_id"]
                step(1, "running", f"ODM task {task_id} queued…", 25)

                def on_progress(s):
                    pct = 25 + int(s.get("progress", 0) * 0.10)
                    _set_step(db, survey, 1, "running",
                              f"ODM processing… {s.get('progress',0):.0f}%", pct)

                final = wait_for_completion(task_id, poll_interval=15,
                                            on_progress=on_progress)
                if final["status"] == "complete":
                    out_dir = survey_dir(survey_id, "outputs")
                    dl = download_outputs(task_id, out_dir)
                    odm_dem_path = dl.get("dtm") or dl.get("dsm")
                    step(1, "complete",
                         f"ODM complete · outputs: {', '.join(dl.keys())}", 35)
                else:
                    step(1, "failed",
                         f"ODM status: {final['status']} — {final.get('error','')}",
                         35)

        elif good_paths:
            step(1, "skipped",
                 "NodeODM not running · Install: docker run -p 3000:3000 opendronemap/nodeodm",
                 35)
        else:
            step(1, "skipped", "No images to process", 35)

        # ══════════════════════════════════════════════════════════════════
        # STEPS 6 & 7 — GIS Processing + Volume Calculation
        # ══════════════════════════════════════════════════════════════════
        if odm_dem_path and os.path.exists(odm_dem_path):
            # Step 6 — GIS import
            step(2, "running", "Reading DEM · checking CRS · pixel size…", 40)
            stats = dem_stats(odm_dem_path)
            survey.dem_resolution = stats.get("pixel_size_m")
            survey.dem_crs        = stats.get("crs")
            if stats.get("elev_min"):
                site.elevation_min = stats["elev_min"]
                site.elevation_max = stats["elev_max"]
            detail = (f"CRS: {stats.get('crs','?')} · "
                      f"{stats.get('pixel_size_m','?')} m/px · "
                      f"elevation {stats.get('elev_min','?')}–{stats.get('elev_max','?')} m")
            step(2, "complete", detail, 52)
            db.commit()

            # Step 7 — Volume
            step(3, "running", "Computing stockpile volume (TIN method)…", 56)
            vol = calculate_volume(odm_dem_path,
                                   reference_elevation=user_reference_elev)
            if "error" not in vol:
                survey.stockpile_volume = vol["stockpile_volume_m3"]
                survey.cut_volume       = vol["cut_volume_m3"]
                survey.fill_volume      = vol.get("fill_volume_m3", 0)
                survey.net_change       = vol["net_change_m3"]
                survey.reference_elev   = vol["reference_elevation_m"]
                if vol.get("total_area_km2"):
                    site.area_km2 = vol["total_area_km2"]
                db.commit()
                detail = (f"Stockpile: {vol['stockpile_volume_m3']:,.0f} m³ · "
                          f"Cut: {vol['cut_volume_m3']:,.0f} m³ · "
                          f"Ref plane: {vol['reference_elevation_m']:.1f} m · "
                          f"Area: {vol['total_area_km2']:.3f} km²")
                step(3, "complete", detail, 70)
            else:
                step(3, "failed", vol["error"], 70)

            # Step 8 — Contours
            step(4, "running", "Generating contour lines (1 m interval)…", 74)
            contour_path = os.path.join(survey_dir(survey_id, "outputs"),
                                        "contours.geojson")
            cresult = generate_contours(odm_dem_path,
                                        interval=1.0,
                                        output_path=contour_path)
            if "error" not in cresult:
                step(4, "complete",
                     f"{cresult['contour_count']} contour lines · "
                     f"1 m interval · saved to contours.geojson", 80)
            else:
                step(4, "failed", cresult["error"], 80)

        else:
            # No DEM available
            msg = "No DEM available — upload a GeoTIFF or run ODM to generate one"
            step(2, "skipped", msg, 52)
            step(3, "skipped", msg, 70)
            step(4, "skipped", msg, 80)

        # ══════════════════════════════════════════════════════════════════
        # STEP 9 — Report Generation
        # ══════════════════════════════════════════════════════════════════
        step(5, "running", "Generating PDF + Excel reports…", 84)
        try:
            db.refresh(survey)
            db.refresh(site)
            pdf_path  = generate_pdf(survey, site)
            xlsx_path = generate_excel(survey, site, db)

            for rtype, rpath, rtitle in [
                ("pdf",   pdf_path,  f"{site.name} — Volume Survey Report"),
                ("excel", xlsx_path, f"{site.name} — Volume Data Export"),
            ]:
                if os.path.exists(rpath):
                    db.add(Report(
                        survey_id=survey_id,
                        site_id=site.id,
                        title=rtitle,
                        report_type=rtype,
                        file_path=rpath,
                        file_size=os.path.getsize(rpath),
                    ))

            step(5, "complete",
                 "PDF survey report + Excel data export ready for download", 100)
        except Exception as e:
            import traceback; traceback.print_exc()
            step(5, "failed", str(e), 100)

        # ── Finalise ──────────────────────────────────────────────────────
        survey.status       = "complete"
        survey.completed_at = datetime.now(timezone.utc)
        month = datetime.now(timezone.utc).strftime("%b-%y")
        if survey.stockpile_volume:
            db.add(VolumeHistory(
                site_id=survey.site_id,
                survey_id=survey_id,
                month_label=month,
                volume_m3=survey.stockpile_volume,
            ))
        db.commit()

    except Exception as e:
        import traceback; traceback.print_exc()
        try:
            db.query(Survey).filter(Survey.id == survey_id).update({"status": "failed"})
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
