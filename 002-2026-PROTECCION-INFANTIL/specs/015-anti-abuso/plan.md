# Plan de implementación — Spec 015 Defensas anti-abuso

> **Documentado retroactivamente el 2026-07-18** a partir de `spec.md`, `diseno-fase-c.md`, migraciones y código de `src/lib/anti-abuso/**`, `src/lib/rate-limit.ts` y `src/lib/apealaciones.ts`.

## Condiciones de aprobación (R1-R7)

1. Lógica anti-abuso corre en servidor; no se envían señales a servicios externos (R2).
2. Fingerprint server-side; no canvas ni JS de tracking.
3. IPs truncadas antes de hashear; nunca se almacena IP en claro.
4. El rate limit `report_identificador` nunca rechaza; marca para revisión.
5. Feature flag `scoring.source_weight.enabled` arranca apagado.
6. Apelaciones pausan visibilidad solo en primera apelación y restauran al resolver/vencer.
7. Migraciones con `prisma migrate dev` (R4).
8. Lint, tsc, build y tests verdes.

## Fases

### Fase A — Ponderación de señal de fuente
- Crear tabla `FuenteReporte` (1:1 con `Reporte`).
- Agregar `fuenteConfianza` a `Reporte` y `scoreAnonimo`, `scoreAutenticado`, `scoreAjustado` a `IdentificadorReportado`.
- Implementar cálculo de peso en `src/lib/anti-abuso/fuente-reporte.ts`.
- Extender `src/lib/scoring.ts` con score desagregado y `scoreAjustado`.
- Agregar feature flag `scoring.source_weight.enabled` default `false`.
- Crear endpoint/página de simulación en seco.

### Fase B — Rate limiting por fuente
- Extender `src/lib/rate-limit.ts` con scopes compuestos.
- Implementar `report_identificador` suave (`REVISION_MANUAL`/`POSIBLE_SPAM`).
- Implementar `report_fingerprint` duro (429).
- Agregar parámetros `ratelimit.report_identificador.*` y `ratelimit.report_fingerprint.*` al seed.
- Actualizar `src/app/api/reportes/route.ts` para aplicar límites.

### Fase C — Descargo/apelación
- Crear modelo `ApelacionIdentificador` con estados, token de acceso, pausa, derecho a apelar.
- Migración `20260718110000_add_apelaciones_fase_c`.
- Implementar OTP SMS mock y verificación.
- APIs públicas: solicitar, verificar, consultar por token.
- APIs admin: listar, detalle, resolver, rehabilitar, vencer.
- UI pública `/apelar` y admin `/dashboard/admin/apeaciones`.
- Job `scripts/job-apelaciones-vencimiento.ts`.

### Tests
- `src/lib/anti-abuso/fuente-reporte.test.ts`.
- `src/lib/rate-limit.test.ts`.
- `src/app/api/reportes/route.test.ts`.
- Tests de apelaciones (solicitar, verificar, resolver, vencer).

### Cierre
- Actualizar `docs/lote-nocturno-cierre.md` y `docs/lote-pre-despliegue-cierre.md`.
- Crear `specs/015-anti-abuso/reporte-cierre.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Falsos positivos por NAT compartido | IP truncada a /64 o /24; peso nunca llega a 0; límite suave no rechaza. |
| Activación prematura del peso de fuente | Flag apagado; activación solo con simulación sobre datos reales. |
| Apelaciones falsas de nicks | Titularidad no verificada; badge admin; pausa única; bloqueo tras rechazo. |
| Exposición de hashes | Hashes no salen por API ni UI. |

## Definición de terminado

- Fases A, B y C implementadas y testeadas.
- Simulación en seco funciona sin modificar datos.
- Smoke de apelaciones pasa.
- Lint, tsc, build y tests verdes.
