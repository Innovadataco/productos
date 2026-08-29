# Feature Specification: Fix fuga de PII en seguimiento público (I-28, Crítica)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: FINALIZADO (SIN desplegar, pendiente release + ACTA)

## Contexto

Incidencia I-28 (Crítica, verificada por ZEUS, ACTA_ARQ_03). El endpoint público
`GET /api/reportes/seguimiento/[numero]` (sin auth, solo rate-limit) devuelve el arreglo
`piiDetectada` con fragmentos CRUDOS de PII del menor (nombres, direcciones, teléfonos).
El front solo usa el booleano `contienePii`. Es des-anonimización pública (viola §1.3/§1.5
de la constitución y Ley 1581 de 2012).

**Guardas**: IMPLEMENTAR y commitear en `feature/001-scaffolding`, **SIN DESPLEGAR** (el
deploy lo gatea ZEUS en el lote de release).

## Requisitos

- **FR-1 (Crítico)**: quitar `piiDetectada` del objeto `clasificacion` de la respuesta en
  `src/app/api/reportes/seguimiento/[numero]/route.ts` (~L115). Conservar `contienePii: boolean`.
- **FR-2**: eliminar `piiDetectada` del tipo/interface de la respuesta en
  `src/components/.../SeguimientoClient.tsx` (~L22) y de cualquier tipo compartido.
- **FR-3**: barrido — confirmar que NINGÚN endpoint no-admin devuelve `piiDetectada`
  (`procesar` lo ESCRIBE a BD con worker-secret: correcto; `admin/*` lo lee gateado: correcto;
  NO tocar ninguno de los dos).
- **FR-4**: en `src/lib/rate-limit.ts`, para los scopes `seguimiento` y `login`, cambiar el
  fallo-en-abierto (`allowed: true` si el store falla) a **fail-closed**. Sin alterar otros scopes.

## Success Criteria

- **SC-001**: La respuesta del endpoint no contiene `piiDetectada` y sí `contienePii`
  (test de regresión en `route.test.ts`).
- **SC-002**: Test de rate-limit fail-closed para el scope `seguimiento`.
- **SC-003**: Gate verde (lint + test + tsc + build), commit aparte, SIN desplegar.
