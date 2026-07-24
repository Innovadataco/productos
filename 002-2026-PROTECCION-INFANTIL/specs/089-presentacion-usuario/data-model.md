# Data Model — 089-presentacion-usuario

> **Sin migraciones de schema.** Solo un parámetro nuevo (seed) y cambios de mapeo/presentación.

## Parámetro nuevo

| Clave | Valor | Notas |
|---|---|---|
| `visibility.actividad_alta_min` | 5 | Reportes mínimos para la señal "Actividad alta de reportes" en consulta y seguimiento (describe datos, no riesgo) |

## Predicado único (sin tabla)

`esReporteAprobado` / `whereReporteAprobado` (`src/lib/reporte-aprobado.ts`):
`estado ∈ {CLASIFICADO, CORREGIDO}` ∧ `ClasificacionIA.categoria ∉ {SPAM, OTRO}` ∧ `eliminado = false`.
Consumidores: `api/consulta`, `lib/scoring.calcularScore`, `api/estadisticas-publicas`.

## Campos usados (existentes)

- `ClasificacionIA.categoriasSecundarias` (Json): multi-conducta mostrada al usuario ordenada por gravedad (ya persistida por el motor; antes descartada en pantalla).
- `Reporte.ciudadRel.departamento`: ubicación autenticada (país/departamento/ciudad); anónimo = rollup por `Reporte.pais`.

## Respuestas públicas (contratos en contracts/)

- `/api/consulta`: sin `nivelRiesgo`/score; con `actividad`, `categorias`, `ubicaciones` (país | depto-ciudad según sesión), detalle solo autenticado.
- `/api/estadisticas-publicas`: sin distribución `porNivelRiesgo`; conteos con predicado.
- `/api/reportes/seguimiento/[numero]`: sin `ranking.score`/`ranking.nivelRiesgo`; con `actividad` y `categoriasSecundarias`.
