> # Data Model — Estados de cara al usuario + SLA visible

**Date**: 2026-07-18
**Feature**: specs/023-estados-usuario-sla/spec.md

---

## Modelos existentes (sin cambios de schema)

### `Reporte` (campos usados)

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `id` | String | Identificador interno |
| `estado` | `EstadoReporte` | Estado interno a mapear |
| `eliminado` | Boolean | Filtro de visibilidad para usuario final |
| `numeroSeguimiento` | String? | Búsqueda en `/seguimiento` |
| `usuarioId` | String? | Filtrar `/mis-reportes` del usuario autenticado |
| `esAnonimo` | Boolean | Indica si el reporte fue anónimo |
| `creadoEn` | DateTime | Fecha de creación visible |
| `actualizadoEn` | DateTime | Última actualización |

### `EstadoReporte` (enum existente, sin cambios)

```prisma
enum EstadoReporte {
  PENDIENTE
  PROCESANDO
  CLASIFICADO
  REVISION_MANUAL
  POSIBLE_SPAM
  DUPLICADO
  REQUIERE_ANONIMIZACION
  CORREGIDO
}
```

### `ParametroSistema` (nueva clave, no migración)

| Clave | Tipo | Categoría | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `ui.sla_horas_procesamiento` | INTEGER | SYSTEM | 24 | Horas máximas que un reporte puede estar "En proceso" antes de mostrar advertencia al usuario |

Se crea por seed/upsert; no requiere migración de schema.

---

## Mapeo de estados internos → visuales

| Estado interno | Estado visual | Badge |
|----------------|---------------|-------|
| `PENDIENTE` | En proceso | `warning` |
| `PROCESANDO` | En proceso | `warning` |
| `REVISION_MANUAL` | En proceso | `warning` |
| `POSIBLE_SPAM` | En proceso | `warning` |
| `REQUIERE_ANONIMIZACION` | En proceso | `warning` |
| `CLASIFICADO` | Procesado | `success` |
| `CORREGIDO` | Procesado | `success` |
| `DUPLICADO` | Procesado | `muted` |

**Reglas**:
- `DUPLICADO` se muestra como "Procesado" pero con badge distinto (muted) para no confundir al usuario.
- Los estados internos `CLASIFICADO` y `CORREGIDO` se mantienen separados en el backend para métricas; el usuario solo ve "Procesado".

---

## Filtrado por `eliminado`

Las vistas de usuario final **solo** muestran reportes con `eliminado = false`:

- `/mis-reportes` → `WHERE usuarioId = ? AND eliminado = false`
- `/seguimiento?numero=...` → `WHERE numeroSeguimiento = ? AND eliminado = false`
- `/consulta?identificador=...` → ya filtra por visibilidad pública (incluye `eliminado = false` implícito)

---

## SLA visible

El mensaje mostrado al usuario para reportes en estado "En proceso" es:

> "En proceso — puede tardar hasta **N** horas"

Donde `N` se lee de `ParametroSistema` clave `ui.sla_horas_procesamiento`.

---

## Invariantes

- El mapeo visual es función pura del campo `estado`; no altera `Reporte`.
- Los operadores/admin/comité siguen viendo los estados internos completos en sus bandejas.
- `eliminado = true` nunca se expone al usuario final.
