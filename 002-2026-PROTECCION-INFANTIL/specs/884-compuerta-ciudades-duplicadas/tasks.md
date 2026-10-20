# Tasks · SPEC-884

Diseño en [`spec.md`](./spec.md); cambios en [`plan.md`](./plan.md). Todas completadas.

- [x] **T1 · Grano** · medir en prod (253/253 multidepto, 69 null-depto, 0 vacíos) → fijar grano
  `(paisId, departamentoId, nombreNormalizado)` 3 columnas (no 2: el Santiago null-depto cross-país).
- [x] **T2 · Migración** raw aditiva: `CREATE UNIQUE INDEX ... NULLS NOT DISTINCT WHERE "esActivo"`.
- [x] **T3 · Corrector** `normalizar-y-dedup-ciudades.ts` (re-normaliza + llena vacíos + dedup soft
  país-aware reusando 580). dry-run/`--confirm`, atómico por fila, exit≠0 si falla.
- [x] **T4 · Detector/guardián B** `detectar-ciudades-duplicadas.ts` (preflight blando solo-lectura).
- [x] **T5 · Guardián estructural** · alta en `REQUIRED` de `verify-hnsw-indexes.ts` + chequeo de `predicado`.
- [x] **T6 · Candado** integración (DB: rechazo/control positivo/WHERE esActivo/NULLS NOT DISTINCT) + puro
  (corrector país-aware, detector).
- [x] **T7 · Docs** (spec + Impacto + D-121 + caveat null-depto; plan; tasks) + scripts npm.

**Aparte del PR (responsable):** DEPLOY del índice + preflight del detector contra prod + corrector si hay
sucio (en ese orden). El `CREATE UNIQUE INDEX` falla si el catálogo activo no quedó limpio.
**Caveat del preflight:** revisar `nullDeptoDup` — si hay dups null-depto legítimos de un mismo país,
backfill de depto o `NULLS DISTINCT`.
