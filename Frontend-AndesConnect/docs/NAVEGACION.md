# Mapa de Navegación — Rural-Tech

## 1. Introducción

Este documento define el mapa completo de navegación de la aplicación **Rural-Tech**, una plataforma educativa offline-first para comunidades rurales con soporte bilingüe (español/quechua).

### 1.1 Convenciones

| Símbolo | Significado |
|---------|-------------|
| 🔓 | Ruta pública (sin autenticación) |
| 🔒 | Ruta protegida (requiere `authGuard`) |
| ⚠️ | Enlace roto / no funcional / bug |
| 🔄 | Navegación programática (`router.navigate()`) |
| 🔗 | Navegación declarativa (`routerLink`) |
| 📌 | Acción en la misma página (sin navegación) |

### 1.2 Tecnología de Ruteo

- **Angular Router** con `loadComponent` para lazy loading de todas las rutas.
- **AuthGuard** funcional (`CanActivateFn`) para rutas protegidas.
- Sin rutas hijas (anidadas) — todas las rutas son planas.

---

## 2. Tabla de Rutas Global

| Ruta | Componente | Guard | Acceso | Carga |
|------|-----------|-------|--------|-------|
| `/` | — | ❌ | Redirige a `/home` | Inmediata |
| `/home` | `HomeComponent` | ❌ | 🔓 Público | Lazy |
| `/login` | `LoginComponent` | ❌ | 🔓 Público | Lazy |
| `/courses` | `CoursesComponent` | ❌ | 🔓 Público | Lazy |
| `/help-center` | `HelpCenterComponent` | ❌ | 🔓 Público | Lazy |
| `/dashboard` | `DashboardComponent` | ✅ `authGuard` | 🔒 Autenticados | Lazy |
| `/profile` | `ProfileComponent` | ✅ `authGuard` | 🔒 Autenticados | Lazy |
| `/library` | `LibraryComponent` | ✅ `authGuard` | 🔒 Autenticados | Lazy |
| `/sync-status` | `SyncStatusComponent` | ✅ `authGuard` | 🔒 Autenticados | Lazy |
| `**` (wildcard) | — | ❌ | 🔓 Redirige a `/home` | Inmediata |

### 2.1 Redirecciones Automáticas

| Origen | Destino | Condición | Mecanismo |
|--------|---------|-----------|-----------|
| `/` | `/home` | `pathMatch: 'full'` | `redirectTo` en ruta |
| `**` (cualquier ruta desconocida) | `/home` | Siempre | `redirectTo` en ruta wildcard |
| `/dashboard` | `/login` | No autenticado | `authGuard` → `router.parseUrl('/login')` |
| `/profile` | `/login` | No autenticado | `authGuard` → `router.parseUrl('/login')` |
| `/library` | `/login` | No autenticado | `authGuard` → `router.parseUrl('/login')` |
| `/sync-status` | `/login` | No autenticado | `authGuard` → `router.parseUrl('/login')` |

---

## 3. Diagrama de Flujo Completo

