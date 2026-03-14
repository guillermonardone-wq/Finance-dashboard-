"""FastAPI application for the analysis service.

Exposes health check and serves as the entry point for the HTTP API.
The main analysis work is done by the Redis worker (worker.py).
"""

from fastapi import FastAPI
import redis
from app.config import settings

app = FastAPI(
    title="Racing Coach Analysis Service",
    version=settings.analysis_version,
)


@app.get("/health")
async def health():
    """Health check — verifies Redis connectivity."""
    health_status = {"status": "ok", "version": settings.analysis_version}

    try:
        r = redis.from_url(settings.redis_url)
        r.ping()
        health_status["redis"] = "connected"
    except Exception as e:
        health_status["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"

    return health_status
