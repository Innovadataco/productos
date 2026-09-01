# Inventario de activos a copiar desde 005 (BI v1)

- **Producto**: 006-2026-INTELIGENCIA-NEGOCIO · SPEC-001 · scaffolding inicial
- **Fuente (solo lectura)**: `/Users/idc/Documents/GitHub/productos/005-2026-BI-INTELIGENCIA-NEGOCIO`
- **Fecha de verificación**: 2026-09-01 (rutas verificadas contra el repo 005)
- **Regla**: esto es un inventario para fases posteriores; en SPEC-001 NO se copia nada todavía.

Todas las rutas de la columna "Ruta en 005" son relativas a la raíz del producto 005. La columna "Destino en 006" es relativa a `006-2026-INTELIGENCIA-NEGOCIO/`.

## (a) Modelos BI en `prisma/schema.prisma` (129 líneas)

El schema de 005 contiene SOLO modelos BI (6 modelos, sin enums). Nombres y línea de inicio:

| Modelo | Línea aprox. | Qué es | Destino en 006 |
|---|---|---|---|
| `BICatalogoTabla` | `prisma/schema.prisma:20` | Tablas del catálogo semántico BI | `prisma/schema.prisma` (mismo nombre) |
| `BICatalogoColumna` | `prisma/schema.prisma:40` | Columnas descritas del catálogo | idem |
| `BICatalogoMetrica` | `prisma/schema.prisma:60` | Métricas de negocio definidas | idem |
| `BICatalogoEjemplo` | `prisma/schema.prisma:79` | Pares pregunta→SQL de ejemplo (RAG/few-shot) | idem |
| `BIConsultaLog` | `prisma/schema.prisma:96` | Log de consultas del motor NL→SQL | idem |
| `BICacheSemantico` | `prisma/schema.prisma:116` | Caché semántico de consultas | idem |

El schema completo (129 líneas) es portable casi literal; revisar solo el bloque `datasource`/`generator` al integrarlo.

## (b) Seed del catálogo

| Ruta en 005 | Qué es | Destino en 006 |
|---|---|---|
| `prisma/seed-catalogo.ts` (286 líneas) | Seed de tablas/columnas/métricas/ejemplos del catálogo BI | `prisma/seed-catalogo.ts` |
| `scripts/catalogo-cli.mjs` | CLI de mantenimiento del catálogo (usa `bi_admin`) | `scripts/catalogo-cli.mjs` |

## (c) Migraciones de vistas materializadas

| Ruta en 005 | Qué es | Destino en 006 |
|---|---|---|
| `prisma/migrations/20260828120000_schema_catalogo_bi_inicial/migration.sql` (125 líneas) | DDL inicial de tablas `bi_catalogo_*` y `bi_*` | `prisma/migrations/<nueva_fecha>_schema_catalogo_bi_inicial/migration.sql` |
| `prisma/migrations/20260828120100_mv_fact_bi/migration.sql` (102 líneas) | 5 vistas materializadas: `mv_fact_reporte_diario`, `mv_fact_motor_ia_diario`, `mv_fact_operativo`, `mv_fact_comercial_mensual`, `mv_fact_salud_sistema` | `prisma/migrations/<nueva_fecha>_mv_fact_bi/migration.sql` |
| `scripts/refresh-mv.sh` | Refresh de las `mv_fact_*` | `scripts/refresh-mv.sh` |

Nota: las fechas de las migraciones se regeneran al copiar (Prisma exige orden); el contenido SQL se preserva tal cual.

## (d) Réplica pg_logical — `scripts/replica-setup/` (completo)

| Ruta en 005 | Qué es | Destino en 006 |
|---|---|---|
| `scripts/replica-setup/01-pi-db-crear-usuario-replica.sql` | Usuario de replicación en pi-db | `scripts/replica-setup/` (mismo nombre) |
| `scripts/replica-setup/02-pi-db-publicacion.sql` | Publicación lógica en pi-db | idem |
| `scripts/replica-setup/03-bi-db-replica-suscripcion.sql` | Suscripción en la réplica BI | idem |
| `scripts/replica-setup/04-verificar-replica.sql` | Verificación de la réplica | idem |
| `scripts/replica-setup/INSTRUCTIVO-JELKIN-replica.md` | Instructivo operativo para ejecutar la réplica | idem |

