# TASKS-008 · Seed idempotente catálogo BI

## Estado de tareas

| # | Tarea | Estado |
|---|---|---|
| T-01 | Verificar que `tsx` está instalado como devDependency | ⏳ pendiente |
| T-02 | Crear `prisma/seed-catalogo.ts` con 4 funciones seed | ⏳ pendiente |
| T-03 | Implementar seedTablas() · 15 tablas con upsert({update:{}}) | ⏳ pendiente |
| T-04 | Implementar seedColumnas() · ≥80 columnas · campos verificados candado 15 | ⏳ pendiente |
| T-05 | Implementar seedMetricas() · 15 métricas de negocio | ⏳ pendiente |
| T-06 | Implementar seedEjemplos() · 30 ejemplos NL→SQL válidos | ⏳ pendiente |
| T-07 | Agregar `"prisma": { "seed": "tsx prisma/seed-catalogo.ts" }` en package.json | ⏳ pendiente |
| T-08 | Correr `npx prisma db seed` primera vez · verificar cero errores | ⏳ pendiente |
| T-09 | Test idempotencia: correr seed 2 veces · aserta count igual | ⏳ pendiente |
| T-10 | Verificar counts en BD (candado 15 · mínimos del INSTRUCTIVO) | ⏳ pendiente |

## Verificación gate local

```bash
# T-10: contar registros después de seed
psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla"
# Esperado: ≥ 15

psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_columna"
# Esperado: ≥ 80

psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_metrica"
# Esperado: ≥ 15

psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_ejemplo"
# Esperado: ≥ 30

# T-09: test idempotencia
COUNT_1=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
npx prisma db seed
COUNT_2=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
[ "$COUNT_1" = "$COUNT_2" ] && echo "IDEMPOTENTE OK" || echo "FALLO"
```

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