```
                                  ┌──────────────────────┐
                                  │     / (raíz)          │
                                  │     ↓ redirige        │
                                  │     /home              │
                                  └──────────┬────────────┘
                                             │
                                             ▼
              ┌──────────────────────────────────────────────────────┐
              │                     /home 🔓                          │
              │  Landing page pública                                 │
              │  Incluye: <app-navbar /> + <app-footer />             │
              └────┬──────────┬──────────────┬──────────────────┬─────┘
                   │          │              │                  │
          [EMPEZAR]│          │    [VER OFFLINE]               │
           AHORA   │          │   (startOffline)                │
              │    │          │       ↓                         │
              │    │          │  Invitado                       │
              │    │          │  auth.loginAsGuest('home')       │
              │    │          │       ↓                         │
              │    │          │  /dashboard 🔒                  │
              ▼    │          └──────────────────┐              │
          ┌────────┴─┐                           │              │
          │ /login 🔓│◄──────────────────────────┘              │
          │          │  (navbar nav.login)                       │
          │          │◄──────────────────────────┐               │
          └───┬───┬──┘  (courses: enroll anon)   │              │
              │   │                              │              │
    [login/   │   │ [offline]                    │              │
     registro]│   │ (accessOffline)              │              │
     éxito    │   │    ↓                         │              │
      ↓       │   │ Invitado                     │              │
      │       │   │ auth.loginAsGuest('login')   │              │
      │       │   │    ↓                         │              │
      │       │   └──→ /dashboard 🔒             │              │
      │       └─────────────┐                    │              │
      ▼                     │                    │              │
  ┌─────────────────────────┴────────────────────┴──────────┐   │
  │                    /dashboard 🔒                         │   │
  │  Página principal del estudiante                         │   │
  │  Incluye: <app-navbar /> + <app-footer />                │   │
  │  Muestra: curso destacado, grid de cursos,               │   │
  │  descargas activas, progreso semanal                     │   │
  └──┬──────────┬──────────┬──────────┬──────────┬───────────┘   │
     │          │          │          │          │                │
     │          │          │          │          │                │
     ▼          ▼          ▼          ▼          ▼                │
  ┌──────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐      │
  │Self- │ │/courses│ │/library│ │/profile  │ │/sync-    │      │
  │loop⚠️ │ │ 🔓     │ │ 🔒     │ │ 🔒       │ │status 🔒 │      │
  │      │ │        │ │        │ │          │ │          │      │
  │(bug) │ │Público │ │Offline │ │Editar    │ │Sincroni- │      │
  │      │ │Catálogo│ │Archivos│ │perfil    │ │zación    │      │
  └──────┘ └───┬────┘ └───┬────┘ └────┬─────┘ └──────────┘      │
               │          │           │                          │
               │          │           │                          │
               ▼          │           ▼                          │
          ┌──────────┐    │     ┌──────────┐                     │
          │ /login 🔓│    │     │ /login 🔓│                     │
          │ (si anon)│    │     │ (logout) │                     │
          └──────────┘    │     └──────────┘                     │
                          │                                      │
                          ▼                                      │
                    ┌──────────┐                                 │
                    │ /courses │  (library: "descargar más")     │
                    │ 🔓       │                                 │
                    └──────────┘                                 │
                                                                │
                    ┌───────────────────────────────────────────┘
                    │
                    ▼
          ┌──────────────────────────────────────────────────────┐
          │                /help-center 🔓                        │
          │  Página pública de ayuda                              │
          │  Incluye: <app-navbar /> + <app-footer />             │
          │  Muestra: FAQ accordion, contacto, guía               │
          └──────────────────────────────────────────────────────┘
```

---

## 4. Mapa Detallado por Página

### 4.1 Navbar (`NavbarComponent`)

**Presente en:** Todas las páginas (Home, Dashboard, Courses, Library, Profile, Sync-Status, Help-Center).

**Comportamiento según estado de autenticación:**

#### Estado: No autenticado / Visitante

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| Logo "RURAL-TECH" | 🔗 `routerLink="/"` | Click | `/` → `/home` |
| `nav.home` ("Inicio") | 🔗 `routerLink="/home"` | Click | `/home` |
| `nav.courses` ("Cursos") | 🔗 `routerLink="/courses"` | Click | `/courses` |
| `nav.login` ("Iniciar sesión") | 🔗 `routerLink="/login"` | Click | `/login` |
| Icono sync (✓/⚡) | 🔗 `routerLink="/sync-status"` | Click | `/sync-status` |
| Botón "?" | 🔗 `routerLink="/help-center"` | Click | `/help-center` |
| "ES" / "QU" | 📌 `(click)="changeLanguage(...)"` | Click | Misma página |
| Menú hamburguesa (mobile) | 📌 `(click)="toggleMenu()"` | Click | Abre overlay |

#### Estado: Autenticado

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| Logo "RURAL-TECH" | 🔗 `routerLink="/"` | Click | `/` → `/home` |
| `nav.dashboard` | 🔗 `routerLink="/dashboard"` | Click | `/dashboard` |
| `nav.courses` ("Cursos") | 🔗 `routerLink="/courses"` | Click | `/courses` |
| `nav.library_offline` ("Biblioteca") | 🔗 `routerLink="/library"` | Click | `/library` |
| `nav.profile` ("Perfil") | 🔗 `routerLink="/profile"` | Click | `/profile` |
| Icono sync (✓/⚡) | 🔗 `routerLink="/sync-status"` | Click | `/sync-status` |
| Botón "?" | 🔗 `routerLink="/help-center"` | Click | `/help-center` |
| "ES" / "QU" | 📌 `(click)="changeLanguage(...)"` | Click | Misma página |
| `nav.logout` ("Cerrar sesión") | 🔄 `(click)="logout()"` | Click | `auth.logout()` → `/login` |

