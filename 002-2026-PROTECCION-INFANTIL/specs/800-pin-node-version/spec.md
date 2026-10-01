# SPEC-800 · Fijar la versión de Node (local ↔ CI) con candado de paridad

**Feature Branch**: `work/pi-SPEC-800-pin-node`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main`

## Contexto

El CI corre **Node 22** (los workflows lo fijan) y el repo **no tenía `.nvmrc` ni `engines`**: nada
pinaba la versión local. Un Dev en Node 26 persiguió un rojo que en CI no existía (el test del
multipart `SPEC-703` falla en v26 y pasa en v22). La falla real no es ese test: es que **un verde
local dejó de predecir el verde del CI**, y con siete sesiones cada una lo paga por separado sin
atribuirlo al entorno. (Hallazgo de Dev-3 al caracterizar un rojo ajeno.)

## Decisión

1. **Pin local alineado al CI** (hoy `22`, tomado del workflow, NO al revés): `.nvmrc` en la raíz del
   repo + `engines.node: "22.x"` en el `package.json` de 002. Dos mecanismos: `.nvmrc` lo leen las
   herramientas de versión del Dev; `engines` lo revisa el gestor de paquetes al instalar.
2. **Candado de PARIDAD (el centro):** afirma que el major de `.nvmrc`/`engines` coincide con el de
   **TODOS** los `node-version:` de **TODOS** los workflows, por **barrido** del directorio
   (`readdirSync`), no una lista a mano. Hoy el barrido halla 13 ocurrencias en 4 archivos
   (`ci.yml` ×9, `bi-006.yml` ×2, `generados-post-merge.yml` ×1, `tokens-tension.yml` ×1) — el
   radicado estimaba 5 en 2; justamente por eso el candado barre y no lista.
3. Compara por **MAJOR**: el CI fija `node-version: 22` (solo el mayor), y fue 22-vs-26 (una
   diferencia de mayor) lo que rompió.

## Límites (del radicado)

- **No se toca el valor del CI.** El CI es la referencia; lo local se alinea. Subir el CI es otra
  decisión, del CEO.
- **El test del multipart queda FUERA** (pre-existente, ya caracterizado; se decide aparte).
- **El candado CORRE en CI y BLOQUEA:** vive en `scripts/ci/`, registrado en
  `vitest.unit.includes.ts`, y `test:unit` lo corre; `pi-gate` exige `test-unit`.

## Candados

- `scripts/ci/node-version-paridad.candado.test.ts`: paridad sobre archivos reales (nvmrc↔engines↔
  barrido de workflows) + **control positivo por MUTACIÓN en memoria, en las dos direcciones**
  (cambiar el pin → rojo · cambiar un workflow → rojo). RED-first verificado también sobre archivo
  real (`.nvmrc=24` pone rojas las dos aserciones de paridad y lista los 13 pines divergentes).

## Impacto en arquitectura:

- **Esquema / proxy / navegación / datos:** SIN cambios.
- **Config del repo:** nuevo `.nvmrc` (raíz) + `engines.node` en el `package.json` de 002. No cambia
  dependencias ni el valor del CI.
- **Tests / CI:** nuevo candado en el carril `test:unit` (corre y bloquea vía `pi-gate`).
