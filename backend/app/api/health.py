from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

health_router = APIRouter()


@health_router.get("/health")
def health_check():
    """Basic health check endpoint"""
    return {"status": "ok"}


@health_router.get("/health/db")
def health_check_db(db: Session = Depends(get_db)):
    """Health check with database connection test"""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}
