# Spec 093 — Coherencia del padre autenticado

**Status**: `DESARROLLO`
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Cola nocturna 008** (2/3)

**Input**: las decisiones de 089/090/091 se aplicaron al público; falta el padre autenticado: círculo de confianza sin predicado de aprobación, residuos de score/riesgo en tipos, privacidad de URL en el área del padre y lenguaje del dashboard.

## User Stories

### US1 — Círculo de Confianza usa `esReporteAprobado` (P1)

**Como** padre, **quiero** que el estado de mis contactos ("Sin reportes" / "En proceso" / "Procesado") solo cuente reportes aprobados, **para** que un SPAM o un OTRO no cambie el estado de un contacto ni infle conteos. Aplicado a: vista agregada, estado de contacto y detalle por identificador (`src/lib/circulo-confianza.ts`).

### US2 — Mis reportes: SPAM y OTRO → "No se identifica riesgo" (P1)

Coherente con seguimiento (089): el detalle del reporte propio muestra conductas de riesgo por nombre (todas las detectadas), y si solo hay SPAM/OTRO → "No se identifica riesgo".

### US3 — Eliminar residuos de score/riesgo (P1)

Tipos `ranking: { score, nivelRiesgo }` en `src/app/mis-reportes/page.tsx` y `DashboardUsuarioClient.tsx`: verificado que NO se renderizan (tipos muertos) → borrados. La lista (`MisReportesList`) ya muestra solo "N reportes registrados" (091). §1.3/§1.5: nada expone score ni etiqueta.

### US4 — Privacidad de URL en el área del padre (P1)

Ningún identificador ni número de reporte en la URL del área del padre: `MisReportesList` navega a `/seguimiento` vía sessionStorage (igual que el home en 091). Guard estructural ampliado (url-privacy.test.ts) para el área del padre (excluye /dashboard/admin).

### US5 — Dashboard del padre: mismo lenguaje (P2)

2 estados ("En proceso" / "Procesado"), conductas por nombre, sin "verificado", sin score. Verificado en código: el dashboard hereda el mapeo de la 089 (`mapEstadoUsuario`).

## Requirements

- **FR-001**: Las 3 consultas de reportes del círculo (`obtenerVistaAgregada`, `determinarEstadoContacto`, detalle por identificador) usan `whereReporteAprobado`.
- **FR-002**: `MisReporteDetalle` filtra SPAM/OTRO; sin conductas de riesgo → "No se identifica riesgo".
- **FR-003**: Tipos muertos con `score`/`nivelRiesgo` eliminados (sin cambio de runtime).
- **FR-004**: Navegación del padre a seguimiento sin RPT en URL (sessionStorage); guard estructural cubre el área.
- **FR-005**: No rompe 089/090/091; `esReporteAprobado` sigue siendo fuente única.

## Success Criteria

- **SC-001**: Un contacto cuyo identificador solo tiene SPAM/OTRO queda "Sin reportes" (test).
- **SC-002**: Guard del área del padre: 0 violaciones; suite completa en verde.
- **SC-003**: Gate completo + commit/push con staging explícito del 002.
