# Tasks — SPEC-751 · Consentimiento por versión + «oír al menor» per-menor

> Compuerta §4 primero: PARO tras spec+plan+tasks para aprobación del CEO + respuesta de abogado (FR-007/FR-008). Implementación DESPUÉS.

## Fase §4 — DISEÑO (este entregable)
- [x] T001 Mecanismo primero: verificar SPEC-241 en el código (versión ya re-consiente) y `Hijo` (sin audiencia). Documentar el hallazgo.
- [x] T002 spec.md (hallazgo, FR, decisiones D-1..D-5, candados, [ABOGADO] marcados).
- [x] T003 plan.md (contrato de datos + puerta + superficie + parámetros + candados + orden).
- [ ] T004 **PARO** · aprobación del CEO del contrato + respuesta de abogado a FR-007 (texto) y FR-008 (re-oír por versión).

## Fase implementación (tras aprobación)
- [ ] T005 Schema aditivo: `Hijo.oidoEn/oidoVersion` + tabla `AudienciaMenor` (FK Cascade, índices) + migración a mano no destructiva.
- [ ] T006 D-121: clasificar `AudienciaMenor` (PRESERVADOS/orden de borrado), verificar FK Cascade; candado de inserción si hay restricción cruda.
- [ ] T007 `AudienciaMenorService` (menorEstaAlDia / menoresPendientes / declarar en tx) + repos DAL (sin `@/lib/prisma`).
- [ ] T008 Extender el predicado de la puerta (cuenta vigente **Y** menores ACTIVOS al día), fuente única para página + endpoint; reusar `esTitularDelDato`.
- [ ] T009 `POST /api/audiencia-menor/declarar` (auth, 403 no-titular, idempotente por versión, AuditLog).
- [ ] T010 UI per-menor (paso/modal) — TEXTO desde documento/parámetro legal ([ABOGADO]); si algo queda falso, PARO.
- [ ] T011 Parámetros sembrados: `audiencia_menor.reoir_en_cambio_de_version` + clave/ruta del texto legal (idempotentes).
- [ ] T012 Candados: C-puerta per-menor · C-per-menor-no-global · C-inmutable/versión · C-activos · C-no-romper-cuenta (regresión SPEC-241).
- [ ] T013 Gates: `tsc` + `lint` + `arch:check` + `test:unit` COMPLETO + migración verificada.
- [ ] T014 Índice de specs (`specs/README.md`) + cierre.

## Notas
- «Versión nueva» NO se construye (D-1): ya existe en SPEC-241. El eje NUEVO es per-menor.
- Sin dependencia de despliegue con otras SPECs de la cola (independiente).
