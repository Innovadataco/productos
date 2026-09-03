# INSTRUCTIVO-REPLICA-006.md · Activación de la réplica read-only de PI en BI v2

> Para Jelkin Zair Carrillo Franco · ejecutar en el VPS (pi-vps).
> Sin valores de contraseñas en este documento — solo NOMBRES de variables.
> Los valores viven en el gestor de contraseñas IDC y en `.env.bi.production`
> (permisos 600, fuera de git) — ver `INVENTARIO-DE-SECRETOS.md` del repo de gestión.
> Producto 006 · BI v2 · F3C 2026-09-01.

---

## Arquitectura en un párrafo

BI v2 tiene **UN solo Postgres propio** (contenedor `bi-db`, imagen
`pgvector/pgvector:pg16`) que contiene tres cosas:

1. **Tablas replicadas read-only de PI** — llegan vía pg_logical: suscripción
   `bi006_replica_sub` → publicación `bi_replica` en el Postgres de PI
   (slot de replicación NUEVO: `bi006_replica_slot`).
2. **Tablas propias del 006** — `bi_catalogo_*`, `bi_consulta_log`,
   `bi_cache_semantico` (las crea `prisma migrate deploy`, no la réplica).
3. **Vistas materializadas `mv_fact_*`** — las crea `05-mv-fact.sql` SOLO con
   la réplica ya activa (referencian tablas replicadas de PI). **NUNCA van en
   migración Prisma ni en CI** (T4: la CI migra su BD vacía y rompería).

| Script | Dónde corre | Cuándo |
|---|---|---|
| `01-pi-db-crear-usuario-replica.sql` | Postgres de **PI** (publicador) | Una vez · idempotente |
| `02-pi-db-publicacion.sql` | Postgres de **PI** (publicador) | Una vez · idempotente |
| `03-bi-db-replica-suscripcion.sql` | **bi-db** (suscriptor) | Activación |
| `04-verificar-replica.sql` | **bi-db** (suscriptor) | Verificación (Tests 7/8) |
| `05-mv-fact.sql` | **bi-db** (suscriptor) | Tras la sincronización inicial |
| `06-bi-db-recorte-pii.sql` | **bi-db** (suscriptor) | Defensa en profundidad PII |
| `07-bi-db-limpieza-legacy.sql` | **bi-db** (suscriptor) | Tras retirar legacy del canon (02) |

## Estado heredado del 005 (Fase A · 2026-08-28 · verificado con CEO)

En el Postgres de PI **YA EXISTE** (no hace falta recrearlo; los scripts 01 y
02 son idempotentes y solo verifican/reconcilian):

- `wal_level=logical` activo en pi-db.
- Rol `bi_replica` con atributo REPLICATION (password en el gestor IDC).
- Publicación `bi_replica` con las 23 tablas originales SIN column lists. El
  script 02 (reescrito 2026-09-01) la reconcilia a la lista canónica de **36
  tablas**, 15 de ellas con **column list que corta PII en origen** (ver §
  Prohibición PII). El mismo día salieron del canon las 4 legacy vacías
  (`Subscription`, `BillingCycle`, `FuenteReporte`, `AlertaSuscripcion`) —
  el script 07 dropea sus shells en bi-db.

El **slot del 005 ya fue eliminado**: BI v2 crea suscripción y slot NUEVOS
(`bi006_replica_sub` / `bi006_replica_slot`). No reutilizar nada del stack del
005 (contenedores apagados por decisión del CEO).

## Variables de entorno necesarias (SOLO nombres · las crea Jelkin)

En `.env.bi.production` (clon `/opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO/`):

