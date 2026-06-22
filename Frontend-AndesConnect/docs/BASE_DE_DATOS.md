# Base de Datos — Rural-Tech

## 1. Introducción

### 1.1 Propósito
Este documento define el esquema de base de datos relacional para la plataforma **Rural-Tech**, una aplicación educativa offline-first para comunidades rurales con soporte bilingüe (español/quechua).

### 1.2 Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Motor de base de datos | PostgreSQL 16 | UUID nativo, JSONB, CHECK constraints, ENUMs, RLS |
| API | Supabase / PostgREST | API REST auto-generada, RLS integrado, compatible con Angular |
| Autenticación | Supabase Auth | JWT, sesiones, RLS policies |
| Almacenamiento de archivos | Supabase Storage | Buckets para PDFs, videos, certificados |
| Cliente offline | IndexedDB (navegador) | Cache local para modo offline, sincronización diferida |

### 1.3 Principios de Diseño

- **Offline-first**: La app funciona sin conexión; los datos se sincronizan cuando hay conectividad.
- **UUID como PK**: Permite generación de IDs en el cliente offline sin conflictos.
- **Soft deletes**: Los datos nunca se eliminan físicamente, solo se marcan como eliminados (`deleted_at`).
- **Auditoría temporal**: Toda tabla tiene `created_at` y `updated_at`.
- **RLS (Row Level Security)**: El acceso se controla a nivel de fila, no de aplicación.
- **i18n nativa**: Las claves de traducción se almacenan en lugar de texto traducido.

### 1.4 Convenciones de Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Tablas | `snake_case` plural | `usuarios`, `cursos`, `progreso_lecciones` |
| Columnas | `snake_case` | `nombre`, `password_hash`, `creado_en` |
| PKs | `id` | `id UUID PRIMARY KEY` |
| FKs | `{tabla}_id` | `usuario_id`, `curso_id` |
| ENUMs | `snake_case` | `'estudiante'`, `'docente'` |
| Timestamps | `{verbo}_en` | `creado_en`, `actualizado_en`, `eliminado_en` |

---

## 2. Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────┐       ┌──────────────┐       ┌──────────┐                   │
│  │ sesiones │──N:1──▶   usuarios   │◀──1:1──│  nodos   │                   │
│  └──────────┘       └──────┬───────┘       └──────────┘                   │
│                            │                                               │
│              ┌─────────────┼─────────────────┬──────────────────┐          │
│              │             │                  │                  │          │
│              ▼             ▼                  ▼                  ▼          │
│  ┌──────────────────┐ ┌────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │ inscripciones    │ │archivos_   │ │cola_sincro-    │ │descargas_    │  │
│  │                  │ │descargados │ │nizacion        │ │activas       │  │
│  └────────┬─────────┘ └────────────┘ └────────────────┘ └──────────────┘  │
│           │                                                               │
│           ▼                                                               │
│  ┌──────────────────┐       ┌──────────┐       ┌──────────────────┐      │
│  │progreso_lecciones│──N:1──▶ módulos  │◀──N:1──│     cursos       │      │
│  └──────────────────┘       └──────────┘       └────────┬─────────┘      │
│                                                         │                 │
│                    ┌────────────────────────────────────┼──┐              │
│                    │                    ┌────────────────┘  │              │
│                    ▼                    ▼                   ▼              │
│          ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐      │
│          │  certificados    │ │preguntas_frecu-  │ │ (relaciones  │      │
│          │                  │ │entes             │ │  indirectas) │      │
│          └──────────────────┘ └──────────────────┘ └──────────────┘      │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Resumen de Relaciones

| Tabla A | Cardinalidad | Tabla B | Detalle |
|---------|-------------|---------|---------|
| `usuarios` | 1 : N | `inscripciones` | Un usuario se inscribe en muchos cursos |
| `inscripciones` | N : 1 | `cursos` | Muchos usuarios inscritos en un curso |
| `inscripciones` | 1 : N | `progreso_lecciones` | Una inscripción tiene muchas lecciones |
| `modulos` | N : 1 | `cursos` | Muchos módulos pertenecen a un curso |
| `progreso_lecciones` | N : 1 | `modulos` | Progreso registrado por módulo |
| `usuarios` | 1 : N | `archivos_descargados` | Un usuario descarga muchos archivos |
| `usuarios` | 1 : N | `cola_sincronizacion` | Un usuario encola muchas acciones |
| `usuarios` | 1 : N | `descargas_activas` | Un usuario tiene muchas descargas activas |
| `usuarios` | 1 : N | `sesiones` | Un usuario tiene muchas sesiones |
| `usuarios` | 1 : 1 | `nodos` | Un usuario opera desde un nodo (opcional) |
| `usuarios` | 1 : N | `certificados` | Un usuario obtiene muchos certificados |
| `certificados` | N : 1 | `cursos` | Certificado emitido por curso |

---

## 3. Esquema de Tablas

### 3.1 `usuarios` — Autenticación y Perfil

Propósito: Almacena la información de registro y perfil de cada usuario.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `nombre` | `VARCHAR(150)` | `NOT NULL` | — | Nombre completo | `UserProfile.name` |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | — | Correo electrónico (login) | `UserProfile.email` |
| `ubicacion` | `VARCHAR(200)` | — | `NULL` | Comunidad / municipio | `UserProfile.location` |
| `rol` | `rol_usuario` | `NOT NULL` | `'estudiante'` | Rol en la plataforma | `UserProfile.role` |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | — | Hash bcrypt de la contraseña | `AuthService` (mock) |
| `idioma_preferido` | `idioma_code` | `NOT NULL` | `'es'` | Idioma de la interfaz | `localStorage.preferredLanguage` |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de registro | — |
| `actualizado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Última actualización | — |

```sql
CREATE TYPE rol_usuario AS ENUM ('estudiante', 'docente');
CREATE TYPE idioma_code AS ENUM ('es', 'qu');

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    ubicacion VARCHAR(200),
    rol rol_usuario NOT NULL DEFAULT 'estudiante',
    password_hash VARCHAR(255) NOT NULL,
    idioma_preferido idioma_code NOT NULL DEFAULT 'es',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
