# Tasks — SPEC-293 · Fix seed freemium PADRE+COLEGIO

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Diagnóstico: reproducir estado prod (11 planes activos, 0 freemium) en dev con BD limpia + admin + fila MES_1 heredada rota | ✅ Hecho |
| 2 | `prisma/seed.ts` · rama `update` condicional: cura 5 campos canónicos SOLO para `esFreemium=true`, `update:{}` intacto para pagos | ✅ Hecho |
| 3 | `src/lib/seed-freemium.test.ts` · 3 tests (2 freemium activos, cura estado heredado, no pisa ediciones de pago) | ✅ Hecho |
| 4 | `specs/README.md` · entrada SPEC-293 | ✅ Hecho |

## Verificación local

- Reproducción del defecto: BD con `Plan(PADRE,MES_1,2026,esFreemium=false,activo=false)` heredado → `SELECT COUNT(*) FROM Plan WHERE esFreemium=true` = 0 (defecto reproducido).
- Post-fix: mismo estado + `npx tsx prisma/seed.ts` → los 8 planes quedan con freemium correcto (PADRE MES_1 y COLEGIO MES_1 con `esFreemium=true, activo=true, precioBaseCOP=0, usos=1`).
- Los 6 planes pagos (MES_3/MES_6/MES_12) mantienen sus precios originales.
- Test integración: 3/3 verde en 4.3 s local.

## Cierre pendiente (post-verificación en vivo)

- Escribir `cierre.md` con evidencia end-to-end tras el deploy prod.
