# SPEC-002 · Docker Compose BI + réplica pg_logical

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 002 |
| **Nombre** | docker-compose-replica-pg-logical |
| **Origen** | BI · INSTRUCTIVO-002 (+ enmienda `1eaa214`) · F3C 2026-08-28 COT |
| **Brief** | BI · A-01 (setup infra BI Fase 1) |
| **Estado** | ⏳ spec+plan listo · implementación pendiente (INSTRUCTIVO-002) |
| **Nota** | Spec+plan anterior (BI-DEV-1) se perdió en I-04 · reconstruido aquí desde cero |

---

## Objetivo

Crear el `docker-compose.bi.yml` con los 6 servicios del backend BI, los 3 Dockerfiles, los scripts SQL de preparación para la réplica pg_logical (que Jelkin ejecuta), el archivo `deploy-bi-prod.sh` y el `INVENTARIO-DE-SECRETOS.md`. Todo dentro del repo BI sin tocar el repo PI.

---

## Alcance

### 6 Servicios en docker-compose.bi.yml

| Servicio | Imagen | Puerto interno | Puerto externo |
|---|---|---|---|
| `bi-superset` | `apache/superset:4.1.0` | 8088 | 127.0.0.1:8088 |
| `bi-vanna` | build Dockerfile.vanna | 8001 | 127.0.0.1:8001 |
| `bi-telegram` | build Dockerfile.telegram | — (long-polling) | — |
| `bi-superset-db` | `postgres:16-alpine` | 5432 | 127.0.0.1:5434 |
| `bi-db-replica` | `pgvector/pgvector:pg16` | 5432 | 127.0.0.1:5433 |
| `bi-next` | build Dockerfile.next | 3000 | 127.0.0.1:3001 |

**Red:** `bi-net` (bridge · privada). `bi-db-replica` se une también a `pi-net` (external:true) para alcanzar `pi-db` vía pg_logical.

**Healthcheck obligatorio en todos los servicios** (AGENTS.md · ratchet healthcheck).

### 3 Dockerfiles

- `Dockerfile.vanna` — `python:3.12-slim` · FastAPI stub healthcheck (Vanna real en SPEC-003)
- `Dockerfile.telegram` — `python:3.12-slim` · bot stub solo `/start` (completo en SPEC-004)
- `Dockerfile.next` — multi-stage: `node:22-alpine builder` + `runner` · `output: 'standalone'`

### Scripts SQL de réplica (referencia · Jelkin ejecuta · no Desarrollo)

```
scripts/replica-setup/
  01-pi-db-crear-usuario-replica.sql    ← Jelkin en pi-db
  02-pi-db-publicacion.sql              ← Jelkin en pi-db (14 tablas OPERATIVAS · sin PII)
  03-bi-db-replica-suscripcion.sql      ← Jelkin en bi-db-replica
  04-verificar-replica.sql              ← Jelkin en bi-db-replica (incluye Tests 7 y 8)
  INSTRUCTIVO-JELKIN-replica.md         ← orden de pasos · sin valores de contraseñas
```

### Tablas incluidas en la publicación (D-20 · sin PII · 23 tablas · verificadas en schema PI)

```sql
CREATE PUBLICATION bi_replica FOR TABLE
  "Reporte", "ClasificacionIA", "ClasificacionRubricaVoto", "CorreccionAdmin",
  "EmbeddingReporte", "TransicionReporte", "SolicitudComite", "FuenteReporte",
  "Subscription", "BillingCycle", "Plan", "Tenant",
  "Colegio", "Curso", "Alumno", "IdentificadorAlumno",
  "AlertaColegio", "AlertaSuscripcion", "Plataforma",
  "Pais", "Departamento", "Ciudad", "AuditLog";
```

**Excluidas explícitamente:** `Usuario` · `Password` · `Session` (PII · Ley 1581 · D-20).
**Nota ajuste:** lista v1 (BRIEF-A-01) tenía 14 tablas con nombres inexistentes en schema PI. Corregido en ajuste spec+plan 2026-08-28 tras verificación con `grep "^model" schema.prisma` (candado 15).

### Hallazgo Fase A · @@map en schema PI

Durante ejecución de Fase A (2026-08-28) se detectó que `grep "^model" schema.prisma`
no revela el nombre real en BD cuando el modelo Prisma tiene `@@map(...)`. En el schema PI
hay 3 modelos con esta anotación:

| Modelo Prisma | Nombre real BD |
|---|---|
| `ClasificacionRubricaVoto` | `clasificacion_rubrica_votos` |
| `SimulacionRun` | `simulacion_runs` |
| `SimulacionReporte` | `simulacion_reportes` |

Solo el primero afecta la PUBLICATION D-20 · corregido en 02-pi-db-publicacion.sql.

**Regla dura actualizada (candado 15 profundo):**
verificación en fuente = `grep '^model'` **más** `grep '@@map'` **más** cross-check
`psql -c '\dt'` cuando corresponda.

### Otros entregables

- `INVENTARIO-DE-SECRETOS.md` en raíz del repo BI (lista nombres · sin valores)
- `scripts/deploy-bi-prod.sh` (Jelkin ejecuta · bloqueo IA por classifier)
- `.env.bi.example` actualizado con todas las variables necesarias

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 11 · Guard tenancy | `bi_reader` es usuario read-only · no puede escribir en réplica |
| 14 · Verificación en vivo | `docker compose -f docker-compose.bi.yml config` sin errores · 2 tests funcionales |
| 15 · Verificar en fuente | Nombre red Docker PI verificado en VPS: `docker network ls \| grep pi` |
| Cero secretos | Ratchet 2 · placeholders en todos los SQL · sin passwords hardcoded |

### Tests funcionales obligatorios (enmienda 1eaa214 · candado 14)

**Test 7 · Paridad master↔réplica:**
```bash
psql -h pi-db -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
# → ambos counts iguales (lag < 10s). Repetir para "Colegio" y "Subscription".
# → INSERT en master → esperar 10s → verificar en réplica
```

**Test 8 · INSERT rechazado por bi_reader (aislamiento read-only):**
```bash
psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c \
  "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test', 'test');"
# → debe fallar: "ERROR: cannot execute INSERT in a read-only transaction"
#   o "ERROR: permission denied for table Colegio"
# → Si acepta INSERT: PARA · avisa CEO · NO se emite REALIZADO
```

---

## Fuera de alcance

- Vanna real con Ollama (SPEC-003)
- Bot Telegram completo con `/status` y `/ask` (SPEC-004)
- Superset datasources ni dashboards (A-02)
- Cambio de WAL level en pi-db (Jelkin ejecuta · no Desarrollo)
- Crear usuario bi_replica y publicación en pi-db (Jelkin ejecuta los SQL)
- Cloudflare Tunnel ingress (SPEC-004)
- Cambios en el repo 002 (PI)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reconstruida desde cero en SPEC-005 · I-04) |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan · implementación pendiente |
