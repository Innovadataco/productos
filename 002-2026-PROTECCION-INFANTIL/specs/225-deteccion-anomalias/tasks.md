# Tasks: SPEC-225 — Detección de anomalías dinero-vs-valor

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/anomalias-admin.md`, `quickstart.md`.
**Rama**: `work/002-PI-mega-cola-restante` (mega-lote 220–227).

## Hallazgos de implementación (código real, 2026-08-24)

- **H-1**: El modelo `Anomalia` YA EXISTE (`prisma/schema.prisma:2552`, migración `20260824061000_analisis_modelo_score` de SPEC-220) con `tipo`/`severidad` como `String` de valores cerrados (no enums) y sin `@@index([resueltaEn])`. Caso previsto por spec.md §Assumptions: **se reutiliza el modelo; NO se crean los enums `TipoAnomalia`/`SeveridadAnomalia` ni la tabla**. La migración de esta spec solo añade el índice `anomalias_resuelta_en_idx` y el valor `ANOMALIA_RESUELTA` de `AccionAudit`. Los tipos cerrados se expresan en TS como uniones de literales en `tipos.ts`.
- **H-2**: SPEC-220 ya siembra 3 de los 10 parámetros (`crecimiento_pct_umbral`, `mora_dias_umbral_alta`, `mora_dias_umbral_media`, `prisma/seed.ts:616-618`). Esta spec siembra los 7 restantes con upsert idempotente.
- **H-3**: Advisory locks en uso: 123456789–123456794, 923456789, 987654321. **Esta spec usa `123456795`**.
- **H-4**: Frontera DAL (Q-3): TODAS las queries viven en `src/lib/dal/repositories/anomalia-repository.ts`; servicios/reglas/rutas lo consumen. Prohibido `@/lib/prisma` fuera del DAL.
- **H-5**: `Colegio.tenantId` (unique) → `Tenant`; `SesionLog.tenantId` y `Reporte.tenantId` cuelgan de ahí. Uso por colegio = `SesionLog` con `tenantId = colegio.tenantId`.
- **H-6**: "Pago puntual" (definición operacional, FR-005): pago AUTORIZADO cuyo `fechaReporte` ≤ fecha límite teórica = `fechaInicio` + meses acumulados de las duraciones cubiertas por los pagos autorizados anteriores. Sin campo de período cubierto en `Pago`, esta es la aproximación determinista documentada (research §Assumptions lo permite). Implementada como función pura `esPagoPuntual` en `puntualidad.ts`.
- **H-7**: Worker sin pg-boss (patrón `worker-analisis-reglas.mjs`): loop con tick releído de `ParametroSistema` en cada ciclo, flag `--run-once` para el quickstart.
- **H-8**: `notaResolucion` del contrato PATCH: se persiste con merge aditivo en `datosContexto.notaResolucion` (opción 1 del contrato, conserva trazabilidad).

## Fase 1 — Setup y modelo de datos

- [x] T001 Leer spec completa + verificar hallazgos H-1..H-8 contra el código real.
- [x] T002 [P] Añadir al FINAL del enum `AccionAudit` el valor `ANOMALIA_RESUELTA` con comentario `// SPEC-225`, y al bloque `model Anomalia` el `@@index([resueltaEn])` (aditivo) en `prisma/schema.prisma`. Ejecutar `npx prisma generate`.
- [x] T003 Crear migración aditiva `prisma/migrations/20260824110000_spec_225_anomalias_indice_audit/migration.sql`: `CREATE INDEX IF NOT EXISTS "anomalias_resuelta_en_idx" ON "anomalias"("resuelta_en")` + `ALTER TYPE "AccionAudit" ADD VALUE` guardado con `DO $$ ... pg_enum` (patrón `20260823130000_spec_235_accion_audit_guia_accion`). Cero DROP.
- [x] T004 Seed en `prisma/seed.ts`: función `seedAnomalias()` con ancla `// ── SPEC-225:` — (a) upsert de los 7 parámetros faltantes `analisis.anomalias.*` (`tick_min`=60, `uso_caido_pct_umbral`=50, `caida_recaudo_pct_umbral`=30, `cancelaciones_24h_umbral`=5, `colegio_grande_min_reportes`=50, `base_minima_comparacion`=3, `email_inmediato_habilitado`=true; categoría SYSTEM, no públicos, no secretos); (b) regla Motor Notif `analisis.anomalia.detectada` rol ADMIN, offset `+0m`, canales EMAIL + IN_APP ambas `obligatoria: true` (patrón findFirst→update/create de SPEC-236); (c) plantillas `analisis.anomalia.detectada.email` / `.in_app` en español neutro con variables `{{tipoAnomalia}}`, `{{severidad}}`, `{{descripcion}}`, `{{fechaDeteccion}}`, `{{urlAnomalia}}`. Llamarla desde `main()` junto a las demás del dominio Análisis. Idempotente (correr dos veces no duplica).

