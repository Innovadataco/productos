# Implementation Plan: Quiet hours no aplica a EMAIL ni IN_APP

**Branch**: `work/pi-SPEC-312-quiet-hours-skip-email` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

## Summary

Skip categórico de la ventana de silencio para los canales `EMAIL` e `IN_APP` (los 2 únicos del enum hoy), cerrando I-165. `aplicarQuietHours` gana un 3er parámetro opcional `canal`; los 2 callsites (`motor.ts:157` emisor — el que realmente causa el bug — y `procesar-lote.ts:89` worker) lo pasan.

## Technical Context

**Language/Version**: TypeScript 5, Node.js >= 22
**Módulos**: `src/lib/notificaciones/` (quiet-hours, motor, procesar-lote)
**Testing**: Vitest — unitario (quiet-hours puro) + integración (procesar-lote con BD)
**Constraints**: Cero migración/enum/UI/librería · solo backend notificaciones · firma retro-compatible (`canal` opcional, 3er arg)

## Constitution Check

Fix backend del motor de notificaciones, no toca principios de producto. Gate: PASA.

## Decisiones de diseño

1. **Skip por canal, no por ventana**: `CANALES_SIN_QUIET_HOURS = new Set(["EMAIL", "IN_APP"])`; si el canal está en el set, `aplicarQuietHours` retorna `enviarEn` sin tocar. Decisión CEO: email es asíncrono e IN_APP se ve cuando el usuario mira — ninguno interrumpe físicamente, y retener 2FA/password/pagos 11h rompe UX crítica.
2. **`motor.ts:157` pasa `undefined` como ventana + `regla.canal`** (alcance recortado CEO IDC): mantiene el default hardcodeado para la ventana, pero como EMAIL/IN_APP se saltan categóricamente, el valor de ventana es irrelevante para ellos. Leer el parámetro de BD en el emisor (para canales futuros) es **deuda diferida** a un SPEC de seguimiento — documentada en tasks.md. Esto evita convertir la ruta de programación en async solo por leer config, sin bloquear el fix urgente.
3. **`procesar-lote.ts:89` pasa `notificacion.canal`**: ese callsite ya lee `config.quietHours` de BD correctamente; solo suma el canal.

## Project Structure

```text
src/lib/notificaciones/quiet-hours.ts        # MODIFICADO — + param canal + CANALES_SIN_QUIET_HOURS + skip
src/lib/notificaciones/quiet-hours.test.ts   # MODIFICADO — casos EMAIL/IN_APP/PUSH-hipotético/sin-canal/desconocido
src/lib/notificaciones/motor.ts              # MODIFICADO — línea 157: pasar (conOffset, undefined, regla.canal)
src/lib/notificaciones/procesar-lote.ts      # MODIFICADO — línea 89: pasar notificacion.canal
src/lib/notificaciones/procesar-lote.test.ts # MODIFICADO — EMAIL/IN_APP en ventana se procesan (no diferidas)
specs/312-quiet-hours-skip-email/            # spec.md · plan.md · tasks.md · checklists/
```
