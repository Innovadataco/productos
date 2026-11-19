# SPEC-930 · Los journeys de regresión de Calidad bloquean el merge

**Status**: IMPLEMENTADO

**Prioridad:** sin deploy (CI). **Rama:** `work/pi-SPEC-930-journeys-bloqueantes` desde `origin/main` (e483cfab).

## Problema

Los journeys de regresión de Calidad (`tests/e2e/recorrido-journey-*.spec.ts`; 925 en PR #920,
vienen 926-928) solo corrían dentro de `test-e2e`. En PR ese job corre su suite con
`continue-on-error` y no está en `gate`/`pi-gate` (SPEC-789) → un journey rojo se veía verde y
no frenaba el merge.

## Cambio

Job nuevo `journeys-e2e` en `.github/workflows/ci.yml`:
- misma preparación que `test-e2e` (BD pgvector, `.env.test` + credenciales E2E dummy, migrate,
  pg-boss, siembras, chromium);
- corre SOLO `npm run test:e2e -- recorrido-journey- --pass-with-no-tests` (filtro por ruta de
  Playwright; sin journeys en el árbol pasa en vez de reventar por «No tests found»);
- DURO (sin `continue-on-error`); corre en TODO PR de PI (`if` solo por `should-skip`, NO por el
  filtro e2e de `should-run-e2e-pi`: un journey protege el recorrido contra cambios de producto);
- `gate` y `pi-gate` lo tienen en `needs`.

`test-e2e` queda como está (los journeys también corren ahí, en blando).

## Candado

`scripts/ci/journeys-bloqueantes.candado.test.ts` (allowlist unit): el job existe, filtra por el
prefijo, no hereda `outputs.e2e`, sin `continue-on-error`, y `pi-gate`/`gate` lo exigen. Control
positivo con la regla REAL de pi-gate (failure/cancelled en needs → rojo): `journeys-e2e` en
failure → rojo; sin él en `needs`, el mismo fallo → verde (el defecto). Mutaciones probadas:
agregar `continue-on-error` → rojo; sacarlo de `needs` de pi-gate → rojo.

## Costo

Un job más por PR de PI (arranque de `npm run dev` + los journeys; hoy minutos).
