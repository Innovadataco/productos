# Plan · SPEC-804 · El temporal sale de `src/`

## Pasos
1. `tokens-check.ts`: `RAIZ_SRC` y el piso del guard overridables por `TOKENS_CHECK_SRC` / `TOKENS_CHECK_PISO` (default = valores reales; `--tension` sigue con la constante literal `PISO`).
2. `tokens-ratchet-sin-serializar.candado.test.ts`: el caso rojo del guard mueve su fixture al tmpdir del sistema y corre el guard contra ese árbol vía los overrides; + control positivo (mismo árbol, piso holgado → verde). Se elimina `src/__spec466_tmp__`.
3. Candado de barrido `ningun-test-escribe-en-src.candado.test.ts`: ningún test construye un path bajo el `src/` del repo y escribe; control positivo in-memory. Registrado en `vitest.unit.includes.ts` (corre y bloquea vía pi-gate).

## No se toca
El endurecimiento ENOENT del scanner de Dev-2 (higiene correcta) · no serializar · schema ni docs 00|01|06 (ventana cerrada hasta #786).

## Gates
tsc · eslint · tokens-ratchet verde (incluye rojo contra temporal + control positivo) · candado de barrido verde · arch:check · test:unit completo.
