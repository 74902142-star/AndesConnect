# Documentación Sprint 4 — Navbar Responsive, Nuevas Páginas y Correcciones

Este documento detalla la implementación del **Sprint 4** de **Rural-Tech**, que comprende la navegación responsive con menú hamburguesa, la creación de cuatro páginas faltantes (Courses, Profile, Help Center, Library), la corrección integral de Sync Status para usar traducciones y estilos consistentes, y el afinamiento responsive global.

---

## 1. Navbar Responsive (`src/app/components/layout/navbar.ts`)

Se reescribió completamente la navbar con:

### Menú Hamburguesa
- Botón hamburguesa visible en `max-width: 860px` con animación de rotación (X al abrir).
- Menú fullscreen overlay con `transform: translateX(100%)` → `translateX(0)` al abrir.
- Scroll interno con `overflow-y: auto` para evitar desbordamiento en pantallas pequeñas.
- Cierre automático al hacer clic en un enlace (`closeMenu()`).

### Routing Activo
- Todos los enlaces usan `routerLinkActive="active"` con indicador visual (barra inferior amarilla de 4px).
- Enlaces disponibles por estado de autenticación:
  - **No autenticado:** Home, Courses, Login
  - **Autenticado:** Dashboard, Courses, Library Offline, Profile, Logout
- Botón de ayuda (`?`) siempre visible con `routerLink="/help-center"`.

### Selector de Idioma
- Selector ES/QU con clase `.active` highlighting.
- Indicador de estado de conexión (online/offline) con `routerLink="/sync-status"`.

---

## 2. Nuevas Páginas Creadas

### 2.1 Courses (`/courses`)
- **Header:** Título "Catálogo de Cursos" con subtítulo.
- **Filter Tabs:** Botones Todos / Tecnología / Agricultura / Negocios con filtrado reactivo (`signal`).
- **Course Grid:** 6 tarjetas neo-brutalistas con:
  - Thumbnail SVG por categoría (drones, riego, suelos, emprendimiento, agroecología, gestión).
  - Badges: INSCRITO, OFFLINE, PRÓXIMAMENTE.
  - Metadatos: duración, módulos, nivel, instructor.
  - Barra de progreso para cursos activos.
  - Botón "Inscribirse" / "Ver Curso" y badge de descarga.
- **Footer** unificado con las demás páginas.

### 2.2 Profile (`/profile`)
- **Left column:** Tarjeta de información personal editable con:
  - Avatar con inicial del usuario.
  - Campos: nombre, email, comunidad, rol (solo lectura), contraseña.
  - Botón "Guardar Cambios" con banner de éxito mediante signal.
  - Botón "Cerrar Sesión" con logout y redirect a `/login`.
- **Right column:**
  - Stats grid: horas de estudio, certificados (con `padStart(2,'0')`), cursos completados.
  - Barra de progreso general.
  - Logros condicionales (primer curso, 50% progreso).
- **Footer** unificado.

### 2.3 Help Center (`/help-center`)
- **Header:** Título "Centro de Ayuda" con subtítulo.
- **FAQ Accordion:** 5 preguntas frecuentes con toggle expandible mediante `signal`.
  - ¿Cómo descargar curso offline?
  - ¿Cómo se sincronizan mis progresos?
  - ¿Puedo usar la plataforma sin Internet?
  - ¿Cómo obtengo mi certificado?
  - ¿Cómo cambio mi idioma?
- **Support Card:** Email y teléfono de contacto.
- **Guide Card:** Botón de descarga de guía PDF.
- **Footer** unificado.

### 2.4 Library / Biblioteca Offline (`/library`)
- **Header:** Título "Biblioteca Offline" con subtítulo.
- **Left column:**
  - **Storage Card:** Gauge de almacenamiento usado (reutiliza lógica de `SyncService`), espacio libre, botón "Liberar espacio".
  - **Offline Courses:** Tarjetas de cursos descargados con barra de progreso por tema (yellow/red/blue/green).
- **Right column:**
  - **Files Card:** Lista de archivos descargados con icono por tipo (PDF/Video), metadatos, botones "Abrir" y "Eliminar".
  - Soporte para mensaje de confirmación al eliminar (`deleteMessage` signal).
- **Footer** unificado.

---

## 3. Correcciones en Sync Status (`src/app/components/sync/`)

Se realizó una corrección integral de la página Sync Status para alinearla visual y funcionalmente con el resto de la aplicación.

