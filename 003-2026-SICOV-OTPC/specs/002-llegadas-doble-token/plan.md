# Implementation Plan — 002-llegadas-doble-token

**Feature Branch:** `feature/001-scaffolding` · **Status:** PLANEADO — **GATE HUMANO antes de implementar**
**Stack:** el de la feature 001 (Next.js 16 + Prisma `sicov` + PostgreSQL 16). Sin dependencias nuevas.

## 1. Resumen técnico
Segunda feature transaccional del 003. **Reutiliza el patrón completo de despachos (001-US2)**: cliente doble token (stub/real con doble gate), `TokenProveedorStore`, `construirCabeceras` + herencia rol 3, worker table-driven con estados/reintentos/advisory lock. Solo cambian: la tabla (`tbl_llegadas_solicitudes`), el endpoint externo (`/llegadasempresas`), el extractor de id (`extraerIdLlegadaExterno`), y campos propios (`placa`, `tipoLlegada`, `idDespacho`). **Guardarraíl:** stub por defecto, cero APIs reales.

## 2. Constitution Check
| Principio | Cumplimiento |
|---|---|
| §1.1 Aislamiento Docker | reusa contenedor 003 :5434; sin cambios de infra ✔ |
| §1.2 Migraciones aditivas | añade columnas de cola a llegadas de forma aditiva; nunca reset ✔ |
| §1.3 Secretos por env | sin secretos nuevos; credenciales Super siguen vacías/local ✔ |
| §1.4 Doble token | reutiliza las 3 cabeceras + herencia rol 3 ✔ |
| §1.5 5 reglas de oro | spec completo → commit por US → deploy limpio → pruebas → cierre ✔ |
| Guardarraíl APIs | stub por defecto; tests solo stub ✔ |

## 3. Decisiones de diseño
- **D1. Columnas de cola aditivas.** El legacy de llegadas no tiene `estado/reintentos/siguiente_intento/rol_id` (verificado en la migración). Se añaden en el modelo Prisma + migración aditiva `add_llegadas_cola` (nueva tabla en la BD del 003, ya con todas las columnas).
- **D2. Reutilizar la cola genérica.** Refactor menor: extraer la lógica de `src/lib/despachos/cola.ts` a una función parametrizable, o duplicar en `src/lib/llegadas/cola.ts` con el mismo patrón. **Recomendado:** `src/lib/llegadas/cola.ts` (`procesarLoteLlegadas`, `enviarLlegada`, `reintentarLlegada`) reusando `getClienteSupertransporte`, `construirCabeceras` y `extraerIdLlegadaExterno`. Mantiene simetría y evita sobre-generalizar.
- **D3. Un solo worker, dos pasadas.** El `worker-despachos.mjs` pasa a `worker.mjs` con dos pasadas por ciclo: `procesarLote()` (despachos) + `procesarLoteLlegadas()` (llegadas), bajo el **mismo advisory lock ID_003**. No se crea un segundo proceso → cumple "un solo worker" y no multiplica locks. (Alternativa descartada: worker separado con su propio lock — más procesos, más RAM.)
- **D4. `extraerIdLlegadaExterno`** se añade a `src/lib/normalizar.ts` (candidatos verificados). 
- **D5. Endpoints** nuevos: `POST /api/integracion/llegadas`, `POST /api/llegadas/[id]/reintentar`, `GET /api/integracion/llegadas`. Dashboard agrega `llegadasHoy`.

## 4. Estructura (archivos nuevos/tocados)
```
prisma/schema.prisma                      # + model LlegadaSolicitud
prisma/migrations/<ts>_add_llegadas_cola/ # aditiva
prisma/seed.ts                            # + llegadas demo
src/lib/normalizar.ts                     # + extraerIdLlegadaExterno (+ test)
src/lib/llegadas/cola.ts                  # procesarLoteLlegadas, enviarLlegada, reintentarLlegada (+ test)
src/app/api/integracion/llegadas/route.ts # POST (encolar) + GET (listado paginado)
src/app/api/llegadas/[id]/reintentar/route.ts
src/app/api/dashboard/route.ts            # + llegadasHoy
scripts/worker-despachos.mjs -> worker.mjs# dos pasadas (despachos + llegadas), mismo lock
package.json                              # script "worker" apunta a worker.mjs
```

## 5. Fases
1. **Datos:** modelo `LlegadaSolicitud` + migración aditiva + seed.
2. **Lib:** `extraerIdLlegadaExterno` + `src/lib/llegadas/cola.ts` (reusa cliente/cabeceras).
3. **US1:** endpoint registro + worker segunda pasada + reintentar. Tests (stub).
4. **US2:** listado paginado + KPI dashboard. Tests.
5. **Verificación:** `tsc`/`lint`/`vitest`/`build` + smoke en vivo (modo stub). **Sin APIs reales.**
6. **Cierre:** `cierre.md` + sección Implementación en `spec.md`.

## 6. Riesgos / deuda
- Payload real de `llegadasempresas` y catálogo `tipoLlegada` quedan `[NEEDS CLARIFICATION]`; el stub no los necesita.
- `idDespacho` es referencia lógica (sin FK en el legacy); no se valida contra despachos en P2.
- Renombrar `worker-despachos.mjs` → `worker.mjs` toca el script `worker` de `package.json`; verificar que el supervisor apunte al archivo correcto.

## 7. Operación (regla reforzada)
Al levantar/parar dev o worker en pruebas: **matar solo por PID o por puerto del 003 (5010/5434)**; **prohibido `pkill`/`killall` por patrón amplio** (`next dev`, `node`) que pueda alcanzar 001/002. (Regla añadida a `AGENTS.md §6`.)

## 8. Comandos (quickstart resumido)
```
# (BD 003 ya levantada de la feature 001)
npm run db:migrate:dev            # add_llegadas_cola
npm run db:seed
npm run dev                       # 5010
npm run worker                    # un solo worker: despachos + llegadas
npm run typecheck && npm run lint && npm run test && npm run build
```
