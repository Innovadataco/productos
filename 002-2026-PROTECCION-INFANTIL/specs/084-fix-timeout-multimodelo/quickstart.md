# Quickstart — Spec 084: timeout por arranque propio (I-07)

## Qué verificar

Cada run de un lote multi-modelo mide su timeout (`ia.simulacion_timeout_minutos`) desde SU paso a EN_PROGRESO, no desde la creación del lote.

## Pasos

1. Lanzar un lote multi-modelo (UI: checkboxes en Nueva simulación; o API con `modelos: [...]`).
2. Mientras corre, observar:

```sql
SELECT modelo, estado, progreso,
       "createdAt"::timestamp(0) AS creada,
       "fechaInicio"::timestamp(0) AS inicio,
       "fechaFin"::timestamp(0) AS fin
FROM simulacion_runs ORDER BY "createdAt" DESC LIMIT 5;
```

3. Criterios:
   - Todas las runs del lote comparten `createdAt` (creación) pero cada `fechaInicio` ≈ su propio arranque: `fechaInicio(run N+1) > fechaFin(run N)`.
   - Ninguna run pasa a FALLIDA antes de agotar `ia.simulacion_timeout_minutos` medidos desde SU `fechaInicio`.
4. Escenario de regresión (opcional, fue la validación oficial): bajar el parámetro a 15 min (`UPDATE "ParametroSistema" SET valor='15' WHERE clave='ia.simulacion_timeout_minutos';`) y lanzar un lote de 3 modelos × 10 casos: con el bug, la run 3 moría por el reloj del lote; con el fix, las 3 completan. Restaurar a 60 al terminar.

## Notas

- `drainPending` ya no re-encola reportes con job en cola (sin duplicados en `pgboss.job`).
- Reportes `PENDIENTE` zombis de runs FALLIDA históricas: marcarlos `REVISION_MANUAL` si saturan la cola.
