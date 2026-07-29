# PLAN — SPEC-122 (bloque R4): capa de datos de reportes

## Método (aditivo estricto)

1. Enumerar con grep las copias manuales de `eliminado: false` y sus formas reales.
2. Crear la capa central SIN tocar rutas (commit propio) + test de equivalencia.
3. Migrar ruta por ruta, test verde y commit por zona. Prioridad: públicas → padre → admin.
4. Si la equivalencia falla en cualquier punto, PARAR.

## Formas manuales encontradas (grep `eliminado: false` en `src`, excl. tests)

- **Forma A**: `{ ...filtros, eliminado: false }` → `whereReporteVigente(extra)`
- **Forma B**: `{ estado: "REVISION_MANUAL", ...filtros, eliminado: false }` → `whereReporteEnEstado(estado, extra)`
- **Forma C**: `{ eliminado: false, estado: "REQUIERE_ANONIMIZACION" }` → `whereReporteEnEstado(estado)`
- **Forma D**: `{ ...filtros, estado: { in: [...] }, eliminado: false }` → `whereReporteEnEstados(estados, extra)`
- **Forma E (dinámica)**: `where.eliminado = false` condicional → inicializar con `whereReporteVigente()`
- **Forma F (anidada)**: filtro de relación `reporte: { ... , eliminado: false }` → mismo predicado como valor de relación
- **Canónica**: `whereReporteAprobado` (estado + categoría + vigencia) → reexportada, NO duplicada

## Enumeración copia por copia y destino

### `src/app/api/**` — alcance de este bloque (31 ocurrencias)

| # | Archivo:línea | Forma | Destino |
|---|---------------|-------|---------|
| 1 | `estadisticas-publicas/route.ts:45` | F (anidada, estados aprobados SIN filtro de categoría — deliberado) | ✅ `whereReporteEnEstados(ESTADOS_APROBADOS)` (`62e0fe48`) |
| 2 | `consulta/detalle/route.ts:75` | D (ESTADOS_VISIBLES, sin categoría — deliberado) | ✅ `whereReporteEnEstados(ESTADOS_VISIBLES, { identificador })` (`62e0fe48`) |
| 3 | `reportes/mis-reportes/route.ts:39` | A (`usuarioId`) | ✅ `whereReporteVigente` (`eb786ccf`) |
| 4-15 | `admin/estadisticas/route.ts:80,81,84,85,86,87,88,89,93,100,105` | A / F (counts, groupBy, anidados `reporte:` y `clasificacion.reporte:`) | ✅ `whereReporteVigente` (`f0b8452a`) |
| 16 | `admin/estadisticas/route.ts:82` | D (`REVISION_MANUAL`,`PROCESANDO`) | ✅ `whereReporteEnEstados` (`f0b8452a`) |
| 17 | `admin/estadisticas/route.ts:83` | C | ✅ `whereReporteEnEstado("REQUIERE_ANONIMIZACION")` (`f0b8452a`) |
| 18-20 | `admin/estadisticas/clasificacion/route.ts:71,74,83` | B (operadorId null / not null / prioridadAlta) | ✅ `whereReporteEnEstado` (`f0b8452a`) |
| 21-22 | `admin/operadores/route.ts:61,68` | B / A (por operador) | ✅ `whereReporteEnEstado` / `whereReporteVigente` (`9dc3974a`) |
| 23-24 | `admin/operadores/asignacion/route.ts:27,39` | B (sin asignar / distribución) | ✅ `whereReporteEnEstado` (`9dc3974a`) |
| 25 | `admin/reportes-revision/[id]/reasignar/route.ts:82` | B (cupo del operador) | ✅ `whereReporteEnEstado` (`9dc3974a`) |
| 26 | `admin/padres/route.ts:72` | A (`usuarioId in ids`) | ✅ `whereReporteVigente` (`9dc3974a`) |
| 27 | `admin/spam/pendientes/route.ts:38` | A + OR | ✅ `whereReporteVigente({ OR })` (`476a9e01`) |
| 28 | `admin/reportes-revision/route.ts:46` | E (condicional `incluirEliminados`) | ✅ `incluirEliminados ? {} : whereReporteVigente()` (`476a9e01`) |
| 29 | `admin/comite/apelaciones/[id]/resolver/route.ts:118` | A (id in + identificador + plataformaId) | ✅ `whereReporteVigente` (`476a9e01`) |
| 30-32 | `reportes/procesar/helpers/rafagas.ts:23,39,48` | A | ⏸ DIFERIDO: helper del motor de procesamiento (regla "no tocar el motor") |

Nota: las rutas públicas sin filtro de reportes (`consulta`, `seguimiento`, `plataformas`,
`paises/departamentos/ciudades`, `health`) no tenían copia manual del predicado;
`seguimiento` y `mis-reportes/[id]` usan la forma "fetch + check `reporte.eliminado`",
que no es un where y queda como está.

### `src/lib/**` — FUERA del alcance de este bloque (otros frentes/agentes)

| # | Archivo:línea | Forma | Destino |
|---|---------------|-------|---------|
| 33 | `lib/apelaciones.ts:109` | A | Otro frente (libs de negocio) |
| 34 | `lib/reporte-lifecycle.ts:230` | A (en tx) | Otro frente |
| 35 | `lib/operadores/asignador.ts:138` | D (`REVISION_MANUAL`,`POSIBLE_SPAM`) | Otro frente |
| 36-37 | `lib/circulo-confianza.ts:28,832` | A | Otro frente |
| 38-39 | `lib/anti-abuso/fuente-reporte.ts:96,138` | A + OR / A | Otro frente |
| 40 | `lib/colegio/alertas.ts:209` | A | Otro frente |
| 41 | `lib/colegio/estadisticas.ts:102` | A | Otro frente |

No cuentan como copias: `lib/reporte-aprobado.ts:35` (la definición canónica, se
conserva) y `lib/reporte-lifecycle.ts:148,255` (`JSON.stringify` de auditoría, no
son wheres). Total de copias manuales reales medidas: 39 (8 en libs + 31 en api).

## Equivalencia (regla de parada)

Los `where` de Prisma son objetos planos: igualdad profunda ⇒ SQL idéntico.
`src/lib/reportes-acceso.test.ts` demuestra, para cada forma (A-F), que el predicado
central devuelve EXACTAMENTE la copia manual (archivo:línea citado por caso), y que
la reexportación de `whereReporteAprobado` es la misma referencia (`toBe`).
La evidencia a nivel fixtures: los tests de integración de cada ruta migrada siguen
verdes (30 tests de ruta ejecutados por zona durante la migración).

## Resultado

- Migradas: **28 de 31** copias en `src/app/api/**` (12 archivos de ruta, 5 commits de zona + 1 de la pieza central).
- Restantes en api: 3 (`rafagas.ts`, motor, diferido).
- Restantes fuera de alcance: 8 en `src/lib/**` (otros frentes).
