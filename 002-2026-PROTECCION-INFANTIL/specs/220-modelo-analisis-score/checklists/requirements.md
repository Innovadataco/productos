# Checklist de requisitos: SPEC-220

## User Stories

- [ ] US-1: Dominio Análisis en BD de forma aditiva.
  - [ ] Modelos `ScoreCliente`, `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal`, `Anomalia` creados.
  - [ ] Enums `ModoRegla` y `EstadoRecomendacion` creados; `AccionAudit.ANALISIS_SCORE_PURGA` añadido.
  - [ ] 13 parámetros `analisis.*` sembrados con defaults correctos, categoría `SYSTEM`.
  - [ ] Seed idempotente (segunda corrida sin duplicados).
  - [ ] `ReglaRecomendacion`/`Recomendacion`/`DigestSemanal`/`Anomalia` vacíos (sin lógica de SPECs posteriores).
- [ ] US-2: Job diario de recálculo del score.
  - [ ] Componentes COLEGIO: `Reporte.tenantId` / `SeguimientoCaso` / `AlertaColegio` / `SesionLog.tenantId`.
  - [ ] Componentes PADRE: `Reporte.usuarioId` / `Expediente` / `SesionLog.usuarioId` / alertas = 0.
  - [ ] Solo suscripciones `ACTIVA`/`EN_GRACIA`.
  - [ ] Snapshot de pesos por fila; fórmula `Σ componente × peso`.
  - [ ] Upsert idempotente por `(suscripcionId, periodo)`.
  - [ ] `percentilEnCohorte` por `(tipoTitular, periodo)`; cohorte unitaria → null.
  - [ ] Cortes en `America/Bogota` (frontera de mes correcta).
  - [ ] Advisory lock: segunda instancia sale con código 2.
- [ ] US-3: Card "Score de valor este mes" en ficha de cliente.
  - [ ] Total + desglose por componente con peso aplicado + percentil.
  - [ ] Histórico últimos 12 meses.
  - [ ] Estado vacío neutral sin score calculado.
  - [ ] Solo ADMIN con `pagos_admin`; nunca visible al cliente ni otros roles en v1.
  - [ ] Terminología brief §3, tono neutral sin voseo.
- [ ] US-4: Retención de snapshots.
  - [ ] Purga de `periodo` más antiguo que `analisis.score.retencion_meses`.
  - [ ] `AuditLog` por corrida de purga con metadatos (sin PII).
  - [ ] Ventana respetada (dentro no se toca) y purga idempotente.
  - [ ] Cambio del parámetro se respeta sin deploy.

## Functional Requirements

- [ ] FR-001: `ScoreCliente` con único `(suscripcionId, periodo)` e índice `(periodo, scoreTotal DESC)`.
- [ ] FR-002: `ReglaRecomendacion` con `clave` única, `modo` default `RECOMIENDA`, índice `(activa, prioridad DESC)`.
- [ ] FR-003: `Recomendacion` con estado default `PENDIENTE` e índices de consulta.
- [ ] FR-004: `DigestSemanal` con único `(periodo, destinatarioId)`.
- [ ] FR-005: `Anomalia` con índices por tipo y severidad.
- [ ] FR-006: Seed de 13 parámetros `analisis.*` idempotente.
- [ ] FR-007: `src/lib/analisis/score.ts` con `recalcularScoresPeriodo` (pesos desde params, mapeo por titular, upsert, percentil).
- [ ] FR-008: Cálculo solo con conteos agregados; cero lectura de textos/PII.
- [ ] FR-009: `scripts/worker-analisis-score.mjs` patrón `worker-tasas.mjs` (lock propio, cron pg-boss, tz Bogotá).
- [ ] FR-010: Cada corrida ejecuta recálculo + purga con `AuditLog`.
- [ ] FR-011: Servicio `pi-analisis-score` en `docker-compose.prod.yml` con `TZ: America/Bogota`.
- [ ] FR-012: `AnalisisRepository.obtenerScoreCliente` (actual + histórico 12m, tipado).
- [ ] FR-013: Card en `dashboard/admin/pagos/cliente/[id]/page.tsx` bajo la puerta existente.
- [ ] FR-014: Textos UI neutrales, sin voseo, terminología §3.
- [ ] FR-015: Tests de fórmula, mapeo por titular, idempotencia, percentil, purga y render de la card.

## Success Criteria

- [ ] SC-001: Migración aditiva aplica sin errores; 5 modelos + 13 parámetros listos.
- [ ] SC-002: 100 suscripciones recalculadas < 60 s; cero duplicados en doble corrida.
- [ ] SC-003: `scoreTotal = 3R + 5C + 2A + 1S` exacto con pesos default; pesos en la fila.
- [ ] SC-004: Card muestra mes actual + hasta 12 meses; estado vacío sin error (HTTP 200).
- [ ] SC-005: Purga elimina 100% fuera de ventana y 0% dentro, con `AuditLog`.
- [ ] SC-006: Worker instancia única (exit 2) y cron `America/Bogota`.
- [ ] SC-007: Gate local verde (`tsc`, `lint`, `test:unit`, `build`, `dev-restart`).

## Candados y restricciones

- [ ] NO se tocó `src/lib/ai/**`.
- [ ] NO se tocó el rate-limit del reporte público.
- [ ] Migraciones 100% aditivas (cero `DROP`, cero cambio de columnas existentes).
- [ ] Retención 24 meses parametrizable (`analisis.score.retencion_meses`, default 24).
- [ ] Score solo visible al ADMIN en v1 (nunca al cliente titular).
- [ ] Sin PII de reportes en agregados: el score usa solo conteos.
- [ ] Sistema visual heredado (vidrio Apple + Instrument + radios 16/12/22, color ámbar admin).
- [ ] NO se implementó motor de reglas (SPEC-221), panel (SPEC-222), digest (SPEC-223), editor de reglas (SPEC-224), anomalías (SPEC-225), ejecución automática (SPEC-226) ni historial (SPEC-227).
- [ ] NO se añadió `suscripcionId` a `SesionLog` (se usa `usuarioId`/`tenantId`).
- [ ] NO se sembraron las 7 reglas semilla (corresponde a SPEC-221).
- [ ] Sin endpoints API nuevos (vista server-side vía repositorio).

## Dependencias

- [ ] SPEC-206 (`SesionLog`) disponible en la base.
- [ ] SPEC-210 (`Suscripcion`/`Plan`/`Pago`) disponible en la base.
- [ ] Rama `work/002-PI-mega-cola-restante`; un commit atómico por SPEC.
