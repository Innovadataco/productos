# Research: SPEC-221 — Motor de reglas de recomendación

## 1. Contexto del problema

El brief `BRIEF-ANALISIS-DINERO-VS-VALOR.md` (§8, §9) define un motor de reglas configurables que convierte datos comerciales (suscripciones, pagos, referidos, freemium) en acciones concretas para el CEO: "llamar hoy", bonos de retención, alertas. Sin este motor, el análisis dinero-vs-valor es solo lectura pasiva de dashboards.

Incógnitas a resolver contra el código real:

1. ¿Qué patrón de worker periódico usa el repo?
2. ¿Cómo se ejecutan queries dinámicas de forma segura con Prisma?
3. ¿Existe ya algo del dominio (`ReglaRecomendacion`, `ScoreCliente`, namespace `analisis`)?
4. ¿Qué campos reales tienen `Suscripcion`/`Pago`/`Colegio` para escribir las 7 queries semilla?
5. ¿Cómo se siembran parámetros y se auditan acciones?

## 2. Hallazgos contra el código real

### 2.1 No existe nada del dominio de recomendaciones

- Grep de `ReglaRecomendacion|Recomendacion|ScoreCliente` en todo el repo: solo menciones históricas no relacionadas (`src/lib/expediente/pdf-denuncia.ts`, docs de specs 010/043). **Las tablas y el namespace hay que crearlos.**
- `src/lib/analytics/` existe pero es analítica de colegios (`hallazgos-colegio.ts`, `cache.ts`) — dominio distinto. Se crea `src/lib/analisis/` (con "s", como el namespace de parámetros del brief) para no mezclar.
- `SesionLog` (SPEC-206, 002-PI-120) ya existe en `prisma/schema.prisma:640-662` — la dependencia SPEC-INFRA-SESSION-LOG está resuelta en la rama.

### 2.2 Patrón de worker periódico: tick loop + advisory lock

- `scripts/monitor-probes.mjs:45-74`: `pg_try_advisory_lock($1)` con id `123456790`, exit 2 si tomado, libera en `pg_advisory_unlock` al salir. Arranque `node --env-file-if-exists=.env --import tsx`.
- `scripts/worker-notificaciones.mjs:14,53`: mismo patrón con id propio.
- `scripts/worker-reportes.mjs`: usa pg-boss porque sus jobs son por-unidad con retry — no aplica a evaluación periódica idempotente.
- `scripts/dev-restart.sh:10,32-33`: mata y levanta cada worker con `pkill -f` + `nohup node --import tsx`. El nuevo worker se integra igual.

**Decisión**: `worker-analisis-reglas.mjs` = tick loop con advisory lock nuevo, sin pg-boss.

### 2.3 Ejecución de SQL dinámico con Prisma

- `PrismaClient` expone `$queryRawUnsafe` y `$transaction` interactiva que permite `SET LOCAL statement_timeout` y `SET TRANSACTION READ ONLY` antes de la query (API estándar de Prisma 5.22, ya usada en el repo para consultas raw puntuales).
- No hay precedente de SQL configurable por admin en el repo; el sandbox (validación estática + READ ONLY + timeout) es diseño nuevo, justificado en `plan.md` §2.2.

### 2.4 Campos reales para las queries semilla

- `Suscripcion` (`prisma/schema.prisma:723-757`): `tipoTitular` (`COLEGIO`/`PADRE`, enum `:253`), `estado` (`ACTIVA`/`EN_GRACIA`/`SUSPENDIDA`/`CANCELADA`, enum `:258`), `fechaInicio`/`fechaFin` (Timestamptz), `esFreemium`, `freemiumFechaFin`, `codigoReferidoPropio`/`codigoReferidoUsado`, `suspendidaEn`, `canceladaEn`, índice `[estado, fechaFin]`.
- `Pago` (`:759-792`): `suscripcionId`, `estado` (`EstadoPago`), `fechaReporte`, `fechaAutorizacion` — base para "cliente puntual ahora atrasado".
- `Colegio` (`:873-943`): `ciudadId`, `estado`, `tenantId` — base para "crecimiento por ciudad" (conteo de suscripciones nuevas por `Colegio.ciudadId`).
- `Plan` (`:677-697`): `tipoTitular`, `precioBaseUSD` — contexto de dinero para plantillas.
- Patrón `sujetoTipo`/`sujetoId` sin FK dura: precedente directo en `Notificacion` (`prisma/schema.prisma:2287-2288`).

