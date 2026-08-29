# superset/ · bundle de assets Superset 3.x

Generado por `scripts/build-superset-bundle.py` (fuente de verdad).
Los YAML se comitean como output determinista para que el deploy no
dependa del script.

## Contenido

- `metadata.yaml` · versión del bundle (1.0.0 · type: assets)
- `databases/` · 2 conexiones (bi-db-replica · bi-superset-db). `sqlalchemy_uri`
  trae password placeholder `XXXXXXXXXXXX`; los secretos reales viven en
  `.env.bi.production` del VPS y se inyectan en el import.
- `datasets/` · 20 datasets físicos (13 tablas base + 5 MVs + bi_consulta_log
  + logs Superset). Columnas listadas son las usadas por los charts; el resto
  las infiere Superset al refresh de metadata.
- `charts/` · 34 charts (6 ejec + 7 motor + 6 com + 7 op + 8 salud). Cada
  `slice_name`, `viz_type` y `sql` es cita literal del spec.md correspondiente.
- `dashboards/` · 5 dashboards, cada uno enlazando sus charts por UUID.

## Importar en el VPS

```bash
# dentro del contenedor bi-superset
superset import-directory /app/superset_assets
```

(Volumen `superset_assets` monta este directorio en `docker-compose.bi.yml`.)

## Regenerar

```bash
cd 005-2026-BI-INTELIGENCIA-NEGOCIO
python3 scripts/build-superset-bundle.py
git add superset/ && git status
```

Los UUID son `uuid5(NS, path)`, deterministas: re-correr no crea duplicados
ni cambia los IDs.

## Estado

- Compuerta §4 SPEC-019..023 aprobada por Fábrica BI-2 (2026-08-29 00:1x COT).
- Candado 14 (verificación en vivo) se cierra en VPS post-deploy: conexión
  Superset→réplica, 5 dashboards visibles, cruce master vs Superset, PII
  bloqueada. NO se da CUMPLE con "el YAML parece correcto".
