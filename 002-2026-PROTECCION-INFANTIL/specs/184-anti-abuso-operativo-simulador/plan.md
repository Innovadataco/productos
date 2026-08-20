# Implementation Plan: SPEC-184 — Anti-abuso operativo + simulador de abusos

**Branch**: `work/002-pi-079` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

---

## Summary

Reemplazar `/dashboard/admin/anti-abuso` por un tablero operativo real (tops de IPs bloqueadas, identificadores, fingerprints y alertas), añadir `BlockList` persistente que corta antes del rate-limit, alertas email throttled ante picos de bloqueos, y un simulador de abusos que inyecta reportes reales por IPs RFC 5737. El simulador de scoring actual se conserva como tab secundario salvo decisión contraria de ZEUS/CEO.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, pg-boss, Resend |
| **Storage** | PostgreSQL 16 — migración ADITIVA (`BlockList` + enum audit + posible `SimulacionAbusoRun`) |
| **Testing** | Vitest integration para endpoints/servicios/repositorios; unit para componentes |
| **Procesos** | `scripts/simulador-abuso.mjs` separado, arrancado por `scripts/dev-restart.sh` (1 solo, advisory lock) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Los reportes del simulador son texto, igual que los reales |
| §1.3 Presunción de inocencia | ✅ Pass | El tablero usa lenguaje estadístico; no veredictos |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica la lógica de visibilidad |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual; no cambios de stack |
| §3.5 Logs y auditoría | ✅ Pass | Block/unblock y simulaciones van a `AuditLog` |
| I-22 No secretos | ✅ Pass | Ningún valor secreto en docs ni specs |
| I-49 Migraciones aditivas | ✅ Pass | `BlockList` + enum + seed; cero DROP |
| Q-3 Frontera DAL | ✅ Pass | Todo acceso a `BlockList` pasa por `BlockListRepository` |

---

## Estado actual (verificado en fuente)

- **Anti-abuso actual**: `/dashboard/admin/anti-abuso/page.tsx` renderiza `AdminAntiAbusoSimulacion`, que consume `GET /api/admin/anti-abuso/simulacion-score` y muestra score actual vs. ajustado por fuente (`src/components/modules/AdminAntiAbusoSimulacion.tsx`).
- **Rate-limit**: `src/lib/rate-limit.ts` con `checkRateLimit`, ventanas fijas en PostgreSQL, `getClientIp` desde headers, fail-open por defecto y fail-closed para `login`/`seguimiento`.
- **Fuente**: `src/lib/anti-abuso/fuente-reporte.ts` calcula `ipHash` y `fingerprintHash` con `ANTI_ABUSO_SALT`, y persiste en `FuenteReporte`.
- **Reportes**: `POST /api/reportes` crea reportes reales, aplica rate-limit, detecta spam y encola a Ollama. El texto se cifra en reposo.
- **Audit**: `src/lib/audit.ts` con `logAudit`; `AccionAudit` ya tiene valores para infra; se añadirán valores para blocklist/simulación.
- **DAL**: `src/lib/dal/repositories/` existe (`audit-log.ts`, `fuente-reporte.ts`, `reporte.ts`, etc.).
- **Seed**: `prisma/seed.ts` ya tiene sección `ratelimit.*` (aunque los defaults viven en código) y parámetros de alertas y monitoreo.
- **Email**: `src/lib/email.ts` con funciones específicas; se agregará `enviarAlertaRateLimit`.
- **Incidentes**: `src/lib/monitoreo/incidentes.ts` con patrón de `IncidenteInfra` + throttle; se reusará para picos de rate-limit.

---

## Diseño por fase

### Fase 1 — Migración, seed y repositorio BlockList

**Migración aditiva** (nombre tentativo `20260819010000_spec_184_anti_abuso_operativo`):

```text
model BlockList {
  id            String    @id @default(cuid())
  ipHash        String    @unique
  motivo        String
  expiraEn      DateTime?
  creadoPorId   String
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  creadoPor Usuario @relation(fields: [creadoPorId], references: [id])

  @@index([ipHash])
  @@map("block_list")
}
```

- Añadir relación `bloqueosCreados BlockList[]` en `Usuario`.
- Añadir valores al enum `AccionAudit`: `IP_BLOQUEADA`, `IP_DESBLOQUEADA`, `SIMULACION_ABUSO_INICIADA`, `SIMULACION_ABUSO_CANCELADA`, `SIMULACION_ABUSO_COMPLETADA`.
- Añadir modelo `SimulacionAbusoRun` (ver Fase 4) en la misma migración para no multiplicar migraciones.

