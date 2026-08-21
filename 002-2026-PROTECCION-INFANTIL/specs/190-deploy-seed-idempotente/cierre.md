# Cierre: SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085)

## Estado

- Rama: `work/002-pi-085`
- Base: `origin/feature/001-scaffolding` (incluye SPEC-188 en `c46617df`)
- PR: pendiente de apertura tras este commit

## Resumen

Se modificó `scripts/deploy-prod.sh` para ejecutar `prisma/seed.ts` de forma idempotente después de las migraciones y antes del sync de módulos/grants. Se auditó `prisma/seed.ts` y se documentaron con comentarios las únicas secciones que usan `update: { ... }` (parámetros nuevos/cambiados por SPEC-186 y backfill canónico de geografía).

## Archivos modificados

- `scripts/deploy-prod.sh`
- `prisma/seed.ts`
- `src/lib/deploy-seed-idempotencia.test.ts`
- `specs/190-deploy-seed-idempotente/spec.md`
- `specs/190-deploy-seed-idempotente/plan.md`
- `specs/190-deploy-seed-idempotente/tasks.md`
- `specs/190-deploy-seed-idempotente/cierre.md`
- `specs/README.md`

## Gate local

```text
npx tsc --noEmit          ✅
npm run lint -- --no-cache ✅ (0 errores, 41 warnings preexistentes)
npm run test:integration  ✅ (234 archivos passed, 1 skipped; 1379 tests passed, 1 skipped; 780.01s)
npm run arch:check        ✅
npm run build             ✅
```

## Cambios técnicos

### `scripts/deploy-prod.sh`

Añadido entre `prisma migrate deploy` y `scripts/sync-modulos-grants.ts`:

```bash
echo "==> Seed idempotente (params + catálogos, respeta valor custom si existe)"
$COMPOSE exec -T app node --import tsx prisma/seed.ts
```

Se conserva el paso posterior de `scripts/sync-modulos-grants.ts` aunque el seed internamente también llama a `syncModulosYGrants()`. Esto genera una doble ejecución del sync, pero es idempotente y aditivo: la segunda pasada no revoca grants ni crea duplicados. Se deja como garantía explícita en el deploy.

### `prisma/seed.ts`

Se añadieron comentarios `EXCEPCIÓN DOCUMENTADA (SPEC-190)` antes de los únicos tres `update:` no vacíos:

1. `monitoreoNuevos`: `monitoreo.ollama.smoke.intervalo_min` y `monitoreo.ollama.smoke.piggyback_min` aplican el nuevo default de SPEC-186.
2. Ciudades de Colombia: backfill canónico de coordenadas, departamento y nombre normalizado.
3. Ciudades de otros países: backfill canónico de coordenadas y nombre normalizado.

El resto de secciones ya usan `update: {}` y respetan valores custom del CEO.

### `src/lib/deploy-seed-idempotencia.test.ts`

Dos tests de integración:

1. Primer deploy crea parámetros; segundo deploy respeta `monitoreo.enabled=false` y `monitoreo.ollama.smoke.modelo=llama-guard3:8b`; reaplica `monitoreo.ollama.smoke.intervalo_min=30`.
2. Un parámetro borrado manualmente se recrea al correr el seed.

## Evidencia de idempotencia (BD)

Los tests leen directamente de `ParametroSistema` tras correr `main()` dos veces:

- `monitoreo.enabled`: permanece en `"false"` después del segundo seed.
- `monitoreo.ollama.smoke.modelo`: permanece en `"llama-guard3:8b"`.
- `monitoreo.ollama.smoke.intervalo_min`: se reafirma en `"30"`.
- `operadores.reconciliacion_enabled`: recreado en `"true"` tras borrado manual.

## Notas

- Sin cambios de schema ni migraciones.
- Sin cambios de código de app ni del motor `src/lib/ai/**`.
