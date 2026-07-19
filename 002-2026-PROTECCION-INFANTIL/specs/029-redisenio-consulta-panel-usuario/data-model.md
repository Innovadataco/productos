# Data Model 029 · Rediseño de consulta pública + panel usuario

**Date**: 2026-07-18
**Feature**: specs/029-redisenio-consulta-panel-usuario/spec.md

---

## Active Entities (ya existentes, se reutilizan)

### `Reporte`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id` |
| `identificador` | String | Clave de búsqueda pública |
| `plataformaId` | String | FK → `Plataforma` |
| `otraPlataforma` | String? | Nombre libre si plataforma = "otro" |
| `estado` | Enum `EstadoReporte` | Solo `CLASIFICADO`/`CORREGIDO` son visibles en consulta pública |
| `esAnonimo` | Boolean | |
| `ciudad` | String | Ciudad aproximada del incidente |
| `pais` | String | País aproximado del incidente |
| `ciudadId` | String? | FK → `Ciudad` (para lat/lng aproximado) |
| `paisId` | String? | FK → `Pais` |
| `creadoEn` | DateTime | Fecha del reporte |
| `usuarioId` | String? | FK → `Usuario`. **Nunca se expone en consulta pública/autenticada** |
| `eliminado` | Boolean | Reportes eliminados se excluyen |

### `ClasificacionIA`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id` |
| `reporteId` | String | `@unique`, FK → `Reporte` |
| `categoria` | Enum `CategoriaConducta` | Categoría principal de la IA |
| `confianza` | Float | 0-1, confianza del clasificador |
| `contienePii` | Boolean | No se expone |
| `piiDetectada` | String[] | No se expone |
| `modeloUsado` | String | No se expone |
| `categoriasSecundarias` | Json? | No se expone |
| `votos` | Json? | No se expone |

### `Plataforma`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id` |
| `clave` | String | `@unique` (discord, whatsapp, otro, ...) |
| `nombre` | String | Nombre a mostrar |
| `categoria` | String | Categoría de la plataforma |

### `Ciudad`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id` |
| `nombre` | String | |
| `paisId` | String | FK → `Pais` |
| `lat` | Float? | Coordenada aproximada de la ciudad (para el mapa) |
| `lng` | Float? | Coordenada aproximada de la ciudad (para el mapa) |

### `Pais`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id` |
| `codigo` | String | `@unique` |
| `nombre` | String | |

### `ParametroSistema` (nuevos parámetros, no nueva tabla)

| Clave | Tipo | Categoría | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `risk.umbral_medio` | INTEGER | SECURITY | 50 | Score a partir del cual el nivel de riesgo es MEDIO |
| `risk.umbral_alto` | INTEGER | SECURITY | 75 | Score a partir del cual el nivel de riesgo es ALTO |
| `risk.min_reportes_alto` | INTEGER | SECURITY | 3 | Mínimo de reportes para que el nivel pueda ser ALTO |
| `risk.peso_confianza` | INTEGER | SECURITY | 50 | Peso de la confianza promedio en el score de riesgo |
| `risk.peso_cantidad` | INTEGER | SECURITY | 30 | Peso de la cantidad de reportes en el score de riesgo |
| `risk.peso_gravedad` | INTEGER | SECURITY | 20 | Peso de la gravedad de la categoría principal |

**Nota**: Estos parámetros se crearán por defecto en el helper si no existen, para no depender de una migración/seed. El seed se actualizará opcionalmente para que existan en BD.

---

## Entity Relationships (sin cambios)

```
Reporte ||--o| ClasificacionIA : "tiene"
Reporte }|--|| Plataforma : "pertenece a"
Reporte }|--|| Ciudad : "ciudad aproximada"
Reporte }|--|| Pais : "país aproximado"
Reporte }|--o| Usuario : "reportado por (no expuesto)"
```

---

## Datos que NUNCA se exponen (privacidad)

- `Reporte.texto` y `Reporte.textoOriginal`.
- `Reporte.usuarioId` y cualquier dato del denunciante.
- Coordenadas exactas de un domicilio; solo `Ciudad.lat/lng` (aproximado).
- Datos de fuente (`FuenteReporte`) y PII (`ClasificacionIA.piiDetectada`).

---

## Indexes relevantes (ya existentes)

| Table | Fields | Reason |
|-------|--------|--------|
| `Reporte` | `[identificador, plataformaId]` | Búsqueda de consulta |
| `Reporte` | `[estado]` | Filtrar visibles |
| `Reporte` | `[eliminado]` | Excluir dados de baja |
| `ClasificacionIA` | `[reporteId]` | Lookup por reporte |
| `Plataforma` | `[clave]` | Lookup por clave |
| `Ciudad` | `[nombre, paisId]` | Lookup por ciudad/país |
