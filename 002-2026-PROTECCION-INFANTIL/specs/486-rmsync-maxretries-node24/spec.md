# SPEC-486 · rmSync de cleanup con maxRetries — el runner de CI (Node 24 / git 2.55) tira ENOTEMPTY

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: #403 rojo en CI con verde local; diagnóstico Dev 02 desde el log real. Infra-wide, prioridad alta. Radicado por CEO.

## El defecto (infra, no de código)

El runner de CI se actualizó (imagen `ubuntu24/20260831.293` → **git 2.55.0**, y Node **20→24** forzado). En Node 24, `fs.rmSync(dir, { recursive: true, force: true })` **sin `maxRetries`** tira `ENOTEMPTY: directory not empty, rmdir '.../.git'` al borrar un dir temporal con git (git deja handles/procesos un instante). El test file se marca **failed en su `afterAll`** aunque TODOS los tests pasen — exactamente lo que tumbó el job `test-unit` de #403 (candado de SPEC-432; `Tests 2637 passed`, `Test Files 1 failed`, ENOTEMPTY en el cleanup). Le pasa a CUALQUIER PR con este runner.

## El fix

`{ recursive: true, force: true }` → `{ recursive: true, force: true, maxRetries: 5, retryDelay: 100 }` en **todos** los `rmSync` de cleanup (17 ocurrencias, 16 archivos) en `scripts/**` y `src/**/*.test.{ts,tsx}`. Es el patrón estándar de Node para la race ENOTEMPTY/EBUSY: reintenta el borrado. **Inocuo** (no cambia comportamiento cuando no hay race) y **mata la clase**.

Prioridad los 3 que crean repos git temporales (`merge-sin-conflicto:112`, `artefactos-sin-conflicto:229`, `tokens-ratchet-sin-serializar:71/114`) — los que pegan la race con `.git` — pero se barre todo el resto (dirs temporales de storage/apelaciones/heartbeat/e2e).

**NO se cambia ninguna aserción** de los candados barridos (SPEC-432 etc. siguen probando exactamente lo mismo); solo la robustez de su limpieza.

## Candado

`scripts/specs/rmsync-maxretries.candado.test.ts`: barre `scripts/**` + los tests de `src/**` y exige **0** `rmSync(recursive)` sin `maxRetries`. **Verificado por mutación**: sacar `maxRetries` de cualquiera → rojo con el archivo/línea.

## Impacto en arquitectura: no

Solo robustez de limpieza de tests. No toca `tokens:check` ni PISO. **Merge primero** (infra-wide): destraba #403 y protege a #485 y todo PR futuro con el runner nuevo.

## Cómo se probó

- Diagnóstico con reproducción: log de CI vía `gh api .../jobs/<id>/logs` → `ENOTEMPTY` en el cleanup, 2637 tests passed.
- Preflight D-106 + suite unit (incluye el candado) + mutación.