```

**Políticas RLS:**

```sql
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver/editar su propio perfil
CREATE POLICY usuarios_select_own ON usuarios
    FOR SELECT USING (id = auth.uid());

CREATE POLICY usuarios_update_own ON usuarios
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- El service_role puede gestionar todos los usuarios
CREATE POLICY usuarios_admin_all ON usuarios
    FOR ALL USING (auth.role() = 'service_role');
```

---

### 3.2 `sesiones` — Tokens de Autenticación

Propósito: Gestiona sesiones JWT activas, incluyendo sesiones de invitado.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario autenticado | — |
| `token` | `VARCHAR(500)` | `NOT NULL`, `UNIQUE` | — | JWT token | `localStorage.rt_token` |
| `tipo` | `tipo_sesion` | `NOT NULL` | `'login'` | Tipo de inicio de sesión | `AuthService.login / loginAsGuest` |
| `nodo_id` | `VARCHAR(20)` | `FK → nodos.id` | `NULL` | Nodo donde se autenticó | `localStorage.rt_node` |
| `expira_en` | `TIMESTAMPTZ` | `NOT NULL` | — | Fecha de expiración | — |
| `cerrado_en` | `TIMESTAMPTZ` | — | `NULL` | Cierre de sesión (soft delete) | — |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de creación | — |

```sql
CREATE TYPE tipo_sesion AS ENUM ('login', 'guest');

CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    tipo tipo_sesion NOT NULL DEFAULT 'login',
    nodo_id VARCHAR(20) REFERENCES nodos(id),
    expira_en TIMESTAMPTZ NOT NULL,
    cerrado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones(token);
CREATE INDEX idx_sesiones_activas ON sesiones(usuario_id) WHERE cerrado_en IS NULL;
```

**Políticas RLS:**

```sql
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY sesiones_select_own ON sesiones
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY sesiones_insert_own ON sesiones
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sesiones_update_own ON sesiones
    FOR UPDATE USING (usuario_id = auth.uid());
```

---

### 3.3 `nodos` — Identidad de Nodo Offline

Propósito: Identifica y rastrea el estado de los nodos (dispositivos) que operan en modo offline.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `VARCHAR(20)` | `PK` | — | Código único del nodo (ej: 'RT-SEC-4821') | `localStorage.rt_node` |
| `usuario_id` | `UUID` | `FK → usuarios.id` | `NULL` | Usuario principal del nodo | — |
| `ultima_sincronizacion` | `TIMESTAMPTZ` | — | `NULL` | Última conexión exitosa | `localStorage.rt_last_sync` |
| `almacenamiento_usado_gb` | `DECIMAL(5,2)` | `NOT NULL` | `0` | GB usados en descargas offline | `SyncService.usedSpace` |
| `almacenamiento_max_gb` | `DECIMAL(5,2)` | `NOT NULL` | `5.0` | Capacidad máxima del nodo | `SyncService.maxSpace` |
| `version_app` | `VARCHAR(20)` | — | `NULL` | Versión de la aplicación | — |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de registro | — |
| `actualizado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Última actualización | — |

```sql
CREATE TABLE nodos (
    id VARCHAR(20) PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ultima_sincronizacion TIMESTAMPTZ,
    almacenamiento_usado_gb DECIMAL(5,2) NOT NULL DEFAULT 0,
    almacenamiento_max_gb DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    version_app VARCHAR(20),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nodos_usuario ON nodos(usuario_id);
```

---

### 3.4 `cursos` — Catálogo de Cursos

