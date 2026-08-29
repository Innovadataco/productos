# TASKS-019 · Dashboard EJECUTIVO

Casillas marcadas al completar. Al 3er rojo del mismo síntoma → PARA + escala a Fábrica BI-2.

> **Nota de bundle offline (Opción A · 2026-08-29):** los YAML declarativos
> viven bajo `superset/` y se importan en VPS. Marco los checkboxes cuyo
> gate se cierra offline (YAML producido, ratchet local). Los que dependen
> de Superset en vivo (import, GRANT `bi_reader`, DISTINCT en réplica, gate
> local) quedan sin marcar y los cierra Fábrica en VPS con Jelkin.

## F1 · Datasets Superset (transversal 019..023)
- [ ] Conexión Superset → `bi-db-replica` con `bi_reader` · SELECT 1 OK  · **VPS**
- [x] Dataset `Reporte` · YAML en `superset/datasets/bi_db_replica/Reporte.yaml`
- [x] Dataset `Subscription` · YAML
- [x] Dataset `BillingCycle` · YAML
- [x] Dataset `Colegio` · YAML
- [x] Dataset `Plan` · YAML
- [x] Dataset `ClasificacionIA` · YAML (incluye columnas `categoria` · `usoCascada` para SPEC-020 KPIs 3/5)
- [x] Dataset `SolicitudComite` · YAML
- [x] Dataset `TransicionReporte` · YAML
- [x] Dataset `CorreccionAdmin` · YAML (usa `clasificacionId` según schema PI línea 1993)
- [x] Dataset `clasificacion_rubrica_votos` · YAML
- [x] Dataset `mv_fact_reporte_diario` · YAML (columnas reales de la MV)
- [x] Dataset `mv_fact_motor_ia_diario` · YAML (columnas reales · sin `aciertos`/`clasificaciones` inventados)
- [x] Dataset `mv_fact_operativo` · YAML (columnas reales)
- [x] Dataset `mv_fact_comercial_mensual` · YAML (`monto_total` · `ciclo_estado`)
- [x] Dataset `mv_fact_salud_sistema` · YAML (columnas reales de AuditLog agregado)

## F2 · Verificación GRANT PII (candado 20) — prueba activa como `bi_reader` · **VPS**
- [ ] `SELECT texto FROM public."Reporte" LIMIT 1;` como `bi_reader` → `permission denied for column texto`
- [ ] `SELECT "textoOriginal" FROM public."Reporte" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalNombre" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalIdentificacion" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalEmail" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalTelefono" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "passwordHash" FROM public."Usuario" LIMIT 1;` → `permission denied for column passwordHash` (campo real · schema PI línea 534 · NO `password`)
- [ ] Si CUALQUIER query devuelve datos → PARA + escala a Fábrica BI-2

## F3 · Verificación vocabulario real (candado 15)
- [x] `SELECT DISTINCT estado FROM "Reporte"` · anotado en `research.md` (upstream `002-2026-proteccion-infantil-db-1` · re-consulta VPS)
- [x] `SELECT DISTINCT estado FROM "Subscription"` · anotado (∅ dev · default `'activo'`)
- [x] `SELECT DISTINCT estado FROM "BillingCycle"` · anotado (∅ dev · default `'pendiente'`)
- [x] `SELECT DISTINCT estado FROM "Colegio"` · anotado (`activo`)
- [x] SQL de KPIs consistente con defaults verificados

## F4 · Charts EJECUTIVO (6 KPIs)
- [x] Chart `ejec_reportes_24h_v1` · Big Number · refresh 5 min · YAML
- [x] Chart `ejec_suscripciones_activas_v1` · Big Number · refresh 15 min · YAML
- [x] Chart `ejec_mrr_mes_v1` · Big Number COP · refresh 15 min · YAML
- [x] Chart `ejec_prioridad_alta_abiertos_v1` · Big Number · refresh 5 min · YAML
- [x] Chart `ejec_tendencia_reportes_30d_v1` · Line chart · refresh 15 min · YAML
- [x] Chart `ejec_top5_colegios_mes_v1` · Bar horizontal · refresh 60 min · YAML
- [x] Dashboard `Ejecutivo` YAML en `superset/dashboards/ejecutivo.yaml`
- [x] Export `superset/dashboards/ejecutivo.yaml`

## F5 · Gate local (candado 14) · **VPS**
- [ ] `superset import-directory /app/superset_assets` sin errores
- [ ] Cada chart carga en < 3 s primera visita (log tiempos en research.md)
- [ ] Cruce KPI 1 (Reportes 24h) master vs Superset · diff ≤ 10 s lag
- [ ] Cruce KPI 3 (MRR mes) vs cierre financiero Jelkin · Fábrica BI-2 valida cero diferencia

## F6 · Ratchets CI
- [x] `cero-sql-raw.sh` · verde local
- [x] `cero-secretos.sh` · verde local
- [x] `imports-llm-solo-motor.sh` · verde local
- [x] `no-additional-properties-true.sh` · verde local
- [ ] `mv-schema-check.sh` · SKIP en Dev BI-2 (worktree sin `node_modules` PI · reportado a CEO); Fábrica cierra este ratchet en su ambiente

## Cierre
- [ ] `cierre.md` con queries reales · timings · desviaciones (post-deploy VPS)
- [ ] Entrada en `05-ENTREGABLES/DASHBOARDS-CATALOGO.md` (KPI+SQL+refresh)
- [ ] Señal a Fábrica BI-2: `desarrollo-bi-2: BI-SPEC-019 · REALIZADO · <hash>`
