# Tasks — Spec 093: Coherencia del padre autenticado

- [x] T001 US1: `whereReportesCirculo` (aprobados OR en-revisión-humana) en los 3 sitios del círculo + test (spam/otro no cambia estado; revisión sí cuenta como "En proceso").
- [x] T002 US2: `MisReporteDetalle` filtra SPAM/OTRO; sin conductas → "No se identifica riesgo".
- [x] T003 US3: tipos muertos `ranking: {score, nivelRiesgo}` eliminados de `mis-reportes/page.tsx` y `DashboardUsuarioClient.tsx`.
- [x] T004 US4: `MisReportesList` navega a seguimiento por sessionStorage; guard estructural del área del padre (excluye /admin/) — 0 violaciones.
- [x] T005 US5: verificado — dashboard del padre usa `mapEstadoUsuario` (2 estados, sin score, sin "verificado").
- [x] T006 Gate completo + dev-restart + docs + commit/push (staging explícito 002).
