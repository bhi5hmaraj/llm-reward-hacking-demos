"""
Development server runner
"""

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,  # Auto-reload for development
        log_level=settings.log_level.lower()
    )