| Variable | Qué es |
|---|---|
| `REPLICA_DB_USER` | Superusuario de arranque de bi-db (`POSTGRES_USER` del contenedor) |
| `REPLICA_DB_PASSWORD` | Su contraseña (`POSTGRES_PASSWORD`) |
| `REPLICA_DB_NAME` | Base de datos única del 006 en bi-db (sugerido: `bi`) — réplica + tablas propias |
| `DATABASE_URL` | URL completa app/prisma con rol `bi_admin`: `postgresql://bi_admin:<pwd>@bi-db:5432/<REPLICA_DB_NAME>` |
| `BI_ADMIN_DB_PASSWORD` | Contraseña del rol `bi_admin` (la misma embebida en `DATABASE_URL`; se usa al crear el rol en B-3) |
| `BI_READER_PASSWORD` | Contraseña del rol `bi_reader` (analítica solo-lectura · Fase 2) |
| `PI_REPLICA_USER` | Rol de replicación en PI (`bi_replica` · ya existe) |
| `PI_REPLICA_PASSWORD` | Su contraseña (gestor IDC · creada en Fase A del 005) |
| `PI_DB_HOST` | Hostname de pi-db alcanzable desde bi-db (nombre del contenedor pi-db en la red Docker compartida de PI) |
| `PI_DB_NAME` | Base publicadora en PI (`proteccion_infantil`) |
| `PI_NET_NAME` | Red Docker externa de PI que bi-db debe unir (la define el compose) |

> Regla de oro: los passwords reales solo en el gestor IDC y en
> `.env.bi.production`. Nunca en chat, commits ni en este documento (I-22).

**Paso 0 · cargar el entorno** (desde `/opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO`):

```bash
cd /opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO
set -a; source ./.env.bi.production; set +a
```

---

## PASO A · Postgres de PI (publicador)

> ⚠️ REGLA DURA: en PI **jamás** se corre DML ni DDL sobre tablas de negocio.
> Los pasos A-2/A-3 solo crean/verifican el rol de replicación y la
> publicación. Requieren autorización expresa de Jelkin.

**A-1 · Verificar `wal_level=logical`** (ya activo desde Fase A del 005):

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil -c 'SHOW wal_level;'
# Esperado: logical
```

**A-2 · Rol de replicación** (idempotente: si `bi_replica` ya existe no toca su password):

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil -v ON_ERROR_STOP=1 \
  -v bi_replica_password="$PI_REPLICA_PASSWORD" \
  < scripts/replica-setup/01-pi-db-crear-usuario-replica.sql
# Esperado: "[01] Rol bi_replica ya existe — password intacto" · verificación bi_replica | t
```

**A-3 · Publicación `bi_replica`** (idempotente: reconcilia las 40 tablas canónicas
con sus column lists anti-PII y **falla en voz alta si detecta PII publicada** —
tabla prohibida o columna vetada — Ley 1581):

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil -v ON_ERROR_STOP=1 \
  < scripts/replica-setup/02-pi-db-publicacion.sql
# Esperado: NOTICE "[02] Reconciliación completa: 40 tablas en bi_replica" ·
# resumen con tiene_column_list = t en las 15 tablas con recorte ·
# SIN Usuario/Password/Session/TokenRecuperacion ni el resto de prohibidas
```

---

## PASO B · bi-db (suscriptor · Postgres propio del 006)

**B-1 · Levantar bi-db y esperar healthy** (~30 s):

```bash
docker compose -f docker-compose.bi.yml up -d bi-db
docker compose -f docker-compose.bi.yml ps bi-db
# Esperado: Up (healthy)
```

**B-2 · Volcar el SCHEMA de PI en bi-db (OBLIGATORIO antes de la suscripción)**

> pg_logical replica DATOS, no SCHEMA. Sin este paso, `CREATE SUBSCRIPTION`
> aborta con `relation "Reporte" does not exist`. El volcado es SOLO estructura
> (sin datos): las tablas PII quedan creadas pero VACÍAS para siempre — la
> publicación nunca las llena (ver § Prohibición PII).

```bash
# 1. Volcar schema de PI (sin datos · sin dueños · sin permisos)
#    El sed vuelve idempotente el "CREATE SCHEMA public;" que pg_dump emite
#    (los GRANTs del script 01 marcan el schema como modificado y pg_dump lo
#    vuelca; sin el ajuste, el paso 4 aborta con ON_ERROR_STOP=1 — verificado
#    en prueba en vivo 2026-09-01).
PI_DB=$(docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml ps -q pi-db)
docker exec "$PI_DB" pg_dump -U proteccion -d proteccion_infantil -n public \
  --schema-only --no-owner --no-privileges --no-acl \
  | sed 's/^CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS public;/' \
  > /tmp/pi_schema.sql

