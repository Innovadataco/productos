# Plan de implementación: SPEC-221 — Motor de reglas de recomendación

## 1. Resumen ejecutivo

Esta spec construye el motor de reglas de recomendación del módulo dinero-vs-valor: dos modelos nuevos (`ReglaRecomendacion`, `Recomendacion`), un ejecutor SQL sandboxed de solo lectura, el motor de evaluación con deduplicación y expiración, un worker periódico de instancia única, el seed de 7 reglas en modo `RECOMIENDA` (D-77) y el endpoint admin de resolución. No implementa ejecución automática de acciones (SPEC-226), ni UI (SPEC-222/224/227), ni edición de reglas (SPEC-224).

Cuatro pilares:

1. **Modelo** (`prisma/schema.prisma` + migración aditiva): `ReglaRecomendacion`, `Recomendacion`, enums `ModoRegla`/`EstadoRecomendacion`, valor aditivo `RECOMENDACION_RESUELTA` en `AccionAudit`.
2. **Motor** (`src/lib/analisis/reglas/`): ejecutor SQL read-only, renderer de plantillas, evaluador con dedup y umbral.
3. **Worker** (`scripts/worker-analisis-reglas.mjs`): tick loop con advisory lock, evaluación por `frecuenciaMin` y expiración.
4. **API + seed**: `POST /api/admin/analisis/recomendaciones/[id]/resolver` y seed idempotente de reglas y parámetros.

## 2. Decisiones de arquitectura

### 2.1 Worker: tick loop con advisory lock (no pg-boss)

- **Patrón elegido**: `scripts/monitor-probes.mjs` y `scripts/worker-notificaciones.mjs` — proceso Node con `pg_try_advisory_lock(id)` (exit 2 si tomado), tick corto que relee `ParametroSistema` en cada ciclo y decide qué toca evaluar.
- **Alternativa descartada**: jobs periódicos pg-boss (`src/lib/queue.ts`). La evaluación de reglas es monitoreo periódico idempotente, no trabajo encolado con retry por unidad; pg-boss añade complejidad sin beneficio aquí (misma conclusión que SPEC-236 para su worker de expediente).
- **Arranque**: `node --env-file-if-exists=.env --import tsx scripts/worker-analisis-reglas.mjs`, integrado a `scripts/dev-restart.sh` igual que `worker-notificaciones.mjs` (`scripts/dev-restart.sh:32-33`).
- **Advisory lock id**: nuevo, documentado en el header del script; los ya usados son `123456789` (worker-reportes), `123456790` (monitor-probes) y los de simulador-abuso/worker-notificaciones. Se asigna el siguiente libre al implementar y se verifica con grep.

### 2.2 Ejecutor SQL sandboxed

- **Validación estática previa**: la query debe iniciar con `SELECT` o `WITH` (trim + case-insensitive) y no contener ninguna palabra de la deny-list como token: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `COPY`, `EXECUTE`, `CALL`, `CREATE`, `SET`.
- **Defensa en profundidad a nivel BD**: ejecución con `prisma.$transaction` interactiva que aplica `SET LOCAL statement_timeout` y `SET TRANSACTION READ ONLY` antes de correr la query con `$queryRawUnsafe`. Aunque la validación estática falle, PostgreSQL rechaza escrituras.
- **Timeout**: parámetro `analisis.recomendaciones.statement_timeout_ms` (default 5000).
- **Alternativa descartada**: parser SQL completo (pg-query-emscripten y similares) — dependencia nueva pesada para un riesgo ya cubierto por READ ONLY + deny-list + revisión humana en el editor (SPEC-224 tendrá "test" de query).
- **Auditoría**: todo rechazo por validación estática registra `AuditLog` (la query se trunca a 200 chars en metadatos; nunca se ejecuta).

### 2.3 Motor de evaluación y deduplicación