Propósito: Catálogo maestro de todos los cursos disponibles en la plataforma.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `VARCHAR(50)` | `PK` | — | Slug único (ej: 'drones', 'riego') | `CatalogCourse.id` |
| `titulo` | `VARCHAR(200)` | `NOT NULL` | — | Título del curso | `CatalogCourse.title` |
| `descripcion` | `TEXT` | `NOT NULL` | — | Resumen del contenido | `CatalogCourse.description` |
| `categoria` | `categoria_curso` | `NOT NULL` | — | Categoría para filtros | `CatalogCourse.category` |
| `duracion` | `VARCHAR(10)` | `NOT NULL` | — | Ej: '24h', '18h', '30h' | `CatalogCourse.duration` |
| `modulos` | `INT` | `NOT NULL`, `CHECK (modulos > 0)` | — | Número de módulos | `CatalogCourse.modules` |
| `nivel` | `nivel_curso` | `NOT NULL` | — | Clave i18n del nivel | `CatalogCourse.level` |
| `instructor` | `VARCHAR(150)` | `NOT NULL` | — | Nombre del instructor | `CatalogCourse.instructor` |
| `imagen` | `VARCHAR(100)` | `NOT NULL` | — | Identificador de imagen | `CatalogCourse.image` |
| `color` | `CHAR(7)` | `NOT NULL` | — | Color hex para UI (ej: '#1e3a5f') | `CatalogCourse.color` |
| `disponible` | `BOOLEAN` | `NOT NULL` | `TRUE` | Abierto para inscripción | `CatalogCourse.available` |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de creación | — |
| `actualizado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Última actualización | — |

```sql
CREATE TYPE categoria_curso AS ENUM ('technology', 'agriculture', 'business');
CREATE TYPE nivel_curso AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TABLE cursos (
    id VARCHAR(50) PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria categoria_curso NOT NULL,
    duracion VARCHAR(10) NOT NULL,
    modulos INT NOT NULL CHECK (modulos > 0),
    nivel nivel_curso NOT NULL,
    instructor VARCHAR(150) NOT NULL,
    imagen VARCHAR(100) NOT NULL,
    color CHAR(7) NOT NULL,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cursos_categoria ON cursos(categoria);
CREATE INDEX idx_cursos_disponibles ON cursos(disponible) WHERE disponible = TRUE;
CREATE INDEX idx_cursos_nivel ON cursos(nivel);
```

**RLS:** Los cursos son de solo lectura para usuarios autenticados:

```sql
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cursos_select_authenticated ON cursos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cursos_select_anon ON cursos
    FOR SELECT USING (auth.role() = 'anon');

CREATE POLICY cursos_insert_admin ON cursos
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY cursos_update_admin ON cursos
    FOR UPDATE USING (auth.role() = 'service_role');
```

---

### 3.5 `modulos` — Módulos de Cada Curso

Propósito: Estructura de módulos/lecciones dentro de cada curso.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `curso_id` | `VARCHAR(50)` | `FK → cursos.id`, `NOT NULL` | — | Curso al que pertenece | — |
| `titulo` | `VARCHAR(200)` | `NOT NULL` | — | Título del módulo | `Course.subtitle` (parcial) |
| `orden` | `INT` | `NOT NULL`, `CHECK (orden > 0)` | — | Posición dentro del curso | — |
| `tipo_contenido` | `tipo_contenido` | `NOT NULL` | — | Tipo de recurso principal | `DownloadedFile.type` |
| `contenido_url` | `VARCHAR(500)` | — | `NULL` | URL del recurso | — |
| `duracion_minutos` | `INT` | — | `NULL` | Duración estimada | — |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | | — |

```sql
CREATE TYPE tipo_contenido AS ENUM ('video', 'pdf', 'quiz');

CREATE TABLE modulos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id VARCHAR(50) NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    orden INT NOT NULL CHECK (orden > 0),
    tipo_contenido tipo_contenido NOT NULL,
    contenido_url VARCHAR(500),
    duracion_minutos INT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_modulos_curso ON modulos(curso_id);
CREATE INDEX idx_modulos_orden ON modulos(curso_id, orden);
```

**RLS:** Misma política que cursos — solo lectura para usuarios autenticados.

---

### 3.6 `inscripciones` — Cursos del Usuario

Propósito: Registro de cursos en los que el usuario está inscrito, con su progreso general.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario inscrito | — |
| `curso_id` | `VARCHAR(50)` | `FK → cursos.id`, `NOT NULL` | — | Curso inscrito | — |
| `progreso` | `INT` | `NOT NULL`, `CHECK (progreso BETWEEN 0 AND 100)` | `0` | Porcentaje completado | `Course.progress` |
| `descargado` | `BOOLEAN` | `NOT NULL` | `FALSE` | Guardado offline | `Course.downloaded` |
| `modulo_actual_id` | `UUID` | `FK → modulos.id` | `NULL` | Último módulo visitado | `Course.subtitle` |
| `tema_ui` | `tema_curso` | `NOT NULL` | `'grey'` | Tema de color UI | `Course.theme` |
| `inscrito_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de inscripción | — |
| `completado_en` | `TIMESTAMPTZ` | — | `NULL` | Fecha de finalización | — |
| `actualizado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Última actualización | — |
| **CONSTRAINT** | `UNIQUE (usuario_id, curso_id)` | | | Una inscripción por curso | — |

```sql
CREATE TYPE tema_curso AS ENUM ('yellow', 'blue', 'red', 'grey');

CREATE TABLE inscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id VARCHAR(50) NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    progreso INT NOT NULL DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
    descargado BOOLEAN NOT NULL DEFAULT FALSE,
    modulo_actual_id UUID REFERENCES modulos(id) ON DELETE SET NULL,
    tema_ui tema_curso NOT NULL DEFAULT 'grey',
    inscrito_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completado_en TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, curso_id)
);

CREATE INDEX idx_inscripciones_usuario ON inscripciones(usuario_id);
CREATE INDEX idx_inscripciones_curso ON inscripciones(curso_id);
CREATE INDEX idx_inscripciones_progreso ON inscripciones(usuario_id, progreso);
```

**RLS:**

```sql
ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY inscripciones_select_own ON inscripciones
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY inscripciones_insert_own ON inscripciones
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY inscripciones_update_own ON inscripciones
    FOR UPDATE USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());
```

---

### 3.7 `progreso_lecciones` — Progreso Detallado

Propósito: Registro de progreso a nivel de lección individual dentro de cada módulo.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `inscripcion_id` | `UUID` | `FK → inscripciones.id`, `NOT NULL` | — | Inscripción asociada | — |
| `modulo_id` | `UUID` | `FK → modulos.id`, `NOT NULL` | — | Módulo de la lección | — |
| `leccion_id` | `VARCHAR(100)` | `NOT NULL` | — | ID de lección (formato: `{curso_id}_{modulo_id}_{leccion}`) | IndexedDB `progress` key path |
| `completado` | `BOOLEAN` | `NOT NULL` | `FALSE` | Lección completada | — |
| `puntaje_evaluacion` | `INT` | `CHECK (puntaje_evaluacion BETWEEN 0 AND 100)` | `NULL` | Calificación si aplica | `SyncAction` payload |
| `completado_en` | `TIMESTAMPTZ` | — | `NULL` | Fecha de finalización | — |
| `actualizado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Última actualización | — |
| **CONSTRAINT** | `UNIQUE (inscripcion_id, leccion_id)` | | | Un registro por lección | — |

