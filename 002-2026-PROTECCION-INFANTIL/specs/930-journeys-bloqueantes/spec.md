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
- corre SOLO `npm run test:e2e -- recorrido-journey- --reporter=list,json` y un paso `if: always()`
  (`scripts/ci/verificar-journeys.mjs`) afirma el CONTEO del reporte: ≥1 journey en el árbol, corrieron
  EXACTAMENTE esos archivos, cada uno con ≥1 test, todos `expected`/`flaky`. Sin reporte (config rota) → rojo;
  0 journeys → rojo (sin `--pass-with-no-tests`);
- DURO (sin `continue-on-error`); corre en TODO PR de PI (`if` solo por `should-skip`, NO por el
  filtro e2e de `should-run-e2e-pi`: un journey protege el recorrido contra cambios de producto);
- `gate` y `pi-gate` lo tienen en `needs`.

`test-e2e` queda como está (los journeys también corren ahí, en blando).

## Playwright no cargaba en CI desde SPEC-817 (ampliación del CEO)

`playwright.config.ts` importa `src/lib/test-db-url.ts`, que usaba `import.meta.url`. El package.json no declara
`"type": "module"` → Playwright carga el config como CJS → `SyntaxError: Cannot use 'import.meta' outside a module`.
`test-e2e` (blando) quedaba «success»: ~7 semanas de e2e sin correr. Fix: `rutaDeEsteModulo()` usa `__filename`
(lo proveen el CJS de Playwright y vite-node); si falta → THROW. La derivación por worktree de SPEC-817 queda igual
(su candado sigue verde). Consecuencia esperada: `test-e2e` (sigue `continue-on-error`) ahora corre de verdad y
va a mostrar rojos acumulados; NO se arreglan acá — Calidad los clasifica.

## Candado

`scripts/ci/journeys-bloqueantes.candado.test.ts` (allowlist unit): el job existe, filtra por el
prefijo, no hereda `outputs.e2e`, sin `continue-on-error`, y `pi-gate`/`gate` lo exigen. Control
positivo con la regla REAL de pi-gate (failure/cancelled en needs → rojo): `journeys-e2e` en
failure → rojo; sin él en `needs`, el mismo fallo → verde (el defecto). Mutaciones probadas:
agregar `continue-on-error` → rojo; sacarlo de `needs` de pi-gate → rojo. (5) el verificador de conteo con
reportes sintéticos. (6) Playwright CARGA de verdad (`playwright test --list`); volver a `import.meta` → rojo.

Controles positivos con Playwright REAL (local, reporte JSON real): journey forzado a fallar → rojo · config rota
→ sin reporte → rojo · 0 journeys → rojo · journey que pasa → verde.

## Orden de merge

Hoy `main` no tiene journeys (el primero, SPEC-925, está en #920). Con este job, 0 journeys = ROJO para todo PR
de PI → **#920 debe mergear antes que este PR**.

## Costo

Un job más por PR de PI (arranque de `npm run dev` + los journeys; hoy minutos).