# 2. Copiar al contenedor bi-db
BI_DB=$(docker compose -f docker-compose.bi.yml ps -q bi-db)
docker cp /tmp/pi_schema.sql "$BI_DB":/tmp/

# 3. Extensión pgvector (la usa el schema de PI y el cache semántico del 006)
docker exec "$BI_DB" psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Aplicar el schema
docker exec "$BI_DB" psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" \
  -v ON_ERROR_STOP=1 -f /tmp/pi_schema.sql

# 5. Limpiar el archivo temporal del host
rm /tmp/pi_schema.sql
```

**B-3 · Roles de la app + suscripción** (script 03 · idempotente · secretos por
variables psql, nunca en archivos):

```bash
docker compose -f docker-compose.bi.yml exec -T bi-db \
  psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" -v ON_ERROR_STOP=1 \
  -v bi006_admin_password="$BI_ADMIN_DB_PASSWORD" \
  -v bi006_reader_password="$BI_READER_PASSWORD" \
  -v bi006_conninfo="host=$PI_DB_HOST port=5432 dbname=$PI_DB_NAME user=$PI_REPLICA_USER password=$PI_REPLICA_PASSWORD" \
  < scripts/replica-setup/03-bi-db-replica-suscripcion.sql
```

> Si algún password contiene espacios o comillas simples, encerrarlo así dentro
> del conninfo: `password='$PI_REPLICA_PASSWORD'`.
> El script crea `bi_admin` (app/prisma) y `bi_reader` (solo lectura) si faltan,
> y la suscripción `bi006_replica_sub` con slot `bi006_replica_slot`.
> Esperado: `bi006_replica_sub | t | bi006_replica_slot`.
>
> **Nota de pruebas locales:** la suscripción exige que publicador y suscriptor
> sean INSTANCIAS distintas de Postgres (en producción lo son: pi-db y bi-db).
> Crearla dentro de la MISMA instancia (p. ej. dos bases en un solo contenedor
> de prueba) se auto-bloquea: el snapbuild del slot espera que termine la
> propia transacción del `CREATE SUBSCRIPTION` (verificado 2026-09-01). Para
> pruebas locales usar dos contenedores.

**B-4 · Esperar la copia inicial y verificar** (Tests 7 y 8):

```bash
# Esperar ~30 s (o más según volumen de PI) y verificar:
docker compose -f docker-compose.bi.yml exec -T bi-db \
  psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" \
  < scripts/replica-setup/04-verificar-replica.sql
# Esperado: wal receiver status=streaming · 40 tablas en 'r' (o 's')
```

TEST 7 (paridad de counts master↔réplica) y TEST 8 (INSERT rechazado por
`bi_reader`) están en el propio script 04 con sus comandos exactos.
⚠️ **REGLA DE ABORTO (Test 8): si la réplica ACEPTA el INSERT → PARA · avisar
al CEO · NO se emite CUMPLE.** Pegar ambos outputs en el `cierre.md` de la SPEC.

**B-5 · Migraciones Prisma del catálogo BI + seed** (tablas propias `bi_*`):

```bash
docker compose -f docker-compose.bi.yml run --rm bi-next npx prisma migrate deploy
docker compose -f docker-compose.bi.yml run --rm bi-next npm run db:seed
# Esperado: migraciones aplicadas · seed idempotente (upsert con update vacío, S3)
```

**B-6 · Vistas materializadas `mv_fact_*`** (script 05 · SOLO con la réplica activa):

```bash
docker compose -f docker-compose.bi.yml exec -T bi-db \
  psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" -v ON_ERROR_STOP=1 \
  < scripts/replica-setup/05-mv-fact.sql
# Esperado: pre-flight OK · 5 MVs en pg_matviews con ispopulated = t
```

**B-7 · Ratchet de índices post-migración** (A-45):

```bash
docker compose -f docker-compose.bi.yml run --rm bi-next \
  node scripts/verificar-indices-post-migrate.mjs
