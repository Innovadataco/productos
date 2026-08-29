# Implementation Plan: Deuda motor notificaciones (métrica + ratchet + logger)

**Branch**: `work/pi-SPEC-302-deuda-motor-notif` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/302-deuda-motor-notificaciones/spec.md`

## Summary

Cierra 3 puntos de deuda técnica (R-022 §1.3) tras el fix de I-147: (a) señal de monitoreo de notificaciones `ENCOLADA` vencidas, expuesta como métrica + endpoint HTTP + sonda del vigilante; (b) ratchet de CI que protege contra la reintroducción de I-147, diseñado como manifiesto de timers en vez del grep naif del brief original (que daba 7 falsos positivos, incluyendo el propio fix de I-147); (c) migración de 5 `console.warn` del motor a logger estructurado con nivel configurable por variable de entorno propia.

## Technical Context

**Language/Version**: TypeScript 5 (strict) + Node.js >= 22

**Primary Dependencies**: Next.js App Router (endpoint), Prisma 5.22 (repositorio existente), `tsx` (ratchets y probes ejecutados como scripts)

**Storage**: PostgreSQL vía `NotificacionRepository` existente; sin migración (usa `@@index([estado, enviarEn])` ya presente)

**Testing**: Vitest — integración (métrica con BD real, endpoint mockeado) + unitario (logger del motor con mocks de repos, ratchet con fixtures en tmpdir)

**Target Platform**: Servidor Next.js en contenedor (mismo runtime que `/api/health`) + script standalone (`scripts/monitor-probes.mjs`) + CI (`ratchets:check`)

**Project Type**: web-service (feature dentro del monorepo existente 002-2026-PROTECCION-INFANTIL)

**Performance Goals**: Query de métrica indexada (`@@index([estado, enviarEn])`), sub-10ms esperado; no bloquea el ciclo del vigilante (mismo patrón que `probeIndices`)

**Constraints**: Cero cambios en `src/lib/ai/**`, `prisma/schema.prisma`, `deploy-prod.sh`, `verificar-base-pr.yml`, `resolver-spam`; imports relativos obligatorios en toda la cadena alcanzable desde `scripts/*.mjs` (ratchet `no-worker-alias` existente)

**Scale/Scope**: 3 puntos independientes, ~10 archivos tocados/nuevos, sin nuevas entidades de datos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verificado contra `.specify/memory/constitution.md`: esta feature es infraestructura interna (monitoreo + CI + logs), no toca ninguno de los 6 principios de producto (§1: solo-texto, presunción de inocencia, IA local, canales oficiales, disputas, no-modificar-reportes). Principios técnicos (§2) respetados: stack heredado sin cambios, ningún ORM/framework nuevo. Sin violaciones. Gate: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/302-deuda-motor-notificaciones/
├── plan.md              # Este archivo
├── data-model.md         # No aplica (sin entidades nuevas) — omitido
├── quickstart.md         # Ver sección "Verificación manual" abajo, embebida
├── contracts/            # No aplica (un solo endpoint GET trivial, documentado en spec.md FR-003)
└── tasks.md               # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/notificaciones/
│   ├── metricas.ts                    # NUEVO — contarPendientesVencidas()
│   ├── metricas.test.ts               # NUEVO — integración (BD real)
│   ├── motor.ts                       # MODIFICADO — 5 console.warn → logMotor()
│   └── motor-logger.test.ts           # NUEVO — unitario (mocks)
├── src/lib/dal/repositories/
│   └── notificacion.ts                # MODIFICADO — + contarEncoladasVencidas()
├── src/lib/monitoreo/
│   └── probes.ts                      # MODIFICADO — + probeNotifPendientesVencidas() + señal en SENALES_MONITOREO
├── src/lib/routing/
│   └── guardias.ts                    # MODIFICADO — + "/api/monitor/notif" en publicas
├── src/app/api/monitor/notif/
│   ├── route.ts                       # NUEVO — GET sin auth
│   └── route.test.ts                  # NUEVO — unitario (mock de la métrica)
├── scripts/
│   └── monitor-probes.mjs             # MODIFICADO — + señal notif_pendientes_vencidas
├── scripts/lint/
│   ├── no-unref-timer-nuevo.ts        # NUEVO — ratchet (manifiesto, no AST)
│   ├── timers-worker-manifest.json    # NUEVO — 8 ocurrencias documentadas
│   └── ratchets.test.ts               # MODIFICADO — + describe("no-unref-timer-nuevo")
├── vitest.unit.includes.ts            # MODIFICADO — + motor-logger.test.ts
├── package.json                       # MODIFICADO — + ratchets:no-unref-timer, encadenado en ratchets:check
└── docs/architecture/
    ├── 02-roles-capacidades.md        # REGENERADO — nueva ruta pública
    └── 06-stack.md                    # REGENERADO — nuevo script npm
```

**Structure Decision**: Se reutiliza la arquitectura de capas existente (servicios → repositorios → Prisma) sin introducir patrones nuevos. El ratchet sigue el patrón local ya establecido en `scripts/lint/*.ts` (función pura + CLI entry + test con fixtures en tmpdir), en vez de la sugerencia original del brief de un step inline en `ci.yml`.

## Decisiones de diseño (research inline — feature pequeña, sin research.md separado)

1. **Punto (a) — Repositorio, no Prisma directo**: `metricas.ts` inicialmente importaba `prisma` directo; corregido a `NotificacionRepository.contarEncoladasVencidas()` tras verificar el candado de frontera DAL (Q-3) en AGENTS.md, confirmado en verde por `npm run arch:check` sección (verificación de mocks/imports).
2. **Punto (a) — Imports relativos**: `metricas.ts` es alcanzable desde `scripts/monitor-probes.mjs` vía `probes.ts`; usa import relativo (`../dal/repositories/notificacion`) siguiendo el precedente documentado en `motor.ts`/`enviar-email.ts` (SPEC-197 · I-88), verificado en verde por el ratchet existente `no-worker-alias`.
3. **Punto (a) — Ruta pública**: el nuevo endpoint quedó bloqueado con 401 para tráfico anónimo hasta agregarlo a `GUARDIAS_ACCESO.publicas` (detectado por `npm run arch:check`, que regenera y compara `02-roles-capacidades.md`); corregido y regenerado.
4. **Punto (b) — Manifiesto en vez de grep en ci.yml (HALLAZGO)**: el grep propuesto por el brief/instructivo ("todo timer debe tener `.unref()` en la misma línea") da 7 falsos positivos contra el código actual, incluyendo `worker-notificaciones.mjs:207` — el timer que el fix real de I-147 dejó **sin** `.unref()` a propósito. Aplicar ese ratchet tal cual habría exigido revertir el fix de I-147 para pasar CI. Reportado como HALLAZGO a Fábrica PI-1 (2026-08-29 11:52 COT), quien verificó independientemente y autorizó el "Camino A": ratchet de manifiesto (archivo + texto de línea + justificación), sin AST, cero falsos positivos hoy, protege contra timers nuevos sin revisar. Integrado al `ratchets:check` ya cableado en `ci.yml` — sin tocar el workflow.
5. **Punto (c) — Nivel de log por módulo sin tocar `logger.ts`**: en vez de modificar el logger compartido (que calcula su nivel una sola vez al cargar, desde `LOG_LEVEL` global), se agregó un gate local en `motor.ts` (`getMotorLogLevel()` + `logMotor()`) que reutiliza `LEVELS`/`LogLevel` ya exportados por `logger.ts`, respetando `LOG_LEVEL_NOTIFICACIONES` de forma independiente sin duplicar la lógica de formateo/salida.

## Complexity Tracking

*Sin violaciones de constitución; tabla omitida.*
