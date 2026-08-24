# Tasks: SPEC-221 — Motor de reglas de recomendación

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/resolver-recomendacion.md`.
**Estado contra código real (verificado 2026-08-24)**: SPEC-220 ya creó las tablas `reglas_recomendacion`/`recomendaciones` y enums (migración `20260824061000_analisis_modelo_score`) y sembró `analisis.recomendaciones.frecuencia_evaluacion_min`. Esta spec añade: columna `ultimaEvaluacionEn`, índices de dedup/expiración, valor `RECOMENDACION_RESUELTA` en `AccionAudit`, los 2 parámetros restantes, las 7 reglas semilla, el motor, el worker y el endpoint.

## Fase 1 — Modelo (aditivo sobre lo dejado por SPEC-220)

- [x] T001 Añadir `ultimaEvaluacionEn DateTime? @db.Timestamptz(6)` al final de los campos de `ReglaRecomendacion` en `prisma/schema.prisma`; añadir `@@index([reglaId, sujetoId, estado])` y `@@index([expiraEn])` al final del bloque `Recomendacion`; añadir `RECOMENDACION_RESUELTA` al final del enum `AccionAudit` (con comentario `// SPEC-221:`).
- [x] T002 Crear migración aditiva `prisma/migrations/20260824080000_spec_221_motor_reglas/migration.sql`: `ALTER TABLE reglas_recomendacion ADD COLUMN ultimaEvaluacionEn`, 2 índices, `ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RECOMENDACION_RESUELTA'`. Cero DROP.
- [x] T003 `npx prisma generate`.

## Fase 2 — DAL (frontera Q-3: toda query Prisma vive aquí)

- [x] T004 Crear `src/lib/dal/repositories/reglas-recomendacion.ts` (clase `ReglasRecomendacionRepository`, patrón `AnalisisRepository`): `obtenerRegla`, `listarReglasActivas`, `ejecutarQuerySoloLectura(sql, timeoutMs)` (TX interactiva: `SET TRANSACTION READ ONLY` + `SET LOCAL statement_timeout` + `$queryRawUnsafe`), `buscarPendientePorSujeto`, `buscarPendientePorDedupKey`, `crearRecomendacion`, `actualizarRecomendacionPendiente`, `marcarReglaEvaluada`, `expirarVencidas`, `obtenerRecomendacion`, `resolverRecomendacionConAuditoria` (update + `AuditLog` en una TX).

## Fase 3 — Motor (`src/lib/analisis/reglas/`)

- [x] T005 [P] `src/lib/analisis/reglas/ejecutor-sql.ts`: validación estática pura `validarSqlRegla(sql)` (prefijo SELECT/WITH + deny-list por token: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, REVOKE, COPY, EXECUTE, CALL, CREATE, SET). Sin acceso a BD (la ejecución queda en el DAL por la frontera Q-3 — desviación documentada respecto a plan §5.2 que los juntaba).
- [x] T006 [P] `src/lib/analisis/reglas/plantilla.ts`: render puro `renderPlantilla(plantilla, variables)` con placeholders `{{variable}}`; variable ausente → placeholder visible + warning; convención documentada: primera línea no vacía = `titulo`, resto = `descripcion`.
- [x] T007 `src/lib/analisis/reglas/motor.ts`: `evaluarRegla(reglaId)`, `evaluarReglasPendientes()`, `expirarRecomendacionesVencidas()` con dedup `(reglaId, sujetoId|dedupKey)` en PENDIENTE, umbral por columna `valor`, `expiraEn = ahora + expiracion_dias`, actualización de `ultimaEvaluacionEn`, modo `EJECUTA` diferido (log, `ejecutadaAutomatica = false`), AuditLog en rechazos de query peligrosa (query truncada a 200 chars).
- [x] T008 `src/lib/analisis/reglas/resolver.ts`: `resolverRecomendacion(id, estado, motivo, admin)` → 404/409 con `AppError`; delega en el repo (TX update + AuditLog `RECOMENDACION_RESUELTA`, metadatos `{ reglaId, categoria, estado }`).
- [x] T009 `src/lib/analisis/reglas/seed-reglas.ts`: definición pura de las 7 reglas semilla (claves, SQL contra schema real: `Suscripcion`, `Pago`, `Plan`, `Colegio`, `Ciudad`, `CodigoReferidoUso`) con convención de columnas `sujeto_tipo`, `sujeto_id`, `valor`.

