# Research: SPEC-153 — Comparativa entre cursos

## Contexto

El módulo de colegios ya cuenta con:
- `src/lib/colegio/estadisticas.ts`: calcula totales y desglose por curso.
- `src/lib/dal/repositories/curso.ts`: `listarParaEstadisticas`, `contarPorColegio`.
- `src/lib/dal/repositories/estudiante.ts`: `contarPorCursoIds`, `contarPorColegio`.
- `src/lib/dal/repositories/identificador-estudiante.ts`: `contarPorCursoIds`, `contarPorColegio`.
- `src/lib/dal/repositories/alerta-colegio.ts`: `contarVisiblesPorCursoIds`, `contarVisiblesPorColegio`.

## Opciones consideradas

### Opción A: Query SQL con GROUP BY
Generar SQL directo agrupando por `grado` o `anioLectivo` en la base de datos. Rechazada porque rompe la abstracción del DAL tenant-first y duplica lógica de conteos ya existente.

### Opción B: Agrupación en memoria desde `calcularEstadisticasColegio`
Reutilizar el servicio existente y agrupar su salida `porCurso` en memoria. **Elegida**: mantiene consistencia con estadísticas generales, respeta tenant-first y es suficiente para volúmenes escolares.

## Herramientas

- `exceljs` ya está en `dependencies` (usado para parsear cargas masivas).
- `@react-pdf/renderer` y `pdfmake` están disponibles, pero no se usan aquí.

## Patrones a seguir

- Endpoint: `src/app/api/colegio/estadisticas/route.ts` y `src/app/api/colegio/reportes/pdf/route.ts`.
- UI: `src/app/dashboard/colegio/estadisticas/ColegioEstadisticasPageClient.tsx`.
- Tenant-first: siempre filtrar por `colegioId` del usuario autenticado.
