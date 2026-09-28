"""
FastAPI application entrypoint.

Run with: uvicorn hms.api.main:app --reload --port 8000

Interactive OpenAPI/Swagger docs are served automatically at /docs (and
machine-readable schema at /openapi.json) -- this satisfies SRS §4.4.6's
API-documentation NFR "for real" now that we're back to a web architecture
(see docs/NFR_DISPOSITION.md for the revision history).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from hms.db import init_db
from hms.services.exceptions import (
    AuthenticationError,
    CapacityExceededError,
    HMSNotFoundError,
    HMSPermissionError,
    HMSValidationError,
)

from hms.api.routers import (
    allocations,
    attendance,
    auth,
    complaints,
    fees,
    hostels,
    leaves,
    pg,
    reports,
    settings,
    staff,
    students,
    visitors,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Hostel Management System API",
    description="REST API for the HMS 3-tier web architecture (SRS-aligned).",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for the local Vite dev server. Restrict origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Global exception handlers: no raw stack traces ever reach the client ---


@app.exception_handler(HMSPermissionError)
def handle_permission_error(request: Request, exc: HMSPermissionError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(AuthenticationError)
def handle_auth_error(request: Request, exc: AuthenticationError):
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(HMSNotFoundError)
def handle_not_found(request: Request, exc: HMSNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(HMSValidationError)
def handle_validation_error(request: Request, exc: HMSValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(CapacityExceededError)
def handle_capacity_error(request: Request, exc: CapacityExceededError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


_logger = logging.getLogger("hms.api")


@app.exception_handler(Exception)
def handle_unexpected(request: Request, exc: Exception):
    # Full traceback goes to the server log only; the client never sees a
    # raw stack trace (SRS error-handling requirement).
    _logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(students.router)
app.include_router(hostels.router)
app.include_router(hostels.rooms_router)
app.include_router(allocations.router)
app.include_router(fees.router)
app.include_router(complaints.router)
app.include_router(visitors.router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(staff.router)
app.include_router(reports.router)
app.include_router(settings.router)
for _router in (pg.maintenance, pg.menu, pg.ac, pg.parents, pg.announcements, pg.dashboard):
    app.include_router(_router)
