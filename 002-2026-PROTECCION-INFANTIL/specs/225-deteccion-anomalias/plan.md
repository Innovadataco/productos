# Plan de implementación: SPEC-225 — Detección de anomalías dinero-vs-valor

## 1. Resumen ejecutivo

Esta spec entrega la detección de anomalías del módulo Análisis dinero-vs-valor en cuatro piezas:

1. **Modelo** (`prisma/schema.prisma` + migración aditiva): `Anomalia` con enums `TipoAnomalia` y `SeveridadAnomalia`.
2. **Detector** (`src/lib/analisis/anomalias/`): 6 reglas deterministas SQL/Prisma, una por archivo, con deduplicación por anomalía abierta.
3. **Worker** (`scripts/worker-anomalias.mjs`): tick periódico con advisory lock, `TZ=America/Bogota`, alerta inmediata al CEO para severidad ALTA vía Motor Notif.
4. **API admin mínima** (`src/app/api/admin/analisis/anomalias/`): listar, detallar y resolver.

No implementa UI de panel (SPEC-222), digest semanal (SPEC-223) ni ejecución automática de acciones (SPEC-226). Sin IA: no se toca `src/lib/ai/**`.

## 2. Decisiones de arquitectura

### 2.1 Detección por reglas puras sobre Prisma

- Cada regla es una función async pura en `src/lib/analisis/anomalias/reglas/` con firma `(ctx: ContextoDeteccion) => Promise<CandidatoAnomalia[]>`, donde `ContextoDeteccion` trae los umbrales ya leídos de `ParametroSistema` y la ventana temporal calculada (semana Bogotá actual y anterior).
- El orquestador (`detector.ts`) ejecuta las reglas en secuencia, aplica deduplicación `(tipo, sujetoTipo, sujetoId)` contra anomalías abiertas y persiste cada hallazgo en su propia transacción; un fallo en una regla se loguea y no detiene las demás.
- **Alternativas consideradas**: (a) reutilizar el motor `ReglaRecomendacion` de SPEC-221 con SQL libre por regla — descartado: las anomalías son un conjunto cerrado y fijo (D-78), no reglas editables por admin; el SQL libre de SPEC-224 es para recomendaciones; (b) evaluar dentro del worker de notificaciones — descartado: mezcla responsabilidades y comparte advisory lock.

### 2.2 Worker propio con advisory lock

- `scripts/worker-anomalias.mjs`, patrón idéntico a `scripts/monitor-probes.mjs` (`scripts/monitor-probes.mjs:45-60`): cliente `pg` dedicado, `pg_try_advisory_lock` con id propio (nuevo, distinto de 123456789/123456790/923456789/987654321 — p. ej. `123456792`), exit 2 si está tomado, unlock en `SIGTERM`/`SIGINT`.
- Tick: `analisis.anomalias.tick_min` (default 60 min), releído en cada ciclo junto a todos los umbrales (tuning sin redeploy, candado del brief §2). Flag `--run-once` para validación manual y tests del quickstart.
- **Alternativa considerada**: job periódico pg-boss — descartada para el loop de evaluación (las tareas son idempotentes y de largo plazo, igual criterio que SPEC-236 §3.2); pg-boss ya interviene aguas abajo cuando Motor Notif encola el envío.

### 2.3 Alerta inmediata vía Motor Notif (sin tocar el motor)

- Severidad ALTA → `programar()` de `src/lib/notificaciones` (`src/lib/notificaciones/motor.ts:79`) con `evento: "analisis.anomalia.detectada"`, `sujetoTipo: "Anomalia"`, `sujetoId`, y un destinatario por usuario `ADMIN` activo (email resuelto por el propio motor vía `usuarioId`).
- El seed añade (idempotente, patrón `prisma/seed.ts:1918-1955`): regla `{ evento: "analisis.anomalia.detectada", rol: "ADMIN", offset: "+0m", canal: EMAIL, obligatoria: true }` + su gemela IN_APP, y plantillas `analisis.anomalia.detectada.email` / `.in_app` (Markdown, español neutro).
- Fail-open: `try/catch` alrededor de `programar`; la anomalía ya está persistida y el error va a `console.error` con formato `[Anomalias] ...`.
- MEDIA/BAJA no emiten evento: las consume SPEC-223 (digest) leyendo la tabla.

