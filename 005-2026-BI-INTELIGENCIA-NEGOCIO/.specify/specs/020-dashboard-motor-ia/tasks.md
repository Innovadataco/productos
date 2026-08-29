# TASKS-020 · Dashboard MOTOR IA

> **Nota de bundle offline (Opción A · 2026-08-29):** YAML declarativos en
> `superset/`. Marco lo cerrado offline; el resto lo cierra Fábrica en VPS.

## F2 · Verificación estructura y volumen
- [x] Estructura `clasificacion_rubrica_votos` verificada contra schema PI 2173-2185 (research.md)
- [ ] `SELECT count(*), count(DISTINCT "clasificacionIAId") FROM "clasificacion_rubrica_votos"` últimos 7d · anotar · **VPS**
- [x] `count = 0` observado en upstream dev (0 filas) → fallback JSON `ClasificacionIA.votos` documentado en D-020.2 · se re-verifica en VPS

## F3 · Catálogo de modelos
- [x] `SELECT DISTINCT "modeloUsado" FROM "ClasificacionIA"` upstream dev · `seed-e2e` (research.md · re-consulta VPS)
- [ ] Top-6 modelos definido tras muestra productiva · **VPS**

## F4 · Charts MOTOR IA (SQLs son cita literal del spec.md §Alcance)
- [x] `motor_clasificaciones_24h_v1` · Big Number · refresh 5 min · YAML
- [x] `motor_latencia_p50p95_v1` · Tabla 3 col por modelo · refresh 15 min · YAML
- [x] `motor_distribucion_categorias_v1` · Bar chart categoría 7d · refresh 30 min · YAML
- [x] `motor_tasa_acuerdo_jurado_v1` · Big Number % · CTE consenso · refresh 15 min · YAML
- [x] `motor_uso_cascada_v1` · Big Number % (columna `usoCascada` schema PI 1980) · refresh 30 min · YAML
- [x] `motor_correcciones_admin_30d_v1` · Big Number 30 d · refresh 60 min · YAML
- [x] `motor_latencia_timeline_v1` · Line 72 h por hora por modelo · refresh 15 min · YAML
- [x] Dashboard `Motor IA` YAML con 7 charts enlazados por UUID
- [x] Export `superset/dashboards/motor_ia.yaml`

## F5 · Gate local · **VPS**
- [ ] Chart 4 validado con caso plantado (100 % / 0 %)
- [ ] Cruce KPI 6 master vs Superset OK
- [ ] Todos los charts < 3 s primera visita

## F6 · Ratchets CI
- [x] 4/5 ratchets local verdes (cero-sql-raw · cero-secretos · imports-llm-solo-motor · no-additional-properties-true)
- [ ] `mv-schema-check.sh` · SKIP en Dev BI-2 (worktree PI sin `node_modules`); Fábrica cierra

## Cierre · **VPS**
- [ ] `cierre.md` con timings + catálogo de modelos observado
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
