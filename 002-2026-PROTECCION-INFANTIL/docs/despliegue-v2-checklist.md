# Checklist de despliegue v2 — Protección Infantil

> **Documentación retroactiva.** Estado del repo al 2026-07-16/17.  
> **Regla de oro:** nada de este checklist se ejecuta directamente en producción. Solo lectura, validación y comandos contra entornos de staging/pre-producción bajo procedimiento de cambio.

## 1. Alcance de la v2

La v2 agrupa las funcionalidades desplegadas (o en cierre) posteriormente a la v1:

| Área | Spec / Tarea | Estado en repo |
|------|--------------|----------------|
| Anti-abuso Fase A (peso de fuente) + Fase B (rate limits compuestos) | 015 | Implementado; colas y limpieza programada pendientes. |
| Cifrado de parámetros secretos | T7 | ✅ Implementada (AES-256-GCM): `src/lib/param-encryption.ts`, `src/lib/parametros.ts`, endpoint `revelar` y script `scripts/migrate-param-secretos.ts` con verificación ida/vuelta. |
| Fixture v2 (versionado de casos de eval) | T2 | ✅ Mecanismo implementado; fixture curado a `fixtureVersion=11`; script `scripts/eval-classifier-baseline-v2.ts` genera baseline sobre casos activos. |
| Mejoras UI (Centro de Control IA, dashboard público, onboarding) | T3 | Implementado. |
| Apelaciones Fase C | T1 | ✅ Implementada: migración, API pública/admin, UI, job de vencimiento y tests. El proxy ya expone `/api/apeaciones` y `/apelar` como públicos. |

---

## 2. Migraciones de Prisma

### Inventario completo

| Migración | Descripción | Relevante v2 |
|-----------|-------------|--------------|
| `20260712162345_init` | Schema inicial. | — |
| `20260713061032_reportes_fase2` | Módulo de reportes fase 2. | — |
| `20260713160452_add_processing_error` | `processingError` en `Reporte`. | — |
| `20260714003146_fix_embedding_hnsw_index` | Primer índice vectorial. | — |
| `20260714105800_add_pais_ciudad` | Tablas `Pais`/`Ciudad`. | — |
| `20260714111300_add_ciudad_unique` | Unique `Ciudad(nombre, paisId)`. | — |
| `20260714120000_add_audit_log` | Tabla `AuditLog`. | — |
| `20260714150000_add_token_recuperacion` | `TokenRecuperacion`. | — |
| `20260714180000_add_score_to_identificador` | Score en `IdentificadorReportado`. | — |
| `20260714190000_add_rate_limit` | Tabla `RateLimit`. | — |
| `20260715000000_alertas_suscripcion` | `AlertaSuscripcion`. | — |
| `20260715000001_alertas_suscripcion_unique` | Unique de alerta. | — |
| `20260715170000_add_ciudad_coordinates` | Coordenadas en `Ciudad`. | — |
| `20260715180000_add_edad_victima` | `edadVictima` en `Reporte`. | — |
| `20260715222354_rediseno_clasificador_ia_f0_5_schema` | Rediseño clasificador IA. | — |
| `20260716071229_remove_vector_btree_index` | Limpieza de índices vectoriales. | — |
| `20260716143012_add_f7_rafaga_confirmacion` | F7: ráfaga + confirmación admin. | Parcial v2 (preparación). |
| `20260717002004_add_pgvector_hnsw_indexes` | Recreación índices HNSW para embeddings. | ✅ v2 (RAG/lab). |
| `20260717011303_add_reporte_baja` | Baja de reportes + enum motivos. | ✅ v2 (Spec 012). |
| `20260717020000_add_caso_eval` | Casos de evaluación y corridas. | ✅ v2 (Spec 013). |
| `20260718010000_add_experiment_lab` | Laboratorio de experimentos IA. | ✅ v2 (Spec 014). |
| `20260718020000_add_fuente_reporte` | Fuente de reporte anti-abuso. | ✅ v2 (015 Fase A). |
| `20260718110000_add_apelaciones_fase_c` | Tabla `ApelacionIdentificador`, enums y relaciones. | ✅ v2 (015 Fase C). |

---

## 3. Parámetros nuevos del seed

Se crean/actualizan con `npm run db:seed`. Lista agrupada por funcionalidad.

