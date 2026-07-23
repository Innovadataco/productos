# Research — 013 Consola de APIs (Fase 1)

**Nota**: el racional completo vive en [plan.md](./plan.md). Mínimo por ZEUS-006.

| # | Decisión | Alternativas descartadas | Razón |
|---|---|---|---|
| D-1 | Un solo camino de ejecución: `ejecutarOperacion()` → `getClienteSupertransporte()` (stub por gate) | Rama de código separada para "real" | En Fase 2 solo se enciende el gate; sin reestructura |
| D-2 | **Doble candado**: gate env apagado + `FASE_CONSOLA = 1` en código; endpoint real → 403 fijo | Solo gate env | Un `.env` mal cargado no debe adelantar Fase 2; cambiar la constante exige commit revisado |
| D-3 | Catálogo como **constante tipada** de código, no BD | Catálogo en tabla | Es declarativo y estable; el mapeo ejecutor→método es una tabla |
| D-4 | Bitácora en tabla nueva `tbl_api_llamadas` con `modo` (stub/real) | Reusar tabla existente | Prefijo `apl_` propio del 003; Fase 2 usa el mismo esquema |
| D-5 (ZEUS) | `request`/`respuesta` en **`jsonb`** | `@db.Json` | Indexable, más eficiente para la bitácora |
| D-6 (ZEUS) | Redacción de sensibles **RECURSIVA** (anidados) + truncado 8 KB | Redacción de primer nivel | Un token anidado en el payload también debe redactarse |

**Deuda anotada (fuera de Fase 1)**: purga/retención y exportación de la bitácora; reintentos
desde la consola.
