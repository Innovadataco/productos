# SPEC-600 · Plan — middleware.ts en `src/`

Ver `spec.md` (FR-001–FR-003) y `tasks.md` (fases y tareas).

## Contexto y decisión

Bug crítico en producción: con App Router en `src/`, Next.js solo autodetecta `src/middleware.ts`; el `middleware.ts` de la raíz quedaba inerte y `.next/server/middleware.js` no se generaba en el VPS. Toda la capa de routing (guard de sesión SPEC-287, auth-screens SPEC-588, CSP con nonce) nunca corrió en producción, pese a la suite verde — los tests importan el archivo de la raíz directamente.

## Enfoque técnico

- **Puente, no mudanza**: `src/middleware.ts` re-exporta `export { middleware } from "../middleware"` y declara `config` con matcher **literal** — Next 16 no reconoce un `config` re-exportado (warning + default que correría el guard sobre assets estáticos). La implementación y sus tests (SPEC-287/588) quedan en la raíz: cero riesgo de regresión de comportamiento; el candado asiente identidad de `middleware` y del matcher.
- **Candado de recaída**: test unitario estático+dinámico — existe el archivo, re-exporta función + objeto con matcher, y es la misma referencia que la raíz (no una copia que pudiera divergir).
- **Verificación de runtime**: la prueba real es el build limpio; el artefacto `.next/server/middleware.js` debe existir tras `npm run build` (sin esto la spec no cierra).

## Riesgos y mitigaciones

- **Doble ejecución** (raíz + src compilan ambos): no aplica — la raíz no es autodetectada por Next con `src/`; solo `src/middleware.ts` entra al bundle.
- **Copia que diverge**: mitigado con el test de identidad de referencia (`toBe`).
- **Borrado accidental del puente**: mitigado por el candado, que corre en el gate de unitarios.