**Consecuencia**: las 7 queries semilla se escriben contra estos campos reales. `padres_de_colegio_no_renovado` requiere unir suscripciones `PADRE` con el colegio vía `Usuario.tenantId`; es la más frágil y se marca como tunable v1 (brief §17.1 la deja a validación del CEO).

### 2.5 Parámetros, seed y auditoría

- `ParametroSistema` (`prisma/schema.prisma:592-611`): `clave` única, `tipo` (`TipoParametro`: STRING/INTEGER/FLOAT/BOOLEAN/JSON/STRING_ARRAY, `:29-36`), `categoria` (`CategoriaParametro` incluye `SYSTEM`, `:38-44`).
- `getParametroSistemaValor` existe en `src/lib/parametros.ts:39` — el worker relee parámetros en cada tick como `monitor-probes.mjs`.
- Seed idempotente por `upsert` por `clave`: patrón vigente en `prisma/seed.ts` (hay tests de idempotencia: `src/lib/seed-idempotencia.test.ts`, `src/lib/deploy-seed-idempotencia.test.ts`).
- `AuditLog` (`prisma/schema.prisma:613-637`) + `logAudit` en `src/lib/audit.ts`; enum `AccionAudit` (`:46+`) admite valores aditivos (`ALTER TYPE ... ADD VALUE`, precedente SPEC-171 `INFRA_INCIDENTE_*`).
- Errores: `AppError` + códigos canónicos en `src/lib/errors.ts`; handlers admin bajo `src/app/api/admin/**` usan `verifyAuth` (`src/lib/auth.ts`).
- Zona horaria: `date-fns-tz@3.2.0` ya es dependencia (`package.json:39`) y `America/Bogota` se usa en `src/lib/fechas/formato-bogota.ts`, `src/lib/notificaciones/quiet-hours.ts`, etc.

## 3. Opciones consideradas

### 3.1 ¿Quién crea las tablas `ReglaRecomendacion`/`Recomendacion`?

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| SPEC-220 (brief §15 las incluye en "modelos §5.1-5.7") | Centraliza modelo | El instructivo 002-PI-122 asigna explícitamente las tablas a SPEC-221 | No |
| SPEC-221 (instructivo) | El motor y sus tablas viajan juntos, PR atómico | Posible conflicto si SPEC-220 también las crea | **Sí** |

El instructivo es fuente primaria de alcance ("ReglaRecomendacion + Recomendacion + worker"). Se documenta como assumption y se coordina en el PR único del mega-lote: si SPEC-220 ya creó las tablas, la migración de 221 se reduce a índices/campos faltantes. **[Marcado para compuerta ZEUS]**

### 3.2 Sandbox de SQL: validación estática vs. parser vs. permisos de BD

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| Deny-list + prefijo SELECT/WITH | Simple, sin deps | Evasión teórica con comentarios/CTE | Parcial (capa 1) |
| Parser SQL real (pg-query) | Robusto | Dependencia nativa pesada, overkill v1 | No |
| `SET TRANSACTION READ ONLY` + `statement_timeout` | Garantía a nivel motor de BD | Requiere TX interactiva | **Sí** (capa 2) |
| Rol PostgreSQL read-only dedicado | Máxima garantía | Requiere credenciales/infra extra en todos los entornos | No (v2 si escala) |

