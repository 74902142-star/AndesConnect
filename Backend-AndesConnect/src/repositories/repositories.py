from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID
from typing import List, Optional, Any
import json

class RowObject(dict):
    def __init__(self, mapping):
        super().__init__(mapping or {})

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(f"'RowObject' object has no attribute '{name}'")

    def __setattr__(self, name, value):
        self[name] = value

    def model_dump(self, **kwargs):
        return self


def to_dict(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return dict(obj)
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return {}


class CursoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_cursos(self, disponible_only: bool = True) -> List[RowObject]:
        if disponible_only:
            res = await self.db.execute(text("SELECT * FROM cursos WHERE disponible = 1"))
        else:
            res = await self.db.execute(text("SELECT * FROM cursos"))
        return [RowObject(r) for r in res.mappings().all()]

    async def get_curso_by_id(self, curso_id: str) -> Optional[RowObject]:
        res = await self.db.execute(text("SELECT * FROM cursos WHERE id = :id"), {"id": curso_id})
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def get_modulos_by_curso(self, curso_id: str) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM modulos WHERE curso_id = :curso_id ORDER BY orden"),
            {"curso_id": curso_id}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def get_modulo_by_id(self, modulo_id: UUID) -> Optional[RowObject]:
        res = await self.db.execute(text("SELECT * FROM modulos WHERE id = :id"), {"id": str(modulo_id)})
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def create_curso(self, curso: Any) -> Any:
        params = to_dict(curso)
        await self.db.execute(
            text("INSERT INTO cursos (id, titulo, descripcion, categoria, duracion, modulos, nivel, instructor, imagen, color, disponible, creado_en, actualizado_en) VALUES (:id, :titulo, :descripcion, :categoria, :duracion, :modulos, :nivel, :instructor, :imagen, :color, :disponible, datetime('now'), datetime('now'))"),
            params
        )
        return curso

    async def update_curso(self, curso: Any = None) -> None:
        if curso is not None:
            params = to_dict(curso)
            await self.db.execute(
                text("UPDATE cursos SET titulo=:titulo, descripcion=:descripcion, categoria=:categoria, duracion=:duracion, modulos=:modulos, nivel=:nivel, instructor=:instructor, imagen=:imagen, color=:color, disponible=:disponible, actualizado_en=datetime('now') WHERE id=:id"),
                params
            )

    async def delete_curso(self, curso: Any) -> None:
        curso_id = curso.id if hasattr(curso, "id") else (curso["id"] if isinstance(curso, dict) else curso)
        await self.db.execute(text("DELETE FROM modulos WHERE curso_id=:id"), {"id": curso_id})
        await self.db.execute(text("DELETE FROM cursos WHERE id=:id"), {"id": curso_id})

    async def create_modulo(self, modulo: Any) -> Any:
        params = to_dict(modulo)
        await self.db.execute(
            text("INSERT INTO modulos (id, curso_id, titulo, descripcion, orden, tipo_contenido, contenido_url, duracion_minutos) VALUES (:id, :curso_id, :titulo, :descripcion, :orden, :tipo_contenido, :contenido_url, :duracion_minutos)"),
            params
        )
        return modulo

    async def update_modulo(self, modulo: Any = None) -> None:
        if modulo is not None:
            params = to_dict(modulo)
            await self.db.execute(
                text("UPDATE modulos SET titulo=:titulo, descripcion=:descripcion, orden=:orden, tipo_contenido=:tipo_contenido, contenido_url=:contenido_url, duracion_minutos=:duracion_minutos WHERE id=:id"),
                params
            )

    async def delete_modulo(self, modulo: Any) -> None:
        modulo_id = modulo.id if hasattr(modulo, "id") else (modulo["id"] if isinstance(modulo, dict) else modulo)
        await self.db.execute(text("DELETE FROM modulos WHERE id=:id"), {"id": str(modulo_id)})


class PerfilRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_perfil_by_id(self, perfil_id: UUID) -> Optional[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM perfiles WHERE id = :id"),
            {"id": str(perfil_id)}
        )
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def create_perfil(self, perfil: Any) -> Any:
        params = to_dict(perfil)
        await self.db.execute(
            text("INSERT OR REPLACE INTO perfiles (id, nombre, email, rol, ubicacion, idioma_preferido, creado_en, actualizado_en) VALUES (:id, :nombre, :email, :rol, :ubicacion, :idioma_preferido, datetime('now'), datetime('now'))"),
            {
                "id": params.get("id") and str(params["id"]),
                "nombre": params.get("nombre"),
                "email": params.get("email"),
                "rol": params.get("rol"),
                "ubicacion": params.get("ubicacion"),
                "idioma_preferido": params.get("idioma_preferido") or "es"
            }
        )
        return perfil


class InscripcionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_inscripcion(self, usuario_id: UUID, curso_id: str) -> Optional[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM inscripciones WHERE usuario_id = :usuario_id AND curso_id = :curso_id"),
            {"usuario_id": str(usuario_id), "curso_id": curso_id}
        )
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def get_inscripciones_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM inscripciones WHERE usuario_id = :usuario_id"),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def get_inscripciones_with_curso(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("""SELECT i.*, c.titulo as curso_titulo, c.descripcion as curso_descripcion,
                    c.categoria as curso_categoria, c.duracion as curso_duracion, c.modulos as curso_modulos,
                    c.nivel as curso_nivel, c.instructor as curso_instructor, c.imagen as curso_imagen,
                    c.color as curso_color, c.disponible as curso_disponible
                    FROM inscripciones i JOIN cursos c ON i.curso_id = c.id
                    WHERE i.usuario_id = :usuario_id"""),
            {"usuario_id": str(usuario_id)}
        )
        results = []
        for r in res.mappings().all():
            course_data = {k.replace("curso_", ""): v for k, v in r.items() if k.startswith("curso_")}
            insc_dict = {k: v for k, v in r.items() if not k.startswith("curso_")}
            insc_dict["curso"] = RowObject(course_data)
            results.append(RowObject(insc_dict))
        return results

    async def get_progreso_lecciones(self, inscripcion_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM progreso_lecciones WHERE inscripcion_id = :inscripcion_id"),
            {"inscripcion_id": str(inscripcion_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def get_progreso_modulo(self, inscripcion_id: UUID, modulo_id: UUID) -> Optional[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM progreso_lecciones WHERE inscripcion_id = :inscripcion_id AND modulo_id = :modulo_id"),
            {"inscripcion_id": str(inscripcion_id), "modulo_id": str(modulo_id)}
        )
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def get_all_progreso_lecciones_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("""SELECT pl.* FROM progreso_lecciones pl
                    JOIN inscripciones i ON pl.inscripcion_id = i.id
                    WHERE i.usuario_id = :usuario_id"""),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def save_inscripcion(self, inscripcion: Any) -> Any:
        params = to_dict(inscripcion)
        insc_id = str(params.get("id", ""))
        existing = await self.db.execute(
            text("SELECT id FROM inscripciones WHERE id = :id"), {"id": insc_id}
        )
        if existing.mappings().one_or_none():
            await self.db.execute(
                text("""UPDATE inscripciones SET progreso=:progreso, descargado=:descargado,
                        modulo_actual_id=:modulo_actual_id, tema_ui=:tema_ui,
                        completado_en=:completado_en, actualizado_en=datetime('now') WHERE id=:id"""),
                {
                    "id": insc_id,
                    "progreso": params.get("progreso", 0),
                    "descargado": 1 if params.get("descargado") else 0,
                    "modulo_actual_id": str(params["modulo_actual_id"]) if params.get("modulo_actual_id") else None,
                    "tema_ui": params.get("tema_ui", "grey"),
                    "completado_en": str(params["completado_en"]) if params.get("completado_en") else None
                }
            )
        else:
            await self.db.execute(
                text("""INSERT INTO inscripciones (id, usuario_id, curso_id, progreso, descargado, modulo_actual_id, tema_ui, inscrito_en, completado_en, actualizado_en)
                        VALUES (:id, :usuario_id, :curso_id, :progreso, :descargado, :modulo_actual_id, :tema_ui, datetime('now'), :completado_en, datetime('now'))"""),
                {
                    "id": insc_id,
                    "usuario_id": str(params.get("usuario_id")),
                    "curso_id": params.get("curso_id"),
                    "progreso": params.get("progreso", 0),
                    "descargado": 1 if params.get("descargado") else 0,
                    "modulo_actual_id": str(params["modulo_actual_id"]) if params.get("modulo_actual_id") else None,
                    "tema_ui": params.get("tema_ui", "grey"),
                    "completado_en": str(params["completado_en"]) if params.get("completado_en") else None
                }
            )
        if hasattr(inscripcion, "__setitem__") or isinstance(inscripcion, dict):
            inscripcion["inscrito_en"] = params.get("inscrito_en")
            inscripcion["actualizado_en"] = params.get("actualizado_en")
        return inscripcion

    async def save_progreso_leccion(self, progreso: Any) -> Any:
        params = to_dict(progreso)
        prog_id = str(params.get("id", ""))
        await self.db.execute(
            text("""INSERT OR REPLACE INTO progreso_lecciones (id, inscripcion_id, modulo_id, completado, puntaje_evaluacion, completado_en)
                    VALUES (:id, :inscripcion_id, :modulo_id, :completado, :puntaje_evaluacion, :completado_en)"""),
            {
                "id": prog_id,
                "inscripcion_id": str(params.get("inscripcion_id")),
                "modulo_id": str(params.get("modulo_id")),
                "completado": 1 if params.get("completado") else 0,
                "puntaje_evaluacion": params.get("puntaje_evaluacion"),
                "completado_en": str(params["completado_en"]) if params.get("completado_en") else None
            }
        )
        return progreso

    async def delete_inscripcion(self, inscripcion: Any) -> None:
        insc_id = inscripcion.id if hasattr(inscripcion, "id") else (inscripcion["id"] if isinstance(inscripcion, dict) else inscripcion)
        await self.db.execute(text("DELETE FROM inscripciones WHERE id=:id"), {"id": str(insc_id)})

    async def update_inscripcion_descargado(self, usuario_id: UUID, curso_id: str, descargado: bool) -> bool:
        await self.db.execute(
            text("UPDATE inscripciones SET descargado=:descargado WHERE usuario_id=:usuario_id AND curso_id=:curso_id"),
            {"usuario_id": str(usuario_id), "curso_id": curso_id, "descargado": 1 if descargado else 0}
        )
        return True


class CertificadoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_certificados_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM certificados WHERE usuario_id = :usuario_id"),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def get_certificado(self, usuario_id: UUID, curso_id: str) -> Optional[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM certificados WHERE usuario_id = :usuario_id AND curso_id = :curso_id"),
            {"usuario_id": str(usuario_id), "curso_id": curso_id}
        )
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def save_certificado(self, certificado: Any) -> Any:
        params = to_dict(certificado)
        await self.db.execute(
            text("""INSERT OR IGNORE INTO certificados (id, usuario_id, curso_id, codigo_certificado, url_certificado, emitido_en)
                    VALUES (:id, :usuario_id, :curso_id, :codigo_certificado, :url_certificado, datetime('now'))"""),
            {
                "id": str(params.get("id")),
                "usuario_id": str(params.get("usuario_id")),
                "curso_id": params.get("curso_id"),
                "codigo_certificado": params.get("codigo_certificado"),
                "url_certificado": params.get("url_certificado")
            }
        )
        return certificado


class NotificacionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_notificaciones_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM notificaciones WHERE usuario_id = :usuario_id ORDER BY creado_en DESC"),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def get_notificacion_by_id(self, notif_id: UUID) -> Optional[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM notificaciones WHERE id = :id"),
            {"id": str(notif_id)}
        )
        row = res.mappings().one_or_none()
        return RowObject(row) if row else None

    async def save_notificacion(self, notif: Any) -> Any:
        params = to_dict(notif)
        await self.db.execute(
            text("""INSERT OR IGNORE INTO notificaciones (id, usuario_id, tipo, titulo, mensaje, leido, ruta_accion, creado_en)
                    VALUES (:id, :usuario_id, :tipo, :titulo, :mensaje, :leido, :ruta_accion, datetime('now'))"""),
            {
                "id": str(params.get("id")),
                "usuario_id": str(params.get("usuario_id")),
                "tipo": params.get("tipo"),
                "titulo": params.get("titulo"),
                "mensaje": params.get("mensaje"),
                "leido": 1 if params.get("leido") else 0,
                "ruta_accion": params.get("ruta_accion")
            }
        )
        return notif

    async def delete_notificacion(self, notif: Any) -> None:
        notif_id = notif.id if hasattr(notif, "id") else (notif["id"] if isinstance(notif, dict) else notif)
        await self.db.execute(text("DELETE FROM notificaciones WHERE id=:id"), {"id": str(notif_id)})

    async def notify_all_users_new_course(self, curso_id: str, curso_titulo: str) -> None:
        import uuid as _uuid
        res = await self.db.execute(text("SELECT id FROM perfiles"))
        for row in res.mappings().all():
            notif_id = str(_uuid.uuid4())
            await self.db.execute(
                text("""INSERT OR IGNORE INTO notificaciones (id, usuario_id, tipo, titulo, mensaje, leido, ruta_accion, creado_en)
                        VALUES (:id, :uid, 'new_course', 'Nuevo Curso Disponible', :msg, 0, :ruta, datetime('now'))"""),
                {"id": notif_id, "uid": row["id"], "msg": f"Se ha añadido el curso '{curso_titulo}'.", "ruta": f"/courses/{curso_id}"}
            )


class ArchivoDescargadoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_archivos_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT * FROM archivos_descargados WHERE usuario_id = :usuario_id"),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def save_archivo_descargado(self, archivo: Any) -> Any:
        params = to_dict(archivo)
        await self.db.execute(
            text("""INSERT OR IGNORE INTO archivos_descargados (id, usuario_id, curso_id, nombre_archivo, tamano, tipo, url_local, descargado_en)
                    VALUES (:id, :usuario_id, :curso_id, :nombre_archivo, :tamano, :tipo, :url_local, datetime('now'))"""),
            {
                "id": str(params.get("id")),
                "usuario_id": str(params.get("usuario_id")),
                "curso_id": params.get("curso_id"),
                "nombre_archivo": params.get("nombre_archivo"),
                "tamano": params.get("tamano"),
                "tipo": params.get("tipo"),
                "url_local": params.get("url_local")
            }
        )
        return archivo

    async def delete_archivo_descargado_by_name(self, usuario_id: UUID, nombre_archivo: str) -> bool:
        await self.db.execute(
            text("DELETE FROM archivos_descargados WHERE usuario_id=:usuario_id AND nombre_archivo=:nombre_archivo"),
            {"usuario_id": str(usuario_id), "nombre_archivo": nombre_archivo}
        )
        return True


class NodoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert_nodo(self, nodo_id: str, usuario_id: UUID, almacenamiento_usado_gb: float, almacenamiento_max_gb: float, version_app: str) -> None:
        await self.db.execute(
            text("""INSERT OR REPLACE INTO nodos (id, usuario_id, almacenamiento_usado_gb, almacenamiento_max_gb, version_app, actualizado_en)
                    VALUES (:id, :usuario_id, :usado, :max, :version, datetime('now'))"""),
            {"id": nodo_id, "usuario_id": str(usuario_id), "usado": almacenamiento_usado_gb, "max": almacenamiento_max_gb, "version": version_app}
        )


class ColaSincronizacionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_sync_log(self, usuario_id: UUID, nodo_id: Optional[str], accion: str, payload: dict, estado: str, error_msg: Optional[str] = None) -> None:
        import uuid as _uuid
        await self.db.execute(
            text("""INSERT INTO cola_sincronizacion (id, usuario_id, nodo_id, accion, payload, estado, error_msg, creado_en)
                    VALUES (:id, :usuario_id, :nodo_id, :accion, :payload, :estado, :error_msg, datetime('now'))"""),
            {
                "id": str(_uuid.uuid4()),
                "usuario_id": str(usuario_id),
                "nodo_id": nodo_id,
                "accion": accion,
                "payload": json.dumps(payload),
                "estado": estado,
                "error_msg": error_msg
            }
        )


class PreguntasFrecuentesRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_faqs(self) -> List[RowObject]:
        res = await self.db.execute(text("SELECT * FROM faqs ORDER BY orden"))
        return [RowObject(r) for r in res.mappings().all()]


class LogroRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_logros(self) -> List[RowObject]:
        res = await self.db.execute(text("SELECT * FROM logros"))
        return [RowObject(r) for r in res.mappings().all()]

    async def get_logros_by_usuario(self, usuario_id: UUID) -> List[RowObject]:
        res = await self.db.execute(
            text("SELECT l.*, lu.desbloqueado_en FROM logros l LEFT JOIN logros_usuario lu ON l.id = lu.logro_id AND lu.usuario_id = :usuario_id"),
            {"usuario_id": str(usuario_id)}
        )
        return [RowObject(r) for r in res.mappings().all()]

    async def unlock_logro(self, usuario_id: UUID, logro_id: str) -> None:
        await self.db.execute(
            text("""INSERT OR IGNORE INTO logros_usuario (id, usuario_id, logro_id, desbloqueado_en)
                    VALUES (:id, :usuario_id, :logro_id, datetime('now'))"""),
            {"id": f"{usuario_id}_{logro_id}", "usuario_id": str(usuario_id), "logro_id": logro_id}
        )
