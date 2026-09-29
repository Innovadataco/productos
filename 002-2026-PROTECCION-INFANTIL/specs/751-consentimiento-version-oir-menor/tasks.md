# Tasks — SPEC-751 · Consentimiento por versión + «oír al menor» per-menor

> Compuerta §4 primero: PARO tras spec+plan+tasks para aprobación del CEO + respuesta de abogado (FR-007/FR-008). Implementación DESPUÉS.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Mecanismo primero: verificar SPEC-241 en el código (versión ya re-consiente) y `Hijo` (sin audiencia). Documentar el hallazgo.
- [x] T002 spec.md (hallazgo, FR, decisiones D-1..D-5, candados, [ABOGADO] marcados).
- [x] T003 plan.md (contrato de datos + puerta + superficie + parámetros + candados + orden).
- [ ] T004 **PARO** · aprobación del CEO del contrato + respuesta de abogado a FR-007 (texto) y FR-008 (re-oír por versión).

## Fase implementación (tras aprobación)
- [ ] T005 Schema aditivo: tabla `AudienciaMenor` (FK Cascade, índices `(hijoId, version)`/`(version)`) + migración a mano no destructiva. **NO** se agrega campo a `Hijo` (D-6, fuente única).
- [ ] T006 D-121: clasificar `AudienciaMenor` como **PII** con retención atada al menor (D-8, alcance SPEC-772) + orden de borrado + FK Cascade; candado de inserción si hay restricción cruda.
- [ ] T007 `AudienciaMenorService` (menorEstaAlDia / menoresPendientes por consulta / declarar = INSERT inmutable en tx, sin denormalizar) + repos DAL (sin `@/lib/prisma`).
- [ ] T008 Extender el predicado de la puerta (cuenta vigente **Y** menores ACTIVOS con fila vigente), fuente única para página + endpoint; reusar `esTitularDelDato`. No debilitar la puerta de cuenta.
- [ ] T009 `POST /api/audiencia-menor/declarar` (auth, 403 no-titular, idempotente por versión, AuditLog).
- [ ] T010 UI per-menor (paso/modal), incluyendo el momento «agregaste un menor → hay que oírlo» (D-7/FR-010) con su explicación — TEXTO desde documento/parámetro legal ([ABOGADO]); si algo queda falso, PARO.
- [ ] T011 Parámetros sembrados: `audiencia_menor.reoir_en_cambio_de_version` (default `true`, porqué documentado en el seed) + clave/ruta del texto legal (idempotentes).
- [ ] T012 Candados: C-puerta per-menor · C-per-menor-no-global · C-versión · C-fuente-única (Hijo sin campo de audiencia) · C-activos · C-no-romper-cuenta (regresión SPEC-241).
- [ ] T013 Gates: `tsc` + `lint` + `arch:check` + `test:unit` COMPLETO + migración verificada.
- [ ] T014 Índice de specs (`specs/README.md`) + cierre.

## Notas
- «Versión nueva» NO se construye (D-1): ya existe en SPEC-241. El eje NUEVO es per-menor.
- D-6 (CEO): sin denormalizar en `Hijo`; la puerta lee `AudienciaMenor` como fuente única.
- D-7/D-8 explícitos: agregar un menor saca de «al día» (copy de aviso = Diseño); `AudienciaMenor` es PII con retención atada al menor (SPEC-772).
- Sin dependencia de despliegue con otras SPECs de la cola (independiente).
