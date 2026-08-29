# Tasks — Spec 096: Expediente del reporte — traza del modelo (rol Admin)

## Fase 0 — Setup: migración, parámetros y permiso

- [x] T001 [P] US3: modelo `PasoProcesamiento` en `prisma/schema.prisma` (tabla `pasos_procesamiento`, índice `(reporteId, creadoEn)`, cascade) + relación inversa en `Reporte` + migración aditiva `npx prisma migrate dev --name paso_procesamiento`.
- [x] T002 [P] US4/US7: seed upsert de `admin.expediente.etapas` (JSON, 10 etapas, estructura de data-model.md) y `mensaje.padre.canales` (JSON, ICBF 141 / Te Protejo / CAI 123) en `prisma/seed.ts`; tipo JSON, categoría SYSTEM, `esPublico: false`.
- [x] T003 [P] US5: módulo `expediente_revelar_original` (padre `bandeja_reportes`, `esCritico:true`) en `src/lib/permisos-catalogo.ts`; verificar que el seed lo crea y que el backfill lo otorga SOLO a ADMIN; test de `puedeAccederAModulo` (ADMIN sí, OPERADOR no) en `src/lib/permisos-modulos.test.ts` o colocalizado.

**Gate F0**: `npx tsc --noEmit` + `npm run lint` + `npm run test` (tests afectados) + `npm run build`.

## Fase 1 — US3: Instrumentación Capa 2

- [x] T010 US3 (TDD): helper `registrarPaso(reporteId, etapa, {veredicto?, detalle?, latenciaMs?})` best-effort (fail-open con log `[Expediente]`) en `src/lib/expediente/pasos.ts` + test unitario `src/lib/expediente/pasos.test.ts` (escribe; fallo de BD no propaga).
- [x] T011 US3: instrumentar guardas (ráfaga/doxing/keyword con veredicto) en `src/app/api/reportes/procesar/helpers/guardas-previas.ts` y `rafagas.ts`.
- [x] T012 US3: instrumentar score de deduplicación (también cuando NO es duplicado) en `src/app/api/reportes/procesar/helpers/duplicados.ts`.
- [x] T013 US3: instrumentar RAG (casos recuperados y categorías vecinas) y razón explícita de la regla de decisión en `src/app/api/reportes/procesar/helpers/clasificacion.ts` y `guardas.ts`/`finalizacion.ts` según corresponda.
- [x] T014 US3: regresión — suite de integración del procesamiento verde (los helpers no cambian comportamiento, solo registran).

**Gate F1**: lint + test + tsc + build.

## Fase 2 — Backend del expediente (US1/US2/US5/US6/US7)

- [x] T020 US4/US1 (TDD): ensamblador `src/lib/expediente/expediente.ts` — lee `admin.expediente.etapas` (`getParametroSistema`), arma las 10 etapas (Capa 1 desde Prisma; Capa 2 desde PasoProcesamiento con `sinInstrumentar:true` si vacío) + test `src/lib/expediente/expediente.test.ts` (10 etapas; degradación elegante; renombrar etapa en el parámetro se refleja).
- [x] T021 US2 (TDD): `src/lib/expediente/votacion.ts` — matriz modelo×categoría y detalle por pregunta cruzando `ClasificacionRubricaVoto.preguntasJson` con `ia.rubrica.preguntas` EN VIVO (tipo decisiva/contexto del parámetro; no cumplida = 0) + test (edición del parámetro cambia el texto; votos solo de la tabla, nunca de `ClasificacionIA.votos`).
- [x] T022 US6 (TDD): builder puro `src/lib/expediente/analisis-interno.ts` (consenso X/N, gravedad interna D-13, señales decisivas, disparador, confianza, peso de fuente, conclusión neutral) + test.
- [x] T023 US7 (TDD): builder puro `src/lib/expediente/mensaje-padre.ts` — plantillas deterministas por conducta + canales desde `mensaje.padre.canales`; test que prueba: sin score/riesgo, canales del parámetro, ensamblado por conducta.
- [x] T024 US1/US5 (TDD): endpoint `GET /api/admin/reportes/[id]/expediente` en `src/app/api/admin/reportes/[id]/expediente/route.ts` (patrón de `src/app/api/admin/reportes-revision/[id]/route.ts`) + `route.test.ts` con helpers de `src/lib/reporte-test-utils.ts`: 200 con 10 etapas; 401/403/404/429; sin permiso → campos gated omitidos + `revelado:false`; con permiso + `revelar=true` → campos incluidos + AuditLog `TEXTO_ORIGINAL_REVELADO`.
- [x] T025 US5: migrar `src/app/api/admin/reportes/[id]/revelar-original/route.ts` del rol duro ADMIN a `assertModulo(user,"expediente_revelar_original")`; ajustar su `route.test.ts` (otorgar módulo en el seed de test).

**Gate F2**: lint + test + tsc + build.

## Fase 3 — UI

- [x] T030 US1/US2/US6/US7: componente `src/components/modules/AdminReporteExpediente.tsx` — Modal con timeline vertical estilo Stage de `IaTraceTimeline.tsx` (punto + línea + GlassCard + Badge), sección de votación por categoría/pregunta, síntesis al final; toggle "Revelar original" solo si `puedeRevelar`; sin acciones de edición.
- [x] T031 US1: botón "Ver proceso" en la celda de acciones de `src/components/modules/AdminReportesTable.tsx` (~línea 306) junto a "Ver detalle", con estado local propio.
- [x] T032 [P] US1: test del componente `src/components/modules/AdminReporteExpediente.test.tsx` (renderiza etapas, marca "sin instrumentar", oculta gated sin permiso, mensaje al padre sin score).

**Gate F3**: lint + test + tsc + build.

## Fase 4 — Cierre (las 5 reglas)

- [x] T040 US4: documentar `admin.expediente.etapas` y `mensaje.padre.canales` en `docs/configuracion/parametros-sistema.md` (tabla maestra + cómo probar).
- [x] T041: gate completo (`npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`) + deploy limpio `./scripts/dev-restart.sh` + healthcheck OK.
- [x] T042: validar el `quickstart.md` sección por sección contra la app levantada.
- [x] T043: `cierre.md` en `specs/096-expediente-reporte/` + sección Implementación en `spec.md` (Status → `FINALIZADO` pendiente ACTA) + marcar `checklists/requirements.md` + deuda técnica registrada.
- [x] T044: commits (uno por US + uno de docs, mensajes en español imperativo) con staging explícito `git add 002-2026-PROTECCION-INFANTIL/...` y push a `feature/001-scaffolding`; actualizar `specs/README.md` (096 → Finalizada pendiente ACTA).