# Esperado: "[INDICES] OK" en los índices canónicos · exit 0
```

---

## ⚠️ REGLA DEL SLOT (4e) · leer antes de apagar o retirar la réplica

**Apagar bi-db un rato NO pasa nada.** PI acumula los cambios (WAL retenido por
el slot) y al volver a encender, la réplica los drena sola. Si la réplica va a
estar apagada DÍAS, vigilar el disco de PI periódicamente.

**Retirar la réplica DE FORMA PERMANENTE** (borrar el contenedor/volumen de
bi-db, migrar de servidor, desmantelar BI) **EXIGE eliminar el slot de
replicación.** Si no se hace, el slot huérfano retiene WAL para siempre:
`pg_wal` crece hasta **llenar el disco de PI y TUMBAR PI** (el servicio de
protección infantil se cae). Es la regla 4e · no tiene excepciones.

Procedimiento de retiro permanente:

```bash
# 1. Si bi-db AÚN EXISTE: DROP SUBSCRIPTION elimina el slot en PI automáticamente
docker compose -f docker-compose.bi.yml exec -T bi-db \
  psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" \
  -c "DROP SUBSCRIPTION IF EXISTS bi006_replica_sub;"

# 2. Si bi-db YA NO EXISTE (se borró sin DROP): eliminar el slot a mano en PI
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil \
  -c "SELECT pg_drop_replication_slot('bi006_replica_slot');"

# 3. Verificar SIEMPRE en PI que el slot desapareció
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil \
  -c "SELECT slot_name, active FROM pg_replication_slots;"