**Seed** (`prisma/seed.ts`):

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `alerts.ratelimit.enabled` | BOOLEAN | `true` | Activar alertas por pico de bloqueos |
| `alerts.ratelimit.umbral_bloqueos_hora` | INTEGER | `20` | Bloqueos por IP/hora que disparan alerta |
| `alerts.ratelimit.throttle_min` | INTEGER | `60` | Mínimo entre emails del mismo pico |
| `alerts.ratelimit.destinatarios` | STRING | `""` | Emails separados por coma; vacío = no enviar |

**Repositorio** `src/lib/dal/repositories/block-list.ts`:

- `findByIpHash(ipHash)` — vigente (expiraEn > now o null).
- `findPaginadosVigentes(paginacion)` — lista vigente para el tablero.
- `crear(data)`.
- `eliminar(id)` o `marcarExpirado(id)`.

**Servicio** `src/lib/anti-abuso/block-list.ts`:

- `estaBloqueada(ipHash)` — wrapper con log y manejo de error (fail-open).
- `bloquearIp(ipHash, motivo, duracion, creadoPorId, request?)` — crea fila + audit.
- `desbloquearIp(id, creadoPorId, request?)` — elimina/marca + audit.

**Modificación `checkRateLimit`** (`src/lib/rate-limit.ts`):

- Antes del `INSERT ... ON CONFLICT`, obtener `clientIp` y consultar `BlockList` por `calcularIpHash(clientIp)`.
- Si bloqueada → devolver `{ allowed: false, ... }` con headers de rate-limit y 429; **no incrementar contador**.
- Si falla la consulta → loguear y continuar (fail-open).

**Tests**: `src/lib/dal/repositories/block-list.test.ts`, `src/lib/rate-limit.test.ts` (IP baneada no gasta cuota).

---

### Fase 2 — Tablero operativo

**Endpoints** (todos `verifyAuth("ADMIN")` + `assertModulo(user, "anti_abuso")`):

- `GET /api/admin/anti-abuso/tablero?ventana=24h|7d|30d` → agregados:
  - `topIpsBloqueadas`: top 10 `ipHash` con suma de bloqueos desde `RateLimit` (count - maxRequests > 0).
  - `topIdentificadores`: top 10 identificadores más reportados en ventana.
  - `topFingerprints`: top 10 `fingerprintHash` con más reportes en ventana.
  - `alertasActivas`: blocklist vigente + incidentes `rate_limit:*` abiertos recientes.
- `POST /api/admin/anti-abuso/bloquear` → body `{ ipHash, motivo, duracion: "24h" | "7d" | "permanente" }`.
- `POST /api/admin/anti-abuso/desbloquear` → body `{ id }`.

**Repositorios**:

- `RateLimitRepository` (nuevo o extendido en `src/lib/dal/repositories/rate-limit.ts`): conteos agregados por ventana.
- `ReporteRepository`/`FuenteReporteRepository`: agregados para tops (evitar groupBys pesados en la ruta).

**Servicio** `src/lib/anti-abuso/tablero.ts`:

- Orquesta las lecturas del repositorio y arma el DTO del tablero.

**UI** `src/app/dashboard/admin/anti-abuso/page.tsx`:

- Nuevo componente `AdminAntiAbusoPageClient` con tabs:
  - **Operativo**: tablero + botones de bloqueo/desbloqueo + selector de ventana.
  - **Simulador**: controles de escenarios y progreso en vivo.
  - **Scoring por fuente**: contenido actual movido desde `AdminAntiAbusoSimulacion` (renombrado).
- Reutilizar componentes existentes (`TarjetaMetrica`, `Tabla`, `Button`, etc.).

---

### Fase 3 — Alerta email throttled por pico de bloqueos

**Servicio** `src/lib/anti-abuso/rate-limit-alerts.ts`:

- `evaluarAlertaRateLimit(ipHash, scope)`:
  - Si `alerts.ratelimit.enabled` es false → no-op.
  - Contar bloqueos en la última hora para ese `ipHash`/`scope` desde `RateLimit`.
  - Si >= umbral: buscar `IncidenteInfra` abierto con señal `rate_limit:<scope>:<ipHash>`.
  - Si no existe o pasó el throttle → abrir/actualizar incidente + `enviarAlertaRateLimit` + audit.

**Integración**: `checkRateLimit` llama a `evaluarAlertaRateLimit` de forma **asíncrona y best-effort** cuando devuelve `allowed: false`.

**Email**: `enviarAlertaRateLimit({ ipHash, scope, bloqueos, destinatarios })` en `src/lib/email.ts`.

**Tests**: `src/lib/anti-abuso/rate-limit-alerts.test.ts`.

---

### Fase 4 — Simulador de abusos

**Modelo `SimulacionAbusoRun`**:

