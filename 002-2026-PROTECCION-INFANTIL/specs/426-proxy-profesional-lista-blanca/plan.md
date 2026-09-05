# SPEC-426 · Plan

## Fases

1. **Superficie mínima del PROFESIONAL** — auditoría rápida de `/api/profesional/**`, `/perfil-profesional/**`, `/dashboard/profesional`.
2. **Lista blanca en `proxy.ts`** — molde SPEC-319: `PROFESIONAL_ROUTES` + `isProfesionalRoute` + `esRutaPermitidaProfesional`.
3. **Branch en `proxyCore`** — 403 (API) / redirect al panel (página), después del branch de COMITE_CONVIVENCIA.
4. **Alinear `esDestinoPermitidoPorRol`** — misma función; menú y arch:check quedan consistentes.
5. **Test bidireccional en `proxy.test.ts`** — 3 grupos «lo listado pasa» + 4 grupos «todo lo demás cae» + 6 casos runtime.
6. **Regenerar `02-roles-capacidades.md`** — aserción C queda VERDE.
7. **Spec + plan + tasks + commit + PR**.

## Reutilización

- Misma forma que `esRutaPermitidaComiteConvivencia` (SPEC-168/319).
- `RUTAS_PERFIL` (SPEC-203), `PUBLICAS_LECTURA_SCHOOL_ADMIN` y `APIS_LECTURA_SCHOOL_ADMIN` (SPEC-118 D-37), `SESION_ROUTES` (SPEC-287).
- Helper `matchesRoute` existente (matching por segmento, no substring).

## Riesgos y candados

- El PROFESIONAL debe seguir viendo la landing / dashboard público / seguimiento. Cubierto por reusar las mismas listas D-37 que SCHOOL_ADMIN.
- Un handler que hoy exista bajo un prefijo no listado y que el PROFESIONAL sí necesite quedaría cerrado. Auditoría de handlers `verifyAuth("PROFESIONAL")` (grep) confirma que TODA su superficie vive bajo `/api/profesional/**`. Si aparece una nueva superficie, se agrega a `PROFESIONAL_ROUTES` con test que la cubra en ambos lados.
- No queremos dos criterios paralelos (menú vs proxy). Todo pasa por `esRutaPermitidaProfesional`.
