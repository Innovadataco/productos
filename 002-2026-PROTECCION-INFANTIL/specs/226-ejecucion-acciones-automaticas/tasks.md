# Tasks: SPEC-226 — Ejecución de acciones automáticas (reglas modo EJECUTA)

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/226-acciones-automaticas.md` en `specs/226-ejecucion-acciones-automaticas/`.
**Rama**: `work/002-PI-mega-cola-restante` (SPEC-221/216/201..204 ya integrados).

## Formato

- `[P]` = paralelizable (archivos distintos, sin dependencia entre sí).
- Tests junto al código, siempre bajo `src/**`. Unitarios puros (sin BD) se registran en `vitest.unit.includes.ts` con comentario `// SPEC-226:`. Tests de integración se escriben pero NO se corren en el subagente (BD compartida; los corre el coordinador).
- Convenciones: TS strict sin `any`; frontera DAL (Prisma solo en `src/lib/dal/**`); `AppError` + códigos canónicos; logs `[Módulo]`; Motor Notif solo vía `programar()`/`cancelar()`; `src/lib/ai/**` intocable.

---

## Fase 1 — Modelo y migración (FR-007, FR-008 parcial)

- [x] **T001** Añadir a `prisma/schema.prisma` (SOLO aditivo): enums `TipoAccionEjecutable`, `EstadoEjecucion`, `OrigenEjecucion` y modelo `EjecucionAccion` AL FINAL del archivo (data-model §3, tabla `ejecuciones_accion`, índices `[recomendacionId]`, `[reglaId, ejecutadaEn]`, `[estado, ejecutadaEn]`); 3 valores `ANALISIS_ACCION_EJECUTADA|FALLIDA|REVERTIDA` al final del enum `AccionAudit`; relación inversa `ejecuciones EjecucionAccion[]` al final del bloque de relaciones del modelo `Recomendacion`.
- [x] **T002** Crear migración aditiva `prisma/migrations/20260824160000_spec_226_ejecucion_acciones/migration.sql` (CREATE TYPE ×3, ALTER TYPE AccionAudit ADD VALUE IF NOT EXISTS ×3, CREATE TABLE + FK a `recomendaciones` ON DELETE RESTRICT + 3 índices; data-model §6). Correr `npx prisma generate`.

## Fase 2 — Seed idempotente (FR-014, SC-007)

- [x] **T003** En `prisma/seed.ts`, añadir función `seedEjecucionAcciones()` con ancla `// ── SPEC-226:` (tras la definición de `seedEmergenciaExpediente`): parámetros `ratelimit.analisis_accion.window_seconds` (3600), `ratelimit.analisis_accion.max_requests` (20) y `analisis.acciones.alertas_destinatarios` (`"[]"`, tipo JSON) con `update: {}`; catálogo Motor Notif por upsert: evento `analisis.alerta.admin` (regla rol ADMIN canal EMAIL obligatoria + plantilla `es` con `{{severidad}} {{mensaje}} {{reglaClave}} {{urlPanel}}`) y evento `analisis.operador.asignacion` (reglas rol OPERADOR canales EMAIL + IN_APP + plantillas `es` con `{{tituloRecomendacion}} {{descripcionRecomendacion}} {{urlPanel}}`). Patrón I-100 (findFirst→update/create para reglas; upsert por clave para plantillas). Invocarla en `main()` tras `seedEmergenciaExpediente()` y exportarla.

## Fase 3 — DAL + handlers + registry (FR-002..FR-006)

- [x] **T004** `src/lib/dal/repositories/ejecucion-accion.ts` [repo DAL tipado]: `crear`, `obtenerPorId`, `buscarUltimaEjecutadaPorRecomendacion`, `marcarRevertida`, `fusionarResultado` (merge patch JSON), `listarAsignacionesVivas` (ASIGNAR_OPERADOR + EJECUTADA con recomendación PENDIENTE), `bloquearRecomendacion` (`SELECT ... FOR UPDATE` parametrizado), `obtenerRecomendacionConRegla`, `marcarRecomendacionAplicada`, `devolverRecomendacionAPendiente`, `obtenerSuscripcionParaAccion` (id/estado/usuarioId), `listarAdminsActivosIds`, `listarOperadoresActivosIds`, `contarUsosBono`, `desactivarBono`. Constructor con `tx?` (patrón `ReglasRecomendacionRepository`).
- [x] **T005 [P]** `src/lib/analisis/acciones/types.ts`: `AccionHandlerContext` `{ recomendacion, regla, parametros, tx, repo }`, `HandlerResult { resultado, notificar? }` (notificar post-TX, devuelve patch de resultado o void), `RevertirResult { detalle, resultadoPatch, notificar? }`, interfaz `AccionHandler { clave, tipo, ejecutar, revertir }`.
- [x] **T006 [P]** `src/lib/analisis/acciones/schemas.ts`: Zod por tipo — `crearBonoSchema` (`tipoBono` enum `TipoBono`, `valor` > 0, `vigenciaDias` int 1..365), `enviarNotificacionSchema` (`evento` string 1..120, `variables` record opcional), `asignarOperadorSchema` (`operadorId` opcional XOR `estrategia: "menor_carga"`), `crearAlertaSchema` (`severidad` ALTA|MEDIA|BAJA, `mensaje` 1..500, `datosContexto` record opcional). + `schemas.test.ts` unitario.
- [x] **T007** `src/lib/analisis/acciones/handlers/crear-bono.ts` (FR-003): helper puro `calcularVigenciaBono(ahora, vigenciaDias)` (date-fns-tz, America/Bogota: inicio 00:00 Bogotá de hoy, fin 23:59:59.999 Bogotá de hoy+N) y `generarNombreBono(clave, sujetoId, ahora)` (`AUT-<reglaClave>-<sujetoCorto>-<yyyyMMdd>`); valida sujeto `Suscripcion` existente y no CANCELADA (si no → error `sujeto_no_valido`); crea vía `PagosRepository(tx).crearBonoPromocional` con `creadoPorAdminId = regla.creadaPorAdminId`, `aplicaARenovaciones = true`; revertir: `activo = false`, si hay `BonoAplicado` → detalle "bono con usos: solo desactivado". + `crear-bono.test.ts` unitario de los helpers puros (frontera 23:59/00:01 Bogotá, SC-006).
- [x] **T008 [P]** `src/lib/analisis/acciones/handlers/enviar-notificacion.ts` (FR-004): ejecutar resuelve destinatario (sujetoTipo `Usuario` → sujetoId; `Suscripcion` → suscripcion.usuarioId; si no → `destinatario_no_resoluble`) y devuelve `notificar` que llama SOLO `programar()` con `{evento, sujetoTipo, sujetoId, destinatarios}` y devuelve patch `{programadas, canceladasPorReemplazo}`; revertir: `cancelar()` con filtros de la ejecución (soloProgramadas), patch `revertido.canceladas`, detalle "no reversible (ya enviada)" si canceladas = 0.
- [x] **T009 [P]** `src/lib/analisis/acciones/handlers/asignar-operador.ts` (FR-006): `operadorId` explícito (valida OPERADOR activo) o `estrategia: "menor_carga"` (conteo de asignaciones vivas por operador; empate → asignación más antigua; sin operadores → `sin_operadores_disponibles`); resultado `{operadorId}`; `notificar` programa `analisis.operador.asignacion` al operador; revertir: recomendación vuelve a PENDIENTE + notificación de desasignación. NO usa `asignarOperadorAReporte`.
- [x] **T010 [P]** `src/lib/analisis/acciones/handlers/crear-alerta.ts` (FR-005): resuelve destinatarios desde `analisis.acciones.alertas_destinatarios` (JSON de usuarioIds; vacío/inválido → todos los ADMIN activos); `notificar` programa `analisis.alerta.admin` con variables `severidad`, `mensaje`, `reglaClave`, `urlPanel`; revertir: detalle "alerta marcada como atendida (registro); las alertas ya enviadas no se des-envían". + `crear-alerta.test.ts` unitario (resolución de destinatarios con repo inyectado + `programar` mockeado, patrón `anomalias/alertas.test.ts`).
- [x] **T011** `src/lib/analisis/acciones/registry.ts`: `Map` clave criolla → handler (`crear_bono`, `enviar_notificacion`, `asignar_operador`, `crear_alerta`) + `tipoAccionDeClave()` → `TipoAccionEjecutable`. Clave desconocida → `null` (el ejecutor la registra FALLIDA).
- [x] **T012 [P]** `src/lib/analisis/acciones/rate-limit-regla.ts`: wrapper de `checkRateLimit` con scope `analisis_accion`, `identifier = reglaId` y `Request` sintético (sin IP real).

## Fase 4 — Ejecutor + hook SPEC-221 (FR-001, FR-008, FR-009, FR-013, FR-015)

- [x] **T013** `src/lib/analisis/acciones/ejecutor.ts`: `ejecutarAccion({ recomendacionId, origen, adminId? })` — carga recomendación+regla; valida modo (AUTOMATICA exige `EJECUTA`, si no FALLIDA `modo_no_ejecuta`) y estado PENDIENTE (si no FALLIDA `recomendacion_no_pendiente`); rate-limit por regla (FALLIDA `rate_limit_regla` + AuditLog, sin efectos); handler desconocido → FALLIDA `accion_desconocida`; TX: bloqueo de fila + `handler.ejecutar` + `EjecucionAccion(EJECUTADA)` + recomendación `APLICADA` (`ejecutadaAutomatica = origen === "AUTOMATICA"`) + `AuditLog(ANALISIS_ACCION_EJECUTADA)` con `reglaId`/`reglaClave`; error de handler → rollback TX y registro `FALLIDA` (motivo seguro, `safeErrorMessage`) + `AuditLog(ANALISIS_ACCION_FALLIDA)`; post-TX `notificar()` fail-open con log, merge del patch en `resultado`. NUNCA lanza (devuelve la `EjecucionAccion`).
- [x] **T014** `src/lib/analisis/acciones/rollback.ts`: `revertirEjecucion({ recomendacionId, motivo, adminId })` — 404 si no existe recomendación; 409 si no hay `EjecucionAccion` EJECUTADA; TX: `handler.revertir` + `marcarRevertida(revertidaPorAdminId, motivoReversion)` + `AuditLog(ANALISIS_ACCION_REVERTIDA)`; post-TX notificaciones de reversión; devuelve `{ ejecucion, efectoReversion }`.
- [x] **T015** `src/lib/analisis/acciones/aplicar.ts`: `aplicarRecomendacion({ id, adminId })` — 404/409 (no PENDIENTE); si la recomendación no tiene acción ejecutable → marcar `APLICADA` con auditoría (vía repo existente `resolverRecomendacionConAuditoria`) y devolver `ejecucion: null`; si tiene → `ejecutarAccion({ origen: "MANUAL_ADMIN", adminId })`.
- [x] **T016** Hook en `src/lib/analisis/reglas/motor.ts` (FR-013): en `evaluarRegla`, recolectar ids de recomendaciones creadas/actualizadas; si `regla.modo === "EJECUTA"`, invocar `ejecutarAccion` por cada una en try/catch aislado (un fallo no detiene las demás); contadores `ejecutadas`/`fallidas` en `ResultadoEvaluacion` (aditivo) y log `[Analisis/Reglas]`. Eliminar el `console.warn` de "diferida a SPEC-226" y actualizar el docblock.
- [x] **T017** `src/lib/analisis/acciones/ejecutor.test.ts` (INTEGRACIÓN, no correr): éxito `crear_bono` end-to-end (bono + EjecucionAccion + AuditLog + recomendación APLICADA), RECOMIENDA no ejecuta, acción desconocida → FALLIDA, handler que lanza → FALLIDA sin tumbar la siguiente, rate-limit por regla (N=2, tercera FALLIDA `rate_limit_regla` sin bono), rollback por tipo, doble reversión → 409 vía servicio.

## Fase 5 — Endpoints admin (FR-010, FR-011, FR-012)

- [x] **T018 [P]** `src/app/api/admin/analisis/recomendaciones/[id]/aplicar/route.ts`: POST — `verifyAuth("ADMIN")` + `assertModulo(user, "analisis_recomendaciones")` + rate-limit `admin_write` (429 con headers); llama `aplicarRecomendacion`; respuesta 200 `{ recomendacion, ejecucion }`; errores vía `errorToResponse` (404/409).
- [x] **T019 [P]** `src/app/api/admin/analisis/recomendaciones/[id]/revertir/route.ts`: POST — mismos guards; body Zod `{ motivo: string 5..500 }` (400); llama `revertirEjecucion`; 200 `{ ejecucion, efectoReversion }`; 409 si ya REVERTIDA/FALLIDA.
- [x] **T020** `aplicar/route.test.ts` + `revertir/route.test.ts` (INTEGRACIÓN, no correr): 200/401/403/404/409 (+400 en revertir sin motivo), patrón de `resolver/route.test.ts` (handler importado, Request nativo, seed en beforeAll, cleanup + `$disconnect` en afterAll; actor de AuditLog = Usuario real; fixtures con `Plan.precio: 0` y `Suscripcion.codigoReferidoPropio`).

## Fase 6 — Registro de tests unitarios y gate

- [x] **T021** Añadir a `vitest.unit.includes.ts` con comentario `// SPEC-226:`: `schemas.test.ts`, `crear-bono.test.ts`, `crear-alerta.test.ts`.
- [x] **T022** Gate: `npx tsc --noEmit` limpio en archivos propios; `npx prisma generate`; tests unitarios propios con vitest directo (`--coverage.enabled=false`). Sin UI → no aplica `tokens:check`. Reporte final con archivos A/M, desviaciones y lock id (N/A: sin worker nuevo).

## Dependencias

- T002 depende de T001. T004..T012 tras T002 (tipos generados). T013..T015 dependen de T004-T012. T016 depende de T013. T018/T019 dependen de T014/T015. T020 depende de T018/T019.
- TDD: tests unitarios de T006/T007/T010 se escriben junto al código; los de integración (T017/T020) documentan el contrato antes del gate del coordinador.

## Notas

- Sin worker nuevo → sin advisory lock.
- No se toca: `src/lib/ai/**`, Motor Notif (solo API pública), `PagosRepository` (solo consumo), rate-limit del reporte público, `docs/architecture/*`.