### HTML (`sync-status.html`)
| Antes | Después |
|-------|---------|
| Texto hardcodeado en inglés ("SYNC STATUS", "SYNCHRONIZE NOW") | `ts.translate('sync.title')`, `ts.translate('sync.btn_sync')` |
| Footer con HTML propio (texto en inglés) | Footer unificado con `footer.info`, `footer.support`, `footer.guide`, `footer.contact` |
| `card-neo` en cada `.ready-item` | `.ready-item` sin `card-neo` (usa `border` directo del CSS) |
| Texto "OF" hardcodeado | Slash "/" |

### CSS (`sync-status.css`)
| Propiedad | Antes | Después |
|-----------|-------|---------|
| `.sync-header align-items` | `flex-end` | `center` |
| `.sync-heading font-size` | `5rem` | `4rem` |
| `.sync-heading line-height` | `0.95` | `1` |
| `.downloads-section` | `max-width: 1100px; margin: 0 50px` | `max-width: 1200px; margin: 0 auto` |
| `.downloads-section padding` | `28px 32px` | `28px 50px` |
| `.download-row grid` | `280px 1fr 120px` | `200px 1fr 100px` |
| `.bottom-row grid` | `1fr 340px` | `1fr 1fr` |
| `.ready-item` | Sin borde (heredaba de `card-neo`) | `border: var(--border-thick)` |
| Selectores de footer | Globales (`.footer-left`, etc.) | Anidados bajo `.sync-footer` |
| Responsive | Parcial | `.sync-heading` responsive, `.sync-now-btn` full-width, `.circuit-card` min-height, footer adaptativo |

### Traducciones Agregadas
Se agregaron 18 nuevas claves de traducción en `spanish.ts` y `quechua.ts` para Sync Status:
- `sync.title`, `sync.network_label`, `sync.mode_online`, `sync.mode_offline`
- `sync.btn_sync`, `sync.syncing_btn`
- `sync.local_storage`, `sync.used_space`, `sync.optimization`
- `sync.downloads_title`, `sync.queue_empty`
- `sync.ready_title`, `sync.ready_synced`
- `sync.need_space_title`, `sync.need_space_desc`
- `sync.btn_manage`, `sync.cleaning`

---

## 4. Enrutamiento (`src/app/app.routes.ts`)

Se configuraron rutas lazy para todas las 7 páginas:

| Ruta | Componente | Lazy Import |
|------|-----------|-------------|
| `/home` | `HomeComponent` | ✅ |
| `/login` | `LoginComponent` | ✅ |
| `/dashboard` | `DashboardComponent` | ✅ |
| `/sync-status` | `SyncStatusComponent` | ✅ |
| `/courses` | `CoursesComponent` | ✅ (nuevo) |
| `/profile` | `ProfileComponent` | ✅ (nuevo) |
| `/library` | `LibraryComponent` | ✅ (nuevo) |
| `/help-center` | `HelpCenterComponent` | ✅ (nuevo) |
| `''` | Redirect a `/home` | — |
| `**` | Redirect a `/home` | — |

---

## 5. Traducciones Completadas

Se agregaron todas las claves de traducción para las nuevas páginas en ambos idiomas:

### Spanish (`spanish.ts`)
- Nav: `nav.profile`, `nav.help_center`, `nav.library_offline`, `nav.dashboard`
- Courses: `courses.title` → `courses.no_courses` (20 claves)
- Profile: `profile.title` → `profile.logout` (18 claves)
- Help Center: `help.title` → `help.guide_download` (17 claves)
- Library: `library.title` → `library.free` (16 claves)
- Footer: `footer.info`, `footer.support`, `footer.guide`, `footer.contact`

### Quechua (`quechua.ts`)
Mismas claves traducidas al quechua (Chanka) con términos técnicos adaptados:
- Ej: `courses.title` → "Yachaykuna Wiyan", `library.title` → "Wañusqañam P'anqakuna"
- Se mantienen términos técnicos en español (email, PDF, video, URL) para claridad

---

## 6. Estilos Globales (`src/styles.css`)

Se mejoraron los estilos responsive globales:

| Breakpoint | Cambios |
|-----------|---------|
| `max-width: 768px` | `h1: 2.4rem`, `h2: 1.6rem`, botones reducidos, padding reducido |
| `max-width: 480px` | `h1: 2rem`, `h2: 1.4rem`, botones full-width y centrados |
| `max-width: 860px` | `hide-mobile`/`show-mobile` utilities |

Nota: Se eliminó `!important` de las reglas `h1`/`h2` responsive para evitar sobrescribir estilos específicos de componentes (ej: dashboard usa `font-size: 4.5rem`).

---

## 7. Estructura Final de Carpetas (Sprinte 1 a 4)