### 2.4 Deduplicación y ciclo de vida

- Deduplicación en código: `findFirst({ where: { tipo, sujetoTipo, sujetoId, resueltaEn: null } })` antes de insertar. Anomalías sin sujeto (`CANCELACIONES_MASIVAS_24H`) deduplican por `(tipo, sujetoTipo: null, sujetoId: null)`.
- Resolución manual por admin vía API (`resueltaEn`, `resueltaPorAdminId`); v1 no auto-resuelve. Tras resolver, la regla puede volver a disparar si la condición persiste — comportamiento deseado (la condición sigue viva y un humano ya la gestionó).

### 2.5 Cortes temporales en America/Bogota

- Semana calendario Bogotá (lunes 00:00 – domingo 23:59) calculada con `date-fns-tz` (`toZonedTime`), patrón de SPEC-236; ventanas móviles de 24h para cancelaciones masivas.
- Contenedor `pi-anomalias` con `TZ: America/Bogota` en `docker-compose.prod.yml` (patrón `pi-notificaciones`, líneas 118-126).

### 2.6 Definiciones operacionales de las reglas

| Regla | Consulta base | Severidad |
|---|---|---|
| `PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL` | `Suscripcion` ACTIVA/EN_GRACIA con `fechaFin` vencida hace ≥ umbral días, sin `Pago` AUTORIZADO posterior a `fechaFin`, y con ≥2 pagos autorizados puntuales | MEDIA (≥15d) / ALTA (≥30d) |
| `CRECIMIENTO_ANOMALO_CIUDAD` | altas `Suscripcion` por `Colegio.ciudadId`, semana actual vs anterior, Δ% > `crecimiento_pct_umbral` (default 25) | BAJA |
| `USO_CAIDO_ABRUPTO` | `SesionLog` por `tenantId`, semana actual vs anterior, Δ% < −`uso_caido_pct_umbral` (default 50) | MEDIA |
| `CANCELACION_COLEGIO_GRANDE` | `Suscripcion` con `canceladaEn` en últimas 24h cuyo colegio tiene > `colegio_grande_min_reportes` (default 50) filas `Reporte` | ALTA |
| `CAIDA_RECAUDO_CIUDAD` | Σ `Pago.montoNetoUSD` AUTORIZADO por ciudad, semana actual vs anterior, Δ% < −`caida_recaudo_pct_umbral` (default 30) | ALTA |
| `CANCELACIONES_MASIVAS_24H` | count `Suscripcion.canceladaEn` últimas 24h > `cancelaciones_24h_umbral` (default 5) | ALTA |

Las reglas comparativas exigen base mínima `base_minima_comparacion` (default 3) en la semana de referencia; si no se cumple, la regla no evalúa esa ciudad/colegio.

### 2.7 API admin mínima

- Rutas bajo `src/app/api/admin/analisis/anomalias/`, auth por `verifyAuth` + guard de rol `ADMIN` (patrón de las rutas `src/app/api/admin/**`), validación de entrada con Zod, filtros tipados `Prisma.AnomaliaWhereInput`, paginación estándar del constitution §4.3, errores `AppError` canónicos.
- `PATCH` registra `AuditLog` (acción aditiva `ANOMALIA_RESUELTA` si el enum lo admite; si no, acción genérica existente con metadatos — decisión final en implementación, ver research §6).

## 3. Flujo detallado del tick

```text
1. Adquirir advisory lock (o exit 2).
2. Leer parámetros analisis.anomalias.* (frescos en cada tick).
3. Calcular ventanas: semana Bogotá actual/anterior, últimas 24h.
4. Por cada regla (secuencial, try/catch individual):
   a. Ejecutar consulta → candidatos.
   b. Filtrar candidatos con anomalía abierta del mismo (tipo, sujeto).
   c. Persistir cada Anomalia en su TX (descripcion + datosContexto agregados).
   d. Si severidad = ALTA y email_inmediato_habilitado:
      resolver ADMINs activos → programar(evento analisis.anomalia.detectada).
5. Log resumen: [Anomalias] Tick: N detectadas (X ALTA) — M emails programados.
6. Dormir tick_min.
```

## 4. Estructura de archivos propuesta

