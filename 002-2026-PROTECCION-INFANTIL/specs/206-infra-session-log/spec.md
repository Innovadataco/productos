# SPEC-206 — Infra · Session Log (002-PI-120)

> Status: `IMPLEMENTADO`
> PI: 002-PI-120
> Responsable: ODIN
> Rama: `work/002-pi-120`
> Base: `feature/001-scaffolding`

## Contexto

`SesionLog` es la infraestructura de instrumentación de uso activo que bloquea toda la cola del BRIEF-ANALISIS-DINERO-VS-VALOR (SPEC-220..227). Sin ella, el componente "sesiones" del score de valor no tiene fuente de datos. Es una SPEC pura de infraestructura: no emite eventos de negocio, no requiere Motor Notificaciones y no toca el motor de IA.

Cada inicio de sesión explícito crea una fila `SesionLog`. El cliente actualiza `ultimaActividadEn` con un ping cada 5 minutos mientras la pestaña esté visible. Un worker cierra sesiones inactivas después de 30 minutos. El admin puede ver sesiones activas en tiempo real y forzar el cierre de una sesión.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero ver la lista de sesiones activas en tiempo real, para detectar uso anómalo o sesiones colgadas. | Must |
| US-002 | Como sistema, quiero cerrar automáticamente sesiones inactivas tras 30 minutos, para no contar fantasmas en el score de valor ni mantener estado muerto. | Must |
| US-003 | Como usuario autenticado, quiero que mi sesión se mantenga viva mientras uso la app, sin pinguear si la pestaña está oculta, para ahorrar red y batería. | Must |
| US-004 | Como sistema, quiero registrar cada inicio de sesión con IP hasheada y user agent, para trazabilidad sin violar la Ley 1581. | Must |
| US-005 | Como admin, quiero poder forzar el cierre de una sesión activa, para mitigar riesgo de acceso no autorizado. | Must |

## Acceptance Scenarios

### AS-001 · Login crea sesión
**Given** un usuario autentica con éxito  
**When** el login responde 200  
**Then** se crea una fila `SesionLog` con `iniciadaEn`, `ultimaActividadEn`, `ipHash` y `userAgent`; el JWT payload incluye `sesionLogId`.

### AS-002 · Ping mantiene viva la sesión
**Given** un usuario autenticado con sesión activa  
**When** el cliente envía `POST /api/session/ping`  
**Then** la fila `SesionLog` actualiza `ultimaActividadEn = NOW()`.

### AS-003 · Ping respeta Page Visibility
**Given** una pestaña autenticada que pasa a `visibilityState === 'hidden'`  
**When** transcurre el intervalo de ping  
**Then** no se dispara ninguna petición de ping.

### AS-004 · Cierre por inactividad
**Given** una sesión cuya `ultimaActividadEn` es mayor a 30 minutos atrás  
**When** el worker de cierre ejecuta su ciclo  
**Then** la fila queda con `cerradaEn = NOW()` y `motivoCierre = INACTIVIDAD`; se calcula `duracionMin`.

### AS-005 · Vista admin de sesiones activas
**Given** un admin con módulo `sesiones_admin` en `/dashboard/admin/estadisticas/operacion?tab=sesiones`  
**When** carga la vista  
**Then** ve una tabla con sesiones activas ordenadas por `ultimaActividadEn DESC`, con usuario, rol, inicio, última actividad, duración, IP hasheada truncada y acción "Forzar cierre".

### AS-006 · Forzar cierre invalida la sesión
**Given** un admin fuerza el cierre de una sesión activa  
**When** el usuario de esa sesión intenta una acción autenticada  
**Then** recibe 401 porque `verifyAuth` rechaza el JWT cuya `sesionLogId` fue cerrada.

### AS-007 · Retención y privacidad
**Given** sesiones con más de 90 días de antigüedad  
**When** el sistema aplica la política de retención  
**Then** las filas se eliminan; nunca se guardó ni expuso la IP en claro.

## Functional Requirements

- **FR-001**: El modelo `SesionLog` DEBE existir con: `id`, `usuarioId` (FK a `Usuario`), `iniciadaEn`, `ultimaActividadEn`, `cerradaEn`, `motivoCierre`, `duracionMin`, `ipHash`, `userAgent`, `tenantId`, `rol`, `creadoEn`, `actualizadoEn`.
- **FR-002**: Al autenticar con éxito, el endpoint `POST /api/auth/login` DEBE crear una fila `SesionLog` e incluir `sesionLogId` en el JWT.
- **FR-003**: El endpoint `POST /api/session/ping` DEBE requerir autenticación, leer `sesionLogId` del JWT y actualizar `ultimaActividadEn` si la sesión sigue abierta.
- **FR-004**: El hook `useSessionPing()` DEBE disparar el ping cada `sesion.ping_intervalo_minutos` minutos SOLO cuando la pestaña esté visible.
- **FR-005**: El worker `scripts/worker-sesiones.mjs` DEBE programarse cada 5 minutos y cerrar sesiones cuya `ultimaActividadEn` supere `sesion.timeout_inactividad_minutos`.
- **FR-006**: La vista admin DEBE estar en `/dashboard/admin/estadisticas/operacion?tab=sesiones` y listar solo sesiones con `cerradaEn IS NULL`.
- **FR-007**: El endpoint `POST /api/admin/sesiones/[id]/cerrar` DEBE requerir `ADMIN` + módulo `sesiones_admin`, marcar la sesión como `FORZADA`, registrar `AuditLog` y hacer que `verifyAuth` rechace el JWT afectado.
- **FR-008**: Los parámetros `sesion.timeout_inactividad_minutos`, `sesion.ping_intervalo_minutos` y `sesion.retencion_dias` DEBEN sembrarse en `ParametroSistema` con valores por defecto.
- **FR-009**: `verifyAuth` DEBE validar que, si el JWT contiene `sesionLogId`, la sesión no esté cerrada; si el campo falta, DEBE seguir aceptando el token (compatibilidad con sesiones previas).
- **FR-010**: La IP DEBE almacenarse como `sha256(ANTI_ABUSO_SALT + ipTruncada)`; la UI solo muestra los últimos 4 caracteres del hash.
- **FR-011**: No se DEBE modificar `src/lib/ai/**`, el rate-limit del reporte público ni el flujo de clasificación.