```sql
CREATE TABLE progreso_lecciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID NOT NULL REFERENCES inscripciones(id) ON DELETE CASCADE,
    modulo_id UUID NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
    leccion_id VARCHAR(100) NOT NULL,
    completado BOOLEAN NOT NULL DEFAULT FALSE,
    puntaje_evaluacion INT CHECK (puntaje_evaluacion BETWEEN 0 AND 100),
    completado_en TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inscripcion_id, leccion_id)
);

CREATE INDEX idx_progreso_inscripcion ON progreso_lecciones(inscripcion_id);
CREATE INDEX idx_progreso_modulo ON progreso_lecciones(modulo_id);
CREATE INDEX idx_progreso_completado ON progreso_lecciones(inscripcion_id, completado)
    WHERE completado = TRUE;
```

**RLS:** Misma política que inscripciones — el usuario solo ve su propio progreso.

---

### 3.8 `archivos_descargados` — Archivos Offline

Propósito: Metadatos de los archivos descargados para uso offline.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario que descargó | — |
| `curso_id` | `VARCHAR(50)` | `FK → cursos.id`, `NOT NULL` | — | Curso del archivo | — |
| `nombre_archivo` | `VARCHAR(255)` | `NOT NULL` | — | Nombre del archivo (ej: 'Manual_Riego_V2.pdf') | `DownloadedFile.name` |
| `tamano` | `VARCHAR(20)` | `NOT NULL` | — | Tamaño legible (ej: '4.5MB') | `DownloadedFile.size` |
| `tipo` | `tipo_contenido` | `NOT NULL` | — | Tipo de archivo | `DownloadedFile.type` |
| `url_local` | `VARCHAR(500)` | — | `NULL` | URL del blob en IndexedDB / Cache API | — |
| `descargado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de descarga | `DownloadedFile.downloadedAt` |
| `eliminado_en` | `TIMESTAMPTZ` | — | `NULL` | Soft delete | — |

```sql
CREATE TABLE archivos_descargados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id VARCHAR(50) NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tamano VARCHAR(20) NOT NULL,
    tipo tipo_contenido NOT NULL,
    url_local VARCHAR(500),
    descargado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eliminado_en TIMESTAMPTZ
);

CREATE INDEX idx_archivos_usuario ON archivos_descargados(usuario_id);
CREATE INDEX idx_archivos_curso ON archivos_descargados(curso_id);
CREATE INDEX idx_archivos_activos ON archivos_descargados(usuario_id)
    WHERE eliminado_en IS NULL;
```

---

### 3.9 `descargas_activas` — Progreso de Descarga en Vivo

Propósito: Estado transitorio de descargas en progreso (no persiste entre sesiones, pero permite tracking server-side).

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario que descarga | — |
| `curso_id` | `VARCHAR(50)` | `FK → cursos.id`, `NOT NULL` | — | Curso en descarga | — |
| `progreso` | `INT` | `NOT NULL`, `CHECK (progreso BETWEEN 0 AND 100)` | `0` | Porcentaje de descarga | `ActiveDownload.progress` |
| `tamano_descargado` | `VARCHAR(20)` | `NOT NULL` | — | Ej: '244MB' | `ActiveDownload.sizeDownloaded` |
| `tamano_total` | `VARCHAR(20)` | `NOT NULL` | — | Ej: '350MB' | `ActiveDownload.sizeTotal` |
| `badge` | `VARCHAR(50)` | `NOT NULL` | — | Texto de badge (ej: 'MÓDULO 4') | `ActiveDownload.badge` |
| `activo` | `BOOLEAN` | `NOT NULL` | `TRUE` | Descarga en curso | — |
| `iniciado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | | — |
| `completado_en` | `TIMESTAMPTZ` | — | `NULL` | | — |

```sql
CREATE TABLE descargas_activas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id VARCHAR(50) NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    progreso INT NOT NULL DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
    tamano_descargado VARCHAR(20) NOT NULL,
    tamano_total VARCHAR(20) NOT NULL,
    badge VARCHAR(50) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completado_en TIMESTAMPTZ
);

CREATE INDEX idx_descargas_activas_usuario ON descargas_activas(usuario_id) WHERE activo = TRUE;
```

---

### 3.10 `cola_sincronizacion` — Acciones Pendientes de Sync

Propósito: Cola de acciones que deben sincronizarse con el servidor cuando el dispositivo recupere conectividad.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `BIGSERIAL` | `PK` | — | Auto-increment (compatible con IndexedDB) | `SyncAction.id` |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario que originó la acción | — |
| `nodo_id` | `VARCHAR(20)` | `FK → nodos.id` | `NULL` | Nodo origen de la acción | — |
| `accion` | `accion_sync` | `NOT NULL` | — | Tipo de acción a sincronizar | `SyncAction.action` |
| `payload` | `JSONB` | `NOT NULL` | — | Datos específicos de la acción | `SyncAction.data` |
| `estado` | `estado_sync` | `NOT NULL` | `'pending'` | Estado actual | — |
| `intentos` | `INT` | `NOT NULL` | `0` | Número de reintentos | — |
| `error_msg` | `TEXT` | — | `NULL` | Mensaje de error si falló | — |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de creación | `SyncAction.timestamp` |
| `sincronizado_en` | `TIMESTAMPTZ` | — | `NULL` | Sincronización exitosa | — |

