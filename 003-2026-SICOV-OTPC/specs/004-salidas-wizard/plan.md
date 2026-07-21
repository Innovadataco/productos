# Implementation Plan — 004-salidas-wizard

**Feature Branch:** `feature/001-scaffolding` · **Status:** PLANEADO — **GATE HUMANO antes de implementar**
**Stack:** el de features 001/002/003. **Sin migraciones** (compone sobre `tbl_despachos_solicitudes` existente).

## 1. Resumen técnico
Flujo estrella: **wizard de salidas**. Es **composición de UI + armado de payload**, reutilizando la consulta integradora (003) y el reporte de despacho (001-US2). Añade el **constructor de payload** (portado de `salidas-payload.util`) y **endpoints de maestras** (rutas, autorizaciones) read-through con stub. **No** duplica cliente/worker/integradora. **Guardarraíl:** stub por defecto, cero APIs reales.

## 2. Constitution Check
| Principio | Cumplimiento |
|---|---|
| §1.1 Aislamiento Docker | reusa infra 003 ✔ |
| §1.2 Migraciones aditivas | **N/A** — sin cambios de esquema ✔ |
| §1.3 Secretos por env | maestras usan TOKEN/paramétricas del env (modo real); sin secretos en repo ✔ |
| §1.4 Doble token | el reporte final reutiliza US2 (3 cabeceras + herencia rol 3) sin cambios ✔ |
| §1.5 5 reglas de oro | spec completo → commit por US → deploy limpio → pruebas → cierre ✔ |
| Guardarraíl APIs | stub por defecto; tests solo stub ✔ |

**Sin desviaciones.**

## 3. Decisiones de diseño
- **D1. Composición, no duplicación.** El envío final es `POST /api/integracion/despachos` (US2). La consulta es `POST /api/integracion/integradora/resumen` (003). El worker y el cliente **no se tocan**.
- **D2. Constructor de payload** `src/lib/despachos/payload.ts` (portado de `salidas-payload.util`): `buildObjDespacho`, `buildObjVehiculo(form, integradora)`, `buildObjConductores(form, integradora)`, `buildObjRutas`, `buildRegistroDespacho`. Tests unitarios (form + `RespuestaIntegradora` → payload correcto).
- **D3. Maestras** como extensión del cliente (`consultarRutasActivas`, `consultarAutorizaciones`) con stub (sin red) + http (solo modo real); endpoints `GET /api/integracion/maestras/rutas-activas-empresa` y `.../autorizaciones`. Reusan `TokenProveedorStore`/`construirCabeceras` o TOKEN estático según se confirme.
- **D4. UI wizard** `src/app/dashboard/salidas/`: una sola página con **secciones colapsables** gateadas por la integradora (no stepper). Reusa la pantalla de integradora (003) como paso embebido.
- **D5. Reuso de tipos**: `RegistroDespachoIntegracion` y sub-DTOs en `src/lib/despachos/despacho-tipos.ts` (o junto a payload). `RespuestaIntegradora` viene de 003.
- **D6. Listado de salidas** reusa `GET /api/integracion/despachos` + reintento.

## 4. Estructura (archivos nuevos/tocados)
```
src/lib/despachos/despacho-tipos.ts          # DTOs del payload (RegistroDespachoIntegracion, obj_*)
src/lib/despachos/payload.ts                 # constructor (portado) + tests
src/lib/integracion/cliente.ts               # + consultarRutasActivas / consultarAutorizaciones
src/lib/integracion/cliente-stub.ts          # + maestras simuladas (sin red)
src/lib/integracion/cliente-http.ts          # + maestras reales (solo modo real)
src/app/api/integracion/maestras/rutas-activas-empresa/route.ts   # GET
src/app/api/integracion/maestras/autorizaciones/route.ts          # GET
src/app/dashboard/salidas/page.tsx           # listado + botón registrar
src/app/dashboard/salidas/wizard.tsx (o /nueva/page.tsx)          # wizard (secciones colapsables)
```
**Sin** cambios en `prisma/`, worker, ni el endpoint de despacho (US2) / integradora (003).

## 5. Fases
1. **Tipos + payload:** `despacho-tipos.ts` + `payload.ts` (portar `salidas-payload.util`) + tests.
2. **Maestras:** extender cliente (stub/http) + endpoints GET rutas/autorizaciones. Tests del stub.
3. **UI wizard (US1):** página con secciones colapsables; integrar integradora (003) → autocompletar; construir payload; UN POST a `/api/integracion/despachos`.
4. **Listado (US2):** pantalla de salidas (reusa GET despachos + reintento).
5. **Verificación:** `tsc`/`lint`/`vitest`/`build` + smoke en vivo (modo stub, wizard completo → despacho encolado → worker procesa). **Sin APIs reales.**
6. **Cierre:** `cierre.md` + Implementación en `spec.md`.

## 6. Riesgos / deuda
- Contrato de maestras (rutas/autorizaciones) y su auth (TOKEN estático vs paramétricas) `[NEEDS CLARIFICATION]`; el stub define forma coherente.
- Reglas finas de autocompletado vehículo↔integradora más allá de lo visto en `salidas-payload.util`.
- UI extensa (varios subformularios); se prioriza el camino feliz + validaciones clave; refinamiento visual iterativo.

## 7. Operación (regla — AGENTS.md §6)
Al levantar/parar dev para smoke: **matar solo por PID/puerto del 003 (5010)**; si se prueba el worker, matar por PID exacto del proceso 003. **Prohibido** `pkill`/`killall` amplio.

## 8. Comandos (quickstart resumido)
```
# BD 003 levantada
npm run dev        # 5010
npm run worker     # para que el despacho encolado se procese (modo stub)
npm run typecheck && npm run lint && npm run test && npm run build
```
