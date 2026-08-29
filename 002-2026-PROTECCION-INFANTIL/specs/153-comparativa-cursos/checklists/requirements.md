# Checklist de requisitos: SPEC-153

- [ ] FR-001: endpoint JSON `/api/colegio/analisis/comparativa`.
- [ ] FR-002: endpoint Excel `/api/colegio/analisis/comparativa/excel`.
- [ ] FR-003: tenant-first (solo datos del colegio del usuario).
- [ ] FR-004: agrupación por grado o año lectivo.
- [ ] FR-005: métricas por grupo (cursos, estudiantes, identificadores, alertas, promedio).
- [ ] FR-006: validación de `agruparPor` con default `grado`.
- [ ] FR-007: UI `/dashboard/colegio/analisis/comparativa`.
- [ ] FR-008: rate limit en ambos endpoints.
- [ ] FR-009: no tocar `src/lib/ai/**`; `arch:check` y `tokens:check` verdes.
- [ ] FR-010: tests de integración.

## Criterios de éxito

- [ ] SC-001: SCHOOL_ADMIN ve comparativa sin PII.
- [ ] SC-002: cambio de criterio devuelve grupos distintos.
- [ ] SC-003: Excel descargable con mismos datos.
- [ ] SC-004: ADMIN recibe 403.
- [ ] SC-005: gate completo verde.