### 3.1 Anti-abuso Fase A — peso de fuente

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `scoring.source_weight.enabled` | BOOLEAN | `false` | Flag maestro; se mantiene `false` hasta simulación sobre producción. |
| `scoring.source_weight.anonymous` | FLOAT | `0.65` | Peso base reportes anónimos. |
| `scoring.source_weight.authenticated` | FLOAT | `1.0` | Peso base reportes autenticados. |
| `scoring.source_weight.new_account_factor` | FLOAT | `0.7` | Factor para cuentas recién creadas. |
| `scoring.source_weight.new_account_days_threshold` | INTEGER | `7` | Días para considerar cuenta nueva. |
| `scoring.source_weight.burst_factor` | FLOAT | `0.4` | Factor por ráfaga. |
| `scoring.source_weight.burst_window_hours` | INTEGER | `24` | Ventana de ráfaga. |
| `scoring.source_weight.burst_max_reports` | INTEGER | `3` | Máximo de reportes en ventana. |
| `scoring.source_weight.confirmed_factor` | FLOAT | `1.2` | Factor por reporte confirmado previo. |
| `scoring.source_weight.discarded_factor` | FLOAT | `0.3` | Factor por reporte descartado previo. |
| `anti_abuso.retencion_fuente_dias` | INTEGER | `90` | Retención de hashes de fuente (`FuenteReporte`). |

### 3.2 Anti-abuso Fase B — rate limits compuestos

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `ratelimit.report_identificador.window_seconds` | INTEGER | `3600` | Ventana por identificador/plataforma. |
| `ratelimit.report_identificador.max_requests` | INTEGER | `10` | Límite por ventana. |
| `ratelimit.report_identificador.spam_threshold` | INTEGER | `20` | Umbral para marcar `POSIBLE_SPAM`. |
| `ratelimit.report_fingerprint.window_seconds` | INTEGER | `3600` | Ventana por fingerprint server-side. |
| `ratelimit.report_fingerprint.max_requests` | INTEGER | `5` | Límite por fingerprint. |

### 3.3 Clasificador / Laboratorio

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `system.ollama_base_url` | STRING | `$OLLAMA_BASE_URL` o `http://localhost:11434` | URL base de Ollama. |
| `reportes.classification.umbral_revision` | FLOAT | `1.0` | Confianza mínima para auto-clasificar. |
| `reportes.classification.min_score_categoria` | FLOAT | `0.3` | Score mínimo para categoría principal/secundaria. |
| `reportes.classification.n_votos` | INTEGER | `5` | Votos independientes del clasificador. |
| `reportes.classification.modelo_desempate` | STRING | `""` | Modelo de desempate F6; vacío = deshabilitado. |
| `reportes.rafaga.n_reportes` | INTEGER | `3` | Reportes contra identificador sin historial que disparan revisión por ráfaga. |
| `reportes.rafaga.ventana_horas` | INTEGER | `24` | Ventana de ráfaga. |
| `reportes.classification.temperatura_votos` | FLOAT | `0.7` | Temperatura de votación. |
| `reportes.classification.ollama_num_parallel` | INTEGER | `2` | Llamadas paralelas a Ollama. |
| `reportes.classification.rag_top_k` | INTEGER | `3` | Ejemplos RAG recuperados. |

### 3.4 Rate limits adicionales

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `ratelimit.admin_read.window_seconds` / `max_requests` | INTEGER | `60` / `60` | Lecturas del panel admin. |
| `ratelimit.admin_write.window_seconds` / `max_requests` | INTEGER | `60` / `30` | Escrituras del panel admin. |
| `ratelimit.seguimiento.window_seconds` / `max_requests` | INTEGER | `60` / `10` | Consulta de seguimiento pública. |
| `ratelimit.ia_sandbox.window_seconds` / `max_requests` | INTEGER | `600` / `10` | Sandbox de IA (comparación cuenta doble). |

### 3.5 Apelaciones (Fase C)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `anti_abuso.apelacion_pausa_dias` | INTEGER | `7` | Duración máxima de pausa de visibilidad en primera apelación. |
| `ratelimit.apelacion.window_seconds` | INTEGER | `86400` | Ventana por identificador/plataforma. |
| `ratelimit.apelacion.max_requests` | INTEGER | `3` | Máximo de apelaciones nuevas por identificador/plataforma. |
| `ratelimit.apelacion_sms.window_seconds` | INTEGER | `3600` | Ventana de envío/verificación de SMS. |
| `ratelimit.apelacion_sms.max_requests` | INTEGER | `3` | Máximo de envíos/verificaciones de SMS por contacto/token. |

---

## 4. Variables de entorno

### 4.1 Requeridas en producción (nuevas o críticas para v2)

| Variable | Ejemplo | Uso | Estado |
|----------|---------|-----|--------|
| `ANTI_ABUSO_SALT` | `"change-me...32-chars"` | Salt para hashes de IP/fingerprint anti-abuso. | ✅ Implementada. |
| `PARAM_ENCRYPTION_KEY` | `"change-me-32-bytes-param-key-123"` | Clave de 32 bytes para cifrar parámetros marcados `esSecreto=true` (AES-256-GCM). | ✅ Implementada. Requerida para activar cifrado en producción. |
| `OLLAMA_BASE_URL` | `"http://localhost:11434"` | URL de Ollama; también se persiste en `system.ollama_base_url`. | ✅ Implementada. |
| `ADMIN_PASSWORD` | `"..."` | Contraseña del admin seed en `NODE_ENV=production`. | ✅ Implementada. |

