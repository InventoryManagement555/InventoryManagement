import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, items, stock, dashboard, forecasts, assistant, alerts, audit, export

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Lifespan: create tables on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables...")
    # Import models so they register with Base.metadata
    from app.models import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")
    yield


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="D-Mart Inventory Management System API",
    description="Backend API for the D-Mart-style Inventory Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handler — never leak stack traces
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred"},
    )


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(items.router)
app.include_router(stock.router)
app.include_router(dashboard.router)
app.include_router(forecasts.router)
app.include_router(assistant.router)
app.include_router(alerts.router)
app.include_router(audit.router)
app.include_router(export.router)


# ---------------------------------------------------------------------------
# Health check (also serves as the /me redirect base)
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "D-Mart IMS API"}


# Re-map /me to auth's get_me for convenience (frontend calls GET /me, not GET /auth/me)
from app.core.security import get_current_user
from app.schemas.schemas import UserResponse
from fastapi import Depends
from app.models.models import User


@app.get("/me", response_model=UserResponse, tags=["auth"])
def get_me_root(current_user: User = Depends(get_current_user)):
    return UserResponse.from_orm_user(current_user)
