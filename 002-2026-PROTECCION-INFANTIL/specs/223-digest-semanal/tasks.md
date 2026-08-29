# Tasks: SPEC-223 — Digest semanal al CEO

**Input**: `specs/223-digest-semanal/` (spec.md, plan.md, research.md, data-model.md).
**Prerrequisitos verificados en el árbol**: `DigestSemanal`, `ScoreCliente`, `Recomendacion`, `Anomalia` ya existen en `prisma/schema.prisma` (SPEC-220/221/225 integradas); Motor Notif (`motor.programar`) en `src/lib/notificaciones/motor.ts`.

**Hallazgos contra el código real (afectan tareas)**:

- `DigestSemanal.estado` quedó como `String` con valores cerrados en **minúsculas** (`"generado" | "enviado" | "fallido"`, patrón `AlertaColegio.estado`) y **sin** campo `motivoFallo`. Se usan los valores reales del schema; el motivo de fallo (≤500 chars) va a `AuditLog.metadatos` (FR-014 se cumple vía auditoría por digest, sin tocar el bloque del modelo de SPEC-220).
- El modelo `DigestSemanal` solo persiste `top5Decisiones`, `kpisSemana`, `kpisVsPrevia`, `enlacePanel`: las secciones anomalías/ganadores-perdedores/recomendaciones se envían en las variables de la notificación pero no se persisten (regenerables en cada corrida).
- `analisis.digest.dia_semana` y `analisis.digest.hora_bogota` ya los siembra SPEC-220 (`seedParametrosAnalisis`); esta spec siembra solo `analisis.digest.enabled` y `analisis.digest.destinatarios_emails`.

## Formato

`- [ ] TNNN [P?] Descripción con ruta de archivo exacta` · `[P]` = paralelizable (archivos disjuntos).

---

## Fase 1 — Modelo y seed

- [x] T001 Migración aditiva del enum `AccionAudit` (`ANALISIS_DIGEST_GENERADO`, `ANALISIS_DIGEST_ENVIADO`, `ANALISIS_DIGEST_FALLIDO`, patrón `DO $$ … IF NOT EXISTS` de SPEC-215) en `prisma/migrations/20260824110000_spec_223_digest_semanal_audit/migration.sql`
- [x] T002 Añadir los 3 valores al enum `AccionAudit` (al final del bloque, con comentario `// SPEC-223:`) en `prisma/schema.prisma` y correr `npx prisma generate`
- [x] T003 [P] Bloque `seedDigestSemanal()` con ancla `// ── SPEC-223:` en `prisma/seed.ts`: parámetros `analisis.digest.enabled` (BOOLEAN `true`) y `analisis.digest.destinatarios_emails` (STRING `""`) con `update: {}`; plantillas `analisis.digest.semanal.email` / `.in_app` (upsert por `clave`, `update: {}` para respetar el editor de SPEC-202, data-model §5); reglas `analisis.digest.semanal` rol `ADMIN` canales `EMAIL`/`IN_APP` (`offset "+0m"`, `obligatoria false`, create-if-missing); hook en `main()` tras `seedParametrosAnalisis()` y export

## Fase 2 — Semana y contenido (puros, TDD)

- [x] T004 [P] Helper de ventana semanal Bogotá + periodo ISO (`"YYYY-Wnn"`) con `date-fns-tz` en `src/lib/analisis/semana.ts` (`ventanaSemanaAnteriorBogota(ahora?)`, `periodoSemanaISOBogota(fecha)`)
- [x] T005 [P] Tests unitarios de frontera (23:59/00:01 Bogotá, cambio de año ISO W52/W53→W01) en `src/lib/analisis/semana.test.ts` y registro en `vitest.unit.includes.ts` (comentario `// SPEC-223:`)
- [x] T006 [P] Lógica pura del contenido en `src/lib/analisis/digest-contenido.ts`: tipos `KpisSemana`/`DecisionTop`/`ClienteScore`/`AnomaliaItem`, `calcularDeltas(actual, previa)`, `parsearDestinatariosEmails(texto)`, renderers Markdown texto plano (`renderTop5`, `renderTablaKpis`, `renderAnomalias`, `renderGanadoresPerdedores`, `renderRecomendacionesSistema`) y heurística `generarRecomendacionesSistema(kpis, previa, umbralPct)`
- [x] T007 [P] Tests unitarios de T006 en `src/lib/analisis/digest-contenido.test.ts` y registro en `vitest.unit.includes.ts`

