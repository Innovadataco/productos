# Plan de implementación: SPEC-206 — Infra · Session Log (002-PI-120)

## Resumen

Construir la infraestructura de sesiones activas: modelo `SesionLog`, registro al login, ping del cliente, cierre por inactividad y vista admin con forzar cierre. Todo es aditivo; cero cambios en el motor de IA.

## Contexto técnico

- **Framework**: Next.js 16.2.10 App Router, React 19 Server Components por defecto.
- **Lenguaje**: TypeScript 5 con `strict: true`.
- **ORM**: Prisma 5.22.0 sobre PostgreSQL 16.
- **Auth**: JWT manual (`jose` + `bcryptjs`) + cookie `httpOnly`.
- **Colas**: `pg-boss` sobre PostgreSQL.
- **UI**: Tailwind CSS 3.4, componentes en `src/components/ui/**` y `src/components/modules/**`.
- **Testing**: Vitest + jsdom + Testing Library.

## Constitution Check

- ✅ Sin multimedia (solo texto + metadatos de sesión).
- ✅ Presunción de inocencia (lenguaje estadístico, nunca veredictos).
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.
- ✅ Ley 1581: IP hasheada, nunca en claro.

## Estructura del proyecto

### Documentación
```text
specs/206-infra-session-log/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── endpoints.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
prisma/schema.prisma                            # modelo SesionLog + enum MotivoCierreSesion + AccionAudit
prisma/migrations/20260822000000_add_sesion_log/migration.sql
prisma/seed.ts                                  # params sesion.* + seed idempotente
prisma/seed-modulos-grants.ts                   # modulo sesiones_admin
src/lib/auth.ts                                 # verifyAuth valida sesionLogId
src/lib/session-log/session-log-service.ts      # crearSesion, pingSesion, cerrarSesion, listarActivas
src/lib/session-log/ip-hash.ts                  # calcularIpHashSesion (wrapper anti-abuso)
src/app/api/auth/login/route.ts                 # llamar registrarInicioSesion + sesionLogId en JWT
src/app/api/session/ping/route.ts               # POST ping
src/app/api/session/ping/route.test.ts
src/app/api/admin/sesiones/route.ts             # GET listado paginado de activas
src/app/api/admin/sesiones/route.test.ts
src/app/api/admin/sesiones/[id]/cerrar/route.ts # POST forzar cierre
src/app/api/admin/sesiones/[id]/cerrar/route.test.ts
src/hooks/useSessionPing.ts                     # hook Page Visibility + intervalo
src/components/providers/SessionPingProvider.tsx
src/app/dashboard/layout.tsx                    # montar provider
src/app/dashboard/admin/estadisticas/operacion/components/SesionesTab.tsx
src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx # añadir tab Sesiones
src/lib/permisos-catalogo.ts                    # modulo sesiones_admin
scripts/worker-sesiones.mjs                     # worker de cierre por inactividad
```

## Cambios de código

### 1. Migración y schema
- Añadir modelo `SesionLog` con campos del BRIEF §5.1 (ajustados a convenciones del repo).
- Añadir enum `MotivoCierreSesion` con valores `LOGOUT`, `INACTIVIDAD`, `FORZADA`.
- Añadir valores `SESION_FORZADA_CIERRE` y `SESION_CIERRE_INACTIVIDAD` a `AccionAudit`.
- Índices: `@@index([usuarioId, iniciadaEn DESC])`, `@@index([tenantId, iniciadaEn DESC])`, `@@index([cerradaEn, ultimaActividadEn])`, `@@index([creadoEn])`.

### 2. Seed
- Sección `sesionParams` en `prisma/seed.ts` con `update: {}` (respeta custom del CEO):
  - `sesion.timeout_inactividad_minutos=30`
  - `sesion.ping_intervalo_minutos=5`
  - `sesion.retencion_dias=90`
  - `sesion.worker_intervalo_minutos=5`
- Módulo `sesiones_admin` en `src/lib/permisos-catalogo.ts` (categoría admin, orden 92, padre `estadisticas`).
- `seed-modulos-grants.ts` ya sincroniza desde `CATALOGO_MODULOS`; con el catálogo actualizado, el seed crea el módulo y grant para `ADMIN`.

### 3. Servicio de sesiones
- `SessionLogService`:
  - `registrarInicioSesion(request, usuario)`: crea fila, captura IP hasheada y user agent, devuelve `sesionLogId`.
  - `pingSesion(sesionLogId, usuarioId)`: update `ultimaActividadEn` si la sesión existe, no está cerrada y pertenece al usuario.
  - `cerrarPorInactividad(minutos)`: query + update masivo; devuelve conteo; calcula `duracionMin`.
  - `cerrarForzado(id, adminId)`: update + AuditLog.
  - `listarActivas(page, pageSize)`: join con `Usuario` para nombre/email/rol; devuelve DTO con IP truncada.
