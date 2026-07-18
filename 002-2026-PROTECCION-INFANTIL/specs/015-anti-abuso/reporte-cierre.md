# Reporte de cierre — Spec 015 Defensas anti-abuso

> **Documentado retroactivamente el 2026-07-18** derivado de [`spec.md`](spec.md), [`diseno-fase-c.md`](diseno-fase-c.md) y los reportes de cierre de lotes.

## Estado

**CERRADA** — fecha de cierre: 2026-07-17 (Fase C completada en el lote nocturno).

## Resumen ejecutivo

Se implementaron las tres fases de defensas anti-abuso: ponderación de fuente bajo feature flag, rate limits compuestos y descargo/apelación del identificador reportado con pausa de visibilidad y vencimiento automático.

## Alcance entregado

### Fase A — Ponderación de señal de fuente
- Tabla `FuenteReporte` con hashes de IP/fingerprint, antigüedad, reportes previos, confirmados, descartados y peso aplicado.
- Score desagregado (`scoreAnonimo`, `scoreAutenticado`, `scoreAjustado`).
- Feature flag `scoring.source_weight.enabled` default `false`.
- Endpoint/página de simulación en seco.

### Fase B — Rate limiting por fuente
- Scope `report_identificador` suave: marca `REVISION_MANUAL`/`POSIBLE_SPAM` sin rechazar.
- Scope `report_fingerprint` duro: rechazo 429.
- Parámetros configurables en `ParametroSistema`.

### Fase C — Descargo/apelación
- Modelo `ApelacionIdentificador` con estados `RECIBIDA | EN_REVISION | ACEPTADA | RECHAZADA | VENCIDA`.
- Migración `20260718110000_add_apelaciones_fase_c`.
- Verificación OTP SMS (provider mock en desarrollo).
- Apelación por nick marcada como "titularidad no verificada".
- Pausa de visibilidad en primera apelación (`anti_abuso.apelacion_pausa_dias`, default 7).
- Rechazo bloquea re-apelación; admin puede rehabilitar.
- Job de vencimiento `scripts/job-apelaciones-vencimiento.ts`.
- Smoke E2E de apelaciones: `scripts/smoke-apelaciones.ts`.

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ 0 errores, 1 warning preexistente |
| TypeScript | `npx tsc --noEmit` | ✅ |
| Build | `npm run build` | ✅ |
| Tests | `npm test` | ✅ 193 tests |
| Smoke E2E | `scripts/smoke-e2e.ts` | ✅ |
| Smoke apelaciones | `scripts/smoke-apelaciones.ts` | ✅ |

## Decisiones clave

- `scoring.source_weight.enabled` permanece en `false` hasta simulación post-despliegue sobre datos reales.
- Fingerprint server-side sin canvas; IP truncada a /24 (IPv4) o /64 (IPv6).
- UI pública de apelación solo muestra mensaje genérico (R2).

## Flags y condiciones documentadas

| Flag | Estado | Condición de activación |
|---|---|---|
| `scoring.source_weight.enabled` | `false` | Simulación post-despliegue sobre datos reales, aprobada por owner. |
| `reportes.classification.modelo_desempate` | `""` | Mejora demostrada en Laboratorio IA. |
| `SMS_PROVIDER` | `mock` | Integración y verificación en staging. |

## Pendientes derivados

- Ver [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md): N1 (SMS real), N3 (backfill scores), N5 (jobs de mantenimiento), N7 (14 casos dudosos), N10 (HTTPS/HSTS).
