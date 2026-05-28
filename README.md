# MineVisionAI — Mine Survey Management Platform

> Drone-based volume survey platform for opencast mines.  
> Demo → Medium → Enterprise in one codebase.

---

## Quick Start

```bash
# 1. Install backend deps (once)
cd backend && pip install -r requirements.txt

# 2. Install frontend deps (once)
cd frontend && npm install

# 3. Launch everything
cd .. && bash start.sh
```

Open → **http://localhost:5173**  
Login → `admin@minevisionai.in` / `demo1234`

---

## Features (Demo)

| Feature | Status |
|---|---|
| Login / JWT auth | ✅ |
| Dashboard — stats + mine site cards | ✅ |
| Mine Sites list with search | ✅ |
| Mine Detail — Leaflet map, GCP markers, flight path | ✅ |
| Volume history chart (Recharts) | ✅ |
| GIS layer listing + export buttons | ✅ |
| Upload drag-drop (JPG/TIF/DNG) | ✅ |
| GCP file import (.csv) | ✅ |
| Real processing pipeline (5 steps) with live polling | ✅ |
| Auto PDF report generation (ReportLab) | ✅ |
| Auto Excel report generation (openpyxl) | ✅ |
| Report download | ✅ |
| Settings page | ✅ |
| Responsive dark UI | ✅ |

---

## Project Structure

```
MineVisionAI/
├── backend/
│   ├── main.py               # FastAPI app + CORS + startup
│   ├── database.py           # SQLAlchemy models + seed data
│   ├── routes/
│   │   ├── auth.py           # Login, JWT, /me
│   │   ├── sites.py          # Mine site CRUD + volume history
│   │   ├── surveys.py        # Upload, process, poll status
│   │   └── reports.py        # List + download PDF/Excel
│   ├── processing/
│   │   └── report_gen.py     # ReportLab PDF + openpyxl Excel
│   └── uploads/              # Uploaded images + generated reports
│
├── frontend/
│   └── src/
│       ├── App.jsx            # Router + protected routes
│       ├── AuthContext.jsx    # Login state + JWT storage
│       ├── api/client.js      # Axios with auth interceptor
│       ├── components/
│       │   └── Sidebar.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Sites.jsx
│           ├── MineDetail.jsx  # Leaflet map + volume chart
│           ├── Upload.jsx      # Drag-drop + live pipeline
│           ├── Reports.jsx
│           └── Settings.jsx
│
└── start.sh                   # One-command launcher
```

---

## Tech Stack

### Demo Phase (current)
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 |
| Routing | React Router v6 |
| Maps | Leaflet + react-leaflet |
| Charts | Recharts |
| HTTP | Axios |
| Backend | FastAPI + Uvicorn |
| Database | SQLite (via SQLAlchemy) |
| Auth | JWT (python-jose) + bcrypt |
| PDF Reports | ReportLab |
| Excel Reports | openpyxl |
| File uploads | python-multipart + aiofiles |

### Medium Phase (next)
- PostgreSQL + PostGIS (replace SQLite)
- Redis + Celery (replace BackgroundTasks)
- MinIO (replace local file storage)
- Real GDAL/Rasterio for DEM processing
- OpenDroneMap for photogrammetry
- Capacitor (Android) + Tauri (Desktop)
- WebSockets for real-time pipeline updates

### Enterprise Phase
- Kubernetes deployment
- Multi-tenant database schema
- API Gateway + rate limiting
- CI/CD (GitHub Actions)
- Audit logs
- Cesium.js 3D visualization
- LiDAR point cloud viewer

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user |
| GET | `/sites/` | List mine sites |
| GET | `/sites/{id}` | Site detail + surveys + volume history |
| POST | `/sites/` | Create new site |
| POST | `/surveys/?site_id=N` | Create new survey |
| POST | `/surveys/{id}/upload` | Upload images/GCP files |
| POST | `/surveys/{id}/process` | Start processing pipeline |
| GET | `/surveys/{id}/status` | Poll pipeline status |
| GET | `/reports/` | List reports |
| GET | `/reports/{id}/download` | Download PDF or Excel |

Full interactive docs: **http://localhost:8000/docs**

---

## Upgrading to Medium

1. `pip install psycopg2-binary celery redis rasterio gdal`
2. Change `DATABASE_URL` in `database.py` to PostgreSQL
3. Replace `BackgroundTasks` in `surveys.py` with Celery tasks
4. Add real GDAL volume calc in `processing/volume_calc.py`
5. Point storage to MinIO: update upload paths in `surveys.py`

---

## Credits

Built with FastAPI, React, Leaflet, Recharts, ReportLab, openpyxl.  
Map tiles © OpenStreetMap contributors.
