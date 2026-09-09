# Plan — SPEC-602

## Enfoque

Generalización mínima del candado SPEC-588: sacar la terna hardcodeada del Paso 1 del middleware y ponerla en `GUARDIAS_ACCESO.pantallasAuth` (fuente única SPEC-287), con helper `esPantallaAuth` de matching exacto. El resto del bloque (JWT, excepción `mensaje=sesion`, `homeParaRol`, CSP) no cambia.

## Decisión técnica clave

NO usar `GUARDIAS_ACCESO.sesion` / `esRutaSesion` (sugerencia del brief): esa lista es infraestructura de sesión (logout, muros, refresh, `/api/me`) que debe seguir alcanzable con JWT válido, y ninguna de sus rutas es pública (la conjunción sería código muerto). Lista nueva, matching exacto para no capturar `/registro/crear-clave/<token>`.

## Riesgos

- **Loop-cap SPEC-572**: la excepción `?mensaje=sesion` es obligatoria; sin ella el usuario cerrado queda en bucle 307. Cubierta por test.
- **Matching por prefijo**: si `esPantallaAuth` usara `matcheaRuta`, `/registro/crear-clave/<token>` redirigiría con sesión y rompería el flujo de creación de clave. Por eso matching exacto + test de contraprueba.
- **Invariante de guardias**: el assert al import y el ratchet `guardia-invariante` solo leen `consentimiento`/`cambiarPassword`/`vigencia`/`camino`; una lista plana nueva no los afecta (verificado).

## Verificación

- Unitarios: `guardias.test.ts` (helper), `middleware-auth-screens.candado.test.ts` (comportamiento end-to-end del middleware).
- Gate: `tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `arch:check`.