```sql
CREATE TYPE accion_sync AS ENUM ('COMPLETE_LESSON', 'SUBMIT_ASSESSMENT');
CREATE TYPE estado_sync AS ENUM ('pending', 'syncing', 'completed', 'failed');

CREATE TABLE cola_sincronizacion (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nodo_id VARCHAR(20) REFERENCES nodos(id) ON DELETE SET NULL,
    accion accion_sync NOT NULL,
    payload JSONB NOT NULL,
    estado estado_sync NOT NULL DEFAULT 'pending',
    intentos INT NOT NULL DEFAULT 0,
    error_msg TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sincronizado_en TIMESTAMPTZ
);

CREATE INDEX idx_cola_estado ON cola_sincronizacion(estado) WHERE estado IN ('pending', 'failed');
CREATE INDEX idx_cola_usuario ON cola_sincronizacion(usuario_id, estado);
CREATE INDEX idx_cola_antiguedad ON cola_sincronizacion(creado_en)
    WHERE estado = 'pending';
```

**RLS:**

```sql
ALTER TABLE cola_sincronizacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY cola_select_own ON cola_sincronizacion
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY cola_insert_own ON cola_sincronizacion
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY cola_update_own ON cola_sincronizacion
    FOR UPDATE USING (usuario_id = auth.uid());
```

---

### 3.11 `certificados` — Certificados de Cursos Completados

Propósito: Certificados emitidos al completar un curso. Actualmente no implementado en frontend, pero necesario para el flujo de finalización.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `UUID` | `PK` | `gen_random_uuid()` | Identificador único | — |
| `usuario_id` | `UUID` | `FK → usuarios.id`, `NOT NULL` | — | Usuario certificado | — |
| `curso_id` | `VARCHAR(50)` | `FK → cursos.id`, `NOT NULL` | — | Curso completado | — |
| `codigo_certificado` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | — | Código único visible (ej: 'RT-CERT-0001') | — |
| `url_certificado` | `VARCHAR(500)` | — | `NULL` | URL del PDF generado | — |
| `emitido_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Fecha de emisión | — |
| **CONSTRAINT** | `UNIQUE (usuario_id, curso_id)` | | | Un certificado por curso completado | — |

```sql
CREATE TABLE certificados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id VARCHAR(50) NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    codigo_certificado VARCHAR(20) NOT NULL UNIQUE,
    url_certificado VARCHAR(500),
    emitido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, curso_id)
);

CREATE INDEX idx_certificados_usuario ON certificados(usuario_id);
```

---

### 3.12 `preguntas_frecuentes` — FAQ del Centro de Ayuda

Propósito: Preguntas frecuentes con soporte i18n mediante claves de traducción.

| Columna | Tipo | Constraints | Default | Descripción | Origen en código |
|---------|------|-------------|---------|-------------|------------------|
| `id` | `INT` | `PK` | `GENERATED BY DEFAULT AS IDENTITY` | Identificador único | `FaqItem.id` |
| `clave_pregunta` | `VARCHAR(100)` | `NOT NULL` | — | Clave i18n para la pregunta | `FaqItem.questionKey` |
| `clave_respuesta` | `VARCHAR(100)` | `NOT NULL` | — | Clave i18n para la respuesta | `FaqItem.answerKey` |
| `orden` | `INT` | `NOT NULL` | `0` | Orden de aparición | — |
| `activo` | `BOOLEAN` | `NOT NULL` | `TRUE` | Visible en la interfaz | `FaqItem.open` (adaptado) |
| `creado_en` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | | — |

```sql
CREATE TABLE preguntas_frecuentes (
    id INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    clave_pregunta VARCHAR(100) NOT NULL,
    clave_respuesta VARCHAR(100) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preguntas_orden ON preguntas_frecuentes(orden) WHERE activo = TRUE;
```

---

## 4. Vistas y Consultas Frecuentes

### 4.1 `vista_progreso_usuario` — Progreso Consolidado

```sql
CREATE VIEW vista_progreso_usuario AS
SELECT
    u.id AS usuario_id,
    u.nombre AS usuario_nombre,
    c.id AS curso_id,
    c.titulo AS curso_titulo,
    i.progreso,
    i.descargado,
    i.inscrito_en,
    i.completado_en,
    CASE
        WHEN i.completado_en IS NOT NULL THEN 'completado'
        WHEN i.progreso > 0 THEN 'en_curso'
        ELSE 'inscrito'
    END AS estado
FROM usuarios u
JOIN inscripciones i ON u.id = i.usuario_id
JOIN cursos c ON i.curso_id = c.id;
```

### 4.2 `vista_cola_pendiente` — Estado de Sincronización

```sql
CREATE VIEW vista_cola_pendiente AS
SELECT
    cs.usuario_id,
    cs.nodo_id,
    cs.accion,
    COUNT(*) AS acciones_pendientes,
    MIN(cs.creado_en) AS accion_mas_antigua,
    MAX(cs.intentos) AS max_intentos
FROM cola_sincronizacion cs
WHERE cs.estado IN ('pending', 'failed')
GROUP BY cs.usuario_id, cs.nodo_id, cs.accion;
```

### 4.3 `vista_cursos_disponibles` — Cursos No Inscritos

```sql
CREATE VIEW vista_cursos_disponibles AS
SELECT
    c.*
FROM cursos c
WHERE c.disponible = TRUE
  AND c.id NOT IN (
      SELECT i.curso_id
      FROM inscripciones i
      WHERE i.usuario_id = auth.uid()
  );
```

### 4.4 `vista_almacenamiento_nodo` — Almacenamiento por Nodo

```sql
CREATE VIEW vista_almacenamiento_nodo AS
SELECT
    n.id AS nodo_id,
    n.usuario_id,
    n.almacenamiento_usado_gb,
    n.almacenamiento_max_gb,
    ROUND((n.almacenamiento_usado_gb / NULLIF(n.almacenamiento_max_gb, 0)) * 100, 1) AS porcentaje_usado,
    COUNT(ad.id) AS archivos_descargados,
    n.ultima_sincronizacion
FROM nodos n
LEFT JOIN archivos_descargados ad ON ad.usuario_id = n.usuario_id AND ad.eliminado_en IS NULL
GROUP BY n.id;
```

---

## 5. Funciones y Triggers

### 5.1 Actualizar `actualizado_en` automáticamente

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con actualizado_en
CREATE TRIGGER set_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON nodos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON inscripciones
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON progreso_lecciones
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

### 5.2 Generar código de certificado

```sql
CREATE OR REPLACE FUNCTION generar_codigo_certificado()
RETURNS TRIGGER AS $$
DECLARE
    next_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(codigo_certificado, '-', 3) AS INT)), 0) + 1
    INTO next_num
    FROM certificados;

    NEW.codigo_certificado := 'RT-CERT-' || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_certificado BEFORE INSERT ON certificados
    FOR EACH ROW EXECUTE FUNCTION generar_codigo_certificado();
