from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db, Report, MineSite
from routes.auth import get_current_user
import os

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/")
def list_reports(db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Get all sites for this user
    site_ids = [s.id for s in db.query(MineSite).filter(MineSite.owner_id == user.id).all()]
    reports = db.query(Report).filter(Report.site_id.in_(site_ids)).order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "report_type": r.report_type,
            "file_size": r.file_size,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "survey_id": r.survey_id,
            "site_id": r.site_id,
        }
        for r in reports
    ]


@router.get("/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report or not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(404, "Report file not found")
    media = "application/pdf" if report.report_type == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ext = ".pdf" if report.report_type == "pdf" else ".xlsx"
    return FileResponse(report.file_path, media_type=media, filename=f"{report.title}{ext}")


@router.get("/stats")
def report_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    site_ids = [s.id for s in db.query(MineSite).filter(MineSite.owner_id == user.id).all()]
    total = db.query(Report).filter(Report.site_id.in_(site_ids)).count()
    return {"total_reports": total}