# Esperado: bi006_replica_slot NO aparece
```

Monitoreo rutinario del WAL retenido (corre en PI):

```sql
SELECT slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS wal_retenido
FROM pg_replication_slots WHERE slot_name = 'bi006_replica_slot';
-- wal_retenido grande y creciendo con active = f → la réplica lleva tiempo
-- apagada: encenderla para que drene, o decidir retiro permanente (arriba).
```

---

## ⛔ Prohibición PII (Ley 1581 · no negociable)

Desde la reescritura del script 02 (2026-09-01 · SPEC-006), la publicación
`bi_replica` usa **column lists de PostgreSQL 16 que CORTAN PII EN ORIGEN**:
las columnas vetadas ni siquiera salen de pi-db por el slot (defensa en
profundidad sobre el REVOKE del script 01).

### Lista canónica de tablas (40)

**15 con column list anti-PII** (solo se publican las columnas listadas):

| Tabla | Columnas vetadas (NUNCA salen de PI) |
|---|---|
| `Reporte` | `identificador` (nick del reportado), `texto`, `textoOriginal`, `usuarioId`, `operadorId`, `comiteId`, `eliminadoPorId`, `anonimizacionValidadaPorId`, `processingError`, `notaBaja`, `ciudad`, `pais`, `otraPlataforma` (texto libre) |
| `Alumno` (@@map de `Estudiante`) | `nombre`, `apellidos`, `documentoTipo`, `documentoNumero` |
| `IdentificadorAlumno` (@@map de `IdentificadorEstudiante`) | `valor` |
| `Colegio` | `representanteLegalNombre`, `representanteLegalIdentificacion`, `representanteLegalEmail`, `representanteLegalTelefono` |
| `AuditLog` | `ipAddress`, `userAgent`, `valorAnterior`, `valorNuevo` |
| `Profesor` | `nombre`, `apellidos`, `tipoDocumento`, `numeroDocumento`, `email`, `telefono` |
| `AcudienteEstudiante` | `nombre`, `telefono`, `email` |
| `IdentificadorAcudiente` | `valor` |
| `IdentificadorProfesor` | `valor` |
| `Hijo` | `nombre`, `apellidos`, `documentoTipo`, `documentoNumero` |
| `IdentificadorHijo` | `valor` |
| `ContactoConfianza` | `nombre`, `etiqueta`, `nota` |
| `IdentificadorContacto` | `valor` |
| `IdentificadorReportado` | `identificador` (nick en claro; viajan solo los agregados: conteos, scores, `nivelRiesgo`, `ultimoReporteEn`, …) |
| `Suscripcion` | `contratoPDFUrl`, `codigoReferidoPropio`, `codigoReferidoUsado`, `motivoCancelacion`, `referenciaPagoManual` |

**21 completas** (sin PII por diseño): `ClasificacionIA`,
`clasificacion_rubrica_votos`, `CorreccionAdmin`, `EmbeddingReporte`,
`TransicionReporte`, `SolicitudComite`, `Plan`, `Tenant`, `Curso`,
`AlertaColegio`, `Plataforma`, `Pais`, `Departamento`, `Ciudad`, `HijoPadre`,
`patrones_institucionales`, `eventos_match`, `score_clientes`,
`DerivaMotorSnapshot`, `OnboardingColegio`, `TipoDocumento`.

Las 4 **legacy** del 005 (`Subscription`, `BillingCycle`, `FuenteReporte`,
`AlertaSuscripcion`) fueron **retiradas del canon el 2026-09-01** (vacías en
PI y en la réplica; verificado). El reconciliador del script 02 (paso 3b) las
quita de la publicación solo si siguen vacías; el script 07 dropea sus shells
en bi-db tras el `REFRESH PUBLICATION`.

### Tablas JAMÁS publicadas (ni con column list)

`Usuario`, `Password`, `Session`, `TokenRecuperacion`, `CodigoVerificacion`,
`ParametroSistema`, `CargaRosterSesion`, `DatasetEntrenamiento`,
`DocumentoApelacion`, `AccesoDocumentoApelacion`, `block_list`,
`IntegranteComite`, `PerfilOperador`, `ContactoEmergencia` /
`contactos_emergencia`, `EventoExpediente`, `NotaSeguimiento`,
`AclaracionExpediente` / `aclaracion_expediente`, `InformeConsolidado` /
`informes_consolidados`, `Apelacion`, `AnalisisExpediente`, `InformePadre`,
`TokenRegistro`, `notificaciones`, `HealthProbe`, `worker_logs`, `RateLimit`,
`demo_marcado`, `simulacion_runs`, `simulacion_reportes`,
`simulacion_abuso_runs`, `sesiones_log`, `audit_consentimientos` — datos de
menores, credenciales, configuración sensible o texto libre. Tampoco
**`senal_comunitaria_cache`**: su PK (`identificadorReportado`) ES el nick en
claro y PostgreSQL exige incluir la replica identity en la column list, así
que es imposible publicarla sin PII; la señal comunitaria se deriva en BI de
`IdentificadorReportado` + `eventos_match`.

### Mecanismos de guarda

- El script **02 falla en voz alta** (RAISE EXCEPTION + ON_ERROR_STOP) si
  detecta una tabla prohibida publicada o una columna vetada dentro de la
  column list publicada (o publicada completa). También aborta (B2) si alguna
  tabla canónica no existe en el master.
- El script **01** revoca el SELECT de esas tablas al rol `bi_replica`
  (defensa en profundidad).
- El volcado de schema (paso B-2) crea las tablas PII **vacías** en bi-db: es
  solo estructura, pg_logical nunca las llena porque no están publicadas. Las
  columnas vetadas de tablas publicadas existen en bi-db pero quedan siempre
  a NULL (pg_logical no las envía).
- **Agregar una tabla nueva a la publicación exige pedirla por nombre y
  autorización de Jelkin** (AGENTS.md §7). Las 40 actuales son la lista
  canónica autorizada.

---

## Operación continua (riesgos conocidos)

- **Cambios de DDL en PI sobre tablas replicadas** (columna nueva, tipo
  cambiado): pg_logical NO replica DDL — la copia de esa tabla se detiene hasta
  aplicar el mismo cambio (aditivo) a mano en bi-db. Coordinar con el equipo de
  PI; después actualizar catálogo BI y MVs si aplica (proceso manual, heredado
  del 005). NO re-correr el paso B-2 completo (las tablas ya existen).
- **Salud de réplica y MVs**: el endpoint `/api/bi/estado-sistema` (consultado
  por el healthcheck del contenedor `bi-next`) debe reflejar lag de réplica y
  MVs pobladas. Si la réplica se desactualiza o una MV se rompe, el
  healthcheck lo detecta.
- **Refresco de MVs**: los refrescos programados (Fase 2+) usan
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` — habilitado por los UNIQUE INDEX
  que crea `05-mv-fact.sql` (D-26). Nunca refrescar con el script 05 en rutina:
  ese REFRESH es el inicial.
