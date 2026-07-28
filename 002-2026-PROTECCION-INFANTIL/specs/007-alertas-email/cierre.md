# Cierre — Spec 007: Alertas por Email

> **Cierre retrospectivo** (auditoría Spec Kit 2026-07-27, §3.4): esta spec quedó
> IMPLEMENTADO sin documento de cierre. Se reconstruye desde su spec.md y el estado
> verificable del código actual. No existen métricas de la época; no se inventan.

**Fecha original de la spec**: 2026-07-14 · **Status**: pasa a FINALIZADO con este cierre

## Alcance entregado (verificable en el código actual)

- **Alertas a administradores** (FR-001 a FR-003): `enviarAlertaRevision(reporte)` y
  `enviarAlertaScoreCritico(datos)` en `src/lib/email.ts`, consultando administradores
  activos (`rol=ADMIN`, `estado=activo`) con un único email en `to`.
- **Contenido mínimo** (FR-004): solo identificador, número de seguimiento, estado, score,
  nivel de riesgo y plataforma; nunca texto original ni PII.
- **Parametrización** (FR-005): `alerts.admin.enabled` y `alerts.critical_score.enabled`
  desactivan cada alerta sin desplegar (ADR_004).
- **Activación asíncrona y resiliencia** (FR-006, NFR-001): disparo desde
  `POST /api/reportes/procesar` sin bloquear al worker; si el envío falla, el
  procesamiento continúa y el error queda loggeado.
- **Testabilidad** (NFR-002): mocks de `src/lib/email.ts` en la suite.

## Notas de evolución posterior

- La superficie de alertas creció con specs posteriores (alertas a colegios, círculo de
  confianza), con sus propios cierres; el envío usa Resend configurado por entorno.

## Evidencia disponible hoy

- Funciones vigentes en `src/lib/email.ts` y parámetros `alerts.*` en la BD; suite del
  pipeline de procesamiento cubre el disparo con mocks.

## Nota de honestidad documental

No se recuperaron evidencias de la verificación original (envíos reales de la época). El
cierre se limita a contrastar el alcance contra el código vigente.