```text
model SimulacionAbusoRun {
  id             String   @id @default(cuid())
  escenario      String
  totalReportes  Int
  progreso       Int      @default(0)
  estado         String   @default("PENDIENTE") // PENDIENTE | EN_PROGRESO | COMPLETADA | CANCELADA | FALLIDA
  configJson     Json?
  resultadosJson Json?
  creadoPorId    String
  creadoEn       DateTime @default(now())
  actualizadoEn  DateTime @updatedAt

  creadoPor Usuario @relation(fields: [creadoPorId], references: [id])

  @@index([estado])
  @@index([creadoPorId])
  @@map("simulacion_abuso_runs")
}
```

**Validación de IP RFC 5737** (`src/lib/anti-abuso/rfc5737.ts`):

```ts
export function esIpRfc5737(ip: string): boolean {
  // IPv4 only; rangos: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
}
```

Test con `8.8.8.8` → false.

**Worker** `scripts/simulador-abuso.mjs`:

- Advisory lock (`pg_try_advisory_lock(123456791)`); exit 2 si ocupado.
- Bucle: buscar `SimulacionAbusoRun` con estado `PENDIENTE` o `EN_PROGRESO`.
- Para cada corrida:
  - Marcar `EN_PROGRESO`.
  - Según `escenario` y `configJson`, generar payloads de reporte con textos de un pool (`src/lib/anti-abuso/simulador-textos.ts`).
  - POST a `{NEXT_PUBLIC_APP_URL}/api/reportes` con header `x-forwarded-for: <ip>` y `User-Agent`/Accept-Language según escenario.
  - Capturar status (201/429/etc.), latencia y estado final del reporte (si se conoce vía respuesta).
  - Actualizar `progreso` y `resultadosJson` después de cada request.
  - Antes de cada request, recargar el estado de la corrida; si es `CANCELADA`, salir.
- Al terminar: `COMPLETADA` o `FALLIDA` + audit.
- Arranque en `scripts/dev-restart.sh` (1 solo proceso).

**Endpoints**:

- `POST /api/admin/anti-abuso/simular` → body `{ escenario, n?, ip?, identificador?, plataformaId?, usuarioId? }`; crea `SimulacionAbusoRun` en `PENDIENTE`; retorna 202 con `runId`.
- `GET /api/admin/anti-abuso/simular/[id]` → estado y resultados de la corrida.
- `POST /api/admin/anti-abuso/simular/[id]/cancelar` → actualiza a `CANCELADA` + audit.

**Escenarios**:

| Escenario | IPs | Identificador | Fingerprint | Auth | N |
|-----------|-----|---------------|-------------|------|---|
| 1. Robot inundando | 1 fija (RFC 5737) | rotativo | fijo | anónimo | 50 |
| 2. Ataque coordinado | 30 distintas (RFC 5737) | mismo objetivo | variado | anónimo | 30 |
| 3. IPs rotativas | 20 distintas (RFC 5737) | rotativo | variado | anónimo | 20 |
| 4. Denunciante spam | 1 fija | 10 distintos | fijo | usuario PARENT dado | 10 |
| 5. Personalizado | configurable | configurable | configurable | anónimo | configurable |

Nota sobre escenario 3: el rate-limit por fingerprint protege contra reincidencia desde el mismo cliente (misma IP truncada + mismo User-Agent). IPs rotativas, por diseño, generan fingerprints distintos; este escenario prueba precisamente que el ataque con IPs rotativas evade la defensa por fingerprint y debe ser detectado por otras señales (IP/rate-limit, identificador, scoring).

Nota sobre escenario 4: requiere un `usuarioId` de un PARENT existente; si no se provee, ese escenario falla con 400.

**UI** `src/components/modules/anti-abuso/SimuladorAbusoPanel.tsx`:

- Selector de escenario, formulario para personalizado, botón "Lanzar".
- Panel de progreso en vivo con polling a `GET /api/admin/anti-abuso/simular/[id]`.
- Botón "Cancelar" visible solo si estado es `PENDIENTE`/`EN_PROGRESO`.
- Tabla de resultados: exitosos, bloqueados, spam, latencia promedio, link al tablero.

---

## Project Structure