## Fase 2 — DAL (frontera Q-3)

- [x] T005 Crear `src/lib/dal/repositories/anomalia-repository.ts` (clase `AnomaliaRepository`, patrón `AnalisisRepository`, `tx?` opcional): métodos de lectura por regla (`listarSuscripcionesVencidasConPagos`, `listarAltasPorSemana`, `contarSesionesPorTenant`, `listarCancelacionesRecientes`, `contarReportesPorTenant`, `sumarRecaudoPorCiudad`, `contarCancelaciones24h`), dedup (`existeAnomaliaAbierta`), `crearAnomalia` (una TX por anomalía vía `withUnitOfWork`), `listarAdminsActivos`, y consultas de la API admin (`listarAnomalias` con `Prisma.AnomaliaWhereInput` + paginación, `obtenerAnomalia`, `marcarResuelta`). Todo tipado, sin `any`.
- [x] T006 Crear `src/lib/dal/repositories/anomalia-repository.test.ts` (integración, `resetDatabase`, fixtures mínimas; NO correr localmente — BD compartida).

## Fase 3 — Detector (servicio de dominio)

- [x] T007 [P] `src/lib/analisis/anomalias/tipos.ts`: uniones `TipoAnomalia`/`SeveridadAnomalia` (literales cerrados, H-1), `CandidatoAnomalia`, `ContextoDeteccion`, `ParametrosAnomalias`, `ResumenTick`.
- [x] T008 [P] `src/lib/analisis/anomalias/ventanas.ts` (puro): `semanaCalendarioBogota(ahora)` → rango `[desde, hasta)` UTC lunes 00:00–lunes siguiente America/Bogota (`date-fns-tz`, patrón `periodos.ts`); `semanaAnterior(actual)`; `ultimas24h(ahora)`.
- [x] T009 [P] `src/lib/analisis/anomalias/comparativas.ts` (puro): `evaluarComparativaSemanal(actual, anterior, umbralPct, baseMinima, direccion)` → `{ evaluable, variacionPct, dispara }` (base 0 → no evaluable; sin división por cero). Usada por las 3 reglas comparativas.
- [x] T010 [P] `src/lib/analisis/anomalias/puntualidad.ts` (puro): `mesesPorDuracion(DuracionPlan)` y `contarPagosPuntuales(fechaInicio, pagos)` (H-6).
- [x] T011 [P] `src/lib/analisis/anomalias/parametros.ts`: `leerParametrosAnomalias()` (los 10 umbrales, defaults del plan §5, vía `getParametroSistemaValor`) y `obtenerTickMinAnomalias()`.
- [x] T012 [P] Tests unitarios (sin BD): `ventanas.test.ts` (frontera domingo 23:59/lunes 00:01 Bogotá), `comparativas.test.ts` (base cero, base insuficiente, umbrales exactos, ambas direcciones), `puntualidad.test.ts`. Registrarlos en `vitest.unit.includes.ts` con comentario `// SPEC-225:`.
- [x] T013 Reglas en `src/lib/analisis/anomalias/reglas/` (firma `(ctx: ContextoDeteccion) => Promise<CandidatoAnomalia[]>`, consumen el repo del ctx): `mora-anomala.ts` (MEDIA ≥ umbralMedia, ALTA ≥ umbralAlta, ≥2 pagos puntuales, sin renovación autorizada posterior a `fechaFin`), `crecimiento-anomalo-ciudad.ts` (BAJA), `uso-caido-abrupto.ts` (MEDIA), `cancelacion-colegio-grande.ts` (ALTA, `canceladaEn` en 24h + reportes históricos > umbral), `caida-recaudo-ciudad.ts` (ALTA, USD), `cancelaciones-masivas-24h.ts` (ALTA, sin sujeto). `datosContexto` solo agregados/ids internos (FR-008).
- [x] T014 `src/lib/analisis/anomalias/alertas.ts`: `alertarAnomaliaAlta(anomalia)` — si `email_inmediato_habilitado`, resolver ADMINs activos (repo; vacío → log `[Anomalias] Sin destinatarios ADMIN activos`) y `programar({ evento: "analisis.anomalia.detectada", sujetoTipo: "Anomalia", sujetoId, destinatarios })` con las 5 variables del contrato; `urlAnomalia = ${NEXT_PUBLIC_APP_URL}/dashboard/admin/estadisticas`. Fail-open con try/catch (FR-010).
- [x] T015 `src/lib/analisis/anomalias/detector.ts`: `ejecutarDeteccion(ahora?)` — lee parámetros frescos, calcula ventanas, ejecuta las 6 reglas en secuencia con try/catch individual (un fallo no detiene las demás), dedup por `(tipo, sujetoTipo, sujetoId)` abierto (FR-007), persiste cada anomalía en su TX, dispara alerta solo si ALTA (FR-009), devuelve `ResumenTick` y loguea `[Anomalias] Tick: ...`.
- [x] T016 Tests de integración `src/lib/analisis/anomalias/reglas.test.ts` y `detector.test.ts` (dataset a favor/en contra por regla, dedup segundo tick = 0, MEDIA vs ALTA por umbral, base mínima insuficiente, ALTA → filas `Notificacion` programadas, MEDIA/BAJA → 0, kill-switch, fail-open). NO correr localmente.

