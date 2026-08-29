# Cierre — SPEC-109: Eliminar el módulo de apelación actual (D-34)

**Fecha**: 2026-07-28 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (lote del CEO).

## Lo hecho

- **Eliminados por completo**: `src/app/apelar/`, `src/app/api/apelaciones/`,
  `src/app/api/admin/apelaciones/`, `src/app/dashboard/admin/apelaciones/`,
  `src/components/modules/AdminApelaciones.tsx`, `src/lib/apelaciones.ts`,
  `src/lib/sms.ts` (verificado: solo lo usaba el test de apelaciones),
  `scripts/job-apelaciones-vencimiento.ts` (nunca estuvo programado → el ocultamiento era
  permanente), `scripts/smoke-apelaciones.ts`.
- **Referências retiradas**: entrada de menú admin (`nav-items`/`AdminNav`), ruta pública
  del proxy, scopes de rate-limit (`apelacion`, `apelacion_sms`), módulo `apelaciones` del
  catálogo de permisos (el backfill del seed lo deja de crear), rama de apelaciones del
  asignador de operadores, `puedeGestionarApelacion`, parámetros del seed
  (`anti_abuso.apelacion_pausa_dias`, `ratelimit.apelacion.*`) y líneas de los helpers de
  tests. Tests del módulo eliminados con sus rutas.
- **Modelo y migración**: schema sin `ApelacionIdentificador`, `EstadoApelacion` ni sus
  relaciones. Migración `20260728120000_eliminar_apelaciones` **con la guarda DENTRO**
  (corrección ZEUS): `DO $$ … RAISE EXCEPTION` si existe cualquier fila.
- **`actualizarVisibilidadPublica` intacto** (diff 0): dueño único del flag de visibilidad.

## Guarda verificada en rojo y en verde (corrección ZEUS 002-PI-034)

- **ROJO**: con una fila insertada, `npx prisma migrate deploy` **ABORTA** con
  `SPEC-109: hay apelaciones registradas. Abortar y avisar a ZEUS.` y la tabla queda
  INTACTA (la transacción hace rollback).
- **VERDE**: sin filas, `migrate deploy` aplica (tras `migrate resolve --rolled-back` del
  intento abortado) y la tabla/enum quedan eliminados.
- Aprendizaje registrado: `psql -f` sin transacción NO detiene el script tras el RAISE —
  la guarda depende del runner transaccional de Prisma (que es como se aplica en prod).

## Huérfanos y su destino (el inventario del plan, aplicado)

Las 16 referencias de la tabla del plan quedaron retiradas una por una. **Queda
deliberadamente** `PerfilOperador.esRevisorDeApelaciones` (campo de perfil de operador,
sin comportamiento tras la eliminación): no estaba en el alcance de la corrección y la
nota de ZEUS indica que la SPEC-110 enruta al COMITÉ y crea su propio mecanismo — su
retiro o reuso se decide ahí, no aquí.

## Gate

tsc ✅ · lint ✅ (0 errores) · **925/925 tests** ✅ · build ✅ (tras `rm -rf .next`:
el validador de tipos generado guardaba referencias a las rutas borradas) · CI GitHub a
la vista en el push.

## Notas para el despliegue (lote del CEO)

- La migración NO borra nada si aparece una fila (guarda en el SQL). Aun así, PASO 0 en
  prod hoy: 0 filas.
- El registro `PermisoModulo` de `apelaciones` en la BD de prod queda inerte (sin catálogo);
  su limpieza física puede hacerse en el lote si ZEUS lo decide.