### 4.2 Opcionales / fallback

| Variable | Default | Uso |
|----------|---------|-----|
| `COOKIE_SECURE` | `"false"` | Fuerza `Secure` en cookies; en HTTPS/producción usar `"true"`. |
| `API_BASE_URL` | `"http://localhost:5005"` | Usada por `scripts/worker-reportes.mjs` para llamar `/api/reportes/procesar`. |
| `IA_MODEL_ANONIMIZACION` | `"ornith:9b"` | Fallback si no existe parámetro `reportes.classification_model`. |
| `IA_MODEL_EMBEDDING` | `"nomic-embed-text"` | Fallback si no existe parámetro `reportes.embedding_model`. |
| `OLLAMA_NUM_PARALLEL` | `"2"` | Fallback si no existe parámetro `reportes.classification.ollama_num_parallel`. |
| `NEXT_PUBLIC_DISABLE_ONBOARDING` | — | Desactiva el tour de onboarding (útil tests E2E). |
| `DISABLE_RATE_LIMIT` | — | `true` salta rate limits (solo tests). |
| `SMS_PROVIDER` | `"mock"` | Proveedor de SMS para OTP de apelaciones. Solo `mock` implementado; proveedor real es decisión de sesión. |
| `ADMIN_EMAIL` | `"admin@proteccion.local"` | Email del admin creado por el seed; usado por scripts de smoke. |

### 4.3 Variables preexistentes (sin cambios)

