# Spec-Kit — Tabla de cumplimiento

> Estado general del repositorio al 2026-07-18.
> Esta tabla consolida el estado de todas las especificaciones bajo `specs/` y señala qué artefactos existen, cuáles faltan y dónde encontrar la evidencia de cierre.

## Leyenda de estados

| Estado | Significado |
|--------|-------------|
| `CERRADA` | Implementación terminada, tests verdes y reporte/documento de cierre disponible. |
| `IMPLEMENTADA` | Código entregado y funcional; la spec original ya marcaba el estado pero carecía de sección de implementación. |
| `PARCIAL` | Parte de la funcionalidad está en producción; quedan fases pendientes. |
| `APROBADA/PENDIENTE` | Aprobada para implementar pero aún no se cierra. |
| `BORRADOR` | Material de decisión, no es una spec oficial ejecutable. |

## Tabla de cumplimiento

| Código | Nombre | Estado | Artefactos presentes | Artefactos faltantes | Notas |
|--------|--------|--------|----------------------|----------------------|-------|
| `001` | Autenticación multi-rol y parámetros de configuración | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `checklists/`, `quickstart.md`, tests (`auth.test.ts`, `config/parametros/*.test.ts`, `tests/e2e/auth.spec.ts`), migraciones iniciales | Reporte de implementación propio por spec | Fundación del proyecto. Implementada en el scaffolding inicial. Se completó retroactivamente el 2026-07-18. |
| `003` | Frontend público y flujo de reporte | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `checklists/`, `quickstart.md`, tests E2E y de API de reportes/consulta | Reporte de implementación propio por spec | Incluye wizard de 4 pasos, consulta pública, “mis reportes” y seguimiento. Se completó retroactivamente el 2026-07-18. |
| `004` | Panel de administración | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `checklists/`, `research.md`, tests E2E y de API admin | Reporte de implementación propio por spec | Bandeja, corrección, anonimización y dashboard admin. Se completó retroactivamente el 2026-07-18. |
| `005` | Restablecimiento de contraseña | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `checklists/`, tests E2E (`password-reset.spec.ts`) | Reporte de implementación propio por spec | Flujo de recuperación por token único y un solo uso. Se completó retroactivamente el 2026-07-18. |
| `006` | Páginas legales y footer | `IMPLEMENTADA` | `spec.md`, `plan.md`, `tasks.md`, `checklists/` | Reporte de implementación, tests unitarios específicos | Páginas `/terminos`, `/privacidad` y `LandingFooter`. Se documentó retroactivamente el 2026-07-18. |
| `007` | Alertas por email | `IMPLEMENTADA` | `spec.md`, `plan.md`, `tasks.md`, `contracts/`, `checklists/`, tests (`email.test.ts`), migraciones de suscripción | Reporte de implementación propio por spec | Alertas a admin y suscripción de usuarios. Se documentó retroactivamente el 2026-07-18. |
| `008` | SEO y metadatos | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `checklists/`, tests E2E (`seo.spec.ts`) | `data-model.md`, reporte de implementación propio | Metadata, OpenGraph, robots, sitemap, JSON-LD. Se completó retroactivamente el 2026-07-18. |
| `009` | Dashboard público | `CERRADA` | `spec.md`, `checklists/`, tests E2E (`dashboard-publico.spec.ts`) | `plan.md`, `tasks.md`, `data-model.md`, reporte de implementación propio | Métricas públicas en `/dashboard-publico`. Se completó retroactivamente el 2026-07-18. |
| `010` | Rediseño del clasificador IA | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `checklists/`, `quickstart.md`, `research.md`, reportes (`final-report.md`, `f7-report.md`, `f6-report.md`, `evaluation-report.md`, `f4-recovery-report.md`), tests de IA y worker | Actualización de estado en `spec.md` (era `Draft`) | Fases F0.5-F7 completadas; F6 deshabilitada por defecto. Veredicto final en `final-report.md`. Se completó retroactivamente el 2026-07-18. |
| `011` | Centro de control IA | `CERRADA` | `011-spec.md`, `plan.md`, `report.md`, tests (`admin/ia/sandbox/route.test.ts`, `ollama-config.test.ts`) | `spec.md` canónico (creado como parte de esta tarea) | Sandbox, playground y documentación interactiva del pipeline IA. Se creó `spec.md` el 2026-07-18. |
| `012` | Baja/desactivación de reportes | `CERRADA` | `012-spec.md`, `IMPLEMENTATION-REPORT.md`, tests (`admin/reportes/[id]/baja/route.test.ts`, `reactivar/route.test.ts`, `reportes/procesar/route.test.ts`, `admin/estadisticas/route.test.ts`), migración `add_reporte_baja` | `spec.md` canónico (creado como parte de esta tarea), `plan.md` | Soft-delete con motivo, cascada de score/visibilidad y purga condicional de dataset. Se creó `spec.md` el 2026-07-18. |
| `013` | Administración del motor IA desde el panel | `CERRADA` | `spec.md` (completo con arquitectura, endpoints, criterios de cierre), tests de evals y modelos, migración `add_caso_eval` | `plan.md`, `tasks.md` | Modelos locales validados (R2), fixture `CasoEval`, corrida de eval en background. Cerrada el 2026-07-17. |
| `014` | Laboratorio de experimentos IA | `CERRADA` | `spec.md` (completo con flujo, endpoints, demo), tests de experimentos, migración `add_experiment_lab` | `plan.md`, `tasks.md` | Experimentos congelados comparables, baseline y activación manual. Cerrada el 2026-07-17. |
| `015` | Defensas anti-abuso | `PARCIAL` | `spec.md`, tests (`anti-abuso/fuente-reporte.test.ts`, `rate-limit.test.ts`, `api/reportes/route.test.ts`), migración `add_fuente_reporte` | Fase C (descargo/apelación) no implementada; reporte de implementación propio | Fase A (ponderación de fuente) y Fase B (rate limiting compuesto) implementadas y desactivadas por flag. Fase C pendiente. Se documentó retroactivamente el 2026-07-18. |
| `02` | Módulo de reportes comunitarios | `CERRADA` | `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `checklists/`, `quickstart.md`, `research.md`, `IMPLEMENTATION-REPORT.md`, tests de API, IA y E2E | `report.md` breve adicional (el `IMPLEMENTATION-REPORT.md` cubre el cierre) | Pipeline completo de creación, clasificación, deduplicación, visibilidad y scoring. Se completó retroactivamente el 2026-07-18. |
| `borrador-anti-abuso` | Defensas anti-abuso (borrador de decisión) | `BORRADOR` | `borrador-anti-abuso.md` | Aprobación como spec oficial, tests, migraciones | Material de análisis que evolucionó en la Spec `015`. No ejecutar sin aprobación del equipo. |

## Observaciones transversales

- **Especificaciones tempranas (`001`, `003`, `004`, `005`, `008`, `009`)** se implementaron sin documento de cierre formal. Como parte de esta tarea se les agregó una sección de implementación retroactiva en su `spec.md` correspondiente.
- **Specs `011` y `012`** usaban nombres de archivo `011-spec.md` y `012-spec.md`. Se creó un `spec.md` canónico para cada una sin eliminar los archivos originales.
- **Spec `015`** está correctamente dividida en fases; solo la Fase C queda fuera del alcance actual y requiere diseño/aprobación aparte.
- **Spec `010`** tenía el estado `Draft` a pesar de estar cerrada; se actualizó con el cierre y referencia a `final-report.md`.
