# SPEC-024 · Layout + Sidebar navegación

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 024 |
| **Nombre** | layout-sidebar |
| **Origen** | BI · INSTRUCTIVO-011 · F3C 2026-08-29 20:29 COT · Brief A-51 §3-A |
| **Audiencia** | Admin/analista (Jelkin) · uso diario |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Reemplazar la landing `src/app/page.tsx` ("Plataforma en construcción" · 10 líneas) por un layout con barra lateral de navegación que abre las 4 secciones del BI y sirve de esqueleto para los SPECs 025..028. Login sigue redirigiendo a `PI_BASE_URL/login` (no se toca).

---

## Alcance

### Rutas y archivos que este SPEC produce

| Ruta | Qué contiene |
|---|---|
| `src/components/bi/layout/BiSideNav.tsx` (nuevo) | Sidebar con 4 secciones (Home · Dashboards · Chat NL→SQL · Configuración) |
| `src/components/bi/layout/BiAppShell.tsx` (nuevo) | Wrapper `<aside><main>` que envuelve las rutas autenticadas |
| `src/app/dashboard/layout.tsx` (nuevo) | Segment layout de Next.js App Router que aplica `BiAppShell` a `/dashboard/**` y guardia de sesión JWT |
| `src/app/dashboard/page.tsx` (nuevo) | Home real (contenedor vacío en este SPEC · SPEC-025 lo puebla con KPIs · SPEC-027 con estado sistema) |
| `src/app/page.tsx` (modificado) | Redirect a `/dashboard` |

### 4 secciones de la sidebar

| # | Etiqueta | Ruta destino | SPEC dueño |
|---|---|---|---|
| 1 | 🏠 Home | `/dashboard` | 024 (esqueleto) · 025 pobla KPIs · 027 pobla estado |
| 2 | 📊 Dashboards | `/dashboard/dashboards` (SPEC-028 pobla) | 028 |
| 3 | 💬 Chat NL→SQL | `/chat` (ya existe SPEC-013 · no se reescribe) | 026 (integra desde sidebar) |
| 4 | ⚙️ Configuración | `/dashboard/configuracion` (placeholder · Fase 2) | futuro |

Cada entrada es un `Link` de Next.js con estado activo (color destacado) y accesibilidad (`aria-current="page"`).

### Comportamiento de auth

- El segment `/dashboard/**` es un Server Component que en `layout.tsx` obtiene la sesión con `sesionDeRequest(req)` (import de `@/lib/auth/sesion` · **SOLO LECTURA · no se reinventa**).
- Si no hay sesión válida → `redirect('/login')` (que a su vez redirige a `PI_BASE_URL/login`, ya wire-through SPEC-013 I-11 CERRADA).
- `/chat` mantiene su propio comportamiento actual (no se toca su auth).
- `src/app/page.tsx` es un Server Component simple con `redirect('/dashboard')`.

### Fuera de alcance (van en SPECs siguientes)

- Contenido de KPIs · componente `KpisDashboardHome` (SPEC-025).
- Contenido de estado sistema (SPEC-027).
- Botones/link a Superset (SPEC-028).
- Integración de UI del chat en sidebar (SPEC-026 añade la entrada activa y el botón "Preguntá algo").
- Página `/dashboard/configuracion` (placeholder vacío en este SPEC).

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 | Rutas SOLO LECTURA respetadas | NO tocar `src/lib/bi/motor.ts` · `/api/bi/{preguntar,aprobar,rechazar}` · `src/lib/auth/**` · `src/lib/dal/**` · `superset/**` · `scripts/**` |
| — | Cero librerías nuevas | Solo Next.js + React + Tailwind + shadcn/ui + Inter/DM_Mono ya presentes (verificado en `package.json` post-lectura) |
| 9 | Sin datos → "sin datos" | El Home vacío muestra placeholders explícitos ("KPIs se muestran en SPEC-025"), nunca simulados |
| 14 | Verificación en vivo | Build + typecheck + tests locales · Jelkin valida en :3001 tras deploy |
| 17 | spec+plan commiteado antes de implementar | Aplicado |

---

## Riesgos

- **Colisión con `/login`:** el segment layout `/dashboard/**` redirige a `/login` si no hay sesión; `/login` a su vez redirige a `PI_BASE_URL/login`. Es 2 saltos pero cada uno es determinista y ya está probado por SPEC-013.
- **CSS tokens:** `BiAppShell` usa las clases Tailwind ya presentes en `globals.css` (`bg-page`, `text-body`, `glass-strong`). No se introducen tokens nuevos.
- **Coordinación con SPEC-026:** la entrada "Chat NL→SQL" apunta a `/chat` desde este SPEC. SPEC-026 solo la resalta como activa cuando el usuario está en `/chat`; no toca la sidebar de otra manera.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 20:4x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