```text
prisma/migrations/20260819010000_spec_184_anti_abuso_operativo/migration.sql  # NUEVO
prisma/schema.prisma                                                           # MOD: +BlockList +SimulacionAbusoRun +AccionAudit
prisma/seed.ts                                                                 # MOD: +4 params alerts.ratelimit.*
scripts/simulador-abuso.mjs                                                    # NUEVO
scripts/dev-restart.sh                                                         # MOD: levantar simulador-abuso (1 solo)
src/lib/anti-abuso/block-list.ts                                               # NUEVO
src/lib/anti-abuso/rfc5737.ts                                                  # NUEVO
src/lib/anti-abuso/rate-limit-alerts.ts                                        # NUEVO
src/lib/anti-abuso/simulador-textos.ts                                         # NUEVO
src/lib/anti-abuso/tablero.ts                                                  # NUEVO
src/lib/dal/repositories/block-list.ts                                         # NUEVO
src/lib/dal/repositories/rate-limit.ts                                         # NUEVO/extendido
src/lib/dal/repositories/simulacion-abuso.ts                                   # NUEVO
src/lib/email.ts                                                               # MOD: +enviarAlertaRateLimit
src/lib/rate-limit.ts                                                          # MOD: consulta BlockList antes de contar
src/app/api/admin/anti-abuso/tablero/route.ts                                  # NUEVO
src/app/api/admin/anti-abuso/bloquear/route.ts                                 # NUEVO
src/app/api/admin/anti-abuso/desbloquear/route.ts                              # NUEVO
src/app/api/admin/anti-abuso/simular/route.ts                                  # NUEVO
src/app/api/admin/anti-abuso/simular/[id]/route.ts                             # NUEVO
src/app/api/admin/anti-abuso/simular/[id]/cancelar/route.ts                    # NUEVO
src/app/dashboard/admin/anti-abuso/page.tsx                                    # MOD: tabs operativo/simulador/scoring
src/components/modules/AdminAntiAbusoSimulacion.tsx                            # RENOMBRAR/MOVER a tab secundario
src/components/modules/anti-abuso/AdminAntiAbusoOperativo.tsx                  # NUEVO
src/components/modules/anti-abuso/SimuladorAbusoPanel.tsx                      # NUEVO
tests: repositorios, endpoints, rate-limit, alerts, rfc5737, componentes
docs/architecture/                                                             # REGENERAR
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Migración + seed + enum audit.
2. `BlockListRepository` + servicio `block-list` + modificación `checkRateLimit` + tests.
3. Endpoints de bloqueo/desbloqueo + tablero operativo + UI tabs.
4. Alertas rate-limit throttled + email + tests.
5. `SimulacionAbusoRun`, validación RFC 5737, worker `simulador-abuso.mjs`, endpoints de simulación.
6. UI del simulador + progreso en vivo + cancelación.
7. Mover simulador de scoring a tab secundario (o retirar según decisión compuerta).
8. ConfigPanel (los params ya están en seed bajo prefijo `alerts.ratelimit`; no requiere sección nueva si `alerts.` ya existe).
9. Regenerar docs/architecture + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Simulador consume mucho Ollama y deja reportes reales | Secuencial, progreso visible, cancelable; el CEO acepta el costo; sin flag SIMULACION (decisión documentada) |
| IPs RFC 5737 agotadas para escenarios grandes | Hay 3 /24 disponibles (768 IPs); escenarios predefinidos usan <=50 |
| `checkRateLimit` se hace más lento por consulta a BlockList | Índice por `ipHash`; consulta simple `findUnique`; fail-open ante timeout |
| Worker del simulador caído con corrida en progreso | Estado persistente; el admin puede cancelar; no hay auto-reinicio |
| Simulador usado accidentalmente en prod | Solo ADMIN con módulo `anti_abuso`; IPs restringidas a RFC 5737 |
| IPs rotativas generan fingerprints distintos | El escenario prueba el límite real de la señal; no se modifica `calcularFingerprintServerSide` |
| Escenario 4 requiere usuario PARENT de prueba | Exigir `usuarioId` en la UI/endpoint; fallar 400 si no existe o no es PARENT |

---

## Decisiones para compuerta §4

1. **Simulador de scoring viejo**: propuesta moverlo a un tab **secundario "Scoring por fuente"** dentro de `/dashboard/admin/anti-abuso`, conservando la ruta `/api/admin/anti-abuso/simulacion-score`. Si ZEUS/CEO prefieren, se **retira** (componente y ruta) en la misma spec.
2. **Persistencia del escenario en curso**: nueva tabla **`SimulacionAbusoRun`** (no reutilizar `SimulacionRun` del motor, porque los campos `modelo`/`casosJson` no encajan y queremos aislar el ciclo de vida del simulador de abusos).
3. **Cómo cortar la simulación**: worker separado `scripts/simulador-abuso.mjs` con advisory lock. La UI actualiza el estado a `CANCELADA`; el worker consulta el estado antes de cada POST y se detiene. No se matan procesos; los reportes ya creados siguen su curso.
4. **Alerta rate-limit**: reutilizar **`IncidenteInfra`** con señal `rate_limit:<scope>:<ipHash>` y throttle por señal (mismo patrón que SPEC-171). Email a `alerts.ratelimit.destinatarios`.
5. **Escenario 3 rebautizado a "IPs rotativas"**: no se modifica `calcularFingerprintServerSide` (verificado en fuente: incluye IP truncada). El escenario documenta el límite real de la señal de fingerprint, aprobado por ZEUS.
