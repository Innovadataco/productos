# Feature Specification: Padre autenticado puede reportar (cierra I-146)

**Feature Branch**: `work/002-PI-196` (SPEC-295)
**SPEC**: 295
**Created**: 2026-08-27
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-196-PADRE-AUTENTICADO-REPORTAR · BRIEF-A-38 · I-146 · dep A-43 (CUMPLE)

Impacto en arquitectura: **fix funcional del panel padre** con backend aditivo. Se reemplaza el stub `PlaceholderPadre` de `src/app/dashboard/padre/reportar/page.tsx` por una página real que reutiliza `ReporteWizard` (componente ya compartido — vive en `src/components/modules/ReporteWizard.tsx` y ya lo consume `/reportar` público). Se agrega **campo aditivo `Reporte.origenRol`** al schema Prisma (nullable, sin default rompedor) y se setea `"PARENT"` en la API `/api/reportes` cuando `user?.rol === "PARENT"`. Se ajusta el flujo post-envío del wizard para redirigir a `/dashboard/padre/mis-reportes` cuando venga en modo autenticado (ver §Puntos de compuerta 2 para justificación). Cero cambios al motor IA, cero cambios al flujo anónimo, cero cambios en el sidebar (verificado: ya apunta a `/dashboard/padre/reportar`).

## Estado del código verificado en fuente (2026-08-27)

- ✅ `src/app/dashboard/padre/reportar/page.tsx` = **3 líneas de stub** (`PlaceholderPadre titulo="Reportar"`) — verificado.
- ✅ `src/components/modules/ReporteWizard.tsx` (225 líneas) ya es **componente compartido**: se importa desde `src/app/reportar/page.tsx` (público). Ya lee sesión vía `GET /api/me`, ya bloquea `ADMIN/OPERADOR/SCHOOL_ADMIN`, ya envía `credentials: "include"` al POST. No requiere refactor de extracción.
- ✅ `src/app/api/reportes/route.ts` (línea 40-66) ya autentica via `getUserFromToken`, ya rechaza roles no-PARENT, ya setea `usuarioId = user?.id ?? null` y `esAnonimo = !user`. **Solo falta setear `origenRol`.**
- ⚠️ `prisma/schema.prisma:1609-1680` — `Reporte.origenRol` **NO EXISTE**. Debe agregarse como campo aditivo.
- ✅ `src/components/modules/padre/PadreSideNav.tsx:54` — link "Reportar" ya apunta a `/dashboard/padre/reportar`. **NO requiere fix (candado §2.4 del INSTRUCTIVO cumplido de base).**
- ⚠️ **Flujo automático "reporte → expediente" NO EXISTE hoy** (grep sin resultados en `src/lib/expediente/` de creación automática desde `/api/reportes`). El `Expediente` se crea aparte (manual, motor). Por eso el redirect a `/dashboard/padre/expedientes/<id>` como propone el brief §2.3 NO es factible sin lógica nueva mayor — ver §Puntos de compuerta 2.

---

## Puntos de compuerta (para audit Fábrica)

1. **`origenRol` aditivo puro (migración no rompedora):** propongo agregar el campo como `origenRol String?` (nullable) — más simple y compatible que enum. Alternativa (enum): `enum OrigenRolReporte { PARENT ANONIMO }` con default `null`. Prefiero `String?` porque:
   - Los reportes anónimos existentes quedan con `NULL` (nunca se les asigna valor histórico).
   - Cero cambio a los tipos generados de Prisma para roles ni al `RolUsuario` enum.
   - Si Fase 2 quiere enum estricto, la migración de `String?` → `enum` es aditiva estándar.
   Los tests semánticos filtran por `origenRol === "PARENT"`.
   Necesita confirmación Fábrica.

2. **Redirect post-envío — `/dashboard/padre/expedientes/<id>` NO es factible sin lógica nueva mayor.** Brief §2.3 asume que "expediente ya existe funcionando" tras el reporte. Verificado en fuente: **hoy no se crea Expediente automáticamente al reportar** — el `Expediente` (SPEC-230) y sus `EventoExpediente` se crean por flujo separado. La ruta `/dashboard/padre/expedientes/[id]` espera `Expediente.id`, no `Reporte.id`.
   
   **Propuesta adoptada:** redirect a **`/dashboard/padre/mis-reportes`** post-envío autenticado. Esta ruta ya existe, muestra los reportes del padre, y es el equivalente semántico correcto ("acabaste de reportar → ve tu historial"). Cero cambios en la lógica del motor IA. Si Fábrica quiere que el reporte cree/actualice un Expediente automáticamente, es un frente separado (fuera de alcance del brief A-38: §2.2 motor IA sin cambios; agregar auto-creación de Expediente ES un cambio de pipeline).
   
   Requiere confirmación Fábrica.

