# Implementation Plan: SPEC-333 · identidad de regla de notificación por rol (A-63)

**Branch**: `work/pi-SPEC-333-identidad-regla-notificacion-rol` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)
**Radicado**: 002-PI-233 · A-63 · cierra I-223 · **Decisión: Opción A**

## Summary

Tres piezas acopladas: (1) `rol` entra en la identidad única de `NotificacionRegla` (Opción A) + migración schema-a-schema que des-colapsa vía re-seed; (2) el seed renombra `RECTOR_COLEGIO`→`SCHOOL_ADMIN` y upserta por la clave nueva; (3) el motor `programar` se vuelve consciente del rol del destinatario para no duplicar ni cambiar la conducta del padre. El motor de IA no se toca.

## Technical Context

**Language**: TS5 strict, Prisma 5.22 + PostgreSQL 16. **Storage**: `notificacion_reglas` (`@@map`). **Testing**: Vitest — integración (`preferencias.test.ts`, `motor.test.ts`, `email.migracion.test.ts`) contra BD de test; los tests de preferencias/motor corren local (usan `resetDatabase()` por TRUNCATE, no `prisma migrate`). **Migración**: `prisma migrate diff` schema-a-schema + hand-craft (NO `migrate dev` sobre BD compartida). El apply lo valida el CI.

## Constitution Check

- Cambio de identidad de `NotificacionRegla` documentado en «Impacto en arquitectura». ✅
- Motor de notificaciones SÍ entra (scope CEO); motor de IA (`src/lib/ai/**`) intacto. ✅
- Migración aditiva/idempotente; re-seed `update:{}`. ✅
- Conducta del padre preservada (test 24v2). ✅

## Decisión A — evidencia del seed

Cada `(evento, canal)` que colisiona apunta a UNA plantilla rol-genérica (`Hola {{nombre}}, …`). Verificado en `prisma/seed.ts` (bloque `plantillasSeed` ~3138-3269): `suscripcion.*`, `caso.asignado`, `referido.*`. Sin texto rol-específico → identidad `[evento, canal, plantillaClave, rol]` basta; los roles comparten plantilla.

## Cambios por archivo

### 1. Esquema + migración
- `prisma/schema.prisma` · `model NotificacionRegla`: `@@unique([evento, canal, plantillaClave])` → `@@unique([evento, canal, plantillaClave, rol])`.
- `prisma/migrations/<ts>_spec_333_identidad_regla_rol/migration.sql`:
  - `DROP INDEX "notificacion_reglas_evento_canal_plantillaClave_key";`
  - `CREATE UNIQUE INDEX "notificacion_reglas_evento_canal_plantillaClave_rol_key" ON "notificacion_reglas"("evento","canal","plantillaClave","rol");`
  - Datos: `UPDATE "notificacion_reglas" SET rol='SCHOOL_ADMIN' WHERE rol='RECTOR_COLEGIO';` (idempotente).
  - **El des-colapso lo completa el re-seed** en el deploy (las filas colapsadas no están en BD para recuperarlas por SQL): con el índice nuevo, el upsert por rol re-crea cada regla. Documentado en la migración.

### 2. Seed
- `prisma/seed.ts`: 11 filas `rol: "RECTOR_COLEGIO"` → `"SCHOOL_ADMIN"` (verificar por grep · candado 22v5).
- `upsertNotificacionRegla` (seed.ts:44-82): `where` pasa de `evento_canal_plantillaClave` a `evento_canal_plantillaClave_rol` (incluye `rol` en la clave compuesta). El `plantillaClave` del loop sigue `evento.canal` (compartido, Opción A).

### 3. Motor rol-aware (`src/lib/notificaciones/motor.ts`)
- `ProgramarInput.destinatarios[]`: añadir `rol?: string`.
- En `programar` (tras `findByEventoActivo`): si las reglas del evento abarcan **más de un rol distinto**, para cada destinatario computar `rolEfectivo = destinatario.rol ?? (usuarioId ? Usuario.rol : undefined)` y filtrar `reglas` a `r.rol === rolEfectivo`. Si el evento tiene un **solo** rol → aplicar todas (comportamiento idéntico al actual, cero cambio para la mayoría de eventos). Si multi-rol y `rolEfectivo` indeterminado → log + skip de ese destinatario (defensivo; no ocurre porque los callers multi-rol pasan `rol`).
- Resolver `Usuario.rol` vía `repoUsuario` (ya inyectado en el motor para `resolverEmail`).

