import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from passlib.context import CryptContext
from database import init_db, SessionLocal, User

app = FastAPI(title="MineVisionAI API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────
# Add your Vercel URL here. FRONTEND_URL env var lets you override at runtime.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "https://mine-vision-ai.vercel.app",
]
extra = os.getenv("FRONTEND_URL", "")
if extra:
    ALLOWED_ORIGINS.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes.auth    import router as auth_router
from routes.sites   import router as sites_router
from routes.surveys import router as surveys_router
from routes.reports import router as reports_router

app.include_router(auth_router)
app.include_router(sites_router)
app.include_router(surveys_router)
app.include_router(reports_router)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def startup():
    init_db()
    print("MineVisionAI API ready")


@app.get("/")
def root():
    return {"service": "MineVisionAI API", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Registration ───────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

class RegisterIn(BaseModel):
    name: str
    email: str
    password: str

@app.post("/register", tags=["auth"])
def register(data: RegisterIn):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(400, "Email already registered")
        user = User(
            name=data.name,
            email=data.email,
            hashed_password=pwd_ctx.hash(data.password),
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "name": user.name, "email": user.email}
    finally:
        db.close()
