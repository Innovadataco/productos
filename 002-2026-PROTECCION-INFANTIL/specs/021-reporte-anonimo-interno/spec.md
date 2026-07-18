# Spec 021 — Reporte anónimo con sesión interna abierta

> Estado: **CERRADA**.
> Plan: [`plan.md`](plan.md).
> Tareas: [`tasks.md`](tasks.md).
> Reporte de cierre: [`reporte-cierre.md`](reporte-cierre.md).

## Problema

Un usuario interno (ADMIN/OPERADOR/SCHOOL_ADMIN) logueado no puede enviar un reporte desde `/reportar`. El backend devuelve 403 con el mensaje "Esta función no está disponible para usuarios internos".

## Causa raíz confirmada

- `POST /api/reportes` obtiene la cookie de sesión y rechaza cualquier usuario cuyo rol no sea `PARENT`.
- `ReporteWizard` envía siempre `credentials: "include"`, por lo que la cookie interna llega al backend.
- El reporte anónimo puro (sin sesión) funciona correctamente.

## Decisión del owner

**Opción B**: bloquear explícitamente en el frontend con un mensaje claro antes del formulario, manteniendo el 403 en el backend como salvaguarda. Motivo: evitar conflicto de intereses en una plataforma de protección infantil; un ADMIN/OPERADOR no debe poder crear reportes anónimos y luego gestionarlos/clasificarlos.

## Implementación

- Backend (`src/app/api/reportes/route.ts`): se mantiene intacto el rechazo a roles no-PARENT.
- Frontend (`src/components/modules/ReporteWizard.tsx`):
  - Detecta sesión interna llamando a `/api/me`.
  - Si el rol es ADMIN/OPERADOR/SCHOOL_ADMIN, muestra un mensaje explicativo + botón "Cerrar sesión y reportar".
  - El botón llama a `POST /api/auth/logout` y recarga la página.
- Flujo anónimo puro (sin sesión) y flujo PARENT permanecen exactamente igual.

## Restricciones

- No tocar el pipeline de clasificación.
- No tocar rate-limiting.
- El anónimo puro (sin sesión) debe seguir funcionando intacto.

## R7

No aplica: no toca el pipeline de clasificación.
