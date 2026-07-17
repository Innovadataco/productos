# Runbook operativo — Protección Infantil

Documento para operar la plataforma sin necesidad de tocar el código. Pensado para un administrador de sistemas o DevOps.

---

## 1. Verificar salud del sistema

### 1.1 Healthcheck rápido

```bash
curl -s http://localhost:5005/api/health/worker | python3 -m json.tool
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "workerAlive": true,
  "dbOk": true,
  "timestamp": "2026-07-16T..."
}
```

Si `workerAlive` es `false` o `dbOk` es `false`, revisar las secciones 2 y 3.

### 1.2 Chequear que la app responde

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5005/api/estadisticas-publicas
```

**Esperado:** `200`

### 1.3 Chequear Ollama

```bash
curl -s http://localhost:11434/api/tags | grep -E 'ornith|nomic-embed-text'
```

**Esperado:** ambos modelos aparecen en la lista.

### 1.5 Verificar headers de seguridad

```bash
curl -s -I http://localhost:5005/api/estadisticas-publicas | grep -E "X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Strict-Transport-Security|Content-Security-Policy"
```

**Esperado:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; ...`

> **HSTS:** `Strict-Transport-Security` se envía siempre, pero solo tiene efecto cuando la app se sirve por HTTPS. En HTTP local los navegadores lo ignoran.

### 1.6 Cookies de sesión

En HTTPS con `COOKIE_SECURE=true` (o detectado automáticamente), la cookie de sesión se nombra `__Host-token` y cumple:
- `Secure`
- `Path=/`
- Sin atributo `Domain`
- `SameSite=Strict`

En HTTP local sigue siendo `token` con `SameSite=Lax`.

### 1.4 Chequear cola de trabajo

```bash
psql $DATABASE_URL -c 'SELECT name, state, count(*) FROM pgboss.job GROUP BY name, state;'
```

Si no tienes `psql`, usa Prisma Studio:

```bash
npx prisma studio
```

**Estados normales:**
- `created`: jobs esperando.
- `retry`: reintentando por fallo.
- `active`: ejecutándose ahora.
- `failed`: agotó reintentos. Requiere atención.

---

## 2. Ollama está caído o no responde

### Síntomas
- Healthcheck muestra `dbOk: true` pero el worker no procesa reportes.
- `worker.log` muestra errores tipo `Ollama health: FAIL` o `fetch failed`.
- Reportes se quedan en estado `PROCESANDO` o `REVISION_MANUAL` con `processingError`.
- El smoke test (`npx tsx scripts/smoke-e2e.ts`) falla en el paso de clasificación.

### Verificación

```bash
curl -s http://localhost:11434/api/tags
```

Si no responde, Ollama está caído.

### Reinicio

**Si Ollama corre como servicio del sistema:**

```bash
# Linux/macOS con brew services
brew services restart ollama

# Linux con systemd
sudo systemctl restart ollama
```

**Si corre en Docker:**

```bash
docker restart ollama
```

**Si se inició manualmente:**

```bash
pkill -f ollama
ollama serve
```

### Verificación post-reinicio

```bash
curl -s http://localhost:11434/api/tags | grep -E 'ornith|nomic-embed-text'
```

Si falta algún modelo:

```bash
ollama pull ornith:9b
ollama pull nomic-embed-text
```

### Qué pasa con los reportes que fallaron mientras Ollama estaba caído

El worker reintenta automáticamente (hasta 3 veces con backoff 30s → 60s → 120s). Si agota reintentos, el reporte queda en `REVISION_MANUAL` con `processingError`. Para reprocesarlos manualmente, ver sección 4.

---

## 3. El worker pg-boss se detuvo o la cola se atascó

### Síntomas
- `api/health/worker` devuelve `workerAlive: false`.
- Hay jobs en estado `created` o `retry` que no avanzan.
- `worker.log` no muestra actividad reciente.

### Verificar si el proceso existe

```bash
ps aux | grep worker-supervisor
ps aux | grep worker-reportes
```

### Reiniciar el worker

```bash
# Detener supervisor actual si existe
pkill -f worker-supervisor

# Iniciar de nuevo
npm run worker
```

Para ejecutar en background y dejarlo corriendo:

