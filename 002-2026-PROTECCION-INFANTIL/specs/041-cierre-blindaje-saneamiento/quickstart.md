# Quickstart — Spec 041: Cierre de blindaje + saneamiento

## 1. Verificar índices HNSW

```bash
npm run db:verify:hnsw
```

Expected output:

```
EmbeddingReporte_vector_idx: OK (USING hnsw)
EmbeddingDataset_vector_idx: OK (USING hnsw)
All HNSW indexes OK.
```

If any index is missing, the script exits with code 1 and the deployment must be aborted until an additive migration recreates it.

---

## 2. Confirmar que no hay `migrate dev`/`reset`/`db push` en scripts

```bash
grep -R "migrate dev\|migrate reset\|db push" scripts/ package.json || echo "No dangerous migration commands found"
```

Expected: no matches (except possibly in documentation/comments that explicitly warn against them).

Confirm `package.json`:

```bash
grep '"db:migrate"' package.json
```

Expected: `"db:migrate": "prisma migrate deploy"`.

---

## 3. Sanitización de `processingError` en procesar

1. Trigger a processing error in `/api/reportes/procesar` (e.g., disable Ollama or force a deterministic failure in the classifier pipeline).
2. Check the `Reporte` record in the database:

```sql
SELECT "processingError", "estado" FROM "Reporte" WHERE "estado" = 'REVISION_MANUAL' ORDER BY "createdAt" DESC LIMIT 1;
```

Expected: `processingError` contains `Error durante el procesamiento del reporte (código: ...)` and **not** the raw provider message (e.g., "Ollama no disponible tras 3 reintentos").

3. Check the latest `TransicionReporte`:

```sql
SELECT "metadatos" FROM "TransicionReporte" WHERE "estadoNuevo" = 'REVISION_MANUAL' ORDER BY "createdAt" DESC LIMIT 1;
```

Expected: `metadatos` contains `errorCode` and no raw error message.

---

## 4. Sanitización de `processingError` en fallback

1. Allow the worker supervisor to call `/api/reportes/fallback` with a failed report.
2. Verify the `Reporte` record:

```sql
SELECT "processingError", "estado" FROM "Reporte" WHERE "id" = '<report-id>';
```

Expected: generic message with error code; no raw `error` from the worker body.

3. Verify `TransicionReporte` metadata contains `errorCode`.

---

## 5. Tests

```bash
npx tsc --noEmit
npm run lint
npm run test
```

Expected: all pass (lint may show pre-existing warnings; no new errors).

Run specific tests for the affected routes:

```bash
npx jest src/app/api/reportes/procesar --runInBand
npx jest src/app/api/reportes/fallback --runInBand
```

Expected: 20/20 pass.

---

## 6. Build and deploy

```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```

Expected: app starts on `:5005`, healthcheck returns worker OK, single worker.

---

## 7. Checklist

- [ ] `npm run db:verify:hnsw` reports both indexes OK.
- [ ] No dangerous migration commands in scripts/package.json.
- [ ] `processingError` in `procesar` is generic with error code.
- [ ] `processingError` in `fallback` is generic with error code.
- [ ] `TransicionReporte.metadatos` contains `errorCode`.
- [ ] `tsc`, `lint`, `test` pass.
- [ ] `./scripts/dev-restart.sh` succeeds with one worker.
