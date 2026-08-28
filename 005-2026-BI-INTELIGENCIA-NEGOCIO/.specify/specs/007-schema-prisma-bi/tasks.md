# TASKS-007 · Schema Prisma BI

## Estado de tareas

| # | Tarea | Estado |
|---|---|---|
| T-01 | `npm install @prisma/client prisma` | ⏳ pendiente |
| T-02 | Crear `prisma/schema.prisma` con 6 modelos BI + datasource | ⏳ pendiente |
| T-03 | Verificar nombres @@map contra schema PI (candado 15) | ⏳ pendiente |
| T-04 | Crear migración con `--create-only` · agregar `CREATE EXTENSION IF NOT EXISTS vector;` | ⏳ pendiente |
| T-05 | Verificar que migración SQL no incluye DROP ni TRUNCATE (candado D-11) | ⏳ pendiente |
| T-06 | Aplicar migración con `prisma migrate deploy` | ⏳ pendiente |
| T-07 | Verificar 6 tablas en BD con `\dt bi_catalogo*` | ⏳ pendiente |
| T-08 | Generar cliente con `prisma generate` | ⏳ pendiente |
| T-09 | Verificar compilación TypeScript sin errores (`tsc --noEmit`) | ⏳ pendiente |
| T-10 | Actualizar `INVENTARIO-DE-SECRETOS.md` con entrada bi_admin | ⏳ pendiente |
| T-11 | Actualizar `.env.bi.example` con BI_ADMIN_DATABASE_URL (comentada) | ⏳ pendiente |
| T-12 | Verificar que `.env` NO está en git (`git status`) | ⏳ pendiente |

## Verificación gate local

```bash
# T-07: verificar tablas BI en BD
psql $DATABASE_URL -c "\dt bi_catalogo*"
# Esperado: 6 tablas (bi_catalogo_tabla, bi_catalogo_columna, bi_catalogo_metrica, bi_catalogo_ejemplo, bi_consulta_log, bi_cache_semantico)

# T-09: sin errores TS
npx tsc --noEmit && echo "TS OK"
```

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
