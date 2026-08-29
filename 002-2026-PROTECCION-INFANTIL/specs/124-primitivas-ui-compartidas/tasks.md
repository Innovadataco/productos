# Tasks: SPEC-124 — Primitivas UI compartidas (R7)

## Fase 1 — Primitivas (commit único, sin migrar nada)

- [x] T001 [P] `src/components/ui/Tabla.tsx` (+ `Tabla.test.tsx`)
- [x] T002 [P] `src/components/ui/TarjetaMetrica.tsx` (+ `TarjetaMetrica.test.tsx`)
- [x] T003 [P] `src/components/ui/Alerta.tsx` (+ `Alerta.test.tsx`)
- [x] T004 [P] `src/components/ui/Cargando.tsx` (+ `Cargando.test.tsx`)
- [x] T005 [P] `src/components/ui/use-fetch-json.ts` (+ `use-fetch-json.test.tsx`)
- [x] T006 Commit Fase 1 — `15c99f2f` (21 tests verdes)

## Fase 2 — Migración pantalla por pantalla (un commit c/u)

- [x] T007 `AdminDashboard.tsx` — `6b0ffbf6`
- [x] T008 `AdminAntiAbusoSimulacion.tsx` — `fa9063fc`
- [x] T009 `ConsultaEnriquecidaClient.tsx` — `09037a6d` (test verde)
- [x] T010 `AdminReportesTable.tsx` — `1d0c234c`
- [x] T011 `SpamRevisionPanel.tsx` — `4f76d711`
- [x] T012 `audit-log/AuditTable.tsx` — `9d66b6b6`
- [x] T013 `ApelacionesClient.tsx` — `ef2e930d`
- [x] T014 `DashboardUsuarioClient.tsx` — `cab0068b`
- [x] T015 `PadresPageClient.tsx` — `8061774d`
- [x] T016 operadores gestion+asignar+modelo — `45e74fc1`
- [x] T017 `estadisticas/clasificacion/page.tsx` — `5b6ac6cf`
- [x] T018 `DatasetEntrenamientoPageClient.tsx` — `e7079232`
- [x] T019 `PublicDashboard` + `circulo-confianza` + borrar `modules/MetricCard.tsx` — `73b96c2f` (test PublicDashboard verde)
- [x] T020 `AdminReporteDetalle.tsx` — `6b348b47` (test verde)
- [x] T021 `AdminReporteExpediente.tsx` — `3e63157a` (test verde)
- [x] T022 `MisReporteDetalle` + `mis-reportes` + `seguimiento` — `367276e5` (test MisReporteDetalle verde)
- [x] T023 Extra: `ConfigPanel` + `CategoriaGruposEditor` + `SeguimientoClient` — `3665d234` (test SeguimientoClient verde)
- [x] T024 Extra: formularios auth (`login`, `registro`, `cambiar-password`, `recuperar/[token]`) — `c6a64e61`

## Fase 3 — Cierre

- [x] T025 `cierre.md` + sección Implementación en `spec.md` + deuda técnica
- [x] T026 Gate bajo candado: tsc + lint + tests tocados + build + suite completa
- [x] T027 Reporte final para ZEUS

## Fuera de alcance (deuda documentada)

- Pantallas Colegios y Comité (CEO probando): conservan copias locales
  (ComiteBandeja, ComiteSolicitudDetalle, GestionPageClient,
  ApelacionesBandejaClient, ColegiosPageClient, `dashboard/colegio/**`).
- `src/components/modules/ia/**`: MetricCard especializado y tablas propias
  (7 tablas `min-w-full text-sm`).
- `PermisosRolPanel` (texto plano sin spinner), `ReporteWizard`,
  `LandingHero`, `MapaUbicaciones`, `NavHeader`, `EstadoTransicion`,
  `reporte-detalle/*` (cajas de alerta especializadas), `MiniList`.
- La matriz de votos de `AdminReporteExpediente` conserva su densidad
  `text-xs` propia (no aplica `Tabla`).