```

### 5.3 Actualizar progreso del curso al completar lección

```sql
CREATE OR REPLACE FUNCTION actualizar_progreso_curso()
RETURNS TRIGGER AS $$
DECLARE
    v_inscripcion_id UUID;
    v_curso_id VARCHAR(50);
    total_modulos INT;
    modulos_completados INT;
    nuevo_progreso INT;
BEGIN
    -- Obtener la inscripción y curso
    SELECT i.id, i.curso_id INTO v_inscripcion_id, v_curso_id
    FROM inscripciones i
    WHERE i.id = NEW.inscripcion_id;

    -- Contar módulos totales del curso
    SELECT COUNT(*) INTO total_modulos
    FROM modulos WHERE curso_id = v_curso_id;

    -- Contar módulos completados en esta inscripción
    SELECT COUNT(DISTINCT pl.modulo_id) INTO modulos_completados
    FROM progreso_lecciones pl
    WHERE pl.inscripcion_id = v_inscripcion_id AND pl.completado = TRUE;

    -- Calcular nuevo progreso
    IF total_modulos > 0 THEN
        nuevo_progreso := (modulos_completados * 100) / total_modulos;
    ELSE
        nuevo_progreso := 0;
    END IF;

    -- Actualizar inscripción
    UPDATE inscripciones
    SET progreso = nuevo_progreso,
        completado_en = CASE WHEN nuevo_progreso = 100 THEN NOW() ELSE completado_en END
    WHERE id = v_inscripcion_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_update_progreso AFTER INSERT OR UPDATE OF completado ON progreso_lecciones
    FOR EACH ROW EXECUTE FUNCTION actualizar_progreso_curso();
```

---

## 6. Estrategia de Sincronización Offline

### 6.1 Flujo General

```
┌──────────────┐     Sin conexión     ┌──────────────────┐
│  Dispositivo  │─────────────────────▶│  IndexedDB local │
│  (Angular PWA)│                      │  - sync_queue    │
│              │◀──────────────────────│  - courses       │
└──────┬───────┘     Con conexión      │  - progress      │
       │                                │  - downloads     │
       │                                └──────────────────┘
       │                                            │
       │  Sincronización automática                  │
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                     Supabase / PostgreSQL                      │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐   │
│  │ usuarios  │  │ inscrip-   │  │ progreso │  │ cola_sinc- │   │
│  │           │  │ ciones     │  │ lecciones│  │ ronización │   │
│  └──────────┘  └────────────┘  └──────────┘  └────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Proceso de Sincronización

1. **Detección de conectividad**: El `SyncService` escucha eventos `window.online`/`offline`.
2. **Al reconectar**: Se dispara automáticamente `syncNow()` mediante un `effect()`.
3. **Lectura de cola**: Se obtienen todas las acciones pendientes de IndexedDB (`sync_queue`).
4. **Envío por lotes**: Cada acción se envía como POST/PATCH a la API REST.
5. **Actualización de estado**: En `cola_sincronizacion`, el estado cambia a `'completed'` o `'failed'`.
6. **Reintentos**: Las acciones falladas se reintentan hasta 3 veces con backoff exponencial.

### 6.3 Resolución de Conflictos

Se utiliza la estrategia **Last-Write-Wins (LWW)** basada en timestamp:

| Conflicto | Estrategia | Detalle |
|-----------|-----------|---------|
| Progreso de lección duplicado | `ON CONFLICT (inscripcion_id, leccion_id) DO UPDATE` | Se actualiza si el nuevo timestamp es mayor |
| Inscripción duplicada | `ON CONFLICT (usuario_id, curso_id) DO NOTHING` | Se ignora si ya existe |
| Archivo descargado duplicado | `ON CONFLICT (usuario_id, nombre_archivo) DO UPDATE` | Se reemplaza si el nuevo es más reciente |

### 6.4 Cache Local (IndexedDB)

La aplicación mantiene 5 object stores en IndexedDB como caché local:

| Object Store | Propósito | Estrategia de Sync |
|---|---|---|
| `courses` | Contenido de cursos descargados | Pull desde servidor |
| `progress` | Progreso offline de lecciones | Push bidireccional |
| `downloads` | Metadatos de archivos descargados | Push al descargar |
| `sync_queue` | Acciones pendientes de enviar | Push-only |
| `settings` | Configuración local | Sin sync |

---

## 7. Seed Data

### 7.1 Cursos Iniciales

