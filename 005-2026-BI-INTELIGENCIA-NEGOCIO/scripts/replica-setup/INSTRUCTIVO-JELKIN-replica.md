# INSTRUCTIVO-JELKIN-replica.md · Setup réplica pg_logical

> Para Jelkin Zair Carrillo Franco · ejecutar en VPS pi-vps
> Sin valores de contraseñas en este documento · consultar gestor de contraseñas IDC
> F3C: 2026-08-28 · Autor: bi-dev-2

---

## Resumen de fases

| Fase | Quién | Dónde | Estado |
|---|---|---|---|
| **Fase A** · Habilitar wal_level=logical | Fábrica BI-2 | pi-db (VPS) | ✅ COMPLETADA 2026-08-28 |
| **Fase B** · Código BI | BI-DEV-2 | Mac / GitHub | ⏳ en progreso |
| **Fase C** · Deploy + replica + tests | Jelkin | VPS | ⏳ espera Fase B |

Fase A ✅ COMPLETA. Fase C requiere Fase B REALIZADO.

---

## Fase A · ✅ COMPLETADA POR FÁBRICA BI-2 · 2026-08-28

**NO RE-EJECUTAR.** Fábrica BI-2 completó Fase A en vivo con Jelkin el 2026-08-28:
- `wal_level=logical` activo en pi-db (verificado con `SHOW wal_level`)
- Usuario `bi_replica` creado con REPLICATION + SELECT ALL + DEFAULT PRIVILEGES
- PUBLICATION `bi_replica` creada con 23 tablas D-20 (nombre `clasificacion_rubrica_votos` con @@map corregido)
- Password de `bi_replica` guardado en `/opt/proteccion-infantil/bi-repo/.env.bi.production`
  (permisos 600 · variable `PI_REPLICA_PASSWORD`)
- Downtime real: ~2-3 seg (mucho menor a los 60 seg estimados)
- Evidencia: REPORTE-017 en `06-COMUNICACIONES/REPORTES-A-CEO/`

**Si por alguna razón hay que re-ejecutar Fase A (rollback · migración · siniestro):**
consultar con Fábrica BI-2 antes · los pasos originales están en el REPORTE-017 §2
para referencia histórica · no ejecutar sin coordinar.

---

## FASE C · Deploy + réplica + Tests 7 y 8

> Pre-requisito: Fase A completa Y Fase B REALIZADO con push.

**Paso 0 · Clone inicial del repo BI en VPS** (solo primera vez · si el repo no existe aún)

```bash
git clone --branch feature/bi-scaffolding git@github.com:Innovadataco/productos.git /opt/proteccion-infantil/bi-repo
```

El `.env.bi.production` creado por Fábrica en Fase A vive en:
`/opt/proteccion-infantil/bi-repo/.env.bi.production` (permisos 600).
Los deploy posteriores usan `git reset --hard origin/<branch>` — el `.env.bi.production` no está en git y no se sobreescribe.

**Uso de `.env.bi.production`:** el archivo ya está en `/opt/proteccion-infantil/bi-repo/.env.bi.production`
con `PI_REPLICA_USER=bi_replica` y `PI_REPLICA_PASSWORD=...` seteados por Fábrica en Fase A (2026-08-28).
NO recrear el archivo. Fase C solo AGREGA las variables restantes al mismo archivo:
JWT_SECRET · SUPERSET_DB_PASSWORD · SUPERSET_SECRET_KEY · SUPERSET_ADMIN_PASSWORD ·
REPLICA_DB_PASSWORD (bi_reader) · TELEGRAM_BOT_TOKEN · TELEGRAM_AUTHORIZED_CHATS.
Usar `>>` (append), no `>` (overwrite).

**Paso C-1:** Deploy del stack BI

```bash
bash /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/scripts/deploy-bi-prod.sh
```

**Paso C-2:** Esperar que bi-db-replica esté healthy (~30 seg)

```bash
docker compose -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/docker-compose.bi.yml \
  ps bi-db-replica
# Esperado: Up (healthy)
```

**Paso C-2b · Aplicar schema de pi-db en bi-db-replica (OBLIGATORIO antes de CREATE SUBSCRIPTION)**

> pg_logical replica DATOS no SCHEMA. Sin este paso, `CREATE SUBSCRIPTION` falla con `relation Tenant does not exist`.