```text
prisma/schema.prisma                         # + model Anomalia, enums TipoAnomalia/SeveridadAnomalia
prisma/migrations/<ts>_anomalias/            # migración aditiva
prisma/seed.ts                               # + params analisis.anomalias.*, regla + plantillas Motor Notif

src/lib/analisis/anomalias/
  tipos.ts                                   # CandidatoAnomalia, ContextoDeteccion
  parametros.ts                              # lectura tipada de umbrales
  ventanas.ts                                # semana Bogotá, últimas 24h (date-fns-tz)
  detector.ts                                # orquestador + deduplicación + persistencia
  alertas.ts                                 # publicación Motor Notif (ADMINs activos)
  reglas/
    mora-anomala.ts
    crecimiento-anomalo-ciudad.ts
    uso-caido-abrupto.ts
    cancelacion-colegio-grande.ts
    caida-recaudo-ciudad.ts
    cancelaciones-masivas-24h.ts
  detector.test.ts
  reglas.test.ts
  ventanas.test.ts

src/app/api/admin/analisis/anomalias/
  route.ts                                   # GET lista
  route.test.ts
  [id]/route.ts                              # GET detalle, PATCH resolver
  [id]/route.test.ts

scripts/worker-anomalias.mjs
scripts/dev-restart.sh                       # pkill + nohup worker-anomalias
docker-compose.prod.yml                      # servicio pi-anomalias (TZ Bogotá)

specs/225-deteccion-anomalias/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  checklists/requirements.md
  contracts/anomalias-admin.md
```

## 5. Parámetros sembrados (todos `CategoriaParametro.SYSTEM`)

| Clave | Tipo | Default | Uso |
|---|---|---|---|
| `analisis.anomalias.tick_min` | INTEGER | 60 | cadencia del worker |
| `analisis.anomalias.mora_dias_umbral_media` | INTEGER | 15 | mora anómala MEDIA |
| `analisis.anomalias.mora_dias_umbral_alta` | INTEGER | 30 | mora anómala ALTA |
| `analisis.anomalias.crecimiento_pct_umbral` | FLOAT | 25 | crecimiento ciudad |
| `analisis.anomalias.uso_caido_pct_umbral` | FLOAT | 50 | caída de sesiones |
| `analisis.anomalias.caida_recaudo_pct_umbral` | FLOAT | 30 | caída recaudo ciudad |
| `analisis.anomalias.cancelaciones_24h_umbral` | INTEGER | 5 | ráfaga cancelaciones |
| `analisis.anomalias.colegio_grande_min_reportes` | INTEGER | 50 | colegio grande |
| `analisis.anomalias.base_minima_comparacion` | INTEGER | 3 | base mínima semana ref. |
| `analisis.anomalias.email_inmediato_habilitado` | BOOLEAN | true | kill-switch del email |

## 6. Fases de implementación

1. **Fase 1 — Modelo y seed**: enums + `Anomalia` + migración + parámetros + evento/plantillas Motor Notif.
2. **Fase 2 — Detector**: ventanas, parámetros, 6 reglas, deduplicación, tests de reglas.
3. **Fase 3 — Alertas**: `alertas.ts` + tests de integración con Motor Notif (BD de test).
4. **Fase 4 — API admin**: 2 rutas + tests 401/403/200/409.
5. **Fase 5 — Worker e infra**: `worker-anomalias.mjs`, `dev-restart.sh`, `docker-compose.prod.yml`.
6. **Fase 6 — Gate local**: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- <path-SPEC> && npm run build` + verificación de diff acumulado del mega-lote.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| SPEC-220 creó ya el modelo `Anomalia` | Verificar schema antes de migrar; si existe, omitir migración y ajustar campos faltantes de forma aditiva. |
| Falsos positivos en semanas de bajo volumen | `base_minima_comparacion` + tests de base insuficiente y base cero. |
| Spam de emails al CEO por condición persistente | Deduplicación por anomalía abierta: 1 email por episodio hasta que se resuelva. |
| Cruce de semana mal calculado en UTC | `date-fns-tz` + tests de frontera domingo 23:59 / lunes 00:01. |
| Worker duplicado en dev/prod | Advisory lock + pkill en `dev-restart.sh` + 1 servicio en compose. |
| PII en `datosContexto` | Solo agregados e ids internos por construcción; test que asserta la forma del JSON. |
