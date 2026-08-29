# Tasks — SPEC-251 · Guardián de índices críticos (I-49)

**Branch**: `work/002-PI-154`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Extender script (D-72)

- **T001** [✓] Extender `scripts/verify-hnsw-indexes.ts` de 2 a 5 índices + interfaz `IndiceRequerido` + exportar `verificarIndices()` + watchdog 5s + flag `--json`.
  - Archivo: `scripts/verify-hnsw-indexes.ts`
- **T002** [✓] Actualizar `package.json`: alias `indices:check` + preservar `db:verify:hnsw`.

## Fase 2 — Cablear 3 compuertas

- **T003** [✓] `.github/workflows/ci.yml`: agregar paso `npm run indices:check` después de cada `prisma migrate deploy` (3 ocurrencias).
- **T004** [✓] `scripts/deploy-prod.sh`: insertar `$COMPOSE exec -T app npm run indices:check` entre `prisma migrate deploy` y el seed.

## Fase 3 — pi-monitor (7ª señal)

- **T005** [✓] `src/lib/dal/repositories/monitoreo.ts`: agregar `leerIndicesPublicos()`.
- **T006** [✓] `src/lib/monitoreo/probes.ts`: agregar `probeIndices()` + `INDICES_REQUERIDOS`.
- **T007** [✓] `scripts/monitor-probes.mjs`: cablear señal `"indices"` + `leerConfig` + `intervaloDe` + `correrProbe`.

## Fase 4 — Seed anti-I-100

- **T008** [✓] `prisma/seed.ts`: upsert `monitoreo.indices.frecuencia_horas` con `update:{}`.

## Fase 5 — Tests

- **T009** [✓] `scripts/verify-hnsw-indexes.test.ts`: tests unitarios SC-001..SC-004 + REQUIRED.
- **T010** [✓] `src/lib/monitoreo/probe-indices.test.ts`: tests de integración SC-001..SC-003 con repo real y stubs.

## Fase 6 — Verificación y entrega

- **T011** [✓] Gate local: TS, lint, test:unit, build, arch:check.
- **T012** [✓] Gate pre-push (I-101): `git fetch && git rebase && git diff --name-status`.
- **T013** [✓] 5 commits + push + PR + señal `002-PI-154 · REALIZADO`.
- **T014** [✓] Actualizar `specs/README.md` con entrada para SPEC-251.

---

## Restricciones activas

- El guardián NUNCA crea, repara ni borra índices — solo observa y reporta.
- CERO cambios en `src/lib/ai/**`.
- El script extendido es el mismo archivo (`verify-hnsw-indexes.ts`) — D-72.
- Seed con `upsert({create, update:{}})` — anti-I-100.
