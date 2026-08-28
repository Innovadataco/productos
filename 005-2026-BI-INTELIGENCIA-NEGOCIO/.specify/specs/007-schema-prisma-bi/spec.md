# SPEC-007 · Schema Prisma BI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 007 |
| **Nombre** | schema-prisma-bi |
| **Origen** | BI · INSTRUCTIVO-006 · F3C 2026-08-28 COT |
| **Brief** | BI · A-04 (catálogo BI + vistas materializadas) |
| **Estado** | ⏳ spec+plan listo · implementación pendiente (REVISO) |

---

## Objetivo

Crear `prisma/schema.prisma` en el repo BI con 6 modelos del catálogo inteligente. Instalar Prisma como dependencia. Generar y aplicar la migración aditiva inicial. Habilitar el rol `bi_admin` (escritura en tablas BI propias) documentado en `INVENTARIO-DE-SECRETOS.md`.

---

## Alcance

### 6 modelos (exactamente los del BRIEF-A-04 §3.1)

| Modelo Prisma | Tabla BD | Propósito |
|---|---|---|
| `BICatalogoTabla` | `bi_catalogo_tabla` | Tablas expuestas al LLM |
| `BICatalogoColumna` | `bi_catalogo_columna` | Columnas por tabla · sinónimos · roles |
| `BICatalogoMetrica` | `bi_catalogo_metrica` | Métricas de negocio pre-definidas |
| `BICatalogoEjemplo` | `bi_catalogo_ejemplo` | Ejemplos NL→SQL curados |
| `BIConsultaLog` | `bi_consulta_log` | Traza por consulta (candado 12) |
| `BICacheSemantico` | `bi_cache_semantico` | Veredictos humanos NL→SQL (candado 7) |

### Decisión D-21 · aislamiento por prefijo en schema `public`

Los modelos viven en el schema `public` de `bi-db-replica` con prefijo `bi_catalogo_` en el nombre de tabla (via `@@map`). El schema PostgreSQL separado (`bi_catalogo`) **no** se usa porque requiere la preview feature `multiSchema` de Prisma (inestable en Prisma 6). El prefijo `bi_` es suficiente para evitar colisiones con las tablas replicadas de PI.

### Rol `bi_admin`

Variable `BI_ADMIN_DATABASE_URL` en `.env.bi.production` (fuera de git). Usuario PostgreSQL `bi_admin` con permisos de escritura sobre `bi_catalogo_*` pero **sin** permisos sobre las tablas replicadas de PI (read-only por pg_logical). Ver INVENTARIO-DE-SECRETOS.md.

### Dependencias Prisma a instalar

```bash
npm install @prisma/client
npm install -D prisma
```

### `BICacheSemantico.embeddingPregunta`

Tipo `Unsupported("vector(768)")` requiere extensión `pgvector` ya presente en `pgvector/pgvector:pg16`. La migración SQL generada incluirá `CREATE EXTENSION IF NOT EXISTS vector;` manualmente.

---

## Fuera de alcance

- Seed de datos (SPEC-008)
- Vistas materializadas (SPEC-009)
- CLI (SPEC-010)
- Cambios en el schema de PI (candado escritura)

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 8 · Catálogo como DATO en BD | Esta SPEC crea la estructura que hace real el candado 8 |
| 15 · Verificar en fuente | Nombres de campos verificados contra schema PI 2026-08-28 |
| D-11 · Migraciones aditivas | `prisma migrate dev` añade tablas · nunca destruye |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan · REVISO pendiente |
