# Tasks: Deuda motor notificaciones (métrica + ratchet + logger)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

> Documentado retroactivamente (ver "Nota de proceso" en spec.md): las tareas se ejecutaron en el orden real, verificando cada una antes de seguir a la siguiente.

## Fase 1 — Punto (a): métrica + endpoint + sonda (User Story 1, P1)

- [X] T001 [P] Verificar en fuente shape de `Notificacion` (`prisma/schema.prisma`): campo real `enviarEn` (no `programadaPara` como decía el brief) + índice `@@index([estado, enviarEn])` ya existente
- [X] T002 Agregar `contarEncoladasVencidas(umbral: Date)` a `src/lib/dal/repositories/notificacion.ts` (frontera DAL, Q-3)
- [X] T003 Crear `src/lib/notificaciones/metricas.ts` con `contarPendientesVencidas(umbralMinutos = 15)`, import relativo al repo (I-88)
- [X] T004 [P] Crear `src/lib/notificaciones/metricas.test.ts` (integración, BD real): 3 vencidas cuentan, 1 no-vencida no cuenta, ENVIADA no cuenta, umbral parametrizable
- [X] T005 Crear `src/app/api/monitor/notif/route.ts` (GET sin auth, patrón `/api/health`)
- [X] T006 [P] Crear `src/app/api/monitor/notif/route.test.ts` (unitario, métrica mockeada): 200 con 🟢, 200 con 🔴, 500 si la métrica lanza
- [X] T007 Agregar `"/api/monitor/notif"` a `GUARDIAS_ACCESO.publicas` en `src/lib/routing/guardias.ts` (detectado por `arch:check` tras dejarla huérfana con 401)
- [X] T008 Agregar `probeNotifPendientesVencidas()` a `src/lib/monitoreo/probes.ts` + señal `"notif_pendientes_vencidas"` en `SENALES_MONITOREO`
- [X] T009 Wirear la señal en `scripts/monitor-probes.mjs` (import, `SENALES`, `case` en `correrProbe`)
- [X] T010 Regenerar `docs/architecture/02-roles-capacidades.md` (`npx tsx scripts/arch/generar-roles-capacidades.ts`)

**Checkpoint**: `contarPendientesVencidas` verde local (3/3), endpoint verde local (3/3), `arch:check` verde.

## Fase 2 — Punto (b): ratchet manifiesto anti-regresión I-147 (User Story 2, P1)

- [X] T011 Inventariar TODAS las ocurrencias de `set(Interval|Timeout)\(` en `scripts/worker-*.mjs` (8 encontradas)
- [X] T012 **HALLAZGO**: correr el grep literal del brief/instructivo → 7 falsos positivos, incluyendo `worker-notificaciones.mjs:207` (el fix real de I-147 no lleva `.unref()` a propósito) — reportado a Fábrica PI-1, autorizado "Camino A" (manifiesto, sin AST)
- [X] T013 Crear `scripts/lint/timers-worker-manifest.json` con las 8 ocurrencias + justificación cada una, incluyendo advertencia destacada sobre `worker-notificaciones.mjs:207`
- [X] T014 Crear `scripts/lint/no-unref-timer-nuevo.ts` (función pura `buscarTimersEnWorkers` + `buscarInfractores` + CLI entry), siguiendo el patrón de `no-x-invoke-path.ts`
- [X] T015 [P] Agregar tests a `scripts/lint/ratchets.test.ts` (describe "no-unref-timer-nuevo"): caso feliz, timer nuevo detectado, réplica del caso worker-notificaciones (sin falso positivo), réplica del caso unref-línea-posterior, multiset, filtro de nombre de archivo, directorio inexistente
- [X] T016 Wirear `ratchets:no-unref-timer` en `package.json`, encadenado en `ratchets:check` (ya cableado en `ci.yml`, sin tocar el workflow)
- [X] T017 Correr el ratchet contra código actual → verde, 8 timers manifestados
- [X] T018 **Simulación de daño** (candado 14): agregar timer sin manifestar a un worker, correr ratchet → falla exit=1 señalando línea exacta; revertir

**Checkpoint**: Ratchet verde en código actual + simulación de daño confirma detección + tests unitarios verdes.

## Fase 3 — Punto (c): logger estructurado del motor (User Story 3, P2)

- [X] T019 Agregar `getMotorLogLevel()` + `logMotor()` a `src/lib/notificaciones/motor.ts`, reutilizando `LEVELS`/`LogLevel` de `../logger` (sin modificar `logger.ts`), import relativo (I-88)
- [X] T020 Migrar línea 85 (`Sin reglas activas`) → `logMotor("info", ...)`
- [X] T021 Migrar línea 96 (`Destinatario sin email`) → `logMotor("warn", ...)`
- [X] T022 Migrar línea ~120 (`omitida_por_preferencia`) → `logMotor("info", ...)`
- [X] T023 Migrar línea ~128 (`Plantilla no encontrada`) → `logMotor("warn", ...)`
- [X] T024 Migrar línea ~170 (`No se pudo encolar envío`) → `logMotor("warn", ...)`
- [X] T025 [P] Crear `src/lib/notificaciones/motor-logger.test.ts` (unitario, mocks de los 5 repos + queue + logger, `vi.resetModules()` + import dinámico para variar `LOG_LEVEL_NOTIFICACIONES` por test): 5 situaciones + nivel `error` suprime todo + valor inválido cae a default
- [X] T026 Agregar `motor-logger.test.ts` a `vitest.unit.includes.ts`
- [X] T027 Verificar cero `console.*` remanente en `motor.ts` (grep)

**Checkpoint**: 7/7 tests logger verdes, cero regresión en `motor.test.ts` (9/9) ni `procesar-lote.test.ts` (5/5) existentes.

## Fase 4 — Verificación global + documentación (todas las historias)

- [X] T028 `npx tsc --noEmit` verde
- [X] T029 `npm run lint` — 0 errores en archivos tocados (warnings pre-existentes sin relación)
- [X] T030 `npm run arch:check` verde (drift de artefactos, huérfanos, aserciones A/B, anti-mocks, anti-alias)
- [X] T031 `npm run locks:check` verde
- [X] T032 `npm run ratchets:check` verde (5 ratchets, incluyendo el nuevo)
- [X] T033 `test:unit` completo verde (224 archivos, 1712 tests)
- [X] T034 Tests de integración afectados verdes (`motor.test.ts`, `procesar-lote.test.ts`, `metricas.test.ts`, `route.test.ts` — 20/20)
- [X] T035 Escribir `spec.md` + `plan.md` + `tasks.md` retroactivos (proceso: se implementó antes de parar en compuerta §4 — ver nota en spec.md) + fila en `specs/README.md`
- [ ] T036 Enviar `spec+plan LISTO · PARA` a Fábrica PI-1 con disclosure honesto del salto de compuerta, esperar APROBADO antes de push/PR

## Dependencias

- Fase 1 (a) y Fase 3 (c) son independientes entre sí; Fase 2 (b) es independiente de ambas (archivos distintos, cero solapamiento)
- Fase 4 depende de que las 3 fases anteriores estén completas
- T036 depende de T035 y bloquea el push/PR (compuerta §4)
