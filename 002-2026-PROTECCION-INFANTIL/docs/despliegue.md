# Despliegue a producción — Checklist v2.1 (definitivo)

> Checklist validado en un **ensayo general** sobre un entorno desechable (BD nueva `proteccion_ensayo`, puerto alternativo 5006) el 2026-07-17.  
> **Regla de oro:** nada de esto se ejecuta directamente sobre la producción real sin backup previo, ventana de cambio y aprobación del owner.

---

## 1. Prerequisitos

- Node.js 22+, npm.
- PostgreSQL 16 con extensión `pgvector` (el repo usa `pgvector/pgvector:pg16`).
- Ollama corriendo con `ornith:9b` y `nomic-embed-text` en `OLLAMA_BASE_URL` (solo localhost/IP privada, R2).
- Acceso a `psql` (en el host o vía `docker exec` al contenedor de la BD).
- Archivo `.env.production` completo (ver `.env.production.example`).

---

## 2. Tiempos de referencia medidos en el ensayo

| Paso | Tiempo medido | Nota |
|------|---------------|------|
| `npx prisma migrate deploy` | < 1 s | Ya con BD nueva; incluye creación de índices HNSW. |
| `npm run db:seed` | < 1 s | Admin, parámetros, plataformas, países/ciudades, 110 casos SEMILLA. |
| `npm run build` | ~6 s | Next.js 16 (Turbopack). |
| Arranque app (`next start`) | < 1 s | Healthcheck OK inmediato. |
| Arranque worker | ~2 s | Crea colas pg-boss, verifica Ollama. |
| Smoke E2E completo | ~12 s | Incluye 1 reporte procesado de punta a punta con `ornith:9b`. |
| **Total (sin descargas)** | **< 1 minuto** | Sin contar `docker pull`, `ollama pull` ni creación de contenedor. |

---

## 3. Paso a paso

### Paso 0 — Decisión y backup (manual)

**Comando:**
```bash
pg_dump "$DATABASE_URL" > proteccion_infantil_pre_v2_$(date +%Y%m%d_%H%M%S).sql
```

**Verificación:**
```bash
ls -lh proteccion_infantil_pre_v2_*.sql
```

**Rollback:** no aplica (aún no se toca nada).

---

### Paso 1 — Variables de entorno

**Comando:**
```bash
cp .env.production.example .env.production
# Editar TODOS los valores change-me...
```

**Verificación:**
```bash
# JWT_SECRET >= 32 chars, PARAM_ENCRYPTION_KEY = 32 bytes (UTF-8) o 44 base64
grep -E 'JWT_SECRET|PARAM_ENCRYPTION_KEY|ANTI_ABUSO_SALT|WORKER_SECRET' .env.production
```

**Rollback:** eliminar `.env.production` y volver a la versión anterior.

---

### Paso 2 — Migraciones

**Comando:**
```bash
set -a && source .env.production && set +a
npx prisma migrate deploy
```

**Verificación:**
```bash
# 24 migraciones aplicadas (ver docs/despliegue-v2-checklist.md, sección 2)
npx prisma migrate status
# Índices HNSW (en el host con psql, o en el contenedor)
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('EmbeddingReporte', 'EmbeddingDataset');"
# Esperado: dos índices "USING hnsw (vector vector_cosine_ops)"
```

**Rollback:**
```bash
# Restaurar backup completo
psql "$DATABASE_URL" < proteccion_infantil_pre_v2_YYYYmmdd_HHMMSS.sql
```

---

### Paso 3 — Seed

**Comando:**
```bash
NODE_ENV=production ADMIN_PASSWORD="<secreto>" npm run db:seed
```

**Verificación:**
```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"ParametroSistema\";"
psql "$DATABASE_URL" -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave = 'scoring.source_weight.enabled';"
# Esperado: scoring.source_weight.enabled = false
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"CasoEval\" WHERE activo = true;"
# Esperado: 110 casos activos (fixtureVersion 11)
```

**Rollback:** restaurar backup (el seed es idempotente, pero no debe correrse dos veces sobre datos productivos sin supervisión).

---

### Paso 4 — Build

**Comando:**
```bash
npm run build
```

**Verificación:** build termina sin errores (`✓ Compiled successfully`).

**Rollback:** redeploy de la versión anterior del código.

---

### Paso 5 — Arrancar app

**Comando (systemd/pm2 recomendado):**
```bash
# Ejemplo directo:
set -a && source .env.production && set +a
npx next start -p 5005
```