```bash
# 1. Volcar schema de pi-db (sin datos · sin permisos · sin ACL)
docker exec $(docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml ps -q pi-db) \
  pg_dump -U proteccion -d proteccion_infantil -n public \
  --schema-only --no-owner --no-privileges --no-acl \
  > /tmp/pi_schema.sql

# 2. Nombre del contenedor bi-db-replica (adaptar si difiere)
BI_REPLICA=$(docker compose -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/docker-compose.bi.yml ps -q bi-db-replica)

# 3. Copiar schema al contenedor réplica
docker cp /tmp/pi_schema.sql ${BI_REPLICA}:/tmp/

# 4. Instalar extensión pgvector (necesaria si schema PI la usa)
docker exec ${BI_REPLICA} psql -U ${REPLICA_DB_USER} -d proteccion_infantil \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Aplicar schema
docker exec ${BI_REPLICA} psql -U ${REPLICA_DB_USER} -d proteccion_infantil \
  -f /tmp/pi_schema.sql

# 6. Limpiar
rm /tmp/pi_schema.sql
```

**Paso C-3:** Crear usuario bi_reader y suscripción en bi-db-replica

Editar `03-bi-db-replica-suscripcion.sql` reemplazando:
- `<password_bi_reader>` → contraseña para bi_reader (inventar nueva · guardar en gestor)
- `<host_pi_db>` → nombre del contenedor pi-db en la red Docker (`docker network inspect 002-2026-proteccion-infantil_default | grep pi-db`)
- `<password_bi_replica>` → la misma que usaste en Fase A

```bash
docker compose -f docker-compose.bi.yml exec bi-db-replica \
  psql -U bi_reader -d proteccion_infantil \
  -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/scripts/replica-setup/03-bi-db-replica-suscripcion.sql
```

**Paso C-4:** Esperar 30 seg y ejecutar verificación

```bash
docker compose -f docker-compose.bi.yml exec bi-db-replica \
  psql -U bi_reader -d proteccion_infantil \
  -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/scripts/replica-setup/04-verificar-replica.sql
```

**Paso C-5: TEST 7 · Paridad master↔réplica** (pegar output en `cierre.md`)

```bash
# En pi-db (master):
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'

# En réplica:
psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'

# Repetir para Colegio y Subscription
# Criterio: counts iguales o réplica ≤ master con lag < 10s
```

**Paso C-5b · Aplicar migraciones Prisma del catálogo BI (SPEC-007 + SPEC-009)**

> El schema del catálogo BI (`bi_catalogo_*` + 5 vistas materializadas) se aplica con Prisma migrate deploy. Usa el rol `bi_admin` (variable `BI_ADMIN_DATABASE_URL` en `.env.bi.production`).

```bash
cd /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO

# 1. Crear rol bi_admin (solo primera vez)
docker compose -f docker-compose.bi.yml exec bi-db-replica \
  psql -U ${REPLICA_DB_USER} -d ${REPLICA_DB_NAME} \
  -c "CREATE USER bi_admin WITH PASSWORD '${BI_ADMIN_PASSWORD}';"

docker compose -f docker-compose.bi.yml exec bi-db-replica \
  psql -U ${REPLICA_DB_USER} -d ${REPLICA_DB_NAME} <<'SQL'
GRANT USAGE ON SCHEMA public TO bi_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bi_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bi_admin;
SQL

# 2. Aplicar migraciones desde el host (con DATABASE_URL apuntando a bi-db-replica)
export DATABASE_URL="$(grep '^BI_ADMIN_DATABASE_URL=' .env.bi.production | sed 's/^BI_ADMIN_DATABASE_URL=//')"
npx prisma migrate deploy

# 3. Seed idempotente del catálogo (SPEC-008)
npx prisma db seed
```

Esperado:
- `20260828120000_schema_catalogo_bi_inicial` aplicada · 6 tablas `bi_catalogo_*`
- `20260828120100_mv_fact_bi` aplicada · 5 vistas materializadas
- Seed: 15 tablas, 81 columnas, 15 métricas, 30 ejemplos

**Paso C-6: TEST 8 · INSERT rechazado** ⚠️ REGLA DE ABORTO (pegar output en `cierre.md`)

```bash
psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil \
  -c "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test-bi-dev', 'test');"
```

**Resultado esperado:** `ERROR: cannot execute INSERT in a read-only transaction`
  o `ERROR: permission denied for table Colegio`

⚠️ **Si la réplica ACEPTA el INSERT → PARA · avisa CEO · NO se emite CUMPLE. No continuar.**

**Paso C-7:** Señal a Fábrica BI-2

```
jelkin: Fase C completa · deploy OK · Tests 7/8 pegados en cierre.md
```

---

> **Regla de oro:** los passwords reales solo en el gestor de contraseñas IDC y en `.env.bi.production` en el VPS. Nunca en chat, commits ni este documento.
