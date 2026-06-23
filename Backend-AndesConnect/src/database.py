from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import logging
import hashlib
import uuid as _uuid
import aiosqlite
from .config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("andesconnect_db")

Base = declarative_base()

logger.info(f"DB: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Extract raw sqlite path from the URL
_sqlite_path = None
if _is_sqlite:
    # sqlite+aiosqlite:////tmp/file -> /tmp/file
    # sqlite+aiosqlite:///./file -> ./file
    raw = settings.DATABASE_URL.split("sqlite+aiosqlite://")[-1]
    # Remove leading slashes, then reconstruct
    if raw.startswith("////"):
        _sqlite_path = raw[3:]  # //tmp/file -> /tmp/file
    elif raw.startswith("///"):
        _sqlite_path = raw[2:]  # /file
    elif raw.startswith("//"):
        _sqlite_path = raw[1:]  # /file
    else:
        _sqlite_path = raw

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
    if not _sqlite_path:
        return

    async with aiosqlite.connect(_sqlite_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")

        for stmt in [
            "CREATE TABLE IF NOT EXISTS perfiles (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL, rol TEXT DEFAULT 'estudiante', ubicacion TEXT, idioma_preferido TEXT DEFAULT 'es', avatar_url TEXT, creado_en TEXT DEFAULT (datetime('now')), actualizado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS cursos (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT, categoria TEXT, duracion TEXT, modulos INTEGER DEFAULT 0, nivel TEXT, instructor TEXT, imagen TEXT, color TEXT, disponible INTEGER DEFAULT 1, creado_en TEXT DEFAULT (datetime('now')), actualizado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS modulos (id TEXT PRIMARY KEY, curso_id TEXT NOT NULL, titulo TEXT NOT NULL, descripcion TEXT, orden INTEGER DEFAULT 0, tipo_contenido TEXT, contenido_url TEXT, duracion_minutos INTEGER, FOREIGN KEY (curso_id) REFERENCES cursos(id))",
            "CREATE TABLE IF NOT EXISTS inscripciones (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL, progreso INTEGER DEFAULT 0, descargado INTEGER DEFAULT 0, modulo_actual_id TEXT, tema_ui TEXT DEFAULT 'grey', inscrito_en TEXT DEFAULT (datetime('now')), completado_en TEXT, actualizado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS progreso_lecciones (id TEXT PRIMARY KEY, inscripcion_id TEXT NOT NULL, modulo_id TEXT NOT NULL, completado INTEGER DEFAULT 0, puntaje_evaluacion INTEGER, completado_en TEXT)",
            "CREATE TABLE IF NOT EXISTS certificados (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL, codigo_certificado TEXT, url_certificado TEXT, emitido_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS notificaciones (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, tipo TEXT, titulo TEXT, mensaje TEXT, leido INTEGER DEFAULT 0, ruta_accion TEXT, creado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS archivos_descargados (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, curso_id TEXT NOT NULL, nombre_archivo TEXT, tamano TEXT, tipo TEXT, url_local TEXT, descargado_en TEXT DEFAULT (datetime('now')), eliminado_en TEXT)",
            "CREATE TABLE IF NOT EXISTS nodos (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, almacenamiento_usado_gb REAL DEFAULT 0, almacenamiento_max_gb REAL DEFAULT 5, version_app TEXT, actualizado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS cola_sincronizacion (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, nodo_id TEXT, accion TEXT, payload TEXT, estado TEXT, error_msg TEXT, creado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, clave_pregunta TEXT, clave_respuesta TEXT, orden INTEGER DEFAULT 0)",
            "CREATE TABLE IF NOT EXISTS logros (id TEXT PRIMARY KEY, titulo_clave TEXT, descripcion_clave TEXT, icono TEXT)",
            "CREATE TABLE IF NOT EXISTS logros_usuario (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, logro_id TEXT NOT NULL, desbloqueado_en TEXT DEFAULT (datetime('now')))",
            "CREATE TABLE IF NOT EXISTS local_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nombre TEXT NOT NULL, location TEXT, rol TEXT DEFAULT 'estudiante', created_at TEXT DEFAULT (datetime('now')))",
        ]:
            await db.execute(stmt)

        # Seed cursos
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM cursos")
        row = await cursor.fetchone()
        if row[0] == 0:
            for c in [
                ("drones-agricolas", "Drones Agricolas", "Aprende a usar drones para monitoreo y fumigacion de cultivos", "Tecnologia", "8 semanas", 6, "Intermedio", "Ing. Carlos Mendoza", "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800", "#2E7D32"),
                ("riego-inteligente", "Riego Inteligente", "Sistemas automatizados de riego por goteo y sensores de humedad", "Tecnologia", "6 semanas", 5, "Basico", "Ing. Maria Torres", "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800", "#1565C0"),
                ("negocios-rurales", "Negocios Rurales", "Emprendimiento y gestion de negocios en zonas rurales", "Negocios", "10 semanas", 8, "Basico", "Lic. Ana Garcia", "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800", "#E65100"),
                ("suelos-saludables", "Suelos Saludables", "Manejo organico del suelo y tecnicas de compostaje", "Agricultura", "5 semanas", 4, "Basico", "Ing. Roberto Sanchez", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800", "#558B2F"),
                ("apps-campesinas", "Apps para el Campo", "Desarrollo de aplicaciones moviles para comunidades rurales", "Tecnologia", "12 semanas", 10, "Avanzado", "Ing. Luis Fernandez", "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800", "#6A1B9A"),
                ("cooperativas", "Cooperativas exitosas", "Organizacion y gestion de cooperativas agricolas", "Negocios", "7 semanas", 6, "Intermedio", "Lic. Carmen Rosa", "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800", "#C62828"),
            ]:
                await db.execute(
                    "INSERT INTO cursos (id, titulo, descripcion, categoria, duracion, modulos, nivel, instructor, imagen, color, disponible, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))",
                    c
                )
            logger.info("Cursos sembrados: 6")

        # Seed modulos
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM modulos")
        row = await cursor.fetchone()
        if row[0] == 0:
            modulos_data = []
            for m in [
                ("drones-agricolas", "Introduccion a los Drones", "Conceptos basicos de drones aplicados a la agricultura", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("drones-agricolas", "Tipos de Drones Agricolas", "Drones multicoptero, fijos y hibridos para agricultura", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 45),
                ("drones-agricolas", "Sensores y Camaras", "Sensores NDVI, multicamara y termicos", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("drones-agricolas", "Planificacion de Vuelo", "Rutas de vuelo y configuracion de misiones", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("drones-agricolas", "Fumigacion con Drones", "Tecnicas de pulverizacion aerea", 5, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 50),
                ("drones-agricolas", "Analisis de Datos", "Interpretacion de imagenes y mapas NDVI", 6, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("riego-inteligente", "Fundamentos del Riego", "Tipos de riego y eficiencia hidrica", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
                ("riego-inteligente", "Sensores de Humedad", "Tipos de sensores y su instalacion", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("riego-inteligente", "Sistemas de Goteo", "Diseno y mantenimiento de riego por goteo", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("riego-inteligente", "Automatizacion", "Control automatico con Arduino y Raspberry Pi", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 45),
                ("riego-inteligente", "Monitoreo Remoto", "Apps y plataformas de control remoto", 5, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("negocios-rurales", "Emprendimiento Rural", "Identificacion de oportunidades de negocio", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("negocios-rurales", "Plan de Negocio", "Elaboracion de un plan de negocio rural", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 45),
                ("negocios-rurales", "Finanzas Basicas", "Control de gastos e ingresos", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("negocios-rurales", "Marketing Digital", "Como vender productos rurales online", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("negocios-rurales", "Cadenas de Suministro", "Logistica y distribucion de productos", 5, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("negocios-rurales", "Certificaciones", "Organico, fair trade y otras certificaciones", 6, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("negocios-rurales", "Exportaciones", "Como exportar productos agricolas", 7, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("negocios-rurales", "Casos de Exito", "Historias de negocios rurales exitosos", 8, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
                ("suelos-saludables", "Biologia del Suelo", "Microorganismos y nutrientes", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("suelos-saludables", "Analisis de Suelo", "Como interpretar un estudio de suelo", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("suelos-saludables", "Compostaje", "Tecnicas de compostaje casero y profesional", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("suelos-saludables", "Abono Verde", "Cultivos de abono verde y rotacion", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("apps-campesinas", "Introduccion al Desarrollo", "Conceptos basicos de programacion movil", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("apps-campesinas", "Framework Movil", "Ionic, Flutter o React Native", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 45),
                ("apps-campesinas", "Diseno UI/UX", "Interfaces amigables para comunidades rurales", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("apps-campesinas", "Base de Datos", "SQLite y almacenamiento local offline", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("apps-campesinas", "Funcionalidad Offline", "Trabajar sin conexion a internet", 5, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 45),
                ("apps-campesinas", "Notificaciones Push", "Alertas y mensajes a usuarios", 6, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("apps-campesinas", "GPS y Mapas", "Integracion de geolocalizacion", 7, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 40),
                ("apps-campesinas", "Camara y Fotos", "Captura de imagenes del cultivo", 8, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("apps-campesinas", "Publicacion en Stores", "Google Play y App Store", 9, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
                ("apps-campesinas", "Proyecto Final", "Desarrollo completo de una app rural", 10, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 60),
                ("cooperativas", "Que es una Cooperativa", "Definicion, principios y valores", 1, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
                ("cooperativas", "Formacion Juridica", "Constitucion legal y estatutos", 2, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 35),
                ("cooperativas", "Gestion Administrativa", "Organizacion interna y roles", 3, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("cooperativas", "Servicios al Socio", "Beneficios y servicios cooperativos", 4, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
                ("cooperativas", "Redes de Cooperacion", "Alianzas y federaciones", 5, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                ("cooperativas", "Casos de Exito", "Cooperativas exitosas en Latinoamerica", 6, "video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 25),
            ]:
                modulos_data.append((str(_uuid.uuid4()), m[0], m[1], m[2], m[3], m[4], m[5], m[6]))
            await db.executemany(
                "INSERT INTO modulos (id, curso_id, titulo, descripcion, orden, tipo_contenido, contenido_url, duracion_minutos) VALUES (?,?,?,?,?,?,?,?)",
                modulos_data
            )
            logger.info(f"Modulos sembrados: {len(modulos_data)}")

        # Seed faqs
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM faqs")
        row = await cursor.fetchone()
        if row[0] == 0:
            await db.executemany(
                "INSERT INTO faqs (clave_pregunta, clave_respuesta, orden) VALUES (?,?,?)",
                [
                    ("como_inscribirme", "Para inscribirte en un curso, ve a la seccion de cursos y haz clic en el boton de inscripcion.", 1),
                    ("como_descargar", "Puedes descargar contenido para uso offline desde la seccion de cursos inscritos.", 2),
                    ("certificados", "Los certificados se generan automaticamente al completar un curso al 100%.", 3),
                    ("modo_offline", "La app funciona sin internet. Tus progresos se sincronizan cuando vuelvas a conectarte.", 4),
                    ("soporte", "Puedes contactar soporte desde la seccion de Centro de Ayuda.", 5),
                    ("idiomas", "La plataforma esta disponible en Espanol y Quechua.", 6),
                ]
            )
            logger.info("FAQs sembradas: 6")

        # Seed logros
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM logros")
        row = await cursor.fetchone()
        if row[0] == 0:
            await db.executemany(
                "INSERT INTO logros (id, titulo_clave, descripcion_clave, icono) VALUES (?,?,?,?)",
                [
                    ("first_course", "Primer Paso", "Completaste tu primer curso", "trophy"),
                    ("half_progress", "A Medio Camino", "Alcanzaste 50% de progreso general", "star"),
                    ("three_courses", "Estudioso", "Completaste 3 cursos", "book"),
                    ("offline_master", "Maestro Offline", "Usaste la app 5 veces en modo offline", "wifi_off"),
                ]
            )
            logger.info("Logros sembrados: 4")

        # Seed admin user
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM local_users")
        row = await cursor.fetchone()
        if row[0] == 0:
            pass_hash = hashlib.sha256("admin123".encode()).hexdigest()
            await db.execute(
                "INSERT INTO local_users (id, email, password_hash, nombre, location, rol) VALUES (?,?,?,?,?,?)",
                ("admin-001", "admin@andesconnect.com", pass_hash, "Administrador", "Cusco", "admin")
            )
            logger.info("Admin user sembrado.")

        await db.commit()
    logger.info("Init SQLite completado.")


async def get_db():
    async with engine.begin() as conn:
        async with AsyncSession(bind=conn, expire_on_commit=False) as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                logger.error(f"Error en transaccion, ROLLBACK: {str(e)}")
                await session.rollback()
                raise