```bash
nohup npm run worker > worker.log 2>&1 &
```

### Verificar logs

```bash
tail -f worker.log
```

**Líneas normales:**
```
[SUPERVISOR] Iniciando worker (intento 1/5)
[WORKER] Iniciado. Escuchando colas...
[WORKER] Ollama health: OK
[WORKER] Job reporte-procesamiento/... completado
```

### Cola atascada

Si los jobs no se procesan pero el worker está vivo:

```bash
# Ver jobs activos o reintentando
psql $DATABASE_URL -c "SELECT name, state, count(*) FROM pgboss.job WHERE state IN ('active','retry','created') GROUP BY name, state;"
```

Para limpiar jobs fallidos y dejar que se reintenten:

```bash
psql $DATABASE_URL -c "UPDATE pgboss.job SET state = 'created', retrycount = 0 WHERE state = 'failed' AND name = 'reporte-procesamiento';"
```

⚠️ **Solo hacer esto en entorno controlado.** Si un job falla repetidamente, revisar `worker.log` antes de reiniciarlo.

---

## 4. Un reporte quedó clavado en PROCESANDO

### Identificar reportes atascados

```bash
psql $DATABASE_URL -c "SELECT id, \"numeroSeguimiento\", identificador, estado, \"creadoEn\", \"processingError\" FROM \"Reporte\" WHERE estado = 'PROCESANDO' AND \"creadoEn\" < NOW() - INTERVAL '10 minutes';"
```

### Causas comunes
1. Worker no está corriendo (ver sección 3).
2. Ollama no responde (ver sección 2).
3. El job falló y el reporte quedó en `PROCESANDO` sin actualización.

### Reprocesar manualmente

Necesitás el `id` del reporte. Luego:

```bash
REPORTE_ID="reemplazar-con-el-id"
WORKER_SECRET="$(grep WORKER_SECRET .env | cut -d= -f2-)"
curl -X POST http://localhost:5005/api/reportes/procesar \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: $WORKER_SECRET" \
  -d "{\"reporteId\":\"$REPORTE_ID\"}"
```

### Forzar revisión manual si el reproceso sigue fallando

```bash
psql $DATABASE_URL -c "UPDATE \"Reporte\" SET estado = 'REVISION_MANUAL', \"processingError\" = 'No pudo procesarse automáticamente tras reinicio' WHERE id = 'reemplazar-con-el-id';"
```

Eso enviará alerta a los administradores para revisión humana.

---

## 5. Backup y restore de PostgreSQL

La base de datos expone el puerto `5433` en el host (mapeado al `5432` del contenedor).

### Backup

```bash
pg_dump "$DATABASE_URL" > proteccion_infantil_$(date +%Y%m%d_%H%M%S).sql
```

Si usás Docker Compose local:

```bash
docker-compose exec db pg_dump -U proteccion proteccion_infantil > proteccion_infantil_$(date +%Y%m%d_%H%M%S).sql
```

**Verificación:**

```bash
ls -lh proteccion_infantil_*.sql
```

### Restore

⚠️ **El restore sobrescribe la base de datos actual.** Detener la app y el worker antes:

```bash
pkill -f "next start"
pkill -f worker-supervisor
```

Luego:

```bash
psql "$DATABASE_URL" < proteccion_infantil_YYYYmmdd_HHMMSS.sql
```

O con Docker:

```bash
docker-compose exec -T db psql -U proteccion proteccion_infantil < proteccion_infantil_YYYYmmdd_HHMMSS.sql
```

Finalmente reiniciar app y worker.

---

## 6. Verificación de índices vectoriales

> ⚠️ **Las migraciones de Prisma pueden eliminar índices pgvector** si se tocan las columnas `vector` de `EmbeddingReporte` o `EmbeddingDataset`. Verificar siempre tras `npx prisma migrate deploy`.

```bash
psql $DATABASE_URL -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('EmbeddingReporte', 'EmbeddingDataset');"
```

**Resultado esperado:** dos índices de tipo `hnsw` (o `ivfflat`) sobre la columna `vector`:
```
EmbeddingReporte_vector_idx  ... USING hnsw (vector vector_cosine_ops)
EmbeddingDataset_vector_idx  ... USING hnsw (vector vector_cosine_ops)
```

