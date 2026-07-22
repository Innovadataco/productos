# Scripts de apoyo — Simulación / evaluación de modelos

> ⚠️ **SOLO desarrollo.** No ejecutar contra producción. `purgar-simulaciones.sql` borra datos.

## Contenido

| Archivo | Qué hace |
|---------|----------|
| `revisar-resultados-modelos.sql` | Muestra resultados de las simulaciones: runs, accuracy y latencia por modelo, error silencioso, matriz de confusión y detalle por caso. |
| `purgar-simulaciones.sql` | Borra **todos** los datos de simulación (runs, reportes de sim y sus clasificaciones por cascada) y limpia la cola pg-boss. No toca reportes reales/seed. |
| `simulacion-50-casos-eval.json` | Set de 50 casos de prueba con `categoriaEsperada` (12 categorías + benignos + spam), para evaluar accuracy en la pantalla de simulación. |

## Uso

Con la BD en Docker (`002-2026-proteccion-infantil-db-1`):

```bash
# Revisar resultados
docker exec -i 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil < scripts/simulacion/revisar-resultados-modelos.sql

# Purgar simulaciones (dev)
docker exec -i 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil < scripts/simulacion/purgar-simulaciones.sql
```

El JSON se sube desde la UI: `admin/ia?tab=eval` → Nueva simulación → paso 1.

> Nota: antes de purgar, conviene detener el worker (`pkill -f worker-reportes.mjs`) para que no reinserte datos durante el borrado.
