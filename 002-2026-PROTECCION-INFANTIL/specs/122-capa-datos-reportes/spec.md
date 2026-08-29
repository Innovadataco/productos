# SPEC-122 — Capa de datos: predicados centrales de acceso a reportes

- **Status**: FINALIZADO
- **Bloque**: R4 (cola nocturna 002-PI-041, FASE 3)
- **Fecha**: 2026-07-29

## Contexto

ZEUS midió: 100 de 117 rutas hablan directo con la base. El predicado central de
visibilidad (`whereReporteAprobado`, `src/lib/reporte-aprobado.ts`) se usa 14 veces,
mientras el filtro `eliminado: false` estaba escrito a mano 39 veces en `src`. Esas
copias pueden divergir — y ya divergieron: la fuga de PII (I-28) fue exactamente eso.

## User Stories

### US1 — Capa central sin tocar rutas (P1)

Como mantenedor quiero una lib única con los predicados de acceso a reportes que
capture EXACTAMENTE las formas manuales existentes, con test de equivalencia, para
que la migración posterior sea mecánica y segura.

**Acceptance Scenarios**
1. Dado `src/lib/reportes-acceso.ts`, cuando se importa, expone
   `whereReporteVigente`, `whereReporteEnEstado`, `whereReporteEnEstados` y
   reexporta `whereReporteAprobado` (misma referencia, sin duplicar).
2. Dado el test de equivalencia, cada predicado devuelve un objeto where
   profundamente igual a la copia manual que reemplaza (SQL idéntico).

### US2 — Migración ruta por ruta (P1)

Como mantenedor quiero que las rutas API usen los predicados centrales, cada zona
con su test verde y su propio commit, priorizando rutas públicas.

**Acceptance Scenarios**
1. Rutas públicas migradas primero: `estadisticas-publicas`, `consulta/detalle`.
2. Luego padre (`reportes/mis-reportes`) y luego admin (estadísticas, operadores,
   bandejas, comité).
3. Cada ruta migrada conserva verdes sus tests de integración existentes.

## Functional Requirements

- FR-001: El sistema DEBE tener una única fuente para el filtro `eliminado: false`
  en rutas API: `src/lib/reportes-acceso.ts`.
- FR-002: Los predicados DEBEN ser equivalentes a las copias manuales (mismo SQL);
  si la equivalencia falla, el refactor se detiene.
- FR-003: `whereReporteAprobado` NO se duplica; se reutiliza/reexporta.
- FR-004: La migración DEBE ser aditiva: primero la capa central, luego rutas.
- FR-005: El motor de procesamiento (`reportes/procesar/**`) queda fuera del alcance.

## Success Criteria

- SC-1: 0 copias manuales de `eliminado: false` en `src/app/api/**/route.ts`
  (salvo helper del motor, diferido y documentado). ✅
- SC-2: Test de equivalencia verde (20 casos). ✅
- SC-3: Gate verde: tsc + lint + tests tocados + build + suite completa. ✅

## Assumptions

- Las libs de negocio fuera de `src/app/api/**` (`apelaciones.ts`,
  `circulo-confianza.ts`, `anti-abuso/`, `colegio/`, `operadores/asignador.ts`)
  pertenecen a otros frentes/agentes y NO se tocan en este bloque.
- `rafagas.ts` (3 copias) es helper del motor de procesamiento: diferido.

## Implementación

- Pieza central: `src/lib/reportes-acceso.ts` + `src/lib/reportes-acceso.test.ts`
  (commit `6652d4ae`).
- 12 rutas migradas (28 copias manuales eliminadas) en 5 commits por zona:
  `62e0fe48` (públicas), `eb786ccf` (padre), `f0b8452a` (admin estadísticas),
  `9dc3974a` (operadores/asignación/reasignar/padres), `476a9e01` (bandejas/comité).
- Detalle copia por copia en `plan.md`; cierre y evidencia del gate en `cierre.md`.