## (e) Ratchets y verificación de índices

| Ruta en 005 | Qué es | Destino en 006 |
|---|---|---|
| `scripts/verificar-indices-post-migrate.mjs` | Verifica índices/estado post-migrate | `scripts/verificar-indices-post-migrate.mjs` |
| `scripts/ratchets/cero-secretos.sh` | Ratchet: cero secretos en repo | `scripts/ratchets/cero-secretos.sh` |
| `scripts/ratchets/cero-sql-raw.sh` | Ratchet: cero SQL crudo fuera de capa permitida | `scripts/ratchets/cero-sql-raw.sh` |
| `scripts/ratchets/imports-llm-solo-motor.sh` | Ratchet: imports LLM solo en el motor | `scripts/ratchets/imports-llm-solo-motor.sh` |
| `scripts/ratchets/motor-plantillas-completas.sh` | Ratchet: plantillas del motor completas | `scripts/ratchets/motor-plantillas-completas.sh` |
| `scripts/ratchets/mv-schema-check.sh` | Ratchet: schema de las mv_fact_* | `scripts/ratchets/mv-schema-check.sh` |
| `scripts/ratchets/no-additional-properties-true.sh` | Ratchet: structured outputs sin `additionalProperties: true` | `scripts/ratchets/no-additional-properties-true.sh` |
| `scripts/ratchets/run-all.sh` | Orquestador de ratchets | `scripts/ratchets/run-all.sh` |
| `tests/ratchets/imports-llm-solo-motor.test.sh` | Test del ratchet de imports LLM | `tests/ratchets/imports-llm-solo-motor.test.sh` |
| `scripts/e2e/limpiar-entorno-integracion.sh`, `scripts/e2e/preparar-entorno-integracion.sh`, `scripts/e2e/wait-for-port.sh` | Utilidades de entorno para tests de integración | `scripts/e2e/` (revisar acoplamientos a v1 al portar) |

## (f) Tests a portar (catálogo / motor / defensas del SQL)

Portables con ajuste de imports (Vitest, mismo stack). Todos bajo `tests/unit/` salvo indicación:

| Ruta en 005 | Qué cubre | Destino en 006 |
|---|---|---|
| `tests/unit/bi-catalogo.test.ts` | Catálogo semántico | `tests/unit/bi-catalogo.test.ts` |
| `tests/unit/catalogo-cli.test.ts` | CLI del catálogo | `tests/unit/catalogo-cli.test.ts` |
| `tests/unit/bi-motor.test.ts` + `tests/unit/motor.test.ts` | Motor NL→SQL | `tests/unit/` (revisar duplicación al portar) |
| `tests/unit/bi-plantillas.test.ts` | Plantillas de consulta | `tests/unit/bi-plantillas.test.ts` |
| `tests/unit/bi-sanitizer.test.ts` | Sanitizer de SQL generado | `tests/unit/bi-sanitizer.test.ts` |
| `tests/unit/bi-pre-guard.test.ts` | Pre-guard (validación previa) | `tests/unit/bi-pre-guard.test.ts` |
| `tests/unit/bi-post-validator.test.ts` | Post-validator del SQL | `tests/unit/bi-post-validator.test.ts` |
| `tests/unit/bi-tenancy-guard.test.ts` | Tenancy guard | `tests/unit/bi-tenancy-guard.test.ts` |
| `tests/unit/bi-embedding.test.ts` | Embeddings (caché semántico) | `tests/unit/bi-embedding.test.ts` |
| `tests/unit/bi-operacion-lector.test.ts`, `bi-operacion-normalizadores.test.ts` | Lector/normalizadores de la operación | `tests/unit/` |
| `tests/fixtures/operacion.sample.json` | Fixture de operación | `tests/fixtures/operacion.sample.json` |
| `tests/integration/bi/preguntas-obligatorias.test.ts` | Preguntas obligatorias del motor (integración) | `tests/integration/bi/` (adaptar helpers) |
| `tests/integration/bi/candados-simulacion.test.ts` | Candados de solo-lectura (integración) | `tests/integration/bi/` (adaptar helpers) |
| `tests/integration/bi/README.md` | Doc de la suite de integración | `tests/integration/bi/README.md` |

