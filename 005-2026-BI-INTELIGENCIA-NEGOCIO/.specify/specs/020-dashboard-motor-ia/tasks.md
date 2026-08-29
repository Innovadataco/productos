# TASKS-020 · Dashboard MOTOR IA

## F2 · Verificación estructura y volumen
- [ ] `\d public.clasificacion_rubrica_votos` · 6 columnas confirmadas
- [ ] `SELECT count(*), count(DISTINCT "clasificacionIAId") FROM "clasificacion_rubrica_votos"` últimos 7d · anotar en research.md
- [ ] Si `count = 0` → activar fallback JSON `ClasificacionIA.votos` (D-020.2)

## F3 · Catálogo de modelos
- [ ] `SELECT "modeloUsado", count(*) FROM "ClasificacionIA"` 30d · anotar en research.md
- [ ] Definir top-6 modelos para KPI 2 si hay más de 6 etiquetas

## F4 · Charts MOTOR IA
- [ ] `motor_clasificaciones_24h_v1` · Big Number · refresh 5 min
- [ ] `motor_latencia_p50p95_v1` · Tabla · refresh 15 min
- [ ] `motor_distribucion_categorias_v1` · Bar chart · refresh 30 min
- [ ] `motor_tasa_acuerdo_jurado_v1` · Big Number % umbral 90 % · refresh 15 min
- [ ] `motor_uso_cascada_v1` · Big Number % · refresh 30 min
- [ ] `motor_correcciones_admin_30d_v1` · Big Number delta · refresh 60 min
- [ ] `motor_latencia_timeline_v1` · Line chart multi-serie · refresh 15 min
- [ ] Dashboard `Motor IA` creado con 7 charts
- [ ] Export `superset/dashboards/motor-ia.yaml`

## F5 · Gate local
- [ ] Chart 4 validado con caso plantado (100 % / 0 %)
- [ ] Cruce KPI 6 master vs Superset OK
- [ ] Todos los charts < 3 s primera visita

## F6 · Ratchets CI
- [ ] `bash scripts/ratchets/run-all.sh` verde

## Cierre
- [ ] `cierre.md` con timings + catálogo de modelos observado
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
