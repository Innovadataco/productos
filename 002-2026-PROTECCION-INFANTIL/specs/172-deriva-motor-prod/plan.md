# Implementation Plan: SPEC-172 — Pilar D.5 · Deriva del motor en producción

**Branch**: `work/002-pi-nocturno-20260817` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

---

## Summary

Dos fases: (1) backend — 6 parámetros `motor.deriva.*` + servicio de cálculo de deriva (semanal × categoría vs baseline del banco) + snapshot persistido + endpoints `/api/admin/motor/deriva*` + cron semanal lunes 07:00 Bogotá (patrón `boss.schedule`) + email `deriva-alta`; (2) UI — tablero `/dashboard/admin/estadisticas/motor` con bloque "Deriva prod" + sección "Motor › Deriva" en ConfigPanel.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10, Prisma 5.22.0, pg-boss (schedule), Resend |
| **Storage** | Reusa `CorreccionAdmin`, `ClasificacionIA`, `SimulacionRun` + 1 tabla aditiva de snapshot (a compuerta) |
| **Testing** | Vitest integration (servicio + endpoints) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.5 Clasifica conductas, no personas | ✅ Pass | Métricas por categoría de conducta; email sin textos ni personas |
| IA local | ✅ Pass | No se toca el motor ni la rúbrica; solo se miden sus salidas ya persistidas |
| I-49 Migraciones aditivas | ✅ Pass | A lo sumo 1 tabla nueva de snapshot; cero cambios destructivos |
| §3.5 Auditoría | ✅ Pass | Recálculo bajo demanda auditado |

---

## Estado actual (verificado en fuente)

- `CorreccionAdmin` (`schema.prisma:1424`): `clasificacionId @unique`, `categoriaOriginal`, `categoriaCorregida`, `confirmada Boolean @default(false)`, `creadoEn`.
- `SimulacionRun` (`schema.prisma:1493`): `estado` (PENDIENTE/EN_PROGRESO/COMPLETADA/FALLIDA/CANCELADA), `metricasJson Json?`, `fechaFin`.
- `ClasificacionIA` (`schema.prisma:1397`): clasificación de producción (categoría, `creadoEn`).
- Cron: patrón `boss.schedule(nombre, cron, {}, { tz: "America/Bogota" })` + `boss.work` en `scripts/worker-reportes.mjs:427-491` (ya existe `colegio-resumen-semanal` en el mismo slot lunes 07:00).
- ConfigPanel: secciones por prefijo (`config-panel/types.ts:14-24`); seed upsert de parámetros (`prisma/seed.ts:143-240`).
- Email: `src/lib/email.ts` (patrón `enviar*` texto plano con gate por parámetro).
- Endpoints admin: patrón `verifyAuth("ADMIN")` + `assertModulo(user, "estadisticas")` (`api/admin/estadisticas/route.ts:11-12`).
- Paginación estándar `{ items, pagination }`.

**Pendiente de verificar en implementación**: formato exacto de `metricasJson` (accuracy por categoría) en una `SimulacionRun` COMPLETADA real; el parser se escribe contra el formato real con test.

---

## Diseño por fase

### Fase 1 — Backend

**Parámetros (seed, upsert, `CategoriaParametro.SISTEMA`)**:

| Clave | Tipo | Default | Label criollo |
|-------|------|---------|---------------|
| `motor.deriva.enabled` | BOOLEAN | true | Medir la deriva del motor en producción |
| `motor.deriva.umbral_pp` | INTEGER | 15 | Avisar si la brecha supera estos puntos (%) |
| `motor.deriva.min_muestra` | INTEGER | 20 | Mínimo de casos semanales para medir una categoría |
| `motor.deriva.ventana_dias` | INTEGER | 7 | Días de la ventana de medición |
| `motor.deriva.email.destinatarios` | STRING | soporte@… | A quién avisar si hay deriva (separados por coma) |
| `motor.deriva.email.siempre` | BOOLEAN | false | Enviar resumen aunque no haya deriva |

**Servicio** `src/lib/motor/deriva.ts` (nuevo):
- `calcularDerivaSemanal(desde, hasta)`: por categoría — `ClasificacionIA.groupBy(categoria)` en ventana (total), `CorreccionAdmin` confirmadas unidas a su clasificación (correcciones), tasa, baseline del `metricasJson` de la última `SimulacionRun COMPLETADA` (parser defensivo: si falta la categoría en el baseline, brecha = null), brecha = tasaCorreccion − (1 − accuracyBanco) expresada en pp (o equivalente documentado: brecha entre accuracy esperada y accuracy observada = 1 − tasaCorreccion).
- Marca `muestraInsuficiente` cuando total < `min_muestra`.
- Persiste snapshot: **opción A (recomendada)** tabla `DerivaMotorSnapshot { id, semanaInicio, categoria, total, correcciones, tasaCorreccion, accuracyBanco, brechaPp, alertada, creadoEn }` + índice `(semanaInicio, categoria)` — migración aditiva mínima; **opción B** JSON en `ParametroSistema` (`motor.deriva.ultimo_snapshot`). Decisión a compuerta (ver Assumptions de spec).
- `debeAlertar(snapshot)` → lista de categorías sobre umbral.
- Email: `enviarAlertaDerivaMotor()` en `src/lib/email.ts` — tabla por categoría desviada + enlace a `/dashboard/admin/ia?tab=simulacion`; gate `motor.deriva.enabled`; sin textos ni personas.

