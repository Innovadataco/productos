# Plan: SPEC-155 — Timeline "Ver proceso"

## Enfoque

Servicio que une `TransicionReporte` y `ReintentoReporte` por `reporteId`, los ordena cronológicamente y expone una lista normalizada para ADMIN. UI como pestaña en el expediente del reporte.

## Decisiones

- Solo ADMIN puede ver este timeline (jerga interna).
- No se expone nombre de responsable ni texto de reporte.
- Se reutiliza la página de expediente si existe; si no, se crea `/dashboard/admin/reportes/[id]/proceso`.

## Fases

1. Servicio `src/lib/reportes/timeline-proceso.ts`.
2. Endpoint `src/app/api/admin/reportes/[id]/proceso/route.ts`.
3. UI `/dashboard/admin/reportes/[id]/proceso/page.tsx`.
4. Tests de integración.
5. Regenerar arquitectura.
6. Cierre y README.