```sql
INSERT INTO cursos (id, titulo, descripcion, categoria, duracion, modulos, nivel, instructor, imagen, color, disponible) VALUES
    ('drones',
     'Drones para agricultura de precisión',
     'Aprende a utilizar drones para monitoreo de cultivos, análisis multiespectral y optimización de recursos.',
     'technology', '24h', 6, 'beginner',
     'Dr. Carlos Mendoza', 'drones', '#1e3a5f', TRUE),

    ('riego',
     'Riego inteligente y gestión hídrica',
     'Sistemas de riego automatizado, sensores de humedad y estrategias de ahorro de agua.',
     'agriculture', '18h', 4, 'intermediate',
     'Ing. María Quispe', 'riego', '#7a1a1a', TRUE),

    ('negocios',
     'Negocios digitales rurales',
     'Comercio electrónico, marketing digital y gestión de cooperativas para emprendedores rurales.',
     'business', '30h', 8, 'advanced',
     'Lic. Roberto Huamán', 'negocios', '#8a7a00', TRUE),

    ('suelos',
     'Análisis y conservación de suelos',
     'Técnicas de muestreo, análisis de nutrientes y prácticas de conservación del suelo.',
     'agriculture', '20h', 5, 'intermediate',
     'Dr. Ana Condori', 'suelos', '#2d6a4f', TRUE),

    ('apps',
     'Aplicaciones móviles para el campo',
     'Desarrollo de apps sencillas para registro de cosechas, monitoreo climático y trazabilidad.',
     'technology', '36h', 8, 'advanced',
     'Ing. Pedro Sánchez', 'apps', '#6b21a8', TRUE),

    ('cooperativas',
     'Gestión de cooperativas agropecuarias',
     'Administración, contabilidad básica y liderazgo para cooperativas rurales.',
     'business', '16h', 4, 'beginner',
     'CPC. Sofía Laura', 'cooperativas', '#b45309', TRUE);
```

### 7.2 Preguntas Frecuentes

```sql
INSERT INTO preguntas_frecuentes (clave_pregunta, clave_respuesta, orden) VALUES
    ('help.what_is', 'help.what_is_answer', 1),
    ('help.how_to_start', 'help.how_to_start_answer', 2),
    ('help.offline_mode', 'help.offline_mode_answer', 3),
    ('help.certificates', 'help.certificates_answer', 4),
    ('help.technical_support', 'help.technical_support_answer', 5),
    ('help.data_privacy', 'help.data_privacy_answer', 6);
```

---

## 8. Glosario — Mapeo Código Actual ↔ Schema Propuesto

### 8.1 localStorage → Base de Datos

| Clave localStorage | Tipo de Dato | Tabla | Columna | Notas |
|-------------------|-------------|-------|---------|-------|
| `rt_user` | `JSON (UserProfile)` | `usuarios` | Todas las columnas | Se deserializa y mapea campo a campo |
| `rt_token` | `string` | `sesiones` | `token` | JWT generado al autenticar |
| `rt_node` | `string` | `nodos` | `id` | Se genera si no existe |
| `rt_last_sync` | `string` | `nodos` | `ultima_sincronizacion` | Fecha legible |
| `preferredLanguage` | `'es' \| 'qu'` | `usuarios` | `idioma_preferido` | Migrar al perfil de usuario |

### 8.2 IndexedDB (rural_tech_db) → Base de Datos

| Object Store | Clave | Tabla | Notas |
|-------------|-------|-------|-------|
| `courses` | `id` | `modulos` + `inscripciones` | Dividir en dos tablas según semántica |
| `progress` | `courseId_lessonId` | `progreso_lecciones` | `leccion_id` conserva el formato compuesto |
| `downloads` | `name` | `archivos_descargados` | `nombre_archivo` como identificador único por usuario |
| `sync_queue` | auto-increment | `cola_sincronizacion` | `BIGSERIAL` replica auto-increment |
| `settings` | clave-valor | Distribuido | Cada setting va a su tabla correspondiente |

### 8.3 Interfaces TypeScript → Tablas

| Interfaz | Archivo | Tabla(s) |
|----------|---------|----------|
| `UserProfile` | `shared/types.ts` | `usuarios` |
| `AuthResult` | `shared/types.ts` | — (tipo de respuesta, no persistente) |
| `CatalogCourse` | `shared/types.ts` | `cursos` |
| `FaqItem` | `shared/types.ts` | `preguntas_frecuentes` |
| `Course` | `course.service.ts` | `inscripciones` |
| `ActiveDownload` | `course.service.ts` | `descargas_activas` |
| `SyncAction` | `indexeddb.service.ts` | `cola_sincronizacion` |
| `DownloadedFile` | `indexeddb.service.ts` | `archivos_descargados` |

---

## 9. Índices Recomendados — Resumen

| Tabla | Índice | Tipo | Justificación |
|-------|--------|------|---------------|
| `usuarios` | `email` | UNIQUE B-tree | Login por email |
| `usuarios` | `rol` | B-tree | Filtro por rol (admin) |
| `sesiones` | `(usuario_id) WHERE cerrado_en IS NULL` | Partial B-tree | Sesiones activas del usuario |
| `sesiones` | `token` | UNIQUE B-tree | Validación de JWT |
| `cursos` | `categoria` | B-tree | Filtro por categoría |
| `cursos` | `(disponible) WHERE disponible = TRUE` | Partial B-tree | Catálogo disponible |
| `modulos` | `(curso_id, orden)` | Composite B-tree | Orden de módulos por curso |
| `inscripciones` | `(usuario_id, progreso)` | Composite B-tree | Dashboard de progreso |
| `progreso_lecciones` | `(inscripcion_id) WHERE completado = TRUE` | Partial B-tree | Conteo de lecciones completadas |
| `archivos_descargados` | `(usuario_id) WHERE eliminado_en IS NULL` | Partial B-tree | Archivos activos del usuario |
| `cola_sincronizacion` | `(estado) WHERE estado IN ('pending','failed')` | Partial B-tree | Cola pendiente de procesar |
| `cola_sincronizacion` | `creado_en WHERE estado = 'pending'` | Partial B-tree | FIFO de sincronización |
| `preguntas_frecuentes` | `orden WHERE activo = TRUE` | Partial B-tree | FAQ ordenada |

