# Data Model — Spec 036: Consistencia y limpieza

## Cambios en modelo de datos

Este spec no modifica el modelo de datos de Prisma.

## Modelos consultados

| Modelo | Uso |
|--------|-----|
| `Reporte` | Contiene `numeroSeguimiento` y se relaciona con `Identificador` para la búsqueda por identificador/nick. |
| `Identificador` | Almacena el valor reportado (número telefónico, nick, etc.). |
| `ApelacionIdentificador` | Involucrado en la funcionalidad de apelaciones (solo renombramiento de rutas). |

## Notas

- La búsqueda por identificador/nick se realiza sobre la relación `Reporte` → `Identificador`.
- No se requieren nuevos índices para la búsqueda en esta fase; si el volumen lo justifica, se puede agregar un índice `@@index` en `Reporte.numeroSeguimiento` e `Identificador.valor` en una fase posterior.