Si faltan, recrearlos manualmente (requiere extensión `pgvector`):
```sql
CREATE INDEX IF NOT EXISTS "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);
```

### Verificación con EXPLAIN
Con tablas pequeñas PostgreSQL puede preferir `Seq Scan`; con volumen real debe usar el índice. Para forzarlo y comprobar que es usable:
```sql
SET enable_seqscan = off;
EXPLAIN ANALYZE
SELECT e."reporteId", 1 - (e.vector <=> '[0,0,...0]'::vector) AS similarity
FROM "EmbeddingReporte" e
WHERE 1 - (e.vector <=> '[0,0,...0]'::vector) >= 0.92
ORDER BY similarity DESC LIMIT 1;
```

---

## 7. Reiniciar la aplicación

### Parar

```bash
pkill -f "next start"
pkill -f worker-supervisor
```

### Iniciar

```bash
# Modo producción
npm run build
npm start

# En background
nohup npm start > app.log 2>&1 &
nohup npm run worker > worker.log 2>&1 &
```

### Verificar

```bash
curl -s http://localhost:5005/api/health/worker | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}" http://localhost:5005/api/estadisticas-publicas
```

---

## 7. Métricas del dashboard IA — cuándo preocuparse

El dashboard de Centro de Control IA (`/dashboard/admin/ia`) muestra métricas del clasificador.

### Indicadores principales

| Métrica | Umbral orientativo | Qué hacer |
|---------|-------------------|-----------|
| `error_silencioso` | > 21% | Revisar ejemplos RAG y dataset de correcciones. Considerar ajustar `rag_top_k` o reforzar ejemplos de la categoría errónea. |
| `% REVISION_MANUAL` | > 35% | El clasificador no se siente seguro. Revisar umbral de confianza (`umbral_revision`) y distribución de votos. |
| `precisionObservada` | < 70% | Hay discrepancia entre predicción y correcciones de admins. Priorizar revisión de correcciones pendientes. |
| Latencia p95 | > 15s | Revisar carga de Ollama, `ollama_num_parallel`, o si el modelo `ornith:9b` está descargado en memoria. |
| Reportes en `REVISION_MANUAL` acumulados | > 50 sin atender | Alerta operativa: asignar admins a la cola de revisión. |
| Worker `failed` jobs | > 0 persistentes | Ver `worker.log` y sección 3. |

### Acciones recomendadas según escenario

- **Sube `error_silencioso`:** aumentar ejemplos corregidos en el dataset RAG para las categorías más confundidas.
- **Sube `% REVISION_MANUAL`:** bajar `umbral_revision` solo si la precisión observada es alta; de lo contrario, mejorar el dataset primero.
- **Baja `precisionObservada`:** revisar si los admins están corrigiendo consistentemente hacia la misma categoría; si no, el problema puede ser ambigüedad de las categorías.

---

## 8. Comandos rápidos de referencia

```bash
# Healthcheck completo
curl -s http://localhost:5005/api/health/worker | python3 -m json.tool

# Estadísticas públicas
curl -s http://localhost:5005/api/estadisticas-publicas | python3 -m json.tool

# Modelos Ollama
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# Reportes recientes
psql $DATABASE_URL -c "SELECT id, identificador, estado, \"creadoEn\" FROM \"Reporte\" ORDER BY \"creadoEn\" DESC LIMIT 10;"

# Experimentos recientes
psql $DATABASE_URL -c "SELECT id, nombre, estado, \"iniciadoEn\", \"progresoCasos\", \"progresoTotal\" FROM \"EvalRun\" ORDER BY \"iniciadoEn\" DESC LIMIT 10;"

# Colas pg-boss
psql $DATABASE_URL -c "SELECT name, state, count(*) FROM pgboss.job GROUP BY name, state;"

# Smoke test E2E (requiere app + worker + Ollama)
node --env-file=.env --import tsx scripts/smoke-e2e.ts

# Reprocesar un reporte
REPORTE_ID="..."; WORKER_SECRET="..."
curl -X POST http://localhost:5005/api/reportes/procesar \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: $WORKER_SECRET" \
  -d "{\"reporteId\":\"$REPORTE_ID\"}"

# Re-encolar un experimento huérfano (ver sección 9)
RUN_ID="..."
node --env-file=.env --import tsx -e "
const { PgBoss } = require('pg-boss');
const boss = new PgBoss(process.env.DATABASE_URL);
boss.start().then(async () => {
  await boss.send('eval-classifier-run', { runId: '$RUN_ID' });
  await boss.stop();
  console.log('Experimento $RUN_ID re-encolado');
}).catch((e) => { console.error(e); process.exit(1); });
"

# Limpieza manual de hashes de fuente antiguas (hasta tener job programado)
node --env-file=.env --import tsx -e "
import { limpiarFuenteReporteAntiguas } from './src/lib/anti-abuso/fuente-reporte.ts';
limpiarFuenteReporteAntiguas().then((n) => console.log('Eliminadas:', n));
"

# Flags críticas de v2
psql $DATABASE_URL -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave IN ('scoring.source_weight.enabled','reportes.classification.modelo_desempate','anti_abuso.retencion_fuente_dias');"
```