```
src/app/
├── components/
│   ├── auth/
│   │   ├── login.ts          ✅ Sprint 2
│   │   ├── login.html        ✅ Sprint 2
│   │   └── login.css         ✅ Sprint 2
│   ├── home/
│   │   ├── home.ts           ✅ Sprint 3
│   │   ├── home.html         ✅ Sprint 3
│   │   └── home.css          ✅ Sprint 3
│   ├── dashboard/
│   │   ├── dashboard.ts      ✅ Sprint 3
│   │   ├── dashboard.html    ✅ Sprint 3
│   │   └── dashboard.css     ✅ Sprint 3
│   ├── layout/
│   │   └── navbar.ts         ✅ Sprint 3 (mejorado Sprint 4)
│   ├── sync/
│   │   ├── sync-status.ts    ✅ Sprint 3 (corregido Sprint 4)
│   │   ├── sync-status.html  ✅ Sprint 3 (corregido Sprint 4)
│   │   └── sync-status.css   ✅ Sprint 3 (corregido Sprint 4)
│   ├── courses/
│   │   ├── courses.ts        ✅ Sprint 4 (nuevo)
│   │   ├── courses.html      ✅ Sprint 4 (nuevo)
│   │   └── courses.css       ✅ Sprint 4 (nuevo)
│   ├── profile/
│   │   ├── profile.ts        ✅ Sprint 4 (nuevo)
│   │   ├── profile.html      ✅ Sprint 4 (nuevo)
│   │   └── profile.css       ✅ Sprint 4 (nuevo)
│   ├── help-center/
│   │   ├── help-center.ts    ✅ Sprint 4 (nuevo)
│   │   ├── help-center.html  ✅ Sprint 4 (nuevo)
│   │   └── help-center.css   ✅ Sprint 4 (nuevo)
│   └── library/
│       ├── library.ts        ✅ Sprint 4 (nuevo)
│       ├── library.html      ✅ Sprint 4 (nuevo)
│       └── library.css       ✅ Sprint 4 (nuevo)
├── services/
│   ├── auth.service.ts       ✅ Sprint 2
│   ├── course.service.ts     ✅ Sprint 3
│   ├── indexeddb.service.ts  ✅ Sprint 3
│   ├── sync.service.ts       ✅ Sprint 3
│   └── translation.service.ts ✅ Sprint 1
└── i18n/
    ├── spanish.ts             ✅ Sprint 1 (ampliado Sprint 4)
    └── quechua.ts             ✅ Sprint 1 (ampliado Sprint 4)
```

---

## 8. Detalles Técnicos

### Señales (Angular Signals) Utilizadas
- `activeFilter` — Courses: filtro de categoría activo
- `menuOpen` — Navbar: estado del menú hamburguesa
- `saveSuccess` — Profile: indicador de guardado exitoso
- `deleteMessage` — Library: mensaje tras eliminar archivo
- `faqItems` — Help Center: lista de preguntas con estado `open`
- `downloadsInProgress`, `downloadedFiles` — CourseService: estado reactivo de descargas

### Convenciones de Footer
Todas las páginas usan el mismo footer structure:
```html
<footer class="[page]-footer">
  <div class="footer-left">
    <span class="footer-brand">RURAL-TECH</span>
    <span class="footer-copy">{{ ts.translate('footer.info') }}</span>
  </div>
  <nav class="footer-links">
    <a href="...">{{ ts.translate('footer.support') }}</a>
    <a href="...">{{ ts.translate('footer.guide') }}</a>
    <a href="...">{{ ts.translate('footer.contact') }}</a>
  </nav>
</footer>
```

### Corrección Destacada: Profile Certificate Counter
Se reemplazó la interpolación manual `0{{completedCourses}}` por `completedCourses.toString().padStart(2, '0')` para un formateo limpio y escalable.

---

## 9. Build y Verificación

```bash
✓ Build exitoso con 0 errores
⚠ Solo warnings de presupuesto CSS pre-existentes (4kB threshold superado por 1–2kB)
  - src/app/components/sync/sync-status.css — 5.78 kB
  - src/app/components/dashboard/dashboard.css — 5.58 kB
  - src/app/components/library/library.css — 5.49 kB
  - src/app/components/home/home.css — 5.14 kB
  - src/app/components/auth/login.css — 5.33 kB
  - src/app/components/profile/profile.css — 4.27 kB
```

---

## 10. Próximos Pasos (Sprint 5+)

- Implementar lógica real de autenticación (conexión a API)
- Reemplazar datos mock de cursos con datos desde API/IndexedDB
- Funcionalidad de descarga real de archivos
- Registro de Service Worker para PWA completa (ngsw-config.json ya configurado)
- Notificaciones push offline
- Tests unitarios y de integración
