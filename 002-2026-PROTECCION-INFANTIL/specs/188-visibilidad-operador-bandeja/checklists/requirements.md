# Checklist de requisitos: SPEC-188 — Visibilidad del operador en la bandeja

## Funcionales

- [ ] FR-001: Columna "Operador" en bandeja.
- [ ] FR-002: DTO incluye `operadorId` y `operadorEmail`.
- [ ] FR-003: Filtro dropdown "Operador" con `/api/admin/operadores`.
- [ ] FR-004: Backend `/api/admin/reportes-revision` responde con email del operador.
- [ ] FR-005: Timeline consulta `AuditLog` para eventos de asignación.
- [ ] FR-006: Evento de asignación incluye fecha, tipo, operadorEmail, actorEmail.
- [ ] FR-007: Eventos intercalados cronológicamente.
- [ ] FR-008: UI renderiza eventos con icono distinto.
- [ ] FR-009: Sin PII de reporte en timeline.
- [ ] FR-010: No tocar `src/lib/ai/**`.

## Tests

- [ ] Test filtro por `operadorId`.
- [ ] Test timeline incluye `OPERADOR_ASIGNADO` con emails.
- [ ] Test `AdminReportesTable` renderiza columna y dropdown.

## Calidad

- [ ] `npx tsc --noEmit` verde.
- [ ] `npm run lint -- --no-cache` verde (sin errores nuevos).
- [ ] `npm run arch:check` verde.
- [ ] `npm run test` verde en archivos afectados.
- [ ] `npm run build` verde.
