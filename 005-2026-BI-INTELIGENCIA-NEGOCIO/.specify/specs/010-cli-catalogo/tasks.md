# TASKS-010 · CLI catálogo BI

## Estado de tareas

| # | Tarea | Estado |
|---|---|---|
| T-01 | Crear `scripts/catalogo-cli.mjs` con estructura base ESM + PrismaClient | ⏳ pendiente |
| T-02 | Implementar lector de BI_ADMIN_DATABASE_URL (env o .env.bi.production) | ⏳ pendiente |
| T-03 | Implementar comando `list-tablas` | ⏳ pendiente |
| T-04 | Implementar comando `add-tabla` con parser de flags --legible --descripcion --roles | ⏳ pendiente |
| T-05 | Implementar comando `add-ejemplo` con flags --pregunta --sql --categoria | ⏳ pendiente |
| T-06 | Implementar comando `list-consultas` con flags --usuario --dias | ⏳ pendiente |
| T-07 | Implementar comando `aprobar-cache <consulta_id>` (candado 7) | ⏳ pendiente |
| T-08 | Implementar comando `list-metricas` | ⏳ pendiente |
| T-09 | `chmod +x scripts/catalogo-cli.mjs` | ⏳ pendiente |
| T-10 | Smoke test manual: `node scripts/catalogo-cli.mjs list-tablas` · esperado tabla | ⏳ pendiente |
| T-11 | Crear `tests/unit/catalogo-cli.test.ts` · 4 tests con mock Prisma | ⏳ pendiente |
| T-12 | Correr `npm run test:unit` · todos pasan | ⏳ pendiente |
| T-13 | Crear `scripts/README.md` con ejemplos de los 6 comandos | ⏳ pendiente |

## Verificación gate local

```bash
# T-10: smoke test
node scripts/catalogo-cli.mjs list-tablas
# Esperado: tabla con nombreFuente Reporte y los otros 14

node scripts/catalogo-cli.mjs add-tabla TestCLI --legible "Test CLI" --descripcion "Tabla de prueba"
node scripts/catalogo-cli.mjs list-tablas | grep TestCLI
# Esperado: TestCLI aparece

node scripts/catalogo-cli.mjs list-metricas
# Esperado: tabla con 15+ métricas

# T-12: tests unitarios
npm run test:unit -- tests/unit/catalogo-cli.test.ts
# Esperado: 4 tests passed
```

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
