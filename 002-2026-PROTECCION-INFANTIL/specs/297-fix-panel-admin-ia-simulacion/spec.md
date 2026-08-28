# SPEC 297 — Fix Panel Admin IA + Simulación (002-PI-300)

**Status**: `DESARROLLO`
**Radicado gestión:** 002-PI-300 · INSTRUCTIVO-002-PI-200
**Brief origen:** `05-ENTREGABLES/BRIEF-A-46-FIX-PANEL-ADMIN-IA-SIMULACION.md`
**Rama:** `work/002-PI-300`
**Numeración código:** 092 (siguiente disponible tras 091). El instructivo mencionó `SPEC-300-fix-panel-admin-ia` en ruta `.specify/specs/`; se sigue la convención vigente del repo (`specs/NNN-slug/`) documentada en `AGENTS.md`.

---

## 1. Alcance

Tres correcciones acotadas, sin impacto en simulaciones en vuelo (`cmtd60m0*`) ni en el límite global de paginación (`MAX_PAGE_SIZE = 100`).

| ID gestión | Ámbito | Superficie |
|---|---|---|
| I-161 | Cierre asimétrico de `SimulacionRun` en `progreso.ts` | `src/lib/simulacion/progreso.ts:47-92` + tests |
| I-160 | Panel de parámetros trunca a 100 filas por paginación | Endpoint nuevo `todos/route.ts` + `ConfigPanel.tsx:31` |
| I-162 | Alineación al daemon Ollama `launchd` puerto 11435 | `ollama-config.ts:4`, `.env.example:16` |

Fuera de alcance: simulaciones activas, `MAX_PAGE_SIZE` global, `.env.production` del VPS, endpoint de recalcular manual, cualquier otra ruta o componente.

---

## 2. Problemas y soluciones

### 2.1 I-161 — `FALLIDA` bloquea el rescate por progreso ≥ total efectivo

**Estado actual (`progreso.ts:50`):** `COMPLETADA`, `FALLIDA` y `CANCELADA` son terminales: si un run marca `FALLIDA` por timeout pero después de la marca los reportes terminan de clasificarse, no hay forma de reclasificarlo automáticamente sin una acción manual.

**Cambio:** `COMPLETADA` y `CANCELADA` siguen siendo terminales. `FALLIDA` deja de serlo: se recalcula progreso contra el total efectivo (`totalCasos − casosFallidos`); si `progreso ≥ totalEfectivo`, el run se rescata a `COMPLETADA`, se persiste `fechaFin`, y se refrescan métricas. Si no llega, retorna `FALLIDA` inalterada.

**Racional:** `CANCELADA` es una acción humana intencional (nunca debe reabrirse); `COMPLETADA` ya calculó métricas (reabrir sería regresión). `FALLIDA` sólo señala expiró el timeout; si los datos ya alcanzaron el umbral la corrección es benigna e idempotente.

### 2.2 I-160 — Panel admin de parámetros no carga más de 100 filas

**Estado actual (`route.ts`):** `GET /api/config/parametros` pagina con `page`/`pageSize` (default 25, tope 100). El componente `ConfigPanel.tsx` no envía `pageSize` y recibe sólo 25 filas.

**Cambio:** endpoint nuevo `GET /api/config/parametros/todos`, admin-only, devuelve la tabla completa (`prisma.parametroSistema.findMany` sin `skip`/`take`) ordenada por `categoria`+`clave`. El componente cambia la URL a `/api/config/parametros/todos`. `MAX_PAGE_SIZE = 100` queda intacto en los demás endpoints como salvaguarda.

**Racional:** el panel admin es la única superficie que necesita ver todos los parámetros a la vez para editarlos en bloque. Un endpoint segregado admin-only evita bajar el tope global de 100 (que protege endpoints públicos y de operadores).

### 2.3 I-162 — Puerto Ollama por defecto no coincide con daemon `launchd`

**Estado actual:** `ollama-config.ts:4` y `.env.example:16` apuntan a `http://localhost:11434`. El daemon `launchd` `com.idc.ollama-serve` con `KEEP_ALIVE=24h` sirve en `11435`.

**Cambio:** ambos literales pasan a `http://localhost:11435`. `.env.production` del VPS lo actualiza Jelkin desde su terminal tras el deploy — no se toca desde el código.

