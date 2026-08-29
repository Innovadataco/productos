# TASKS-019 · Dashboard EJECUTIVO

Casillas marcadas al completar. Al 3er rojo del mismo síntoma → PARA + escala a Fábrica BI-2.

## F1 · Datasets Superset (transversal 019..023)
- [ ] Conexión Superset → `bi-db-replica` con `bi_reader` · SELECT 1 OK
- [ ] Dataset `Reporte` importado · export YAML en `superset/datasets/reporte.yaml`
- [ ] Dataset `Subscription` importado · export YAML
- [ ] Dataset `BillingCycle` importado · export YAML
- [ ] Dataset `Colegio` importado · export YAML
- [ ] Dataset `Plan` importado · export YAML
- [ ] Dataset `ClasificacionIA` importado · export YAML
- [ ] Dataset `SolicitudComite` importado · export YAML
- [ ] Dataset `TransicionReporte` importado · export YAML
- [ ] Dataset `CorreccionAdmin` importado · export YAML
- [ ] Dataset `clasificacion_rubrica_votos` importado · export YAML
- [ ] Dataset `mv_fact_reporte_diario` importado · export YAML
- [ ] Dataset `mv_fact_motor_ia_diario` importado · export YAML
- [ ] Dataset `mv_fact_operativo` importado · export YAML
- [ ] Dataset `mv_fact_comercial_mensual` importado · export YAML
- [ ] Dataset `mv_fact_salud_sistema` importado · export YAML

## F2 · Verificación GRANT PII (candado 20) — prueba activa como `bi_reader`
- [ ] `SELECT texto FROM public."Reporte" LIMIT 1;` como `bi_reader` → `permission denied for column texto`
- [ ] `SELECT "textoOriginal" FROM public."Reporte" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalNombre" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalIdentificacion" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalEmail" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "representanteLegalTelefono" FROM public."Colegio" LIMIT 1;` → `permission denied`
- [ ] `SELECT "passwordHash" FROM public."Usuario" LIMIT 1;` → `permission denied for column passwordHash` (campo real · schema PI línea 534 · NO `password`)
- [ ] Si CUALQUIER query devuelve datos → PARA + escala a Fábrica BI-2

## F3 · Verificación vocabulario real (candado 15)
- [ ] `SELECT DISTINCT estado FROM "Reporte"` · anotar en research.md
- [ ] `SELECT DISTINCT estado FROM "Subscription"` · anotar
- [ ] `SELECT DISTINCT estado FROM "BillingCycle"` · anotar
- [ ] `SELECT DISTINCT estado FROM "Colegio"` · anotar
- [ ] Ajustar SQL de KPIs 2, 3 en spec.md si vocabulario difiere

## F4 · Charts EJECUTIVO (6 KPIs)
- [ ] Chart `ejec_reportes_24h_v1` · Big Number con delta · refresh 5 min
- [ ] Chart `ejec_suscripciones_activas_v1` · Big Number con delta · refresh 15 min
- [ ] Chart `ejec_mrr_mes_v1` · Big Number COP con `number_format` · refresh 15 min
- [ ] Chart `ejec_prioridad_alta_abiertos_v1` · Big Number rojo si >0 · refresh 5 min
- [ ] Chart `ejec_tendencia_reportes_30d_v1` · Line chart · refresh 15 min
- [ ] Chart `ejec_top5_colegios_mes_v1` · Bar horizontal · refresh 60 min
- [ ] Dashboard `Ejecutivo` creado · 6 charts colocados · default landing
- [ ] Export `superset/dashboards/ejecutivo.yaml`

## F5 · Gate local (candado 14)
- [ ] `docker compose up -d bi-superset bi-db-replica` sin errores
- [ ] Cada chart carga en < 3 s primera visita (log tiempos en research.md)
- [ ] Cruce KPI 1 (Reportes 24h) master vs Superset · diff ≤ 10 s lag
- [ ] Cruce KPI 3 (MRR mes) vs cierre financiero Jelkin · Fábrica BI-2 valida cero diferencia

## F6 · Ratchets CI
- [ ] `bash scripts/ratchets/run-all.sh` verde

## Cierre
- [ ] `cierre.md` con queries reales · timings · desviaciones
- [ ] Entrada en `05-ENTREGABLES/DASHBOARDS-CATALOGO.md` (KPI+SQL+refresh)
- [ ] Señal a Fábrica BI-2: `desarrollo-bi-2: BI-SPEC-019 · REALIZADO · <hash>`
