# Cierre — Spec 080: Corrección del orden de migraciones (I-04)

**Fecha**: 2026-07-22
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/080-orden-migraciones-colegio/`
**Incidencia**: I-04
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS para marcar CERRADA

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 (P1) | Bootstrap de BD nueva sin P3018 | Implementado y validado |
| US2 (P1) | Esquema final sin cambios (drift = 0 respecto al fix) | Validado (ver nota HNSW) |
| US3 (P2) | Procedimiento de recuperación de BD dev desalineada | Documentado en `quickstart.md` §C |

## Cambio realizado

Único cambio de archivos (un `git mv`, sin edición de SQL):

```text
prisma/migrations/20260721001700_add_departamento/
    → prisma/migrations/20260720210000_add_departamento/
```

`add_departamento` (depende solo de `Pais`/`Ciudad`, creadas en `20260714105800_add_pais_ciudad`)
pasa a ejecutarse inmediatamente antes de `20260720214140_add_colegio`, que crea la FK
`Colegio.departamentoId → Departamento.id`. Checksums intactos; esquema final idéntico.

## Validación (comandos del brief, todos ejecutados)

- `docker-compose up -d db`: contenedor corriendo.
- `npx prisma migrate reset --force`: **44 migraciones aplicadas desde cero sin P3018** + seed.
- `npx prisma db seed`: idempotente (0 creados / 0 actualizados en segunda pasada de casos eval).
- `npx prisma migrate status`: `Database schema is up to date!` — cero pendientes, cero fallidas.
- `npx prisma migrate dev --create-only`: propone únicamente `DROP INDEX "EmbeddingDataset_vector_idx"` y `DROP INDEX "EmbeddingReporte_vector_idx"` — **drift preexistente** (índices HNSW creados por SQL crudo en `20260717002004_add_pgvector_hnsw_indexes` / `20260719095000_recrear_indices_hnsw_embeddings`, no expresables en `schema.prisma`). NO aplicado; migración `drift_check` eliminada. Sin drift atribuible a esta spec.
- Validación extra: `migrate deploy` sobre la BD de test recién creada (`proteccion_infantil_test`) — 44 migraciones limpias (segunda prueba desde cero).
- Gate de calidad:
  - `npm run lint`: OK.
  - `npx tsc --noEmit`: OK.
  - `npm run test`: **716/716 tests pasan (119 archivos)**.
  - `rm -rf .next && npm run build`: OK.
  - `./scripts/dev-restart.sh`: app en `:5005` con `-H 0.0.0.0`, healthcheck OK, un solo worker.

## Incidencias ambientales encontradas y resueltas (no relacionadas con I-04)

1. `node_modules` ausente en el worktree → `npm install`.
2. La BD de test `proteccion_infantil_test` no existía en el servidor → creada + `migrate deploy` + `db seed`. El único test que fallaba (`estadisticas-publicas`, esperaba Medellín) depende de datos del seed; `resetDatabase` no borra geo ni plataformas, así que el seed persiste entre corridas.

## Deuda técnica registrada

- **Drift HNSW**: `migrate dev` siempre propondrá dropear `EmbeddingDataset_vector_idx` y `EmbeddingReporte_vector_idx`. Documentado en `quickstart.md` §B con la advertencia de NO aplicarlo. Sugerencia: spec futura para registrar estos índices como drift intencional (p. ej. documentación formal o convención en el schema).
- **Fragilidad de fixtures**: `src/app/api/estadisticas-publicas/route.test.ts` depende de `Medellín` del seed sin crearla en su fixture (`crearPaisCiudad` solo upserta Bogotá). Candidata a hardening en otra spec.

## Commit

- `fix(migraciones): corrige orden add_departamento antes de add_colegio (spec 080, I-04)`