---

## 9. Laboratorio — Experimento huérfano tras caída del worker

> Aplica a la cola `eval-classifier-run` introducida en Spec 014.

### Síntomas

- Un experimento queda en estado `PENDIENTE` o `EN_PROGRESO` mucho más tiempo del estimado.
- `api/health/worker` indica `workerAlive: false` o el worker se reinició.
- En `pgboss.job` hay un job de `eval-classifier-run` en estado `active` sin avanzar.

### Verificación

```bash
# Estado de corridas recientes
psql $DATABASE_URL -c "SELECT id, nombre, estado, \"iniciadoEn\", \"finalizadoEn\", \"progresoCasos\", \"progresoTotal\" FROM \"EvalRun\" ORDER BY \"iniciadoEn\" DESC LIMIT 10;"

# Jobs de eval en pg-boss
psql $DATABASE_URL -c "SELECT id, name, state, retrycount, \"creadoEn\" FROM pgboss.job WHERE name = 'eval-classifier-run' ORDER BY \"creadoEn\" DESC;"
```

### Re-encolar

1. **Si el worker murió y el job está atascado en `active`:**
   ```bash
   psql $DATABASE_URL -c "UPDATE pgboss.job SET state = 'created', retrycount = 0 WHERE name = 'eval-classifier-run' AND state = 'active';"
   ```
   Luego reiniciar el worker (`npm run worker`). pg-boss retomará el job.

2. **Si el job desapareció pero `EvalRun` sigue `PENDIENTE`:**
   ```bash
   RUN_ID="..."
   node --env-file=.env --import tsx -e "
   const { PgBoss } = require('pg-boss');
   const boss = new PgBoss(process.env.DATABASE_URL);
   boss.start().then(async () => {
     await boss.send('eval-classifier-run', { runId: '$RUN_ID' });
     await boss.stop();
     console.log('Re-encolado', '$RUN_ID');
   }).catch((e) => { console.error(e); process.exit(1); });
   "
   ```

3. **Si el experimento debe cancelarse:**
   ```bash
   psql $DATABASE_URL -c "UPDATE \"EvalRun\" SET estado = 'CANCELADA', \"finalizadoEn\" = NOW() WHERE id = 'RUN_ID';"
   ```

> **Importante:** antes de re-encolar, verificar en `worker.log` por qué falló. Si Ollama no responde, reintentar sin resolver la causa subyacente solo reprocesará el fallo.

---

## 10. Nuevas colas y jobs de mantenimiento

### 10.1 Colas nuevas en v2

Además de `reporte-procesamiento`, el worker escucha:

| Cola | Propósito | Verificación |
|------|-----------|--------------|
| `dataset-anonimizacion-backfill` | Anonimiza texto de registros del dataset RAG. | `SELECT name, state, count(*) FROM pgboss.job WHERE name = 'dataset-anonimizacion-backfill' GROUP BY name, state;` |
| `dataset-embedding-backfill` | Genera embeddings para registros del dataset. | Igual que arriba con `dataset-embedding-backfill`. |
| `eval-classifier-run` | Ejecuta evaluaciones/experimentos IA. | Ver sección 9. |

