# Cierre — Spec 041: Cierre de blindaje + saneamiento

## Resumen

Se completaron los dos puntos de saneamiento pendientes: confirmación de índices vectoriales HNSW y sanitización de `Reporte.processingError`.

## User Stories implementadas

### US1 — Confirmar índices HNSW y documentar despliegue de migraciones (P1)

- Se ejecutó `npm run db:verify:hnsw` (script `scripts/verify-hnsw-indexes.ts`).
- Ambos índices están presentes y usan `USING hnsw`:
  - `EmbeddingReporte_vector_idx`
  - `EmbeddingDataset_vector_idx`
- `package.json` define `db:migrate` como `prisma migrate deploy`.
- No se encontraron llamadas a `migrate dev`, `migrate reset` ni `db push` en `scripts/` ni en `package.json`.
- `AGENTS.md` ya establece `prisma migrate deploy` como único método permitido.

### US2 — No persistir error crudo en `Reporte.processingError` (P1)

- `src/app/api/reportes/procesar/route.ts`: el campo `processingError` ahora almacena un mensaje genérico con el código de error.
- `src/app/api/reportes/fallback/route.ts`: idem, y el `errorCode` se acepta en el body del worker (con fallback a `INTERNAL_ERROR`).
- `TransicionReporte.metadatos` incluye `errorCode` en ambos endpoints.
- Se actualizó `src/app/api/reportes/fallback/route.test.ts` para esperar el mensaje genérico.

## Validación

- `npm run db:verify:hnsw`: OK
- `npx tsc --noEmit`: OK
- `npm run lint`: OK (1 warning heredado de `GestionPageClient.tsx`)
- `npm run test`: 79 suites, 419 tests, todos pasan
- Tests específicos de `procesar` y `fallback`: 20/20 pasan
- `rm -rf .next && npm run build`: OK
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker

## Commits

- `feat(041): US1 — verificar índices HNSW y documentar despliegue`
- `feat(041): US2 — sanitizar processingError en procesar y fallback`
- `docs(041): cierre + artefactos Spec-Kit`

## Deuda técnica

Ninguna. El sistema queda sin nuevas deudas de este spec.

## Próximos pasos

- Planificar spec 042: "Operador corrige la clasificación".