## Fase 3 — DAL del digest

- [x] T008 Métodos del dominio en `src/lib/dal/repositories/analisis-repository.ts` (AÑADIR al final de la clase): `kpisVentana(rango)` (recaudo USD/COP de `Pago` AUTORIZADO con `fechaAutorizacion` en ventana; nuevas/canceladas de `Suscripcion`; activas al inicio para churn), `topRecomendacionesPendientes(take)`, `scoresConNombreCliente(periodoMes)` (top/bottom + promedio, nombre = colegio o titular), `anomaliasEnVentana(rango)`, `buscarDigest(periodo, destinatarioId)`, `upsertDigest(...)`, `marcarDigestEnviado(id)`, `marcarDigestFallido(id)`, `listarAdminsActivosDigest()`, `buscarUsuarioDigestPorEmail(email)`
- [x] T009 Tests de integración del repositorio en `src/lib/dal/repositories/analisis-repository.test.ts` (AÑADIR describe SPEC-223; no correr — BD compartida)

## Fase 4 — Módulo de orquestación

- [x] T010 `src/lib/analisis/digest-semanal.ts`: `ejecutarDigestSemanal(ahora?)` (enabled → ventana → destinatarios param/fallback ADMIN → contenido base único → loop por destinatario con upsert idempotente, guard `enviado` = no-op, reintento de `fallido`; envío exclusivo por `motor.programar`; `programadas = 0` + sin reglas activas → `fallido`, `= 0` con reglas → `enviado` por opt-out; email-only sin fila + auditoría; un fallo no detiene a los demás) y `generarDigestParaDestinatario(destinatario, ventana)`; `AuditLog` SYSTEM (`usuarioId` omitido, `ipAddress: "worker"`) con acciones `ANALISIS_DIGEST_*` y solo metadatos agregados
- [x] T011 Tests de integración del módulo (idempotencia 2 corridas, reintento de FALLIDO, resolver destinatarios param/default/inválido/sin destinatarios, KPIs con datos sembrados, opt-out, motor sin reglas → FALLIDO, enabled=false) en `src/lib/analisis/digest-semanal.test.ts` (no correr — BD compartida)

## Fase 5 — Schedule

- [x] T012 Schedule `analisis-digest-semanal` en `scripts/worker-reportes.mjs` (tras el bloque `motor-deriva-semanal`, molde líneas 567-587): cron `0 {hora} * * {dia}` derivado de `analisis.digest.hora_bogota`/`analisis.digest.dia_semana` vía `getParametroSistemaValor` (defaults 8/1, rangos validados), `{ tz: "America/Bogota" }`, handler delgado que llama `ejecutarDigestSemanal()`; sin advisory lock nuevo (vive en el worker de reportes existente)

## Fase 6 — Validación

- [x] T013 Gate: `npx tsc --noEmit`, `npm run test:unit -- src/lib/analisis/semana.test.ts src/lib/analisis/digest-contenido.test.ts` (vitest directo si los umbrales de cobertura molestan), verificar seed idempotente por inspección; completar sección Implementación de `spec.md` y checklist de `quickstart.md` en el reporte al coordinador

## Dependencias

T001→T002 (mismo enum) → T008/T010 · T004→T005, T006→T007 (TDD) → T010 · T003, T012 independientes tras T010 · T013 última.
