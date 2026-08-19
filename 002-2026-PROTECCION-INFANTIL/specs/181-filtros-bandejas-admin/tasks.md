# Tasks: SPEC-181 — Filtros, búsqueda y orden en bandejas del admin

**Input**: `specs/181-filtros-bandejas-admin/{spec,plan}.md` · **Modo**: autónomo (aprobado por CEO).

- [ ] **T001** Orden compartido: `ORDENES_BANDEJA` (mapa cerrado) en `reporte.ts` + `ordenBandejaSchema` en `validators.ts`.
- [ ] **T002** Bandeja: `reportesRevisionQuerySchema` += orden; `findBandejaRevision` lo acepta; Select "Ordenar por" en `AdminReportesTable`.
- [ ] **T003** Spam endpoint: `spamPendientesQuerySchema` + safeParse + where dinámico + respuesta `{ reportes, pagination }` con pageSize.
- [ ] **T004** Spam repo + UI: filtro q/estado/orden en `findBandejaSpam`; barra completa + paginación en `SpamRevisionPanel` (URL como fuente de verdad).
- [ ] **T005** Anti-abuso: `antiAbusoSimulacionQuerySchema` + repo con filtros/orden + barra en `AdminAntiAbusoSimulacion` + `Cargando` estándar en vez del skeleton ad-hoc.
- [ ] **T006** Tests integration por endpoint (400 inválido, filtros, orden real, convención spam) + unit de barras.
- [ ] **T007** arch:check + tokens + gate completo + commit + PR.
- [ ] **T008** `cierre.md` + fila en `specs/README.md` (2 tablas).
