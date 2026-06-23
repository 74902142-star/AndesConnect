from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from .components.controllers import (
    cursos_router, inscripciones_router, certificados_router, 
    notificaciones_router, sync_router, auth_router, archivos_descargados_router,
    logros_router, faqs_router, uploads_router
)
from .database import async_session, init_local_auth_db
from .config import settings
from sqlalchemy import text
from datetime import datetime, timezone

app = FastAPI(
    title="AndesConnect API",
    description="Backend de la plataforma AndesConnect.",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static uploads - safe for Vercel
UPLOAD_DIR = "/tmp/uploads" if os.environ.get("VERCEL") else "uploads"
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
except Exception:
    pass

# DB init flag
_db_initialized = False

@app.middleware("http")
async def ensure_db_init(request, call_next):
    global _db_initialized
    if not _db_initialized:
        try:
            await init_local_auth_db()
            _db_initialized = True
        except Exception as e:
            print(f"DB init error: {e}")
    response = await call_next(request)
    return response

# Routers
app.include_router(cursos_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(inscripciones_router, prefix="/api")
app.include_router(certificados_router, prefix="/api")
app.include_router(notificaciones_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(archivos_descargados_router, prefix="/api")
app.include_router(logros_router, prefix="/api")
app.include_router(faqs_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")

@app.get("/")
async def root():
    return {"app": "AndesConnect API", "status": "online", "documentation": "/docs"}

@app.get("/health")
async def health_check():
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
