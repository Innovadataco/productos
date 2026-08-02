# Tasks: SPEC-139 — Evento de match (F5)

**PENDIENTE DE COMPUERTA §4** — spec.md + plan.md radicados para veredicto de
ZEUS. Las tareas reales (T001…, orden por dependencias, TDD donde aplique) se
generan SOLO tras el APROBADO. NO implementar desde este archivo.

## Fases previstas (resumen del plan, sin desglose)

- Fase 1 — Entidad `EventoMatch` (migración aditiva) + repo/servicio DAL de
  detección (regla de fuente distinta) + tests (SC-001/SC-002)
- Fase 2 — Post-hook del worker (fire-and-forget, fail-open) + idempotencia por
  `reporteNuevoId` único + AuditLog/paso de expediente (SC-003)
- Fase 3 — Marca `interCiudad` → revisión prioritaria en bandeja del comité
  (SC-004)
- Fase 4 — Contadores: estadísticas públicas + endpoint admin con tendencia
  (SC-005, sin exponer denunciantes ni textos)
- Fase 5 — Gates: suite + tsc + lint + build + `dev-restart.sh` + regenerar
  `docs/architecture` (`arch:check` verde) + cierre documental
