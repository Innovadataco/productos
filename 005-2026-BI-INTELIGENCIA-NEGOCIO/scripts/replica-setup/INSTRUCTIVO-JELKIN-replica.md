# INSTRUCTIVO-JELKIN-replica.md · Setup réplica pg_logical

> Para Jelkin Zair Carrillo Franco · ejecutar en VPS pi-vps
> Sin valores de contraseñas en este documento · consultar gestor de contraseñas IDC
> F3C: 2026-08-28 · Autor: bi-dev-2

---

## Resumen de fases

| Fase | Quién | Dónde | Duración |
|---|---|---|---|
| **Fase A** · Habilitar wal_level=logical | Jelkin | pi-db (VPS) | ~60 seg downtime |
| **Fase B** · Código BI | BI-DEV-2 | Mac / GitHub | 2 días |
| **Fase C** · Deploy + replica + tests | Jelkin | VPS | ~30 min |

Fase A y Fase B corren EN PARALELO. Fase C requiere ambas completas.

---

## FASE A · Habilitar replicación lógica en pi-db (~60 seg downtime)

> Madrugada recomendada (bajo tráfico). Avisa a Fábrica antes de ejecutar.

**Paso A-1:** Modificar `postgresql.conf` de pi-db

```bash
# En VPS, con acceso al contenedor pi-db
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec pi-db bash -c "
  echo 'wal_level = logical' >> /var/lib/postgresql/data/postgresql.conf
  echo 'max_replication_slots = 10' >> /var/lib/postgresql/data/postgresql.conf
  echo 'max_wal_senders = 10' >> /var/lib/postgresql/data/postgresql.conf
"
```

**Paso A-2:** Reiniciar pi-db (~60 seg downtime)

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml restart pi-db
```

**Paso A-3:** Verificar WAL level

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil -c "SHOW wal_level;"
# Esperado: logical
```

**Paso A-4:** Crear usuario bi_replica (reemplazar `<password_bi_replica>` con el valor del gestor de contraseñas)

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil \
  -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/scripts/replica-setup/01-pi-db-crear-usuario-replica.sql
```

> Editar el SQL antes de ejecutar: reemplazar `<password_bi_replica>`.

**Paso A-5:** Crear publicación de 23 tablas operativas

```bash
docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
  psql -U proteccion -d proteccion_infantil \
  -f /opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO/scripts/replica-setup/02-pi-db-publicacion.sql
```

**Paso A-6:** Señal a Fábrica BI-2 vía Jelkin

```
jelkin: Fase A completa · wal_level=logical + bi_replica user + PUBLICATION bi_replica · listo para Fase C
```

---

## FASE C · Deploy + réplica + Tests 7 y 8

> Pre-requisito: Fase A completa Y Fase B REALIZADO con push.

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
