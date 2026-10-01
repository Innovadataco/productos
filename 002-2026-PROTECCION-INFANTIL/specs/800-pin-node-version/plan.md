# Plan · SPEC-800 · Fijar la versión de Node con candado de paridad

## Pasos
1. `.nvmrc` = `22` en la raíz del repo (tomado del workflow; no se toca el CI).
2. `engines.node` = `"22.x"` en el `package.json` de 002 (advisory; sin `engine-strict` para no romper el install de quien aún está en otra versión).
3. Candado `scripts/ci/node-version-paridad.candado.test.ts`: barrido de `.github/workflows/*.yml` + lectura de `.nvmrc`/`engines`, paridad por MAJOR, control positivo por mutación en memoria (dos direcciones). Resolución de rutas a la raíz del monorepo como el candado hermano (`trigger-push-main`).
4. Registrar el candado en `vitest.unit.includes.ts` para que corra en `test:unit` y bloquee vía `pi-gate`.
5. Documentar la activación del pin en `AGENTS.md` de 002 (una línea: `nvm use` / `nvm install`).

## Verificación
- Candado verde con los 13 pines en 22.
- RED-first: `.nvmrc=24` → rojo (engines + barrido); revertir. Mutación en memoria en las dos direcciones.
- Gates: tsc, eslint, `test:unit` completo (specs-discipline + el candado), arch:check.

## Fuera de alcance
El test del multipart · versiones de otros productos · actualización de dependencias · subir el valor del CI.