`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `ENCRYPTION_KEY`, `EMAIL_FROM`, `WORKER_SECRET`, `NEXT_PUBLIC_APP_URL`.

> `ENCRYPTION_KEY` sigue presente en `.env.example` y en test setup, pero el código actual no la usa para cifrar parámetros. No confundir con `PARAM_ENCRYPTION_KEY` (T7).

---

## 5. Colas pg-boss

### 5.1 Colas existentes / nuevas

| Cola | Productor | Consumidor | Reintentos | Relevante v2 |
|------|-----------|------------|------------|--------------|
| `reporte-procesamiento` | `src/lib/queue.ts` | `scripts/worker-reportes.mjs` | 3 / 30s backoff | — |
| `dataset-anonimizacion-backfill` | `src/lib/queue.ts` | `scripts/worker-reportes.mjs` | 5 / 60s backoff | ✅ Nuevo. |
| `dataset-embedding-backfill` | `src/lib/queue.ts` | `scripts/worker-reportes.mjs` | 5 / 60s backoff | ✅ Nuevo. |
| `eval-classifier-run` | `src/app/api/admin/ia/evals/route.ts`, `src/app/api/admin/ia/experimentos/route.ts` | `scripts/worker-reportes.mjs` | default pg-boss | ✅ Nuevo (Spec 014). |

> **Nota:** `apelaciones-vencimiento` no es una cola de pg-boss; es un script de mantenimiento (`scripts/job-apelaciones-vencimiento.ts`) que se ejecuta vía cron o manualmente.

### 5.2 Limpieza programada (no hay job aún)

| Tarea | Función en código | Job programado |
|-------|-------------------|----------------|
| Retención de `FuenteReporte` | `limpiarFuenteReporteAntiguas(dias?)` en `src/lib/anti-abuso/fuente-reporte.ts` | ❌ No existe. Ejecutar manualmente o agregar cron. |
| Vencimiento de apelaciones | `vencerApelacionesPendientes()` en `src/lib/apealaciones.ts` vía `scripts/job-apelaciones-vencimiento.ts` | ✅ Script disponible y verificado en smoke; programar cron diario. |

---

## 6. Pasos de verificación

### 6.1 Pre-despliegue (manual)

1. **Revisar `.env.example` vs `.env` de producción.**
   ```bash
   diff .env.example .env
   ```
   Asegurar que existan `ANTI_ABUSO_SALT` y, si T7 está activo, `PARAM_ENCRYPTION_KEY`.

2. **Backup de la base de datos.**
   ```bash
   pg_dump "$DATABASE_URL" > proteccion_infantil_pre_v2_$(date +%Y%m%d_%H%M%S).sql
   ```

### 6.2 Migraciones y seed (manual, con supervisión)

3. **Aplicar migraciones.**
   ```bash
   npx prisma migrate deploy
   ```

4. **Verificar índices HNSW** (Prisma no los gestiona).
   ```bash
   psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('EmbeddingReporte', 'EmbeddingDataset');"
   ```
   **Esperado:** dos índices `USING hnsw (vector vector_cosine_ops)`.

5. **Ejecutar seed para parámetros y fixture v1.**
   ```bash
   npm run db:seed
   ```
   **Esperado:** mensajes de admin, parámetros, plataformas, países/ciudades y casos SEMILLA creados.

### 6.3 Build y tests (manual / CI)

6. **Type check + build.**
   ```bash
   npx tsc --noEmit
   npm run build
   ```

7. **Tests unitarios.**
   ```bash
   npm run test
   ```

8. **Smoke test E2E** (requiere app + worker + Ollama).
   ```bash
   npm start &
   npm run worker &
   node --env-file=.env --import tsx scripts/smoke-e2e.ts
   ```

### 6.4 Validaciones post-despliegue (manual)

9. **Modelos de Ollama instalados.**
   ```bash
   curl -s http://localhost:11434/api/tags | jq '.models[].name'
   ```
   **Esperado:** `ornith:9b`, `nomic-embed-text` como mínimo.

10. **Healthcheck de app y worker.**
    ```bash
    curl -s http://localhost:5005/api/health/worker | python3 -m json.tool
    curl -s -o /dev/null -w "%{http_code}" http://localhost:5005/api/estadisticas-publicas
    ```

11. **Flags críticas de v2.**
    ```bash
    psql "$DATABASE_URL" -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave IN ('scoring.source_weight.enabled','reportes.classification.modelo_desempate','reportes.classification.rag_top_k','anti_abuso.retencion_fuente_dias');"
    ```
    **Esperado:**
    - `scoring.source_weight.enabled` = `false`
    - `reportes.classification.modelo_desempate` = `""`
    - `reportes.classification.rag_top_k` = `3`
    - `anti_abuso.retencion_fuente_dias` = `90`

12. **Colas pg-boss.**
    ```bash
    psql "$DATABASE_URL" -c "SELECT name, state, count(*) FROM pgboss.job GROUP BY name, state;"
    ```

13. **Rate limits Fase B configurados.**
    ```bash
    psql "$DATABASE_URL" -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave LIKE 'ratelimit.report_identificador.%' OR clave LIKE 'ratelimit.report_fingerprint.%';"
    ```

---

## 7. Acción manual vs automática

| Paso | Tipo | Notas |
|------|------|-------|
| Backup previo de BD | **Manual** | Obligatorio antes de cualquier `migrate deploy`. |
| `npx prisma migrate deploy` | **Manual / CI** | Requiere supervisión; nunca en producción sin ventana. |
| `npm run db:seed` | **Manual / CI** | Idempotente; creará parámetros y casos SEMILLA si faltan. |
| `npm run build` | **CI / Manual** | Build de Next.js 16. |
| `npm run test` | **CI** | Contra BD de test. |
| Smoke test E2E | **Manual / CI** | Requiere Ollama + worker. |
| Verificación de índices HNSW | **Manual** | Comando SQL post-migración. |
| Inicio de `npm start` + `npm run worker` | **Manual / systemd/pm2** | Ambos procesos requeridos. |
| Limpieza de `FuenteReporte` antiguas | **Manual** (hasta crear job) | Usar `limpiarFuenteReporteAntiguas()` vía `tsx -e`. |
| Vencimiento de apelaciones | **Manual / cron** | Script `scripts/job-apelaciones-vencimiento.ts` listo; programar cron diario. |
| Activación de `scoring.source_weight.enabled` | **Manual, con simulación previa** | Nunca activar sin simulación sobre datos reales. |
| Rollback de cifrado T7 | **Manual** | Ver procedimiento en `docs/runbook.md`. |

---

## 8. Supuestos y riesgos documentados

- **v1 vs v2:** Se asume que v1 quedó aplicado hasta antes de las migraciones `20260717002004_add_pgvector_hnsw_indexes` o posterior. Si en producción v1 incluyó algunas de estas migraciones, ajustar el checklist.
- **T7 (cifrado):** Implementada. Activar en producción solo con `PARAM_ENCRYPTION_KEY` válida (32 bytes) y ejecutando `scripts/migrate-param-secretos.ts` con su verificación ida/vuelta.
- **Apelaciones Fase C:** Implementada y verificada de punta a punta (smoke-apelaciones). Revisar proveedor SMS real antes de abrir el flujo en producción.
- **Fixture v2:** No implica archivo nuevo; implica incrementar `fixtureVersion` al modificar casos de eval. El baseline v2 se corre con `scripts/eval-classifier-baseline-v2.ts` y se guarda en `eval-results/baseline-v2-*.json`.
- **Ollama:** Se asume accesible en `OLLAMA_BASE_URL` con `ornith:9b` y `nomic-embed-text`.