**Verificación:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5005/api/estadisticas-publicas
# Esperado: 200
curl -s http://localhost:5005/api/health/worker | python3 -m json.tool
# Esperado: status ok, dbOk true (workerAlive queda true cuando arranque el worker)
```

**Rollback:** detener el servicio y levantar la versión anterior.

---

### Paso 6 — Arrancar worker

**Comando:**
```bash
npm run worker
# o directo con env-file:
# node --env-file=.env.production --import tsx scripts/worker-reportes.mjs
```

**Verificación:**
```bash
curl -s http://localhost:5005/api/health/worker | python3 -m json.tool
# Esperado: workerAlive = true
psql "$DATABASE_URL" -c "SELECT name FROM pgboss.queue;"
# Esperado: reporte-procesamiento, dataset-anonimizacion-backfill, dataset-embedding-backfill, eval-classifier-run
```

**Rollback:** detener el worker; los jobs en cola quedan persistidos y se reanudan al volver.

---

### Paso 7 — Smoke E2E

**Comando:**
```bash
node --env-file=.env.production --import tsx scripts/smoke-e2e.ts
```

**Verificación:** `🟢 SMOKE TEST PASÓ` (crea y limpia un reporte de prueba procesado con `ornith:9b`).

**Rollback:** no aplica (el smoke limpia sus propios datos).

---

### Paso 8 — Cifrado de parámetros secretos (si aplica)

**Comando (solo cuando existan parámetros con `esSecreto = true`):**
```bash
node --env-file=.env.production --import tsx scripts/migrate-param-secretos.ts
```

**Verificación:**
```bash
psql "$DATABASE_URL" -c "SELECT clave, substring(valor from 1 for 4) FROM \"ParametroSistema\" WHERE \"esSecreto\" = true;"
# Esperado: todos comienzan con "enc:"
```

**Rollback:** el propio script hace rollback automático si la verificación falla. Si la falla es posterior, restaurar desde `backups/param-secretos-<timestamp>.json` o el `pg_dump` previo. Detalle en `docs/runbook.md` sección 12.

---

### Paso 9 — Jobs de mantenimiento (programar)

| Job | Comando | Frecuencia sugerida |
|-----|---------|---------------------|
| Vencimiento de apelaciones | `node --env-file=.env.production --import tsx scripts/job-apelaciones-vencimiento.ts` | Diario |
| Limpieza de fuentes anti-abuso | `npx tsx -e "import('./src/lib/anti-abuso/fuente-reporte.ts').then(m => m.limpiarFuenteReporteAntiguas())"` | Semanal |

**Verificación:** conteo de registros eliminados/vencidos en logs y `AuditLog` (`APELACION_VENCIDA`).

---

### Paso 10 — Activación de flags (manual, con simulación)

- `scoring.source_weight.enabled`: **NO activar** sin simulación sobre datos reales documentada. Procedimiento en `docs/runbook.md`.
- `reportes.classification.modelo_desempate`: mantener vacío hasta evaluación en laboratorio.

**Rollback:** volver el flag a `false`/`""` desde el panel de configuración o SQL.

---

## 4. Desvíos del checklist v2 → v2.1 (aprendidos en el ensayo)

1. **`psql` no siempre está en el host.** En este entorno se usó `docker exec <contenedor-db> psql ...`. Documentado en los comandos.
2. **El build de Next.js lee `.env`, no `.env.<nombre>`.** Para producción usar `.env.production` o variables de entorno del sistema operativo; no confiar en `--env-file` para el build.
3. **`worker-supervisor.mjs` lee siempre `.env`.** Para entornos alternativos se lanzó `scripts/worker-reportes.mjs` directamente con `--env-file` correspondiente.
4. **El proxy/middleware debe exponer como públicos `/api/apeaciones` y `/apelar`.** Se corrigió en este lote (`src/proxy.ts`); sin ese cambio, las apelaciones públicas devuelven 401/404.
5. **`PARAM_ENCRYPTION_KEY` debe medir exactamente 32 bytes (UTF-8) o 44 chars base64.** El placeholder anterior tenía longitud inválida; corregido en `.env.example` y `.env.production.example`.
6. **`ADMIN_EMAIL` y `SMS_PROVIDER` no estaban documentados como variables.** Se agregaron a los ejemplos; el smoke y el seed las usan.
7. **El smoke E2E requiere `NEXT_PUBLIC_APP_URL` y `DATABASE_URL` coherentes** (app y limpieza directa a la misma BD).
8. **No hay job programado para limpieza de `FuenteReporte` ni vencimiento de apelaciones.** Se dejaron comandos listos para cron (Paso 9).

---

## 5. Decisiones de la sesión (owner decide en vivo)

| Punto | Opciones | Recomendación | Default en repo |
|-------|----------|---------------|-----------------|
| ¿Backfill de scores en producción? | Sí / No | Solo con simulación previa y backup | No automático |
| Dominio / URL pública | `https://...` | Definir antes de configurar cookies `Secure` y `NEXT_PUBLIC_APP_URL` | `http://localhost:5005` |
| Proveedor SMS | Mock / Proveedor real | Mock por ahora; integrar proveedor real antes de abrir apelaciones en producción | `mock` |
| Flags que arrancan apagados | `scoring.source_weight.enabled`, `reportes.classification.modelo_desempate` | Mantener apagados hasta simulación | `false` / `""` |
| ¿Quién corre `migrate deploy` y `seed`? | DevOps / CI | Con supervisión y backup; nunca automático sin ventana | Manual |
| HTTPS / HSTS | Activar con reverse proxy | `COOKIE_SECURE=true` y HTTPS terminado en proxy | HTTP local |

---

## 6. Rollback general (si el despliegue falla)

1. Detener app y worker.
2. Restaurar BD desde el `pg_dump` del Paso 0.
3. Redesplegar la versión anterior del código (git tag/commit previo).
4. Levantar app y worker; correr smoke E2E para confirmar.
5. Si el fallo fue solo de parámetros secretos: usar el rollback de `scripts/migrate-param-secretos.ts` (automático en fallo de verificación) o restaurar desde `backups/`.

---

## 7. Veredicto del ensayo (2026-07-17)

El despliegue según este documento **funcionó de punta a punta** en el entorno desechable en **< 1 minuto** (sin contar descargas de imágenes/modelos): migraciones (24) aplicadas, seed completo, build OK, app + worker arriba, índices HNSW verificados y un reporte procesado de punta a punta con `ornith:9b` vía smoke E2E. Las correcciones aprendidas ya están incorporadas en esta versión v2.1.