### 10.2 Retención de hashes de fuente (anti-abuso)

La función `limpiarFuenteReporteAntiguas(dias?)` en `src/lib/anti-abuso/fuente-reporte.ts` respeta `anti_abuso.retencion_fuente_dias` (default 90 días). **No hay job programado aún**, por lo que la limpieza es manual o debe agregarse a un cron.

```bash
# Previsualizar filas a eliminar
psql $DATABASE_URL -c "SELECT count(*) FROM \"FuenteReporte\" WHERE \"creadoEn\" < NOW() - INTERVAL '90 days';"

# Ejecutar limpieza
node --env-file=.env --import tsx -e "
import { limpiarFuenteReporteAntiguas } from './src/lib/anti-abuso/fuente-reporte.ts';
limpiarFuenteReporteAntiguas().then((n) => console.log('Eliminadas:', n));
"
```

### 10.3 Vencimiento de apelaciones (Fase C)

| Job | Frecuencia sugerida | Comando (plantilla) |
|-----|---------------------|---------------------|
| `apelaciones-vencimiento` | Diaria (cron) | `node --env-file=.env --import tsx scripts/job-apelaciones-vencimiento.ts` |
| `apelaciones-vencimiento` (manual vía endpoint) | Bajo demanda | `curl -H "x-worker-secret: $WORKER_SECRET" -X POST $API_BASE_URL/api/admin/apeaciones/vencer` |

Verificación manual:

```bash
psql $DATABASE_URL -c "SELECT id, identificador, estado, \"pausaHasta\", \"visibilidadRestaurada\" FROM \"ApelacionIdentificador\" WHERE estado IN ('RECIBIDA','EN_REVISION') AND \"pausaHasta\" < NOW();"
```

---

## 11. Cambio de modelo vía panel: Laboratorio → eval → activar

> **Lección aprendida del incidente `ornith:35b`:** nunca cambiar el modelo de clasificación en Configuración "para probar". El flujo correcto es siempre **experimento → evaluar → activar**.

### Flujo correcto

1. Ir a **Centro de Control IA → Laboratorio** (`/dashboard/admin/ia`).
2. Crear un **Nuevo experimento** con la configuración deseada (modelo, umbral, votos, temperatura, `rag_top_k`).
3. Lanzar el experimento. El worker lo ejecuta en background (`eval-classifier-run`).
4. Esperar a que pase a `COMPLETADA`.
5. Comparar contra el baseline (misma `fixtureVersion`).
6. Si los métricas mejoran sin violar umbrales de producto (`error_silencioso`, `% REVISION_MANUAL`):
   - En el dashboard del experimento, presionar **"Usar esta configuración"**.
   - Ir a la pestaña **Configuración** y guardar explícitamente los valores precargados.
   - El guardado genera un `AuditLog` `PARAM_UPDATE`.

### Qué NO hacer

- No editar `reportes.classification_model` directamente en Configuración sin un experimento previo.
- No activar un modelo solo porque está disponible en Ollama (ej. `ornith:35b` mostró 30.4% de error silencioso vs. 20.8% del baseline).
- No olvidar revertir la configuración de prueba si se hizo en desarrollo.

### Verificación

```bash
# Últimos cambios de configuración de producción
psql $DATABASE_URL -c "SELECT accion, \"tipoRecurso\", \"valorAnterior\", \"valorNuevo\", \"creadoEn\" FROM \"AuditLog\" WHERE accion = 'PARAM_UPDATE' ORDER BY \"creadoEn\" DESC LIMIT 5;"
```

---

## 12. Cifrado de parámetros secretos (T7)

La capa de cifrado está en `src/lib/param-encryption.ts` y utiliza **AES-256-GCM**. Solo afecta a filas de `ParametroSistema` con `esSecreto = true`.

### Activación

1. **Backup completo.**
   ```bash
   pg_dump "$DATABASE_URL" > proteccion_infantil_pre_cifrado_$(date +%Y%m%d_%H%M%S).sql
   cp .env .env.pre-cifrado
   ```

