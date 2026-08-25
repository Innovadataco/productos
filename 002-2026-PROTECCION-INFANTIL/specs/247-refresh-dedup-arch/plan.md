# Implementation Plan: Refresh silencioso + dedup reglas notif + deprecar + arch

**Branch**: `work/002-PI-mega-cobros` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-150 · BRIEF-ACTIVACION-Y-COBROS §5/§6.1/§8/§10/§11

---

## Summary

Limpieza final del brief: refresh de sesión post-autorización, dedup de reglas de notificación, marcar campos legacy como deprecated y regenerar línea base de arquitectura.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 16.2.10, Prisma 5.22.0, React 19 |
| **UI** | `BannerBienvenida` con `Alerta`/`GlassCard` (D-72), color `pino` |
| **Testing** | Vitest + Playwright |
| **Constraints** | D-51 autónomo; sin borrar campos legacy; migraciones aditivas |

---

## Implementation Steps

### Phase 1 — Refresh silencioso
1. Crear `BannerBienvenida`.
2. Agregar polling ligero en `EsperandoAutorizacion` (10s) que consulta estado de suscripción.
3. Al detectar `ACTIVA`, disparar `router.refresh()` y mostrar `BannerBienvenida`.

### Phase 2 — Dedup reglas notif
4. Migración aditiva: agregar `@@unique([evento, canal, plantillaClave])` a `NotificacionRegla`, limpiando duplicados previamente en el mismo script.
5. Actualizar `prisma/seed.ts`: convertir inserts de `notificacion_reglas` a `upsert` por clave compuesta.

### Phase 3 — Deprecar campos legacy
6. En `prisma/schema.prisma`, agregar comentarios `/// @deprecated` sobre `Usuario.inicioServicio` y `Usuario.finServicio`.
7. Grep para confirmar que ningún consumidor nuevo del brief los usa.

### Phase 4 — Regenerar arquitectura
8. Ejecutar `arch:check` (o comando registrado).
9. Commitear delta de `docs/architecture/`.

### Phase 5 — Tests y gate
10. Tests de UI de transición y seed duplicados.
11. Gate local.

---

## Test Strategy

- Unitarios: componente `BannerBienvenida`.
- Integración: seed idempotente, constraint única.
- E2E: flujo completo de pendiente a activo sin logout.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migración `@@unique` falla por duplicados | Limpiar en el mismo migration script antes del constraint. |
| Polling excesivo | Intervalo 10s y cleanup al desmontar. |
| `router.refresh()` no actualiza vigencia | Verificar con middleware SPEC-242. |