---

## 10. Consideraciones de Seguridad

### 10.1 Resumen de Políticas RLS

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `usuarios` | Propio | — | Propio | — |
| `sesiones` | Propio | Propio | Propio | — |
| `nodos` | Propio | Propio | Propio | — |
| `cursos` | Todos (auth) | Admin | Admin | Admin |
| `modulos` | Todos (auth) | Admin | Admin | Admin |
| `inscripciones` | Propio | Propio | Propio | — |
| `progreso_lecciones` | Propio | Propio | Propio | — |
| `archivos_descargados` | Propio | Propio | Propio (soft delete) |
| `descargas_activas` | Propio | Propio | Propio | — |
| `cola_sincronizacion` | Propio | Propio | Propio | Propio |
| `certificados` | Propio | — | — | — |
| `preguntas_frecuentes` | Todos (auth) | Admin | Admin | Admin |

### 10.2 Protección de Contraseñas

- Hash: **bcrypt** con factor de costo 12.
- El campo `password_hash` solo es accesible por `service_role`.
- Los usuarios autenticados NO pueden leer `password_hash` de su propio perfil (excluir en policy).

```sql
CREATE POLICY usuarios_select_own_public ON usuarios
    FOR SELECT USING (id = auth.uid())
    WITH CHECK (true);  -- Supabase omite columnas ocultas por default
```

---

## 11. Migraciones

### 11.1 Creación Completa (Orden de Ejecución)

```sql
-- 1. Tipos ENUM
CREATE TYPE rol_usuario AS ENUM ('estudiante', 'docente');
CREATE TYPE idioma_code AS ENUM ('es', 'qu');
CREATE TYPE categoria_curso AS ENUM ('technology', 'agriculture', 'business');
CREATE TYPE nivel_curso AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE tipo_contenido AS ENUM ('video', 'pdf', 'quiz');
CREATE TYPE tema_curso AS ENUM ('yellow', 'blue', 'red', 'grey');
CREATE TYPE accion_sync AS ENUM ('COMPLETE_LESSON', 'SUBMIT_ASSESSMENT');
CREATE TYPE estado_sync AS ENUM ('pending', 'syncing', 'completed', 'failed');
CREATE TYPE tipo_sesion AS ENUM ('login', 'guest');

-- 2. Tablas (orden: sin FKs → con FKs)
-- 2a. Sin dependencias
CREATE TABLE usuarios ( ... );
CREATE TABLE nodos ( ... );
CREATE TABLE cursos ( ... );
CREATE TABLE preguntas_frecuentes ( ... );

-- 2b. Dependen de usuarios y cursos
CREATE TABLE sesiones ( ... );
CREATE TABLE certificados ( ... );
CREATE TABLE archivos_descargados ( ... );
CREATE TABLE cola_sincronizacion ( ... );

-- 2c. Dependen de cursos
CREATE TABLE modulos ( ... );

-- 2d. Dependen de inscripciones
CREATE TABLE inscripciones ( ... );
CREATE TABLE descargas_activas ( ... );

-- 2e. Dependen de inscripciones y modulos
CREATE TABLE progreso_lecciones ( ... );

-- 3. Índices
-- 4. Vistas
-- 5. Funciones y Triggers
-- 6. RLS
-- 7. Seed data
```

### 11.2 Rollback

```sql
DROP TRIGGER IF EXISTS after_update_progreso ON progreso_lecciones;
DROP TRIGGER IF EXISTS before_insert_certificado ON certificados;
DROP TRIGGER IF EXISTS set_updated_at ON usuarios;
DROP TRIGGER IF EXISTS set_updated_at ON nodos;
DROP TRIGGER IF EXISTS set_updated_at ON inscripciones;
DROP TRIGGER IF EXISTS set_updated_at ON progreso_lecciones;

DROP FUNCTION IF EXISTS actualizar_progreso_curso();
DROP FUNCTION IF EXISTS generar_codigo_certificado();
DROP FUNCTION IF EXISTS trigger_set_updated_at();

DROP VIEW IF EXISTS vista_progreso_usuario;
DROP VIEW IF EXISTS vista_cola_pendiente;
DROP VIEW IF EXISTS vista_cursos_disponibles;
DROP VIEW IF EXISTS vista_almacenamiento_nodo;

DROP TABLE IF EXISTS progreso_lecciones CASCADE;
DROP TABLE IF EXISTS descargas_activas CASCADE;
DROP TABLE IF EXISTS archivos_descargados CASCADE;
DROP TABLE IF EXISTS cola_sincronizacion CASCADE;
DROP TABLE IF EXISTS certificados CASCADE;
DROP TABLE IF EXISTS inscripciones CASCADE;
DROP TABLE IF EXISTS sesiones CASCADE;
DROP TABLE IF EXISTS modulos CASCADE;
DROP TABLE IF EXISTS nodos CASCADE;
DROP TABLE IF EXISTS preguntas_frecuentes CASCADE;
DROP TABLE IF EXISTS cursos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

DROP TYPE IF EXISTS tipo_sesion;
DROP TYPE IF EXISTS estado_sync;
DROP TYPE IF EXISTS accion_sync;
DROP TYPE IF EXISTS tema_curso;
DROP TYPE IF EXISTS tipo_contenido;
DROP TYPE IF EXISTS nivel_curso;
DROP TYPE IF EXISTS categoria_curso;
DROP TYPE IF EXISTS idioma_code;
DROP TYPE IF EXISTS rol_usuario;
```