## Fase 4 — Seed

- [x] T010 `prisma/seed.ts`: bloque `// ── SPEC-221:` con `seedReglasRecomendacion(adminEmail)` (upsert por `clave`; `update` solo de `nombre`/`descripcion`/`plantillaRecomendacion` — nunca `modo`, `activa`, `sqlQuery`) + los 2 parámetros faltantes (`analisis.recomendaciones.expiracion_dias` = 7, `analisis.recomendaciones.statement_timeout_ms` = 5000, `update: {}`). Llamada en `main()` tras `seedParametrosAnalisis()` + export.

## Fase 5 — Endpoint

- [x] T011 `src/app/api/admin/analisis/recomendaciones/[id]/resolver/route.ts`: `verifyAuth("ADMIN")` → Zod `{ estado: APLICADA|IGNORADA, motivo?: string ≤ 500 }` → servicio `resolverRecomendacion` → `errorToResponse`. Matriz 200/400/401/403/404/409 según contrato.

## Fase 6 — Worker + dev-restart

- [x] T012 `scripts/worker-analisis-reglas.mjs`: advisory lock propio **123456794** (verificado libre por grep; exit 2 si tomado), tick de 30 s que relee parámetros, llama `evaluarReglasPendientes()` + `expirarRecomendacionesVencidas()`, SIGTERM/SIGINT limpio. Arranque: `node --env-file-if-exists=.env --import tsx`.
- [x] T013 `scripts/dev-restart.sh`: `pkill -f worker-analisis-reglas.mjs` + `nohup ... > /tmp/worker-analisis-reglas-002.log` + entradas en líneas "Procesos:"/"Logs:" (comentario `// SPEC-221` en estilo del archivo: comentario `# SPEC-221:`).

## Fase 7 — Tests (TDD donde aplica; integración bajo `src/**`)

- [x] T014 [P] `src/lib/analisis/reglas/ejecutor-sql.test.ts` (unitario, registrar en `vitest.unit.includes.ts`): batería ≥ 8 casos de rechazo (DELETE, UPDATE, DROP, INSERT, ALTER, TRUNCATE, GRANT, sin SELECT) + aceptación de SELECT/WITH.
- [x] T015 [P] `src/lib/analisis/reglas/plantilla.test.ts` (unitario, registrar): render básico, variable ausente, split título/descripción.
- [x] T016 `src/lib/analisis/reglas/motor.test.ts` (integración): generación, render, dedup (crea 0 nuevas al re-evaluar), re-detención tras APLICADA crea nueva, regla inactiva omitida, umbral, query peligrosa rechazada con AuditLog, EJECUTA diferida, expiración idempotente.
- [x] T017 `src/lib/analisis/reglas/resolver.test.ts` (integración): 404, 409, resolución APLICADA/IGNORADA con AuditLog.
- [x] T018 `src/app/api/admin/analisis/recomendaciones/[id]/resolver/route.test.ts` (integración): matriz 200/400/401/403/404/409.
- [x] T019 `src/lib/analisis/reglas/seed-reglas.test.ts` (integración): `seedReglasRecomendacion` idempotente (2 corridas → 7 reglas, no pisa `modo`/`activa`), y las 7 queries semilla se ejecutan sin error contra la BD de tests vía el ejecutor read-only.

## Fase 8 — Gate local

- [x] T020 `npx tsc --noEmit` limpio en archivos propios + `npm run test:unit -- <tests propios>` verde. (Integración y lint/build completos: los corre el coordinador.)

## Notas de dependencias

- T004 depende de T001-T003. T007/T008 dependen de T004-T006. T010 depende de T009. T011 depende de T008. T012 depende de T007. T016-T019 dependen de sus módulos.
- NO tocar: `docs/architecture/*`, `src/lib/ai/**`, archivos de otras specs.
