# Tasks: SPEC-220 — Modelo Análisis + score de valor de cliente

**Input**: `specs/220-modelo-analisis-score/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)
**Prerequisitos**: SPEC-206 (`SesionLog`) y SPEC-210 (`Suscripcion`/`Plan`) ya en prod.

## Formato

`TNNN [P] [USn] descripción — ruta de archivo`. `[P]` = paralelizable (archivos distintos, sin dependencia). TDD: tests antes o junto a la implementación.

## Fase 1 — Setup: modelo de datos y migración (US1)

- [x] T001 [US1] Añadir al final de `prisma/schema.prisma` los enums `ModoRegla` y `EstadoRecomendacion`, y los modelos `ScoreCliente`, `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal`, `Anomalia` (definición exacta en data-model.md §3); añadir valor `ANALISIS_SCORE_PURGA` al enum `AccionAudit` (línea ~243, patrón comentario SPEC); añadir relaciones inversas `scoreClientes ScoreCliente[]` en `Suscripcion` (línea ~753) y `reglasRecomendacionCreadas`/`recomendacionesResueltas`/`anomaliasResueltas`/`digestsSemanal` en `Usuario` (línea ~503) — `prisma/schema.prisma`
- [x] T002 [US1] Crear migración aditiva manuscrita `prisma/migrations/20260824060000_analisis_modelo_score/migration.sql` (solo `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ALTER TYPE ADD VALUE`/`ADD CONSTRAINT`; verificar cero `DROP`/`ALTER COLUMN` destructivo); correr `npx prisma generate` — `prisma/migrations/20260824060000_analisis_modelo_score/migration.sql`
- [x] T003 [P] [US1] Seed idempotente de los 13 parámetros `analisis.*` (data-model.md §4): función `seedParametrosAnalisis()` con ancla `// ── SPEC-220:`, upsert por `clave` con `update: {}` (no pisa tuning del admin), llamada desde `main()` y export — `prisma/seed.ts`

## Fase 2 — Servicio de score (US2, US4)

- [x] T004 [P] [US2] Helpers puros de período Bogotá: `periodoActualBogota`, `rangoMesBogota`, `periodoLimiteRetencion`, `esPeriodoValido` con `date-fns-tz` (dependencia existente) — `src/lib/analisis/periodos.ts`
- [x] T005 [P] [US2] Tests unitarios de T004: formato `YYYY-MM`, frontera de mes 23:59/00:01 Bogotá vs UTC, resta de meses para retención (incl. cruce de año) — `src/lib/analisis/periodos.test.ts`
- [x] T006 [US2] Servicio `recalcularScoresPeriodo(periodo?)` + `purgarSnapshotsAntiguos()`: pesos desde `ParametroSistema` (fallback 3/5/2/1), conteos `count` por `tipoTitular` (COLEGIO: `Reporte.tenantId`/`SeguimientoCaso`/`AlertaColegio`/`SesionLog.tenantId`; PADRE: `Reporte.usuarioId`/`Expediente.padreUsuarioId`/`SesionLog.usuarioId`/alertas=0), upsert por `(suscripcionId, periodo)` con snapshot de pesos, segunda pasada de `percentilEnCohorte` por cohorte (rank promedio en empates, cohorte unitaria → null), purga `periodo < periodoLimite` con `logAudit` (`ANALISIS_SCORE_PURGA`, `ipAddress: "worker"`) — `src/lib/analisis/score.ts`
- [x] T007 [US2] Tests de integración de T006: fórmula exacta `3R+5C+2A+1S` con pesos default, snapshot de pesos en fila, mapeo por tipo de titular, upsert idempotente (re-corrida sin duplicados), percentil (incl. cohorte unitaria → null), purga (borra > ventana, conserva ≤ ventana, idempotente sin segundo AuditLog) — `src/lib/analisis/score.test.ts`

## Fase 3 — Worker + Docker (US2, US4)