### 4. Callers de eventos multi-rol → pasar `rol` por destinatario (candado 22v5)
- `src/lib/pagos/vigencia.service.ts` (`resolverDestinatarios`, ~L100-120): padre `{usuarioId, rol:"PARENT"}`; colegio `{usuarioId: admin.id, rol:"SCHOOL_ADMIN"}` + `{email: representanteLegalEmail, rol:"SCHOOL_ADMIN"}` (el email-only necesita el `rol` explícito).
- `src/lib/pagos/referido.service.ts` (`resolverDestinatariosTitular`, ~L75-88 + `extraDestinatarios` L306 admins): titular padre `PARENT` / colegio `SCHOOL_ADMIN`; admins `ADMIN`.
- Emisor de `caso.asignado` (comité/operador — localizar en implementación; enumerar archivo:línea) → `COMITE_VALIDACION`/`COMITE_CONVIVENCIA`/`OPERADOR` por destinatario.

## Consumidores de `NotificacionRegla` (§5 brief · candado 22v5 — a re-verificar tras el cambio)

| Consumidor | archivo:línea | Efecto del cambio de identidad |
|---|---|---|
| repo reglas | `notificacion-regla.ts` `listarActivas`:47 · `findByEventoActivo`:43 · `findByEventoRolCanal`:90 · `create`/`update` | `findByEventoRolCanal(evento,rol,canal)` sigue correcto; el upsert compuesto ahora keya con rol |
| preferencias | `preferencias.ts:36-37` (filter por rol) · `:104` (findByEventoRolCanal) | **la superficie del bug** — al des-colapsar, cada rol ve sus reglas |
| motor | `motor.ts:102` `programar` | **se vuelve rol-aware** (arriba) |
| admin CRUD | `admin-service.ts:214` · `notificacion-admin.ts:284` (`rol: r.rol`) | pass-through; sin cambio de contrato |
| digest | `analisis/digest-semanal.ts` | revisar que no keye por la identidad vieja |
| pagos | `pagos/vigencia.service.ts` | caller multi-rol (arriba) |
| rutas | `api/notificaciones/route.ts` · `api/admin/notificaciones/reglas/[id]/recalcular/route.ts` | revisar upsert/where |
| seed | `prisma/seed.ts` `upsertNotificacionRegla` | clave compuesta nueva (arriba) |

Si aparece un consumidor no listado que keye por `(evento,canal,plantillaClave)`, entra al alcance.

## Tests (candado 24 v2)

- `motor.test.ts`: (a) padre `suscripcion.por_vencer` → 1 notificación, offset `-1d`; (b) evento `+0m` multi-rol (`referido.registrado`) con destinatarios padre+colegio → **1 por destinatario, cero duplicados**; (c) rector recibe su regla `-5d`; (d) destinatario email-only con `rol` explícito filtra correcto.
- `preferencias.test.ts`: `SCHOOL_ADMIN` / `OPERADOR` / `COMITE_*` ven sus grupos tras des-colapsar.
- `email.migracion.test.ts`: verde (alcance obligatorio · MAPA §7).
- Evidencia BD (§6): conteo por `(evento,canal)` antes/después.

## Riesgos

- **Duplicados en `+0m`** si el motor no filtra por rol → mitigado por FR-005 + test (b).
- **Drop de notificaciones** si un destinatario multi-rol no trae `rol` → mitigado actualizando todos los callers multi-rol (FR-006) + fallback defensivo con log.
- Migración de índice sobre tabla con datos: el drop/create de un UNIQUE es seguro; el des-colapso depende del re-seed en deploy (documentado).

## Verificación

`tsc·lint·tokens·arch·locks·ratchets` + `specs-discipline` + tests locales (preferencias/motor corren local). Rebasar sobre main antes del PR. Post-push `gh pr view --json files` (I-101 v3).
