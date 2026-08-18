# Cierre: SPEC-176 — Cursos: ver y reactivar desactivados

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-073` · **Modo**: autónomo (cola 002-PI-073, bajo riesgo UX).

## Qué se implementó

1. **`CursoRepository.listarPorColegio(colegioId, { incluirInactivos })`** — `listarActivos` queda como wrapper (cero roturas de llamantes).
2. **`GET /api/colegio/cursos?incluirInactivos=true`** — por defecto solo activos (compatibilidad); con el flag incluye inactivos del colegio autenticado (tenant-first).
3. **UI** (`CursosPageClient.tsx`): toggle "Mostrar desactivados" (checkbox) que reconsulta con el flag; la tabla ya mostraba badge de estado y el botón "Activar" en inactivos — el faltante era que los inactivos llegaran.
4. **Hallazgo corregido**: la reactivación se auditaba como `COLEGIO_CURSO_DESACTIVADO` en ambos sentidos. Nuevo valor de enum `COLEGIO_CURSO_ACTIVADO` (migración `20260818030000_spec_176_curso_activado_audit` — **ADITIVA**, solo `ALTER TYPE ADD VALUE`; I-53 intacta) y la acción de audit ahora refleja la dirección real.

## Evidencia

- Endpoint (integration): default solo activos · con flag incluye inactivos · aislamiento por colegio (cubierto por el test preexistente de cross-tenant) · ida y vuelta desactivar→reactivar con audit correcto.
- Página (unit, 2/2): toggle cambia la URL del fetch, inactivo muestra badge + "Activar", activo muestra "Desactivar"; "Activar" hace PATCH con `"activo"` y recarga.
- Gate: tsc · eslint --no-cache · arch:check · tokens · unit 820/820 · integration (anexo en PR) · journeys 47/47 · build · arranque.

## Nota

- La página no persiste la preferencia del toggle (vuelve a solo-activos al recargar) — decisión documentada en Assumptions de la spec.
- `EstadoActivo` y los flujos de carga masiva no se tocaron.
