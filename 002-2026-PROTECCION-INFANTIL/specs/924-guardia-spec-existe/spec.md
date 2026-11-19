# SPEC-924 · Una rama work/pi-SPEC-N no mergea sin su spec.md con Status

**Status**: IMPLEMENTADO

**Prioridad:** sin deploy (CI/tooling).
**Rama:** `work/pi-SPEC-924-guardia-spec-existe` desde `origin/main` (67488a81).

## Problema

SPEC-921 (PR #918) mergeó SIN `specs/921-*/spec.md` y la revisión del CEO no lo vio. Nada
estructural lo impedía: `specs-discipline` (SPEC-865) solo valida la higiene de las carpetas que
EXISTEN; no exige que la SPEC de la rama tenga su nota. Además 915/916/918 quedaron sin línea
`Status` (el índice los marca «⚠️ sin Status»).

> Cambio de contrato respecto de SPEC-860/865 (las notas eran opcionales): ahora la rama
> `work/pi-SPEC-N-*` **exige** `specs/N-*/spec.md` con Status del catálogo. Lo pidió el CEO.

## Cambios

1. **Guardia** `scripts/ci/verificar-spec-de-rama.mjs` (puro + CLI, sin dependencias): para
   `work/pi-SPEC-N-*` exige una carpeta `specs/N-*` (número parseado, tolera ceros a la izquierda)
   con `spec.md` y `Status` del catálogo canónico (mismo regex que `specs-discipline` /
   `generar-readme`). Otras ramas (BI, etc.) → no aplica.
2. **Dónde corre:** `.github/workflows/verificar-base-pr.yml`, job `verificar_base` — check
   REQUERIDO del ruleset y corre en TODO PR (el `should-skip` de `ci.yml` podría saltar un PR de
   solo workflows, como fue #918). Checkout sparse de `specs/` + `scripts/ci/`; la rama entra por
   `env` (no interpolada en el shell).
3. **Bots:** `work/pi-SPEC-487-generados` y `work/pi-SPEC-466-tension` pasan porque sus specs
   (487/466) existen con Status — sin excepción por nombre.
4. **Retroactivo:** `specs/921-build-heap-ci/spec.md` + línea `Status: IMPLEMENTADO` en
   915/916/918.

## Candado

`scripts/ci/verificar-spec-de-rama.candado.test.ts` (allowlist unit):
(1) conducta con fixtures: sin carpeta / sin spec.md / sin Status / Status inventado → rojo; con
Status → verde; ramas no-PI → no aplica. Control positivo: `work/pi-SPEC-921-…` sin spec → rojo.
(2) los bots pasan contra el `specs/` real. (3) cableado: `verificar_base` invoca el script con
`$BRANCH` y sin `continue-on-error`. (4) 915/916/918/921 traen Status.

## Efecto sobre PRs abiertos

Cualquier PR abierto de una rama `work/pi-SPEC-N-*` sin su `spec.md` queda rojo en
`verificar_base` al próximo push: tiene que sumar la nota.
