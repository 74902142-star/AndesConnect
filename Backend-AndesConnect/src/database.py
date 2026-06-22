from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import logging
from .config import settings

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("andesconnect_db")

# Base para los modelos declarativos de SQLAlchemy
Base = declarative_base()

# ==========================================
# INICIALIZACIÓN DE LA BASE DE DATOS
# ==========================================
logger.info(f"Conectando a base de datos: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG if hasattr(settings, 'DEBUG') else False,
    future=True,
    pool_pre_ping=True,
    **({} if _is_sqlite else {"connect_args": {"statement_cache_size": 0}})
)

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_local_auth_db():
    """Crea todas las tablas SQLite necesarias si no existen."""
    async with engine.begin() as conn:
        for stmt in [
            """CREATE TABLE IF NOT EXISTS perfiles (
                id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL,
                rol TEXT DEFAULT 'estudiante', ubicacion TEXT, idioma_preferido TEXT DEFAULT 'es',
                avatar_url TEXT, creado_en TEXT DEFAULT (datetime('now')), actualizado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS cursos (
                id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT, categoria TEXT,
                duracion TEXT, modulos INTEGER DEFAULT 0, nivel TEXT, instructor TEXT,
                imagen TEXT, color TEXT, disponible INTEGER DEFAULT 1,
                creado_en TEXT DEFAULT (datetime('now')), actualizado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS modulos (
                id TEXT PRIMARY KEY, curso_id TEXT NOT NULL, titulo TEXT NOT NULL,
                descripcion TEXT, orden INTEGER DEFAULT 0, tipo_contenido TEXT,
                contenido_url TEXT, duracion_minutos INTEGER,
                FOREIGN KEY (curso_id) REFERENCES cursos(id)
            )""",
            """CREATE TABLE IF NOT EXISTS inscripciones (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL,
                progreso INTEGER DEFAULT 0, descargado INTEGER DEFAULT 0,
                modulo_actual_id TEXT, tema_ui TEXT DEFAULT 'grey',
                inscrito_en TEXT DEFAULT (datetime('now')), completado_en TEXT,
                actualizado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS progreso_lecciones (
                id TEXT PRIMARY KEY, inscripcion_id TEXT NOT NULL, modulo_id TEXT NOT NULL,
                completado INTEGER DEFAULT 0, puntaje_evaluacion INTEGER,
                completado_en TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS certificados (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL,
                codigo_certificado TEXT, url_certificado TEXT,
                emitido_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS notificaciones (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, tipo TEXT,
                titulo TEXT, mensaje TEXT, leido INTEGER DEFAULT 0,
                ruta_accion TEXT, creado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS archivos_descargados (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL,
                nombre_archivo TEXT, tamano TEXT, tipo TEXT, url_local TEXT,
                descargado_en TEXT DEFAULT (datetime('now')), eliminado_en TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS nodos (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL,
                almacenamiento_usado_gb REAL DEFAULT 0, almacenamiento_max_gb REAL DEFAULT 5,
                version_app TEXT, actualizado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS cola_sincronizacion (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, nodo_id TEXT,
                accion TEXT, payload TEXT, estado TEXT, error_msg TEXT,
                creado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS faqs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, clave_pregunta TEXT,
                clave_respuesta TEXT, orden INTEGER DEFAULT 0
            )""",
            """CREATE TABLE IF NOT EXISTS logros (
                id TEXT PRIMARY KEY, titulo_clave TEXT, descripcion_clave TEXT, icono TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS logros_usuario (
                id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, logro_id TEXT NOT NULL,
                desbloqueado_en TEXT DEFAULT (datetime('now'))
            )""",
            """CREATE TABLE IF NOT EXISTS local_users (
                id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
                nombre TEXT NOT NULL, location TEXT, rol TEXT DEFAULT 'estudiante',
                created_at TEXT DEFAULT (datetime('now'))
            )""",
        ]:
            await conn.execute(text(stmt))

        existing = await conn.execute(text("SELECT COUNT(*) as cnt FROM cursos"))
        if existing.mappings().one()["cnt"] == 0:
            seed_courses = [
                ("drones-agricolas", "Drones Agricolas", "Aprende a usar drones para monitoreo y fumigacion de cultivos", "Tecnologia", "8 semanas", 6, "Intermedio", "Ing. Carlos Mendoza", "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800", "#2E7D32"),
                ("riego-inteligente", "Riego Inteligente", "Sistemas automatizados de riego por goteo y sensores de humedad", "Tecnologia", "6 semanas", 5, "Basico", "Ing. Maria Torres", "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800", "#1565C0"),
                ("negocios-rurales", "Negocios Rurales", "Emprendimiento y gestion de negocios en zonas rurales", "Negocios", "10 semanas", 8, "Basico", "Lic. Ana Garcia", "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800", "#E65100"),
                ("suelos-saludables", "Suelos Saludables", "Manejo organico del suelo y tecnicas de compostaje", "Agricultura", "5 semanas", 4, "Basico", "Ing. Roberto Sanchez", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800", "#558B2F"),
                ("apps-campesinas", "Apps para el Campo", "Desarrollo de aplicaciones moviles para comunidades rurales", "Tecnologia", "12 semanas", 10, "Avanzado", "Ing. Luis Fernandez", "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800", "#6A1B9A"),
                ("cooperativas", "Cooperativas exitosas", "Organizacion y gestion de cooperativas agricolas", "Negocios", "7 semanas", 6, "Intermedio", "Lic. Carmen Rosa", "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800", "#C62828"),
            ]
            for c in seed_courses:
                await conn.execute(text(
                    "INSERT INTO cursos (id, titulo, descripcion, categoria, duracion, modulos, nivel, instructor, imagen, color, disponible, creado_en, actualizado_en) VALUES (:id,:titulo,:descripcion,:categoria,:duracion,:modulos,:nivel,:instructor,:imagen,:color,1,datetime('now'),datetime('now'))"
                ), {"id": c[0], "titulo": c[1], "descripcion": c[2], "categoria": c[3], "duracion": c[4], "modulos": c[5], "nivel": c[6], "instructor": c[7], "imagen": c[8], "color": c[9]})

        existing_faqs = await conn.execute(text("SELECT COUNT(*) as cnt FROM faqs"))
        if existing_faqs.mappings().one()["cnt"] == 0:
            for f in [
                ("como_inscribirme", "Para inscribirte en un curso, ve a la seccion de cursos y haz clic en el boton de inscripcion.", 1),
                ("como_descargar", "Puedes descargar contenido para uso offline desde la seccion de cursos inscritos.", 2),
                ("certificados", "Los certificados se generan automaticamente al completar un curso al 100%.", 3),
                ("modo_offline", "La app funciona sin internet. Tus progresos se sincronizan cuando vuelvas a conectarte.", 4),
                ("soporte", "Puedes contactar soporte desde la seccion de Centro de Ayuda.", 5),
                ("idiomas", "La plataforma esta disponible en Espanol y Quechua.", 6),
            ]:
                await conn.execute(text("INSERT INTO faqs (clave_pregunta, clave_respuesta, orden) VALUES (:k,:r,:o)"), {"k": f[0], "r": f[1], "o": f[2]})

        existing_logros = await conn.execute(text("SELECT COUNT(*) as cnt FROM logros"))
        if existing_logros.mappings().one()["cnt"] == 0:
            for l in [
                ("first_course", "Primer Paso", "Completaste tu primer curso", "trophy"),
                ("half_progress", "A Medio Camino", "Alcanzaste 50% de progreso general", "star"),
                ("three_courses", "Estudioso", "Completaste 3 cursos", "book"),
                ("offline_master", "Maestro Offline", "Usaste la app 5 veces en modo offline", "wifi_off"),
            ]:
                await conn.execute(text("INSERT INTO logros (id, titulo_clave, descripcion_clave, icono) VALUES (:id,:t,:d,:i)"), {"id": l[0], "t": l[1], "d": l[2], "i": l[3]})

    logger.info("Tablas SQLite y datos iniciales creados.")


# Dependencia para obtener la sesión de base de datos en los routers de FastAPI
async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
            logger.debug("Transacción COMMITTED exitosamente")
        except Exception as e:
            logger.error(f"Error en transacción, haciendo ROLLBACK: {str(e)}")
            await session.rollback()
            raise
        finally:
            await session.close()
