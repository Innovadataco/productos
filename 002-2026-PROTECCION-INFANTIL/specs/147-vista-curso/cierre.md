# Cierre: SPEC-147 — Vista de curso (escritorio del curso)

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 (lote D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `acec9c14` repos DAL · `06df8a20` componentes ·
  `88bdcaa0` página + reemplazo.
- Checks de día (exit 0): `tsc` · `lint` · `tokens:check` (**1122**, baja de 1135:
  el cliente viejo borrado tenía 13 crudos) · `arch:check` VERDE · `build`.
- Tests nuevos (31): 6 repo + 25 componentes. Área: 34 archivos / 270 tests verdes
  (endpoints intactos, journeys colegio verdes).

## Qué se entregó (FR → evidencia)

- FR-001/002: `cursos/[id]` reemplazada por el escritorio §5.5 — server component,
  UNA llamada `cursoDetalle(colegioId, cursoId)` (Promise.all, 404 si ajeno),
  `CursoDetallePageClient` eliminado conservando TODAS las capacidades (edición con
  titular same-tenant, agregar con acudiente, toggle estado).
- FR-003: `AcudienteContacto` — `tel:`/`mailto:` clicables solo si el dato existe
  (test por caso: solo tel, solo email, ambos, ninguno) y badge ámbar "sin
  contactos"; segundo acudiente visible; acudiente solo vía include (D1), jamás en
  audit/logs.
- FR-004: tabla con `ui/Tabla` + buscador con debounce + empty state.
- FR-005: titular inactivo visible "· inactivo" (COND-2 de SPEC-145); test negativo
  cross-tenant en la asignación.
- FR-006: cobertura del curso exacta (fixture 70%/50%), alertas 30d con métrica D2
  y delta, conteo de invocaciones sin N+1, A/B tenant.

## Desviaciones y hallazgos

1. **Flake fecha-dependiente preexistente en `colegio-resumen.test.ts`** (escrito en
   SPEC-143, este mismo lote): el assert `ultimosDosBuckets == 2` hardcodeado falla
   en fin de semana (el reporte de 10d entra al penúltimo bucket). Corregido por
   ODIN con frontera `date_trunc('week')` calculada en el test (commit `eb4c2107`,
   intención preservada, patrón m1/m2). Verificado: también fallaba en HEAD
   pristino antes del fix.
2. El listado del curso muestra solo estudiantes ACTIVOS (comportamiento exacto del
   endpoint/DAL existente); el "ver inactivos con filtro" quedó fuera — el backend
   no lo soporta aún.
3. Entorno: el contenedor de la BD estaba apagado; se levantó para los tests.

## Deuda técnica

- Filtro "ver estudiantes inactivos" pendiente de soporte en el endpoint.
- `alumnos/[id]` (ficha) sigue siendo la pantalla vieja — candidata a una spec
  futura de ficha de estudiante con acudientes editables.
