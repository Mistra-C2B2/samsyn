import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import health_router
from app.api.v1.router import api_router
from app.config import settings


class TileRequestFilter(logging.Filter):
    """
    Filter out tile request logs to reduce noise.

    Tile servers typically handle hundreds of requests per page load,
    so logging each one clutters the logs without providing value.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Filter out tile requests from access logs
        # Check both the formatted message and the args
        message = record.getMessage()
        if "/api/v1/titiler/tiles/" in message:
            return False
        return True


# Configure logging to filter tile requests
logging.getLogger("uvicorn.access").addFilter(TileRequestFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifespan - startup and shutdown.

    Creates a shared httpx.AsyncClient for all external HTTP requests
    to prevent connection pool exhaustion.
    """
    # Startup: Create shared HTTP client with connection pooling
    limits = httpx.Limits(
        max_connections=settings.HTTP_POOL_CONNECTIONS,
        max_keepalive_connections=settings.HTTP_POOL_MAXSIZE,
        keepalive_expiry=settings.HTTP_KEEPALIVE_EXPIRY,
    )

    app.state.http_client = httpx.AsyncClient(
        limits=limits,
        timeout=httpx.Timeout(settings.HTTP_TIMEOUT),
        follow_redirects=True,
    )

    yield

    # Shutdown: Close HTTP client and cleanup connections
    await app.state.http_client.aclose()


app = FastAPI(
    title="SamSyn API",
    description="Marine Spatial Planning Backend",
    version="0.1.0",
    lifespan=lifespan,
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