---

### 4.2 Footer (`FooterComponent`)

**Presente en:** Home, Dashboard, Courses, Library, Profile, Sync-Status, Help-Center.

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| `footer.support` ("Soporte") | 🔗 `routerLink="/help-center"` | Click | `/help-center` |
| `footer.guide` ("Guía") | 🔗 `href="#"` | Click | ⚠️ **Muerto** (`preventDefault`) |
| `footer.contact` ("Contacto") | 🔗 `href="#"` | Click | ⚠️ **Muerto** (`preventDefault`) |

---

### 4.3 Home (`/home`)

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| "EMPEZAR AHORA" (hero) | 🔄 `startNow()` | Click | `/login` |
| "VER MODO OFFLINE" (hero) | 🔄 `startOffline()` | Click | `loginAsGuest('home')` → `/dashboard` |
| "EXPLORAR CURSOS →" (card Negocios) | 🔄 `startNow()` | Click | `/login` |
| "VER MÓDULO →" (card Campo/Agro) | 🔄 `startNow()` | Click | `/login` |
| "INICIAR →" (card Alfabetización) | 🔄 `startNow()` | Click | `/login` |
| "BUSCAR GRUPOS" (card Comunidad) | 🔄 `startNow()` | Click | `/login` |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Mapa de salidas desde Home:

```
Desde /home puedes ir a:
  → /login            (cualquier botón de acción)
  → /dashboard        (solo vía "VER MODO OFFLINE" como invitado)
  → /courses          (navbar)
  → /help-center      (navbar ? o footer)
  → /sync-status      (navbar icono sync)
```

---

### 4.4 Login (`/login`)

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| Tab "ENTRAR" | 📌 `setRegisterMode(false)` | Click | Misma página (modo login) |
| Tab "CREAR" | 📌 `setRegisterMode(true)` | Click | Misma página (modo registro) |
| Form login submit | 🔄 `onLogin()` | Submit | Éxito → `/dashboard`. Error → misma página |
| Form registro submit | 🔄 `onRegister()` | Submit | Éxito → `/dashboard`. Error → misma página |
| "⤧" botón offline | 🔄 `accessOffline()` | Click | `loginAsGuest('login')` → `/dashboard` |
| "Olvidaste contraseña?" | 📌 — | Click | ⚠️ **Sin handler — no funcional** |
| Botón "?" (esquina) | 🔗 `routerLink="/help-center"` | Click | `/help-center` |
| ES / QU | 📌 `changeLanguage(...)` | Click | Misma página |

#### Mapa de salidas desde Login:

```
Desde /login puedes ir a:
  → /dashboard        (login/registro exitoso, o botón offline)
  → /help-center      (botón ?)
  → /courses          (navbar)
  → /home             (navbar)
```

---

### 4.5 Dashboard (`/dashboard`) 🔒

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| "▶ CONTINUAR" (curso destacado) | 🔄 `navigateTo('/dashboard')` | Click | ⚠️ **Self-loop bug** — debería ir a detalle de curso |
| "→" flecha en cards de curso | 🔄 `navigateTo('/dashboard')` | Click | ⚠️ **Self-loop bug** — debería ir a detalle de curso |
| "Sincronizar ahora" (link) | 🔄 `navigateTo('/sync-status')` | Click | `/sync-status` |
| "VER BIBLIOTECA COMPLETA" (botón) | 🔄 `navigateTo('/sync-status')` | Click | `/sync-status` |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Mapa de salidas desde Dashboard:

```
Desde /dashboard puedes ir a:
  → /dashboard        (self-loop ⚠️)
  → /sync-status      (sync ahora / ver biblioteca)
  → /courses          (navbar)
  → /library          (navbar)
  → /profile          (navbar)
  → /help-center      (navbar ? o footer)
  → /login            (navbar cerrar sesión)
```

---

### 4.6 Courses (`/courses`) 🔓

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| Filtro "TODOS" | 📌 `setFilter('all')` | Click | Misma página |
| Filtro "TECNOLOGÍA" | 📌 `setFilter('technology')` | Click | Misma página |
| Filtro "AGRICULTURA" | 📌 `setFilter('agriculture')` | Click | Misma página |
| Filtro "NEGOCIOS" | 📌 `setFilter('business')` | Click | Misma página |
| "INSCRIBIRSE" / "VER" (card) | 🔄 `enrollOrView(id)` | Click | Autenticado → `/dashboard`. Anónimo → `/login` |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Comportamiento de `enrollOrView(courseId)`:

```
enrollOrView(courseId)
  ├── ¿auth.isAuthenticated()?
  │    ├── Sí → router.navigate(['/dashboard'])
  │    └── No → router.navigate(['/login'])
  └── Nota: NO modifica el estado de inscripción del curso.
      Los cursos aparecen como "inscritos" solo si ya existen
      en courseService.courses() (datos mock predefinidos).
```

#### Mapa de salidas desde Courses:

```
Desde /courses puedes ir a:
  → /dashboard        (inscribirse estando autenticado)
  → /login            (inscribirse estando anónimo)
  → /home             (navbar)
  → /help-center      (navbar ? o footer)
  → /sync-status      (navbar icono sync)
  → /library          (navbar, solo auth)
  → /profile          (navbar, solo auth)
```

---

### 4.7 Library (`/library`) 🔒

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| "LIMPIAR CACHÉ" | 🔄 `goToSync()` | Click | `/sync-status` |
| "DESCARGAR MÁS" (empty state) | 🔄 `goToCourses()` | Click | `/courses` |
| "ABRIR" (archivo) | 📌 `openFile(name)` | Click | ⚠️ **Solo `console.log` — no abre el archivo** |
| "ELIMINAR" (archivo) | 📌 `deleteFile(name)` | Click | Misma página (elimina y actualiza) |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Mapa de salidas desde Library:

```
Desde /library puedes ir a:
  → /sync-status      (limpiar caché)
  → /courses          (descargar más)
  → /dashboard        (navbar)
  → /profile          (navbar)
  → /help-center      (navbar ? o footer)
  → /login            (navbar cerrar sesión)
```

---

### 4.8 Sync-Status (`/sync-status`) 🔒

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| "SINCRONIZAR AHORA" | 📌 `triggerSync()` | Click | Misma página (ejecuta sync) |
| "GESTIONAR" (cache) | 📌 `clearStorage()` | Click | Misma página (limpia caché) |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

**Nota:** Esta página es un **punto terminal** — no tiene botones de navegación propios (solo navbar/footer).

#### Mapa de salidas desde Sync-Status:

```
Desde /sync-status puedes ir a:
  → /dashboard        (navbar)
  → /courses          (navbar)
  → /library          (navbar)
  → /profile          (navbar)
  → /help-center      (navbar ? o footer)
  → /login            (navbar cerrar sesión)
```

---

### 4.9 Profile (`/profile`) 🔒

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| "GUARDAR" (formulario) | 📌 `saveProfile()` | Click | Misma página (persiste en localStorage) |
| "CERRAR SESIÓN" | 🔄 `logout()` | Click | `auth.logout()` → `/login` |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Mapa de salidas desde Profile:

```
Desde /profile puedes ir a:
  → /login            (cerrar sesión)
  → /dashboard        (navbar)
  → /courses          (navbar)
  → /library          (navbar)
  → /sync-status      (navbar)
  → /help-center      (navbar ? o footer)
```

---

### 4.10 Help Center (`/help-center`) 🔓

| Elemento UI | Tipo | Acción | Destino |
|------------|------|--------|---------|
| Preguntas FAQ | 📌 `toggleFaq(id)` | Click | Misma página (toggle accordion) |
| Email de contacto | 🔗 `href="mailto:..."` | Click | 📧 Cliente de correo externo |
| Teléfono de contacto | 🔗 `href="tel:..."` | Click | 📞 Inicia llamada telefónica |
| "DESCARGAR GUÍA" | — | Click | ⚠️ **Sin handler — no funcional** |
| Navbar + Footer | — | — | Ver secciones 4.1 y 4.2 |

#### Mapa de salidas desde Help Center:

```
Desde /help-center puedes ir a:
  → /home             (navbar)
  → /courses          (navbar)
  → /login            (navbar, solo si no auth)
  → /dashboard        (navbar, solo si auth)
  → /library          (navbar, solo si auth)
  → /profile          (navbar, solo si auth)
  → /sync-status      (navbar)
  → [email/tel]       (externo)
```

---

## 5. Tabla de Navegación Programática (`router.navigate`)

