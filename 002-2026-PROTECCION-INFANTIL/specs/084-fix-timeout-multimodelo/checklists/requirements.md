# Checklist de requisitos — Spec 084

**Spec**: `specs/084-fix-timeout-multimodelo/spec.md` · **Verificado**: 2026-07-23 (post-cierre, spec 087-US3)

- [x] FR-001: `fechaInicio = now()` al pasar a `EN_PROGRESO` (executor).
- [x] FR-002: `createdAt` intacto.
- [x] FR-003: timeout sigue midiendo desde `fechaInicio` (sin cambios de lógica en progreso.ts).
- [x] FR-004: sin migración de schema ni de datos.
- [x] FR-005: test del hueco multi-modelo (arranque reciente + creación antigua → no FALLIDA).
- [x] SC-001: lote de 3 modelos — cada run medida desde su propio arranque; 3/3 COMPLETADA; evidencia de FALLIDA con reloj propio correcto.
- [x] SC-002: gate completo verde + `dev-restart.sh`.
- [x] Hallazgo bloqueante resuelto: dedupe en `drainPending` (+test).
- [x] Deuda registrada: drenaje de reportes de runs terminadas (candidata I-08).