2. **Configurar `PARAM_ENCRYPTION_KEY`.**
   - Debe tener exactamente 32 bytes.
   - Se acepta cadena UTF-8 de 32 caracteres o base64 de 44 caracteres.
   - Ejemplo (cambiar): `PARAM_ENCRYPTION_KEY="change-me-32-bytes-param-key!!"`

3. **Ejecutar migración.**
   ```bash
   node --env-file=.env --import tsx scripts/migrate-param-secretos.ts
   ```
   El script:
   - Valida la clave con una prueba de ida/vuelta.
   - Crea un dump JSON con timestamp en `backups/param-secretos-<timestamp>.json` **con los valores en texto plano**.
   - Cifra cada valor plano de parámetro con `esSecreto = true`.
   - Verifica que **todos** los valores cifrados se descifren idénticos al respaldo.
   - Si la verificación falla, hace rollback automático a los valores planos.
   - Si la verificación OK y se pasó `--clean-backup`, elimina el respaldo local.

### Comportamiento de la app

- Los endpoints `/api/config/parametros` y `/api/config/parametros/:clave` nunca devuelven el valor real de un parámetro secreto (`valor: null`).
- `POST /api/config/parametros/:clave/revelar` permite a un admin ver el valor descifrado bajo rate-limit `admin_read`.
- Al editar un parámetro secreto en el panel, el valor se cifra antes de guardarse.
- `/api/config/parametros/publicos` excluye explícitamente `esSecreto = true`.
- Todos los lectores internos de parámetros (`getParametroSistema`) descifran automáticamente si es necesario.
- Los valores en texto plano siguen funcionando si `PARAM_ENCRYPTION_KEY` no está configurada (modo degradado no recomendado en producción).

### Rollback (si algo falla)

1. **Detener app y worker.**
   ```bash
   pkill -f "next start"
   pkill -f worker-supervisor
   ```

2. **Rollback automático.** Si la verificación del script falló, el propio script restauró los valores planos. Revisar el log.

3. **Rollback manual desde el backup JSON.** Si la app quedó con valores cifrados incorrectos y hay un backup `backups/param-secretos-<timestamp>.json`:
   ```bash
   # Ejemplo con psql (adaptar según el path del backup)
   psql "$DATABASE_URL" <<'SQL'
   -- Restaurar cada fila desde el JSON de respaldo
   SQL
   ```
   O bien restaurar el `pg_dump` completo tomado antes de la migración:
   ```bash
   psql "$DATABASE_URL" < proteccion_infantil_pre_cifrado_YYYYmmdd_HHMMSS.sql
   ```

4. **Eliminar o comentar `PARAM_ENCRYPTION_KEY` en `.env`.**

5. **Reiniciar app y worker** y verificar que los parámetros secretos se lean correctamente.

### Verificación post-rollback

```bash
psql $DATABASE_URL -c "SELECT clave, \"esSecreto\", substring(valor from 1 for 30) AS valor_preview FROM \"ParametroSistema\" WHERE \"esSecreto\" = true;"
```

Los valores deben ser legibles (no comenzar con `enc:`). Si no lo son, revisar backup.

---

## 13. Contacto y escalamiento

- Si reiniciar Ollama/worker/app no resuelve el problema: revisar `app.log` y `worker.log`.
- Si hay errores de base de datos: verificar conexión, espacio en disco y que `pgvector` esté habilitado.
- Para decisiones sobre ajustes de parámetros de IA: consultar con el equipo de producto antes de cambiar valores en producción.
- Para activar `scoring.source_weight.enabled` o cambiar de modelo: requerir simulación/evaluación previa documentada.

---

## 10. Control de versiones

Al cierre de cada tarea, spec o lote de trabajo:

1. Commitear en **commits separados por bloque lógico** con mensajes descriptivos estilo [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): ...` para funcionalidad.
   - `fix(scope): ...` para correcciones.
   - `docs(scope): ...` para documentación.
   - `test(scope): ...` para tests.
   - `chore(scope): ...` para tareas de mantenimiento.
2. Hacer `git push origin <rama>` inmediatamente después de cerrar.
3. Verificar con `git status` que el working tree queda limpio.

> **Regla permanente:** trabajo sin pushear es trabajo en riesgo. El remoto es el respaldo y la fuente de la auditoría externa.
