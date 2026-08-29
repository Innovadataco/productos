# Cierre — Spec 093: Coherencia del padre autenticado

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/093-coherencia-padre/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Círculo usa esReporteAprobado | `whereReportesCirculo`: aprobados (predicado único) OR en-revisión-humana. SPAM/OTRO no cambia el estado ni suma; POSIBLE_SPAM/DUPLICADO tampoco. "En proceso" se conserva para REVISION_MANUAL/REQUIERE_ANONIMIZACION (la primera versión lo rompía — corregido con el OR explícito, research R1). |
| US2 Mis reportes SPAM/OTRO | `MisReporteDetalle` filtra SPAM/OTRO; sin conductas de riesgo → "No se identifica riesgo". |
| US3 Residuos score/riesgo | Tipos muertos `ranking: {score, nivelRiesgo}` eliminados de `mis-reportes/page.tsx` y `DashboardUsuarioClient.tsx` (verificado: no se renderizaban). |
| US4 Privacidad URL padre | `MisReportesList` navega a `/seguimiento` por sessionStorage (sin RPT en URL). Guard estructural del área del padre: 0 violaciones (excluye /admin/). |
| US5 Dashboard del padre | Verificado: usa `mapEstadoUsuario` (2 estados, sin score, sin "verificado"). |

## Validación

- Tests: círculo 21/21 (nuevo: spam/otro → "sinReportes"; revisión sigue contando como "En proceso"), guard de privacidad 5/5.
- Incidencia ambiental: la BD murió por "No space left on device" en la VM de Docker (~52 GB de imágenes sin uso) — limpiadas (~50 GB), BD recuperada, suite re-corrida: **832/832**.
- Gate: lint 0 errores (1 warning heredado) · tsc OK · build limpio · healthcheck OK.

## Nota de proceso

El commit `104a98af` incluyó también archivos de la spec 092 (guardas-previas, hook min-texto y artefactos) por un staging amplio; la 092 tendrá su propio commit de cierre con resultados. Registrado para el ACTA.

## Commit

- `feat(padre): círculo con predicado de aprobación, sin score residual y privacidad URL (spec 093)` — `104a98af`