3. **Componente compartido — reutilización directa (sin mover archivos):** el brief §2.1 sugiere encapsular el formulario en `src/components/modules/reportar/ReportarForm.tsx`. Verificado en fuente: **`ReporteWizard.tsx` ya está en `src/components/modules/` (no en `src/app/reportar/`) y ya lo consume `/reportar` público**. No requiere moverse. Ambas rutas (pública y padre) lo importan directamente. Ruta canónica del componente: **`src/components/modules/ReporteWizard.tsx`** (sin cambio). Se agrega prop opcional `modoAutenticado?: boolean` (o `redirectPostEnvio?: string`) para que la página del padre lo pase y el wizard redirija al destino correcto.

4. **`esAnonimo` por defecto en modo autenticado:** brief §2.1-2 dice `esAnonimo=false` por defecto con checkbox opcional. Verificado en fuente: hoy `esAnonimo=true` es el default del wizard, y la API infiere `esAnonimo = !user` (línea 47). **Cambio mínimo:** cuando `user?.rol === "PARENT"`, el wizard debe inicializar `data.esAnonimo=false` y mostrar un checkbox "reportar anónimo" (opcional). La API ya alinea (`esAnonimo = !user`), pero es UX importante que el usuario vea "estás reportando como Juan Pérez" — no como anónimo por sorpresa.

5. **Prellenar identidad UI:** hoy el wizard NO muestra en pantalla el email/nombre del user autenticado (solo internamente decide flujos por rol). Con el brief §2.1-2 hay que agregar un banner o campo prellenado "reportando como {nombre} ({email})" con opción "reportar anónimo" si el usuario quiere. Adaptación menor al `ReporteStepConfirmar` o al header del wizard.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Padre autenticado reporta desde su panel (Priority: P1)

Juan Pérez (PARENT) inicia sesión y hace click en "Reportar" del sidebar. Llega a `/dashboard/padre/reportar` y ve el formulario **real** (no el `PlaceholderPadre` de hoy), con un banner "reportando como Juan Pérez <juan@example.com>" y opción "reportar anónimo". Llena identificador, plataforma, ciudad, fecha, texto. Envía. Ve confirmación con el número de seguimiento y redirect a `/dashboard/padre/mis-reportes`. En BD: `Reporte { usuarioId: <juan.id>, esAnonimo: false, origenRol: "PARENT" }`. El motor IA lo procesa igual que un reporte anónimo (dedup + rúbrica + guardas + patrón coordinado).

**Why this priority**: Es el único motivo del frente. Cierra I-146. Hoy el padre autenticado NO puede reportar desde su sesión → hueco funcional grave post-A-43.

**Independent Test**: (a) test integración `/api/reportes` con JWT PARENT → `Reporte { usuarioId, origenRol="PARENT" }` en BD. (b) test E2E Playwright: login PARENT → `/dashboard/padre/reportar` → formulario real visible → llena → envía → redirect a `/dashboard/padre/mis-reportes`. (c) grep `PlaceholderPadre` en `dashboard/padre/reportar/page.tsx` → 0 hits.

**Acceptance Scenarios**:

1. **Given** PARENT autenticado con vigencia ACTIVA, **When** navega a `/dashboard/padre/reportar`, **Then** ve `<ReporteWizard modoAutenticado>` con banner de identidad y `esAnonimo=false` por defecto.
2. **Given** formulario completo válido, **When** el PARENT envía, **Then** POST `/api/reportes` retorna 201 con `reporte.id`; el wizard redirige a `/dashboard/padre/mis-reportes`; BD contiene `Reporte { usuarioId=<PARENT.id>, esAnonimo=false, origenRol="PARENT" }`.
3. **Given** PARENT que checkea "reportar anónimo" en el modo autenticado, **When** envía, **Then** BD contiene `Reporte { usuarioId=<PARENT.id>, esAnonimo=true, origenRol="PARENT" }` (el `usuarioId` se mantiene porque hay sesión, pero `esAnonimo` respeta la preferencia UX del padre — comportamiento actual de la API).

### User Story 2 — Anónimo público sin regresión (Priority: P1)

Un anónimo entra a `/reportar` (ruta pública), llena el formulario, envía. Todo funciona idéntico a hoy: sin banner de identidad, `esAnonimo=true` por defecto, redirect a la `ConfirmacionReporte` pública, BD contiene `Reporte { usuarioId: NULL, esAnonimo: true, origenRol: NULL }`.

