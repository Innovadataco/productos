# Implementation Plan — 003-integradora-consulta

**Feature Branch:** `feature/001-scaffolding` · **Status:** PLANEADO — **GATE HUMANO antes de implementar**
**Stack:** el de las features 001/002 (Next.js 16 + Prisma `sicov`). **Sin migraciones** (consulta de solo lectura).

## 1. Resumen técnico
Tercer punto de integración con la Super y el **único de solo lectura**. Consulta síncrona `POST /api/integracion/integradora/resumen` que verifica en vivo licencia/SOAT/RTM/alcoholimetría/pólizas/tarjeta de conductor(es)+vehículo. **Sin cola, sin worker, sin tablas.** Usa **solo** `Authorization: Bearer <tokenExterno>` (decisión del responsable). **Guardarraíl:** stub por defecto, cero APIs reales.

## 2. Constitution Check
| Principio | Cumplimiento |
|---|---|
| §1.1 Aislamiento Docker | reusa infra 003; sin cambios ✔ |
| §1.2 Migraciones aditivas | **N/A** — no hay cambios de esquema ✔ |
| §1.3 Secretos por env | sin secretos nuevos; `tokenExterno` del store ✔ |
| §1.4 Doble token | **excepción justificada:** la integradora usa solo Bearer tokenExterno (no las 3 cabeceras), por instrucción y por paridad con el path del frontend legacy ✔ |
| §1.5 5 reglas de oro | spec completo → commit por US → deploy limpio → pruebas → cierre ✔ |
| Guardarraíl APIs | stub por defecto; tests solo stub ✔ |

**Única desviación:** cabeceras de la integradora (1 vs 3). Documentada en `contracts/integradora.md` y `spec.md` FR-003; el legacy backend usaba 3 (postTransaccional) pero el frontend usaba 1 — se adopta 1 por instrucción.

## 3. Decisiones de diseño
- **D1. Solo lectura, síncrona.** No se toca `schema.prisma`; no hay worker. La request atraviesa al stub/real y devuelve directo.
- **D2. Extender la interfaz del cliente** con `consultarIntegradora(body)`:
  - `ClienteStub.consultarIntegradora` → `RespuestaIntegradora` simulada (documentos vigentes), sin red.
  - `ClienteHttp.consultarIntegradora` → `POST {URL_INTEGRADORA}/api-integradora/resumen` con **solo Bearer tokenExterno** (via `getTokenProveedor()`), timeout 100 s, normaliza `obj ?? raíz`.
- **D3. Tipos** en `src/lib/integracion/integradora-tipos.ts` (del modelo real del frontend).
- **D4. Endpoint** `POST /api/integracion/integradora/resumen`: valida placa/identificación/fecha-hora, resuelve `nit` efectivo, llama al cliente, normaliza, responde.
- **D5. Pantalla** `/dashboard/integradora`: formulario + render del resumen (conductor(es)+vehículo con estados/vencimientos, resaltando vencidos).
- **D6. Normalización** reutiliza `extraerObjeto`/tolerancia de `src/lib/normalizar.ts`.

## 4. Estructura (archivos nuevos/tocados)
```
src/lib/integracion/integradora-tipos.ts     # DTOs
src/lib/integracion/cliente.ts               # + consultarIntegradora en la interfaz
src/lib/integracion/cliente-stub.ts          # + consultarIntegradora (simulado, sin red)
src/lib/integracion/cliente-http.ts          # + consultarIntegradora (Bearer tokenExterno solo)
src/app/api/integracion/integradora/resumen/route.ts   # POST
src/app/dashboard/integradora/page.tsx       # pantalla de consulta
(src/lib/normalizar.ts                        # reuso; sin cambios salvo helper si hace falta)
```
**Sin** cambios en `prisma/`, worker ni dashboard KPI.

## 5. Fases
1. **Tipos + cliente:** `integradora-tipos.ts`; extender interfaz + stub + http con `consultarIntegradora`. Tests del stub (sin red, forma de respuesta, solo Bearer).
2. **Endpoint:** `POST .../integradora/resumen` (validación, nit efectivo, normalización). Test.
3. **Pantalla:** formulario + render del resumen.
4. **Verificación:** `tsc`/`lint`/`vitest`/`build` + smoke en vivo (modo stub). **Sin APIs reales.**
5. **Cierre:** `cierre.md` + sección Implementación en `spec.md`.

## 6. Riesgos / deuda
- Payload de request y envoltorio de respuesta reales `[NEEDS CLARIFICATION]`; el stub define una forma coherente con el modelo del front.
- La discrepancia 1-vs-3 cabeceras se resuelve por instrucción; validar al conectar el modo real (podría requerir volver a 3 si la Super lo exige en ese endpoint).
- Sin caché: cada consulta es en vivo; si hay presión de rate-limit, evaluar caché corta (deuda futura).

## 7. Operación (regla reforzada — AGENTS.md §6)
Al levantar/parar dev en pruebas: **matar solo por PID o puerto del 003 (5010/5434)**; **prohibido** `pkill`/`killall` por patrón amplio. (Esta feature no levanta worker.)

## 8. Comandos (quickstart resumido)
```
# BD 003 ya levantada
npm run dev                       # 5010 (no requiere worker: consulta síncrona)
npm run typecheck && npm run lint && npm run test && npm run build
# smoke: POST /api/integracion/integradora/resumen con placa+identificación+fecha (stub)
```
