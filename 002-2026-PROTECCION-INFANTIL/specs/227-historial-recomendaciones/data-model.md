# Modelo de datos: SPEC-227 — Historial de recomendaciones y métricas de tuning

## 1. Principios aplicados

- **Sin cambios de modelo**: SPEC-227 no crea tablas, columnas, enums ni índices. Es una capa de lectura sobre los modelos que entrega SPEC-221 en la misma rama.
- Los únicos cambios de datos son **filas de seed** (parámetros y catálogo de módulos), idempotentes por upsert — no requieren migración.

## 2. Entidades consumidas (entregadas por SPEC-221, solo lectura)

### 2.1 `Recomendacion` (brief §5.4)

| Campo | Uso en SPEC-227 |
|-------|-----------------|
| `id` | PK; `recomendacion_id` en CSV. |
| `reglaId` | Filtro por regla; join para `clave`/`nombre`. |
| `titulo` | Columna de la tabla in-app (NO se exporta a CSV). |
| `categoria` | Filtro y columna (heredada de la regla). |
| `prioridad` | Columna; orden secundario. |
| `sujetoTipo` / `sujetoId` | Filtro por cliente; en CSV solo como hash pseudonimizado. |
| `estado` (`EstadoRecomendacion`) | Filtro, badge y base de las tasas (`PENDIENTE`/`APLICADA`/`IGNORADA`/`EXPIRADA`). |
| `generadaEn` | Orden principal (desc), filtro de rango (día Bogotá), base del tiempo de resolución. |
| `resueltaEn` | Tiempo de resolución (`resueltaEn - generadaEn`); nulo en pendientes. |
| `ejecutadaAutomatica` | Filtro y distintivo "ejecutada sola". |

Índices existentes (SPEC-221): `@@index([estado, prioridad, generadaEn])`, `@@index([sujetoId])` — cubren los filtros de esta vista.

### 2.2 `ReglaRecomendacion` (brief §5.3)

| Campo | Uso en SPEC-227 |
|-------|-----------------|
| `id`, `clave`, `nombre` | Select de filtro y columnas de regla. |
| `categoria` | Valores del filtro de categoría. |
| `modo` | Contexto del distintivo "ejecutada sola". |
| `activa` | Las reglas inactivas siguen apareciendo en historial (las sugerencias ya generadas no desaparecen). |

## 3. Filas de seed nuevas (sin migración)

### 3.1 `ParametroSistema` (existente, `prisma/schema.prisma:592`)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `analisis.recomendaciones.tasa_ignorada_alerta_pct` | FLOAT | `70` | Tasa de ignorada (%) que marca la regla con "revisar umbral" |
| `analisis.recomendaciones.export_max_filas` | INTEGER | `5000` | Tope de filas del export CSV (413 si se excede) |

### 3.2 `ModuloPermisible` (catálogo en `prisma/seed-modulos-grants.ts`)

| Clave | Nombre | Grants |
|-------|--------|--------|
| `analisis_recomendaciones` | "Análisis · Historial de sugerencias" | Solo `ADMIN` (backfill) |

## 4. Variables de entorno

| Variable | Uso | Notas |
|----------|-----|-------|
| `ANALISIS_EXPORT_SALT` | Sal del hash `sujeto_hash` del CSV | Documentada en `.env.example` sin valor real; el valor vive solo en `.env` fuera de git (regla I-22). |

## 5. Migración propuesta

Ninguna. `data-model.md` queda como registro explícito de "sin cambios de modelo" para la auditoría de la compuerta.
