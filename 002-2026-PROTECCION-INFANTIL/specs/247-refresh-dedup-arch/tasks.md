# Tasks — SPEC-247 · Refresh + dedup + deprecar + arch

## Fase 1 · Specify / Plan
- [x] Escribir `spec.md`, `plan.md`, `tasks.md`.

## Fase 2 · Refresh silencioso
- [ ] Crear `BannerBienvenida`.
- [ ] Agregar polling en `EsperandoAutorizacion`.
- [ ] Disparar `router.refresh()` al detectar `ACTIVA`.

## Fase 3 · Dedup reglas notif
- [ ] Migración aditiva: `@@unique([evento, canal, plantillaClave])` + limpieza de duplicados.
- [ ] Actualizar `prisma/seed.ts` a `upsert` por clave compuesta.

## Fase 4 · Deprecar campos legacy
- [ ] Comentarios `/// @deprecated` en `Usuario.inicioServicio` y `Usuario.finServicio`.
- [ ] Grep de consumidores nuevos.

## Fase 5 · Regenerar arquitectura
- [ ] Ejecutar `arch:check`.
- [ ] Commitear delta `docs/architecture/`.

## Fase 6 · Validate
- [ ] Tests de UI y seed.
- [ ] Gate local.
