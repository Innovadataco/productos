# Checklist de requisitos: SPEC-195

## FR — Functional Requirements

- [ ] FR-001: Bloque SPAM en `rubrica-semilla.ts` y seed.
- [ ] FR-002: `scoring.severity.spam=0` en seed.
- [ ] FR-003: Helper `cache-semantico.ts` con query de similitud ≥ 0.98.
- [ ] FR-004: Caché no aplica si ráfaga/duplicado.
- [ ] FR-005: Integración de caché en pipeline con `modeloUsado="cache:humano:..."`.
- [ ] FR-006: Helper `patron-coordinado.ts` con query de similitud ≥ 0.90.
- [ ] FR-007: Patrón coordinado fuerza `REVISION_MANUAL` + prioridad alta + `IncidenteInfra` + alerta.
- [ ] FR-008: Patrón coordinado evaluado después de motor/caché.
- [ ] FR-009: Endpoint `POST /api/admin/reportes/[id]/resolver-spam`.
- [ ] FR-010: Decisión `es_spam` → baja + dataset + embedding + notificación.
- [ ] FR-011: Decisión `corregir` → corrección + CLASIFICADO + dataset/embedding.
- [ ] FR-012: Decisión `procesar_como_acoso` → CLASIFICADO con categoría original.
- [ ] FR-013: AuditLog en cada decisión humana.
- [ ] FR-014: Job SLA spam con alerta admin.
- [ ] FR-015: Panel de análisis `/dashboard/admin/spam` con métricas.
- [ ] FR-016: Botón "Sugerir al banco" con JSONL.
- [ ] FR-017: Servicio `notificacion-spam.ts`.
- [ ] FR-018: `IaDocsPanel.tsx` incluye SPAM y caché.
- [ ] FR-019: `MODELO-DE-CLASIFICACION.md` actualizado.
- [ ] FR-020: 9 parámetros en `monitoreoNuevos`.

## SC — Success Criteria

- [ ] SC-001: Rúbrica SPAM visible.
- [ ] SC-002: RPT-0T6G3Z → SPAM ≥ 0.7.
- [ ] SC-003: Caché hit hereda clasificación.
- [ ] SC-004: Ráfaga/duplicado no usa caché.
- [ ] SC-005: Patrón coordinado fuerza revisión manual.
- [ ] SC-006: Endpoint `resolver-spam` funciona.
- [ ] SC-007: Email al denunciante autenticado.
- [ ] SC-008: Panel de análisis renderiza.
- [ ] SC-009: Documentación actualizada.
- [ ] SC-010: Gate local verde.
- [ ] SC-011: Cero migraciones destructivas.

## Candados

- [ ] NO se modifica `src/lib/ai/guardas-decision.ts`.
- [ ] NO se modifica `src/lib/rate-limit.ts`.
- [ ] NO se modifica `src/lib/dal/services/reporte-processing/rafagas.ts`.
- [ ] NO se modifica `src/lib/dal/services/reporte-processing/duplicados.ts`.
- [ ] NO se conecta `ejemplosRag` al prompt del LLM.
- [ ] NO se añaden campos nuevos al schema (se usa `IncidenteInfra` existente).