Los helpers de integración `tests/integration/bi/helpers/entorno.ts` y `helpers/motor.ts` se portan con adaptación; `helpers/vanna.ts` NO (ver § NO se copia).

## (g) Plantilla de variables de entorno

| Ruta en 005 | Qué es | Destino en 006 |
|---|---|---|
| `.env.bi.example` (4568 bytes) | Template de variables BI | `.env.example` (renombrar y **depurar**: eliminar `BI_AUTH_USER`/`BI_AUTH_PASSWORD` (login propio eliminado), todo el bloque `SUPERSET_*` y `VANNA_API_URL`; conservar `JWT_SECRET` (ahora compartido con PI), `OLLAMA_HOST`, `LLM_MODEL_SQL`, `EMBED_MODEL`, `PI_BASE_URL`, `BI_BASE_URL`, bloque réplica `REPLICA_DB_*` y `DATABASE_URL`/`BI_ADMIN_*`) |

## NO se copia (eliminado para siempre o acoplado a v1)

| Ruta en 005 | Motivo |
|---|---|
| `docker/superset/` | Superset eliminado (dashboards nativos en Next.js) |
| `docker/vanna/` | Vanna eliminado (motor propio con 1 modelo Ollama) |
| `docker/telegram/` | Bot Telegram fuera de alcance |
| `superset/` (raíz) | Config/bundle de Superset |
| `Dockerfile.vanna`, `Dockerfile.telegram` | Imágenes de servicios eliminados |
| `scripts/build-superset-bundle.py` | Build del bundle Superset |
| `src/lib/bi/vanna-client.ts` | Cliente Vanna |
| `tests/unit/bi-vanna-client.test.ts` | Test del cliente Vanna |
| `tests/integration/bi/helpers/vanna.ts` | Helper de integración Vanna |
| `tests/unit/bi-superset-link.test.tsx` | Acoplado a Superset |
| `tests/unit/bi-login.test.ts` y login propio en `src/` (`src/lib/auth/*` de v1) | Auth JWT ahora compartido con PI; el login propio con clave en claro está eliminado |
| `docker/mv-refresh/` (raíz `docker/`) | Revisar en fase de réplica: si su lógica ya cubre `scripts/refresh-mv.sh`, no portar el contenedor |
| `docker-compose.bi.yml`, `Dockerfile.next` | Se reescriben para el nuevo stack (Compose en VPS Hostinger sin Superset/Vanna/Telegram); sirven solo de referencia |
| `INVENTARIO-DE-SECRETOS.md` de 005 | Documento de secretos de v1; 006 genera el suyo propio |

## Hallazgos relevantes

1. El schema de 005 es limpio y pequeño (129 líneas, solo los 6 modelos BI): se porta casi literal.
2. Las 2 migraciones (`schema_catalogo_bi_inicial`, `mv_fact_bi`) cubren exactamente (a)+(c); no hay más migraciones en 005.
3. `tests/unit/bi-motor.test.ts` y `tests/unit/motor.test.ts` parecen duplicados/sucesores; revisar cuál es el vigente al portar.
4. Varios tests de `src/app` (rutas `bi-preguntar-route`, `bi-kpis-endpoint`, `bi-estado-sistema-route`) no se listaron en (f) porque dependen de endpoints de v1; se reescribirán con los nuevos endpoints.
5. `.env.bi.example` requiere depuración obligatoria (login propio, Superset, Vanna) antes de usarlo como plantilla de 006.