**Cron**: en `scripts/worker-reportes.mjs`, `ensureQueue("motor-deriva-semanal")` + `boss.schedule("motor-deriva-semanal", "0 7 * * 1", {}, { tz: "America/Bogota" })` + handler que llama al servicio para la semana anterior completa (lunes-domingo) y envía email si aplica.

**Endpoints** (`verifyAuth("ADMIN")` + `assertModulo(user, "estadisticas")`):
- `GET /api/admin/motor/deriva` → último snapshot por categoría + metadatos del baseline (fecha de la simulación usada, aviso si > 30 días).
- `POST /api/admin/motor/deriva/recalcular` → recalcula la ventana móvil actual, persiste snapshot, audita (`MOTOR_DERIVA_RECALCULO`, valor nuevo de `AccionAudit` — aditivo).

### Fase 2 — UI

- `src/app/dashboard/admin/estadisticas/motor/page.tsx` (nuevo, módulo `estadisticas`): bloque "Deriva prod" — tabla por categoría (total, correcciones, tasa, accuracy banco, brecha) con semáforo por fila (verde < umbral, ámbar ≤ 1.5×, rojo > 1.5×), banner de baseline (fecha / "sin baseline — corre una simulación" / "baseline desactualizada"), CTA a Simulación, botón "Recalcular ahora" (POST recalcular).
- ConfigPanel: sección `{ key: "motor-deriva", label: "Motor › Deriva", prefixes: ["motor.deriva."] }` en `config-panel/types.ts`.
- Nav: el item "Dashboard" (`/dashboard/admin/estadisticas`) ya existe; el acceso a motor se integra como enlace/sub-tab del área estadísticas (decisión de navegación menor, sin claves nuevas; verificar aserción B al regenerar docs).

---

## Project Structure

```text
prisma/schema.prisma                                     # MOD: +DerivaMotorSnapshot (opción A) +1 AccionAudit
prisma/migrations/..._spec_172_deriva_motor/             # NUEVO (aditiva; se omite si opción B)
prisma/seed.ts                                           # MOD: +6 parámetros motor.deriva.*
src/lib/motor/deriva.ts                                  # NUEVO (servicio + parser baseline)
src/lib/email.ts                                         # MOD: +enviarAlertaDerivaMotor
scripts/worker-reportes.mjs                              # MOD: +schedule motor-deriva-semanal
src/app/api/admin/motor/deriva/route.ts                  # NUEVO (GET)
src/app/api/admin/motor/deriva/recalcular/route.ts       # NUEVO (POST, auditado)
src/app/dashboard/admin/estadisticas/motor/page.tsx      # NUEVO
src/components/modules/motor/DerivaProdBloque.tsx        # NUEVO
src/components/modules/config-panel/types.ts             # MOD: sección Motor › Deriva
tests: deriva service (integration), endpoints (integration), DerivaProdBloque (unit)
docs/architecture/                                       # REGENERAR si hay rutas/modelo nuevos
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Verificar formato real de `metricasJson` en una SimulacionRun COMPLETADA (BD de test/seed) → parser + test.
2. Seed params + (opción A: migración snapshot) + enum audit.
3. Servicio deriva + tests de integración (correcciones confirmadas, min_muestra, brecha, sin baseline).
4. Cron en worker + email + test del handler.
5. Endpoints + tests.
6. UI bloque + ConfigPanel + docs/architecture + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Formato de `metricasJson` distinto al asumido | Verificación real como tarea 1; parser defensivo con test contra fixture real |
| Semanas con bajo volumen → ruido de alertas | `min_muestra` (default 20) excluye categorías pequeñas del cálculo de alerta |
| Doble cálculo del mismo snapshot | Snapshot por `(semanaInicio, categoria)` con upsert; el tablero solo lee |
| Conflicto de slot con `colegio-resumen-semanal` (mismo cron) | Colas pg-boss distintas; handlers independientes |

---

## Decisiones para compuerta §4

1. **Snapshot**: opción A (tabla `DerivaMotorSnapshot`, aditiva, recomendada) vs opción B (JSON en `ParametroSistema`, cero tablas — literal "cero migración" del brief).
2. **Definición de brecha**: accuracy observada (1 − tasaCorreccion) vs accuracy del banco, en puntos porcentuales por categoría. Umbral default 15 pp.
3. **Navegación**: motor como página nueva bajo `estadisticas` con sub-enlace (sin módulo nuevo).
4. **Email "siempre"**: default apagado (solo alerta si hay deriva); el resumen semanal ya lo cubre otro flujo si se quiere.
