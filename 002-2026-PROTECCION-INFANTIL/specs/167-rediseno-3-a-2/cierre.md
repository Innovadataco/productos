# Cierre: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas

**Estado**: IMPLEMENTADO  
**Fecha de cierre**: 2026-08-12  
**Rama de trabajo**: `work/002-pi-062`  
**PR**: pendiente → `feature/001-scaffolding`

---

## Resumen

Se consolidaron las tres pantallas del módulo Colegio en dos: `/dashboard/colegio` es ahora el radar operativo del rector (semáforo héroe, alertas pendientes, KPIs, anillos de protección, cursos destacados y acciones rápidas) y `/dashboard/colegio/estadisticas` es la inteligencia del colegio (tendencias, desglose por curso, patrones institucionales, comparativa, reloj 24 h y conteo de profesores). `/dashboard/colegio/tablero` se eliminó y sus componentes útiles se reubicaron.

---

## Cambios integrados

### Backend

- `src/lib/colegio/inteligencia.ts`: agregados de inteligencia del colegio (KPIs, cursos destacados, semáforo) reutilizando predicados tenant-first.
- `src/lib/dal/repositories/colegio-resumen.ts`: enriquecido con métricas de profesores y cursores para la nueva home.
- `src/app/api/colegio/estadisticas/route.ts` y su test ajustados a los nuevos datos expuestos.
- `src/lib/email.ts`: ajuste menor de copy.

### Frontend

- `src/app/dashboard/colegio/estadisticas/page.tsx` y `ColegioEstadisticasPageClient.tsx`: nueva inteligencia del colegio.
- `src/components/modules/colegio/estadisticas/SeccionComparativa.tsx`, `SeccionPatrones.tsx`, `TablaDesgloseCursos.tsx`.
- `src/components/modules/colegio/estadisticas/BarrasPorCurso.tsx`, `RelojActividad.tsx`, `RitmoMensual.tsx` (reubicados desde `tablero/`).
- `src/components/modules/colegio/home/EmbudoEstado.tsx` (reubicado desde `tablero/`) integrado en `HomeRectorPage.tsx`.
- `src/app/dashboard/colegio/tablero/page.tsx`: redirige a Inicio; `TableroClient.tsx` eliminado.
- `src/components/modules/colegio/ColegioSideNav.tsx` y `src/lib/nav-items.ts`: navegación actualizada a 2 pantallas.

### Arquitectura

- `docs/architecture/02-roles-capacidades.md` regenerado (`npm run arch:check` verde).

---

## Gate de calidad

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores, warnings preexistentes) |
| `npm run test` | ✅ |
| `npm run tokens:check` | ✅ |
| `npm run arch:check` | ✅ |
| `npm run build` | ✅ |

---

## Notas

- No se tocó `src/lib/ai/**`.
- No se modificó el modelo de datos de `Curso`, `Estudiante` ni `Estudiante.cursoId`; el cambio es puramente de presentación y reubicación de componentes.
