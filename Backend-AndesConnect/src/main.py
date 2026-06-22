from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from .components.controllers import (
    cursos_router, inscripciones_router, certificados_router, 
    notificaciones_router, sync_router, auth_router, archivos_descargados_router,
    logros_router, faqs_router, uploads_router
)
from .database import async_session, init_local_auth_db, _sqlite_path
from .config import settings
from sqlalchemy import text
from datetime import datetime, timezone
import aiosqlite

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

@app.get("/api/debug/db")
async def debug_db():
    if not _sqlite_path:
        return {"error": "not sqlite"}
    try:
        async with aiosqlite.connect(_sqlite_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM cursos")
            cursos = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM modulos")
            modulos = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM local_users")
            users = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM faqs")
            faqs = (await cursor.fetchone())[0]
            return {"cursos": cursos, "modulos": modulos, "users": users, "faqs": faqs}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug/seed-modulos")
async def debug_seed_modulos():
    if not _sqlite_path:
        return {"error": "not sqlite"}
    try:
        import uuid as _uuid
        async with aiosqlite.connect(_sqlite_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM modulos")
            count = (await cursor.fetchone())[0]
            if count == 0:
                await db.execute(
                    "INSERT INTO modulos (id, curso_id, titulo, descripcion, orden, tipo_contenido, contenido_url, duracion_minutos) VALUES (?,?,?,?,?,?,?,?)",
                    (str(_uuid.uuid4()), "drones-agricolas", "Test Modulo", "Test", 1, "video", "https://example.com", 30)
                )
                await db.commit()
                cursor = await db.execute("SELECT COUNT(*) FROM modulos")
                return {"status": "inserted", "count": (await cursor.fetchone())[0]}
            return {"status": "already_has", "count": count}
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
