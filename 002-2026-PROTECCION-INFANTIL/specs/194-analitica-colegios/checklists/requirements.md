# Requirements Checklist: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT

## User Stories

- [ ] US1 — Vista unificada `/dashboard/admin/usuarios` con sub-tab Padres default.
- [ ] US2 — Tabla resumen de analítica por colegio en `/dashboard/admin/estadisticas/operacion?tab=colegios`.
- [ ] US3 — Ficha detalle de colegio con 7 secciones.
- [ ] US4 — Configuración de umbrales de hallazgos.
- [ ] US5 — Exportables CSV (opcional).

## Functional Requirements

- [ ] FR-001: Ruta `/dashboard/admin/usuarios` con sub-tabs por rol.
- [ ] FR-002: Sub-tab Padres con columnas requeridas.
- [ ] FR-003: Filtros de padres funcionales.
- [ ] FR-004: Endpoint `/api/admin/usuarios?rol=PARENT` paginado.
- [ ] FR-005: Ficha de padre con historial agregado.
- [ ] FR-006: Sub-tab Colegios en EstadisticasSubNav.
- [ ] FR-007: Endpoint `/api/admin/analytics/colegios` con resumen.
- [ ] FR-008: Endpoint `/api/admin/analytics/colegios/[id]` con detalle.
- [ ] FR-009: Caché con TTL configurable.
- [ ] FR-010: Hallazgos leen umbrales de ParametroSistema.
- [ ] FR-011: Hallazgos con reglas if/else, sin IA.
- [ ] FR-012: Semáforo usa reglas de hallazgos.
- [ ] FR-013: Comparación con la mediana.
- [ ] FR-014: Protección por rol ADMIN y módulo.
- [ ] FR-015: Cero exposición de PII de reportes.
- [ ] FR-016: Parámetros sembrados en seed.ts.
- [ ] FR-017: Sin campos nuevos en Colegio/Usuario.
- [ ] FR-018: No tocar src/lib/ai/**.
- [ ] FR-019: CSV opcional o documentado como deuda.

## Success Criteria

- [ ] SC-001: `/dashboard/admin/usuarios` responde 200 para ADMIN.
- [ ] SC-002: `/api/admin/analytics/colegios` responde < 3 s con caché caliente.
- [ ] SC-003: Sub-tab Colegios visible y funcional.
- [ ] SC-004: Ficha con 7 secciones sin errores ni PII.
- [ ] SC-005: Hallazgos se recalculan al cambiar config.
- [ ] SC-006: Gate local completo verde.
- [ ] SC-007: CI 6/6 verde.

## Candados de producto

- [ ] No fotos, video, audio ni archivos.
- [ ] Lenguaje descriptivo/estadístico; nunca veredictos.
- [ ] No tocar motor de IA.
- [ ] No modificar texto original de reportes.
- [ ] Cumplimiento de Ley 1581 en exposición de datos.

## Migración y seed

- [ ] Migración aditiva con índices (cero DROP).
- [ ] Seed de 5 parámetros nuevos con `update: {}`.
