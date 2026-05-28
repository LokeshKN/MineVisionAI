from sqlalchemy import (create_engine, Column, Integer, String, Float,
                        DateTime, Text, ForeignKey, Boolean)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone

DATABASE_URL = "sqlite:///./minevision.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default="engineer")
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    sites           = relationship("MineSite", back_populates="owner")


class MineSite(Base):
    __tablename__ = "mine_sites"
    id            = Column(Integer, primary_key=True)
    name          = Column(String, nullable=False)
    location      = Column(String)
    state         = Column(String)
    mine_type     = Column(String)
    latitude      = Column(Float)           # centre lat from GCPs / user input
    longitude     = Column(Float)           # centre lng
    area_km2      = Column(Float)
    max_depth_m   = Column(Float)
    elevation_min = Column(Float)
    elevation_max = Column(Float)
    status        = Column(String, default="active")
    owner_id      = Column(Integer, ForeignKey("users.id"))
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    owner         = relationship("User", back_populates="sites")
    surveys       = relationship("Survey", back_populates="site")


class Survey(Base):
    """One survey session = one drone flight + processing run."""
    __tablename__ = "surveys"
    id               = Column(Integer, primary_key=True)
    site_id          = Column(Integer, ForeignKey("mine_sites.id"))
    name             = Column(String)
    status           = Column(String, default="pending")
    # pending | preprocessing | aligning | dense_cloud | orthomosaic
    # contours | volume | reporting | complete | failed
    progress         = Column(Integer, default=0)

    # Step 4 – image preprocessing results
    image_count      = Column(Integer, default=0)
    images_passed    = Column(Integer, default=0)   # passed blur / geotag check
    images_rejected  = Column(Integer, default=0)
    blur_threshold   = Column(Float, default=100.0)
    geotag_count     = Column(Integer, default=0)

    # Step 5 – GCPs
    gcp_count        = Column(Integer, default=0)
    gcp_rmse         = Column(Float)

    # Step 6-7 – computed GIS / volume results
    stockpile_volume = Column(Float)   # m³ above reference plane
    cut_volume       = Column(Float)
    fill_volume      = Column(Float)
    net_change       = Column(Float)
    reference_elev   = Column(Float)   # base plane used for volume
    dem_resolution   = Column(Float)   # metres per pixel
    dem_crs          = Column(String)
    ortho_resolution = Column(Float)

    # Hardware / flight
    drone_model      = Column(String)
    flying_height_m  = Column(Float)

    # Pipeline log (JSON list of step objects)
    pipeline_steps   = Column(Text, default="[]")

    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at     = Column(DateTime)

    site    = relationship("MineSite", back_populates="surveys")
    files   = relationship("UploadedFile", back_populates="survey")
    reports = relationship("Report", back_populates="survey")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id          = Column(Integer, primary_key=True)
    survey_id   = Column(Integer, ForeignKey("surveys.id"))
    filename    = Column(String)
    file_type   = Column(String)   # image | gcp | dem | dsm
    file_size   = Column(Integer)
    path        = Column(String)
    # image metadata (populated after preprocessing)
    is_geotagged = Column(Boolean)
    blur_score   = Column(Float)
    passed_qc    = Column(Boolean)
    gps_lat      = Column(Float)
    gps_lon      = Column(Float)
    gps_alt      = Column(Float)
    uploaded_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    survey       = relationship("Survey", back_populates="files")


class Report(Base):
    __tablename__ = "reports"
    id          = Column(Integer, primary_key=True)
    survey_id   = Column(Integer, ForeignKey("surveys.id"))
    site_id     = Column(Integer, ForeignKey("mine_sites.id"))
    title       = Column(String)
    report_type = Column(String)   # pdf | excel
    file_path   = Column(String)
    file_size   = Column(Integer)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    survey      = relationship("Survey", back_populates="reports")


class VolumeHistory(Base):
    __tablename__ = "volume_history"
    id          = Column(Integer, primary_key=True)
    site_id     = Column(Integer, ForeignKey("mine_sites.id"))
    survey_id   = Column(Integer, ForeignKey("surveys.id"))
    month_label = Column(String)
    volume_m3   = Column(Float)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables only — zero seed data."""
    Base.metadata.create_all(bind=engine)
