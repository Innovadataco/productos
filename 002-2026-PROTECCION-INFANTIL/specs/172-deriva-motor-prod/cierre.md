# Cierre: SPEC-172 — Pilar D.5 · Deriva del motor en producción

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-nocturno-20260817` · **Compuerta §4**: APROBADA por ZEUS con decisiones (opción A tabla snapshot; fórmula exacta; rotulado "tasa de corrección sobre lo revisado").

## Qué se implementó

1. **Servicio de deriva** (`src/lib/motor/deriva.ts`): por categoría y semana — total de clasificaciones de producción (`ClasificacionIA`), correcciones humanas **confirmadas** (`CorreccionAdmin`, `categoriaOriginal`), tasa, baseline del banco (última `SimulacionRun` COMPLETADA; accuracy por categoría = `metricasJson.porCategoria[cat].recall`, formato verificado en fuente), y la fórmula EXACTA de ZEUS con test: `brechaPp = (tasaCorreccion − (1 − accuracyBanco)) × 100`.
2. **Snapshot persistido** (opción A, decisión ZEUS): tabla `DerivaMotorSnapshot` con upsert por `(semanaInicio, categoria)` — el tablero solo lee, sin groupBys por carga. `alertada` solo si brecha > umbral Y muestra suficiente (`min_muestra`).
3. **Cron semanal**: `motor-deriva-semanal` en el worker (`boss.schedule`, `"0 7 * * 1"`, tz America/Bogota) → calcula la semana anterior (lunes-domingo Bogotá) y envía email si hay alertadas (o si `motor.deriva.email.siempre`).
4. **Email `deriva-alta`**: tabla categoria/total/correcciones/tasa%/banco%/brecha pp + enlace a Simulación. Sin textos de reportes ni personas.
5. **Endpoints**: `GET /api/admin/motor/deriva` (último snapshot + metadatos de baseline con aviso >30 días) y `POST /api/admin/motor/deriva/recalcular` (auditado `MOTOR_DERIVA_RECALCULO`).
6. **UI**: `/dashboard/admin/estadisticas/motor` con el bloque "Deriva prod" (tabla por categoría, semáforo verde/ámbar/rojo + "muestra insuficiente"/"sin baseline", banners de baseline, CTA a Simulación, botón "Recalcular ahora") y rotulado del CEO: "tasa de corrección sobre lo revisado, no error absoluto".
7. **ConfigPanel**: sección "Motor › Deriva" con los 6 parámetros.

## Migración

`20260818020000_spec_172_deriva_motor` — **ADITIVA**: `CREATE TABLE DerivaMotorSnapshot` + 2 índices + `ALTER TYPE AccionAudit ADD VALUE 'MOTOR_DERIVA_RECALCULO'`. Sin DROP, sin tocar índices existentes (I-53). Aplicada en dev y test.

## Evidencia

- `src/lib/motor/deriva.test.ts`: fórmula exacta (total=10, correcciones=2, recall=0.9 → brecha ≈10 pp) · solo confirmadas · min_muestra excluye alerta · sin baseline → nulls · upsert idempotente · bordes de semana Bogotá (lunes 00:00, domingo 23:30, cruce de mes).
- Endpoints: 401/403, shape, sin PII, persistencia + audit del recalcular, idempotencia.
- UI: `DerivaProdBloque.test.tsx` 5/5 (semáforos, banners, recalcular, rotulado candado).
- `arch:check` 5/5 (DerivaMotorSnapshot declarado huérfano por diseño — tabla de agregados).
- Gate completo anexo en el PR.

## Decisiones / notas

- El POST recalcular NO se bloquea por `motor.deriva.enabled` (ese flag gobierna el cron; el recálculo manual es acción admin explícita).
- `brechaPp` se persiste sin redondear (fórmula cruda); el email/UI formatean a 1 decimal.
- Categorías que desaparecen de la ventana entre recálculos de la misma semana dejan su fila del cálculo anterior (upsert solo toca categorías con actividad) — comportamiento aceptado del brief.
- Página sin item de menú en esta fase (acceso por URL desde el área de estadísticas); se puede registrar en un futuro subnav del tablero gerencial.

## Smoke manual pendiente (CEO tras deploy)

- Deriva calculada con datos reales + email de prueba (cubierto por tests; el cron lunes 07:00 corre solo).
