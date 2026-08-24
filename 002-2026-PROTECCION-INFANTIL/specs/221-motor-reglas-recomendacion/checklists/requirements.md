# Checklist de requisitos: SPEC-221

## User Stories

- [ ] US-1: El motor evalúa reglas y genera recomendaciones.
  - [ ] Render de plantilla con variables de la fila.
  - [ ] Deduplicación `(reglaId, sujetoId)` en PENDIENTE (update, no duplicado).
  - [ ] Nueva recomendación si la previa está APLICADA/IGNORADA.
  - [ ] Regla inactiva omitida sin error.
  - [ ] `umbralMinimo` respetado.
  - [ ] Error de query no detiene las demás reglas.
- [ ] US-2: Ejecutor SQL seguro.
  - [ ] Rechazo de queries que no inician con SELECT/WITH.
  - [ ] Deny-list (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/GRANT/REVOKE/COPY/EXECUTE/CALL).
  - [ ] Transacción READ ONLY + `statement_timeout`.
  - [ ] Timeout aborta solo la regla afectada.
- [ ] US-3: Worker `worker-analisis-reglas`.
  - [ ] Evalúa solo reglas con `frecuenciaMin` vencida.
  - [ ] Advisory lock propio, segunda instancia exit 2.
  - [ ] Expiración a `EXPIRADA` idempotente.
  - [ ] Apagado limpio con SIGTERM/SIGINT.
  - [ ] Regla `EJECUTA` genera sin ejecutar (diferido a SPEC-226).
- [ ] US-4: Seed de 7 reglas semilla.
  - [ ] Las 7 claves del brief §8.2 presentes.
  - [ ] Todas `modo = RECOMIENDA` (D-77).
  - [ ] Idempotente; no pisa `modo`/`activa`/`sqlQuery` tuneados.
  - [ ] 3 parámetros `analisis.recomendaciones.*` sembrados.
- [ ] US-5: Resolución admin.
  - [ ] `POST /api/admin/analisis/recomendaciones/[id]/resolver`.
  - [ ] Solo ADMIN; Zod; 409 si no PENDIENTE; 404 si no existe.
  - [ ] `AuditLog` con `RECOMENDACION_RESUELTA`.

## Functional Requirements

- [ ] FR-001/002: Modelos `ReglaRecomendacion` + `Recomendacion` + enums.
- [ ] FR-003: Ejecutor sandboxed en `ejecutor-sql.ts`.
- [ ] FR-004/005: Motor con evaluación, dedup, umbral, `expiraEn` en America/Bogota.
- [ ] FR-006: EJECUTA diferida (sin ejecución de acciones).
- [ ] FR-007/008: Worker con advisory lock, tick, expiración.
- [ ] FR-009/010: Seed de reglas y parámetros idempotente.
- [ ] FR-011/012: Endpoint resolver con Zod, AppError, AuditLog.
- [ ] FR-013: Worker integrado en `dev-restart.sh`.
- [ ] FR-014: Tests de ejecutor, motor, worker, seed y endpoint.
- [ ] FR-015: AuditLog en mutaciones, sin PII.

## Success Criteria

- [ ] SC-001: 3 candidatos → 3 recomendaciones; segunda evaluación → 0 nuevas.
- [ ] SC-002: 100% de queries peligrosas de prueba rechazadas antes de ejecutar.
- [ ] SC-003: Regla `frecuenciaMin=1` evaluada en ≤ 2 min; segunda instancia exit 2.
- [ ] SC-004: Expiración 100% e idempotente.
- [ ] SC-005: Seed idempotente (7 reglas + 3 params, mismos conteos al repetir).
- [ ] SC-006: Endpoint matriz 200/400/403/404/409 + AuditLog.
- [ ] SC-007: Regla EJECUTA genera con `ejecutadaAutomatica = false`.
- [ ] SC-008: Gate local verde (`tsc`, `lint`, `test`, `build`, `dev-restart`).

## Candados y restricciones

- [ ] NO se modificó `src/lib/ai/**` ni el rate-limit del reporte público.
- [ ] Las 7 reglas semilla nacen en modo `RECOMIENDA` (D-77 no-negociable).
- [ ] Ninguna acción automática se ejecuta en esta spec (SPEC-226).
- [ ] Migraciones aditivas, cero `DROP`.
- [ ] Reglas solo leen dominio SaaS; cero texto de reportes / identificadores reportados / PII de menores en queries ni en `datosContexto`.
- [ ] AuditLog sin datos personales del sujeto ni textos sensibles.
- [ ] Terminología en criollo del brief §3 (`Regla`, `Sugerencia`, `Recomienda`/`Ejecuta sola` en UI futura).
- [ ] Tono neutral en textos, sin voseo.
- [ ] NO se implementó UI (SPEC-222/224/227) ni editor de reglas (SPEC-224) ni ejecución de acciones (SPEC-226).

## Dependencias externas

- [ ] SPEC-220 (002-PI-121) implementado en la rama (parámetros `analisis.*`, `ScoreCliente`).
- [ ] Coordinación con SPEC-220 sobre quién migra `ReglaRecomendacion`/`Recomendacion` (ver research §3.1).
