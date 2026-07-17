# Spec 015 — Defensas anti-abuso

## Estado

- Fase A: **Implementada** (ponderación de señal de fuente en el score).
- Fase B: **Implementada** (rate limiting por fuente).
- Fase C: **Pendiente** (descargo/apelación del identificador reportado).

## Objetivo

Reducir el abuso de la plataforma (reportes falsos, ráfagas coordinadas, cuentas descartables) sin perder reportes legítimos ni exponer datos personales.

## Decisiones de arquitectura aprobadas

- **Solo modelos locales** (R2): toda la lógica anti-abuso corre en el servidor; no se envían señales a servicios externos.
- **Fingerprint server-side, no canvas**: el fingerprint se computa en el servidor a partir de `User-Agent` + `Accept-Language` + IP truncada, con salt (`ANTI_ABUSO_SALT`). No se usa canvas ni se ejecuta JavaScript de tracking en el cliente.
- **Privacidad por diseño**:
  - Las IPs se truncan a /24 (IPv4) o /64 (IPv6) antes de hashear.
  - Nunca se almacena IP en claro.
  - Los hashes no se exponen en UI ni en endpoints públicos.
  - Retención máxima configurable vía `anti_abuso.retencion_fuente_dias` (default 90 días).
- **Fallo aislado**: si el registro de fuente falla, el reporte se crea igual y se loguea el error.

## Fase A — Ponderación de señal de fuente en el score

### Cambios de schema

- Tabla `FuenteReporte` (1:1 con `Reporte`):
  - `ipHash`, `fingerprintHash`, `cuentaDiasAntiguedad`, `reportesPrevios`, `reportesConfirmados`, `reportesDescartados`, `pesoAplicado`.
- Campos en `Reporte`: `fuenteConfianza Float?`.
- Campos en `IdentificadorReportado`: `scoreAnonimo`, `scoreAutenticado`, `scoreAjustado`.

### Cálculo de peso

`pesoAplicado` parte de:

| Señal | Peso base | Notas |
|-------|-----------|-------|
| Reporte autenticado | `scoring.source_weight.authenticated` (default 1.0) | |
| Reporte anónimo | `scoring.source_weight.anonymous` (default 0.65) | |
| Cuenta < 7 días | × `scoring.source_weight.new_account_factor` (default 0.7) | |
| Ráfaga contra mismo identificador | × `scoring.source_weight.burst_factor` (default 0.4) | Ventana y máximo configurables |
| Reportes confirmados previos | × `confirmed_factor^min(n,3)` (default 1.2) | |
| Reportes descartados previos | × `discarded_factor^min(n,3)` (default 0.3) | |

El peso se acota al rango `[0.1, 2.0]`.

### Score ajustado

- `score`: score actual sobre todos los reportes (sin cambios de comportamiento mientras el flag esté desactivado).
- `scoreAnonimo`: score calculado solo con reportes anónimos.
- `scoreAutenticado`: score calculado solo con reportes autenticados.
- `scoreAjustado = min(100, round(scoreAnonimo × pesoAnonimoPromedio + scoreAutenticado × pesoAutenticadoPromedio))`.
- El cálculo se puede forzar con `calcularScore(..., { forceSourceWeight: true })` para la simulación en seco.

### Feature flag

- `scoring.source_weight.enabled` default `false`.
- Mientras esté `false`, `scoreAjustado` usa pesos promedio `1.0` y el score visible/nivel de riesgo sigue usando `score`.

### Activación

- `scoring.source_weight.enabled` **permanecerá en `false` hasta después del despliegue a producción**.
- La activación solo podrá autorizarse con una **simulación ejecutada sobre los datos reales de producción** (no sobre la BD de desarrollo).
- La simulación comparará, para cada identificador, el score actual vs. el score ajustado y reportará subidas/bajadas de nivel.
- Hasta tanto, el endpoint `/api/admin/anti-abuso/simulacion-score` y la página `/dashboard/admin/anti-abuso` permiten correr la simulación en seco sin modificar datos.

### Archivos clave

- `src/lib/anti-abuso/fuente-reporte.ts`
- `src/lib/scoring.ts`
- `src/app/api/reportes/route.ts`
- `src/app/api/admin/anti-abuso/simulacion-score/route.ts`
- `src/app/dashboard/admin/anti-abuso/page.tsx`
- `src/components/modules/AdminAntiAbusoSimulacion.tsx`

### Tests

- `src/lib/anti-abuso/fuente-reporte.test.ts`
- `src/lib/scoring.test.ts`

## Fase B — Rate limiting por fuente

### Objetivo

Complementar el rate limit actual (por IP / usuario) con límites compuestos que sean más difíciles de evadir rotando IPs o creando cuentas.

### Comportamiento aprobado

| Scope | Descripción | Al superar el límite |
|-------|-------------|----------------------|
| `report` | Actual: por IP (anónimo) o por usuario (autenticado). | Rechazo 429 (se mantiene). |
| `report_identificador` | Por `(identificador, plataforma)`. | **No rechazar**: marcar reporte como `POSIBLE_SPAM` o `REVISION_MANUAL` según gravedad. |
| `report_fingerprint` | Por fingerprint server-side. | Rechazo 429. |

- El límite `report_identificador` nunca rechaza; evita perder reportes legítimos de una víctima real que esté siendo reportada por múltiples personas.
- El fingerprint server-side calculado en Fase A es la base del límite `report_fingerprint`.

### Parámetros en `ParametroSistema`

Todos los valores deben ser configurables:

- `ratelimit.report_identificador.window_seconds`
- `ratelimit.report_identificador.max_requests`
- `ratelimit.report_identificador.spam_threshold` (umbral a partir del cual se marca `POSIBLE_SPAM` en lugar de `REVISION_MANUAL`)
- `ratelimit.report_fingerprint.window_seconds`
- `ratelimit.report_fingerprint.max_requests`

### Archivos a modificar

- `src/lib/rate-limit.ts`: extender `checkRateLimit` para soportar scopes compuestos y devolver si el exceso debe derivar en marca de spam.
- `src/lib/anti-abuso/fuente-reporte.ts`: reutilizar `fingerprintHash` para el scope `report_fingerprint`.
- `src/app/api/reportes/route.ts`: aplicar `report_identificador` y `report_fingerprint`; en vez de 429 para `report_identificador`, marcar estado `POSIBLE_SPAM`/`REVISION_MANUAL`.
- `prisma/seed.ts`: agregar parámetros de Fase B.
- Tests en `src/lib/rate-limit.test.ts` y `src/app/api/reportes/route.test.ts`.

## Fase C — Descargo/apelación del identificador reportado

- Diseño a presentar aparte.
- Prever titularidad difícil (nicks) y vector de abuso de pausas.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Falsos positivos por IP/NAT compartido | Truncado a /24, peso nunca llega a 0, límite `report_identificador` no rechaza. |
| Activación prematura del peso de fuente | Flag default `false`; activación solo con simulación sobre producción. |
| Exposición de hashes | Hashes no salen por API ni UI; retención limitada. |
| Perdida de reportes legítimos por rate limit | `report_identificador` marca para revisión en vez de rechazar. |

## Notas de implementación

- Variables de entorno: `ANTI_ABUSO_SALT` requerida en producción.
- Política de privacidad actualizada en `src/app/privacidad/page.tsx`.
