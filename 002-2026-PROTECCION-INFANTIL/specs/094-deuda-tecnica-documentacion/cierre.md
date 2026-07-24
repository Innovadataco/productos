# Cierre — Spec 094: Deuda técnica y documentación

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/094-deuda-tecnica-documentacion/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Barrido | 4 parámetros muertos verificados (password_min_length, maintenance_mode, worker.max_retries, stalled_threshold) + hallazgo NUEVO: `JWT_TTL="24h"` quemado en `src/lib/auth.ts:20` con parámetro existente sin leer (D-094-2). |
| US2 Deudas identificadas | Registradas: gravedad NECESITA SPEC (D-SEV-1), patrón "sembrado sin leer" (corregido en 092), patrón "condicional escondido" (corregido en 091), bancos divergentes 110v1 vs 200v2 (D-094-5, requiere decisión), usuarios de prueba (D-094-6), calcularRanking (D-094-7 declarada). |
| US3 Apelaciones | N5 sin "vencimiento de apelaciones"; A3 → FUERA DE ALCANCE; D-APE-1 registrada (implementar/retirar/enmendar §1.6 + revisión legal Ley 1581 antes de producción). Código NO tocado. |
| US4 Docs | `docs/MODELO.md` v1.2.0 (guardas previas, RAG tras dedup, embudo permisivo, decisivas/contexto, sin principal) + `IaDocsPanel` mismo flujo + `specs/README.md` actualizado. |
| US5 Chip | `1 reporte` singular correcto (test ajustado). |

## Deuda NUEVA encontrada en el barrido propio

1. **D-094-2** (la más importante): `security.jwt_ttl_hours` sembrado pero `JWT_TTL = "24h"` QUEMADO en `src/lib/auth.ts:20` — viola ADR_004.
2. 4 parámetros sembrados que nadie lee (D-094-1): `security.password_min_length`, `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes`.
3. Divergencia de bancos (D-094-5): CasoEval 110 casos fixtureVersion=1 vs banco simulación 200 casos fixtureVersion=2 — sin fuente única.
4. Patrones documentados (D-094-3, D-094-4) ya corregidos en 091/092 pero registrados para prevención.

## Validación

- Gate: suite completa (ver reporte consolidado; la BD sufrió caída por disco lleno en Docker — ~50 GB liberados, recuperada, suite 832/832).
- `specs-discipline.test.ts` (índice) verde con 092-094 registradas.
- `LandingHero.test.tsx` 6/6 (chip singular incluido).

## Commit

- `docs(deuda): barrido de parámetros muertos, apelaciones fuera de alcance y docs al día (spec 094)`
