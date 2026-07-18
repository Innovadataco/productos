# Reporte de cierre — Spec 021: Reporte anónimo con sesión interna abierta

> Fecha de cierre: 2026-07-18.
> Rama: `feature/001-scaffolding`.

## Problema

Un usuario interno (ADMIN/OPERADOR/SCHOOL_ADMIN) logueado no podía enviar un reporte desde `/reportar`; el backend respondía 403.

## Causa raíz confirmada

- `POST /api/reportes` rechazaba cualquier usuario cuyo rol no fuera `PARENT`.
- `ReporteWizard` envía `credentials: "include"`, por lo que la cookie interna llegaba al backend.
- El reporte anónimo puro (sin sesión) funcionaba correctamente.

## Decisión del owner

**Opción B**: bloquear explícitamente en el frontend con mensaje claro, manteniendo el 403 en el backend como salvaguarda. Se descartó la Opción A por riesgo de conflicto de intereses en una plataforma de protección infantil.

## Archivos tocados

- `src/components/modules/ReporteWizard.tsx` (modificado):
  - Detecta sesión con `GET /api/me`.
  - Muestra bloqueo para roles `ADMIN`, `OPERADOR`, `SCHOOL_ADMIN`.
  - Botón "Cerrar sesión y reportar" que llama `POST /api/auth/logout` y recarga.
- `src/components/modules/ReporteWizard.test.tsx` (nuevo):
  - Verifica bloqueo para ADMIN/OPERADOR/SCHOOL_ADMIN.
  - Verifica que PARENT y anónimo puro no ven el bloqueo.
- `src/app/api/reportes/route.ts`: sin cambios; mantiene el rechazo a roles no-PARENT.

## Reutilización

- Se reutilizó el endpoint `/api/me` existente y `/api/auth/logout` existente.
- Se reutilizó el componente `Button` del design system.

## R7

No aplica: no toca el pipeline de clasificación.

## Verificaciones

- `npm run lint`: ✅ (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅
- `npm test -- --run`: ✅ 260 tests pasaron.
- `npx tsx scripts/smoke-e2e.ts`: ✅

## Comportamiento verificado

- Anónimo puro (sin sesión): accede al wizard normalmente.
- PARENT logueado: accede al wizard normalmente.
- ADMIN/OPERADOR/SCHOOL_ADMIN logueado: ve mensaje de bloqueo y botón de cerrar sesión.
- API directa con rol interno: sigue devolviendo 403 (backend intacto).

## Estado final

Spec 021 cerrada y desplegada en `:5005`.
