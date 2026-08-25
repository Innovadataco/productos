# Tasks — SPEC-247 · Refresh + dedup + deprecar + arch

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Refresh silencioso
- [x] Crear `BannerBienvenida`.
- [x] Crear `GET /api/pagos/suscripcion/estado`.
- [x] Agregar polling en `EsperandoAutorizacion` (10 s) y redirigir con `?bienvenida=1`.
- [x] Leer `searchParams.bienvenida` en páginas padre/colegio y pasarla a `SuscripcionVista`.
- [x] Tests de UI y API para el refresh.

## Fase 3 · Dedup reglas notif
- [x] Migración aditiva compartida con SPEC-244/245/246: `@@unique([evento, canal, plantillaClave])` + limpieza de duplicados.
- [x] Helper `upsertNotificacionRegla` en `prisma/seed.ts`.
- [x] Actualizar todas las funciones de seed que crean reglas al patrón `upsert` por clave canónica.
- [x] Test de dedup en `src/lib/notificaciones/seed-dedup.test.ts`.

## Fase 4 · Deprecar campos legacy
- [x] Comentarios `/// @deprecated · usar Suscripcion.fechaInicio/fechaFin` en `Usuario.inicioServicio` y `Usuario.finServicio`.
- [x] Grep de consumidores nuevos: ninguno en el alcance del mega-lote.

## Fase 5 · Regenerar arquitectura
- [x] Ejecutar `arch:check`.
- [x] Regenerar `docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md`, `03-pantallas.md`.
- [x] `arch:check` verde.

## Fase 6 · Validate
- [x] `npx tsc --noEmit` verde.
- [x] `npm run lint` sin errores nuevos.
- [x] `npm run tokens:check` ≤ 1083.
- [x] Tests focalizados verdes.
- [x] Commit atómico de SPEC-247.
