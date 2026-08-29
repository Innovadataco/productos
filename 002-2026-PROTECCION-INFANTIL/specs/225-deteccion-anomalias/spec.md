# Feature Specification: SPEC-225 — Detección de anomalías dinero-vs-valor

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: PLANEADO

**Dependencia**: SPEC-221 (motor de reglas de recomendación, mega-lote) — entrega el patrón de worker de evaluación periódica, los parámetros `analisis.*` base y los modelos `Suscripcion`/`Pago`/`SesionLog` ya instrumentados que esta spec lee. Parte del MEGA-LOTE Análisis dinero-vs-valor (SPEC-220..227).

Impacto en arquitectura: añade el modelo `Anomalia` (migración aditiva), un worker propio `scripts/worker-anomalias.mjs` con advisory lock de PostgreSQL, parámetros `analisis.anomalias.*` en seed, el evento `analisis.anomalia.detectada` del Motor Notif (SPEC-201..204) con plantillas email/in-app para el CEO, y una API mínima de admin para listar/detallar/resolver anomalías. **Sin IA**: 100% reglas SQL deterministas (decisión del brief, análoga a D-67). No se toca `src/lib/ai/**` ni el rate-limit del reporte público.

**Input**: El cerebro comercial del CEO necesita detectar desviaciones del negocio sin que nadie mire un dashboard: mora anómala de un cliente históricamente puntual, crecimiento anómalo de una ciudad, caída abrupta de uso, cancelación de un colegio grande, caída de recaudo semanal >30% en una ciudad y ráfaga de cancelaciones (>5 en 24h). Las anomalías críticas (severidad ALTA, decisión D-78) generan email inmediato al CEO; el resto solo entra al DigestSemanal (SPEC-223). Alcance fijado por INSTRUCTIVO-002-PI-126 y `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §5.6, §8.3 y §15 (fila 6).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El sistema detecta anomalías del negocio por reglas deterministas (Priority: P1)

Como sistema quiero evaluar periódicamente reglas SQL sobre suscripciones, pagos, reportes y sesiones para registrar `Anomalia` cuando el negocio se desvía de su comportamiento normal, sin intervención humana ni IA.

**Why this priority**: es el núcleo de la spec; sin detección no hay alertas ni digest. El CEO decidió explícitamente "sin IA — 100% reglas SQL + heurísticas configurables".

**Independent Test**: sembrar una suscripción de colegio con 3 pagos puntuales autorizados y `fechaFin` vencida hace 16 días sin pago de renovación, correr el worker una vez y verificar que se crea una `Anomalia` tipo `PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL` con severidad MEDIA.

**Acceptance Scenarios**:

1. **Given** una suscripción con al menos 2 pagos autorizados puntuales (históricamente puntual) cuya `fechaFin` venció hace ≥ `analisis.anomalias.mora_dias_umbral_media` días sin pago de renovación autorizado, **When** el worker ejecuta su tick, **Then** crea una `Anomalia` tipo `PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL`, severidad MEDIA, con `sujetoTipo = "Suscripcion"` y `sujetoId` de la suscripción.
2. **Given** la misma situación con mora ≥ `analisis.anomalias.mora_dias_umbral_alta` días, **When** el worker ejecuta su tick, **Then** la severidad es ALTA.
3. **Given** una ciudad cuyas altas de suscripciones de la última semana (calendario Bogotá) superan en más de `analisis.anomalias.crecimiento_pct_umbral`% a la semana anterior (con mínimo de base para evitar ruido), **When** el worker ejecuta su tick, **Then** crea una `Anomalia` tipo `CRECIMIENTO_ANOMALO_CIUDAD`, severidad BAJA, `sujetoTipo = "Ciudad"`.
4. **Given** un colegio cuyas sesiones activas (`SesionLog`) de la última semana cayeron más de `analisis.anomalias.uso_caido_pct_umbral`% respecto a la semana anterior (con mínimo de base), **When** el worker ejecuta su tick, **Then** crea una `Anomalia` tipo `USO_CAIDO_ABRUPTO`, severidad MEDIA, `sujetoTipo = "Colegio"`.
5. **Given** una suscripción `CANCELADA` cuyo colegio acumula más de `analisis.anomalias.colegio_grande_min_reportes` reportes históricos, **When** el worker ejecuta su tick, **Then** crea una `Anomalia` tipo `CANCELACION_COLEGIO_GRANDE`, severidad ALTA, `sujetoTipo = "Colegio"`.
6. **Given** una ciudad cuyo recaudo autorizado de la última semana cayó más de `analisis.anomalias.caida_recaudo_pct_umbral`% respecto a la semana anterior (con mínimo de base), **When** el worker ejecuta su tick, **Then** crea una `Anomalia` tipo `CAIDA_RECAUDO_CIUDAD`, severidad ALTA, `sujetoTipo = "Ciudad"`.
7. **Given** más de `analisis.anomalias.cancelaciones_24h_umbral` suscripciones canceladas en las últimas 24 horas, **When** el worker ejecuta su tick, **Then** crea una única `Anomalia` tipo `CANCELACIONES_MASIVAS_24H`, severidad ALTA, sin sujeto individual.
8. **Given** que ya existe una `Anomalia` abierta (`resueltaEn = null`) del mismo tipo y sujeto, **When** el worker vuelve a detectar la misma condición, **Then** NO crea un duplicado (idempotencia por tipo+sujeto abierto).
9. **Given** cada anomalía creada, **Then** `datosContexto` contiene solo agregados (conteos, porcentajes, ids internos) y jamás texto de reportes ni datos personales de menores.

---

### User Story 2 — Anomalías críticas alertan al CEO por email inmediato (Priority: P1)

Como CEO quiero recibir un email inmediato (y notificación in-app) cuando se detecta una anomalía de severidad ALTA, para actuar el mismo día sin abrir el sistema.

**Why this priority**: es la acción C del brief (§8.3) y la decisión D-78 del instructivo: cancelación de colegio grande, caída de recaudo >30% en una ciudad y >5 cancelaciones en 24h son eventos que no pueden esperar al lunes.

**Independent Test**: provocar una `Anomalia` ALTA, correr el worker y verificar que Motor Notif programa una notificación `analisis.anomalia.detectada` canal EMAIL (e IN_APP) dirigida a los usuarios ADMIN activos, con la plantilla renderizada.

**Acceptance Scenarios**:

1. **Given** una `Anomalia` recién creada con severidad ALTA, **When** el worker la persiste, **Then** publica el evento `analisis.anomalia.detectada` en Motor Notif con destinatarios = usuarios `ADMIN` activos, canales EMAIL + IN_APP, y variables `{{tipoAnomalia}}`, `{{severidad}}`, `{{descripcion}}`, `{{fechaDeteccion}}`, `{{urlAnomalia}}`.
2. **Given** una `Anomalia` con severidad MEDIA o BAJA, **When** el worker la persiste, **Then** NO envía email inmediato; queda registrada para el DigestSemanal (SPEC-223) y el panel (SPEC-222).
3. **Given** el parámetro `analisis.anomalias.email_inmediato_habilitado = false`, **When** se detecta una anomalía ALTA, **Then** se persiste pero no se programa email.
4. **Given** que Motor Notif falla al programar (ej. plantilla inactiva), **When** ocurre el error, **Then** la anomalía queda persistida igualmente y el error se registra en logs (fail-open hacia notificaciones, nunca hacia la detección).
5. **Given** el seed, **Then** existen de forma idempotente la regla `analisis.anomalia.detectada` (rol ADMIN, EMAIL obligatoria + IN_APP) y las plantillas `analisis.anomalia.detectada.email` / `.in_app` en español neutro.

---

### User Story 3 — El admin consulta y resuelve anomalías desde la API (Priority: P2)

Como admin quiero listar las anomalías detectadas con filtros y marcarlas como resueltas, para cerrar el ciclo de cada alerta que recibo.

**Why this priority**: el email del CEO enlaza al detalle; sin endpoint de resolución las anomalías quedarían abiertas para siempre y la deduplicación impediría volver a detectar la condición. La vista enriquecida (gráficas, drill-down) es de SPEC-222; aquí solo la API mínima.

**Independent Test**: llamar `GET /api/admin/analisis/anomalias?severidad=ALTA` con sesión ADMIN y verificar la lista paginada; luego `PATCH /api/admin/analisis/anomalias/[id]` con `{ "resolucion": "Contactado el colegio" }` y verificar `resueltaEn` y `resueltaPorAdminId`.

**Acceptance Scenarios**:

1. **Given** una sesión `ADMIN`, **When** llama `GET /api/admin/analisis/anomalias` con filtros `tipo`, `severidad`, `estado=ABIERTAS|RESUELTAS|TODAS` y paginación estándar, **Then** recibe `{ items, pagination }` ordenado por `detectadaEn` descendente.
2. **Given** una sesión `ADMIN`, **When** llama `GET /api/admin/analisis/anomalias/[id]`, **Then** recibe el detalle con `datosContexto`.
3. **Given** una sesión `ADMIN`, **When** llama `PATCH /api/admin/analisis/anomalias/[id]` sobre una anomalía abierta, **Then** se marcan `resueltaEn` y `resueltaPorAdminId`, se registra `AuditLog` y se retorna la anomalía actualizada.
4. **Given** una anomalía ya resuelta, **When** se intenta resolver de nuevo, **Then** retorna `409`.
5. **Given** una sesión con rol distinto de `ADMIN` (o anónima), **When** llama cualquiera de los endpoints, **Then** retorna `401`/`403` según corresponda.

---

## Edge Cases

- **Semanas con base cero**: si la semana anterior tuvo 0 altas / 0 recaudo / 0 sesiones, no se calcula porcentaje (división por cero); la regla exige una base mínima parametrizable (`analisis.anomalias.base_minima_comparacion`) y se documenta en `datosContexto` cuando se omite por base insuficiente.
- **Frontera de semana Bogotá**: los cortes semanales usan día calendario `America/Bogota` (lunes 00:00 a domingo 23:59), no UTC; un pago autorizado a las 23:59 del domingo cuenta en la semana que cierra.
- **Cliente puntual que ya renovó tarde**: si el pago de renovación se autoriza después de crear la anomalía, esta permanece abierta hasta que el admin la resuelva manualmente (v1 no auto-resuelve).
- **Cancelación masiva que persiste varios días**: la deduplicación es por anomalía abierta; mientras la `CANCELACIONES_MASIVAS_24H` siga abierta no se repite el email, aunque el conteo siga superando el umbral.
- **Suscripción de padre (no colegio) con mora anómala**: la regla de mora aplica a cualquier `tipoTitular`; `sujetoTipo = "Suscripcion"` cubre ambos casos.
- **"Colegio grande" sin reportes por anonimización/retención**: el conteo histórico usa filas de `Reporte` del tenant; si la retención purgó textos, el conteo de filas se conserva (la retención nunca borra filas).
- **Worker caído a mitad de tick**: cada anomalía se persiste en su propia transacción; un fallo en la regla N no impide evaluar la regla N+1, y el advisory lock se libera al morir el proceso.
- **Doble instancia del worker**: la segunda sale con código 2 por advisory lock (patrón de `worker-reportes.mjs` / `monitor-probes.mjs`).
- **CEO sin usuarios ADMIN activos**: si la consulta de destinatarios retorna vacío, se persiste la anomalía y se loguea `[Anomalias] Sin destinatarios ADMIN activos`, sin error.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear el modelo `Anomalia` (migración aditiva, cero `DROP`) con campos `id`, `tipo` (enum `TipoAnomalia`), `sujetoTipo?`, `sujetoId?`, `severidad` (enum `SeveridadAnomalia`: `BAJA`/`MEDIA`/`ALTA`), `descripcion`, `datosContexto` (Json), `detectadaEn`, `resueltaEn?`, `resueltaPorAdminId?`, e índices por `(tipo, detectadaEn DESC)` y `(severidad, detectadaEn DESC)`.
- **FR-002**: El enum `TipoAnomalia` DEBE incluir al menos: `PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL`, `CRECIMIENTO_ANOMALO_CIUDAD`, `USO_CAIDO_ABRUPTO`, `CANCELACION_COLEGIO_GRANDE`, `CAIDA_RECAUDO_CIUDAD`, `CANCELACIONES_MASIVAS_24H`.
- **FR-003**: El sistema DEBE implementar el worker `scripts/worker-anomalias.mjs` con advisory lock de PostgreSQL propio (instancia única, exit 2 si ya hay otra), tick cada `analisis.anomalias.tick_min` minutos (default 60) y `TZ=America/Bogota`.
- **FR-004**: El worker DEBE evaluar en cada tick las 6 reglas del FR-002 como consultas SQL/Prisma deterministas, leyendo umbrales frescos de `ParametroSistema` en cada tick (sin redeploy para tunear).
- **FR-005**: La regla de mora anómala DEBE considerar "históricamente puntual" a una suscripción con ≥2 pagos autorizados reportados a tiempo, y disparar con severidad MEDIA a los `analisis.anomalias.mora_dias_umbral_media` días (default 15) y ALTA a los `analisis.anomalias.mora_dias_umbral_alta` días (default 30) tras `fechaFin` sin renovación autorizada.
- **FR-006**: Las reglas comparativas semanales (crecimiento, recaudo, uso) DEBEN usar semana calendario `America/Bogota` y exigir base mínima `analisis.anomalias.base_minima_comparacion` (default 3) en la semana de referencia para evitar falsos positivos con volúmenes ínfimos.
- **FR-007**: El worker DEBE deduplicar: no crear una `Anomalia` si ya existe una abierta (`resueltaEn IS NULL`) con el mismo `(tipo, sujetoTipo, sujetoId)`.
- **FR-008**: `datosContexto` DEBE contener únicamente agregados numéricos e ids internos (conteos, porcentajes, umbrales aplicados, ventanas); PROHIBIDO incluir texto de reportes, datos de menores o PII de titulares.
- **FR-009**: Al persistir una `Anomalia` de severidad ALTA, el sistema DEBE publicar el evento `analisis.anomalia.detectada` en Motor Notif (`programar` de `src/lib/notificaciones`) con destinatarios = usuarios `ADMIN` activos; severidad MEDIA/BAJA no genera email inmediato.
- **FR-010**: El envío inmediato DEBE respetar el parámetro `analisis.anomalias.email_inmediato_habilitado` (BOOLEAN, default `true`) y ser fail-open: un error de Motor Notif nunca impide persistir la anomalía.
- **FR-011**: El seed DEBE crear de forma idempotente los parámetros `analisis.anomalias.*` (categoría `SYSTEM`), la regla de Motor Notif `analisis.anomalia.detectada` (rol `ADMIN`, canal EMAIL `obligatoria: true` + IN_APP) y las plantillas `analisis.anomalia.detectada.email` / `.in_app` en español neutro (sin voseo).
- **FR-012**: El sistema DEBE exponer `GET /api/admin/analisis/anomalias` (solo `ADMIN`) con filtros `tipo`, `severidad`, `estado` y paginación estándar `{ items, pagination }` (default 25, máx 100).
- **FR-013**: El sistema DEBE exponer `GET /api/admin/analisis/anomalias/[id]` (solo `ADMIN`) con el detalle incluyendo `datosContexto`.
- **FR-014**: El sistema DEBE exponer `PATCH /api/admin/analisis/anomalias/[id]` (solo `ADMIN`) que marque `resueltaEn`/`resueltaPorAdminId`, registre `AuditLog` (sin PII) y retorne `409` si ya estaba resuelta.
- **FR-015**: El sistema DEBE registrar el worker en `scripts/dev-restart.sh` (pkill + nohup, una sola instancia) y como servicio `pi-anomalias` en `docker-compose.prod.yml` con `TZ: America/Bogota`, siguiendo el patrón de `pi-notificaciones`.
- **FR-016**: El sistema DEBE incluir tests Vitest de: cada regla con dataset a favor y en contra, deduplicación por anomalía abierta, severidad MEDIA vs ALTA por umbral de mora, base mínima insuficiente, no-email en MEDIA/BAJA, email en ALTA (Motor Notif mockeado o contra BD de test), fail-open de notificaciones, endpoints 401/403/200/409 y frontera de semana Bogotá.

### Key Entities

- **Anomalia** (nueva): registro de una desviación detectada. Atributos: `id`, `tipo`, `sujetoTipo`, `sujetoId`, `severidad`, `descripcion`, `datosContexto`, `detectadaEn`, `resueltaEn`, `resueltaPorAdminId`.
- **Suscripcion** (existente, SPEC-210): fuente de mora, cancelaciones y altas por ciudad (`colegioId` → `Colegio.ciudadId`; `canceladaEn`, `fechaFin`, `estado`).
- **Pago** (existente, SPEC-210): fuente de puntualidad histórica y recaudo semanal (`estado = AUTORIZADO`, `fechaAutorizacion`, `montoNetoUSD`).
- **SesionLog** (existente): fuente de uso activo por colegio (`tenantId`, `iniciadaEn`).
- **Reporte** (existente): conteo histórico por tenant para "colegio grande" (solo conteo de filas; nunca se lee texto).
- **Ciudad** (existente): sujeto de anomalías geográficas.
- **ParametroSistema** (existente): umbrales `analisis.anomalias.*`.
- **Notificacion / NotificacionRegla / NotificacionPlantilla** (existentes, SPEC-201..204): canal de alerta al CEO; esta spec solo añade registros de catálogo.
- **AuditLog** (existente): trazabilidad de resoluciones.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un dataset de prueba que satisface cada una de las 6 reglas, un solo tick del worker crea exactamente 6 anomalías con tipo, severidad y sujeto correctos.
- **SC-002**: Un segundo tick sobre el mismo dataset crea 0 anomalías nuevas (deduplicación 100% mientras estén abiertas).
- **SC-003**: Una anomalía ALTA genera exactamente 1 notificación programada por canal (EMAIL + IN_APP) por admin activo, en el mismo tick; MEDIA/BAJA generan 0 emails inmediatos.
- **SC-004**: Con `email_inmediato_habilitado = false`, una anomalía ALTA se persiste sin programar notificaciones.
- **SC-005**: Las reglas comparativas no disparan cuando la semana de referencia tiene volumen < `base_minima_comparacion`, ni dividen por cero con base 0.
- **SC-006**: Los endpoints responden `200` con paginación correcta para ADMIN, `401`/`403` para otros roles, y `409` al resolver dos veces; el gate local completo (`npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- <path-SPEC> && npm run build`) queda verde.
- **SC-007**: `./scripts/dev-restart.sh` deja exactamente UN worker de anomalías corriendo; un segundo arranque manual sale con código 2.

---

## Assumptions

- SPEC-220 (modelo Análisis + score) y SPEC-221 (motor de reglas) se implementan en la misma rama del mega-lote antes o en paralelo; esta spec reutiliza sus convenciones de namespace `analisis.*` pero **no depende de `ScoreCliente` ni de `Recomendacion` para detectar**.
- El instructivo 002-PI-126 asigna explícitamente "Modelo Anomalia" a esta spec; por tanto la migración del modelo `Anomalia` se crea AQUÍ y no en SPEC-220 (aunque el brief §15 la agrupe en §5.1-5.7). Si al implementar SPEC-220 ya existiera, se omite la migración duplicada y se reutiliza.
- SPEC-223 (DigestSemanal) consume las anomalías MEDIA/BAJA leyendo la tabla `Anomalia`; esta spec solo garantiza que quedan persistidas con `detectadaEn` en la semana correspondiente.
- SPEC-222 (panel Dinero vs Valor) renderiza las anomalías; esta spec entrega únicamente la API mínima de admin (listar/detallar/resolver) para que el email del CEO tenga destino navegable y el ciclo pueda cerrarse.
- Motor Notif (SPEC-201..204) está operativo con `programar`, reglas por evento/rol/canal y plantillas Markdown; esta spec no modifica el motor, solo siembra un evento nuevo.
- "Históricamente puntual" se define operacionalmente como ≥2 pagos autorizados reportados en o antes de su fecha límite; el criterio exacto de puntualidad se fija en la implementación contra los campos reales de `Pago` y queda documentado en `research.md`.
- El recaudo se mide en USD (`Pago.montoNetoUSD`) para comparabilidad multi-moneda (SPEC-214).
- La zona horaria del negocio es `America/Bogota` en todos los cortes (semana calendario y ventanas de 24h).
- No se crea UI propia; el email enlaza a la ruta del panel de anomalías que entregará SPEC-222 (`/dashboard/admin/estadisticas` tab "Dinero vs Valor"); mientras SPEC-222 no exista, el enlace puede apuntar a la API/vista mínima disponible y se ajusta en el cierre del lote.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

Implementada el 2026-08-24 en la rama `work/002-PI-mega-cola-restante` (mega-lote).

**Modelo y seed**

- `prisma/schema.prisma` (M): valor `ANOMALIA_RESUELTA` al final de `AccionAudit` + `@@index([resueltaEn])` en `Anomalia`.
- `prisma/migrations/20260824110000_spec_225_anomalias_indice_audit/migration.sql` (A): índice `anomalias_resuelta_en_idx` + `ALTER TYPE AccionAudit ADD VALUE` guardado con `pg_enum`. Aditiva, cero DROP.
- `prisma/seed.ts` (M): `seedAnomalias()` — 7 parámetros `analisis.anomalias.*` (los otros 3 los siembra SPEC-220), regla Motor Notif `analisis.anomalia.detectada` (ADMIN, EMAIL + IN_APP obligatorias) y plantillas `.email`/`.in_app`. Idempotente.

**Detector (sin IA, 100% reglas)**

- `src/lib/dal/repositories/anomalia-repository.ts` (A): frontera DAL (Q-3) — lecturas por regla, dedup+create atómico (`crearSiNoExisteAbierta`, una TX por anomalía), ADMINs activos, consultas de la API admin.
- `src/lib/analisis/anomalias/` (A): `tipos.ts`, `ventanas.ts` (semana calendario Bogotá), `comparativas.ts` (base mínima, sin división por cero), `puntualidad.ts` (definición operacional H-6: `fechaReporte ≤ fechaInicio + meses cubiertos + 3 días de tolerancia`), `parametros.ts` (10 umbrales frescos por tick), 6 reglas en `reglas/`, `alertas.ts` (evento Motor Notif, fail-open), `detector.ts` (orquestador), `resolucion.ts` (PATCH + AuditLog), `fixtures.ts` (helpers de tests).

**API admin (solo ADMIN)**

- `GET /api/admin/analisis/anomalias` — filtros `tipo`/`severidad`/`estado` + paginación estándar (`route.ts`).
- `GET|PATCH /api/admin/analisis/anomalias/[id]` — detalle con `datosContexto`; PATCH resuelve (409 si ya resuelta, nota opcional con merge aditivo, AuditLog `ANOMALIA_RESUELTA`).

**Worker e infra**

- `scripts/worker-anomalias.mjs` (A): advisory lock `123456795` (exit 2 si hay otra instancia), tick releído de `analisis.anomalias.tick_min` en cada ciclo, `--run-once`, TZ Bogotá.
- `scripts/dev-restart.sh` (M): pkill + nohup del worker (una instancia).
- `docker-compose.prod.yml` (M): servicio `pi-anomalias` (TZ America/Bogota, healthcheck PID 1).

**Tests** (FR-016): unitarios puros (`ventanas`, `comparativas`, `puntualidad`, `alertas` con motor mockeado — 22 tests, verdes) e integración escritos bajo `src/**` (DAL, 6 reglas a favor/en contra, orquestador SC-001..SC-004, rutas 200/400/401/403/404/409) para correr contra la BD compartida en el gate del coordinador.

### Decisiones ejecutadas

- **H-1 (desviación aprobada por la propia spec §Assumptions)**: el modelo `Anomalia` YA existía (SPEC-220, migración `20260824061000_analisis_modelo_score`) con `tipo`/`severidad` como `String` de valores cerrados. Se REUTILIZA: no se crean los enums `TipoAnomalia`/`SeveridadAnomalia` de data-model.md (convertir String→enum sería no aditivo); los valores cerrados se tipan como uniones de literales en `tipos.ts`. Tampoco existía `@@index([resueltaEn])`: se añadió de forma aditiva.
- **H-2**: SPEC-220 ya sembraba 3 de los 10 parámetros; esta spec siembra los 7 restantes.
- **H-6**: "pago puntual" = `fechaReporte` ≤ `fechaInicio` + meses acumulados de pagos autorizados anteriores + tolerancia fija de 3 días (el modelo `Pago` no guarda el período cubierto; documentado en `puntualidad.ts`).
- **H-8**: `notaResolucion` se conserva con merge aditivo en `datosContexto.notaResolucion` (opción 1 del contrato).
- Advisory lock: `123456795` (verificado libre: en uso 123456789–123456794, 923456789, 987654321).
- `urlAnomalia` apunta a `/dashboard/admin/estadisticas` (la página existe; el tab "Dinero vs Valor" lo monta SPEC-222 en el mismo lote, §Assumptions).

### Gate local

- `npx tsc --noEmit`: archivos de SPEC-225 limpios (los únicos errores del árbol son de SPEC-222 en progreso, ajenos a esta spec).
- `npm run test:unit -- src/lib/analisis/anomalias`: **22/22 verdes** (vitest unit config, sin cobertura por subset).
- `npx eslint` sobre los archivos propios: limpio (0 errores; solo warning preexistente de complejidad en `prisma/seed.ts` `main`).
- `npx prisma generate`: OK. `node --check scripts/worker-anomalias.mjs`: OK. `bash -n scripts/dev-restart.sh`: OK.
- Tests de integración: escritos, NO corridos localmente (BD compartida del mega-lote; los corre el coordinador).

### Deuda técnica / notas

- Tests de integración pendientes de ejecución en el gate del coordinador (BD compartida).
- v1 no auto-resuelve anomalías cuando la condición desaparece (research §3.3, candidata v2).
- Suscripciones de titular PADRE no participan en reglas geográficas (sin ciudad en v1, research §2.3).
- Retención de `anomalias` no definida en v1 (data-model §6: radicar spec aparte si el volumen lo justifica).
- `prisma/seed.ts` `main` supera el umbral de complejidad de lint (warning preexistente, no introducido por esta spec).
