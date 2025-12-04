from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router
from app.api.health import health_router

app = FastAPI(
    title="SamSyn API",
    description="Marine Spatial Planning Backend",
    version="0.1.0",
)

# CORS - Parse comma-separated origins from settings
allowed_origins = [origin.strip() for origin in settings.FRONTEND_URL.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, tags=["health"])
app.include_router(api_router, prefix="/api/v1")