- [x] T008 [P] [US2] Worker `scripts/worker-analisis-score.mjs` siguiendo `scripts/worker-tasas.mjs`: advisory lock `123456791` (verificado libre: en uso 123456789, 123456790, 923456789, 987654321), exit 2 si tomado, `boss.schedule("analisis-score-recalculo", cron, {}, { tz: "America/Bogota" })` con cron derivado de `analisis.score.frecuencia_recalculo_horas` (default `30 3 * * *`), SIGTERM/SIGINT, handler = recálculo + purga — `scripts/worker-analisis-score.mjs`
- [x] T009 [P] [US2] Servicio `pi-analisis-score` en `docker-compose.prod.yml` (patrón `pi-notificaciones`/`pi-senal-comunitaria`: `command: node --import tsx scripts/worker-analisis-score.mjs`, `TZ: America/Bogota`, volumen `pi_worker_run`) — `docker-compose.prod.yml`

## Fase 4 — Vista (US3)

- [x] T010 [P] [US3] `AnalisisRepository.obtenerScoreCliente(suscripcionId)`: snapshot del período actual + histórico de hasta 12 períodos descendente, tipado `ScoreClienteVista`, `DbClient` inyectable — `src/lib/dal/repositories/analisis-repository.ts`
- [x] T011 [US3] Tests de integración de T010: actual null sin score, actual + histórico ordenado con tope 12 — `src/lib/dal/repositories/analisis-repository.test.ts`
- [x] T012 [P] [US3] Card presentacional `ScoreClienteCard` (tokens papel/tinta, `text-body`/`text-muted`, sin color crudo, tono neutral sin voseo, terminología "Score de valor"/"Reportes"/"Casos"/"Alertas"/"Sesiones", estado vacío neutral, percentil solo si existe, histórico 12m) — `src/components/modules/pagos/ScoreClienteCard.tsx`
- [x] T013 [P] [US3] Tests unitarios de render de T012: con score (total, desglose con peso aplicado, percentil), sin score (estado vacío), cohorte unitaria (sin percentil), histórico — `src/components/modules/pagos/ScoreClienteCard.test.tsx`
- [x] T014 [US3] Integrar la card en la ficha existente tras la sección de titular: fetch con `new AnalisisRepository().obtenerScoreCliente(id)` y render; puerta `verifyAuth("ADMIN")` + `assertModulo(admin, "pagos_admin")` ya existente, sin endpoints nuevos — `src/app/dashboard/admin/pagos/cliente/[id]/page.tsx`
- [x] T015 [P] [US3] Registrar los tests unitarios nuevos en `vitest.unit.includes.ts` — `vitest.unit.includes.ts`

## Fase 5 — Validación

- [x] T016 Gate: `npx tsc --noEmit` limpio en archivos de esta SPEC, `npm run tokens:check`, `npm run test:unit -- <tests nuevos>`; migración revisada (cero `DROP`); reporte de desviaciones.

## Dependencias

```text
T001 → T002 → (T004/T006/T010 usan el cliente generado)
T003 independiente de T002 (seed corre tras aplicar migración)
T004 → T006 → T007 ; T004 → T005
T006 → T008 ; T010 → T011 ; T012 → T013 → T014
```

## Notas

- Sin endpoints API nuevos ni `contracts/` (Server Component + repositorio, ver plan §2.5).
- `ReglaRecomendacion`/`Recomendacion`/`DigestSemanal`/`Anomalia` quedan sin lógica de negocio (SPEC-221/223/225); no se siembran reglas.
- `componenteAlertas = 0` para titular PADRE en v1 ([NEEDS CLARIFICATION] en spec.md).
- Los workers programados existentes (`worker-tasas`, `worker-sesiones`, `worker-senal-comunitaria`) NO están en `scripts/dev-restart.sh`; se sigue ese patrón (el worker nuevo vive en `docker-compose.prod.yml` y se corre manual en dev).