**Racional:** el parámetro de sistema `system.ollama_base_url` sigue teniendo prioridad (ver `getOllamaBaseUrl`); esto sólo mueve el default para desarrollo y entornos que no lo tengan seteado.

---

## 3. Requerimientos funcionales

- **RF-1** — `actualizarProgresoYEstado(runId)` sobre un run `FALLIDA` cuyo `progreso ≥ totalEfectivo` retorna `{ estado: "COMPLETADA" }`, persiste `estado`, `progreso` y `fechaFin`, y ejecuta `refrescarMetricasSimulacion(runId)` (métrica `accuracy` presente en `metricasJson`).
- **RF-2** — `actualizarProgresoYEstado(runId)` sobre un run `FALLIDA` cuyo `progreso < totalEfectivo` retorna `{ estado: "FALLIDA", progreso: run.progreso }` sin llamar a `simulacionRun.update`.
- **RF-3** — `actualizarProgresoYEstado(runId)` sobre un run `CANCELADA` retorna `{ estado: "CANCELADA", progreso: run.progreso }` sin llamar a `simulacionRun.update` (comportamiento actual conservado).
- **RF-4** — `GET /api/config/parametros/todos` con sesión `ADMIN` responde `200` con `{ items: ParametroSistema[] }` ordenado por `categoria` asc, luego `clave` asc, sin `pagination`, sin `skip`/`take`.
- **RF-5** — `GET /api/config/parametros/todos` sin sesión o con rol distinto a `ADMIN` responde `403`.
- **RF-6** — `ConfigPanel` en el arranque llama `fetch("/api/config/parametros/todos", { credentials: "include" })` y consume `data.items`.
- **RF-7** — `getDefaultOllamaBaseUrl()` sin `process.env.OLLAMA_BASE_URL` retorna `"http://localhost:11435"`.
- **RF-8** — `.env.example` línea 16 muestra `OLLAMA_BASE_URL="http://localhost:11435"`.

## 4. No funcionales

- **NF-1** — Sin migraciones Prisma nuevas. Cero cambios en `schema.prisma`.
- **NF-2** — Sin impacto en simulaciones activas: el rescate se dispara desde el hook por reporte (`marcarProgresoSimulacionPorReporte`) o desde consultas explícitas al estado; nunca se ejecuta en batch fuera del ciclo normal.
- **NF-3** — El endpoint `/api/config/parametros/todos` sigue las convenciones de `AGENTS.md`: `route.ts` con `verifyAuth(RolUsuario.ADMIN)`, `AppError` con códigos canónicos, `NextResponse.json`.
- **NF-4** — Secretos siguen siendo enmascarados en el nuevo endpoint (misma lógica `esSecreto ? null : valor`).

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Rescate de `FALLIDA` reabre un run intencionalmente marcado como fallido para conservar la lección | Sólo se rescata si `totalEfectivo > 0 && progreso >= totalEfectivo`. Un run truncado (progreso < total) permanece `FALLIDA`. |
| Endpoint `/todos` expone parámetros secretos | Se mantiene el enmascarado `esSecreto ? null : valor` idéntico al endpoint paginado. |
| Cambio de puerto Ollama rompe entornos sin daemon en 11435 | El parámetro de sistema `system.ollama_base_url` sigue teniendo prioridad; los entornos que ya lo tienen configurado no se ven afectados. |

## 6. Criterios de aceptación

1. Suite `progreso.test.ts` verde con 3 tests nuevos (RF-1, RF-2, RF-3).
2. Suite `todos/route.test.ts` verde con 2 tests (RF-4 admin=200, RF-5 no-admin=403).
3. `npm run typecheck` y `npm run test:unit` verdes en el worktree.
4. `ConfigPanel` en dev carga todos los `ParametroSistema` (verificable manualmente contra `SELECT COUNT(*) FROM "ParametroSistema"`).
5. `grep -r "11434" src/ .env.example` no retorna resultados (excepto comentarios históricos si los hubiera).

## 7. Referencias

- Instructivo: 002-PI-300 · INSTRUCTIVO-002-PI-200 (Fábrica → CEO → Desarrollo D-1).
- Constitution: `.specify/memory/constitution.md` (v1.1.0).
- Convenciones: `AGENTS.md` §Convenciones de código, §Testing.