- **Ubicación**: `src/lib/analisis/reglas/motor.ts` (nuevo namespace `analisis`, separado del `src/lib/analytics/` existente que es analítica de colegios).
- **Selección de reglas por tick**: `activa = true` y (`ultimaEvaluacionEn` es null o `ultimaEvaluacionEn + frecuenciaMin <= ahora`). Acotado además por el parámetro global `analisis.recomendaciones.frecuencia_evaluacion_min` como piso de cadencia.
- **Dedup**: antes de insertar, buscar `Recomendacion` con `(reglaId, sujetoId, estado = PENDIENTE)`; si existe, `UPDATE` de `datosContexto`/`prioridad`/`titulo`/`descripcion`/`expiraEn`; si no, `INSERT`. Filas sin `sujetoId` deduplican por `(reglaId, hash de datosContexto)` guardado en el propio `datosContexto`.
- **Render**: reemplazo simple `{{variable}}` sobre la fila (sin dependencia nueva); variable ausente → se deja el placeholder y warning en log.
- **Umbral**: si la regla define `umbralMinimo`, la query debe devolver una columna `valor` numérica por fila; solo disparan filas con `valor >= umbralMinimo`. Convención documentada en el seed.
- **EJECUTA diferida**: regla en modo `EJECUTA` genera la recomendación igual (`ejecutadaAutomatica = false`) y loguea `[Analisis/Reglas] Regla X en modo EJECUTA: ejecución diferida a SPEC-226`. Ninguna acción automática corre en esta spec (candado D-77).

### 2.4 Resolución humana y auditoría

- Endpoint `POST /api/admin/analisis/recomendaciones/[id]/resolver` bajo `src/app/api/admin/**` (proxy ya restringe `/admin` a `ADMIN`; se verifica además con `verifyAuth` en el handler, patrón de los route.ts admin existentes).
- Transición única permitida: `PENDIENTE → APLICADA | IGNORADA`. `EXPIRADA` solo la pone el worker (FR-008). Cualquier otra combinación → `400` (Zod) o `409` (estado no PENDIENTE).
- `AuditLog` con acción aditiva `RECOMENDACION_RESUELTA`, `tipoRecurso = 'Recomendacion'`, metadatos `{ reglaId, categoria, estado }` — nunca `datosContexto` completos ni datos del sujeto.

### 2.5 Seed

- Función `seedReglasRecomendacion()` en `prisma/seed.ts` con `upsert` por `clave`: `create` con todos los campos; `update` solo de campos descriptivos (`nombre`, `descripcion`, `plantillaRecomendacion`) — **nunca** `modo`, `activa` ni `sqlQuery` (respeta el tuning manual del admin).
- Las 7 queries semilla se escriben contra el schema real (`Suscripcion`, `Pago`, `Plan`, `Colegio`, `Ciudad`, `CodigoReferidoUso`, enums `EstadoSuscripcion`) y se validan ejecutándolas en el test de seed contra la BD de tests.

## 3. Flujos detallados

### 3.1 Evaluación de una regla

```text
evaluarRegla(reglaId):
1. Cargar regla; si !activa → salir.
2. Validar sqlQuery (estático); si falla → AuditLog + AppError, salir.
3. Ejecutar query en TX READ ONLY + statement_timeout → filas.
4. Si umbralMinimo: filtrar filas por columna `valor`.
5. Por cada fila:
   a. Renderizar titulo/descripcion desde plantillaRecomendacion.
   b. Resolver sujetoTipo/sujetoId desde convención de columnas
      (`sujeto_tipo`, `sujeto_id` si la query las expone).
   c. Dedup (reglaId, sujetoId, PENDIENTE) → update o insert.
   d. expiraEn = ahora(Bogotá) + expiracion_dias.
6. Actualizar regla.ultimaEvaluacionEn.
7. Si modo = EJECUTA → log de ejecución diferida (SPEC-226).
8. Error en cualquier paso → log + continuar con la siguiente regla.
```

### 3.2 Tick del worker

```text
Cada tick (TICK_MS corto, p. ej. 30s):
1. Releer parámetros analisis.recomendaciones.*.
2. Seleccionar reglas activas con frecuenciaMin vencida
   (piso: frecuencia_evaluacion_min global).
3. evaluarRegla() por cada una (secuencial; volumen bajo).
4. Expirar: UPDATE recomendaciones SET estado=EXPIRADA,
   resueltaEn=now, motivoResolucion='EXPIRACION_AUTOMATICA'
   WHERE estado=PENDIENTE AND expiraEn < now.
5. Dormir hasta el próximo tick.
SIGTERM/SIGINT → terminar tick en curso, liberar lock, exit 0.
```

### 3.3 Resolución admin