## Non-Functional Requirements

- **NFR-001**: Ping < 100 ms en BD local; no debe cargar modelo ni realizar trabajo pesado.
- **NFR-002**: Cero PII: nunca se expone texto de reporte, identificador de menor ni denunciante.
- **NFR-003**: Ley 1581: IP siempre hasheada, nunca en claro.
- **NFR-004**: Migración aditiva únicamente; cero DROP/ALTER destructivo.
- **NFR-005**: Tests de integración para login+sesión, ping, cierre por inactividad, forzar cierre y vista admin.
- **NFR-006**: Gate local completo verde: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.

## Success Criteria

- **SC-001**: Cada login crea exactamente una fila `SesionLog` activa.
- **SC-002**: El ping actualiza `ultimaActividadEn` y respeta Page Visibility.
- **SC-003**: El worker cierra sesiones inactivas >30 min.
- **SC-004**: El admin ve sesiones activas y puede forzar cierre; el usuario forzado recibe 401 en la siguiente petición.
- **SC-005**: Gate local completo verde.
- **SC-006**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- `Usuario` tiene `id`, `email`, `nombre`, `rol`, `estado`, `tenantId`, `colegioId`.
- `ANTI_ABUSO_SALT` existe en entorno y cumple longitud mínima (SPEC-052).
- El login es el único punto de inicio de sesión explícito; no hay flujos de SSO.
- `verifyAuth` puede realizarse una consulta adicional a `SesionLog` cuando el payload lo indica.
- El worker de sesiones corre como proceso separado con acceso a `DATABASE_URL` y `WORKER_SECRET`.
- La app ya usa `Page Visibility API` en otros hooks; no se requiere polyfill.

## Decisiones propuestas para compuerta §4

1. **`sesionLogId` en JWT payload**: se aprovecha el token existente para transportar el id de sesión; evita una cookie extra y permite invalidar la sesión al cerrar la fila.
2. **Helper de login, no middleware global**: `registrarInicioSesion(request, usuario)` se invoca desde `POST /api/auth/login` justo antes de emitir el JWT; es el único punto de inicio de sesión explícito.
3. **Worker pg-boss separado**: `scripts/worker-sesiones.mjs` sigue el patrón `ensureQueue` + `boss.schedule` + `boss.work` de SPEC-182; el intervalo se lee del parámetro `sesion.worker_intervalo_minutos` (default 5).
4. **Sub-tab dentro de estadísticas**: la vista admin se ubica como tab "Sesiones" en `/dashboard/admin/estadisticas/operacion?tab=sesiones`, reutilizando `EstadisticasSubNav` y el layout admin (D-72).
5. **Invalidación de sesión forzada**: `verifyAuth` verifica el estado de `SesionLog` cuando el payload contiene `sesionLogId`; las sesiones previas sin el campo siguen funcionando.
6. **IP hasheada con salt del sistema**: se reutiliza `calcularIpHash` del módulo anti-abuso (`src/lib/anti-abuso/fuente-reporte.ts`) para consistencia y cumplimiento.

## Impacto en arquitectura:

- Nuevo modelo `SesionLog` + migración aditiva + índices.
- Cambio en `src/lib/auth.ts` para validar sesión cerrada cuando el payload lo indica.
- Cambio en `src/app/api/auth/login/route.ts` para registrar sesión e incluir `sesionLogId` en el JWT.
- Nuevos endpoints: `POST /api/session/ping`, `GET /api/admin/sesiones`, `POST /api/admin/sesiones/[id]/cerrar`.
- Nuevo hook `useSessionPing()` y provider en el layout de dashboard.
- Nuevo worker `scripts/worker-sesiones.mjs`.
- Nuevo módulo `sesiones_admin` en `permisos-catalogo.ts` + seed.
- No se toca el motor `src/lib/ai/**` ni el rate-limit de reportes.

## Deuda Técnica

- Ninguna identificada en fase de diseño.

## Implementación

- Migración aditiva `20260822000000_spec_206_sesion_log` aplicada; modelo `SesionLog`, enum `MotivoCierreSesion` y valores `SESION_FORZADA_CIERRE`/`SESION_CIERRE_INACTIVIDAD` en `AccionAudit`.
- Servicio DAL `SessionLogService` en `src/lib/dal/services/session-log.ts` con registro, ping, cierre por inactividad, forzar cierre, listado de activas y purga.
- `verifyAuth` valida `sesionLogId`; login crea sesión y la incluye en el JWT.
- Endpoints `POST /api/session/ping`, `GET /api/admin/sesiones`, `POST /api/admin/sesiones/[id]/cerrar` con tests de integración.
- Hook `useSessionPing` + `SessionPingProvider` montado en layout dashboard; respeta Page Visibility API.
- Worker `scripts/worker-sesiones.mjs` con pg-boss y advisory lock separado.
- Sub-tab "Sesiones" en `/dashboard/admin/estadisticas/operacion?tab=sesiones` con tabla y forzar cierre.
- Seed idempotente de params `sesion.*` con `update: {}`.
- Artefactos de arquitectura regenerados (`docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md`, `06-stack.md`).
- Ver `specs/206-infra-session-log/cierre.md` para evidencia completa del gate.