## Fase 4 — API admin (US3)

- [x] T017 `src/app/api/admin/analisis/anomalias/route.ts` — GET lista (solo `verifyAuth("ADMIN")`): Zod para `tipo`/`severidad`/`estado`/`page`/`pageSize` (400 en inválidos), where tipado `Prisma.AnomaliaWhereInput`, `{ items, pagination }` ordenado `detectadaEn` desc (FR-012, contrato).
- [x] T018 `src/app/api/admin/analisis/anomalias/[id]/route.ts` — GET detalle con `datosContexto` (404 si no existe) y PATCH resolver: body Zod `{ notaResolucion?: string ≤500 }`, 409 si ya resuelta, merge aditivo de la nota en `datosContexto`, `logAudit` acción `ANOMALIA_RESUELTA` (metadatos sin PII), retorna la anomalía actualizada (FR-013/FR-014). Servicio de resolución en `src/lib/analisis/anomalias/resolucion.ts` (patrón SPEC-221 `resolver.ts`).
- [x] T019 Tests de integración de ambas rutas (matriz 200/400/401/403/404/409, patrón `recomendaciones/[id]/resolver/route.test.ts`). NO correr localmente.

## Fase 5 — Worker e infra

- [x] T020 `scripts/worker-anomalias.mjs`: patrón `worker-analisis-reglas.mjs` — advisory lock `123456795` (exit 2 si tomado), tick releído de `analisis.anomalias.tick_min` en cada ciclo, `--run-once` ejecuta un tick y sale 0, SIGTERM/SIGINT limpio, logs `[Anomalias]`.
- [x] T021 `scripts/dev-restart.sh`: AÑADIR con comentario `# SPEC-225:` el `pkill -f worker-anomalias.mjs`, el `nohup ... worker-anomalias.mjs > /tmp/worker-anomalias-002.log` y las menciones en las líneas de `ps`/logs. No reordenar lo existente.
- [x] T022 `docker-compose.prod.yml`: AÑADIR servicio `pi-anomalias` (patrón `pi-notificaciones`: imagen pi-app, `command: node --import tsx scripts/worker-anomalias.mjs`, `TZ: America/Bogota`, volumen run, depends_on db healthy + app) con comentario `# SPEC-225`.

## Fase 6 — Gate y documentación

- [x] T023 `npx tsc --noEmit` limpio en archivos propios; `npm run test:unit -- src/lib/analisis/anomalias` verde (unitarios puros); `npx prisma generate` ya corrido en T002.
- [x] T024 Completar sección Implementación de `spec.md` (resumen de cambios, desviaciones H-1/H-2, gate local, deuda técnica).

## Dependencias y notas

- T002/T003/T004 (schema+seed) antes que T005+ (el repo tipa contra el cliente generado).
- T007–T011 puros antes que T013–T015; T012 puede ir en paralelo con T013.
- T020 depende de T015 + T004 (parámetros en BD en runtime).
- Tests de integración (T006/T016/T019) se escriben pero NO se ejecutan en este entorno (BD compartida del mega-lote; los corre el coordinador).
- Git: PROHIBIDO (el coordinador serializa los commits).