**Decisión**: capa 1 + capa 2 combinadas. La capa 2 es la garantía real; la capa 1 da errores claros y auditables antes de tocar la BD.

### 3.3 Dedup: constraint único parcial vs. lógica en aplicación

- PostgreSQL permite índice único parcial `WHERE estado = 'PENDIENTE'` sobre `(regla_id, sujeto_id)`, pero Prisma no lo expresa en schema y `sujetoId` nullable lo complica.
- **Decisión**: lógica en aplicación (SELECT previo + UPDATE/INSERT dentro de TX), igual que el brief §9 ("crea o actualiza"). El volumen es bajo (decenas de reglas × cientos de clientes); no hay contención.

### 3.4 Ejecución de acciones EJECUTA en esta spec

- El instructivo fija D-77: modo `RECOMIENDA` por default; la promoción a `EJECUTA` exige consentimiento explícito con motivo auditado (ese flujo de promoción es SPEC-224).
- SPEC-226 (002-PI-127) implementa el motor de ejecución de `accionEjecutable`.
- **Decisión**: en SPEC-221 una regla `EJECUTA` genera la recomendación sin ejecutar nada (`ejecutadaAutomatica = false`) + log. Nunca hay ejecución parcial.

## 4. Referencias y dependencias

- **Instructivo**: `INSTRUCTIVO-002-PI-122-MOTOR-REGLAS-RECOMENDACION.md` (alcance, candados, gate local).
- **Brief maestro**: `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §3 (terminología), §5.3/5.4 (modelos), §8.2 (7 reglas semilla), §9 (anatomía: detección → generación → resolución).
- **SPEC-220** (002-PI-121): namespace `analisis.*`, `ScoreCliente` — dependencia bloqueante.
- **SPEC-224/226/227/222**: consumidores (panel reglas, ejecución, historial, widget top-5).
- **SPEC-210**: `Suscripcion`/`Pago`/`Plan`/`BonoPromocional` — dominio de lectura.
- **SPEC-201**: Motor Notificaciones (`src/lib/notificaciones/motor.ts:79` `programar()`) — no se usa en esta spec; las alertas se cablean en SPEC-223/225.
- `AGENTS.md` + `.specify/memory/constitution.md`: aditividad de migraciones, cero PII en agregados, `src/lib/ai/**` intocable.

## 5. Lecciones de specs anteriores

- SPEC-171/SPEC-201 demostraron el patrón tick loop + advisory lock + parámetros releídos por tick (monitor-probes, worker-notificaciones).
- SPEC-206 dejó `SesionLog` y el patrón de seed con tests de idempotencia.
- SPEC-236 (formato de referencia) resolvió el mismo dilema worker-por-unidad vs. tick loop con la misma conclusión.

## 6. Preguntas abiertas (para clarify con ZEUS si es necesario)

1. **[NEEDS CLARIFICATION]** Solapamiento SPEC-220/221: ¿confirma ZEUS que SPEC-221 crea las tablas `ReglaRecomendacion`/`Recomendacion` y SPEC-220 se limita a `ScoreCliente`/`DigestSemanal`/`Anomalia`/parámetros? El instructivo 002-PI-122 dice que sí; el brief §15 es ambiguo.
2. ¿La regla semilla `padres_de_colegio_no_renovado` une padres al colegio vía `Usuario.tenantId` (único vínculo disponible hoy) o se posterga a que exista un vínculo explícito padre↔colegio?
3. ¿El tick del worker es fijo corto (30s, tipo monitor-probes) o configurable por parámetro? Se propone fijo 30s con cadencia real gobernada por `frecuenciaMin` por regla.
4. ¿Las reglas semilla con datos insuficientes (p. ej. `crecimiento_ciudad_anomalo` con 1 solo colegio) deben nacer `activa = true` o `activa = false` hasta que haya volumen? Se propone `activa = true` (el brief las lista todas como semilla activa) y que el umbral las silencie naturalmente.
