# Quickstart: SPEC-131 — Visibilidad pública solo por reportes aprobados

Verificación guiada tras implementar (dev).

## 1 — SPAM/OTRO no suman (SC-001/SC-002)

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/visibility.test.ts
```

Casos cubiertos: identificador solo-spam → no visible; umbral-1 aprobados + spam → no
visible; umbral aprobados → visible; ratio sobre base aprobada; ocultoPorComiteEn gana.

## 2 — El agregado expone aprobados (FR-003/FR-004)

Tras crear y procesar reportes mixtos (2 aprobados + 1 spam), el agregado muestra
`reportesAprobados = 2` y `autenticadosAprobados` coherente; el spam nunca suma, ni al
crear (PENDIENTE) ni tras el recálculo.

## 3 — Backfill idempotente (SC-004)

```bash
node --env-file=.env --import tsx scripts/backfill-aprobados-agregado.ts
# Esperado: conteos por lote + "inconsistentes=0"; re-correr → 0 cambios
```

Verificación SQL: para cada agregado, `reportesAprobados` = conteo de reportes con
estado ∈ {CLASIFICADO, CORREGIDO}, categoría ∉ {SPAM, OTRO}, no eliminado.

## 4 — Gates

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check
```

Todo verde. `arch:check` exige regenerar `docs/architecture/01-modelo-datos.md` (schema
cambia: 2 campos aditivos) — va en el mismo commit.

## 5 — Producción (paso manual, patrón 048/130)

Tras el deploy con la migración Prisma aplicada:
`docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app node --import tsx scripts/backfill-aprobados-agregado.ts`
y verificación de conteos. Si el CEO quiere reajustar `visibility.report_threshold` por
el menor volumen, es un cambio de parámetro aparte.