- Helper `calcularIpHashSesion(request)` reutiliza `calcularIpHash` de `src/lib/anti-abuso/fuente-reporte.ts`.

### 4. Auth
- `createToken` recibe payload arbitrario; el login pasa `{ sub, rol, sesionLogId }`.
- `verifyAuth`:
  - Si payload tiene `sesionLogId`, busca `SesionLog` por id.
  - Si no existe o `cerradaEn != null` → `AppError` 401.
  - Si no tiene `sesionLogId` → comportamiento actual (compatibilidad).

### 5. Endpoints
- `POST /api/auth/login`: después de `setSessionCookie`, incluye `sesionLogId` en JWT.
- `POST /api/session/ping`:
  - `verifyAuth()`.
  - Rate-limit scope `session_ping`.
  - Extrae `sesionLogId` del payload (cast con type guard).
  - Llama `SessionLogService.pingSesion`.
  - Retorna `{ ok: true }`.
- `GET /api/admin/sesiones`:
  - `verifyAuth("ADMIN")` + `assertModulo(..., "sesiones_admin")`.
  - Rate-limit `admin_read`.
  - Query params `page`, `pageSize`.
  - Retorna `{ items, pagination }`.
- `POST /api/admin/sesiones/[id]/cerrar`:
  - Valida ADMIN + módulo.
  - Llama `cerrarForzado`.
  - Retorna `{ ok: true, sesionId }`.

### 6. Cliente
- `useSessionPing()`:
  - Lee intervalo desde `useAuth` o hardcoded fallback 5 min.
  - Usa `setInterval`.
  - Antes de cada ping, verifica `document.visibilityState === 'visible'`.
  - Se limpia al desmontar.
  - Silencioso ante errores (log warn).
- `SessionPingProvider`: envuelve layouts autenticados (dashboard) y monta el hook.

### 7. Worker
- `scripts/worker-sesiones.mjs`:
  - `ensureQueue("sesion-cierre-inactividad")`.
  - `boss.schedule("sesion-cierre-inactividad", "*/5 * * * *", {}, { tz: "America/Bogota" })`.
  - `boss.work("sesion-cierre-inactividad", async (job) => { ... })`.
  - Lee `sesion.timeout_inactividad_minutos` y `sesion.worker_intervalo_minutos` de params.
  - Ejecuta cierre masivo; registra `AuditLog` agregado con conteo.
  - Usa advisory lock con id distinto al worker de reportes para permitir coexistencia.

### 8. UI admin
- `SesionesTab.tsx`:
  - Server Component dentro de `/dashboard/admin/estadisticas/operacion/page.tsx` (render condicional según `tab=sesiones`).
  - Tabla con columnas: Usuario, Rol, Iniciada, Última actividad, Duración, IP hasheada, Acción.
  - Botón "Forzar cierre" con confirmación; llama al endpoint y refresca la tabla.
- `EstadisticasSubNav.tsx`: añade tab `{ href: "/dashboard/admin/estadisticas/operacion?tab=sesiones", label: "Sesiones" }`.

### 9. Tests
- Integración:
  - Login crea `SesionLog` y JWT contiene `sesionLogId`.
  - Ping actualiza `ultimaActividadEn`.
  - Ping con sesión cerrada devuelve 401.
  - Forzar cierre cierra sesión y la siguiente request del usuario devuelve 401.
  - Listado admin solo devuelve sesiones activas.
- Unitario:
  - `calcularIpHashSesion` produce hash distinto para IPs distintas y trunca correctamente.
- Worker:
  - Test que crea sesión inactiva, ejecuta cierre simulado y verifica `cerradaEn` e `INACTIVIDAD`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambiar `verifyAuth` rompe sesiones existentes | Solo valida `sesionLogId` cuando existe; tokens previos sin el campo siguen aceptados |
| Worker de sesiones compite con worker de reportes | Advisory lock con id distinto; cada worker puede coexistir |
| Ping genera tráfico innecesario | Page Visibility API + intervalo configurable |
| Exposición de IP o user agent | Hash con salt + UI truncada; userAgent acotado a 256 chars |
| Query de sesiones lentas con muchas filas | Índices en `usuarioId/iniciadaEn` y `cerradaEn/ultimaActividadEn` |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests de integración para login, ping, listado admin y forzar cierre.
- Test del worker de cierre por inactividad.
- No tocar `src/lib/ai/**`.
- Migración aditiva sin DROP.