**Why this priority**: Regresión invisible al ojo humano si se pierde el comportamiento del anónimo. El brief §3 y §4.3 lo marcan como crítico.

**Independent Test**: (a) test integración `/api/reportes` sin JWT → `Reporte { usuarioId=NULL, esAnonimo=true, origenRol=NULL }`. (b) Los tests actuales de `/reportar` público (`ReporteWizard.test.tsx`) siguen verdes sin modificarlos. (c) test E2E Playwright `reportes.spec.ts` existente sigue verde.

**Acceptance Scenarios**:

1. **Given** cliente anónimo, **When** POST `/api/reportes`, **Then** `Reporte { usuarioId=NULL, esAnonimo=true, origenRol=NULL }`.
2. **Given** `/reportar` público, **When** carga, **Then** wizard sin banner de identidad, `esAnonimo=true` por defecto, redirect a `ConfirmacionReporte` post-envío.

### User Story 3 — Motor IA sin cambios (Priority: P1)

Un reporte creado por PARENT autenticado pasa por el mismo pipeline que un anónimo: dedup → ráfaga → guardas previas → cache semántico → motor rúbrica → guardas posteriores → patrón coordinado. `Reporte.clasificacion` no null tras procesamiento. Cero cambio en el motor.

**Why this priority**: Brief §2.2 explícito. Regresión del motor IA sería catastrófica.

**Independent Test**: Test integración: crear reporte con PARENT → esperar procesamiento del worker → `Reporte.clasificacion` != null.

**Acceptance Scenarios**:

1. **Given** `Reporte { origenRol="PARENT" }` en `estado=PENDIENTE`, **When** el worker de reportes lo procesa, **Then** `clasificacion` se crea igual que para un anónimo (mismo modelo, mismos umbrales).

---

## Edge Cases

- **PARENT sin vigencia activa** (freemium expirado, suscripción cancelada): la API `/api/reportes` ya llama `assertVigenciaCliente(user.id)` (línea 51-54). El PARENT sin vigencia recibe 403 y no puede reportar. Comportamiento pre-existente conservado.
- **PARENT tenta reportar el mismo identificador dos veces (dedup)**: la API retorna 409/429 con `DUPLICATE_REPORT` (línea 140-144). Comportamiento actual conservado; el wizard muestra el error.
- **Rate limiting por usuario**: `checkRateLimit(request, "report", { identifier: user.id })` (línea 58) — comportamiento actual conservado.
- **PARENT con rol distinto (accidente en JWT)**: la API rechaza cualquier `user.rol !== "PARENT"` con 403 (línea 41-46). Cero cambio.
- **Reporte con `esAnonimo=true` pero JWT PARENT** (usuario checkeó "reportar anónimo"): `usuarioId=<PARENT.id>`, `esAnonimo=true`, `origenRol="PARENT"`. La distinción `usuarioId != NULL AND esAnonimo=true` es válida — el sistema sabe quién reportó pero respeta la preferencia UX de aparecer anónimo en el pipeline.
- **API `/api/reportes` respondiendo con reporte creado**: response actual (línea 180-190) devuelve `{ reporte: { id, numeroSeguimiento, estado } }`. Suficiente para el redirect (el wizard usa `numeroSeguimiento` para la confirmación; el `id` bastaría para redirect, pero como redirect va a `/mis-reportes` (lista) no requiere el `id`).
- **Sidebar link**: verificado — `PadreSideNav.tsx:54` ya apunta a `/dashboard/padre/reportar`. §2.4 del INSTRUCTIVO ya cumplido.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `src/app/dashboard/padre/reportar/page.tsx` DEBE reemplazar el stub `PlaceholderPadre` por una página server-component que renderice `<ReporteWizard modoAutenticado />` (u opción prop equivalente).
- **FR-002**: `src/components/modules/ReporteWizard.tsx` DEBE aceptar prop nueva opcional `modoAutenticado?: boolean` (o `redirectPostEnvio?: string`). Cuando `modoAutenticado=true`:
  - Inicializa `data.esAnonimo = false` (default UX; checkbox opcional para "reportar anónimo").
  - Muestra un banner "reportando como {user.nombre} <{user.email}>" en el paso 1 (o en el header del wizard).
  - Tras `handleSubmit` exitoso, redirige a `/dashboard/padre/mis-reportes` en vez de mostrar `ConfirmacionReporte` inline.