| Página origen | Disparador | Destino | Condición |
|--------------|-----------|---------|-----------|
| **Home** | `startNow()` | `/login` | Siempre |
| **Home** | `startOffline()` | `/dashboard` | `loginAsGuest('home')` exitoso |
| **Login** | `onLogin()` | `/dashboard` | Credenciales válidas |
| **Login** | `onRegister()` | `/dashboard` | Registro válido |
| **Login** | `accessOffline()` | `/dashboard` | `loginAsGuest('login')` exitoso |
| **Dashboard** | `navigateTo('/dashboard')` | `/dashboard` | ⚠️ Siempre (self-loop) |
| **Dashboard** | `navigateTo('/sync-status')` | `/sync-status` | Siempre |
| **Courses** | `enrollOrView(id)` | `/dashboard` | Autenticado |
| **Courses** | `enrollOrView(id)` | `/login` | No autenticado |
| **Library** | `goToCourses()` | `/courses` | Siempre |
| **Library** | `goToSync()` | `/sync-status` | Siempre |
| **Profile** | `logout()` | `/login` | Siempre |
| **Navbar** | `logout()` | `/login` | Siempre |

---

## 6. Tabla de Navegación Declarativa (`routerLink`)

| Página origen | Elemento | `routerLink` | Destino |
|--------------|----------|-------------|---------|
| **Navbar** (global) | Logo "RURAL-TECH" | `/` | `/` → `/home` |
| **Navbar** (global) | Icono sync | `/sync-status` | `/sync-status` |
| **Navbar** (global) | Botón "?" | `/help-center` | `/help-center` |
| **Navbar** (no auth) | `nav.home` | `/home` | `/home` |
| **Navbar** (no auth) | `nav.courses` | `/courses` | `/courses` |
| **Navbar** (no auth) | `nav.login` | `/login` | `/login` |
| **Navbar** (auth) | `nav.dashboard` | `/dashboard` | `/dashboard` |
| **Navbar** (auth) | `nav.courses` | `/courses` | `/courses` |
| **Navbar** (auth) | `nav.library_offline` | `/library` | `/library` |
| **Navbar** (auth) | `nav.profile` | `/profile` | `/profile` |
| **Footer** (global) | `footer.support` | `/help-center` | `/help-center` |
| **Login** | Botón "?" | `/help-center` | `/help-center` |

---

## 7. Acciones en Misma Página (Sin Navegación)

| Página | Elemento | Handler | Efecto |
|--------|----------|---------|--------|
| **Navbar** (global) | ES / QU | `changeLanguage(...)` | Cambia idioma interfaz |
| **Navbar** (global) | Menú hamburguesa | `toggleMenu()` | Abre/cierra overlay mobile |
| **Login** | Tab "ENTRAR" | `setRegisterMode(false)` | Muestra formulario login |
| **Login** | Tab "CREAR" | `setRegisterMode(true)` | Muestra formulario registro |
| **Login** | "Olvidaste contraseña?" | — | ⚠️ Sin efecto |
| **Courses** | Filtros categoría | `setFilter(...)` | Filtra grilla de cursos |
| **Help Center** | FAQ preguntas | `toggleFaq(id)` | Abre/cierra respuesta accordion |
| **Help Center** | "DESCARGAR GUÍA" | — | ⚠️ Sin efecto |
| **Library** | "ABRIR" archivo | `openFile(name)` | ⚠️ Solo console.log |
| **Library** | "ELIMINAR" archivo | `deleteFile(name)` | Elimina archivo, refresca lista |
| **Profile** | "GUARDAR" | `saveProfile()` | Persiste perfil en localStorage |
| **Sync-Status** | "SINCRONIZAR AHORA" | `triggerSync()` | Ejecuta sync |
| **Sync-Status** | "GESTIONAR" | `clearStorage()` | Limpia caché |

---

## 8. Enlaces Muertos / No Funcionales (⚠️)

| ID | Página | Elemento | Problema | Impacto |
|----|--------|----------|----------|---------|
| B01 | **Login** | "Olvidaste contraseña?" | Botón sin `click` handler ni `routerLink` | Usuario no puede recuperar contraseña |
| B02 | **Footer** | "Guía" (`footer.guide`) | `href="#"` con `$event.preventDefault()` | Enlace sin destino |
| B03 | **Footer** | "Contacto" (`footer.contact`) | `href="#"` con `$event.preventDefault()` | Enlace sin destino |
| B04 | **Help Center** | "DESCARGAR GUÍA" | Botón sin `click` handler ni `routerLink` | Usuario no puede descargar la guía |
| B05 | **Dashboard** | "▶ CONTINUAR" | `navigateTo('/dashboard')` → self-loop | Usuario no puede acceder al contenido del curso |
| B06 | **Dashboard** | Flecha "→" en cards | `navigateTo('/dashboard')` → self-loop | Usuario no puede abrir detalle del curso |
| B07 | **Library** | "ABRIR" archivo | Solo `console.log` | Usuario no puede abrir archivos descargados |

