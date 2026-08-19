# Implementation Plan: SPEC-180 — Fixes visuales del admin

**Branch**: `work/002-pi-077` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

---

## Summary

Cuatro fixes de UI verificados en fuente: (1) eliminar el nav interno duplicado del tablero operativo; (2) `bg-accent` a secas (clase inexistente → tab activo invisible) reemplazada por `bg-pino` en los 2 sub-navs restantes; (3) retirar "Monitoreo worker" del menú admin con redirect a operación; (4) bloque explicativo del propósito en la página Dataset.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 16 + Tailwind 3.4 + Vitest |
| **Cambios** | Solo UI (componentes, clases, nav-items); cero endpoints/modelo/permisos |

---

## Estado actual (verificado en fuente)

- `OperacionTableroClient.tsx` renderizaba su propio `<nav>` con TABS (Operación/Clasificación) además del sub-nav de página (SPEC-179) → doble fila.
- `bg-accent` a secas: `accent` en `tailwind.config.ts` es objeto de sombras (50-700); la clase sin número no existe → fondo transparente + `text-white` = invisible. 3 ocurrencias: `ComiteSubNav.tsx:30`, `OperadoresSubNav.tsx:31`, `OperacionTableroClient.tsx:111` (esta última desaparece con el nav interno).
- `ADMIN_NAV_ITEMS` incluía "Monitoreo worker" (módulo `monitoreo_worker`); la página redundante con el tablero de SPEC-171 (6 semáforos incluyen worker + BD).
- Dataset: copy de una línea sin explicar origen ni uso.

## Cambios

1. **OperacionTableroClient**: fuera el `<nav>` interno y `cambiarTab`; conserva lectura de `?tab=` (la navegación es del sub-nav vía `<Link>`). Test actualizado: ya no hay botones de tab internos.
2. **ComiteSubNav + OperadoresSubNav**: `bg-accent text-white shadow` → `bg-pino text-white shadow`.
3. **nav-items.ts**: fuera el item Monitoreo worker; `monitoreo/worker/page.tsx` → `redirect("/dashboard/admin/estadisticas/operacion")`; `monitoreo_worker` a `SIN_PANTALLA_PROPIA` en nav-items.test.ts. `/api/health/worker` intacto.
4. **Dataset**: bloque "¿Qué es esto y para qué sirve?" en criollo.
5. Regenerar `docs/architecture/` + arch:check + gate completo.

## Verificación

tsc · eslint --no-cache · arch:check (aserción B sin el href retirado) · tokens (sin subir del piso) · unit · integration · journeys · build · arranque.
