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

## Fase implementación — ESPERA (tabla Datos/765 + texto [ABOGADO])
- [ ] T006 D-121 en `schema.prisma` (Datos): tabla + orden de borrado + candado de inserción si hay restricción cruda.
- [ ] T007 `AudienciaMenorService`: `declarar` = INSERT inmutable en tx + consulta `menoresPendientes` (cablea el predicado puro a Prisma). Repos DAL, sin `@/lib/prisma`.
- [ ] T009 `POST /api/audiencia-menor/declarar` (auth, 403 no-titular, idempotente por versión, AuditLog).
- [ ] T010 UI: el MURO de «registraste un hijo nuevo» (copy `da2986f`) + el paso de declaración ([ABOGADO]). D-9: la vía de PROTECCIÓN (reportar/pedir ayuda por otro hijo) NO se cierra.
- [ ] T012c Candado de conducta de la puerta (fuente única, per-menor con dato real) + candado estructural «`Hijo` sin campo de audiencia» (D-6) — cuando exista la tabla/servicio.
- [ ] T013 Gates + migración verificada.
- [ ] T014 Índice de specs (`specs/README.md`) + cierre.

## Notas
- «Versión nueva» NO se construye (D-1): ya existe en SPEC-241. El eje NUEVO es per-menor.
- D-6 (CEO): sin denormalizar en `Hijo`; la puerta lee `AudienciaMenor` como fuente única.
- D-7/D-8 explícitos: agregar un menor saca de «al día» (copy de aviso = Diseño); `AudienciaMenor` es PII con retención atada al menor (SPEC-772).
- Sin dependencia de despliegue con otras SPECs de la cola (independiente).