---

## 9. Flujos de Usuario por Rol

### 9.1 Visitante (No autenticado)

```
1. Llega a /home
2. Puede:
   a. Navegar a /courses para explorar el catálogo
   b. Ir a /help-center para leer FAQ
   c. Hacer clic en "EMPEZAR AHORA" → /login
   d. Hacer clic en "VER MODO OFFLINE" → /dashboard (como invitado)
   e. Navegar a /sync-status para ver estado (solo lectura)

3. Desde /courses:
   a. "INSCRIBIRSE" → redirige a /login
   b. Filtros → misma página

4. Desde /login:
   a. Crear cuenta → /dashboard
   b. Iniciar sesión → /dashboard
   c. Modo offline → /dashboard (invitado)
```

### 9.2 Estudiante (Autenticado)

```
1. Login exitoso → /dashboard
2. Desde /dashboard:
   a. Ver progreso de cursos
   b. "Sincronizar ahora" → /sync-status
   c. "VER BIBLIOTECA COMPLETA" → /sync-status
   d. Course cards → ⚠️ self-loop bug

3. Desde navbar:
   a. Dashboard, Cursos, Biblioteca, Perfil, Sync, Ayuda

4. Desde /profile:
   a. Editar nombre, email, ubicación
   b. "GUARDAR" → misma página
   c. "CERRAR SESIÓN" → /login

5. Desde /library:
   a. Ver archivos descargados
   b. "ABRIR" → ⚠️ no funcional
   c. "ELIMINAR" → elimina archivo
   d. "DESCARGAR MÁS" → /courses
   e. "LIMPIAR CACHÉ" → /sync-status

6. Desde /sync-status:
   a. "SINCRONIZAR AHORA" → procesa cola
   b. "GESTIONAR" → limpia caché
```

### 9.3 Invitado (Guest)

```
1. Acceso desde Home ("VER MODO OFFLINE") o Login ("⤧")
2. Misma experiencia que estudiante autenticado, pero:
   a. Perfil no persistente (datos mock)
   b. No puede recuperar sesión (datos en localStorage volátil)
   c. Misma navegación que estudiante
```

---

## 10. Bugs de Navegación Identificados

### B05-B06: Dashboard self-loop

```typescript
// dashboard.ts
navigateTo(route: string) {
  this.router.navigate([route]);  // route siempre es '/dashboard'
}

// dashboard.html
<button class="arrow" (click)="navigateTo('/dashboard')">→</button>
```

**Problema:** El método `navigateTo` recibe siempre `'/dashboard'` como parámetro desde el HTML. Los botones de cursos deberían navegar a una ruta de detalle de curso (ej: `/course/detalle/:id`) que actualmente **no existe** en el enrutador.

**Posible solución:** Crear una ruta `/course/:id` con un componente `CourseDetailComponent` y pasar el `course.id` real al método `navigateTo`.

### B07: Library "ABRIR" archivo

```typescript
// library.ts
openFile(fileName: string) {
  console.log('Abrir archivo:', fileName);
}
```

**Problema:** No hay implementación de apertura de archivos descargados. Debería leer el archivo desde IndexedDB/Cache API y abrirlo en una nueva ventana o visor.

### B04: Help Center "DESCARGAR GUÍA"

**Problema:** Botón sin click handler. Debería descargar un archivo PDF de guía de usuario desde Supabase Storage o assets.

---

## 11. Resumen de Conteo

| Tipo | Cantidad |
|------|----------|
| Rutas totales (incluyendo redirects) | 11 |
| Rutas públicas (🔓) | 5 |
| Rutas protegidas (🔒) | 4 |
| Redirecciones automáticas | 6 |
| Navegaciones programáticas (🔄) | 13 |
| Navegaciones declarativas (🔗) | 16 |
| Acciones misma página (📌) | 15 |
| Enlaces muertos / bugs (⚠️) | 7 |
| Componentes con navbar | 8 |
| Componentes con footer | 7 |

---

## 12. Historial de Cambios

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-05-30 | v1.0 | Creación inicial del mapa de navegación |
