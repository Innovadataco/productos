# Spec 094 — Deuda técnica y documentación

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Cola nocturna 008** (3/3)

**Input**: barrido de deuda no registrada + registro de deudas identificadas + reconciliación del inventario con decisiones del CEO (apelaciones fuera de alcance) + documentación al día post-092.

## User Stories

### US1 — Barrido propio de deuda no registrada (P1)

Barrer el código: código muerto, parámetros que nadie lee, valores quemados que deberían ser parámetros, validaciones solo en front, condicionales que mantienen interfaces viejas. Registrar todo en `docs/deuda-tecnica.md`.

### US2 — Registrar deudas ya identificadas (P1)

- Escala de gravedad (`scoring.severity.*`): números sin criterio documentado → NECESITA SPEC (D-SEV-1).
- Patrón "sembrado pero nadie lee" (`reportes.spam.min_text_length`, corregido en 092-US5).
- Patrón "condicional escondido mantiene viva una interfaz vieja" (LandingHero ≤2, corregido en 091).
- BD dev con banco viejo (110 casos fixtureVersion 1) vs fixture de 200 → reconciliar.
- Usuarios de prueba del seed: eliminar antes de producción.
- `calcularRanking`/`riesgo-consulta.ts` en código para priorización interna (declarado en 089).

### US3 — Reconciliar inventario con decisiones del CEO (P1)

Apelaciones FUERA DE ALCANCE (CEO, 2026-07-24): N5 sin "vencimiento de apelaciones"; A3 ya no "acepta el riesgo"; registrar como NECESITA DECISIÓN (implementar, retirar o enmendar §1.6) con revisión legal antes de producción. NO tocar el flujo.

### US4 — Documentación al día (P1)

- `docs/MODELO.md` post-092 (guardas previas, RAG tras dedup, embudo permisivo, decisivas/contexto, todas las conductas sin principal) con bloque de versión.
- `IaDocsPanel` con el mismo flujo.
- `specs/README.md` regenerado desde las carpetas reales.

### US5 — Chip singular (P2)

El chip del home dice "1 reportes" → singular/plural correcto.

## Requirements

- **FR-001**: Barrido documentado con evidencia (parámetros muertos verificados con grep: `security.password_min_length`, `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes`; `JWT_TTL` quemado en auth.ts).
- **FR-002**: `docs/deuda-tecnica.md` con todas las deudas nuevas y las actualizaciones N5/A3/D-APE-1/D-SEV-1.
- **FR-003**: MODELO.md e IaDocsPanel reflejan el flujo real post-092; README regenerado.
- **FR-004**: Chip singular/plural correcto.
- **FR-005**: NO tocar apelaciones, terna, umbral, spec 017/053, ni infraestructura.

## Success Criteria

- **SC-001**: `docs/deuda-tecnica.md` contiene las 7 deudas nuevas del barrido (D-094-1..7) + D-APE-1 + D-SEV-1.
- **SC-002**: `specs-discipline.test.ts` (índice) verde tras regenerar README.
- **SC-003**: Gate completo + commit/push con staging explícito del 002.
