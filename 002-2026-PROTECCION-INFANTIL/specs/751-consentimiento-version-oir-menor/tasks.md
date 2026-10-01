# Tasks — SPEC-751 · Consentimiento por versión + «oír al menor» per-menor

> Compuerta §4 primero: PARO tras spec+plan+tasks para aprobación del CEO + respuesta de abogado (FR-007/FR-008). Implementación DESPUÉS.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Mecanismo primero: verificar SPEC-241 en el código (versión ya re-consiente) y `Hijo` (sin audiencia). Documentar el hallazgo.
- [x] T002 spec.md (hallazgo, FR, decisiones D-1..D-5, candados, [ABOGADO] marcados).
- [x] T003 plan.md (contrato de datos + puerta + superficie + parámetros + candados + orden).
- [x] T004 §4 APROBADO por el CEO (con (a) sin denormalizar). Abogado (FR-007 texto / FR-008 política) en el paquete de Jelkin; tabla en Datos/765.

## Fase implementación — lo que NO necesita la tabla ni al abogado (ESTE entregable)
- [x] T005 **Artefacto de esquema** `AudienciaMenor` para D-121 (`data-model.md`): campos/FK Cascade/índices/clasificación PII. La tabla la implementa Datos (SPEC-765); Dev-2 no toca `schema.prisma`.
- [x] T008 **Puerta (predicado PURO)** `src/lib/consentimiento/audiencia-gate.ts`: `titularAlDia` = cuenta vigente **Y** cada menor ACTIVO oído para la versión vigente (per-menor). Reusa la política FR-008. Sin BD.
- [x] T011 Parámetro sembrado `audiencia_menor.reoir_en_cambio_de_version` (default `true`, porqué en el seed; `update:{}` para no clobbear una decisión de abogado en re-seed).
- [x] T012a Candados PUROS: C-per-menor-no-global · C-versión (política) · **C-no-romper-cuenta (regresión SPEC-241)** — la cuenta manda y no se debilita. (`audiencia-gate.candado.test.ts`.)
- [x] T012b Tope MEDIDO: `padre.hijos.maximo` default **5**, sobre menores ACTIVOS (SPEC-339/363) → la consulta del gate es barata (confirma no-denormalizar).

## Fase implementación — EL CONTINENTE (2026-09-30, Dev 2)
- [x] T006 D-121 `AudienciaMenor` — **Datos**, ya en `main` (SPEC-781 · `df4b10085`).
- [x] T007 `AudienciaMenorService` (`src/lib/dal/services/audiencia-menor.ts`): `declararAudienciaMenor` = INSERT inmutable + `AuditLog` en la misma tx, idempotente por `@@unique`; + `menoresPendientesDeAudienciaDelTitular` / `hayAudienciaPendiente` / `titularAlDiaDeAudiencia`. Cablea el predicado puro a Prisma (fuente única).
- [x] T007b `AccionAudit.AUDIENCIA_MENOR_DECLARADA` (enum + migración aditiva) — rastro durable (`declaradoPor` SetNull).
- [x] T009 `POST /api/audiencia-menor/declarar` (auth PARENT, 404 no-dueño, idempotente, AuditLog).
- [x] T010a **Cableado del gate** (middleware Paso 4b + cookie `audienciaPendiente` + `GUARDIAS_ACCESO.audiencia` en la invariante cruzada). Dos adaptadores (API 403 / 302). **APAGADO** por `audiencia_menor.gate_activo` (default false).
- [ ] T010b UI: pantalla `/audiencia-menor` (lista pendientes + declara) + texto **[ABOGADO]**. Al entregarse → `gate_activo = true`. D-9: la vía de PROTECCIÓN NO se cierra (candado).
- [x] T012c Candado de conducta (`audiencia-menor.candado.test.ts`, dato real: per-menor · versión · cuenta-manda · solo-activos · idempotente+AuditLog sin PII · propiedad) + mitad de audiencia RE-AGREGADA en `proteccion-siempre-abierta`.
- [x] T013 Gates: tsc 0 · arch:check VERDE · unit routing/candados verdes · candado de conducta 6/6 (BD aislada) · migración aplica limpio.
- [ ] T014 Índice de specs (`specs/README.md`, lo regenera el barrido post-merge) + cierre al activar.

## Notas
- «Versión nueva» NO se construye (D-1): ya existe en SPEC-241. El eje NUEVO es per-menor.
- D-6 (CEO): sin denormalizar en `Hijo`; la puerta lee `AudienciaMenor` como fuente única.
- D-7/D-8 explícitos: agregar un menor saca de «al día» (copy de aviso = Diseño); `AudienciaMenor` es PII con retención atada al menor (SPEC-772).
- Sin dependencia de despliegue con otras SPECs de la cola (independiente).
