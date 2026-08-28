# PLAN 092 — Fix Panel Admin IA + Simulación (002-PI-300)

## 1. Estrategia

Tres cambios independientes, cada uno con su test unitario. Sin migraciones, sin cambios en `schema.prisma`, sin tocar la simulación en vuelo. Push único con los 3 fixes; PR contra `main`.

## 2. Arquitectura afectada

| Capa | Archivos |
|---|---|
| Servicios | `src/lib/simulacion/progreso.ts` |
| API Routes | `src/app/api/config/parametros/todos/route.ts` (nuevo) |
| Componentes | `src/components/modules/ConfigPanel.tsx` |
| Configuración | `src/lib/ai/ollama-config.ts`, `.env.example` |
| Tests | `src/lib/simulacion/progreso.test.ts` (extendido), `src/app/api/config/parametros/todos/route.test.ts` (nuevo) |

## 3. Diseño por fix

### 3.1 I-161 — `progreso.ts:50` reemplazo quirúrgico

Reemplazo del bloque `if (["COMPLETADA", "FALLIDA", "CANCELADA"]...)` (3 líneas) por dos bloques:

- **Bloque A:** `if (["COMPLETADA", "CANCELADA"].includes(run.estado))` → retorno inmediato (idempotente).
- **Bloque B:** `if (run.estado === "FALLIDA")` → recalcula `progreso` con `calcularProgresoSimulacion(runId)`, lee `casosFallidos` de `metricasJson`, calcula `totalEfectivo = max(0, totalCasos − casosFallidos)`, y:
  - Si `totalEfectivo > 0 && progreso >= totalEfectivo` → `prisma.simulacionRun.update({ estado: "COMPLETADA", progreso, fechaFin: new Date() })` → `refrescarMetricasSimulacion(runId)` → `logger.info(...)` → retorna `{ progreso, estado: "COMPLETADA" }`.
  - En cualquier otro caso → retorna `{ progreso: run.progreso, estado: run.estado }` sin escribir a BD.

Todas las utilidades (`calcularProgresoSimulacion`, `leerCasosFallidos`, `refrescarMetricasSimulacion`) ya existen en el mismo archivo.

### 3.2 I-160 — Nuevo endpoint `todos/route.ts`

Ruta: `src/app/api/config/parametros/todos/route.ts`. Sólo `GET`. Estructura equivalente a `route.ts` pero sin paginación:

```
verifyAuth(RolUsuario.ADMIN)
assertModulo(usuario, "configuracion_sistema")
items = prisma.parametroSistema.findMany({ orderBy: [{ categoria: "asc" }, { clave: "asc" }] })
sanitized = items.map(p => ({ ...p, valor: p.esSecreto ? null : p.valor }))
return NextResponse.json({ items: sanitized })
```

`ConfigPanel.tsx:31` cambia únicamente la URL (de `/api/config/parametros` a `/api/config/parametros/todos`). La forma `{ items }` es compatible con el consumo actual (`data.items || []`); `data.pagination` deja de existir pero no se consume en `ConfigPanel`.

### 3.3 I-162 — Reemplazo textual en 2 líneas

- `src/lib/ai/ollama-config.ts:4` — literal `"http://localhost:11434"` → `"http://localhost:11435"`.
- `.env.example:16` — literal `"http://localhost:11434"` → `"http://localhost:11435"  # daemon launchd com.idc.ollama-serve (KEEP_ALIVE=24h)`.

## 4. Tests

### 4.1 `progreso.test.ts` — 3 tests nuevos en el `describe` existente

Aprovechan `mockRunFindUnique`, `mockRunUpdate`, `mockVinculosYReportes`, `mockClasifFindMany` ya definidos. No se crea archivo nuevo.

- **Test A — FALLIDA rescatada:** `runBase({ estado: "FALLIDA", totalCasos: 61, metricasJson: { casosFallidos: 0 } })`, 61 reportes `CLASIFICADO`. Resultado esperado: `estado === "COMPLETADA"`, `mockRunUpdate` llamado con `data.estado === "COMPLETADA"` y `data.fechaFin` presente.
- **Test B — FALLIDA no rescatada:** `runBase({ estado: "FALLIDA", totalCasos: 61 })`, sólo 30 reportes `CLASIFICADO`. Resultado esperado: `estado === "FALLIDA"`, `progreso === run.progreso`, `mockRunUpdate` no llamado.
- **Test C — CANCELADA intacta:** `runBase({ estado: "CANCELADA", progreso: 20 })`. Resultado esperado: `{ estado: "CANCELADA", progreso: 20 }`, `mockRunUpdate` no llamado, no lee vínculos ni reportes.

### 4.2 `todos/route.test.ts` — 2 tests

Mockea `@/lib/auth`, `@/lib/permisos-modulos`, `@/lib/prisma` siguiendo el patrón de otros `route.test.ts` del repo.

- **Test D — ADMIN 200:** `verifyAuth` retorna usuario ADMIN, `prisma.parametroSistema.findMany` retorna array de 3 elementos. Handler responde `200` con `{ items: [...] }` de longitud 3 y sin propiedad `pagination`.
- **Test E — no-ADMIN 403:** `verifyAuth` lanza `AppError` con `statusCode: 403`. Handler responde `403`.

## 5. Gate local

En el worktree:

```
npx tsc --noEmit
npm run test -- src/lib/simulacion/progreso.test.ts src/app/api/config/parametros/todos/route.test.ts
```

Sólo se corren los suites afectados para acelerar. Antes del push:

```
npm run typecheck
npm run test:unit
```

completo, y sólo con verde total se hace `git push` + `gh pr create`.

## 6. Orden de commits

Un único commit atómico (los 3 fixes son parte del mismo instructivo y comparten radicado). Mensaje:

```
002-PI-300: fix panel admin IA + rescate FALLIDA + puerto Ollama 11435

- I-161: FALLIDA deja de ser terminal; rescate a COMPLETADA si progreso>=totalEfectivo
- I-160: nuevo endpoint /api/config/parametros/todos admin-only sin paginación
- I-162: puerto por defecto Ollama pasa a 11435 (daemon launchd)
```

## 7. Post-merge

- Fábrica ejecuta merge a `main`.
- Jelkin dispara deploy y corre `sed` sobre `.env.production` del VPS para actualizar el puerto.
- CEO recibe la señal de deploy verde para cerrar 002-PI-300.