- **FR-003**: `prisma/schema.prisma` DEBE agregar campo `origenRol String?` al modelo `Reporte` (nullable, sin default rompedor). Migración aditiva pura (`ALTER TABLE reportes ADD COLUMN "origenRol" TEXT`). Cero cambio a filas existentes (todas quedan `NULL`).
- **FR-004**: `src/app/api/reportes/route.ts` DEBE setear `origenRol = user?.rol === "PARENT" ? "PARENT" : null` en el objeto `Reporte` que crea (pasarlo a `ReporteCreationService.crear`).
- **FR-005**: `ReporteCreationService.crear` DEBE aceptar el campo `origenRol` (opcional) y persistirlo en el `Reporte` creado.
- **FR-006**: NO se toca `PadreSideNav.tsx` (verificado: link ya correcto). Si aparece diff sobre ese archivo → HALLAZGO · PARA.
- **FR-007**: NO se cambia el motor IA (`src/lib/ai/**`) — candado global + candado brief §2.2.
- **FR-008**: NO se cambia el flujo anónimo público (`/reportar` sigue igual). El wizard sin `modoAutenticado` conserva comportamiento actual.
- **FR-009**: NO se crea/actualiza `Expediente` automáticamente al reportar (fuera de alcance — brief §3 excluye pipeline changes).
- **FR-010**: NO se agregan enums nuevos al schema (`origenRol` es `String?`, no enum — decisión Punto de compuerta 1).
- **FR-011**: Test integración cubre: (a) PARENT autenticado → `Reporte { usuarioId, origenRol="PARENT" }`; (b) anónimo → `Reporte { usuarioId=NULL, origenRol=NULL }`; (c) rol interno (ADMIN/OPERADOR/SCHOOL_ADMIN) → 403.
- **FR-012**: Test E2E Playwright `tests/e2e/padre-reporta-autenticado.spec.ts`: login PARENT → `/dashboard/padre/reportar` → formulario real visible → llena → envía → redirect a `/dashboard/padre/mis-reportes` → API admin verifica `Reporte { usuarioId != null, origenRol="PARENT" }`.

### Key Entities

- **`Reporte.origenRol`** (nuevo, opcional): `"PARENT" | null`. Distingue reportes hechos por padre autenticado de anónimos históricos (`NULL`). Fase 2 podría expandir a enum si aparece necesidad de más roles.
- **`ReporteWizard` con `modoAutenticado`**: mismo componente, prop opcional. Ruta pública lo consume sin prop; ruta padre lo consume con prop.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep "PlaceholderPadre" src/app/dashboard/padre/reportar/page.tsx` = 0 hits.
- **SC-002**: `curl -X POST /api/reportes` con JWT PARENT + payload válido → 201; `SELECT origenRol FROM reportes WHERE id='<nuevo>'` → `'PARENT'`.
- **SC-003**: `curl -X POST /api/reportes` sin JWT + payload válido → 201; `SELECT usuarioId, origenRol FROM reportes WHERE id='<nuevo>'` → `(NULL, NULL)`.
- **SC-004**: Test unit `ReporteWizard.test.tsx` sigue verde (regresión anónima).
- **SC-005**: Test E2E `padre-reporta-autenticado.spec.ts` verde (login PARENT → reportar → BD OK).
- **SC-006**: Gate LOCAL verde: `tsc --noEmit`, `lint 0 err`, `tokens:check`, `arch:check`, `locks:check`, `ratchets:check`, `test:unit`.
- **SC-007**: `SELECT COUNT(*) FROM reportes WHERE "origenRol"='PARENT'` en prod post-deploy después de una prueba real: al menos 1 fila.
- **SC-008**: **Verificación en vivo**: acceder a la app con credenciales `.env.e2e` como PARENT, navegar a `/dashboard/padre/reportar`, ver formulario real, enviar reporte, ver redirect a `/dashboard/padre/mis-reportes`, verificar en BD prod `Reporte { usuarioId, origenRol="PARENT" }`.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` HEAD (`6c5ad230`) — post-merge SPEC-294.
- `.env.e2e` contiene credenciales de PARENT válidas en prod (SPEC-171 / SPEC-266 Q-1). Verificación en vivo (SC-008) las usa.
- El `ReporteWizard` actual (225 líneas) puede aceptar prop nueva sin refactor mayor.
- El motor IA (`src/lib/ai/**`) y el worker de reportes NO requieren cambio para procesar `Reporte` con `origenRol="PARENT"` — el pipeline es agnóstico al origen.
- La ruta `/dashboard/padre/mis-reportes` ya existe y muestra los reportes del padre autenticado (verificable con grep — no toca esta SPEC).
- La API `/api/reportes` respuesta actual `{ reporte: { id, numeroSeguimiento, estado } }` es suficiente para el redirect del wizard.
- Cero cambios en `src/lib/ai/**`, cero eliminaciones en Prisma, cero cambios en el sidebar del padre.
