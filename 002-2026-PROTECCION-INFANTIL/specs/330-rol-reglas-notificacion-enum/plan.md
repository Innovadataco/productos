# Implementation Plan: SPEC-330 · rol de reglas de notificación = enum (padre)

**Branch**: `work/pi-SPEC-330-rol-reglas-notificacion-enum` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)
**Radicado**: 002-PI-230 · cierra I-221 (parte padre)

## Summary

Cambio de vocabulario, sin cambio de esquema. (1) El seed pasa a sembrar las reglas del padre con `rol: "PARENT"` en vez de `"PADRE"`. (2) Una migración de datos idempotente (`UPDATE ... WHERE rol='PADRE'`) corrige las filas ya existentes en prod, porque la identidad de la regla NO incluye `rol` y el re-seed por sí solo no las tocaría de forma fiable. (3) Tests que reproducen la visibilidad del toggle del padre (candado 26).

## Technical Context

**Language**: TypeScript 5 (strict), Prisma 5.22 + PostgreSQL 16. **Storage**: `notificacion_reglas` (`@@map`), columna `rol String`. **Testing**: Vitest — unidad sobre `obtenerPreferenciasUsuario`/`actualizarPreferencia` con reglas sembradas por helper. **Scope**: `prisma/seed.ts` (15 filas del padre) + 1 migración de datos + tests. Sin tocar `motor.ts`, plantillas, ni la identidad de la regla.

## Constitution Check

- Sin cambio de esquema (rol ya es String). ✅
- No se toca el motor de notificaciones/plantillas ni la identidad de la regla (fence del instructivo, candado 17). ✅
- Migración aditiva, idempotente, sin borrar. ✅
- `"RECTOR_COLEGIO"` y la colisión multi-rol quedan intactos (hallazgo diferido). ✅

**Sin violaciones.**

## Filas del padre a renombrar (candado 22v5 — verificadas por grep, no por conteo)

`prisma/seed.ts`, bloque `reglasSeed` (3338–3381). Las 15 filas con `rol: "PADRE"`:
3342, 3343 (`suscripcion.por_vencer`) · 3347, 3348 (`suscripcion.en_gracia`) · 3352, 3353 (`suscripcion.cortada`) · 3355, 3356 (`reporte.circulo_confianza.aparece_menor`) · 3358, 3359 (`reporte.resuelto`) · 3372, 3373 (`referido.registrado`) · 3376, 3377 (`referido.recompensa.otorgada`) · 3379 (`referido.tope_anual` EMAIL — se renombra igual, aunque la colisión con ADMIN la pise: consistencia del seed).
**NO se tocan** las 11 filas `rol: "RECTOR_COLEGIO"` ni ninguna otra (`ADMIN`, `OPERADOR`, `COMITE_*`, `SCHOOL_ADMIN`).

## Consumidores de `notificacionRegla.rol` (candado 22v5 — ninguno espera el string viejo)

- `src/lib/notificaciones/preferencias.ts:37` — `reglas.filter(r => r.rol === rol)`, `rol = user.rol` (enum). **El bug.** Se arregla al alinear el seed.
- `src/lib/notificaciones/preferencias.ts:104` — `findByEventoRolCanal(evento, user.rol, canal)` (guardado del toggle). Mismo enum. Se arregla igual.
- `src/lib/dal/repositories/notificacion-regla.ts:53` (orderBy rol), `:90` (`findByEventoRolCanal`, where evento/rol/canal). Neutrales al valor.
- `src/lib/notificaciones/admin-service.ts:214` · `src/lib/dal/services/notificacion-admin.ts:284` — `rol: r.rol` pass-through al DTO del panel admin (muestra el valor; tras el fix muestra `PARENT`, correcto).
- `src/lib/notificaciones/motor.ts` — **no usa `.rol`** (dispara por evento). Intacto.

## Migración de datos

Nueva carpeta `prisma/migrations/<ts>_spec_330_rol_notificacion_parent/migration.sql`:
```sql
UPDATE "notificacion_reglas" SET rol = 'PARENT' WHERE rol = 'PADRE';
```
Idempotente (2ª corrida = 0 filas). Sin borrar. El CI valida el set combinado.

## Tests (candado 24 v2)

- `preferencias` unidad: sembrar reglas del padre (helper), `obtenerPreferenciasUsuario(id, "PARENT")` devuelve grupos de `reporte.resuelto` + `suscripcion.*`; con el valor viejo (`"PADRE"`) devuelve vacío (reproduce el bug antes del fix).
- `actualizarPreferencia(id, "PARENT", "reporte.resuelto.email", false)` → `{ ok: true }` (deja de dar `regla_inexistente`).
- Aserción de que el motor sigue disparando por evento no se re-testea (no se toca); se documenta.

## Verificación

`tsc·lint·tokens:check·arch:check·locks:check·ratchets:check` + `specs-discipline.test.ts` local antes de pushear. Post-push `gh pr view --json files` (candado I-101 v3): seed + migración + tests, cero fuera de scope.
