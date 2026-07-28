# Data Model — SPEC-109

**Date**: 2026-07-28 · Cambio: eliminación de una tabla (vacía) y su enum.

## Eliminado (migración `NNN_eliminar_apelaciones`)

```sql
DROP TABLE "ApelacionIdentificador";
DROP TYPE "EstadoApelacion";
```

- **Justificación de la excepción a "migraciones aditivas"**: tabla con 0 filas en
  producción (PASO 0, verificado 2026-07-28). Nada que perder.
- **Re-verificación previa a prod**: si `COUNT(*) > 0` al aplicar, PARAR y reportar a ZEUS.

## Relaciones retiradas del schema

- `Usuario.apelaciones`, `Usuario.apelacionesAsignadas` (relation "ApelacionesOperador").
- `IdentificadorReportado.apelaciones`.
- Campos del modelo asociados a la verificación SMS (`smsCodigoHash`, `smsVerificado`,
  `smsIntentos`).

## No tocado

- `IdentificadorReportado.esVisiblePublicamente` y `actualizarVisibilidadPublica`
  (`src/lib/visibility.ts`): dueño único del flag tras la eliminación.
- Parámetros eliminados del seed: `anti_abuso.apelacion_pausa_dias`,
  `ratelimit.apelacion.window_seconds`, `ratelimit.apelacion.max_requests`.
- Módulo de permisos `apelaciones` (catálogo + backfill del seed).
