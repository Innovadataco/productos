# Requirements Checklist — Spec 041: Cierre de blindaje + saneamiento

## Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| FR-001 | `scripts/verify-hnsw-indexes.ts` verifies `EmbeddingReporte_vector_idx` and `EmbeddingDataset_vector_idx` exist and use `USING hnsw`. | ✅ | Script exists and was executed. |
| FR-002 | Script exits with code 1 if any index is missing or not HNSW. | ✅ | Confirmed in script logic. |
| FR-003 | `package.json` `db:migrate` uses `prisma migrate deploy`. | ✅ | Verified in `package.json`. |
| FR-004 | No `scripts/*` invokes `prisma migrate dev`, `prisma migrate reset`, or `prisma db push`. | ✅ | `grep` returned no matches. |
| FR-005 | `AGENTS.md` establishes `prisma migrate deploy` as the only allowed migration method. | ✅ | Already present in AGENTS.md. |
| FR-006 | `/api/reportes/procesar` persists generic `processingError` with error code, not raw message. | ✅ | Code updated. |
| FR-007 | `/api/reportes/fallback` persists generic `processingError` with error code, not raw message. | ✅ | Code updated. |
| FR-008 | Both endpoints store `errorCode` in `TransicionReporte.metadatos`. | ✅ | Code updated. |
| FR-009 | No Prisma model changes required. | ✅ | No migration added. |

## Success Criteria

| ID | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | `npm run db:verify:hnsw` reports both indexes OK. | ✅ | Executed successfully. |
| SC-002 | `grep` in `scripts/*` finds no `migrate dev`/`reset`/`db push`. | ✅ | No matches. |
| SC-003 | `package.json` defines `db:migrate` as `prisma migrate deploy`. | ✅ | Verified. |
| SC-004 | After error in `/api/reportes/procesar`, `processingError` is generic. | ✅ | Tests pass. |
| SC-005 | After error in `/api/reportes/fallback`, `processingError` is generic. | ✅ | Tests pass. |
| SC-006 | `procesar` and `fallback` tests pass with updated expectations. | ✅ | 20/20 pass. |
| SC-007 | `tsc`, `lint`, `test` pass without new errors. | ✅ | All pass. |

## Edge Cases

| Case | Status | Notes |
|------|--------|-------|
| Verification script cannot connect to DB | ✅ | Fails with exit code 1. |
| Index exists but is not HNSW | ✅ | Reported as "NOT HNSW". |
| Error without defined code | ✅ | Falls back to `INTERNAL_ERROR`. |
| Report already in `REVISION_MANUAL` | ✅ | Fallback is idempotent. |

## Validation Log

- `npm run db:verify:hnsw`: OK
- `npx tsc --noEmit`: OK
- `npm run lint`: OK (1 pre-existing warning)
- `npm run test`: 79 suites, 419 tests, all pass
- `npm run test` specific `procesar`/`fallback`: 20/20 pass
- `rm -rf .next && npm run build`: OK
- `./scripts/dev-restart.sh`: OK, one worker, healthcheck OK

## Sign-off

Spec 041 implemented and validated. No remaining low-risk debt.
