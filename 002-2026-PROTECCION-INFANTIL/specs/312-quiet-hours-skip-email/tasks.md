# Tasks: Quiet hours no aplica a EMAIL ni IN_APP

## Phase 1: Foundational
- [X] T001 `quiet-hours.ts`: agregar `CANALES_SIN_QUIET_HOURS = new Set(["EMAIL", "IN_APP"])` + 3er param opcional `canal?: string` a `aplicarQuietHours`, con skip categórico (`if (canal && CANALES_SIN_QUIET_HOURS.has(canal)) return enviarEn;`) + JSDoc citando I-165 y la decisión CEO

## Phase 2: User Story 1 (P1) — EMAIL/IN_APP no se difieren
- [X] T002 [US1] `motor.ts:157`: cambiar `aplicarQuietHours(conOffset)` → `aplicarQuietHours(conOffset, undefined, regla.canal)`
- [X] T003 [US1] `procesar-lote.ts:89`: pasar `notificacion.canal` como 3er arg
- [X] T004 [P] [US1] `quiet-hours.test.ts`: casos EMAIL→sin modificar, IN_APP→sin modificar, PUSH-hipotético→aplica ventana, sin-canal→aplica ventana (retro-compat), canal-desconocido→aplica ventana, fuera-de-ventana+EMAIL→sin modificar
- [X] T005 [P] [US1] `procesar-lote.test.ts`: notif ENCOLADA canal EMAIL con enviarEn en ventana silencio se procesa (no `diferida_quiet_hours`); idem IN_APP; regresión: canal que aplica ventana + enviarEn en ventana → sigue difiriéndose

## Phase 3: Polish
- [X] T006 `npx tsc --noEmit` limpio
- [X] T007 `npm run lint -- <archivos>` + grep `error` explícito (candado 24/D-55)
- [X] T008 `npm run arch:check` verde (sin ruta nueva, no debería regenerar)
- [X] T009 Confirmar por diff cero cambios fuera de `src/lib/notificaciones/**` + specs

## Decisión T-312-A: test motor.test.ts reescrito para afirmar comportamiento nuevo

**Test modificado**: `motor.test.ts:105` — `"programar con offset futuro respeta quiet hours"` → `"programar con canal EMAIL NO difiere por quiet hours (SPEC-312)"`.

**Por qué**: el test anterior afirmaba que EMAIL se difería dentro de la ventana — exactamente el bug I-165 que SPEC-312 elimina a propósito. Actualizar el test es legítimo porque el spec invierte su premisa. Aprobado por Fábrica PI-1 con 3 condiciones cumplidas: (1) assert exacto (`toBe(conOffset.getTime())`), (2) nombre que no miente, (3) cobertura perdida documentada aquí.

**Cobertura perdida**: el deferral a nivel emisor (`motor.ts:157`) ya no tiene test de integración, porque EMAIL/IN_APP son los únicos 2 canales del enum hoy y ambos lo saltan categóricamente. Esta cobertura **sí existe** en `quiet-hours.test.ts` a nivel unitario (13 casos, incluye canal PUSH hipotético que sí aplica la ventana). La cobertura de integración del deferral en el emisor se recuperará cuando exista un canal real que lo aplique (PUSH/SMS, Fase 2).

## Deuda diferida (SPEC de seguimiento — NO en este SPEC)
- **Leer el parámetro de BD en el emisor**: `motor.ts:157` hoy pasa `undefined` como ventana → usa el default hardcodeado `"20:00-07:00"` de `quiet-hours.ts:10`, ignorando `notificaciones.horario.silencio` de BD (que sí lee el worker vía `worker-notificaciones.mjs:117`). Con el skip categórico por canal, EMAIL/IN_APP quedan cubiertos igual, así que este gap NO afecta I-165. Pero para canales futuros (PUSH/SMS) el emisor debería leer el parámetro BD para respetar la ventana configurada por admin. Requiere volver async la ruta de programación o cachear la config — decisión de diseño para el SPEC de seguimiento (autorizado diferir por CEO IDC 2026-08-29 23:32 COT, alcance MVP urgente).
- **Tests exhaustivos adicionales** (PUSH/SMS reales cuando aterricen, bypass `prioridad=CRITICA`) — Fase 2.