```text
POST /api/admin/analisis/recomendaciones/[id]/resolver
1. verifyAuth → 401 si no hay sesión; rol != ADMIN → 403.
2. Zod: { estado: "APLICADA" | "IGNORADA", motivo?: string ≤ 500 }.
3. Buscar recomendación → 404 si no existe.
4. Si estado != PENDIENTE → 409.
5. TX: update estado/resueltaEn/resueltaPorAdminId/motivoResolucion
   + AuditLog(RECOMENDACION_RESUELTA).
6. 200 con la recomendación actualizada.
```

## 4. Estructura de archivos propuesta

```text
prisma/schema.prisma                      # +ReglaRecomendacion, +Recomendacion, +enums, +AccionAudit value
prisma/migrations/NNNN_motor_reglas_recomendacion/migration.sql  # aditiva
prisma/seed.ts                            # +seedReglasRecomendacion() + params analisis.recomendaciones.*

src/lib/analisis/reglas/
  ejecutor-sql.ts                         # validación + ejecución READ ONLY
  ejecutor-sql.test.ts
  plantilla.ts                            # render {{variables}}
  plantilla.test.ts
  motor.ts                                # evaluarRegla / evaluarReglasPendientes / expirarRecomendaciones
  motor.test.ts
  resolver.ts                             # transición PENDIENTE → APLICADA|IGNORADA + AuditLog
  resolver.test.ts
  seed-reglas.ts                          # definición de las 7 reglas semilla (importado por prisma/seed.ts)

src/app/api/admin/analisis/recomendaciones/[id]/resolver/
  route.ts
  route.test.ts

scripts/worker-analisis-reglas.mjs
scripts/dev-restart.sh                    # pkill + nohup del nuevo worker

specs/221-motor-reglas-recomendacion/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  checklists/requirements.md
  contracts/resolver-recomendacion.md
```

## 5. Interfaz pública

### 5.1 Motor

```typescript
type ResultadoEvaluacion = {
  reglaId: string;
  candidatos: number;
  creadas: number;
  actualizadas: number;
  error?: string;
};

async function evaluarRegla(reglaId: string): Promise<ResultadoEvaluacion>;
async function evaluarReglasPendientes(): Promise<ResultadoEvaluacion[]>;
async function expirarRecomendacionesVencidas(): Promise<number>;
```

### 5.2 Ejecutor

```typescript
function validarSqlRegla(sql: string): { ok: true } | { ok: false; motivo: string };
async function ejecutarQueryRegla<T = Record<string, unknown>>(
  sql: string,
  timeoutMs: number
): Promise<T[]>;
```

### 5.3 Endpoint

Ver `contracts/resolver-recomendacion.md`.

## 6. Fases de implementación

1. **Fase 1 — Modelo**: enums + modelos + migración aditiva + relaciones inversas en `Usuario` (aditivas).
2. **Fase 2 — Ejecutor SQL**: validación estática + ejecución sandboxed + tests.
3. **Fase 3 — Motor**: plantilla, evaluación, dedup, umbral, expiración + tests.
4. **Fase 4 — Seed**: 7 reglas + parámetros + test de idempotencia y de queries contra BD real de tests.
5. **Fase 5 — Endpoint**: resolver + tests de matriz de códigos.
6. **Fase 6 — Worker + dev-restart**: advisory lock, tick, señales.
7. **Fase 7 — Gate local completo** (`tsc`, `lint`, `test`, `build`, `dev-restart`).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Solapamiento con SPEC-220 sobre quién crea las 2 tablas | Assumption explícita en spec.md; coordinar en el PR del mega-lote (misma rama). |
| Query semilla incorrecta contra schema real | Test de seed que ejecuta las 7 queries contra la PostgreSQL de tests; quickstart con datos semilla. |
| Admin escribe SQL destructivo en SPEC-224 | Sandbox READ ONLY + deny-list + timeout ya en esta spec; SPEC-224 hereda la validación. |
| Worker duplicado tras deploy | Advisory lock (exit 2); `dev-restart.sh` mata instancias previas con `pkill`. |
| Regla EJECUTA promovida antes de SPEC-226 | Comportamiento seguro: genera sin ejecutar + log (FR-006). |
| Volumen de recomendaciones sin resolver | Expiración automática a 7 días; métricas de tuning en SPEC-227. |
| PII en agregados | Convención dura: reglas solo leen dominio SaaS; prohibido `Reporte.textoCifrado` e identificadores reportados; revisión en compuerta. |
