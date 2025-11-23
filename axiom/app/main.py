"""
Axiom - Game Theory Analysis Service
FastAPI application entry point
"""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from .core.config import settings
from .api import health, equilibrium, strategies, tournament, llm_agents, policies, experiments

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    logger.debug(f"Request headers: {dict(request.headers)}")

    response = await call_next(request)

    logger.info(f"Response status: {response.status_code} for {request.method} {request.url.path}")
    return response

# Include API routers
app.include_router(health.router)
app.include_router(equilibrium.router)
app.include_router(strategies.router)
app.include_router(tournament.router)
app.include_router(llm_agents.router)
app.include_router(policies.router)
app.include_router(experiments.router)

# Serve static files (built Svelte frontend)
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/")
    async def serve_frontend():
        """Serve the Svelte frontend"""
        return FileResponse(str(static_dir / "index.html"))
else:
    @app.get("/")
    async def root():
        """Root endpoint (when frontend not built)"""
        return {
            "service": "Axiom",
            "version": settings.api_version,
            "description": "Game Theory Analysis Service",
            "docs": "/docs",
            "frontend": "Not built. Run: cd frontend && npm run build",
            "endpoints": {
                "health": "/health",
                "equilibrium": "/equilibrium",
                "strategies": "/strategies",
                "tournament": "/tournament",
                "llm": "/llm",
                "policies": "/policies",
                "experiments": "/experiments"
            }
        }
